import React, { useEffect, useMemo, useState } from "react";
import type { SSEReturn } from "./types";

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

type Props<T = any> = {
  /**
   * The object returned by useSSE / useSSEWithSharedWorker
   */
  state: SSEReturn<T>;
  /**
   * Panel title
   * @default "SSE Devtools"
   */
  title?: string;
  /**
   * Memory sampling interval (ms)
   * @default 2000
   */
  sampleInterval?: number;
  /**
   * Show the last event payload (stringified)
   * @default true
   */
  showLastEvent?: boolean;
};

const boxStyle: React.CSSProperties = {
  fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif",
  fontSize: 13,
  lineHeight: 1.45,
  color: "#0f172a",
  background: "#f8fafc",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: 12,
  minWidth: 280,
  maxWidth: 420,
  boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  marginBottom: 6,
};

const badgeStyle = (color: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 999,
  background: color,
  color: "#0b0f19",
  fontWeight: 600,
  fontSize: 12,
});

export function SSEDevtools<T = any>({
  state,
  title = "SSE Devtools",
  sampleInterval = 2000,
  showLastEvent = true,
}: Props<T>) {
  const { status, events, lastEvent, retryCount, error } = state;

  const [memory, setMemory] = useState<MemorySample | null>(null);
  const [eventLoopLag, setEventLoopLag] = useState<number>(0);

  // Sample memory + event-loop lag (approx CPU pressure indicator)
  useEffect(() => {
    const updateMemory = () => {
      // Chrome-only memory API
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
      // Expected 1000ms -> lag = overrun
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
        return "#bbf7d0"; // green-200
      case "connecting":
        return "#fef08a"; // yellow-200
      case "error":
        return "#fecdd3"; // rose-200
      case "disconnected":
        return "#e2e8f0"; // slate-200
      case "closed":
      default:
        return "#cbd5e1"; // slate-300
    }
  }, [status]);

  return (
    <div style={boxStyle}>
      <div style={{ ...rowStyle, marginBottom: 10 }}>
        <strong>{title}</strong>
        <span style={badgeStyle(statusColor)}>{status.toUpperCase()}</span>
      </div>

      <div style={rowStyle}>
        <span>Events</span>
        <strong>{events.length}</strong>
      </div>

      <div style={rowStyle}>
        <span>Retries</span>
        <strong>{retryCount}</strong>
      </div>

      <div style={rowStyle}>
        <span>Last event time</span>
        <strong>
          {lastEvent ? new Date(lastEvent.timestamp).toLocaleTimeString() : "—"}
        </strong>
      </div>

      <div style={rowStyle}>
        <span>Event loop lag (ms)</span>
        <strong>{eventLoopLag}</strong>
      </div>

      <div style={rowStyle}>
        <span>CPU (logical cores)</span>
        <strong>{navigator.hardwareConcurrency || "n/a"}</strong>
      </div>

      <div style={{ ...rowStyle, alignItems: "baseline" }}>
        <span>Memory</span>
        <div style={{ textAlign: "right" }}>
          <div>{memory ? `${memory.usedMB}/${memory.totalMB} MB` : "n/a"}</div>
          {memory ? (
            <small style={{ color: "#475569" }}>
              Limit: {memory.limitMB} MB
            </small>
          ) : null}
        </div>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 10,
            padding: 8,
            borderRadius: 6,
            background: "#fee2e2",
            color: "#991b1b",
            fontSize: 12,
          }}
        >
          <strong>Error:</strong> {error.message}
        </div>
      ) : null}

      {showLastEvent && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Last event</div>
          <pre
            style={{
              margin: 0,
              padding: 8,
              background: "#0f172a",
              color: "#e2e8f0",
              borderRadius: 6,
              maxHeight: 160,
              overflow: "auto",
              fontSize: 12,
            }}
          >
            {lastEventPreview}
          </pre>
        </div>
      )}
    </div>
  );
}

export default SSEDevtools;
