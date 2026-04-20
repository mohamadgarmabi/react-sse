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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSEDevtools = SSEDevtools;
const react_1 = __importStar(require("react"));
// One line SharedWorker support
const isSharedWorkerSupported = typeof window !== "undefined" && "SharedWorker" in window;
// Helper to get device info as string (OS/Device/Browser — naive best effort)
function getDeviceInfo() {
    if (typeof navigator === "undefined")
        return "Unknown";
    let device = "Unknown";
    const ua = navigator.userAgent || "";
    // OS
    if (/android/i.test(ua))
        device = "Android";
    else if (/iPad|iPhone|iPod/.test(ua))
        device = "iOS";
    else if (/Win/.test(ua))
        device = "Windows";
    else if (/Mac/.test(ua))
        device = "macOS";
    else if (/Linux/.test(ua))
        device = "Linux";
    // Browser
    let browser = "";
    if (/Chrome\//.test(ua) && !/Edge\//.test(ua))
        browser = "Chrome";
    else if (/Safari\//.test(ua) && !/Chrome\//.test(ua))
        browser = "Safari";
    else if (/Firefox\//.test(ua))
        browser = "Firefox";
    else if (/Edg\//.test(ua))
        browser = "Edge";
    else if (/MSIE |Trident\//.test(ua))
        browser = "IE";
    // (Optional) append device type (Mobile/Desktop)
    let type = "";
    if (/Mobile|Android|iP(hone|od|ad)/.test(ua)) {
        type = "Mobile";
    }
    else {
        type = "Desktop";
    }
    // Final label: OS (type), browser
    return [device, `(${type})`, browser].filter(Boolean).join(" ");
}
const getPositionStyles = (position, isOpen) => {
    const base = {
        position: "fixed",
        zIndex: 9999,
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    };
    switch (position) {
        case "top-left":
            return { ...base, top: isOpen ? 20 : 20, left: isOpen ? 20 : 20 };
        case "top-right":
            return { ...base, top: isOpen ? 20 : 20, right: isOpen ? 20 : 20 };
        case "bottom-left":
            return { ...base, bottom: isOpen ? 20 : 20, left: isOpen ? 20 : 20 };
        case "bottom-right":
        default:
            return { ...base, bottom: isOpen ? 20 : 20, right: isOpen ? 20 : 20 };
    }
};
const toggleButtonStyle = {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 16px rgba(102, 126, 234, 0.4), 0 8px 24px rgba(0, 0, 0, 0.15)",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
};
const toggleButtonHoverStyle = {
    transform: "scale(1.1)",
    boxShadow: "0 6px 20px rgba(102, 126, 234, 0.5), 0 12px 32px rgba(0, 0, 0, 0.2)",
};
const panelStyle = {
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif",
    fontSize: 13,
    lineHeight: 1.45,
    color: "#0f172a",
    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 16,
    minWidth: 320,
    maxWidth: 480,
    boxShadow: "0 20px 60px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)",
    backdropFilter: "blur(10px)",
    maxHeight: "calc(100vh - 100px)",
    overflowY: "auto",
};
const rowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottom: "1px solid #e2e8f0",
};
const badgeStyle = (color) => ({
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 12px",
    borderRadius: 12,
    background: color,
    color: "#0b0f19",
    fontWeight: 600,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
});
const progressBarStyle = {
    width: "100%",
    height: 8,
    background: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 4,
};
const progressBarFill = (percentage, color) => ({
    height: "100%",
    width: `${Math.min(100, Math.max(0, percentage))}%`,
    background: `linear-gradient(90deg, ${color} 0%, ${color}dd 100%)`,
    borderRadius: 4,
    transition: "width 0.3s ease",
    boxShadow: `0 0 8px ${color}40`,
});
const statCardStyle = {
    background: "linear-gradient(135deg, #f1f5f9 0%, #ffffff 100%)",
    padding: 12,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    flex: 1,
    textAlign: "center",
};
const statValueStyle = {
    fontSize: 24,
    fontWeight: 700,
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    marginBottom: 4,
};
const statLabelStyle = {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
};
function SSEDevtools({ state, title = "SSE Devtools", sampleInterval = 2000, showLastEvent = true, position = "bottom-right", visible = true, connectionMode, options, onOptionsChange, initialConfigTab, onConfigTabChange, initialCustomHeaders, onCustomHeadersChange, }) {
    const { status, events, lastEvent, retryCount, error, close, reconnect, connect,
    // state may have other values but they are not important
     } = state;
    const [isOpen, setIsOpen] = (0, react_1.useState)(false);
    const [memory, setMemory] = (0, react_1.useState)(null);
    const [eventLoopLag, setEventLoopLag] = (0, react_1.useState)(0);
    const [isHovering, setIsHovering] = (0, react_1.useState)(false);
    const [showConfig, setShowConfig] = (0, react_1.useState)(false);
    const [configTab, setConfigTab] = (0, react_1.useState)(initialConfigTab || "default");
    const [localOptions, setLocalOptions] = (0, react_1.useState)(options || {});
    const [editingOptions, setEditingOptions] = (0, react_1.useState)(options || {});
    const [customHeaders, setCustomHeaders] = (0, react_1.useState)(initialCustomHeaders !== undefined
        ? initialCustomHeaders
        : options?.headers
            ? Object.entries(options.headers).map(([key, value]) => ({ key, value }))
            : []);
    const [uiError, setUIError] = (0, react_1.useState)(null);
    // Added: Keep track of permanent error mode
    const [permanentRetryMode, setPermanentRetryMode] = (0, react_1.useState)(false);
    const hasUserRetried = (0, react_1.useRef)(false);
    const panelRef = (0, react_1.useRef)(null);
    // If an error occurs, enter permanent retry mode
    (0, react_1.useEffect)(() => {
        if (error || uiError) {
            setPermanentRetryMode(true);
        }
    }, [error, uiError]);
    // If successful connection or user retries, remove permanent retry mode
    (0, react_1.useEffect)(() => {
        if (!error && !uiError && status === "connected") {
            setPermanentRetryMode(false);
            hasUserRetried.current = false;
        }
    }, [error, uiError, status]);
    // Update local options when props change
    (0, react_1.useEffect)(() => {
        if (options) {
            setLocalOptions(options);
            setEditingOptions(options);
            if (initialCustomHeaders === undefined) {
                if (options.headers) {
                    setCustomHeaders(Object.entries(options.headers).map(([key, value]) => ({ key, value })));
                }
                else {
                    setCustomHeaders([]);
                }
            }
        }
    }, [options, initialCustomHeaders]);
    // Sync configTab with initialConfigTab prop
    (0, react_1.useEffect)(() => {
        if (initialConfigTab !== undefined && initialConfigTab !== configTab) {
            setConfigTab(initialConfigTab);
        }
    }, [initialConfigTab, configTab]);
    // Sync customHeaders with initialCustomHeaders prop
    (0, react_1.useEffect)(() => {
        if (initialCustomHeaders !== undefined) {
            setCustomHeaders(initialCustomHeaders);
        }
    }, [initialCustomHeaders]);
    // Sample memory + event-loop lag (approx CPU pressure indicator)
    (0, react_1.useEffect)(() => {
        const updateMemory = () => {
            const perfMem = performance.memory;
            if (perfMem) {
                const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = perfMem;
                setMemory({
                    usedMB: Math.round((usedJSHeapSize / 1048576) * 10) / 10,
                    totalMB: Math.round((totalJSHeapSize / 1048576) * 10) / 10,
                    limitMB: Math.round((jsHeapSizeLimit / 1048576) * 10) / 10,
                    raw: perfMem,
                });
            }
        };
        updateMemory();
        const memId = setInterval(updateMemory, sampleInterval);
        let last = performance.now();
        const lagId = setInterval(() => {
            const now = performance.now();
            const delta = now - last;
            setEventLoopLag(Math.max(0, Math.round(delta - 1000)));
            last = now;
        }, 1000);
        return () => {
            clearInterval(memId);
            clearInterval(lagId);
        };
    }, [sampleInterval]);
    const lastEventPreview = (0, react_1.useMemo)(() => {
        if (!lastEvent)
            return "—";
        try {
            return JSON.stringify(lastEvent.data, null, 2);
        }
        catch {
            return String(lastEvent.data);
        }
    }, [lastEvent]);
    const statusColor = (0, react_1.useMemo)(() => {
        switch (status) {
            case "connected":
                return "#86efac";
            case "connecting":
                return "#fde047";
            case "error":
                return "#fca5a5";
            case "disconnected":
                return "#cbd5e1";
            case "closed":
            default:
                return "#94a3b8";
        }
    }, [status]);
    const memoryPercentage = (0, react_1.useMemo)(() => {
        if (!memory)
            return 0;
        return (memory.usedMB / memory.limitMB) * 100;
    }, [memory]);
    const lagColor = (0, react_1.useMemo)(() => {
        if (eventLoopLag < 50)
            return "#86efac";
        if (eventLoopLag < 200)
            return "#fde047";
        return "#fca5a5";
    }, [eventLoopLag]);
    // Modified: Only allow connect on retry button if NOT in permanent retry mode, otherwise do nothing
    const handleRetry = () => {
        // Only allow one user retry: after that do not connect anymore (user controlled retry once)
        if (!permanentRetryMode) {
            connect();
            setUIError(null);
            return;
        }
        if (!hasUserRetried.current) {
            connect();
            setUIError(null);
            hasUserRetried.current = true;
        }
        // After first retry, further "Retry Connect" does nothing
    };
    // Simulate an error for testing purposes
    const simulateError = () => {
        const simulatedError = new Error("This is a simulated error (throw error button).");
        simulatedError.name = "SimulatedError";
        setUIError(simulatedError);
    };
    const handleOptionsUpdate = (updatedOptions) => {
        setLocalOptions(updatedOptions);
        if (onOptionsChange) {
            onOptionsChange(updatedOptions);
        }
    };
    // Handle saving custom configuration
    const handleSaveCustomConfig = () => {
        const headersObj = {};
        customHeaders.forEach(({ key, value }) => {
            if (key.trim()) {
                headersObj[key.trim()] = value.trim();
            }
        });
        const updatedOptions = {
            ...editingOptions,
            headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
        };
        handleOptionsUpdate(updatedOptions);
        setLocalOptions(updatedOptions);
    };
    // Helper function to update options with current custom headers
    const updateOptionsWithHeaders = (headers) => {
        const headersObj = {};
        headers.forEach(({ key, value }) => {
            if (key.trim()) {
                headersObj[key.trim()] = value.trim();
            }
        });
        const updatedOptions = {
            ...editingOptions,
            headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
        };
        handleOptionsUpdate(updatedOptions);
        setEditingOptions(updatedOptions);
    };
    // Handle adding a new header row
    const handleAddHeader = () => {
        const newHeaders = [...customHeaders, { key: "", value: "" }];
        setCustomHeaders(newHeaders);
        if (onCustomHeadersChange) {
            onCustomHeadersChange(newHeaders);
        }
        // Update options immediately with new headers
        updateOptionsWithHeaders(newHeaders);
    };
    // Handle removing a header row
    const handleRemoveHeader = (index) => {
        const newHeaders = customHeaders.filter((_, i) => i !== index);
        setCustomHeaders(newHeaders);
        if (onCustomHeadersChange) {
            onCustomHeadersChange(newHeaders);
        }
        // Update options immediately with new headers
        updateOptionsWithHeaders(newHeaders);
    };
    // Handle updating a header row
    const handleUpdateHeader = (index, field, newValue) => {
        const updated = [...customHeaders];
        updated[index] = { ...updated[index], [field]: newValue };
        setCustomHeaders(updated);
        if (onCustomHeadersChange) {
            onCustomHeadersChange(updated);
        }
        // Update options immediately with new headers
        updateOptionsWithHeaders(updated);
    };
    if (!visible)
        return null;
    const positionStyles = getPositionStyles(position, isOpen);
    // Action buttons
    function ActionButtons() {
        // Disable all live connect/reconnect/throw error buttons in permanent retry mode after user retry
        const buttonsDisabled = permanentRetryMode && hasUserRetried.current;
        return (react_1.default.createElement("div", { style: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8, width: "100%", margin: "8px 0" } },
            react_1.default.createElement("div", { style: { display: "flex", gap: 6, alignItems: "center" } },
                react_1.default.createElement("button", { style: {
                        padding: "5px 18px",
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        background: "#fee2e2",
                        color: "#b91c1c",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "background 0.15s",
                        minWidth: 90,
                        textAlign: "center",
                        opacity: buttonsDisabled ? 0.6 : 1,
                        pointerEvents: buttonsDisabled ? "none" : undefined,
                    }, onClick: close, onMouseEnter: e => { e.currentTarget.style.background = "#fecaca"; }, onMouseLeave: e => { e.currentTarget.style.background = "#fee2e2"; }, title: "Close connection", disabled: buttonsDisabled }, "Close")),
            react_1.default.createElement("div", { style: { display: "flex", gap: 6, alignItems: "center" } },
                react_1.default.createElement("button", { style: {
                        padding: "5px 18px",
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        background: "#f3e8ff",
                        color: "#7c3aed",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "background 0.15s",
                        minWidth: 90,
                        textAlign: "center",
                        opacity: buttonsDisabled ? 0.6 : 1,
                        pointerEvents: buttonsDisabled ? "none" : undefined,
                    }, onClick: reconnect, onMouseEnter: e => { e.currentTarget.style.background = "#e9d5ff"; }, onMouseLeave: e => { e.currentTarget.style.background = "#f3e8ff"; }, title: "Reconnect", disabled: buttonsDisabled }, "Reconnect")),
            react_1.default.createElement("div", { style: { display: "flex", gap: 6, alignItems: "center" } },
                react_1.default.createElement("button", { style: {
                        padding: "5px 18px",
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #fca5a5",
                        background: "#fff1f2",
                        color: "#bb1c1c",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "background 0.15s",
                        minWidth: 90,
                        textAlign: "center",
                        opacity: buttonsDisabled ? 0.6 : 1,
                        pointerEvents: buttonsDisabled ? "none" : undefined,
                    }, onClick: simulateError, onMouseEnter: e => { e.currentTarget.style.background = "#ffe4e6"; }, onMouseLeave: e => { e.currentTarget.style.background = "#fff1f2"; }, title: "Throw Error", disabled: buttonsDisabled }, "Throw Error")),
            (error || uiError || status === "disconnected" || status === "closed") && (react_1.default.createElement("div", { style: { display: "flex", gap: 6, alignItems: "center" } },
                react_1.default.createElement("button", { style: {
                        padding: "5px 18px",
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #fde047",
                        background: "#fef9c3",
                        color: "#b45309",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "background 0.15s",
                        minWidth: 90,
                        textAlign: "center",
                        opacity: buttonsDisabled ? 0.6 : 1,
                        pointerEvents: buttonsDisabled ? "none" : undefined,
                    }, onClick: handleRetry, onMouseEnter: e => { e.currentTarget.style.background = "#fef3c7"; }, onMouseLeave: e => { e.currentTarget.style.background = "#fef9c3"; }, title: "Retry/Connect", disabled: buttonsDisabled }, "Retry Connect"))),
            buttonsDisabled && (react_1.default.createElement("div", { style: { color: "#991b1b", fontSize: 12, paddingLeft: 8 } }, "Retry limit reached (connection disabled due to error)"))));
    }
    // Get device/UA info + isSharedWorkerSupported, memoized
    const deviceInfo = (0, react_1.useMemo)(() => getDeviceInfo(), []);
    // (note: isSharedWorkerSupported is a constant above)
    return (react_1.default.createElement("div", { style: positionStyles }, !isOpen ? (react_1.default.createElement("button", { style: {
            ...toggleButtonStyle,
            ...(isHovering ? toggleButtonHoverStyle : {}),
        }, onClick: () => setIsOpen(true), onMouseEnter: () => setIsHovering(true), onMouseLeave: () => setIsHovering(false), title: "Open SSE Devtools", "aria-label": "Open SSE Devtools" },
        react_1.default.createElement("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
            react_1.default.createElement("path", { d: "M12 2L2 7l10 5 10-5-10-5z" }),
            react_1.default.createElement("path", { d: "M2 17l10 5 10-5M2 12l10 5 10-5" })))) : (react_1.default.createElement("div", { ref: panelRef, style: panelStyle },
        react_1.default.createElement("div", { style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: "2px solid #e2e8f0",
            } },
            react_1.default.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                react_1.default.createElement("div", { style: {
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: statusColor,
                        boxShadow: `0 0 8px ${statusColor}`,
                        animation: status === "connected" ? "pulse 2s infinite" : "none",
                    } }),
                react_1.default.createElement("strong", { style: { fontSize: 16, fontWeight: 700 } }, title)),
            react_1.default.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                react_1.default.createElement("span", { style: badgeStyle(statusColor) }, status.toUpperCase()))),
        react_1.default.createElement("div", { style: { ...rowStyle, marginBottom: 0 } },
            react_1.default.createElement("span", { style: { fontWeight: 600, color: "#64748b" } }, "Device"),
            react_1.default.createElement("span", { style: { fontSize: 12, color: "#334155" } }, deviceInfo)),
        react_1.default.createElement("div", { style: { ...rowStyle, borderBottom: "none", marginBottom: 8, paddingBottom: 0 } },
            react_1.default.createElement("span", { style: { fontWeight: 600, color: "#64748b" } }, "SharedWorker Supported"),
            react_1.default.createElement("span", { style: {
                    fontSize: 12,
                    fontWeight: 600,
                    color: isSharedWorkerSupported ? "#16a34a" : "#991b1b"
                } }, isSharedWorkerSupported ? "Yes" : "No")),
        react_1.default.createElement(ActionButtons, null),
        connectionMode && (react_1.default.createElement("div", { style: rowStyle },
            react_1.default.createElement("span", { style: { fontWeight: 600 } }, "Connection Mode"),
            react_1.default.createElement("span", { style: badgeStyle(connectionMode === "auto" ? "#dbeafe" : "#fef3c7") }, connectionMode.toUpperCase()))),
        react_1.default.createElement("div", { style: {
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 16,
            } },
            react_1.default.createElement("div", { style: statCardStyle },
                react_1.default.createElement("div", { style: statValueStyle }, events.length),
                react_1.default.createElement("div", { style: statLabelStyle }, "Events")),
            react_1.default.createElement("div", { style: statCardStyle },
                react_1.default.createElement("div", { style: statValueStyle }, retryCount),
                react_1.default.createElement("div", { style: statLabelStyle }, "Retries"))),
        react_1.default.createElement("div", { style: rowStyle },
            react_1.default.createElement("div", null,
                react_1.default.createElement("div", { style: { fontWeight: 600, marginBottom: 4 } }, "Event Loop Lag"),
                react_1.default.createElement("div", { style: { fontSize: 11, color: "#64748b" } }, "CPU pressure indicator")),
            react_1.default.createElement("div", { style: { textAlign: "right" } },
                react_1.default.createElement("div", { style: { fontSize: 20, fontWeight: 700, color: lagColor } },
                    eventLoopLag,
                    "ms"))),
        react_1.default.createElement("div", { style: progressBarStyle },
            react_1.default.createElement("div", { style: progressBarFill(Math.min(100, (eventLoopLag / 500) * 100), lagColor) })),
        memory && (react_1.default.createElement(react_1.default.Fragment, null,
            react_1.default.createElement("div", { style: { ...rowStyle, marginTop: 8 } },
                react_1.default.createElement("div", null,
                    react_1.default.createElement("div", { style: { fontWeight: 600, marginBottom: 4 } }, "Memory Usage"),
                    react_1.default.createElement("div", { style: { fontSize: 11, color: "#64748b" } },
                        memory.usedMB,
                        " / ",
                        memory.totalMB,
                        " MB")),
                react_1.default.createElement("div", { style: { textAlign: "right" } },
                    react_1.default.createElement("div", { style: { fontSize: 20, fontWeight: 700, color: "#667eea" } },
                        Math.round(memoryPercentage),
                        "%"),
                    react_1.default.createElement("div", { style: { fontSize: 10, color: "#64748b" } },
                        "Limit: ",
                        memory.limitMB,
                        " MB"))),
            react_1.default.createElement("div", { style: progressBarStyle },
                react_1.default.createElement("div", { style: progressBarFill(memoryPercentage, "#667eea") })))),
        react_1.default.createElement("div", { style: rowStyle },
            react_1.default.createElement("span", { style: { fontWeight: 600 } }, "CPU Cores"),
            react_1.default.createElement("strong", { style: { fontSize: 16, color: "#667eea" } }, navigator.hardwareConcurrency || "n/a")),
        react_1.default.createElement("div", { style: rowStyle },
            react_1.default.createElement("span", { style: { fontWeight: 600 } }, "Last Event"),
            react_1.default.createElement("strong", { style: { fontSize: 12, color: "#64748b" } }, lastEvent
                ? new Date(lastEvent.timestamp).toLocaleTimeString()
                : "—")),
        react_1.default.createElement("div", { style: rowStyle },
            react_1.default.createElement("span", { style: { fontWeight: 600 } }, "Last Event Type"),
            react_1.default.createElement("strong", { style: { fontSize: 12, color: "#64748b" } }, lastEvent
                ? lastEvent.type
                : "—")),
        lastEvent?.id && (react_1.default.createElement("div", { style: rowStyle },
            react_1.default.createElement("span", { style: { fontWeight: 600 } }, "Last Event ID"),
            react_1.default.createElement("strong", { style: { fontSize: 12, color: "#64748b" } }, lastEvent.id))),
        (error || uiError) && (react_1.default.createElement("div", { style: {
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                background: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
                border: "1px solid #fca5a5",
                color: "#991b1b",
                fontSize: 12,
                boxShadow: "0 2px 8px rgba(239, 68, 68, 0.15)",
            } },
            react_1.default.createElement("div", { style: { fontWeight: 700, marginBottom: 4 } }, "\u26A0\uFE0F Error"),
            react_1.default.createElement("div", { style: { marginBottom: 8 } }, (error && error.message) || (uiError && uiError.message)),
            (error && error.name) || (uiError && uiError.name) ? (react_1.default.createElement("div", { style: { fontSize: 10, opacity: 0.8, marginBottom: 8 } },
                "Type: ",
                (error && error.name) || (uiError && uiError.name))) : null,
            react_1.default.createElement("button", { style: {
                    marginTop: 8,
                    padding: "6px 16px",
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid #fde047",
                    background: "#fef9c3",
                    color: "#b45309",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "background 0.15s",
                    width: "100%",
                    opacity: permanentRetryMode && hasUserRetried.current ? 0.6 : 1,
                    pointerEvents: permanentRetryMode && hasUserRetried.current ? "none" : undefined,
                }, onClick: handleRetry, onMouseEnter: (e) => {
                    e.currentTarget.style.background = "#fef3c7";
                }, onMouseLeave: (e) => {
                    e.currentTarget.style.background = "#fef9c3";
                }, title: "Retry connection", disabled: permanentRetryMode && hasUserRetried.current }, "\uD83D\uDD04 Retry Connection"),
            permanentRetryMode && hasUserRetried.current && (react_1.default.createElement("div", { style: { color: "#991b1b", fontSize: 12, marginTop: 8 } }, "Maximum retry attempts exceeded. Reconnection is no longer possible.")))),
        options && (react_1.default.createElement("div", { style: { marginTop: 16 } },
            react_1.default.createElement("div", { style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                } },
                react_1.default.createElement("div", { style: {
                        fontWeight: 700,
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        color: "#64748b",
                    } }, "Configuration"),
                react_1.default.createElement("button", { onClick: () => setShowConfig(!showConfig), style: {
                        padding: "4px 8px",
                        fontSize: 11,
                        borderRadius: 6,
                        border: "1px solid #e2e8f0",
                        background: showConfig ? "#f1f5f9" : "transparent",
                        color: "#64748b",
                        cursor: "pointer",
                        transition: "all 0.15s",
                    } }, showConfig ? "▼" : "▶")),
            showConfig && (react_1.default.createElement("div", { style: {
                    padding: 12,
                    background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    fontSize: 11,
                } },
                react_1.default.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 12, borderBottom: "1px solid #e2e8f0" } },
                    react_1.default.createElement("button", { onClick: () => {
                            setConfigTab("default");
                            if (onConfigTabChange) {
                                onConfigTabChange("default");
                            }
                        }, style: {
                            padding: "6px 12px",
                            fontSize: 11,
                            fontWeight: 600,
                            border: "none",
                            background: configTab === "default" ? "#667eea" : "transparent",
                            color: configTab === "default" ? "white" : "#64748b",
                            cursor: "pointer",
                            borderRadius: "6px 6px 0 0",
                            transition: "all 0.15s",
                        } }, "Default"),
                    react_1.default.createElement("button", { onClick: () => {
                            setConfigTab("custom");
                            if (onConfigTabChange) {
                                onConfigTabChange("custom");
                            }
                        }, style: {
                            padding: "6px 12px",
                            fontSize: 11,
                            fontWeight: 600,
                            border: "none",
                            background: configTab === "custom" ? "#667eea" : "transparent",
                            color: configTab === "custom" ? "white" : "#64748b",
                            cursor: "pointer",
                            borderRadius: "6px 6px 0 0",
                            transition: "all 0.15s",
                        } }, "Custom")),
                configTab === "default" && (react_1.default.createElement("div", null,
                    react_1.default.createElement("div", { style: { marginBottom: 8 } },
                        react_1.default.createElement("div", { style: { fontWeight: 600, marginBottom: 4 } }, "Connection Mode"),
                        react_1.default.createElement("div", { style: { color: "#64748b" } }, localOptions.connectionMode || "auto")),
                    localOptions.autoConnectDelay !== undefined && (react_1.default.createElement("div", { style: { marginBottom: 8 } },
                        react_1.default.createElement("div", { style: { fontWeight: 600, marginBottom: 4 } }, "Auto Connect Delay"),
                        react_1.default.createElement("div", { style: { color: "#64748b" } },
                            localOptions.autoConnectDelay,
                            "ms"))),
                    localOptions.maxRetries !== undefined && (react_1.default.createElement("div", { style: { marginBottom: 8 } },
                        react_1.default.createElement("div", { style: { fontWeight: 600, marginBottom: 4 } }, "Max Retries"),
                        react_1.default.createElement("div", { style: { color: "#64748b" } }, localOptions.maxRetries))),
                    localOptions.maxRetryDelay !== undefined && (react_1.default.createElement("div", { style: { marginBottom: 8 } },
                        react_1.default.createElement("div", { style: { fontWeight: 600, marginBottom: 4 } }, "Max Retry Delay"),
                        react_1.default.createElement("div", { style: { color: "#64748b" } },
                            localOptions.maxRetryDelay,
                            "ms"))),
                    localOptions.initialRetryDelay !== undefined && (react_1.default.createElement("div", { style: { marginBottom: 8 } },
                        react_1.default.createElement("div", { style: { fontWeight: 600, marginBottom: 4 } }, "Initial Retry Delay"),
                        react_1.default.createElement("div", { style: { color: "#64748b" } },
                            localOptions.initialRetryDelay,
                            "ms"))),
                    localOptions.autoReconnect !== undefined && (react_1.default.createElement("div", { style: { marginBottom: 8 } },
                        react_1.default.createElement("div", { style: { fontWeight: 600, marginBottom: 4 } }, "Auto Reconnect"),
                        react_1.default.createElement("div", { style: { color: "#64748b" } }, localOptions.autoReconnect ? "Enabled" : "Disabled"))),
                    localOptions.headers && Object.keys(localOptions.headers).length > 0 && (react_1.default.createElement("div", { style: { marginBottom: 8 } },
                        react_1.default.createElement("div", { style: { fontWeight: 600, marginBottom: 4 } }, "Custom Headers"),
                        react_1.default.createElement("div", { style: { color: "#64748b" } },
                            Object.keys(localOptions.headers).length,
                            " header(s)"))),
                    localOptions.retryDelayFn && (react_1.default.createElement("div", { style: { marginBottom: 8 } },
                        react_1.default.createElement("div", { style: { fontWeight: 600, marginBottom: 4 } }, "Retry Delay Function"),
                        react_1.default.createElement("div", { style: { color: "#64748b" } }, "Custom function provided"))))),
                configTab === "custom" && (react_1.default.createElement("div", null,
                    react_1.default.createElement("div", { style: { marginBottom: 12 } },
                        react_1.default.createElement("label", { style: { display: "block", fontWeight: 600, marginBottom: 4, fontSize: 11 } }, "Connection Mode"),
                        react_1.default.createElement("select", { value: editingOptions.connectionMode || "auto", onChange: (e) => {
                                setEditingOptions({
                                    ...editingOptions,
                                    connectionMode: e.target.value,
                                });
                            }, style: {
                                width: "100%",
                                padding: "6px 8px",
                                fontSize: 11,
                                borderRadius: 6,
                                border: "1px solid #e2e8f0",
                                background: "white",
                                color: "#0f172a",
                            } },
                            react_1.default.createElement("option", { value: "auto" }, "Auto"),
                            react_1.default.createElement("option", { value: "manual" }, "Manual"))),
                    react_1.default.createElement("div", { style: { marginBottom: 12 } },
                        react_1.default.createElement("label", { style: { display: "block", fontWeight: 600, marginBottom: 4, fontSize: 11 } }, "Auto Connect Delay (ms)"),
                        react_1.default.createElement("input", { type: "number", value: editingOptions.autoConnectDelay ?? "", onChange: (e) => {
                                setEditingOptions({
                                    ...editingOptions,
                                    autoConnectDelay: e.target.value ? parseInt(e.target.value, 10) : undefined,
                                });
                            }, placeholder: "0", min: "0", style: {
                                width: "100%",
                                padding: "6px 8px",
                                fontSize: 11,
                                borderRadius: 6,
                                border: "1px solid #e2e8f0",
                                background: "white",
                                color: "#0f172a",
                            } })),
                    react_1.default.createElement("div", { style: { marginBottom: 12 } },
                        react_1.default.createElement("label", { style: { display: "block", fontWeight: 600, marginBottom: 4, fontSize: 11 } }, "Max Retries"),
                        react_1.default.createElement("input", { type: "number", value: editingOptions.maxRetries ?? "", onChange: (e) => {
                                setEditingOptions({
                                    ...editingOptions,
                                    maxRetries: e.target.value ? parseInt(e.target.value, 10) : undefined,
                                });
                            }, placeholder: "5", min: "0", style: {
                                width: "100%",
                                padding: "6px 8px",
                                fontSize: 11,
                                borderRadius: 6,
                                border: "1px solid #e2e8f0",
                                background: "white",
                                color: "#0f172a",
                            } })),
                    react_1.default.createElement("div", { style: { marginBottom: 12 } },
                        react_1.default.createElement("label", { style: { display: "block", fontWeight: 600, marginBottom: 4, fontSize: 11 } }, "Max Retry Delay (ms)"),
                        react_1.default.createElement("input", { type: "number", value: editingOptions.maxRetryDelay ?? "", onChange: (e) => {
                                setEditingOptions({
                                    ...editingOptions,
                                    maxRetryDelay: e.target.value ? parseInt(e.target.value, 10) : undefined,
                                });
                            }, placeholder: "30000", min: "0", style: {
                                width: "100%",
                                padding: "6px 8px",
                                fontSize: 11,
                                borderRadius: 6,
                                border: "1px solid #e2e8f0",
                                background: "white",
                                color: "#0f172a",
                            } })),
                    react_1.default.createElement("div", { style: { marginBottom: 12 } },
                        react_1.default.createElement("label", { style: { display: "block", fontWeight: 600, marginBottom: 4, fontSize: 11 } }, "Initial Retry Delay (ms)"),
                        react_1.default.createElement("input", { type: "number", value: editingOptions.initialRetryDelay ?? "", onChange: (e) => {
                                setEditingOptions({
                                    ...editingOptions,
                                    initialRetryDelay: e.target.value ? parseInt(e.target.value, 10) : undefined,
                                });
                            }, placeholder: "1000", min: "0", style: {
                                width: "100%",
                                padding: "6px 8px",
                                fontSize: 11,
                                borderRadius: 6,
                                border: "1px solid #e2e8f0",
                                background: "white",
                                color: "#0f172a",
                            } })),
                    react_1.default.createElement("div", { style: { marginBottom: 12 } },
                        react_1.default.createElement("label", { style: { display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 11 } },
                            react_1.default.createElement("input", { type: "checkbox", checked: editingOptions.autoReconnect ?? true, onChange: (e) => {
                                    setEditingOptions({
                                        ...editingOptions,
                                        autoReconnect: e.target.checked,
                                    });
                                }, style: {
                                    width: 16,
                                    height: 16,
                                    cursor: "pointer",
                                } }),
                            "Auto Reconnect")),
                    react_1.default.createElement("div", { style: { marginBottom: 12 } },
                        react_1.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 } },
                            react_1.default.createElement("label", { style: { fontWeight: 600, fontSize: 11 } }, "Custom Headers"),
                            react_1.default.createElement("button", { onClick: handleAddHeader, style: {
                                    padding: "4px 8px",
                                    fontSize: 10,
                                    borderRadius: 4,
                                    border: "1px solid #e2e8f0",
                                    background: "#f1f5f9",
                                    color: "#64748b",
                                    cursor: "pointer",
                                    transition: "all 0.15s",
                                } }, "+ Add Header")),
                        customHeaders.map((header, index) => (react_1.default.createElement("div", { key: index, style: { display: "flex", gap: 6, marginBottom: 6 } },
                            react_1.default.createElement("input", { type: "text", value: header.key, onChange: (e) => handleUpdateHeader(index, "key", e.target.value), placeholder: "Header name", style: {
                                    flex: 1,
                                    padding: "6px 8px",
                                    fontSize: 11,
                                    borderRadius: 6,
                                    border: "1px solid #e2e8f0",
                                    background: "white",
                                    color: "#0f172a",
                                } }),
                            react_1.default.createElement("input", { type: "text", value: header.value, onChange: (e) => handleUpdateHeader(index, "value", e.target.value), placeholder: "Header value", style: {
                                    flex: 1,
                                    padding: "6px 8px",
                                    fontSize: 11,
                                    borderRadius: 6,
                                    border: "1px solid #e2e8f0",
                                    background: "white",
                                    color: "#0f172a",
                                } }),
                            react_1.default.createElement("button", { onClick: () => handleRemoveHeader(index), style: {
                                    padding: "6px 10px",
                                    fontSize: 11,
                                    borderRadius: 6,
                                    border: "1px solid #fee2e2",
                                    background: "#fee2e2",
                                    color: "#b91c1c",
                                    cursor: "pointer",
                                    transition: "all 0.15s",
                                } }, "\u00D7")))),
                        customHeaders.length === 0 && (react_1.default.createElement("div", { style: { color: "#94a3b8", fontSize: 10, fontStyle: "italic" } }, "No custom headers. Click \"Add Header\" to add one."))),
                    editingOptions.retryDelayFn && (react_1.default.createElement("div", { style: { marginBottom: 12 } },
                        react_1.default.createElement("div", { style: { fontWeight: 600, marginBottom: 4, fontSize: 11 } }, "Retry Delay Function"),
                        react_1.default.createElement("div", { style: { color: "#64748b", fontSize: 10 } }, "Custom function provided (cannot be edited here)"))),
                    react_1.default.createElement("button", { onClick: handleSaveCustomConfig, style: {
                            width: "100%",
                            padding: "8px 16px",
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 8,
                            border: "1px solid #667eea",
                            background: "#667eea",
                            color: "white",
                            cursor: "pointer",
                            transition: "all 0.15s",
                            marginTop: 8,
                        }, onMouseEnter: (e) => {
                            e.currentTarget.style.background = "#5568d3";
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.background = "#667eea";
                        } }, "Save Configuration"))))))),
        showLastEvent && (react_1.default.createElement("div", { style: { marginTop: 16 } },
            react_1.default.createElement("div", { style: {
                    fontWeight: 700,
                    marginBottom: 8,
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "#64748b",
                } }, "Last Event Payload"),
            react_1.default.createElement("pre", { style: {
                    margin: 0,
                    padding: 12,
                    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                    color: "#e2e8f0",
                    borderRadius: 12,
                    maxHeight: 200,
                    overflow: "auto",
                    fontSize: 11,
                    lineHeight: 1.6,
                    border: "1px solid #334155",
                    boxShadow: "inset 0 2px 8px rgba(0, 0, 0, 0.3)",
                } }, lastEventPreview))),
        react_1.default.createElement("style", null, `
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
            `),
        react_1.default.createElement("div", { style: { marginTop: 16, paddingTop: 12, borderTop: "1px solid #e2e8f0" } },
            react_1.default.createElement("button", { onClick: () => setIsOpen(false), style: {
                    width: "100%",
                    padding: "8px 16px",
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#f1f5f9",
                    color: "#64748b",
                    cursor: "pointer",
                    transition: "all 0.15s",
                }, onMouseEnter: (e) => {
                    e.currentTarget.style.background = "#e2e8f0";
                }, onMouseLeave: (e) => {
                    e.currentTarget.style.background = "#f1f5f9";
                }, title: "Close Devtools" }, "Close Devtools"))))));
}
exports.default = SSEDevtools;
