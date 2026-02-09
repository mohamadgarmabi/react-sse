# Shared Worker Setup Guide

This guide shows how to use Shared Worker in different projects.

## Building the Shared Worker File (package maintainers)

After building the package, the worker is emitted to `dist/shared-worker.js` and then copied to `public/shared-worker.js`. Both are published in the npm package.

## Consuming the package (your app)

Copy the Shared Worker from the installed package into your app’s `public` (or equivalent) folder so it is served at `/shared-worker.js`. The hook defaults to `workerPath: '/shared-worker.js'`.

**Correct paths in the published package:**
- `node_modules/sse-shared-worker-react-hook/public/shared-worker.js`
- `node_modules/sse-shared-worker-react-hook/dist/shared-worker.js`

## Vite

### Method 1: Manual copy

```bash
cp node_modules/sse-shared-worker-react-hook/public/shared-worker.js public/shared-worker.js
```

### Method 2: Using plugin

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
        const workerPath = join(
          __dirname,
          'node_modules/sse-shared-worker-react-hook/public/shared-worker.js'
        );
        const publicPath = join(__dirname, 'public/shared-worker.js');
        copyFileSync(workerPath, publicPath);
      },
    },
  ],
});
```

## Create React App

```bash
cp node_modules/sse-shared-worker-react-hook/public/shared-worker.js public/shared-worker.js
```

## Next.js

### Method 1: Using the `public` folder

```bash
cp node_modules/sse-shared-worker-react-hook/public/shared-worker.js public/shared-worker.js
```

### Method 2: Using API route (for SSR)

```ts
// pages/api/shared-worker.js
import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(req, res) {
  const workerPath = join(
    process.cwd(),
    'node_modules/sse-shared-worker-react-hook/public/shared-worker.js'
  );
  const workerCode = readFileSync(workerPath, 'utf8');
  
  res.setHeader('Content-Type', 'application/javascript');
  res.send(workerCode);
}
```

Then in your component:

```tsx
const { status, events } = useSSEWithSharedWorker(
  '/api/events',
  { token: 'your-token' },
  '/api/shared-worker' // Using API route
);
```

## Webpack

```js
// webpack.config.js
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

module.exports = {
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(
            __dirname,
            'node_modules/sse-shared-worker-react-hook/public/shared-worker.js'
          ),
          to: path.resolve(__dirname, 'public/shared-worker.js'),
        },
      ],
    }),
  ],
};
```

## Usage in Component

```tsx
import { useSSEWithSharedWorker } from 'sse-shared-worker-react-hook';

function MyComponent() {
  const { status, lastEvent, events } = useSSEWithSharedWorker(
    '/api/events',
    {
      token: localStorage.getItem('token'),
      maxRetries: 5,
      maxRetryDelay: 30000,
    },
    '/shared-worker.js' // Path to Shared Worker file
  );

  return (
    <div>
      <p>Status: {status}</p>
      <p>Event count: {events.length}</p>
    </div>
  );
}
```

## Important Notes

1. **File Path**: The Shared Worker file path must be accessible from the site root (e.g., `/shared-worker.js`)

2. **HTTPS**: Shared Worker requires HTTPS in production (or localhost)

3. **Browser Support**: Shared Worker is supported in all modern browsers

4. **Debugging**: You can view the Shared Worker in Chrome DevTools > Application > Shared Workers
