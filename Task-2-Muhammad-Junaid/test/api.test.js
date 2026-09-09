'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createServer, resetStore } = require('../server');

let server;
let baseUrl;

test.before(async () => {
  resetStore();
  server = createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

test('health endpoint reports a healthy service', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, 'healthy');
  assert.ok(response.headers.get('x-request-id'));
});

test('lists the seeded task collection', async () => {
  const response = await fetch(`${baseUrl}/api/tasks`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.meta.total, 5);
  assert.equal(body.data.length, 5);
});

test('rejects invalid input with field details', async () => {
  const response = await fetch(`${baseUrl}/api/tasks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'x' }) });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'VALIDATION_FAILED');
  assert.ok(body.error.details.length >= 2);
});

test('creates, updates, reads, and deletes a task', async () => {
  const createdResponse = await fetch(`${baseUrl}/api/tasks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Test response contract', owner: 'Junaid', category: 'QA', priority: 'high' }) });
  const created = await createdResponse.json();
  assert.equal(createdResponse.status, 201);
  assert.match(createdResponse.headers.get('location'), /^\/api\/tasks\//);

  const id = created.data.id;
  const patchResponse = await fetch(`${baseUrl}/api/tasks/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'completed' }) });
  const patched = await patchResponse.json();
  assert.equal(patchResponse.status, 200);
  assert.equal(patched.data.status, 'completed');

  const getResponse = await fetch(`${baseUrl}/api/tasks/${id}`);
  assert.equal(getResponse.status, 200);

  const deleteResponse = await fetch(`${baseUrl}/api/tasks/${id}`, { method: 'DELETE' });
  assert.equal(deleteResponse.status, 204);
  const missingResponse = await fetch(`${baseUrl}/api/tasks/${id}`);
  assert.equal(missingResponse.status, 404);
});
