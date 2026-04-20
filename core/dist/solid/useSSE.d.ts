import type { SSEOptions } from '../shared/types';
export declare function useSSE<TEventData = unknown, TEventType extends string = string>(endpointUrl: string | null, options?: SSEOptions): {
    status: import("solid-js").Accessor<import(".").SSEStatus>;
    lastEvent: import("solid-js").Accessor<import(".").SSEEvent<TEventData, TEventType> | null>;
    events: import("solid-js").Accessor<import(".").SSEEvent<TEventData, TEventType>[]>;
    error: import("solid-js").Accessor<Error | null>;
    retryCount: import("solid-js").Accessor<number>;
    connect: () => void;
    close: () => void;
    reconnect: () => void;
};
