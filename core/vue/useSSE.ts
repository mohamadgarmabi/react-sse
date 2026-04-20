import { onUnmounted, ref } from 'vue';
import { SSEClient } from '../shared/sse-client';
import type { SSEOptions } from '../shared/types';

export function useSSE<TEventData = unknown, TEventType extends string = string>(
  endpointUrl: string | null,
  options: SSEOptions = {}
) {
  const sseClient = new SSEClient<TEventData, TEventType>(endpointUrl, options);
  const snapshot = sseClient.getSnapshot();

  const status = ref(snapshot.status);
  const lastEvent = ref(snapshot.lastEvent);
  const events = ref(snapshot.events);
  const error = ref(snapshot.error);
  const retryCount = ref(snapshot.retryCount);

  const unsubscribe = sseClient.subscribe((nextState) => {
    status.value = nextState.status;
    lastEvent.value = nextState.lastEvent;
    events.value = nextState.events;
    error.value = nextState.error;
    retryCount.value = nextState.retryCount;
  });

  onUnmounted(() => {
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
