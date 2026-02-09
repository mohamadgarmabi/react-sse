import { useMemo } from 'react';
import type { SSEOptions, SSEReturn } from './types';
import { isSharedWorkerSupported } from './support';
import { useSSE } from './useSSE';
import { useSSEWithSharedWorker } from './useSSEWithSharedWorker';

/**
 * SSE hook that uses SharedWorker when supported, otherwise falls back to a single-tab EventSource (useSSE).
 * Use this when you want one connection shared across tabs when possible, but still work on devices that
 * don’t support SharedWorker (e.g. older Safari iOS, IE).
 *
 * @param url - SSE endpoint URL
 * @param options - Same as useSSE / useSSEWithSharedWorker
 * @param workerPath - Path to shared worker script (only used when SharedWorker is supported)
 * @returns Same shape as useSSE / useSSEWithSharedWorker
 */
export function useSSEAdaptive<T = any, K extends string = string>(
  url: string | null,
  options: SSEOptions = {},
  workerPath: string = '/shared-worker.js'
): SSEReturn<T, K> {
  const supported = useMemo(() => isSharedWorkerSupported(), []);

  const withWorker = useSSEWithSharedWorker<T, K>(
    supported ? url : null,
    options,
    workerPath
  );

  const withoutWorker = useSSE<T, K>(!supported ? url : null, options);

  return supported ? withWorker : withoutWorker;
}
