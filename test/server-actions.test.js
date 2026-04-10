import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/server/index.js";

// We intentionally do NOT test actually killing real processes in this
// suite — it would either damage the test host or require spawning and
// managing child processes with enough ceremony to dwarf the feature.
// The real-world kill/restart path is covered by manual smoke in task 28.
//
// What we DO cover here:
//   - body validation (missing JSON, missing pid, non-integer pid,
//     negative pid)
//   - Origin guard applies to both POST endpoints
//   - 409 when killing a PID that doesn't exist (harmless — POSIX kill
//     on a dead PID just returns ESRCH)
//   - restart returns stage:"fetch" when the PID isn't in the snapshot

const HOST_HEADERS = { Host: "127.0.0.1:7777" };
const SELF_ORIGIN = { Origin: "http://127.0.0.1:7777" };

function post(path, body, extraHeaders = {}) {
  const app = buildApp(7777);
  return app.request(path, {
    method: "POST",
    headers: {
      ...HOST_HEADERS,
      ...SELF_ORIGIN,
      "content-type": "application/json",
      ...extraHeaders,
    },
    body: body === null ? undefined : JSON.stringify(body),
  });
}

// =============================================================================
// /api/kill
// =============================================================================

test("POST /api/kill: missing JSON body → 400", async () => {
  const app = buildApp(7777);
  const res = await app.request("/api/kill", {
    method: "POST",
    headers: { ...HOST_HEADERS, ...SELF_ORIGIN },
    // no body
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.ok, false);
});

test("POST /api/kill: no pid field → 400", async () => {
  const res = await post("/api/kill", {});
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /pid/);
});

test("POST /api/kill: non-integer pid → 400", async () => {
  const res = await post("/api/kill", { pid: "not a number" });
  assert.equal(res.status, 400);
});

test("POST /api/kill: negative pid → 400", async () => {
  const res = await post("/api/kill", { pid: -1 });
  assert.equal(res.status, 400);
});

test("POST /api/kill: zero pid → 400", async () => {
  const res = await post("/api/kill", { pid: 0 });
  assert.equal(res.status, 400);
});

test("POST /api/kill: nonexistent PID → 409 with error", async () => {
  // PID 9999999 is extremely unlikely to exist on any machine.
  // POSIX kill() returns ESRCH for nonexistent PIDs; our handler
  // catches that and returns a structured 409.
  const res = await post("/api/kill", { pid: 9999999 });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.pid, 9999999);
});

test("POST /api/kill: wrong Origin → 403", async () => {
  const app = buildApp(7777);
  const res = await app.request("/api/kill", {
    method: "POST",
    headers: {
      ...HOST_HEADERS,
      Origin: "http://evil.example",
      "content-type": "application/json",
    },
    body: JSON.stringify({ pid: 1 }),
  });
  assert.equal(res.status, 403);
});

// =============================================================================
// /api/restart
// =============================================================================

test("POST /api/restart: missing pid → 400", async () => {
  const res = await post("/api/restart", {});
  assert.equal(res.status, 400);
});

test("POST /api/restart: non-integer pid → 400", async () => {
  const res = await post("/api/restart", { pid: "x" });
  assert.equal(res.status, 400);
});

test("POST /api/restart: PID not in snapshot → 409 stage=fetch", async () => {
  // A PID that's extremely unlikely to be in the listening-ports snapshot.
  // restartAction should fail at the fetch stage because it can't find
  // a matching port entry for this PID.
  const res = await post("/api/restart", { pid: 9999998 });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.stage, "fetch");
});

test("POST /api/restart: wrong Origin → 403", async () => {
  const app = buildApp(7777);
  const res = await app.request("/api/restart", {
    method: "POST",
    headers: {
      ...HOST_HEADERS,
      Origin: "http://evil.example",
      "content-type": "application/json",
    },
    body: JSON.stringify({ pid: 1 }),
  });
  assert.equal(res.status, 403);
});
