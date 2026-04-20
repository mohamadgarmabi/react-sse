import type { SSEEvent, SSEStatus, SSEOptions } from './types';
import type { WorkerMessage, WorkerResponse, ClientInfo } from './worker-types';

// Fix: Correct global scope typing for self outside the main thread.
// There is no global type named DedicatedWorkerGlobalScope or SharedWorkerGlobalScope in the SharedWorker context.
// Use globalThis/self as SharedWorkerGlobalScope (fallback for type-safety).
declare const self: {
  onconnect: ((event: MessageEvent) => void) | null;
} & typeof globalThis;

// Shared Worker implementation for managing SSE connections
class SSESharedWorker {
  private clients: Map<string, ClientInfo> = new Map();
  private currentConnection: {
    url: string;
    options: SSEOptions;
    status: SSEStatus;
    events: SSEEvent[];
    lastEvent: SSEEvent | null;
    error: Error | null;
    retryCount: number;
  } | null = null;
  private eventSource: EventSource | null = null;
  private fetchController: AbortController | null = null;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt: number = 0;

  constructor() {
    // In a SharedWorker, 'onconnect' should be set on the global self.
    // The handler is (event: MessageEvent), but it's not WorkerEventMap.
    self.onconnect = this.handleConnect.bind(this);
  }

  // The connect event type for a shared worker expects a MessageEvent with the 'ports' property.
  private handleConnect(event: MessageEvent) {
    const port = (event as MessageEvent).ports[0];
    const clientId = this.generateClientId();

    const clientInfo: ClientInfo = {
      id: clientId,
      port,
      subscribed: false,
    };

    this.clients.set(clientId, clientInfo);

    port.onmessage = (e: MessageEvent<WorkerMessage>) => {
      this.handleMessage(clientId, e.data);
    };

    port.onmessageerror = (error) => {
      console.error('Message error from client:', error);
    };

    port.start();

    // Send initial connection info if already connected
    if (this.currentConnection) {
      this.sendToClient(clientId, {
        type: 'CONNECTED',
        payload: { url: this.currentConnection.url },
      });
      this.sendToClient(clientId, {
        type: 'STATUS',
        payload: { status: this.currentConnection.status },
      });
      this.sendToClient(clientId, {
        type: 'RETRY_COUNT',
        payload: { count: this.currentConnection.retryCount },
      });

      if (this.currentConnection.lastEvent) {
        this.sendToClient(clientId, {
          type: 'EVENT',
          payload: { event: this.currentConnection.lastEvent },
        });
      }
    }
  }

  private handleMessage(clientId: string, message: WorkerMessage) {
    switch (message.type) {
      case 'CONNECT':
        this.connect(message.payload.url, message.payload.options);
        break;
      case 'DISCONNECT':
        this.disconnect();
        break;
      case 'RECONNECT':
        this.reconnect();
        break;
      case 'SUBSCRIBE':
        this.subscribeClient(clientId);
        break;
      case 'UNSUBSCRIBE':
        this.unsubscribeClient(clientId);
        break;
    }
  }

  private subscribeClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscribed = true;

