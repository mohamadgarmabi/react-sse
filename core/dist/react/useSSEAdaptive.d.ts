import type { SSEOptions, SSEReturn } from '../shared/types';
export declare function useSSEAdaptive<TEventData = unknown, TEventType extends string = string>(endpointUrl: string | null, options?: SSEOptions, workerPath?: string): SSEReturn<TEventData, TEventType>;
