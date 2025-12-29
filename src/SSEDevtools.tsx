import React, { useEffect, useMemo, useState } from "react";
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
  } = state;

  const [isOpen, setIsOpen] = useState(false);
  const [memory, setMemory] = useState<MemorySample | null>(null);
  const [eventLoopLag, setEventLoopLag] = useState<number>(0);
  const [isHovering, setIsHovering] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [localOptions, setLocalOptions] = useState<SSEOptions>(options || {});

  // Update local options when props change
  useEffect(() => {
    if (options) {
      setLocalOptions(options);
    }
  }, [options]);

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

  const handleRetry = () => {
    connect();
  };

  const handleOptionsUpdate = (updatedOptions: SSEOptions) => {
    setLocalOptions(updatedOptions);
    if (onOptionsChange) {
      onOptionsChange(updatedOptions);
    }
  };

  if (!visible) return null;

  const positionStyles = getPositionStyles(position, isOpen);

  // Action buttons (vertical group, improved style)
  function ActionButtons() {
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
              textAlign: "center"
            }}
            onClick={close}
            onMouseEnter={e => { e.currentTarget.style.background = "#fecaca"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#fee2e2"; }}
            title="Close connection"
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
              textAlign: "center"
            }}
            onClick={reconnect}
            onMouseEnter={e => { e.currentTarget.style.background = "#e9d5ff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#f3e8ff"; }}
            title="Reconnect"
          >
            Reconnect
          </button>
          <span style={{ fontSize: 12, color: "#64748b" }}>New connection</span>
        </div>
        {(error || status === "disconnected" || status === "closed") && (
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
                textAlign: "center"
              }}
              onClick={handleRetry}
              onMouseEnter={e => { e.currentTarget.style.background = "#fef3c7"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#fef9c3"; }}
              title="Connect / Retry"
            >
              {error ? "Retry" : "Connect"}
            </button>
            <span style={{ fontSize: 12, color: "#64748b" }}>{error ? "Try again" : "Start connection"}</span>
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
        <div style={panelStyle}>
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
          {error && (
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
              <div style={{ marginBottom: 8 }}>{error.message}</div>
              {error.name && (
                <div style={{ fontSize: 10, opacity: 0.8, marginBottom: 8 }}>
                  Type: {error.name}
                </div>
              )}
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
                }}
                onClick={handleRetry}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#fef3c7";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#fef9c3";
                }}
                title="Retry connection"
              >
                🔄 Retry Connection
              </button>
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
        </div>
      )}
    </div>
  );
}

export default SSEDevtools;
