"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSSE = useSSE;
const react_1 = require("react");
// Maximum number of events to keep in memory (prevent memory leaks)
const MAX_EVENTS = 100;
/**
 * Custom React hook for Server-Sent Events (SSE)
 *
 * @param url - The URL to connect to for SSE
 * @param options - Configuration options for the SSE connection
 * @returns SSE connection state and controls
 *
 * @example
 * ```tsx
 * const { status, lastEvent, events, error } = useSSE('/api/events', {
 *   headers: { 'Authorization': 'Bearer your-auth-token' },
 *   maxRetries: 3,
 *   maxRetryDelay: 10000
 * });
 * ```
 */
function useSSE(url, options = {}) {
    const { connectionMode = 'auto', autoConnectDelay = 0, maxRetryDelay = 30000, initialRetryDelay = 1000, maxRetries = 5, headers = {}, autoReconnect = true, retryDelayFn, } = options;
    const [status, setStatus] = (0, react_1.useState)('disconnected');
    const [lastEvent, setLastEvent] = (0, react_1.useState)(null);
    const [events, setEvents] = (0, react_1.useState)([]);
    const [error, setError] = (0, react_1.useState)(null);
    const [retryCount, setRetryCount] = (0, react_1.useState)(0);
    const [shouldConnect, setShouldConnect] = (0, react_1.useState)(connectionMode === 'auto');
    const eventSourceRef = (0, react_1.useRef)(null);
    const retryTimeoutRef = (0, react_1.useRef)(null);
    const autoConnectTimeoutRef = (0, react_1.useRef)(null);
    const retryAttemptRef = (0, react_1.useRef)(0);
    const shouldReconnectRef = (0, react_1.useRef)(autoReconnect);
    const urlRef = (0, react_1.useRef)(url);
    const optionsRef = (0, react_1.useRef)(options);
    // Keep refs in sync; avoid putting options/headers in effect deps to prevent update loops
    (0, react_1.useEffect)(() => {
        urlRef.current = url;
    }, [url]);
    (0, react_1.useEffect)(() => {
        optionsRef.current = options;
        shouldReconnectRef.current = options.autoReconnect ?? true;
    }, [options]);
    // Calculate retry delay based on attempt number
    const calculateRetryDelay = (0, react_1.useCallback)((attempt) => {
        if (retryDelayFn) {
            return Math.min(retryDelayFn(attempt), maxRetryDelay);
        }
        // Exponential backoff with jitter
        const baseDelay = initialRetryDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 1000;
        return Math.min(baseDelay + jitter, maxRetryDelay);
    }, [retryDelayFn, maxRetryDelay, initialRetryDelay]);
    // Cleanup function
    const cleanup = (0, react_1.useCallback)(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = null;
        }
        if (autoConnectTimeoutRef.current) {
            clearTimeout(autoConnectTimeoutRef.current);
            autoConnectTimeoutRef.current = null;
        }
    }, []);
    // Reconnect function
    const reconnect = (0, react_1.useCallback)(() => {
        cleanup();
        retryAttemptRef.current = 0;
        setRetryCount(0);
        setError(null);
        shouldReconnectRef.current = true;
        if (urlRef.current) {
            // Trigger reconnection by updating status
            setStatus('connecting');
        }
    }, [cleanup]);
    // Connect function (for manual mode)
    const connect = (0, react_1.useCallback)(() => {
        setShouldConnect(true);
        if (urlRef.current) {
            setStatus('connecting');
        }
    }, []);
    // Close connection
    const close = (0, react_1.useCallback)(() => {
        shouldReconnectRef.current = false;
        setShouldConnect(false);
        cleanup();
        setStatus('closed');
        // Clear all cached data
        setEvents([]);
        setLastEvent(null);
        setError(null);
        setRetryCount(0);
    }, [cleanup]);
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
            autoConnectTimeoutRef.current = setTimeout(() => {
                if (urlRef.current) {
                    setShouldConnect(true);
                    setStatus('connecting');
                }
            }, autoConnectDelay);
        }
        else {
            // No delay, connect immediately
            setShouldConnect(true);
            if (urlRef.current) {
                setStatus('connecting');
            }
        }
        return () => {
            if (autoConnectTimeoutRef.current) {
                clearTimeout(autoConnectTimeoutRef.current);
                autoConnectTimeoutRef.current = null;
            }
        };
    }, [url, connectionMode, autoConnectDelay]);
    // Connect to SSE endpoint (read headers from ref to avoid dependency on options/headers and prevent update loops)
    (0, react_1.useEffect)(() => {
        const currentHeaders = optionsRef.current?.headers ?? {};
        if (!url) {
            setStatus('disconnected');
            // Clear cached data when URL is removed
            setEvents([]);
            setLastEvent(null);
            return;
        }
        // Check if we should connect
        if (!shouldConnect) {
            return;
        }
        // If we have custom headers, we need to use fetch API with custom headers
        // since EventSource doesn't support custom headers
        if (Object.keys(currentHeaders).length > 0) {
            // For authenticated requests, we'll use fetch with ReadableStream
            // This is a more complex implementation but necessary for custom headers
            let abortController = null;
            let reader = null;
            let isCleaningUp = false;
            const connectWithFetch = async () => {
                try {
                    setStatus('connecting');
                    setError(null);
                    abortController = new AbortController();
                    const credentials = optionsRef.current?.credentials ?? 'same-origin';
                    const requestHeaders = {
                        'Accept': 'text/event-stream',
                        ...currentHeaders,
                    };
                    const response = await fetch(url, {
                        method: 'GET',
                        headers: requestHeaders,
                        signal: abortController.signal,
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
                    setStatus('connected');
                    retryAttemptRef.current = 0;
                    setRetryCount(0);
                    reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';
                    while (true) {
                        // Check if we're cleaning up before reading
                        if (isCleaningUp) {
                            break;
                        }
                        let readResult;
                        try {
                            readResult = await reader.read();
                        }
                        catch (readErr) {
                            // If read fails due to abort, break silently
                            if (readErr instanceof Error && (readErr.name === 'AbortError' || readErr.name === 'AbortException')) {
                                break;
                            }
                            throw readErr;
                        }
                        const { done, value } = readResult;
                        if (done) {
                            break;
                        }
                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
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
                        if (eventData) {
                            try {
                                const parsedData = JSON.parse(eventData);
                                const event = {
                                    type: eventType,
                                    data: parsedData,
                                    id: eventId,
                                    timestamp: Date.now(),
                                };
                                setLastEvent(event);
                                setEvents((prev) => {
                                    const newEvents = [...prev, event];
                                    // Limit events array size to prevent memory issues
                                    return newEvents.length > MAX_EVENTS
                                        ? newEvents.slice(-MAX_EVENTS)
                                        : newEvents;
                                });
                            }
                            catch (e) {
                                // If parsing fails, use raw data
                                const event = {
                                    type: eventType,
                                    data: eventData,
                                    id: eventId,
                                    timestamp: Date.now(),
                                };
                                setLastEvent(event);
                                setEvents((prev) => {
                                    const newEvents = [...prev, event];
                                    // Limit events array size to prevent memory issues
                                    return newEvents.length > MAX_EVENTS
                                        ? newEvents.slice(-MAX_EVENTS)
                                        : newEvents;
                                });
                            }
                        }
                    }
                }
                catch (err) {
                    // Silently handle AbortError - it's expected during cleanup
                    if (err instanceof Error && (err.name === 'AbortError' || err.name === 'AbortException')) {
                        return;
                    }
                    // Only handle errors if we're not cleaning up
                    if (!isCleaningUp) {
                        const error = err instanceof Error ? err : new Error('Unknown error');
                        setError(error);
                        setStatus('error');
                        // For 401 errors, don't retry automatically - user needs to refresh auth
                        if (error.name === 'AuthenticationError') {
                            setStatus('disconnected');
                            setEvents([]);
                            setLastEvent(null);
                            return;
                        }
                        // Retry logic
                        if (shouldReconnectRef.current && retryAttemptRef.current < maxRetries) {
                            retryAttemptRef.current += 1;
                            setRetryCount(retryAttemptRef.current);
                            const delay = calculateRetryDelay(retryAttemptRef.current - 1);
                            retryTimeoutRef.current = setTimeout(() => {
                                if (shouldReconnectRef.current && urlRef.current && !isCleaningUp) {
                                    connectWithFetch();
                                }
                            }, delay);
                        }
                        else {
                            setStatus('disconnected');
                            // Clear cached data on disconnect
                            setEvents([]);
                            setLastEvent(null);
                        }
                    }
                }
            };
            connectWithFetch();
            return () => {
                isCleaningUp = true;
                if (abortController) {
                    abortController.abort();
                }
                if (reader) {
                    reader.cancel().catch(() => {
                        // Ignore cancellation errors
                    });
                }
                cleanup();
                // Clear cached data on cleanup
                setEvents([]);
                setLastEvent(null);
            };
        }
        else {
            // Use native EventSource for non-authenticated requests
            setStatus('connecting');
            setError(null);
            const credentials = optionsRef.current?.credentials ?? 'same-origin';
            const eventSource = new EventSource(url, {
                withCredentials: credentials === 'include',
            });
            eventSourceRef.current = eventSource;
            eventSource.onopen = () => {
                setStatus('connected');
                retryAttemptRef.current = 0;
                setRetryCount(0);
            };
            eventSource.onmessage = (e) => {
                try {
                    const parsedData = JSON.parse(e.data);
                    const event = {
                        type: 'message',
                        data: parsedData,
                        id: e.lastEventId || undefined,
                        timestamp: Date.now(),
                    };
                    setLastEvent(event);
                    setEvents((prev) => {
                        const newEvents = [...prev, event];
                        // Limit events array size to prevent memory issues
                        return newEvents.length > MAX_EVENTS
                            ? newEvents.slice(-MAX_EVENTS)
                            : newEvents;
                    });
                }
                catch {
                    const event = {
                        type: 'message',
                        data: e.data,
                        id: e.lastEventId || undefined,
                        timestamp: Date.now(),
                    };
                    setLastEvent(event);
                    setEvents((prev) => {
                        const newEvents = [...prev, event];
                        // Limit events array size to prevent memory issues
                        return newEvents.length > MAX_EVENTS
                            ? newEvents.slice(-MAX_EVENTS)
                            : newEvents;
                    });
                }
            };
            eventSource.onerror = (e) => {
                setError(new Error('SSE connection error'));
                if (eventSource.readyState === EventSource.CLOSED) {
                    setStatus('error');
                    // Retry logic
                    if (shouldReconnectRef.current && retryAttemptRef.current < maxRetries) {
                        retryAttemptRef.current += 1;
                        setRetryCount(retryAttemptRef.current);
                        const delay = calculateRetryDelay(retryAttemptRef.current - 1);
                        retryTimeoutRef.current = setTimeout(() => {
                            if (shouldReconnectRef.current && urlRef.current) {
                                // Trigger reconnection
                                setStatus('connecting');
                            }
                        }, delay);
                    }
                    else {
                        setStatus('disconnected');
                        eventSource.close();
                        // Clear cached data on disconnect
                        setEvents([]);
                        setLastEvent(null);
                    }
                }
            };
            // Handle custom event types
            eventSource.addEventListener('error', (e) => {
                if (e.data) {
                    try {
                        const parsedData = JSON.parse(e.data);
                        const event = {
                            type: 'error',
                            data: parsedData,
                            timestamp: Date.now(),
                        };
                        setLastEvent(event);
                        setEvents((prev) => {
                            const newEvents = [...prev, event];
                            // Limit events array size to prevent memory issues
                            return newEvents.length > MAX_EVENTS
                                ? newEvents.slice(-MAX_EVENTS)
                                : newEvents;
                        });
                    }
                    catch {
                        // Ignore parse errors for custom events
                    }
                }
            });
            return () => {
                cleanup();
            };
        }
    }, [url, shouldConnect, maxRetries, calculateRetryDelay, cleanup]);
    // Cleanup on unmount
    (0, react_1.useEffect)(() => {
        return () => {
            shouldReconnectRef.current = false;
            cleanup();
        };
    }, [cleanup]);
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
