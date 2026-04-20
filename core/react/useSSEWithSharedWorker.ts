import { useEffect, useMemo, useState } from 'react';
import { SSESharedWorkerClient } from '../shared/sse-shared-worker-client';
import type { SSEOptions, SSEReturn } from '../shared/types';

export function useSSEWithSharedWorker<
  TEventData = unknown,
  TEventType extends string = string,
>(
  endpointUrl: string | null,
  options: SSEOptions = {},
  workerPath = '/shared-worker.js'
): SSEReturn<TEventData, TEventType> {
  const sharedWorkerClient = useMemo(
    () =>
      new SSESharedWorkerClient<TEventData, TEventType>(
        endpointUrl,
        options,
        workerPath
      ),
    [endpointUrl, options, workerPath]
  );

  const [state, setState] = useState(() => sharedWorkerClient.getSnapshot());

  useEffect(() => {
    const unsubscribe = sharedWorkerClient.subscribe(setState);
    return () => {
      unsubscribe();
      sharedWorkerClient.destroy();
    };
  }, [sharedWorkerClient]);

  return {
    ...state,
    connect: () => sharedWorkerClient.connect(),
    close: () => sharedWorkerClient.close(),
    reconnect: () => sharedWorkerClient.reconnect(),
  };
}
