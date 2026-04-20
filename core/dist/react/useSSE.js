import { useEffect, useMemo, useState } from 'react';
import { SSEClient } from '../shared/sse-client';
export function useSSE(endpointUrl, options = {}) {
    const sseClient = useMemo(() => new SSEClient(endpointUrl, options), [endpointUrl, options]);
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
