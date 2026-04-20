import type { SSEOptions, SSEReturn } from './types';
type SSEState<TEventData, TEventType extends string> = Omit<SSEReturn<TEventData, TEventType>, 'connect' | 'close' | 'reconnect'>;
type StateListener<TEventData, TEventType extends string> = (state: SSEState<TEventData, TEventType>) => void;
export declare class SSESharedWorkerClient<TEventData = unknown, TEventType extends string = string> {
    private readonly endpointUrl;
    private readonly options;
    private readonly workerPath;
    private readonly listeners;
    private readonly clientId;
    private worker;
    private workerPort;
    private isSubscribed;
    private state;
    constructor(endpointUrl: string | null, options?: SSEOptions, workerPath?: string);
    getSnapshot(): SSEState<TEventData, TEventType>;
    subscribe(listener: StateListener<TEventData, TEventType>): () => void;
    connect(): void;
    close(): void;
    reconnect(): void;
    destroy(): void;
    private initializeWorker;
    private handleWorkerMessage;
    private sendWorkerMessage;
    private setState;
}
export {};
