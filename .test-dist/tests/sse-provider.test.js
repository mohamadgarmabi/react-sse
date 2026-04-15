"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const react_1 = __importDefault(require("react"));
const server_1 = require("react-dom/server");
const SSEProvider_1 = require("../src/SSEProvider");
const support_1 = require("../src/support");
const publicApi = __importStar(require("../src/index"));
function RequiredContextConsumer() {
    const sse = (0, SSEProvider_1.useSSEContext)();
    return react_1.default.createElement('span', null, sse.status);
}
function OptionalContextConsumer() {
    const sse = (0, SSEProvider_1.useOptionalSSEContext)();
    const renderedText = sse ? sse.status : 'null';
    return react_1.default.createElement('span', null, renderedText);
}
(0, node_test_1.default)('isSharedWorkerSupported returns false in non-browser environments', () => {
    strict_1.default.equal((0, support_1.isSharedWorkerSupported)(), false);
});
(0, node_test_1.default)('useSSEContext throws when used outside SSEProvider', () => {
    strict_1.default.throws(() => {
        (0, server_1.renderToString)(react_1.default.createElement(RequiredContextConsumer));
    }, /useSSEContext must be used inside SSEProvider/i);
});
(0, node_test_1.default)('useSSEContext returns provider state when wrapped with SSEProvider', () => {
    const html = (0, server_1.renderToString)(react_1.default.createElement(SSEProvider_1.SSEProvider, {
        url: null,
        children: react_1.default.createElement(RequiredContextConsumer),
    }));
    strict_1.default.match(html, /disconnected/i);
});
(0, node_test_1.default)('useOptionalSSEContext returns null when provider is missing', () => {
    const html = (0, server_1.renderToString)(react_1.default.createElement(OptionalContextConsumer));
    strict_1.default.match(html, />null</i);
});
(0, node_test_1.default)('useOptionalSSEContext returns provider state when wrapped', () => {
    const html = (0, server_1.renderToString)(react_1.default.createElement(SSEProvider_1.SSEProvider, {
        url: null,
        children: react_1.default.createElement(OptionalContextConsumer),
    }));
    strict_1.default.match(html, /disconnected/i);
});
(0, node_test_1.default)('public API exports provider and related hooks', () => {
    strict_1.default.equal(typeof publicApi.SSEProvider, 'function');
    strict_1.default.equal(typeof publicApi.useSSEContext, 'function');
    strict_1.default.equal(typeof publicApi.useOptionalSSEContext, 'function');
});