      // Send current state to newly subscribed client
      if (this.currentConnection) {
        this.sendToClient(clientId, {
          type: 'STATUS',
          payload: { status: this.currentConnection.status },
        });
        this.sendToClient(clientId, {
          type: 'RETRY_COUNT',
          payload: { count: this.currentConnection.retryCount },
        });

        // Send all cached events
        this.currentConnection.events.forEach((event) => {
          this.sendToClient(clientId, {
            type: 'EVENT',
            payload: { event },
          });
        });
      }
    }
  }

  private unsubscribeClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscribed = false;
    }
  }

  private connect(url: string, options: SSEOptions) {
    // If already connected to the same URL, just update subscribers
    if (this.currentConnection && this.currentConnection.url === url) {
      this.broadcast({ type: 'CONNECTED', payload: { url } });
      this.broadcast({
        type: 'STATUS',
        payload: { status: this.currentConnection.status },
      });
      return;
    }

    // Disconnect existing connection
    this.disconnect();

    this.currentConnection = {
      url,
      options,
      status: 'connecting',
      events: [],
      lastEvent: null,
      error: null,
      retryCount: 0,
    };

    this.broadcast({ type: 'CONNECTED', payload: { url } });
    this.broadcast({ type: 'STATUS', payload: { status: 'connecting' } });

    this.establishConnection(url, options);
  }

  private establishConnection(url: string, options: SSEOptions) {
    const {
      headers = {},
    } = options;

    // Use fetch API if custom headers are provided
    if (Object.keys(headers).length > 0) {
      this.connectWithFetch(url, options);
    } else {
      this.connectWithEventSource(url, options);
    }
  }

  private async connectWithFetch(url: string, options: SSEOptions) {
    const {
      headers = {},
      credentials = 'same-origin',
      maxRetryDelay = 30000,
      initialRetryDelay = 1000,
      maxRetries = 5,
      retryDelayFn,
    } = options;

    try {
      if (this.currentConnection) {
        this.currentConnection.status = 'connecting';
        this.broadcast({
          type: 'STATUS',
          payload: { status: 'connecting' },
        });
      }

      this.fetchController = new AbortController();

      const requestHeaders: HeadersInit = {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        ...headers,
      };

      const response = await fetch(url, {
        method: 'GET',
        headers: requestHeaders,
        signal: this.fetchController.signal,
        cache: 'no-store',
        credentials,
      });

      if (!response.ok) {
        // Handle 401 specifically - authentication error
        if (response.status === 401) {
          const error = new Error(`Authentication failed! status: ${response.status}`);
          error.name = 'AuthenticationError';
          throw error;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      if (this.currentConnection) {
        this.currentConnection.status = 'connected';
        this.currentConnection.retryCount = 0;
        this.retryAttempt = 0;
      }

      this.broadcast({ type: 'STATUS', payload: { status: 'connected' } });
      this.broadcast({ type: 'RETRY_COUNT', payload: { count: 0 } });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          let readResult;
          try {
            readResult = await reader.read();
          } catch (readErr) {
            // Connection error during read - treat as connection failure
            throw new Error('Connection lost while reading stream');
          }

          const { done, value } = readResult;

          if (done) {
            // Stream ended - treat as connection failure
            throw new Error('Stream ended unexpectedly');
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          // Optimize: preserve incomplete line for next iteration
          buffer = lines.pop() || '';

          let eventType = 'message';
          let eventData = '';
          let eventId: string | undefined;

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.substring(6).trim();
            } else if (line.startsWith('data:')) {
              eventData += (eventData ? '\n' : '') + line.substring(5).trim();
            } else if (line.startsWith('id:')) {
              eventId = line.substring(3).trim();
            }
          }

          if (eventData && this.currentConnection) {
            try {
              const parsedData = JSON.parse(eventData);
              const event: SSEEvent = {
                type: eventType,
                data: parsedData,
                id: eventId,
                timestamp: Date.now(),
              };

              this.handleSSEEvent(event);
            } catch {
              const event: SSEEvent = {
                type: eventType,
                data: eventData,
                id: eventId,
                timestamp: Date.now(),
              };

              this.handleSSEEvent(event);
            }
          }
        }
      } finally {
        // Ensure reader is released
        try {
          await reader.cancel();
        } catch {
          // Ignore cancellation errors
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const error = err instanceof Error ? err : new Error('Unknown error');
      
      // For 401 errors, don't retry automatically - user needs to refresh auth
      if (error.name === 'AuthenticationError') {
        if (this.currentConnection) {
          this.currentConnection.status = 'disconnected';
          this.currentConnection.events = [];
          this.currentConnection.lastEvent = null;
        }
        this.broadcast({ type: 'STATUS', payload: { status: 'disconnected' } });
        this.broadcast({
          type: 'ERROR',
          payload: { error: { message: error.message, name: error.name } },
        });
        return;
      }
      
      this.handleError(error, options);
    }
  }

  private connectWithEventSource(url: string, options: SSEOptions) {
    const {
      credentials = 'same-origin',
      maxRetryDelay = 30000,
      initialRetryDelay = 1000,
      maxRetries = 5,
    } = options;

    // Close existing EventSource if any
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.eventSource = new EventSource(url, {
      withCredentials: credentials === 'include',
    });

    this.eventSource.onopen = () => {
      if (this.currentConnection) {
        this.currentConnection.status = 'connected';
        this.currentConnection.retryCount = 0;
        this.retryAttempt = 0;
      }
      this.broadcast({ type: 'STATUS', payload: { status: 'connected' } });
      this.broadcast({ type: 'RETRY_COUNT', payload: { count: 0 } });
    };

    this.eventSource.onmessage = (e) => {
      try {
        const parsedData = JSON.parse(e.data);
        const event: SSEEvent = {
          type: 'message',
          data: parsedData,
          id: e.lastEventId || undefined,
          timestamp: Date.now(),
        };
        this.handleSSEEvent(event);
      } catch {
        const event: SSEEvent = {
          type: 'message',
          data: e.data,
          id: e.lastEventId || undefined,
          timestamp: Date.now(),
        };
        this.handleSSEEvent(event);
      }
    };

    this.eventSource.onerror = () => {
      // The EventSource.onerror fires on every error or closed connection
      // but only report as error if actually closed (per spec)
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        // Close EventSource to prevent automatic retries
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        const error = new Error('SSE connection error');
        this.handleError(error, options);
      }
    };
  }

  private handleSSEEvent(event: SSEEvent) {
    if (this.currentConnection) {
      this.currentConnection.lastEvent = event;
      this.currentConnection.events.push(event);

      // Keep only last 100 events to prevent memory issues (optimized: use slice instead of shift)
      const MAX_EVENTS = 100;
      if (this.currentConnection.events.length > MAX_EVENTS) {
        this.currentConnection.events = this.currentConnection.events.slice(-MAX_EVENTS);
      }
    }

    this.broadcast({ type: 'EVENT', payload: { event } });
  }

  private handleError(error: Error, options: SSEOptions) {
    const {
      maxRetries = 5,
      maxRetryDelay = 30000,
      initialRetryDelay = 1000,
      retryDelayFn,
      autoReconnect = true,
    } = options;

    if (this.currentConnection) {
      this.currentConnection.error = error;
      this.currentConnection.status = 'error';
    }

    this.broadcast({
      type: 'ERROR',
      payload: { error: { message: error.message, name: error.name } },
    });
    this.broadcast({ type: 'STATUS', payload: { status: 'error' } });

    if (autoReconnect && this.retryAttempt < maxRetries && this.currentConnection) {
      this.retryAttempt += 1;

      if (this.currentConnection) {
        this.currentConnection.retryCount = this.retryAttempt;
      }

      this.broadcast({
        type: 'RETRY_COUNT',
        payload: { count: this.retryAttempt },
      });

      const delay = this.calculateRetryDelay(
        this.retryAttempt - 1,
        initialRetryDelay,
        maxRetryDelay,
        retryDelayFn
      );

      this.retryTimeout = setTimeout(() => {
        if (this.currentConnection) {
          this.establishConnection(
            this.currentConnection.url,
            this.currentConnection.options
          );
        }
      }, delay);
    } else {
      if (this.currentConnection) {
        this.currentConnection.status = 'disconnected';
      }
      this.broadcast({ type: 'STATUS', payload: { status: 'disconnected' } });
    }
  }

  private calculateRetryDelay(
    attempt: number,
    initialDelay: number,
    maxDelay: number,
    customFn?: (attempt: number) => number
  ): number {
    if (customFn) {
      return Math.min(customFn(attempt), maxDelay);
    }
    const baseDelay = initialDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000;
    return Math.min(baseDelay + jitter, maxDelay);
  }

  private reconnect() {
    this.retryAttempt = 0;
    if (this.currentConnection) {
      this.currentConnection.retryCount = 0;
      this.currentConnection.error = null;
      // Clear cached data before reconnecting
      this.currentConnection.events = [];
      this.currentConnection.lastEvent = null;
      this.disconnect();
      this.establishConnection(
        this.currentConnection.url,
        this.currentConnection.options
      );
    }
  }

  private disconnect() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    if (this.fetchController) {
      this.fetchController.abort();
      this.fetchController = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.currentConnection) {
      this.currentConnection.status = 'disconnected';
      // Clear all cached data on disconnect
      this.currentConnection.events = [];
      this.currentConnection.lastEvent = null;
      this.currentConnection.error = null;
      this.currentConnection.retryCount = 0;
    }

    this.retryAttempt = 0;

    this.broadcast({ type: 'DISCONNECTED' });
    this.broadcast({ type: 'STATUS', payload: { status: 'disconnected' } });
  }

  private broadcast(response: WorkerResponse) {
    // Optimize: only iterate over subscribed clients
    for (const [clientId, client] of this.clients.entries()) {
      if (client.subscribed) {
        this.sendToClient(clientId, response);
      }
    }
  }

  private sendToClient(clientId: string, response: WorkerResponse) {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.port.postMessage(response);
      } catch (error) {
        console.error('Error sending message to client:', error);
      }
    }
  }

  private generateClientId(): string {
    // Optimize: use performance.now() for better precision and crypto.randomUUID if available
    const timestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `client_${timestamp}_${random}`;
  }
}

// Initialize Shared Worker
new SSESharedWorker();
