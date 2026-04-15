import React from 'react';
import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import type { SSEOptions, SSEReturn } from './types';
import { useSSEAdaptive } from './useSSEAdaptive';

type SSEContextValue = SSEReturn<any, string>;

const SSEContext = createContext<SSEContextValue | null>(null);

export interface SSEProviderProps {
  /**
   * SSE endpoint URL. If null, the provider stays disconnected.
   */
  url: string | null;

  /**
   * Same options used by useSSE / useSSEWithSharedWorker.
   */
  options?: SSEOptions;

  /**
   * SharedWorker script path used when SharedWorker is supported.
   * Falls back automatically to regular SSE when SharedWorker is not supported.
   * @default '/shared-worker.js'
   */
  workerPath?: string;

  /**
   * Provider children.
   */
  children: ReactNode;
}

/**
 * Global SSE provider that uses SharedWorker when available and falls back
 * to regular SSE when SharedWorker is not supported.
 */
export function SSEProvider<T = any, K extends string = string>({
  url,
  options = {},
  workerPath = '/shared-worker.js',
  children,
}: SSEProviderProps): JSX.Element {
  const sseState = useSSEAdaptive<T, K>(url, options, workerPath);

  const value = useMemo(
    () => sseState as unknown as SSEContextValue,
    [sseState]
  );

  return <SSEContext.Provider value={value}>{children}</SSEContext.Provider>;
}

/**
 * Use global SSE state from SSEProvider.
 *
 * Throws when used outside of SSEProvider.
 */
export function useSSEContext<T = any, K extends string = string>(): SSEReturn<T, K> {
  const context = useContext(SSEContext);

  if (!context) {
    throw new Error(
      'useSSEContext must be used inside SSEProvider. Wrap your app (or subtree) with <SSEProvider />.'
    );
  }

  return context as unknown as SSEReturn<T, K>;
}

/**
 * Optional variant that returns null when provider does not exist.
 * Useful for components that can work with or without a provider.
 */
export function useOptionalSSEContext<T = any, K extends string = string>(): SSEReturn<T, K> | null {
  const context = useContext(SSEContext);
  return (context as unknown as SSEReturn<T, K>) ?? null;
}
