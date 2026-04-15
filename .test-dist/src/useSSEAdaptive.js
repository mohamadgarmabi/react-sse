"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSSEAdaptive = useSSEAdaptive;
const react_1 = require("react");
const support_1 = require("./support");
const useSSE_1 = require("./useSSE");
const useSSEWithSharedWorker_1 = require("./useSSEWithSharedWorker");
/**
 * SSE hook that uses SharedWorker when supported, otherwise falls back to a single-tab EventSource (useSSE).
 * Use this when you want one connection shared across tabs when possible, but still work on devices that
 * don’t support SharedWorker (e.g. older Safari iOS, IE).
 *
 * @param url - SSE endpoint URL
 * @param options - Same as useSSE / useSSEWithSharedWorker
 * @param workerPath - Path to shared worker script (only used when SharedWorker is supported)
 * @returns Same shape as useSSE / useSSEWithSharedWorker
 */
function useSSEAdaptive(url, options = {}, workerPath = '/shared-worker.js') {
    const supported = (0, react_1.useMemo)(() => (0, support_1.isSharedWorkerSupported)(), []);
    const withWorker = (0, useSSEWithSharedWorker_1.useSSEWithSharedWorker)(supported ? url : null, options, workerPath);
    const withoutWorker = (0, useSSE_1.useSSE)(!supported ? url : null, options);
    return supported ? withWorker : withoutWorker;
}
