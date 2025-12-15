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
npm install @react-tools/react-sse
# or
yarn add @react-tools/react-sse
# or
pnpm install @react-tools/react-sse
```

## Usage

### Simple Example

```tsx
import { useSSE } from '@react-tools/react-sse';

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
import { useSSE } from '@react-tools/react-sse';

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
import { useSSE } from '@react-tools/react-sse';

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

### Manual Connection Control

```tsx
import { useSSE } from '@react-tools/react-sse';

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
import { useSSE } from '@react-tools/react-sse';

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
import { useSSE } from '@react-tools/react-sse';

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
          join(__dirname, 'node_modules/@react-tools/react-sse/dist/shared-worker.js'),
          join(__dirname, 'public/shared-worker.js')
        );
      },
    },
  ],
});
```

**For Create React App:**
Copy the `dist/shared-worker.js` file to the `public` folder.

**For Webpack:**
```js
// webpack.config.js
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'node_modules/@react-tools/react-sse/dist/shared-worker.js',
          to: 'shared-worker.js',
        },
      ],
    }),
  ],
};
```

### Example using Shared Worker

```tsx
import { useSSEWithSharedWorker } from '@react-tools/react-sse';

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
import { useSSEWithSharedWorker } from '@react-tools/react-sse';

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

## API Reference

### `useSSE<T>(url, options?)`

A React Hook for connecting to an SSE endpoint (each component has a separate connection).

### `useSSEWithSharedWorker<T>(url, options?, workerPath?)`

A React Hook for connecting to an SSE endpoint using Shared Worker (one connection for all tabs).

#### Parameters

- `url: string | null` - URL endpoint for SSE
- `options?: SSEOptions` - Configuration options
- `workerPath?: string` - Path to Shared Worker file (default: '/shared-worker.js')

#### Returns

Same `SSEReturn<T>` as used in `useSSE`.

#### Parameters

- `url: string | null` - URL endpoint for SSE
- `options?: SSEOptions` - Configuration options

#### Returns

```typescript
{
  status: SSEStatus;           // Connection status
  lastEvent: SSEEvent<T> | null; // Last received event
  events: SSEEvent<T>[];       // All received events
  error: Error | null;         // Error (if any)
  close: () => void;           // Close connection
  reconnect: () => void;       // Reconnect
  retryCount: number;          // Retry attempt count
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

### `SSEEvent<T>`

```typescript
interface SSEEvent<T> {
  type: string;        // Event type
  data: T;            // Event data
  id?: string;        // Event ID (from server)
  timestamp: number;  // Receive timestamp
}
```

## Advanced Examples

### State Management with SSE

```tsx
import { useEffect } from 'react';
import { useSSE } from '@react-tools/react-sse';

interface UserStatus {
  userId: string;
  online: boolean;
}

function UserStatusComponent() {
  const [users, setUsers] = useState<Map<string, boolean>>(new Map());
  
  const { lastEvent } = useSSE<UserStatus>('/api/user-status', {
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
import { useSSE } from '@react-tools/react-sse';

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
