import { SSEClient } from './sse-client';
import { SSESharedWorkerClient } from './sse-shared-worker-client';
import { isSharedWorkerSupported } from './support';
export function createAdaptiveSSEClient(endpointUrl, options = {}, workerPath = '/shared-worker.js') {
    if (isSharedWorkerSupported()) {
        return new SSESharedWorkerClient(endpointUrl, options, workerPath);
    }
    return new SSEClient(endpointUrl, options);
}
