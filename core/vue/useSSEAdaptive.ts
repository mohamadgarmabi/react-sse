import { onUnmounted, ref } from 'vue';
import { createAdaptiveSSEClient } from '../shared/adaptive-client';
import type { SSEOptions } from '../shared/types';

export function useSSEAdaptive<
  TEventData = unknown,
  TEventType extends string = string,
>(
  endpointUrl: string | null,
  options: SSEOptions = {},
  workerPath = '/shared-worker.js'
) {
  const adaptiveClient = createAdaptiveSSEClient<TEventData, TEventType>(
    endpointUrl,
    options,
    workerPath
  );
  const snapshot = adaptiveClient.getSnapshot();

  const status = ref(snapshot.status);
  const lastEvent = ref(snapshot.lastEvent);
  const events = ref(snapshot.events);
  const error = ref(snapshot.error);
  const retryCount = ref(snapshot.retryCount);

  const unsubscribe = adaptiveClient.subscribe((nextState) => {
    status.value = nextState.status;
    lastEvent.value = nextState.lastEvent;
    events.value = nextState.events;
    error.value = nextState.error;
    retryCount.value = nextState.retryCount;
  });

  onUnmounted(() => {
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
