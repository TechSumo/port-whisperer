import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/server/index.js";

// Tests hit the real scanner on the test machine. We don't assert specific
// ports (since the machine's port landscape varies) — only response shape,
// status codes, and routing correctness. The Host header is required by our
// own guard middleware; every request passes one.
const PORT = 7777;
const HOST_HEADERS = { Host: `127.0.0.1:${PORT}` };

function makeApp() {
  return buildApp(PORT);
}

test("GET /api/ports: returns 200 with a JSON array", async () => {
  const app = makeApp();
  const res = await app.request("/api/ports", { headers: HOST_HEADERS });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type")?.startsWith("application/json"), true);
  const body = await res.json();
  assert.ok(Array.isArray(body), "body should be an array");
  if (body.length > 0) {
    const first = body[0];
    assert.equal(typeof first.port, "number");
    assert.equal(typeof first.pid, "number");
    assert.equal(typeof first.processName, "string");
  }
});

test("GET /api/ports: array is sorted by port ascending", async () => {
  const app = makeApp();
  const res = await app.request("/api/ports", { headers: HOST_HEADERS });
  const body = await res.json();
  for (let i = 1; i < body.length; i++) {
    assert.ok(
      body[i].port >= body[i - 1].port,
      `ports not sorted: ${body[i - 1].port} then ${body[i].port}`,
    );
  }
});

test("GET /api/processes: returns 200 with array sorted by CPU desc", async () => {
  const app = makeApp();
  const res = await app.request("/api/processes", { headers: HOST_HEADERS });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
  for (let i = 1; i < body.length; i++) {
    assert.ok(
      body[i].cpu <= body[i - 1].cpu,
      `processes not sorted by cpu desc: ${body[i - 1].cpu} then ${body[i].cpu}`,
    );
  }
});

test("GET /api/ports/:n: returns 404 for a port nobody's listening on", async () => {
  const app = makeApp();
  // Pick a very high port that's extremely unlikely to be in use.
  const res = await app.request("/api/ports/65534", { headers: HOST_HEADERS });
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error, "no process listening");
  assert.equal(body.port, 65534);
});

test("GET /api/ports/:n: returns 400 for non-numeric input", async () => {
  const app = makeApp();
  const res = await app.request("/api/ports/notanumber", { headers: HOST_HEADERS });
  assert.equal(res.status, 400);
});

test("GET /api/ports/:n: returns 400 for out-of-range port (0)", async () => {
  const app = makeApp();
  const res = await app.request("/api/ports/0", { headers: HOST_HEADERS });
  assert.equal(res.status, 400);
});

test("GET /api/ports/:n: returns 400 for out-of-range port (99999)", async () => {
  const app = makeApp();
  const res = await app.request("/api/ports/99999", { headers: HOST_HEADERS });
  assert.equal(res.status, 400);
});

test("Host guard: wrong Host header returns 403", async () => {
  const app = makeApp();
  const res = await app.request("/api/ports", {
    headers: { Host: "evil.example" },
  });
  assert.equal(res.status, 403);
});

test("Origin guard: POST without matching Origin returns 403", async () => {
  const app = makeApp();
  const res = await app.request("/api/kill", {
    method: "POST",
    headers: { ...HOST_HEADERS, Origin: "http://evil.example" },
    body: JSON.stringify({ pid: 99999 }),
  });
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.error, "invalid origin");
});

test("Origin guard: POST with self Origin passes through to handler", async () => {
  const app = makeApp();
  const res = await app.request("/api/kill", {
    method: "POST",
    headers: {
      ...HOST_HEADERS,
      Origin: `http://127.0.0.1:${PORT}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ pid: 9999997 }),
  });
  // Phase 4 real handler runs: PID doesn't exist → 409.
  // The point of this test is to verify the origin guard did NOT 403
  // — full kill/restart behavior is covered in test/server-actions.test.js.
  assert.notEqual(res.status, 403);
  assert.equal(res.status, 409);
});
