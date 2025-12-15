import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { SSEOptions, SSEStatus, SSEEvent, SSEReturn } from './types';

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
 *   token: 'your-auth-token',
 *   maxRetries: 3,
 *   maxRetryDelay: 10000
 * });
 * ```
 */
export function useSSE<T = any>(
  url: string | null,
  options: SSEOptions = {}
): SSEReturn<T> {
  const {
    token,
    maxRetryDelay = 30000,
    initialRetryDelay = 1000,
    maxRetries = 5,
    headers = {},
    autoReconnect = true,
    retryDelayFn,
  } = options;

  const [status, setStatus] = useState<SSEStatus>('disconnected');
  const [lastEvent, setLastEvent] = useState<SSEEvent<T> | null>(null);
  const [events, setEvents] = useState<SSEEvent<T>[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);
  const shouldReconnectRef = useRef(autoReconnect);
  const urlRef = useRef(url);

  // Update URL ref when it changes
  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  // Calculate retry delay based on attempt number
  const calculateRetryDelay = useCallback((attempt: number): number => {
    if (retryDelayFn) {
      return Math.min(retryDelayFn(attempt), maxRetryDelay);
    }
    
    // Exponential backoff with jitter
    const baseDelay = initialRetryDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000;
    return Math.min(baseDelay + jitter, maxRetryDelay);
  }, [retryDelayFn, maxRetryDelay, initialRetryDelay]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  // Reconnect function
  const reconnect = useCallback(() => {
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

  // Close connection
  const close = useCallback(() => {
    shouldReconnectRef.current = false;
    cleanup();
    setStatus('closed');
  }, [cleanup]);

  // Connect to SSE endpoint
  useEffect(() => {
    if (!url) {
      setStatus('disconnected');
      return;
    }

    // If we have a token, we need to use fetch API with custom headers
    // since EventSource doesn't support custom headers
    if (token || Object.keys(headers).length > 0) {
      // For authenticated requests, we'll use fetch with ReadableStream
      // This is a more complex implementation but necessary for custom headers
      let abortController: AbortController | null = null;
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
      let isCleaningUp = false;

      const connectWithFetch = async () => {
        try {
          setStatus('connecting');
          setError(null);

          abortController = new AbortController();
          
          const requestHeaders: HeadersInit = {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
            ...headers,
          };

          if (token) {
            requestHeaders['Authorization'] = `Bearer ${token}`;
          }

          const response = await fetch(url, {
            method: 'GET',
            headers: requestHeaders,
            signal: abortController.signal,
          });

          if (!response.ok) {
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
            } catch (readErr) {
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

            if (eventData) {
              try {
                const parsedData: T = JSON.parse(eventData);
                const event: SSEEvent<T> = {
                  type: eventType,
                  data: parsedData,
                  id: eventId,
                  timestamp: Date.now(),
                };

              setLastEvent(event);
              setEvents((prev: SSEEvent<T>[]) => {
                const newEvents = [...prev, event];
                // Limit events array size to prevent memory issues
                return newEvents.length > MAX_EVENTS 
                  ? newEvents.slice(-MAX_EVENTS) 
                  : newEvents;
              });
              } catch (e) {
                // If parsing fails, use raw data
                const event: SSEEvent<T> = {
                  type: eventType,
                  data: eventData as T,
                  id: eventId,
                  timestamp: Date.now(),
                };

              setLastEvent(event);
              setEvents((prev: SSEEvent<T>[]) => {
                const newEvents = [...prev, event];
                // Limit events array size to prevent memory issues
                return newEvents.length > MAX_EVENTS 
                  ? newEvents.slice(-MAX_EVENTS) 
                  : newEvents;
              });
              }
            }
          }
        } catch (err) {
          // Silently handle AbortError - it's expected during cleanup
          if (err instanceof Error && (err.name === 'AbortError' || err.name === 'AbortException')) {
            return;
          }

          // Only handle errors if we're not cleaning up
          if (!isCleaningUp) {
            const error = err instanceof Error ? err : new Error('Unknown error');
            setError(error);
            setStatus('error');

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
            } else {
              setStatus('disconnected');
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
      };
    } else {
      // Use native EventSource for non-authenticated requests
      setStatus('connecting');
      setError(null);

      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setStatus('connected');
        retryAttemptRef.current = 0;
        setRetryCount(0);
      };

      eventSource.onmessage = (e) => {
        try {
          const parsedData: T = JSON.parse(e.data);
          const event: SSEEvent<T> = {
            type: 'message',
            data: parsedData,
            id: e.lastEventId || undefined,
            timestamp: Date.now(),
          };

              setLastEvent(event);
              setEvents((prev: SSEEvent<T>[]) => {
                const newEvents = [...prev, event];
                // Limit events array size to prevent memory issues
                return newEvents.length > MAX_EVENTS 
                  ? newEvents.slice(-MAX_EVENTS) 
                  : newEvents;
              });
        } catch {
          const event: SSEEvent<T> = {
            type: 'message',
            data: e.data as T,
            id: e.lastEventId || undefined,
            timestamp: Date.now(),
          };

              setLastEvent(event);
              setEvents((prev: SSEEvent<T>[]) => {
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
          } else {
            setStatus('disconnected');
            eventSource.close();
          }
        }
      };

      // Handle custom event types
      eventSource.addEventListener('error', (e: any) => {
        if (e.data) {
          try {
            const parsedData: T = JSON.parse(e.data);
            const event: SSEEvent<T> = {
              type: 'error',
              data: parsedData,
              timestamp: Date.now(),
            };

              setLastEvent(event);
              setEvents((prev: SSEEvent<T>[]) => {
                const newEvents = [...prev, event];
                // Limit events array size to prevent memory issues
                return newEvents.length > MAX_EVENTS 
                  ? newEvents.slice(-MAX_EVENTS) 
                  : newEvents;
              });
          } catch {
            // Ignore parse errors for custom events
          }
        }
      });

      return () => {
        cleanup();
      };
    }
  }, [url, token, maxRetries, calculateRetryDelay, cleanup, headers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldReconnectRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  // Memoize return value to prevent unnecessary re-renders
  return useMemo(() => ({
    status,
    lastEvent,
    events,
    error,
    close,
    reconnect,
    retryCount,
  }), [status, lastEvent, events, error, close, reconnect, retryCount]);
}

