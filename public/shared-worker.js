// Shared Worker implementation for managing SSE connections
class SSESharedWorker {
    constructor() {
        this.clients = new Map();
        this.currentConnection = null;
        this.eventSource = null;
        this.fetchController = null;
        this.retryTimeout = null;
        this.retryAttempt = 0;
        // In a SharedWorker, 'onconnect' should be set on the global self.
        // The handler is (event: MessageEvent), but it's not WorkerEventMap.
        self.onconnect = this.handleConnect.bind(this);
    }
    // The connect event type for a shared worker expects a MessageEvent with the 'ports' property.
    handleConnect(event) {
        const port = event.ports[0];
        const clientId = this.generateClientId();
        const clientInfo = {
            id: clientId,
            port,
            subscribed: false,
        };
        this.clients.set(clientId, clientInfo);
        port.onmessage = (e) => {
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
    handleMessage(clientId, message) {
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
    subscribeClient(clientId) {
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
    unsubscribeClient(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            client.subscribed = false;
        }
    }
    connect(url, options) {
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
    establishConnection(url, options) {
        const { headers = {}, } = options;
        // Use fetch API if custom headers are provided
        if (Object.keys(headers).length > 0) {
            this.connectWithFetch(url, options);
        }
        else {
            this.connectWithEventSource(url, options);
        }
    }
    async connectWithFetch(url, options) {
        const { headers = {}, maxRetryDelay = 30000, initialRetryDelay = 1000, maxRetries = 5, retryDelayFn, } = options;
        try {
            if (this.currentConnection) {
                this.currentConnection.status = 'connecting';
                this.broadcast({
                    type: 'STATUS',
                    payload: { status: 'connecting' },
                });
            }
            this.fetchController = new AbortController();
            const requestHeaders = {
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache',
                ...headers,
            };
            const response = await fetch(url, {
                method: 'GET',
                headers: requestHeaders,
                signal: this.fetchController.signal,
            });
            if (!response.ok) {
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
                    }
                    catch (readErr) {
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
                    let eventId;
                    for (const line of lines) {
                        if (line.startsWith('event:')) {
                            eventType = line.substring(6).trim();
                        }
                        else if (line.startsWith('data:')) {
                            eventData += (eventData ? '\n' : '') + line.substring(5).trim();
                        }
                        else if (line.startsWith('id:')) {
                            eventId = line.substring(3).trim();
                        }
                    }
                    if (eventData && this.currentConnection) {
                        try {
                            const parsedData = JSON.parse(eventData);
                            const event = {
                                type: eventType,
                                data: parsedData,
                                id: eventId,
                                timestamp: Date.now(),
                            };
                            this.handleSSEEvent(event);
                        }
                        catch {
                            const event = {
                                type: eventType,
                                data: eventData,
                                id: eventId,
                                timestamp: Date.now(),
                            };
                            this.handleSSEEvent(event);
                        }
                    }
                }
            }
            finally {
                // Ensure reader is released
                try {
                    await reader.cancel();
                }
                catch {
                    // Ignore cancellation errors
                }
            }
        }
        catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                return;
            }
            const error = err instanceof Error ? err : new Error('Unknown error');
            this.handleError(error, options);
        }
    }
    connectWithEventSource(url, options) {
        const { maxRetryDelay = 30000, initialRetryDelay = 1000, maxRetries = 5, } = options;
        // Close existing EventSource if any
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        this.eventSource = new EventSource(url);
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
                const event = {
                    type: 'message',
                    data: parsedData,
                    id: e.lastEventId || undefined,
                    timestamp: Date.now(),
                };
                this.handleSSEEvent(event);
            }
            catch {
                const event = {
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
    handleSSEEvent(event) {
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
    handleError(error, options) {
        const { maxRetries = 5, maxRetryDelay = 30000, initialRetryDelay = 1000, retryDelayFn, autoReconnect = true, } = options;
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
            const delay = this.calculateRetryDelay(this.retryAttempt - 1, initialRetryDelay, maxRetryDelay, retryDelayFn);
            this.retryTimeout = setTimeout(() => {
                if (this.currentConnection) {
                    this.establishConnection(this.currentConnection.url, this.currentConnection.options);
                }
            }, delay);
        }
        else {
            if (this.currentConnection) {
                this.currentConnection.status = 'disconnected';
            }
            this.broadcast({ type: 'STATUS', payload: { status: 'disconnected' } });
        }
    }
    calculateRetryDelay(attempt, initialDelay, maxDelay, customFn) {
        if (customFn) {
            return Math.min(customFn(attempt), maxDelay);
        }
        const baseDelay = initialDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 1000;
        return Math.min(baseDelay + jitter, maxDelay);
    }
    reconnect() {
        this.retryAttempt = 0;
        if (this.currentConnection) {
            this.currentConnection.retryCount = 0;
            this.currentConnection.error = null;
            this.disconnect();
            this.establishConnection(this.currentConnection.url, this.currentConnection.options);
        }
    }
    disconnect() {
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
        }
        this.broadcast({ type: 'DISCONNECTED' });
        this.broadcast({ type: 'STATUS', payload: { status: 'disconnected' } });
    }
    broadcast(response) {
        // Optimize: only iterate over subscribed clients
        for (const [clientId, client] of this.clients.entries()) {
            if (client.subscribed) {
                this.sendToClient(clientId, response);
            }
        }
    }
    sendToClient(clientId, response) {
        const client = this.clients.get(clientId);
        if (client) {
            try {
                client.port.postMessage(response);
            }
            catch (error) {
                console.error('Error sending message to client:', error);
            }
        }
    }
    generateClientId() {
        // Optimize: use performance.now() for better precision and crypto.randomUUID if available
        const timestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const random = Math.random().toString(36).substring(2, 11);
        return `client_${timestamp}_${random}`;
    }
}
// Initialize Shared Worker
new SSESharedWorker();
