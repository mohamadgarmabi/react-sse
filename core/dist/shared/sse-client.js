const MAX_EVENTS = 100;
export class SSEClient {
    endpointUrl;
    options;
    listeners = new Set();
    eventSource = null;
    retryTimeout = null;
    autoConnectTimeout = null;
    retryAttemptCount = 0;
    shouldReconnect = true;
    shouldConnect = false;
    state = {
        status: 'disconnected',
        lastEvent: null,
        events: [],
        error: null,
        retryCount: 0,
    };
    constructor(endpointUrl, options = {}) {
        this.endpointUrl = endpointUrl;
        this.options = options;
        const connectionMode = options.connectionMode ?? 'auto';
        const autoConnectDelay = options.autoConnectDelay ?? 0;
        if (connectionMode === 'auto' && endpointUrl) {
            if (autoConnectDelay > 0) {
                this.autoConnectTimeout = setTimeout(() => {
                    this.connect();
                }, autoConnectDelay);
            }
            else {
                this.connect();
            }
        }
    }
    getSnapshot() {
        return this.state;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.state);
        return () => {
            this.listeners.delete(listener);
        };
    }
    connect() {
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
    close() {
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
    reconnect() {
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
    destroy() {
        this.shouldReconnect = false;
        this.shouldConnect = false;
        this.cleanupConnection();
        this.listeners.clear();
    }
    connectWithEventSource() {
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
        this.eventSource.onmessage = (messageEvent) => {
            this.pushEvent({
                type: 'message',
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
    pushEvent(newEvent) {
        const nextEvents = [...this.state.events, newEvent];
        const boundedEvents = nextEvents.length > MAX_EVENTS
            ? nextEvents.slice(-MAX_EVENTS)
            : nextEvents;
        this.setState({
            lastEvent: newEvent,
            events: boundedEvents,
        });
    }
    safeParse(rawData) {
        try {
            return JSON.parse(rawData);
        }
        catch {
            return rawData;
        }
    }
    calculateRetryDelay(attempt) {
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
    cleanupConnection() {
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
    setState(partialState) {
        this.state = {
            ...this.state,
            ...partialState,
        };
        for (const listener of this.listeners) {
            listener(this.state);
        }
    }
}
