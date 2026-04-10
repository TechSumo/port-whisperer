import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDiff, __resetForTests } from "../src/server/sse.js";
import { buildApp } from "../src/server/index.js";

// Helper: a minimal PortInfo shape good enough for diff tests.
function port(p, overrides = {}) {
  return {
    port: p,
    pid: 100 + p,
    processName: "node",
    status: "healthy",
    memory: "10 MB",
    uptime: "5m",
    framework: "Nuxt",
    ...overrides,
  };
}

// =============================================================================
// computeDiff — pure function tests
// =============================================================================

test("computeDiff: no changes → no events", () => {
  const a = new Map([
    [3000, port(3000)],
    [5432, port(5432, { processName: "postgres" })],
  ]);
  const b = new Map([
    [3000, port(3000)],
    [5432, port(5432, { processName: "postgres" })],
  ]);
  assert.deepEqual(computeDiff(a, b), []);
});

test("computeDiff: new port → one 'new' event", () => {
  const a = new Map([[3000, port(3000)]]);
  const b = new Map([
    [3000, port(3000)],
    [3001, port(3001)],
  ]);
  const events = computeDiff(a, b);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "new");
  assert.equal(events[0].port.port, 3001);
});

test("computeDiff: removed port → one 'gone' event", () => {
  const a = new Map([
    [3000, port(3000)],
    [3001, port(3001)],
  ]);
  const b = new Map([[3000, port(3000)]]);
  const events = computeDiff(a, b);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "gone");
  assert.equal(events[0].port, 3001);
});

test("computeDiff: memory change → one 'update' event", () => {
  const a = new Map([[3000, port(3000, { memory: "10 MB" })]]);
  const b = new Map([[3000, port(3000, { memory: "42 MB" })]]);
  const events = computeDiff(a, b);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "update");
  assert.equal(events[0].port.memory, "42 MB");
});

test("computeDiff: pid change (recycled port) → one 'update' event", () => {
  const a = new Map([[3000, port(3000, { pid: 100 })]]);
  const b = new Map([[3000, port(3000, { pid: 200 })]]);
  const events = computeDiff(a, b);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "update");
  assert.equal(events[0].port.pid, 200);
});

test("computeDiff: framework change → one 'update' event", () => {
  const a = new Map([[3000, port(3000, { framework: null })]]);
  const b = new Map([[3000, port(3000, { framework: "Nuxt" })]]);
  const events = computeDiff(a, b);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "update");
});

test("computeDiff: irrelevant field change (command) → no event", () => {
  // `command` isn't in the signature, so churn in it should be silent.
  const a = new Map([[3000, port(3000, { command: "node foo.js" })]]);
  const b = new Map([[3000, port(3000, { command: "node foo.js --verbose" })]]);
  assert.deepEqual(computeDiff(a, b), []);
});

test("computeDiff: mixed delta → all events emitted", () => {
  const a = new Map([
    [3000, port(3000)],
    [3001, port(3001, { memory: "10 MB" })],
    [5432, port(5432)],
  ]);
  const b = new Map([
    [3000, port(3000)], // unchanged
    [3001, port(3001, { memory: "42 MB" })], // update
    // 5432 gone
    [8080, port(8080)], // new
  ]);
  const events = computeDiff(a, b);
  assert.equal(events.length, 3);
  const types = events.map((e) => e.type).sort();
  assert.deepEqual(types, ["gone", "new", "update"]);
});

// =============================================================================
// Integration: /events endpoint via Hono app.request
// =============================================================================

const HOST_HEADERS = { Host: "127.0.0.1:7777" };

// NOTE: we deliberately do NOT integration-test GET /events here.
// Hono's in-memory app.request() doesn't fire the stream's onAbort
// when the caller cancels the body, so the SSE handler keeps awaiting
// its abort promise forever and the shared poll/heartbeat timers stay
// alive, preventing Node from draining the event loop. The end-to-end
// behavior of /events is verified by the manual smoke test in task 24
// against a real bound server.
//
// What we CAN and DO cover in unit tests:
//   - computeDiff() pure function — exhaustive above
//   - __resetForTests barrier so integration tests of other routes
//     don't leak SSE state
//   - The Origin guard regression below, which has nothing to do with
//     SSE but lives here for historical grouping

__resetForTests();

test("POST /api/kill: Origin guard still rejects bad origin", async () => {
  // Sanity check: adding SSE did not loosen the existing guards.
  const app = buildApp(7777);
  const res = await app.request("/api/kill", {
    method: "POST",
    headers: { ...HOST_HEADERS, Origin: "http://evil.example" },
    body: JSON.stringify({ pid: 1 }),
  });
  assert.equal(res.status, 403);
});
