# React SSE Hook

A TypeScript package for using Server-Sent Events (SSE) in React with full support for authentication tokens, retry logic, and type safety.

## Features

- ✅ **Type-Safe**: Fully written in TypeScript
- ✅ **Token Authentication**: Bearer token support
- ✅ **Retry Logic**: Retry with exponential backoff and max retry delay
- ✅ **Customizable**: Configurable for different needs
- ✅ **React Hook**: Easy to use with React Hooks
- ✅ **Shared Worker Support**: Shared Worker support for sharing a single connection across all tabs

## Installation

```bash
npm install sse-shared-worker-react-hook
# or
yarn add sse-shared-worker-react-hook
# or
pnpm install sse-shared-worker-react-hook
```

## Usage

### Simple Example

```tsx
import { useSSE } from 'sse-shared-worker-react-hook';

function MyComponent() {
  const { status, lastEvent, events, error } = useSSE('/api/events');

  if (status === 'connecting') {
    return <div>Connecting...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div>
      <p>Status: {status}</p>
      <p>Event count: {events.length}</p>
      {lastEvent && (
        <div>
          <h3>Last event:</h3>
          <pre>{JSON.stringify(lastEvent.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
```

### With Token Authentication

```tsx
import { useSSE } from 'sse-shared-worker-react-hook';

function AuthenticatedComponent() {
  const token = 'your-auth-token';
  
  const { status, lastEvent, events, error } = useSSE('/api/events', {
    token,
    maxRetries: 5,
    maxRetryDelay: 30000, // 30 seconds
    initialRetryDelay: 1000, // 1 second
  });

  return (
    <div>
      {/* ... */}
    </div>
  );
}
```

### With Type Safety

```tsx
import { useSSE } from 'sse-shared-worker-react-hook';

interface NotificationData {
  id: string;
  message: string;
  timestamp: number;
}

function TypedComponent() {
  const { lastEvent, events } = useSSE<NotificationData>('/api/notifications', {
    token: 'your-token',
  });

  // lastEvent.data is now typed as NotificationData
  return (
    <div>
      {events.map((event, index) => (
        <div key={index}>
          <p>{event.data.message}</p>
          <small>{new Date(event.data.timestamp).toLocaleString()}</small>
        </div>
      ))}
    </div>
  );
}
```

### With Type-Safe Event Types

```tsx
import { useSSE } from 'sse-shared-worker-react-hook';

interface MessageData {
  text: string;
  userId: string;
}

interface ErrorData {
  code: string;
  message: string;
}

// Define allowed event types
type EventTypes = 'message' | 'error' | 'update';

function TypedEventComponent() {
  const { lastEvent, events } = useSSE<MessageData | ErrorData, EventTypes>(
    '/api/events',
    {
      token: 'your-token',
    }
  );

  // lastEvent.type is now typed as EventTypes
  // TypeScript will enforce that only 'message' | 'error' | 'update' are valid
  return (
    <div>
      {events.map((event, index) => {
        if (event.type === 'message') {
          // TypeScript knows event.data is MessageData here
          return <div key={index}>{event.data.text}</div>;
        } else if (event.type === 'error') {
          // TypeScript knows event.data is ErrorData here
          return <div key={index}>Error: {event.data.message}</div>;
        }
        return null;
      })}
    </div>
  );
}
```

### Manual Connection Control

```tsx
import { useSSE } from 'sse-shared-worker-react-hook';

function ControlledComponent() {
  const { status, close, reconnect } = useSSE('/api/events', {
    token: 'your-token',
    autoReconnect: false, // Disable automatic reconnect
  });

  return (
    <div>
      <p>Status: {status}</p>
      <button onClick={close}>Disconnect</button>
      <button onClick={reconnect}>Reconnect</button>
    </div>
  );
}
```

### With Custom Headers

```tsx
import { useSSE } from 'sse-shared-worker-react-hook';

function CustomHeadersComponent() {
  const { status, lastEvent } = useSSE('/api/events', {
    token: 'your-token',
    headers: {
      'X-Custom-Header': 'custom-value',
      'X-Client-Version': '1.0.0',
    },
  });

  return <div>{/* ... */}</div>;
}
```

