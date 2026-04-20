import type { SSEEvent, SSEStatus, SSEOptions } from './types';

/**
 * Messages sent from main thread to Shared Worker
 */
export type WorkerMessage =
  | { type: 'CONNECT'; payload: { url: string; options: SSEOptions } }
  | { type: 'DISCONNECT' }
  | { type: 'RECONNECT' }
  | { type: 'SUBSCRIBE'; payload: { clientId: string } }
  | { type: 'UNSUBSCRIBE'; payload: { clientId: string } };

/**
 * Messages sent from Shared Worker to main thread
 */
export type WorkerResponse =
  | { type: 'STATUS'; payload: { status: SSEStatus } }
  | { type: 'EVENT'; payload: { event: SSEEvent } }
  | { type: 'ERROR'; payload: { error: { message: string; name: string } } }
  | { type: 'RETRY_COUNT'; payload: { count: number } }
  | { type: 'CONNECTED'; payload: { url: string } }
  | { type: 'DISCONNECTED' };

/**
 * Client information stored in Shared Worker
 */
export interface ClientInfo {
  id: string;
  port: MessagePort;
  subscribed: boolean;
}

