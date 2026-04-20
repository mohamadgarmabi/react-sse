import type { SSEOptions, SSEReturn } from './types';
type SSEState<TEventData, TEventType extends string> = Omit<SSEReturn<TEventData, TEventType>, 'connect' | 'close' | 'reconnect'>;
type StateListener<TEventData, TEventType extends string> = (state: SSEState<TEventData, TEventType>) => void;
export declare class SSEClient<TEventData = unknown, TEventType extends string = string> {
    private readonly endpointUrl;
    private readonly options;
    private readonly listeners;
    private eventSource;
    private retryTimeout;
    private autoConnectTimeout;
    private retryAttemptCount;
    private shouldReconnect;
    private shouldConnect;
    private state;
    constructor(endpointUrl: string | null, options?: SSEOptions);
    getSnapshot(): SSEState<TEventData, TEventType>;
    subscribe(listener: StateListener<TEventData, TEventType>): () => void;
    connect(): void;
    close(): void;
    reconnect(): void;
    destroy(): void;
    private connectWithEventSource;
    private pushEvent;
    private safeParse;
    private calculateRetryDelay;
    private cleanupConnection;
    private setState;
}
export {};
