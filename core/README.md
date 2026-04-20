# @mrgt/sse

Multi-framework SSE package with adapters for:

- `@mrgt/sse/react`
- `@mrgt/sse/vue`
- `@mrgt/sse/solid`

## Shared Worker setup

This package includes a ready-to-use shared worker build in the package.

After installing the package in your app, copy the worker file to your app's public directory:

```bash
npx mrgt-sse init-worker
```

By default, this creates:

```text
public/shared-worker.js
```

You can also choose a custom path:

```bash
npx mrgt-sse init-worker public/sse/shared-worker.js
```

Then pass that URL in your hook call:

```ts
useSSEWithSharedWorker('/api/events', options, '/shared-worker.js')
```

or

```ts
useSSEAdaptive('/api/events', options, '/shared-worker.js')
```
