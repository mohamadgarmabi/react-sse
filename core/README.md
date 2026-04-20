# sse-crossframework

Multi-framework SSE package with adapters for:

- `sse-crossframework/react`
- `sse-crossframework/vue`
- `sse-crossframework/solid`

## Shared Worker setup

این پکیج یک shared worker آماده دارد که باید بعد از نصب، آن را در دایرکتوری پابلیک پروژه‌تان کپی کنید.

### مراحل نصب و راه‌اندازی

۱. نصب پکیج:

```bash
npm install sse-crossframework
# یا
yarn add sse-crossframework
```

۲. کپی کردن فایل shared worker به فولدر public پروژه:

```bash
npx mrgt-sse init-worker
```
به صورت پیش‌فرض این دستور، فایل را در مسیر زیر قرار می‌دهد:
```
public/shared-worker.js
```
در صورت نیاز می‌توانید مسیر دلخواه را وارد کنید:
```bash
npx mrgt-sse init-worker public/sse/shared-worker.js
```

---

## استفاده با React

### استفاده با useSSEWithSharedWorker

```tsx
import { useSSEWithSharedWorker } from 'sse-crossframework/react';

function MyComponent() {
  const { data, status, error, connect, close } = useSSEWithSharedWorker(
    '/api/events',
    { /* options */ },
    '/shared-worker.js' // مسیر فایل worker در پوشه public
  );

  if (status === 'connecting') return <div>Connecting...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <button onClick={connect}>اتصال مجدد</button>
      <button onClick={close}>قطع اتصال</button>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

### استفاده با useSSE

```tsx
import { useSSE } from 'sse-crossframework/react';

function MyComponent() {
  const { data, status, error, connect, close } = useSSE(
    '/api/events',
    { /* options */ }
  );

  if (status === 'connecting') return <div>Connecting...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <button onClick={connect}>اتصال مجدد</button>
      <button onClick={close}>قطع اتصال</button>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

### استفاده با useSSEAdaptive (حالت هوشمند)

```tsx
import { useSSEAdaptive } from 'sse-crossframework/react';

function MyComponent() {
  const { data, status, error, connect, close, reconnect } = useSSEAdaptive(
    '/api/events',
    { /* options */ },
    '/shared-worker.js' // مسیر فایل worker در public
  );

  return (
    <div>
      <button onClick={connect}>اتصال</button>
      <button onClick={reconnect}>اتصال مجدد</button>
      <button onClick={close}>قطع اتصال</button>
      <div>وضعیت: {status}</div>
      {error && <div>خطا: {error.message}</div>}
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

---

## استفاده با Vue

### استفاده با useSSEWithSharedWorker

```js
<script setup>
import { useSSEWithSharedWorker } from 'sse-crossframework/vue';

const { data, status, error, connect, close } = useSSEWithSharedWorker(
  '/api/events',
  {}, // آپشن‌ها در صورت نیاز
  '/shared-worker.js' // مسیر فایل worker در public
);
</script>

<template>
  <button @click="connect">اتصال مجدد</button>
  <button @click="close">قطع اتصال</button>
  <div>وضعیت: {{ status }}</div>
  <div v-if="error">خطا: {{ error.message }}</div>
  <pre>{{ data }}</pre>
</template>
```

### استفاده با useSSE

```js
<script setup>
import { useSSE } from 'sse-crossframework/vue';

const { data, status, error, connect, close } = useSSE(
  '/api/events',
  {} // آپشن ها به صورت اختیاری
);
</script>

<template>
  <button @click="connect">اتصال مجدد</button>
  <button @click="close">قطع اتصال</button>
  <div>وضعیت: {{ status }}</div>
  <div v-if="error">خطا: {{ error.message }}</div>
  <pre>{{ data }}</pre>
</template>
```

### استفاده با useSSEAdaptive (حالت هوشمند)

```js
<script setup>
import { useSSEAdaptive } from 'sse-crossframework/vue';

const { data, status, error, connect, close, reconnect } = useSSEAdaptive(
  '/api/events',
  {}, // آپشن‌ها در صورت نیاز
  '/shared-worker.js' // مسیر Worker در public
);
</script>

<template>
  <button @click="connect">اتصال</button>
  <button @click="reconnect">اتصال مجدد</button>
  <button @click="close">قطع اتصال</button>
  <div>وضعیت: {{ status }}</div>
  <div v-if="error">خطا: {{ error.message }}</div>
  <pre>{{ data }}</pre>
</template>
```

---

## استفاده با SolidJS

### استفاده با useSSEWithSharedWorker

```tsx
import { useSSEWithSharedWorker } from 'sse-crossframework/solid';

function MyComponent() {
  const { data, status, error, connect, close } = useSSEWithSharedWorker(
    '/api/events',
    {},
    '/shared-worker.js'
  );

  return (
    <>
      <button onClick={connect}>اتصال مجدد</button>
      <button onClick={close}>قطع اتصال</button>
      <div>وضعیت: {status()}</div>
      {error() && <div>خطا: {error().message}</div>}
      <pre>{JSON.stringify(data(), null, 2)}</pre>
    </>
  );
}
```

### استفاده با useSSE

```tsx
import { useSSE } from 'sse-crossframework/solid';

function MyComponent() {
  const { data, status, error, connect, close } = useSSE(
    '/api/events',
    {}
  );

  return (
    <>
      <button onClick={connect}>اتصال مجدد</button>
      <button onClick={close}>قطع اتصال</button>
      <div>وضعیت: {status()}</div>
      {error() && <div>خطا: {error().message}</div>}
      <pre>{JSON.stringify(data(), null, 2)}</pre>
    </>
  );
}
```

### استفاده با useSSEAdaptive (حالت هوشمند)

```tsx
import { useSSEAdaptive } from 'sse-crossframework/solid';

function MyComponent() {
  const { data, status, error, connect, close, reconnect } = useSSEAdaptive(
    '/api/events',
    {},
    '/shared-worker.js'
  );

  return (
    <>
      <button onClick={connect}>اتصال</button>
      <button onClick={reconnect}>اتصال مجدد</button>
      <button onClick={close}>قطع اتصال</button>
      <div>وضعیت: {status()}</div>
      {error() && <div>خطا: {error().message}</div>}
      <pre>{JSON.stringify(data(), null, 2)}</pre>
    </>
  );
}
```

---

**توجه:** اگر هنگام کپی worker مسیر دلخواه وارد کرده‌اید، مسیر مربوطه را به عنوان آرگومان سوم به هوک بدهید (مثلاً `/sse/shared-worker.js`).