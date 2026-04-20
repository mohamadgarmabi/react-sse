const MAX_EVENTS = 100;
export class SSESharedWorkerClient {
    endpointUrl;
    options;
    workerPath;
    listeners = new Set();
    clientId;
    worker = null;
    workerPort = null;
    isSubscribed = false;
    state = {
        status: 'disconnected',
        lastEvent: null,
        events: [],
        error: null,
        retryCount: 0,
    };
    constructor(endpointUrl, options = {}, workerPath = '/shared-worker.js') {
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
    close() {
        this.sendWorkerMessage({ type: 'DISCONNECT' });
        this.setState({
            status: 'closed',
            events: [],
            lastEvent: null,
            retryCount: 0,
            error: null,
        });
    }
    reconnect() {
        this.sendWorkerMessage({ type: 'RECONNECT' });
    }
    destroy() {
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
    initializeWorker() {
        try {
            this.worker = new SharedWorker(this.workerPath);
            this.workerPort = this.worker.port;
            this.workerPort.start();
            this.workerPort.onmessage = (event) => {
                this.handleWorkerMessage(event.data);
            };
            this.workerPort.onmessageerror = () => {
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
        }
        catch (sharedWorkerError) {
            this.setState({
                status: 'error',
                error: sharedWorkerError instanceof Error
                    ? sharedWorkerError
                    : new Error('Failed to initialize SharedWorker'),
            });
        }
    }
    handleWorkerMessage(message) {
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
                const event = message.payload.event;
                const nextEvents = [...this.state.events, event];
                const boundedEvents = nextEvents.length > MAX_EVENTS
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
    sendWorkerMessage(workerMessage) {
        if (!this.workerPort) {
            return;
        }
        this.workerPort.postMessage(workerMessage);
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
