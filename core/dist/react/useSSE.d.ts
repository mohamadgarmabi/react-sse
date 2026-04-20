import type { SSEOptions, SSEReturn } from '../shared/types';
export declare function useSSE<TEventData = unknown, TEventType extends string = string>(endpointUrl: string | null, options?: SSEOptions): SSEReturn<TEventData, TEventType>;
