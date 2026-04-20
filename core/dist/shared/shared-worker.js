class SSESharedWorker {
    clients = new Map();
    currentConnection = null;
    eventSource = null;
    fetchController = null;
    retryTimeout = null;
    retryAttempt = 0;
    constructor() {
        self.onconnect = this.handleConnect.bind(this);
    }
    handleConnect(event) {
        const port = event.ports[0];
        const clientId = this.generateClientId();
        const clientInfo = {
            id: clientId,
            port,
            subscribed: false,
        };
        this.clients.set(clientId, clientInfo);
        port.onmessage = (incomingMessage) => {
            this.handleMessage(clientId, incomingMessage.data);
        };
        port.onmessageerror = (messageError) => {
            console.error('Message error from client:', messageError);
        };
        port.start();
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
        if (!client) {
            return;
        }
        client.subscribed = true;
        if (this.currentConnection) {
            this.sendToClient(clientId, {
                type: 'STATUS',
                payload: { status: this.currentConnection.status },
            });
            this.sendToClient(clientId, {
                type: 'RETRY_COUNT',
                payload: { count: this.currentConnection.retryCount },
            });
            this.currentConnection.events.forEach((event) => {
                this.sendToClient(clientId, {
                    type: 'EVENT',
                    payload: { event },
                });
            });
        }
    }
    unsubscribeClient(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            client.subscribed = false;
        }
    }
    connect(url, options) {
        if (this.currentConnection && this.currentConnection.url === url) {
            this.broadcast({ type: 'CONNECTED', payload: { url } });
            this.broadcast({
                type: 'STATUS',
                payload: { status: this.currentConnection.status },
            });
            return;
        }
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
        const { headers = {} } = options;
        if (Object.keys(headers).length > 0) {
            this.connectWithFetch(url, options);
            return;
        }
        this.connectWithEventSource(url, options);
    }
    async connectWithFetch(url, options) {
        const { headers = {}, credentials = 'same-origin', maxRetryDelay = 30000, initialRetryDelay = 1000, maxRetries = 5, retryDelayFn, } = options;
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
                Accept: 'text/event-stream',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                Pragma: 'no-cache',
                Expires: '0',
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
                if (response.status === 401) {
                    const authenticationError = new Error(`Authentication failed! status: ${response.status}`);
                    authenticationError.name = 'AuthenticationError';
                    throw authenticationError;
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
            const streamReader = response.body.getReader();
            const decoder = new TextDecoder();
            let textBuffer = '';
            try {
                while (true) {
                    let readResult;
                    try {
                        readResult = await streamReader.read();
                    }
                    catch {
                        throw new Error('Connection lost while reading stream');
                    }
                    const { done, value } = readResult;
                    if (done) {
                        throw new Error('Stream ended unexpectedly');
                    }
                    textBuffer += decoder.decode(value, { stream: true });
                    const lines = textBuffer.split('\n');
                    textBuffer = lines.pop() || '';
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
                            this.handleSSEEvent({
                                type: eventType,
                                data: parsedData,
                                id: eventId,
                                timestamp: Date.now(),
                            });
                        }
                        catch {
                            this.handleSSEEvent({
                                type: eventType,
                                data: eventData,
                                id: eventId,
                                timestamp: Date.now(),
                            });
                        }
                    }
                }
            }
            finally {
                try {
                    await streamReader.cancel();
                }
                catch {
                    // noop
                }
            }
        }
        catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            const normalizedError = error instanceof Error ? error : new Error('Unknown error');
            if (normalizedError.name === 'AuthenticationError') {
                if (this.currentConnection) {
                    this.currentConnection.status = 'disconnected';
                    this.currentConnection.events = [];
                    this.currentConnection.lastEvent = null;
                }
                this.broadcast({ type: 'STATUS', payload: { status: 'disconnected' } });
                this.broadcast({
                    type: 'ERROR',
                    payload: {
                        error: {
                            message: normalizedError.message,
                            name: normalizedError.name,
                        },
                    },
                });
                return;
            }
            this.handleError(normalizedError, options);
        }
    }
    connectWithEventSource(url, options) {
        const { credentials = 'same-origin' } = options;
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
        this.eventSource.onmessage = (messageEvent) => {
            try {
                const parsedData = JSON.parse(messageEvent.data);
                this.handleSSEEvent({
                    type: 'message',
                    data: parsedData,
                    id: messageEvent.lastEventId || undefined,
                    timestamp: Date.now(),
                });
            }
            catch {
                this.handleSSEEvent({
                    type: 'message',
                    data: messageEvent.data,
                    id: messageEvent.lastEventId || undefined,
                    timestamp: Date.now(),
                });
            }
        };
        this.eventSource.onerror = () => {
            if (this.eventSource?.readyState === EventSource.CLOSED) {
                if (this.eventSource) {
                    this.eventSource.close();
                    this.eventSource = null;
                }
                this.handleError(new Error('SSE connection error'), options);
            }
        };
    }
    handleSSEEvent(event) {
        if (this.currentConnection) {
            this.currentConnection.lastEvent = event;
            this.currentConnection.events.push(event);
            if (this.currentConnection.events.length > 100) {
                this.currentConnection.events = this.currentConnection.events.slice(-100);
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
            const retryDelay = this.calculateRetryDelay(this.retryAttempt - 1, initialRetryDelay, maxRetryDelay, retryDelayFn);
            this.retryTimeout = setTimeout(() => {
                if (this.currentConnection) {
                    this.establishConnection(this.currentConnection.url, this.currentConnection.options);
                }
            }, retryDelay);
        }
        else {
            if (this.currentConnection) {
                this.currentConnection.status = 'disconnected';
            }
            this.broadcast({ type: 'STATUS', payload: { status: 'disconnected' } });
        }
    }
    calculateRetryDelay(attempt, initialRetryDelay, maxRetryDelay, customRetryFunction) {
        if (customRetryFunction) {
            return Math.min(customRetryFunction(attempt), maxRetryDelay);
        }
        const baseDelay = initialRetryDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 1000;
        return Math.min(baseDelay + jitter, maxRetryDelay);
    }
    reconnect() {
        this.retryAttempt = 0;
        if (this.currentConnection) {
            this.currentConnection.retryCount = 0;
            this.currentConnection.error = null;
            this.currentConnection.events = [];
            this.currentConnection.lastEvent = null;
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
            this.currentConnection.events = [];
            this.currentConnection.lastEvent = null;
            this.currentConnection.error = null;
            this.currentConnection.retryCount = 0;
        }
        this.retryAttempt = 0;
        this.broadcast({ type: 'DISCONNECTED' });
        this.broadcast({ type: 'STATUS', payload: { status: 'disconnected' } });
    }
    broadcast(response) {
        for (const [clientId, client] of this.clients.entries()) {
            if (client.subscribed) {
                this.sendToClient(clientId, response);
            }
        }
    }
    sendToClient(clientId, response) {
        const client = this.clients.get(clientId);
        if (!client) {
            return;
        }
        try {
            client.port.postMessage(response);
        }
        catch (sendError) {
            console.error('Error sending message to client:', sendError);
        }
    }
    generateClientId() {
        const timestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const randomPart = Math.random().toString(36).substring(2, 11);
        return `client_${timestamp}_${randomPart}`;
    }
}
new SSESharedWorker();
export {};
