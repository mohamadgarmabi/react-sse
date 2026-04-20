import { createSignal, onCleanup } from 'solid-js';
import { SSESharedWorkerClient } from '../shared/sse-shared-worker-client';
export function useSSEWithSharedWorker(endpointUrl, options = {}, workerPath = '/shared-worker.js') {
    const sharedWorkerClient = new SSESharedWorkerClient(endpointUrl, options, workerPath);
    const snapshot = sharedWorkerClient.getSnapshot();
    const [status, setStatus] = createSignal(snapshot.status);
    const [lastEvent, setLastEvent] = createSignal(snapshot.lastEvent);
    const [events, setEvents] = createSignal(snapshot.events);
    const [error, setError] = createSignal(snapshot.error);
    const [retryCount, setRetryCount] = createSignal(snapshot.retryCount);
    const unsubscribe = sharedWorkerClient.subscribe((nextState) => {
        setStatus(nextState.status);
        setLastEvent(nextState.lastEvent);
        setEvents(nextState.events);
        setError(nextState.error);
        setRetryCount(nextState.retryCount);
    });
    onCleanup(() => {
        unsubscribe();
        sharedWorkerClient.destroy();
    });
    return {
        status,
        lastEvent,
        events,
        error,
        retryCount,
        connect: () => sharedWorkerClient.connect(),
        close: () => sharedWorkerClient.close(),
        reconnect: () => sharedWorkerClient.reconnect(),
    };
}
