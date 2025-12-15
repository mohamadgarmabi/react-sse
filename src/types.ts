/**
 * Configuration options for SSE connection
 */
export interface SSEOptions {
  /**
   * Authentication token to be sent in the Authorization header
   */
  token?: string;
  
  /**
   * Maximum delay between retry attempts in milliseconds
   * @default 30000 (30 seconds)
   */
  maxRetryDelay?: number;
  
  /**
   * Initial delay before first retry in milliseconds
   * @default 1000 (1 second)
   */
  initialRetryDelay?: number;
  
  /**
   * Maximum number of retry attempts
   * @default 5
   */
  maxRetries?: number;
  
  /**
   * Additional headers to send with the request
   */
  headers?: Record<string, string>;
  
  /**
   * Whether to automatically reconnect on connection loss
   * @default true
   */
  autoReconnect?: boolean;
  
  /**
   * Custom retry delay calculation function
   * Receives the current attempt number and returns delay in milliseconds
   */
  retryDelayFn?: (attempt: number) => number;
}

/**
 * Status of the SSE connection
 */
export type SSEStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'closed';

/**
 * SSE event data
 */
export interface SSEEvent<T = any> {
  /**
   * Event type (default: 'message')
   */
  type: string;
  
  /**
   * Event data
   */
  data: T;
  
  /**
   * Event ID (if provided by server)
   */
  id?: string;
  
  /**
   * Event timestamp
   */
  timestamp: number;
}

/**
 * Return type of the useSSE hook
 */
export interface SSEReturn<T = any> {
  /**
   * Current connection status
   */
  status: SSEStatus;
  
  /**
   * Last received event
   */
  lastEvent: SSEEvent<T> | null;
  
  /**
   * All received events
   */
  events: SSEEvent<T>[];
  
  /**
   * Error object if connection failed
   */
  error: Error | null;
  
  /**
   * Manually close the connection
   */
  close: () => void;
  
  /**
   * Manually reconnect the connection
   */
  reconnect: () => void;
  
  /**
   * Current retry attempt number
   */
  retryCount: number;
}

