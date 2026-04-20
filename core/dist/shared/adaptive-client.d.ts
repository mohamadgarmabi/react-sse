import { SSEClient } from './sse-client';
import { SSESharedWorkerClient } from './sse-shared-worker-client';
import type { SSEOptions } from './types';
export declare function createAdaptiveSSEClient<TEventData = unknown, TEventType extends string = string>(endpointUrl: string | null, options?: SSEOptions, workerPath?: string): SSEClient<TEventData, TEventType> | SSESharedWorkerClient<TEventData, TEventType>;
