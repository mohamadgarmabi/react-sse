import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';

import {
  SSEProvider,
  useSSEContext,
  useOptionalSSEContext,
} from '../src/SSEProvider';
import { isSharedWorkerSupported } from '../src/support';
import * as publicApi from '../src/index';

function RequiredContextConsumer(): JSX.Element {
  const sse = useSSEContext();
  return React.createElement('span', null, sse.status);
}

function OptionalContextConsumer(): JSX.Element {
  const sse = useOptionalSSEContext();
  const renderedText = sse ? sse.status : 'null';
  return React.createElement('span', null, renderedText);
}

test('isSharedWorkerSupported returns false in non-browser environments', () => {
  assert.equal(isSharedWorkerSupported(), false);
});

test('useSSEContext throws when used outside SSEProvider', () => {
  assert.throws(() => {
    renderToString(React.createElement(RequiredContextConsumer));
  }, /useSSEContext must be used inside SSEProvider/i);
});

test('useSSEContext returns provider state when wrapped with SSEProvider', () => {
  const html = renderToString(
    React.createElement(
      SSEProvider,
      {
        url: null,
        children: React.createElement(RequiredContextConsumer),
      },
    )
  );

  assert.match(html, /disconnected/i);
});

test('useOptionalSSEContext returns null when provider is missing', () => {
  const html = renderToString(React.createElement(OptionalContextConsumer));
  assert.match(html, />null</i);
});

test('useOptionalSSEContext returns provider state when wrapped', () => {
  const html = renderToString(
    React.createElement(
      SSEProvider,
      {
        url: null,
        children: React.createElement(OptionalContextConsumer),
      },
    )
  );

  assert.match(html, /disconnected/i);
});

test('public API exports provider and related hooks', () => {
  assert.equal(typeof publicApi.SSEProvider, 'function');
  assert.equal(typeof publicApi.useSSEContext, 'function');
  assert.equal(typeof publicApi.useOptionalSSEContext, 'function');
});
