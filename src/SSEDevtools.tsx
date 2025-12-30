import React, { useEffect, useMemo, useState, useRef } from "react";
import type { SSEReturn, SSEOptions, ConnectionMode } from "./types";

type MemorySample = {
  usedMB: number;
  totalMB: number;
  limitMB: number;
  raw?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
};

type Position = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type Props<T = any> = {
  state: SSEReturn<T>;
  title?: string;
  sampleInterval?: number;
  showLastEvent?: boolean;
  position?: Position;
  visible?: boolean;
  connectionMode?: ConnectionMode;
  options?: SSEOptions;
  onOptionsChange?: (options: SSEOptions) => void;
};

const getPositionStyles = (position: Position, isOpen: boolean): React.CSSProperties => {
  const base: React.CSSProperties = {
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

const toggleButtonStyle: React.CSSProperties = {
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

const toggleButtonHoverStyle: React.CSSProperties = {
  transform: "scale(1.1)",
  boxShadow: "0 6px 20px rgba(102, 126, 234, 0.5), 0 12px 32px rgba(0, 0, 0, 0.2)",
};

const panelStyle: React.CSSProperties = {
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

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
  paddingBottom: 12,
  borderBottom: "1px solid #e2e8f0",
};

const badgeStyle = (color: string): React.CSSProperties => ({
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

const progressBarStyle: React.CSSProperties = {
  width: "100%",
  height: 8,
  background: "#e2e8f0",
  borderRadius: 4,
  overflow: "hidden",
  marginTop: 4,
};

const progressBarFill = (percentage: number, color: string): React.CSSProperties => ({
  height: "100%",
  width: `${Math.min(100, Math.max(0, percentage))}%`,
  background: `linear-gradient(90deg, ${color} 0%, ${color}dd 100%)`,
  borderRadius: 4,
  transition: "width 0.3s ease",
  boxShadow: `0 0 8px ${color}40`,
});

const statCardStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #f1f5f9 0%, #ffffff 100%)",
  padding: 12,
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  flex: 1,
  textAlign: "center",
};

const statValueStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  marginBottom: 4,
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

export function SSEDevtools<T = any>({
  state,
  title = "SSE Devtools",
  sampleInterval = 2000,
  showLastEvent = true,
  position = "bottom-right",
  visible = true,
  connectionMode,
  options,
  onOptionsChange,
}: Props<T>) {
  const {
    status,
    events,
    lastEvent,
    retryCount,
    error,
    close,
    reconnect,
    connect,
    // state may have other values but they are not important
  } = state;

  const [isOpen, setIsOpen] = useState(false);
  const [memory, setMemory] = useState<MemorySample | null>(null);
  const [eventLoopLag, setEventLoopLag] = useState<number>(0);
  const [isHovering, setIsHovering] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [configTab, setConfigTab] = useState<"default" | "custom">("default");
  const [localOptions, setLocalOptions] = useState<SSEOptions>(options || {});
  const [editingOptions, setEditingOptions] = useState<SSEOptions>(options || {});
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>(
    options?.headers ? Object.entries(options.headers).map(([key, value]) => ({ key, value })) : []
  );
  const [uiError, setUIError] = useState<Error | null>(null);

  // Added: Keep track of permanent error mode
  const [permanentRetryMode, setPermanentRetryMode] = useState(false);
  const hasUserRetried = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // If an error occurs, enter permanent retry mode
  useEffect(() => {
    if (error || uiError) {
      setPermanentRetryMode(true);
    }
  }, [error, uiError]);

  // If successful connection or user retries, remove permanent retry mode
  useEffect(() => {
    if (!error && !uiError && status === "connected") {
      setPermanentRetryMode(false);
      hasUserRetried.current = false;
    }
  }, [error, uiError, status]);

  // Update local options when props change
  useEffect(() => {
    if (options) {
      setLocalOptions(options);
      setEditingOptions(options);
      if (options.headers) {
        setCustomHeaders(Object.entries(options.headers).map(([key, value]) => ({ key, value })));
      } else {
        setCustomHeaders([]);
      }
    }
  }, [options]);

  // Handle click outside to close panel
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Sample memory + event-loop lag (approx CPU pressure indicator)
  useEffect(() => {
    const updateMemory = () => {
      const perfMem = (performance as any).memory;
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

  const lastEventPreview = useMemo(() => {
    if (!lastEvent) return "—";
    try {
      return JSON.stringify(lastEvent.data, null, 2);
    } catch {
      return String(lastEvent.data);
    }
  }, [lastEvent]);

  const statusColor = useMemo(() => {
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

  const memoryPercentage = useMemo(() => {
    if (!memory) return 0;
    return (memory.usedMB / memory.limitMB) * 100;
  }, [memory]);

  const lagColor = useMemo(() => {
    if (eventLoopLag < 50) return "#86efac";
    if (eventLoopLag < 200) return "#fde047";
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

  const handleOptionsUpdate = (updatedOptions: SSEOptions) => {
    setLocalOptions(updatedOptions);
    if (onOptionsChange) {
      onOptionsChange(updatedOptions);
    }
  };

  // Handle saving custom configuration
  const handleSaveCustomConfig = () => {
    const headersObj: Record<string, string> = {};
    customHeaders.forEach(({ key, value }) => {
      if (key.trim()) {
        headersObj[key.trim()] = value.trim();
      }
    });

    const updatedOptions: SSEOptions = {
      ...editingOptions,
      headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
    };

    handleOptionsUpdate(updatedOptions);
    setLocalOptions(updatedOptions);
  };

  // Handle adding a new header row
  const handleAddHeader = () => {
    setCustomHeaders([...customHeaders, { key: "", value: "" }]);
  };

  // Handle removing a header row
  const handleRemoveHeader = (index: number) => {
    setCustomHeaders(customHeaders.filter((_, i) => i !== index));
  };

  // Handle updating a header row
  const handleUpdateHeader = (index: number, field: "key" | "value", newValue: string) => {
    const updated = [...customHeaders];
    updated[index] = { ...updated[index], [field]: newValue };
    setCustomHeaders(updated);
  };

  if (!visible) return null;

  const positionStyles = getPositionStyles(position, isOpen);

  // Action buttons
  function ActionButtons() {
    // Disable all live connect/reconnect/throw error buttons in permanent retry mode after user retry
    const buttonsDisabled = permanentRetryMode && hasUserRetried.current;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", margin: "8px 0" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            style={{
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
            }}
            onClick={close}
            onMouseEnter={e => { e.currentTarget.style.background = "#fecaca"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#fee2e2"; }}
            title="Close connection"
            disabled={buttonsDisabled}
          >
            Close
          </button>
          <span style={{ fontSize: 12, color: "#64748b" }}>End connection</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            style={{
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
            }}
            onClick={reconnect}
            onMouseEnter={e => { e.currentTarget.style.background = "#e9d5ff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#f3e8ff"; }}
            title="Reconnect"
            disabled={buttonsDisabled}
          >
            Reconnect
          </button>
          <span style={{ fontSize: 12, color: "#64748b" }}>New connection</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            style={{
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
            }}
            onClick={simulateError}
            onMouseEnter={e => { e.currentTarget.style.background = "#ffe4e6"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#fff1f2"; }}
            title="Throw Error"
            disabled={buttonsDisabled}
          >
            Throw Error
          </button>
          <span style={{ fontSize: 12, color: "#64748b" }}>Simulate error</span>
        </div>
        {(error || uiError || status === "disconnected" || status === "closed") && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              style={{
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
              }}
              onClick={handleRetry}
              onMouseEnter={e => { e.currentTarget.style.background = "#fef3c7"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#fef9c3"; }}
              title="Retry/Connect"
              disabled={buttonsDisabled}
            >
              Retry Connect
            </button>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              {error || uiError ? (buttonsDisabled ? "Retry limit reached" : "Try again") : "Start connection"}
            </span>
          </div>
        )}
        {buttonsDisabled && (
          <div style={{ color: "#991b1b", fontSize: 12, paddingLeft: 8 }}>
            Retry limit reached (connection disabled due to error)
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={positionStyles}>
      {!isOpen ? (
        <button
          style={{
            ...toggleButtonStyle,
            ...(isHovering ? toggleButtonHoverStyle : {}),
          }}
          onClick={() => setIsOpen(true)}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          title="Open SSE Devtools"
          aria-label="Open SSE Devtools"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </button>
      ) : (
        <div ref={panelRef} style={panelStyle}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: "2px solid #e2e8f0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: statusColor,
                  boxShadow: `0 0 8px ${statusColor}`,
                  animation:
                    status === "connected" ? "pulse 2s infinite" : "none",
                }}
              />
              <strong style={{ fontSize: 16, fontWeight: 700 }}>{title}</strong>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={badgeStyle(statusColor)}>
                {status.toUpperCase()}
              </span>
              {/* Action buttons: below header */}
            </div>
          </div>

          {/* Buttons: column under header */}
          <ActionButtons />

          {/* Connection Mode */}
          {connectionMode && (
            <div style={rowStyle}>
              <span style={{ fontWeight: 600 }}>Connection Mode</span>
              <span style={badgeStyle(connectionMode === "auto" ? "#dbeafe" : "#fef3c7")}>
                {connectionMode.toUpperCase()}
              </span>
            </div>
          )}

          {/* Stats Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div style={statCardStyle}>
              <div style={statValueStyle}>{events.length}</div>
              <div style={statLabelStyle}>Events</div>
            </div>
            <div style={statCardStyle}>
              <div style={statValueStyle}>{retryCount}</div>
              <div style={statLabelStyle}>Retries</div>
            </div>
          </div>

          {/* Event Loop Lag */}
          <div style={rowStyle}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                Event Loop Lag
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                CPU pressure indicator
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: lagColor }}>
                {eventLoopLag}ms
              </div>
            </div>
          </div>
          <div style={progressBarStyle}>
            <div
              style={progressBarFill(
                Math.min(100, (eventLoopLag / 500) * 100),
                lagColor
              )}
            />
          </div>

          {/* Memory Usage */}
          {memory && (
            <>
              <div style={{ ...rowStyle, marginTop: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    Memory Usage
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    {memory.usedMB} / {memory.totalMB} MB
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{ fontSize: 20, fontWeight: 700, color: "#667eea" }}
                  >
                    {Math.round(memoryPercentage)}%
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>
                    Limit: {memory.limitMB} MB
                  </div>
                </div>
              </div>
              <div style={progressBarStyle}>
                <div style={progressBarFill(memoryPercentage, "#667eea")} />
              </div>
            </>
          )}

          {/* CPU Info */}
          <div style={rowStyle}>
            <span style={{ fontWeight: 600 }}>CPU Cores</span>
            <strong style={{ fontSize: 16, color: "#667eea" }}>
              {navigator.hardwareConcurrency || "n/a"}
            </strong>
          </div>

          {/* Last Event Time */}
          <div style={rowStyle}>
            <span style={{ fontWeight: 600 }}>Last Event</span>
            <strong style={{ fontSize: 12, color: "#64748b" }}>
              {lastEvent
                ? new Date(lastEvent.timestamp).toLocaleTimeString()
                : "—"}
            </strong>
          </div>

          {/* Last Event Type */}
          <div style={rowStyle}>
            <span style={{ fontWeight: 600 }}>Last Event Type</span>
            <strong style={{ fontSize: 12, color: "#64748b" }}>
              {lastEvent
                ? lastEvent.type
                : "—"}
            </strong>
          </div>

          {/* Last Event ID */}
          {lastEvent?.id && (
            <div style={rowStyle}>
              <span style={{ fontWeight: 600 }}>Last Event ID</span>
              <strong style={{ fontSize: 12, color: "#64748b" }}>
                {lastEvent.id}
              </strong>
            </div>
          )}

          {/* Error Display */}
          {(error || uiError) && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                background: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
                border: "1px solid #fca5a5",
                color: "#991b1b",
                fontSize: 12,
                boxShadow: "0 2px 8px rgba(239, 68, 68, 0.15)",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ Error</div>
              <div style={{ marginBottom: 8 }}>
                {(error && error.message) || (uiError && uiError.message)}
              </div>
              {(error && error.name) || (uiError && uiError.name) ? (
                <div style={{ fontSize: 10, opacity: 0.8, marginBottom: 8 }}>
                  Type: {(error && error.name) || (uiError && uiError.name)}
                </div>
              ) : null}
              <button
                style={{
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
                }}
                onClick={handleRetry}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#fef3c7";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#fef9c3";
                }}
                title="Retry connection"
                disabled={permanentRetryMode && hasUserRetried.current}
              >
                🔄 Retry Connection
              </button>
              {permanentRetryMode && hasUserRetried.current && (
                <div style={{ color: "#991b1b", fontSize: 12, marginTop: 8 }}>
                  Maximum retry attempts exceeded. Reconnection is no longer possible.
                </div>
              )}
            </div>
          )}

          {/* Configuration Panel */}
          {options && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "#64748b",
                  }}
                >
                  Configuration
                </div>
                <button
                  onClick={() => setShowConfig(!showConfig)}
                  style={{
                    padding: "4px 8px",
                    fontSize: 11,
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    background: showConfig ? "#f1f5f9" : "transparent",
                    color: "#64748b",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {showConfig ? "▼" : "▶"}
                </button>
              </div>
              {showConfig && (
                <div
                  style={{
                    padding: 12,
                    background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    fontSize: 11,
                  }}
                >
                  {/* Tab Buttons */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 12, borderBottom: "1px solid #e2e8f0" }}>
                    <button
                      onClick={() => setConfigTab("default")}
                      style={{
                        padding: "6px 12px",
                        fontSize: 11,
                        fontWeight: 600,
                        border: "none",
                        background: configTab === "default" ? "#667eea" : "transparent",
                        color: configTab === "default" ? "white" : "#64748b",
                        cursor: "pointer",
                        borderRadius: "6px 6px 0 0",
                        transition: "all 0.15s",
                      }}
                    >
                      Default
                    </button>
                    <button
                      onClick={() => setConfigTab("custom")}
                      style={{
                        padding: "6px 12px",
                        fontSize: 11,
                        fontWeight: 600,
                        border: "none",
                        background: configTab === "custom" ? "#667eea" : "transparent",
                        color: configTab === "custom" ? "white" : "#64748b",
                        cursor: "pointer",
                        borderRadius: "6px 6px 0 0",
                        transition: "all 0.15s",
                      }}
                    >
                      Custom
                    </button>
                  </div>

                  {/* Default Tab - Read-only view */}
                  {configTab === "default" && (
                    <div>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                          Connection Mode
                        </div>
                        <div style={{ color: "#64748b" }}>
                          {localOptions.connectionMode || "auto"}
                        </div>
                      </div>
                      {localOptions.autoConnectDelay !== undefined && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            Auto Connect Delay
                          </div>
                          <div style={{ color: "#64748b" }}>
                            {localOptions.autoConnectDelay}ms
                          </div>
                        </div>
                      )}
                      {localOptions.maxRetries !== undefined && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            Max Retries
                          </div>
                          <div style={{ color: "#64748b" }}>
                            {localOptions.maxRetries}
                          </div>
                        </div>
                      )}
                      {localOptions.maxRetryDelay !== undefined && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            Max Retry Delay
                          </div>
                          <div style={{ color: "#64748b" }}>
                            {localOptions.maxRetryDelay}ms
                          </div>
                        </div>
                      )}
                      {localOptions.initialRetryDelay !== undefined && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            Initial Retry Delay
                          </div>
                          <div style={{ color: "#64748b" }}>
                            {localOptions.initialRetryDelay}ms
                          </div>
                        </div>
                      )}
                      {localOptions.autoReconnect !== undefined && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            Auto Reconnect
                          </div>
                          <div style={{ color: "#64748b" }}>
                            {localOptions.autoReconnect ? "Enabled" : "Disabled"}
                          </div>
                        </div>
                      )}
                      {localOptions.headers && Object.keys(localOptions.headers).length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            Custom Headers
                          </div>
                          <div style={{ color: "#64748b" }}>
                            {Object.keys(localOptions.headers).length} header(s)
                          </div>
                        </div>
                      )}
                      {localOptions.retryDelayFn && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            Retry Delay Function
                          </div>
                          <div style={{ color: "#64748b" }}>
                            Custom function provided
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Custom Tab - Editable view */}
                  {configTab === "custom" && (
                    <div>
                      {/* Connection Mode */}
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 11 }}>
                          Connection Mode
                        </label>
                        <select
                          value={editingOptions.connectionMode || "auto"}
                          onChange={(e) => {
                            setEditingOptions({
                              ...editingOptions,
                              connectionMode: e.target.value as ConnectionMode,
                            });
                          }}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            fontSize: 11,
                            borderRadius: 6,
                            border: "1px solid #e2e8f0",
                            background: "white",
                            color: "#0f172a",
                          }}
                        >
                          <option value="auto">Auto</option>
                          <option value="manual">Manual</option>
                        </select>
                      </div>

                      {/* Auto Connect Delay */}
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 11 }}>
                          Auto Connect Delay (ms)
                        </label>
                        <input
                          type="number"
                          value={editingOptions.autoConnectDelay ?? ""}
                          onChange={(e) => {
                            setEditingOptions({
                              ...editingOptions,
                              autoConnectDelay: e.target.value ? parseInt(e.target.value, 10) : undefined,
                            });
                          }}
                          placeholder="0"
                          min="0"
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            fontSize: 11,
                            borderRadius: 6,
                            border: "1px solid #e2e8f0",
                            background: "white",
                            color: "#0f172a",
                          }}
                        />
                      </div>

                      {/* Max Retries */}
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 11 }}>
                          Max Retries
                        </label>
                        <input
                          type="number"
                          value={editingOptions.maxRetries ?? ""}
                          onChange={(e) => {
                            setEditingOptions({
                              ...editingOptions,
                              maxRetries: e.target.value ? parseInt(e.target.value, 10) : undefined,
                            });
                          }}
                          placeholder="5"
                          min="0"
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            fontSize: 11,
                            borderRadius: 6,
                            border: "1px solid #e2e8f0",
                            background: "white",
                            color: "#0f172a",
                          }}
                        />
                      </div>

                      {/* Max Retry Delay */}
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 11 }}>
                          Max Retry Delay (ms)
                        </label>
                        <input
                          type="number"
                          value={editingOptions.maxRetryDelay ?? ""}
                          onChange={(e) => {
                            setEditingOptions({
                              ...editingOptions,
                              maxRetryDelay: e.target.value ? parseInt(e.target.value, 10) : undefined,
                            });
                          }}
                          placeholder="30000"
                          min="0"
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            fontSize: 11,
                            borderRadius: 6,
                            border: "1px solid #e2e8f0",
                            background: "white",
                            color: "#0f172a",
                          }}
                        />
                      </div>

                      {/* Initial Retry Delay */}
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 11 }}>
                          Initial Retry Delay (ms)
                        </label>
                        <input
                          type="number"
                          value={editingOptions.initialRetryDelay ?? ""}
                          onChange={(e) => {
                            setEditingOptions({
                              ...editingOptions,
                              initialRetryDelay: e.target.value ? parseInt(e.target.value, 10) : undefined,
                            });
                          }}
                          placeholder="1000"
                          min="0"
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            fontSize: 11,
                            borderRadius: 6,
                            border: "1px solid #e2e8f0",
                            background: "white",
                            color: "#0f172a",
                          }}
                        />
                      </div>

                      {/* Auto Reconnect */}
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 11 }}>
                          <input
                            type="checkbox"
                            checked={editingOptions.autoReconnect ?? true}
                            onChange={(e) => {
                              setEditingOptions({
                                ...editingOptions,
                                autoReconnect: e.target.checked,
                              });
                            }}
                            style={{
                              width: 16,
                              height: 16,
                              cursor: "pointer",
                            }}
                          />
                          Auto Reconnect
                        </label>
                      </div>

                      {/* Custom Headers */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <label style={{ fontWeight: 600, fontSize: 11 }}>
                            Custom Headers
                          </label>
                          <button
                            onClick={handleAddHeader}
                            style={{
                              padding: "4px 8px",
                              fontSize: 10,
                              borderRadius: 4,
                              border: "1px solid #e2e8f0",
                              background: "#f1f5f9",
                              color: "#64748b",
                              cursor: "pointer",
                              transition: "all 0.15s",
                            }}
                          >
                            + Add Header
                          </button>
                        </div>
                        {customHeaders.map((header, index) => (
                          <div key={index} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                            <input
                              type="text"
                              value={header.key}
                              onChange={(e) => handleUpdateHeader(index, "key", e.target.value)}
                              placeholder="Header name"
                              style={{
                                flex: 1,
                                padding: "6px 8px",
                                fontSize: 11,
                                borderRadius: 6,
                                border: "1px solid #e2e8f0",
                                background: "white",
                                color: "#0f172a",
                              }}
                            />
                            <input
                              type="text"
                              value={header.value}
                              onChange={(e) => handleUpdateHeader(index, "value", e.target.value)}
                              placeholder="Header value"
                              style={{
                                flex: 1,
                                padding: "6px 8px",
                                fontSize: 11,
                                borderRadius: 6,
                                border: "1px solid #e2e8f0",
                                background: "white",
                                color: "#0f172a",
                              }}
                            />
                            <button
                              onClick={() => handleRemoveHeader(index)}
                              style={{
                                padding: "6px 10px",
                                fontSize: 11,
                                borderRadius: 6,
                                border: "1px solid #fee2e2",
                                background: "#fee2e2",
                                color: "#b91c1c",
                                cursor: "pointer",
                                transition: "all 0.15s",
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {customHeaders.length === 0 && (
                          <div style={{ color: "#94a3b8", fontSize: 10, fontStyle: "italic" }}>
                            No custom headers. Click "Add Header" to add one.
                          </div>
                        )}
                      </div>

                      {/* Retry Delay Function */}
                      {editingOptions.retryDelayFn && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 11 }}>
                            Retry Delay Function
                          </div>
                          <div style={{ color: "#64748b", fontSize: 10 }}>
                            Custom function provided (cannot be edited here)
                          </div>
                        </div>
                      )}

                      {/* Save Button */}
                      <button
                        onClick={handleSaveCustomConfig}
                        style={{
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
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#5568d3";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#667eea";
                        }}
                      >
                        Save Configuration
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Last Event Preview */}
          {showLastEvent && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  fontWeight: 700,
                  marginBottom: 8,
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "#64748b",
                }}
              >
                Last Event Payload
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  background:
                    "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                  color: "#e2e8f0",
                  borderRadius: 12,
                  maxHeight: 200,
                  overflow: "auto",
                  fontSize: 11,
                  lineHeight: 1.6,
                  border: "1px solid #334155",
                  boxShadow: "inset 0 2px 8px rgba(0, 0, 0, 0.3)",
                }}
              >
                {lastEventPreview}
              </pre>
            </div>
          )}

          {/* CSS Animation for pulse */}
          <style>
            {`
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
            `}
          </style>

          {/* Close Button at Bottom */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
            <button
              onClick={() => setIsOpen(false)}
              style={{
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
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#e2e8f0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#f1f5f9";
              }}
              title="Close Devtools"
            >
              Close Devtools
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SSEDevtools;
