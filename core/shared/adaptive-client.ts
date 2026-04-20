import { SSEClient } from './sse-client';
import { SSESharedWorkerClient } from './sse-shared-worker-client';
import { isSharedWorkerSupported } from './support';
import type { SSEOptions } from './types';

export function createAdaptiveSSEClient<
  TEventData = unknown,
  TEventType extends string = string,
>(
  endpointUrl: string | null,
  options: SSEOptions = {},
  workerPath = '/shared-worker.js'
): SSEClient<TEventData, TEventType> | SSESharedWorkerClient<TEventData, TEventType> {
  if (isSharedWorkerSupported()) {
    return new SSESharedWorkerClient<TEventData, TEventType>(
      endpointUrl,
      options,
      workerPath
    );
  }

  return new SSEClient<TEventData, TEventType>(endpointUrl, options);
}