### With Custom Retry Delay Function

```tsx
import { useSSE } from 'sse-shared-worker-react-hook';

function CustomRetryComponent() {
  const { status, retryCount } = useSSE('/api/events', {
    token: 'your-token',
    maxRetries: 10,
    maxRetryDelay: 60000, // 60 seconds
    retryDelayFn: (attempt) => {
      // Custom logic: linear backoff
      return attempt * 2000; // 2s, 4s, 6s, ...
    },
  });

  return (
    <div>
      <p>Status: {status}</p>
      <p>Retry count: {retryCount}</p>
    </div>
  );
}
```

## Using with Shared Worker

**Benefits of using Shared Worker:**
- ✅ Only **one SSE connection** in the entire system (not for each tab)
- ✅ Data is shared between **all tabs and windows**
- ✅ Reduced resource consumption and bandwidth
- ✅ Automatic synchronization between tabs

### Setting up Shared Worker

First, you need to place the Shared Worker file in your project:

**For Vite:**
```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'fs';
import { join } from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-shared-worker',
      buildStart() {
        copyFileSync(
          join(__dirname, 'node_modules/sse-shared-worker-react-hook/public/shared-worker.js'),
          join(__dirname, 'public/shared-worker.js')
        );
      },
    },
  ],
});
```

**For Create React App:**
Copy the Shared Worker file from the package to your `public` folder:
```bash
cp node_modules/sse-shared-worker-react-hook/public/shared-worker.js public/shared-worker.js
```

**For Webpack:**
```js
// webpack.config.js
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'node_modules/sse-shared-worker-react-hook/public/shared-worker.js',
          to: 'shared-worker.js',
        },
      ],
    }),
  ],
};
```

### Browser support and fallback (SSE without Shared Worker)

Shared Worker is **not** supported in:
- Internet Explorer (all versions)
- Safari iOS 7–15.8
- Some private or embedded browser contexts
- Non-HTTPS in some browsers

You can check support at runtime:

```tsx
import { isSharedWorkerSupported } from 'sse-shared-worker-react-hook';

if (isSharedWorkerSupported()) {
  // Use useSSEWithSharedWorker for shared connection across tabs
} else {
  // Use useSSE for single-tab SSE (still works)
}
```

To use Shared Worker when available and fall back to normal SSE otherwise (one hook, same API):

```tsx
import { useSSEAdaptive } from 'sse-shared-worker-react-hook';

function AdaptiveComponent() {
  const { status, lastEvent, events, error } = useSSEAdaptive(
    '/api/events',
    { token: 'your-token' },
    '/shared-worker.js'
  );
  // Same API as useSSE / useSSEWithSharedWorker — SSE works in both cases
  return (
    <div>
      <p>Status: {status}</p>
      {lastEvent && <pre>{JSON.stringify(lastEvent.data, null, 2)}</pre>}
    </div>
  );
}
```

### Example using Shared Worker

```tsx
import { useSSEWithSharedWorker } from 'sse-shared-worker-react-hook';

function SharedWorkerComponent() {
  const { status, lastEvent, events, error } = useSSEWithSharedWorker(
    '/api/events',
    {
      token: 'your-auth-token',
      maxRetries: 5,
      maxRetryDelay: 30000,
    },
    '/shared-worker.js' // Path to Shared Worker file
  );

  return (
    <div>
      <p>Status: {status}</p>
      <p>Event count: {events.length}</p>
      {lastEvent && (
        <div>
          <h3>Last event:</h3>
          <pre>{JSON.stringify(lastEvent.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
```

### Example: Using in Multiple Tabs

