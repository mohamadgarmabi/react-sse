import { useEffect, useMemo, useState } from 'react';
import { createAdaptiveSSEClient } from '../shared/adaptive-client';
export function useSSEAdaptive(endpointUrl, options = {}, workerPath = '/shared-worker.js') {
    const adaptiveClient = useMemo(() => createAdaptiveSSEClient(endpointUrl, options, workerPath), [endpointUrl, options, workerPath]);
    const [state, setState] = useState(() => adaptiveClient.getSnapshot());
    useEffect(() => {
        const unsubscribe = adaptiveClient.subscribe(setState);
        return () => {
            unsubscribe();
            adaptiveClient.destroy();
        };
    }, [adaptiveClient]);
    return {
        ...state,
        connect: () => adaptiveClient.connect(),
        close: () => adaptiveClient.close(),
        reconnect: () => adaptiveClient.reconnect(),
    };
}
