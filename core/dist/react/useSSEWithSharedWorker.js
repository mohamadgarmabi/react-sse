import { useEffect, useMemo, useState } from 'react';
import { SSESharedWorkerClient } from '../shared/sse-shared-worker-client';
export function useSSEWithSharedWorker(endpointUrl, options = {}, workerPath = '/shared-worker.js') {
    const sharedWorkerClient = useMemo(() => new SSESharedWorkerClient(endpointUrl, options, workerPath), [endpointUrl, options, workerPath]);
    const [state, setState] = useState(() => sharedWorkerClient.getSnapshot());
    useEffect(() => {
        const unsubscribe = sharedWorkerClient.subscribe(setState);
        return () => {
            unsubscribe();
            sharedWorkerClient.destroy();
        };
    }, [sharedWorkerClient]);
    return {
        ...state,
        connect: () => sharedWorkerClient.connect(),
        close: () => sharedWorkerClient.close(),
        reconnect: () => sharedWorkerClient.reconnect(),
    };
}
