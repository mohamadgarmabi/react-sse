import { createSignal, onCleanup } from 'solid-js';
import { SSEClient } from '../shared/sse-client';
export function useSSE(endpointUrl, options = {}) {
    const sseClient = new SSEClient(endpointUrl, options);
    const snapshot = sseClient.getSnapshot();
    const [status, setStatus] = createSignal(snapshot.status);
    const [lastEvent, setLastEvent] = createSignal(snapshot.lastEvent);
    const [events, setEvents] = createSignal(snapshot.events);
    const [error, setError] = createSignal(snapshot.error);
    const [retryCount, setRetryCount] = createSignal(snapshot.retryCount);
    const unsubscribe = sseClient.subscribe((nextState) => {
        setStatus(nextState.status);
        setLastEvent(nextState.lastEvent);
        setEvents(nextState.events);
        setError(nextState.error);
        setRetryCount(nextState.retryCount);
    });
    onCleanup(() => {
        unsubscribe();
        sseClient.destroy();
    });
    return {
        status,
        lastEvent,
        events,
        error,
        retryCount,
        connect: () => sseClient.connect(),
        close: () => sseClient.close(),
        reconnect: () => sseClient.reconnect(),
    };
}
