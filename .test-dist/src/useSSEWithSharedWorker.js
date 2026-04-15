"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSSEWithSharedWorker = useSSEWithSharedWorker;
const react_1 = require("react");
// Maximum number of events to keep in memory (prevent memory leaks)
const MAX_EVENTS = 100;
/**
 * Custom React hook for Server-Sent Events (SSE) using Shared Worker
 * This ensures only one SSE connection exists across all tabs/windows
 *
 * @param url - The URL to connect to for SSE
 * @param options - Configuration options for the SSE connection
 * @param workerPath - Path to the Shared Worker file (default: '/shared-worker.js')
 * @returns SSE connection state and controls
 *
 * @example
 * ```tsx
 * const { status, lastEvent, events, error } = useSSEWithSharedWorker('/api/events', {
 *   headers: { 'Authorization': 'Bearer your-auth-token' },
 *   maxRetries: 3,
 *   maxRetryDelay: 10000
 * });
 * ```
 */
function useSSEWithSharedWorker(url, options = {}, workerPath = '/shared-worker.js') {
    const { connectionMode = 'auto', autoConnectDelay = 0, maxRetries = 5, } = options;
    const [status, setStatus] = (0, react_1.useState)('disconnected');
    const [lastEvent, setLastEvent] = (0, react_1.useState)(null);
    const [events, setEvents] = (0, react_1.useState)([]);
    const [error, setError] = (0, react_1.useState)(null);
    const [retryCount, setRetryCount] = (0, react_1.useState)(0);
    const [shouldConnect, setShouldConnect] = (0, react_1.useState)(connectionMode === 'auto');
    const workerRef = (0, react_1.useRef)(null);
    const portRef = (0, react_1.useRef)(null);
    const clientIdRef = (0, react_1.useRef)(null);
    const isSubscribedRef = (0, react_1.useRef)(false);
    // Memoize options to prevent unnecessary re-renders
    const optionsRef = (0, react_1.useRef)(options);
    (0, react_1.useEffect)(() => {
        optionsRef.current = options;
    }, [options]);
    // Handle auto-connect delay
    (0, react_1.useEffect)(() => {
        if (!url) {
            return;
        }
        // In manual mode, don't auto-connect
        if (connectionMode === 'manual') {
            return;
        }
        // Auto-connect with delay if specified
        if (autoConnectDelay > 0) {
            const timeout = setTimeout(() => {
                setShouldConnect(true);
            }, autoConnectDelay);
            return () => clearTimeout(timeout);
        }
        else {
            // No delay, connect immediately
            setShouldConnect(true);
        }
    }, [url, connectionMode, autoConnectDelay]);
    // Initialize Shared Worker
    (0, react_1.useEffect)(() => {
        if (!url) {
            setStatus('disconnected');
            // Clear cached data when URL is removed
            setEvents([]);
            setLastEvent(null);
            return;
        }
        try {
            // Create Shared Worker
            const worker = new SharedWorker(workerPath);
            workerRef.current = worker;
            portRef.current = worker.port;
            const port = worker.port;
            port.start();
            // Generate unique client ID
            clientIdRef.current = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            // Handle messages from Shared Worker
            port.onmessage = (event) => {
                const message = event.data;
                switch (message.type) {
                    case 'STATUS':
                        setStatus(message.payload.status);
                        break;
                    case 'EVENT':
                        const eventData = message.payload.event;
                        setLastEvent(eventData);
                        setEvents((prev) => {
                            const newEvents = [...prev, eventData];
                            // Limit events array size to prevent memory issues
                            return newEvents.length > MAX_EVENTS
                                ? newEvents.slice(-MAX_EVENTS)
                                : newEvents;
                        });
                        break;
                    case 'ERROR':
                        const errorObj = new Error(message.payload.error.message);
                        errorObj.name = message.payload.error.name;
                        setError(errorObj);
                        break;
                    case 'RETRY_COUNT':
                        setRetryCount(message.payload.count);
                        break;
                    case 'CONNECTED':
                        // Connection established
                        break;
                    case 'DISCONNECTED':
                        setStatus('disconnected');
                        // Clear all cached data on disconnect
                        setEvents([]);
                        setLastEvent(null);
                        setError(null);
                        setRetryCount(0);
                        break;
                }
            };
            port.onmessageerror = (error) => {
                console.error('Message error from Shared Worker:', error);
                setError(new Error('Failed to communicate with Shared Worker'));
            };
            // Subscribe to events
            if (clientIdRef.current) {
                port.postMessage({
                    type: 'SUBSCRIBE',
                    payload: { clientId: clientIdRef.current },
                });
                isSubscribedRef.current = true;
            }
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to create Shared Worker');
            setError(error);
            setStatus('error');
            console.error('Error initializing Shared Worker:', err);
        }
        return () => {
            // Cleanup
            if (portRef.current && clientIdRef.current && isSubscribedRef.current) {
                try {
                    portRef.current.postMessage({
                        type: 'UNSUBSCRIBE',
                        payload: { clientId: clientIdRef.current },
                    });
                }
                catch (err) {
                    console.error('Error unsubscribing from Shared Worker:', err);
                }
            }
            // Note: We don't close the worker here because other tabs might be using it
            // The worker will be closed automatically when all tabs are closed
        };
    }, [url, workerPath]); // options handled via ref
    // Connect to SSE endpoint when shouldConnect changes
    (0, react_1.useEffect)(() => {
        if (!url || !shouldConnect || !isSubscribedRef.current || !portRef.current) {
            return;
        }
        portRef.current.postMessage({
            type: 'CONNECT',
            payload: { url, options: optionsRef.current },
        });
    }, [url, shouldConnect]); // options handled via ref
    const connect = (0, react_1.useCallback)(() => {
        setShouldConnect(true);
        if (portRef.current && url && isSubscribedRef.current) {
            portRef.current.postMessage({
                type: 'CONNECT',
                payload: { url, options: optionsRef.current },
            });
        }
    }, [url]);
    const close = (0, react_1.useCallback)(() => {
        setShouldConnect(false);
        if (portRef.current) {
            portRef.current.postMessage({
                type: 'DISCONNECT',
            });
        }
        setStatus('closed');
        // Clear all cached data on close
        setEvents([]);
        setLastEvent(null);
        setError(null);
        setRetryCount(0);
    }, []);
    const reconnect = (0, react_1.useCallback)(() => {
        if (portRef.current) {
            portRef.current.postMessage({
                type: 'RECONNECT',
            });
        }
    }, []);
    // Memoize return value to prevent unnecessary re-renders
    return (0, react_1.useMemo)(() => ({
        status,
        lastEvent,
        events,
        error,
        connect,
        close,
        reconnect,
        retryCount,
    }), [status, lastEvent, events, error, connect, close, reconnect, retryCount]);
}