```tsx
// Tab 1, Tab 2, Tab 3 - All use the same connection!

// Tab 1
function Tab1Component() {
  const { events } = useSSEWithSharedWorker('/api/notifications', {
    token: localStorage.getItem('token'),
  });

  return (
    <div>
      <h2>Tab 1</h2>
      {events.map((e, i) => (
        <div key={i}>{e.data.message}</div>
      ))}
    </div>
  );
}

// Tab 2 - Receives the same data!
function Tab2Component() {
  const { events } = useSSEWithSharedWorker('/api/notifications', {
    token: localStorage.getItem('token'),
  });

  return (
    <div>
      <h2>Tab 2</h2>
      {events.map((e, i) => (
        <div key={i}>{e.data.message}</div>
      ))}
    </div>
  );
}
```

### Type Safety with Shared Worker

```tsx
import { useSSEWithSharedWorker } from 'sse-shared-worker-react-hook';

interface StockPrice {
  symbol: string;
  price: number;
  change: number;
}

function StockTracker() {
  const { lastEvent, events } = useSSEWithSharedWorker<StockPrice>(
    '/api/stock-prices',
    {
      token: 'your-token',
    }
  );

  // lastEvent.data is typed as StockPrice
  return (
    <div>
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
```

### Type-Safe Event Types with Shared Worker

```tsx
import { useSSEWithSharedWorker } from 'sse-shared-worker-react-hook';

interface NotificationData {
  title: string;
  body: string;
}

type NotificationEventTypes = 'notification' | 'alert' | 'system';

function NotificationComponent() {
  const { lastEvent, events } = useSSEWithSharedWorker<
    NotificationData,
    NotificationEventTypes
  >('/api/notifications', {
    token: 'your-token',
  });

  // event.type is now typed as NotificationEventTypes
  return (
    <div>
      {events.map((event, index) => (
        <div key={index}>
          <h4>Type: {event.type}</h4>
          <p>{event.data.title}</p>
          <p>{event.data.body}</p>
        </div>
      ))}
    </div>
  );
}
```

## API Reference

### `useSSE<T, K>(url, options?)`

A React Hook for connecting to an SSE endpoint (each component has a separate connection).

#### Generic Parameters

- `T` - Type of the event data (default: `any`)
- `K` - Type of the event type (default: `string`)

#### Parameters

- `url: string | null` - URL endpoint for SSE
- `options?: SSEOptions` - Configuration options

#### Returns

`SSEReturn<T, K>` - See below for details.

### `useSSEWithSharedWorker<T, K>(url, options?, workerPath?)`

A React Hook for connecting to an SSE endpoint using Shared Worker (one connection for all tabs).

#### Generic Parameters

- `T` - Type of the event data (default: `any`)
- `K` - Type of the event type (default: `string`)

#### Parameters

- `url: string | null` - URL endpoint for SSE
- `options?: SSEOptions` - Configuration options
- `workerPath?: string` - Path to Shared Worker file (default: '/shared-worker.js')

#### Returns

`SSEReturn<T, K>` - See below for details.

### `useSSEAdaptive<T, K>(url, options?, workerPath?)`

A React Hook that uses Shared Worker when supported and falls back to normal SSE otherwise. Same API as `useSSE` / `useSSEWithSharedWorker`.

#### Generic Parameters

- `T` - Type of the event data (default: `any`)
- `K` - Type of the event type (default: `string`)

#### Parameters

- `url: string | null` - URL endpoint for SSE
- `options?: SSEOptions` - Configuration options
- `workerPath?: string` - Path to Shared Worker file (default: '/shared-worker.js')

#### Returns

`SSEReturn<T, K>` - See below for details.

### `isSharedWorkerSupported(): boolean`

Returns `true` if the environment supports Shared Worker (browser, `window.SharedWorker` defined). Use this to branch logic or to decide whether to use `useSSEWithSharedWorker` vs `useSSE`. For a single hook that auto-fallbacks, use `useSSEAdaptive`.

### `SSEReturn<T, K>`

```typescript
interface SSEReturn<T, K extends string = string> {
  status: SSEStatus;                    // Connection status
  lastEvent: SSEEvent<T, K> | null;      // Last received event
  events: SSEEvent<T, K>[];              // All received events
  error: Error | null;                   // Error (if any)
  close: () => void;                     // Close connection
  reconnect: () => void;                 // Reconnect
  retryCount: number;                    // Retry attempt count
}
```

