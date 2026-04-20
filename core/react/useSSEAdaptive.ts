import { useEffect, useMemo, useState } from 'react';
import { createAdaptiveSSEClient } from '../shared/adaptive-client';
import type { SSEOptions, SSEReturn } from '../shared/types';

export function useSSEAdaptive<
  TEventData = unknown,
  TEventType extends string = string,
>(
  endpointUrl: string | null,
  options: SSEOptions = {},
  workerPath = '/shared-worker.js'
): SSEReturn<TEventData, TEventType> {
  const adaptiveClient = useMemo(
    () =>
      createAdaptiveSSEClient<TEventData, TEventType>(
        endpointUrl,
        options,
        workerPath
      ),
    [endpointUrl, options, workerPath]
  );

  const [state, setState] = useState(() => adaptiveClient.getSnapshot());

  useEffect(() => {
    const unsubscribe = adaptiveClient.subscribe(setState);
    return () => {
      unsubscribe();
      adaptiveClient.destroy();
    };
  }, [adaptiveClient]);

  return {
    ...state,
    connect: () => adaptiveClient.connect(),
    close: () => adaptiveClient.close(),
    reconnect: () => adaptiveClient.reconnect(),
  };
}
