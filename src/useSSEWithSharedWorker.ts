import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { SSEOptions, SSEStatus, SSEEvent, SSEReturn } from './types';
import type { WorkerMessage, WorkerResponse } from './worker-types';

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
 *   token: 'your-auth-token',
 *   maxRetries: 3,
 *   maxRetryDelay: 10000
 * });
 * ```
 */
export function useSSEWithSharedWorker<T = any, K extends string = string>(
  url: string | null,
  options: SSEOptions = {},
  workerPath: string = '/shared-worker.js'
): SSEReturn<T, K> {
  const {
    maxRetries = 5,
  } = options;

  const [status, setStatus] = useState<SSEStatus>('disconnected');
  const [lastEvent, setLastEvent] = useState<SSEEvent<T, K> | null>(null);
  const [events, setEvents] = useState<SSEEvent<T, K>[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const workerRef = useRef<SharedWorker | null>(null);
  const portRef = useRef<MessagePort | null>(null);
  const clientIdRef = useRef<string | null>(null);
  const isSubscribedRef = useRef(false);
  
  // Memoize options to prevent unnecessary re-renders
  const optionsRef = useRef<SSEOptions>(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Initialize Shared Worker
  useEffect(() => {
    if (!url) {
      setStatus('disconnected');
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
      port.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;

        switch (message.type) {
          case 'STATUS':
            setStatus(message.payload.status);
            break;

          case 'EVENT':
            const eventData = message.payload.event as SSEEvent<T, K>;
            setLastEvent(eventData);
            setEvents((prev: SSEEvent<T, K>[]) => {
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
        } as WorkerMessage);
        isSubscribedRef.current = true;

        // Connect to SSE endpoint
        port.postMessage({
          type: 'CONNECT',
          payload: { url, options: optionsRef.current },
        } as WorkerMessage);
      }
    } catch (err) {
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
          } as WorkerMessage);
        } catch (err) {
          console.error('Error unsubscribing from Shared Worker:', err);
        }
      }
      
      // Note: We don't close the worker here because other tabs might be using it
      // The worker will be closed automatically when all tabs are closed
    };
  }, [url, workerPath]); // options handled via ref

  // Update options when they change (using ref to avoid dependency issues)
  useEffect(() => {
    if (portRef.current && url && isSubscribedRef.current) {
      portRef.current.postMessage({
        type: 'CONNECT',
        payload: { url, options: optionsRef.current },
      } as WorkerMessage);
    }
  }, [url]); // Only depend on url, options are handled via ref

  const close = useCallback(() => {
    if (portRef.current) {
      portRef.current.postMessage({
        type: 'DISCONNECT',
      } as WorkerMessage);
    }
    setStatus('closed');
  }, []);

  const reconnect = useCallback(() => {
    if (portRef.current) {
      portRef.current.postMessage({
        type: 'RECONNECT',
      } as WorkerMessage);
    }
  }, []);

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

