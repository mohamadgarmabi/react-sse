import type { SSEEvent, SSEOptions, SSEReturn, SSEStatus } from './types';

const MAX_EVENTS = 100;

type SSEState<TEventData, TEventType extends string> = Omit<
  SSEReturn<TEventData, TEventType>,
  'connect' | 'close' | 'reconnect'
>;

type StateListener<TEventData, TEventType extends string> = (
  state: SSEState<TEventData, TEventType>
) => void;

export class SSEClient<TEventData = unknown, TEventType extends string = string> {
  private readonly endpointUrl: string | null;
  private readonly options: SSEOptions;
  private readonly listeners = new Set<StateListener<TEventData, TEventType>>();
  private eventSource: EventSource | null = null;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private autoConnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private retryAttemptCount = 0;
  private shouldReconnect = true;
  private shouldConnect = false;

  private state: SSEState<TEventData, TEventType> = {
    status: 'disconnected',
    lastEvent: null,
    events: [],
    error: null,
    retryCount: 0,
  };

  public constructor(endpointUrl: string | null, options: SSEOptions = {}) {
    this.endpointUrl = endpointUrl;
    this.options = options;

    const connectionMode = options.connectionMode ?? 'auto';
    const autoConnectDelay = options.autoConnectDelay ?? 0;

    if (connectionMode === 'auto' && endpointUrl) {
      if (autoConnectDelay > 0) {
        this.autoConnectTimeout = setTimeout(() => {
          this.connect();
        }, autoConnectDelay);
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
    if (!this.endpointUrl) {
      this.setState({
        status: 'disconnected',
      });
      return;
    }

    this.shouldConnect = true;
    this.shouldReconnect = this.options.autoReconnect ?? true;
    this.connectWithEventSource();
  }

  public close(): void {
    this.shouldConnect = false;
    this.shouldReconnect = false;
    this.cleanupConnection();
    this.setState({
      status: 'closed',
      error: null,
      retryCount: 0,
      events: [],
      lastEvent: null,
    });
  }

  public reconnect(): void {
    this.cleanupConnection();
    this.retryAttemptCount = 0;
    this.setState({
      error: null,
      retryCount: 0,
      status: 'connecting',
    });

    if (this.endpointUrl) {
      this.connect();
    }
  }

  public destroy(): void {
    this.shouldReconnect = false;
    this.shouldConnect = false;
    this.cleanupConnection();
    this.listeners.clear();
  }

  private connectWithEventSource(): void {
    if (!this.endpointUrl || !this.shouldConnect) {
      return;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    const credentials = this.options.credentials ?? 'same-origin';

    this.setState({
      status: 'connecting',
      error: null,
    });

    this.eventSource = new EventSource(this.endpointUrl, {
      withCredentials: credentials === 'include',
    });

    this.eventSource.onopen = () => {
      this.retryAttemptCount = 0;
      this.setState({
        status: 'connected',
        retryCount: 0,
      });
    };

    this.eventSource.onmessage = (messageEvent: MessageEvent<string>) => {
      this.pushEvent({
        type: 'message' as TEventType,
        data: this.safeParse(messageEvent.data),
        id: messageEvent.lastEventId || undefined,
        timestamp: Date.now(),
      });
    };

    this.eventSource.onerror = () => {
      this.setState({
        status: 'error',
        error: new Error('SSE connection error'),
      });

      if (!this.shouldReconnect || !this.shouldConnect) {
        this.setState({ status: 'disconnected' });
        return;
      }

      const maxRetries = this.options.maxRetries ?? 5;
      if (this.retryAttemptCount >= maxRetries) {
        this.setState({
          status: 'disconnected',
        });
        return;
      }

      this.retryAttemptCount += 1;
      this.setState({ retryCount: this.retryAttemptCount });
      const retryDelay = this.calculateRetryDelay(this.retryAttemptCount - 1);
      this.retryTimeout = setTimeout(() => {
        this.connectWithEventSource();
      }, retryDelay);
    };
  }

  private pushEvent(newEvent: SSEEvent<TEventData, TEventType>): void {
    const nextEvents = [...this.state.events, newEvent];
    const boundedEvents =
      nextEvents.length > MAX_EVENTS
        ? nextEvents.slice(-MAX_EVENTS)
        : nextEvents;

    this.setState({
      lastEvent: newEvent,
      events: boundedEvents,
    });
  }

  private safeParse(rawData: string): TEventData {
    try {
      return JSON.parse(rawData) as TEventData;
    } catch {
      return rawData as TEventData;
    }
  }

  private calculateRetryDelay(attempt: number): number {
    const maxRetryDelay = this.options.maxRetryDelay ?? 30000;
    const initialRetryDelay = this.options.initialRetryDelay ?? 1000;
    const retryDelayFunction = this.options.retryDelayFn;

    if (retryDelayFunction) {
      return Math.min(retryDelayFunction(attempt), maxRetryDelay);
    }

    const exponentialDelay = initialRetryDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000;
    return Math.min(exponentialDelay + jitter, maxRetryDelay);
  }

  private cleanupConnection(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    if (this.autoConnectTimeout) {
      clearTimeout(this.autoConnectTimeout);
      this.autoConnectTimeout = null;
    }
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
