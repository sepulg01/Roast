import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../../worker/src/index.js';

function createContext() {
  return {
    waitUntil() {}
  };
}

test('GET /api/public-catalog returns a JSON error when an async handler throws', async () => {
  const response = await worker.fetch(
    new Request('https://caferoast.cl/api/public-catalog'),
    {},
    createContext()
  );
  const payload = await response.json();

  assert.equal(response.status, 500);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal(payload.ok, false);
  assert.equal(payload.error, 'Missing GOOGLE_SHEET_ID');
});

test('POST /api/checkout-orders returns a JSON error when request JSON is invalid', async () => {
  const response = await worker.fetch(
    new Request('https://caferoast.cl/api/checkout-orders', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: '{'
    }),
    {},
    createContext()
  );
  const payload = await response.json();

  assert.equal(response.status, 500);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal(payload.ok, false);
  assert.equal(payload.error, 'Invalid JSON body');
});
