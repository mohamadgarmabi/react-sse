import type { SSEEvent, SSEOptions, SSEReturn } from './types';
import type { WorkerMessage, WorkerResponse } from './worker-types';

const MAX_EVENTS = 100;

type SSEState<TEventData, TEventType extends string> = Omit<
  SSEReturn<TEventData, TEventType>,
  'connect' | 'close' | 'reconnect'
>;

type StateListener<TEventData, TEventType extends string> = (
  state: SSEState<TEventData, TEventType>
) => void;

export class SSESharedWorkerClient<
  TEventData = unknown,
  TEventType extends string = string,
> {
  private readonly endpointUrl: string | null;
  private readonly options: SSEOptions;
  private readonly workerPath: string;
  private readonly listeners = new Set<StateListener<TEventData, TEventType>>();
  private readonly clientId: string;
  private worker: SharedWorker | null = null;
  private workerPort: MessagePort | null = null;
  private isSubscribed = false;

  private state: SSEState<TEventData, TEventType> = {
    status: 'disconnected',
    lastEvent: null,
    events: [],
    error: null,
    retryCount: 0,
  };

  public constructor(
    endpointUrl: string | null,
    options: SSEOptions = {},
    workerPath = '/shared-worker.js'
  ) {
    this.endpointUrl = endpointUrl;
    this.options = options;
    this.workerPath = workerPath;
    this.clientId = `sse_client_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 9)}`;

    if (!endpointUrl) {
      return;
    }

    this.initializeWorker();

    const connectionMode = options.connectionMode ?? 'auto';
    const autoConnectDelay = options.autoConnectDelay ?? 0;

    if (connectionMode === 'auto') {
      if (autoConnectDelay > 0) {
        setTimeout(() => this.connect(), autoConnectDelay);
      } else {
        this.connect();
      }
    }
  }

  public getSnapshot(): SSEState<TEventData, TEventType> {
    return this.state;
  }

  public subscribe(
    listener: StateListener<TEventData, TEventType>
  ): () => void {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  public connect(): void {
    if (!this.endpointUrl || !this.workerPort) {
      return;
    }

    this.sendWorkerMessage({
      type: 'CONNECT',
      payload: {
        url: this.endpointUrl,
        options: this.options,
      },
    });
  }

  public close(): void {
    this.sendWorkerMessage({ type: 'DISCONNECT' });
    this.setState({
      status: 'closed',
      events: [],
      lastEvent: null,
      retryCount: 0,
      error: null,
    });
  }

  public reconnect(): void {
    this.sendWorkerMessage({ type: 'RECONNECT' });
  }

  public destroy(): void {
    if (this.isSubscribed) {
      this.sendWorkerMessage({
        type: 'UNSUBSCRIBE',
        payload: {
          clientId: this.clientId,
        },
      });
      this.isSubscribed = false;
    }

    if (this.workerPort) {
      this.workerPort.onmessage = null;
      this.workerPort.onmessageerror = null;
      this.workerPort.close();
      this.workerPort = null;
    }
    this.worker = null;
    this.listeners.clear();
  }

  private initializeWorker(): void {
    try {
      this.worker = new SharedWorker(this.workerPath);
      this.workerPort = this.worker.port;
      this.workerPort.start();

      this.workerPort.onmessage = (
        event: MessageEvent<WorkerResponse>
      ): void => {
        this.handleWorkerMessage(event.data);
      };
      this.workerPort.onmessageerror = (): void => {
        this.setState({
          error: new Error('Failed to receive message from SharedWorker'),
          status: 'error',
        });
      };

      this.sendWorkerMessage({
        type: 'SUBSCRIBE',
        payload: {
          clientId: this.clientId,
        },
      });
      this.isSubscribed = true;
    } catch (sharedWorkerError) {
      this.setState({
        status: 'error',
        error:
          sharedWorkerError instanceof Error
            ? sharedWorkerError
            : new Error('Failed to initialize SharedWorker'),
      });
    }
  }

  private handleWorkerMessage(message: WorkerResponse): void {
    switch (message.type) {
      case 'STATUS': {
        this.setState({ status: message.payload.status });
        return;
      }
      case 'RETRY_COUNT': {
        this.setState({ retryCount: message.payload.count });
        return;
      }
      case 'ERROR': {
        this.setState({
          error: new Error(message.payload.error.message),
          status: 'error',
        });
        return;
      }
      case 'EVENT': {
        const event = message.payload.event as SSEEvent<TEventData, TEventType>;
        const nextEvents = [...this.state.events, event];
        const boundedEvents =
          nextEvents.length > MAX_EVENTS
            ? nextEvents.slice(-MAX_EVENTS)
            : nextEvents;

        this.setState({
          lastEvent: event,
          events: boundedEvents,
        });
        return;
      }
      case 'DISCONNECTED': {
        this.setState({
          status: 'disconnected',
          events: [],
          lastEvent: null,
          retryCount: 0,
          error: null,
        });
        return;
      }
      default: {
        return;
      }
    }
  }

  private sendWorkerMessage(workerMessage: WorkerMessage): void {
    if (!this.workerPort) {
      return;
    }
    this.workerPort.postMessage(workerMessage);
  }

  private setState(
    partialState: Partial<SSEState<TEventData, TEventType>>
  ): void {
    this.state = {
      ...this.state,
      ...partialState,
    };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
