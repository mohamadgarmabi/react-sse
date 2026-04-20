import { createSignal, onCleanup } from 'solid-js';
import { createAdaptiveSSEClient } from '../shared/adaptive-client';
export function useSSEAdaptive(endpointUrl, options = {}, workerPath = '/shared-worker.js') {
    const adaptiveClient = createAdaptiveSSEClient(endpointUrl, options, workerPath);
    const snapshot = adaptiveClient.getSnapshot();
    const [status, setStatus] = createSignal(snapshot.status);
    const [lastEvent, setLastEvent] = createSignal(snapshot.lastEvent);
    const [events, setEvents] = createSignal(snapshot.events);
    const [error, setError] = createSignal(snapshot.error);
    const [retryCount, setRetryCount] = createSignal(snapshot.retryCount);
    const unsubscribe = adaptiveClient.subscribe((nextState) => {
        setStatus(nextState.status);
        setLastEvent(nextState.lastEvent);
        setEvents(nextState.events);
        setError(nextState.error);
        setRetryCount(nextState.retryCount);
    });
    onCleanup(() => {
        unsubscribe();
        adaptiveClient.destroy();
    });
    return {
        status,
        lastEvent,
        events,
        error,
        retryCount,
        connect: () => adaptiveClient.connect(),
        close: () => adaptiveClient.close(),
        reconnect: () => adaptiveClient.reconnect(),
    };
}
