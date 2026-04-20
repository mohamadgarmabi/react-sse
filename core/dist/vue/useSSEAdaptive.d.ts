import type { SSEOptions } from '../shared/types';
export declare function useSSEAdaptive<TEventData = unknown, TEventType extends string = string>(endpointUrl: string | null, options?: SSEOptions, workerPath?: string): {
    status: import("vue").Ref<import(".").SSEStatus, import(".").SSEStatus>;
    lastEvent: import("vue").Ref<{
        type: import("vue").UnwrapRef<TEventType>;
        data: import("vue").UnwrapRef<TEventData>;
        id?: string | undefined;
        timestamp: number;
    } | null, import(".").SSEEvent<TEventData, TEventType> | {
        type: import("vue").UnwrapRef<TEventType>;
        data: import("vue").UnwrapRef<TEventData>;
        id?: string | undefined;
        timestamp: number;
    } | null>;
    events: import("vue").Ref<{
        type: import("vue").UnwrapRef<TEventType>;
        data: import("vue").UnwrapRef<TEventData>;
        id?: string | undefined;
        timestamp: number;
    }[], import(".").SSEEvent<TEventData, TEventType>[] | {
        type: import("vue").UnwrapRef<TEventType>;
        data: import("vue").UnwrapRef<TEventData>;
        id?: string | undefined;
        timestamp: number;
    }[]>;
    error: import("vue").Ref<Error | null, Error | null>;
    retryCount: import("vue").Ref<number, number>;
    connect: () => void;
    close: () => void;
    reconnect: () => void;
};
