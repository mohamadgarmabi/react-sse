import { useEffect, useMemo, useState } from 'react';
import { SSEClient } from '../shared/sse-client';
import type { SSEOptions, SSEReturn } from '../shared/types';

export function useSSE<TEventData = unknown, TEventType extends string = string>(
  endpointUrl: string | null,
  options: SSEOptions = {}
): SSEReturn<TEventData, TEventType> {
  const sseClient = useMemo(
    () => new SSEClient<TEventData, TEventType>(endpointUrl, options),
    [endpointUrl, options]
  );

  const [state, setState] = useState(() => sseClient.getSnapshot());

  useEffect(() => {
    const unsubscribe = sseClient.subscribe(setState);
    return () => {
      unsubscribe();
      sseClient.destroy();
    };
  }, [sseClient]);

  return {
    ...state,
    connect: () => sseClient.connect(),
    close: () => sseClient.close(),
    reconnect: () => sseClient.reconnect(),
  };
}