### `SSEOptions`

```typescript
interface SSEOptions {
  token?: string;                    // Bearer token for authentication
  maxRetryDelay?: number;            // Maximum retry delay (ms) - default: 30000
  initialRetryDelay?: number;        // Initial retry delay (ms) - default: 1000
  maxRetries?: number;               // Maximum retry count - default: 5
  headers?: Record<string, string>;  // Additional headers
  autoReconnect?: boolean;           // Auto reconnect - default: true
  retryDelayFn?: (attempt: number) => number; // Retry delay calculation function
}
```

### `SSEStatus`

```typescript
type SSEStatus = 
  | 'connecting'    // Connecting
  | 'connected'     // Connected
  | 'disconnected'  // Disconnected
  | 'error'         // Error
  | 'closed';       // Closed
```

### `SSEEvent<T, K>`

```typescript
interface SSEEvent<T = any, K extends string = string> {
  type: K;            // Event type (type-safe with generic K)
  data: T;            // Event data (type-safe with generic T)
  id?: string;        // Event ID (from server)
  timestamp: number;  // Receive timestamp
}
```

**Example:**
```typescript
// Without generics (defaults to any, string)
const event: SSEEvent = {
  type: 'message',
  data: { text: 'Hello' },
  timestamp: Date.now()
};

// With data type only
const typedEvent: SSEEvent<{ text: string }> = {
  type: 'message',
  data: { text: 'Hello' },
  timestamp: Date.now()
};

// With both data and event type
type EventTypes = 'message' | 'error' | 'update';
const fullyTypedEvent: SSEEvent<{ text: string }, EventTypes> = {
  type: 'message', // TypeScript enforces: must be 'message' | 'error' | 'update'
  data: { text: 'Hello' },
  timestamp: Date.now()
};
```

## Advanced Examples

### State Management with SSE

```tsx
import { useEffect } from 'react';
import { useSSE } from 'sse-shared-worker-react-hook';

interface UserStatus {
  userId: string;
  online: boolean;
}

function UserStatusComponent() {
  const [users, setUsers] = useState<Map<string, boolean>>(new Map());
  
  const { lastEvent } = useSSE<UserStatus, 'user-status'>('/api/user-status', {
    token: localStorage.getItem('token') || undefined,
  });

  useEffect(() => {
    if (lastEvent) {
      setUsers((prev) => {
        const next = new Map(prev);
        next.set(lastEvent.data.userId, lastEvent.data.online);
        return next;
      });
    }
  }, [lastEvent]);

  return (
    <div>
      {Array.from(users.entries()).map(([userId, online]) => (
        <div key={userId}>
          User {userId}: {online ? 'Online' : 'Offline'}
        </div>
      ))}
    </div>
  );
}
```

### Error Handling

```tsx
import { useSSE } from 'sse-shared-worker-react-hook';

function ErrorHandlingComponent() {
  const { status, error, retryCount, reconnect } = useSSE('/api/events', {
    token: 'your-token',
    maxRetries: 3,
  });

  if (status === 'error' && retryCount >= 3) {
    return (
      <div>
        <p>Connection failed. Please try again.</p>
        <button onClick={reconnect}>Retry</button>
      </div>
    );
  }

  return <div>{/* ... */}</div>;
}
```

## Important Notes

1. **Token Authentication**: When using `token`, the package uses the `fetch` API (because `EventSource` doesn't support custom headers).

2. **Retry Logic**: Retry is performed with exponential backoff. You can define your own logic with `retryDelayFn`.

3. **Memory Management**: Events are stored in the `events` array. To prevent excessive memory usage, you can periodically clear the array. The package automatically limits events to 100 items.

4. **Cleanup**: The connection is automatically closed when the component unmounts.

5. **Shared Worker**: 
   - To use `useSSEWithSharedWorker`, you must place the Shared Worker file in the `public` folder
   - Shared Worker creates only one SSE connection and shares data across all tabs
   - When the last tab is closed, the Shared Worker is automatically closed
   - Received data is stored in the Shared Worker and sent to new tabs that connect

## License

MIT
