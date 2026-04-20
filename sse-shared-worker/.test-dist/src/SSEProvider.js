"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSEProvider = SSEProvider;
exports.useSSEContext = useSSEContext;
exports.useOptionalSSEContext = useOptionalSSEContext;
const react_1 = __importDefault(require("react"));
const react_2 = require("react");
const useSSEAdaptive_1 = require("./useSSEAdaptive");
const SSEContext = (0, react_2.createContext)(null);
/**
 * Global SSE provider that uses SharedWorker when available and falls back
 * to regular SSE when SharedWorker is not supported.
 */
function SSEProvider({ url, options = {}, workerPath = '/shared-worker.js', children, }) {
    const sseState = (0, useSSEAdaptive_1.useSSEAdaptive)(url, options, workerPath);
    const value = (0, react_2.useMemo)(() => sseState, [sseState]);
    return react_1.default.createElement(SSEContext.Provider, { value: value }, children);
}
/**
 * Use global SSE state from SSEProvider.
 *
 * Throws when used outside of SSEProvider.
 */
function useSSEContext() {
    const context = (0, react_2.useContext)(SSEContext);
    if (!context) {
        throw new Error('useSSEContext must be used inside SSEProvider. Wrap your app (or subtree) with <SSEProvider />.');
    }
    return context;
}
/**
 * Optional variant that returns null when provider does not exist.
 * Useful for components that can work with or without a provider.
 */
function useOptionalSSEContext() {
    const context = (0, react_2.useContext)(SSEContext);
    return context ?? null;
}
