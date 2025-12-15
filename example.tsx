/**
 * React SSE Package Usage Examples
 * 
 * This file is for demonstration purposes only and is not included in the final build
 */

import React from 'react';
import { useSSE, useSSEWithSharedWorker } from './src';

// Example 1: Simple Usage
function SimpleExample() {
  const { status, lastEvent, events } = useSSE('/api/events');

  return (
    <div>
      <p>Status: {status}</p>
      <p>Event count: {events.length}</p>
      {lastEvent && <pre>{JSON.stringify(lastEvent.data, null, 2)}</pre>}
    </div>
  );
}

// Example 2: With Token and Type Safety
interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: number;
}

function AuthenticatedExample() {
  const token = localStorage.getItem('authToken') || undefined;

  const { status, lastEvent, events, error, retryCount } = useSSE<Notification>(
    '/api/notifications',
    {
      token,
      maxRetries: 5,
      maxRetryDelay: 30000,
      initialRetryDelay: 1000,
    }
  );

  if (status === 'connecting') {
    return <div>Connecting...</div>;
  }

  if (error) {
    return (
      <div>
        <p>Error: {error.message}</p>
        <p>Retry count: {retryCount}</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Notifications</h2>
      {events.map((event, index) => (
        <div key={index}>
          <h3>{event.data.title}</h3>
          <p>{event.data.message}</p>
          <small>{new Date(event.data.timestamp).toLocaleString()}</small>
        </div>
      ))}
    </div>
  );
}

// Example 3: Manual Connection Control
function ControlledExample() {
  const { status, close, reconnect } = useSSE('/api/events', {
    token: 'your-token',
    autoReconnect: false,
  });

  return (
    <div>
      <p>Status: {status}</p>
      <button onClick={close}>Disconnect</button>
      <button onClick={reconnect}>Reconnect</button>
    </div>
  );
}

// Example 4: With Custom Retry Logic
function CustomRetryExample() {
  const { status, retryCount } = useSSE('/api/events', {
    token: 'your-token',
    maxRetries: 10,
    maxRetryDelay: 60000,
    retryDelayFn: (attempt) => {
      // Linear backoff: 2s, 4s, 6s, ...
      return attempt * 2000;
    },
  });

  return (
    <div>
      <p>Status: {status}</p>
      <p>Retry count: {retryCount}</p>
    </div>
  );
}

// Example 5: Using Shared Worker (one connection for all tabs)
function SharedWorkerExample() {
  const { status, lastEvent, events, error } = useSSEWithSharedWorker(
    '/api/events',
    {
      token: localStorage.getItem('token') || undefined,
      maxRetries: 5,
      maxRetryDelay: 30000,
    },
    '/shared-worker.js'
  );

  return (
    <div>
      <h2>Shared Worker Example</h2>
      <p>Status: {status}</p>
      <p>Event count: {events.length}</p>
      {error && <p>Error: {error.message}</p>}
      {lastEvent && (
        <div>
          <h3>Last event:</h3>
          <pre>{JSON.stringify(lastEvent.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// Example 6: Using Shared Worker in multiple tabs (all have the same data)
interface StockPrice {
  symbol: string;
  price: number;
  change: number;
}

function StockTrackerTab1() {
  const { events } = useSSEWithSharedWorker<StockPrice>(
    '/api/stock-prices',
    {
      token: 'your-token',
    },
    '/shared-worker.js'
  );

  return (
    <div>
      <h2>Tab 1 - Stock Tracker</h2>
      {events.map((event, index) => (
        <div key={index}>
          <h3>{event.data.symbol}</h3>
          <p>Price: ${event.data.price}</p>
          <p>Change: {event.data.change}%</p>
        </div>
      ))}
    </div>
  );
}

function StockTrackerTab2() {
  // This tab receives the same data as Tab 1!
  const { events } = useSSEWithSharedWorker<StockPrice>(
    '/api/stock-prices',
    {
      token: 'your-token',
    },
    '/shared-worker.js'
  );

  return (
    <div>
      <h2>Tab 2 - Stock Tracker (Same Data!)</h2>
      {events.map((event, index) => (
        <div key={index}>
          <h3>{event.data.symbol}</h3>
          <p>Price: ${event.data.price}</p>
          <p>Change: {event.data.change}%</p>
        </div>
      ))}
    </div>
  );
}

export {
  SimpleExample,
  AuthenticatedExample,
  ControlledExample,
  CustomRetryExample,
  SharedWorkerExample,
  StockTrackerTab1,
  StockTrackerTab2,
};
