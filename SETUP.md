# Shared Worker Setup Guide

This guide shows how to use Shared Worker in different projects.

## Building the Shared Worker File

After building the package, place the `dist/shared-worker.js` file in your project's `public` folder.

```bash
npm run build
cp dist/shared-worker.js public/shared-worker.js
```

## Vite

### Method 1: Manual Copy

Copy the `dist/shared-worker.js` file to the `public` folder.

### Method 2: Using Plugin

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
          'node_modules/@your-org/react-sse/dist/shared-worker.js'
        );
        const publicPath = join(__dirname, 'public/shared-worker.js');
        copyFileSync(workerPath, publicPath);
      },
    },
  ],
});
```

## Create React App

Copy the `dist/shared-worker.js` file to the `public` folder.

```bash
cp node_modules/@your-org/react-sse/dist/shared-worker.js public/shared-worker.js
```

## Next.js

### Method 1: Using the `public` Folder

Copy the `dist/shared-worker.js` file to the `public` folder.

### Method 2: Using API Route (for SSR)

```ts
// pages/api/shared-worker.js
import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(req, res) {
  const workerPath = join(
    process.cwd(),
    'node_modules/@your-org/react-sse/dist/shared-worker.js'
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
            'node_modules/@your-org/react-sse/dist/shared-worker.js'
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
import { useSSEWithSharedWorker } from '@your-org/react-sse';

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
