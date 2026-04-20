import { onUnmounted, ref } from 'vue';
import { SSESharedWorkerClient } from '../shared/sse-shared-worker-client';
import type { SSEOptions } from '../shared/types';

export function useSSEWithSharedWorker<
  TEventData = unknown,
  TEventType extends string = string,
>(
  endpointUrl: string | null,
  options: SSEOptions = {},
  workerPath = '/shared-worker.js'
) {
  const sharedWorkerClient = new SSESharedWorkerClient<TEventData, TEventType>(
    endpointUrl,
    options,
    workerPath
  );
  const snapshot = sharedWorkerClient.getSnapshot();

  const status = ref(snapshot.status);
  const lastEvent = ref(snapshot.lastEvent);
  const events = ref(snapshot.events);
  const error = ref(snapshot.error);
  const retryCount = ref(snapshot.retryCount);

  const unsubscribe = sharedWorkerClient.subscribe((nextState) => {
    status.value = nextState.status;
    lastEvent.value = nextState.lastEvent;
    events.value = nextState.events;
    error.value = nextState.error;
    retryCount.value = nextState.retryCount;
  });

  onUnmounted(() => {
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
