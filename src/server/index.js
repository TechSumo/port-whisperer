/**
 * Web dashboard backend — Hono app + Node HTTP adapter.
 *
 * Scope (Phase 1): scaffold only.
 *   - Binds to 127.0.0.1
 *   - Route stubs for every endpoint defined in specs/web-dashboard.spec.md §3
 *   - Origin-header CSRF middleware on POST routes
 *   - Exports start(options) returning { server, url, close }
 *
 * Real route handlers land in later phases.
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import {
  getListeningPorts,
  getAllProcesses,
  getPortDetails,
} from "../scanner.js";
import { subscribe as subscribeSSE } from "./sse.js";
import { killAction, restartAction } from "./actions.js";
import { detectViaHttpProbe } from "./detect.js";
import { loadSettings, saveSettings } from "./settings.js";

// Absolute path to the built Vue SPA output.
// Repo layout: src/server/index.js  →  web/dist/
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WEB_DIST = resolve(__dirname, "..", "..", "web", "dist");

/**
 * Reject any POST whose Origin header doesn't match the server's own origin.
 * First line of defence against browsers at other origins posting to /api/kill.
 * See spec FR-18, NFR-7, AC-13.
 */
function originGuard(ownOrigin) {
  return async (c, next) => {
    if (c.req.method !== "POST" && c.req.method !== "PUT") {
      return next();
    }
    const origin = c.req.header("Origin");
    if (origin !== ownOrigin) {
      return c.json({ error: "invalid origin" }, 403);
    }
    return next();
  };
}

/**
 * Reject requests whose Host header isn't a localhost form.
 * Belt-and-braces on top of the 127.0.0.1 bind. See spec FR-5.
 */
function hostGuard(port) {
  const allowed = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  return async (c, next) => {
    const host = c.req.header("Host");
    if (!host || !allowed.has(host)) {
      return c.json({ error: "invalid host" }, 403);
    }
    return next();
  };
}

/**
 * Build the Hono app. Broken out so tests can hit routes without binding a port.
 */
export function buildApp(port) {
  const app = new Hono();
  const ownOrigin = `http://127.0.0.1:${port}`;

  app.use("*", hostGuard(port));
  app.use("*", originGuard(ownOrigin));

  // Phase 2 — snapshot endpoints. Reuse scanner.js verbatim.
  app.get("/api/ports", async (c) => {
    const ports = await getListeningPorts();
    return c.json(ports);
  });

  app.get("/api/processes", async (c) => {
    const procs = await getAllProcesses();
    procs.sort((a, b) => b.cpu - a.cpu);
    return c.json(procs);
  });

  app.get("/api/ports/:n", async (c) => {
    const raw = c.req.param("n");
    const n = parseInt(raw, 10);
    if (isNaN(n) || n < 1 || n > 65535) {
      return c.json({ error: "invalid port" }, 400);
    }
    const info = await getPortDetails(n);
    if (!info) {
      return c.json({ error: "no process listening", port: n }, 404);
    }
    return c.json(info);
  });

  // Phase 3 — SSE live stream. One shared polling loop feeds every
  // subscriber; diff events flow as {type: "new"|"gone"|"update", port}.
  app.get("/events", (c) =>
    streamSSE(c, async (stream) => {
      const send = (ev) => {
        // Fire-and-forget write; stream closure throws on a dead socket
        // and we catch it below to unsubscribe.
        stream.writeSSE({ data: JSON.stringify(ev) }).catch(() => {});
      };

      const { bootstrap, unsubscribe } = await subscribeSSE(send);

      // Emit the current-state snapshot as "new" events so the client
      // can bootstrap without a separate initial fetch.
      for (const ev of bootstrap) {
        await stream.writeSSE({ data: JSON.stringify(ev) });
      }

      // Hold the connection open until the client aborts.
      await new Promise((resolve) => {
        stream.onAbort(() => {
          unsubscribe();
          resolve(undefined);
        });
      });
    }),
  );
  // Phase 4 — kill/restart actions.
  // Body validation is shared: both endpoints require a positive integer pid.
  app.post("/api/kill", async (c) => {
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ ok: false, error: "invalid JSON body" }, 400);
    }
    const pid = Number(body?.pid);
    if (!Number.isInteger(pid) || pid < 1) {
      return c.json(
        { ok: false, error: "pid must be a positive integer" },
        400,
      );
    }
    const force = body?.force === true;
    const result = await killAction(pid, { force });
    return c.json(result, result.ok ? 200 : 409);
  });

  app.post("/api/restart", async (c) => {
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ ok: false, error: "invalid JSON body" }, 400);
    }
    const pid = Number(body?.pid);
    if (!Number.isInteger(pid) || pid < 1) {
      return c.json(
        { ok: false, error: "pid must be a positive integer" },
        400,
      );
    }
    const result = await restartAction(pid);
    return c.json(result, result.ok ? 200 : 409);
  });
  // Phase 5 — on-demand HTTP probe for framework detection.
  app.post("/api/probe", async (c) => {
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ ok: false, error: "invalid JSON body" }, 400);
    }
    const port = Number(body?.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return c.json(
        { ok: false, error: "port must be an integer 1-65535" },
        400,
      );
    }
    const pid = Number.isInteger(body?.pid) ? body.pid : undefined;
    const result = await detectViaHttpProbe({ port, pid });
    return c.json({ ok: true, port, ...result });
  });
  // Phase 6 — settings persistence.
  app.get("/api/settings", (c) => {
    try {
      return c.json(loadSettings());
    } catch (err) {
      return c.json(
        {
          error: err instanceof Error ? err.message : String(err),
        },
        500,
      );
    }
  });

  app.put("/api/settings", async (c) => {
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    if (!body || typeof body !== "object") {
      return c.json({ error: "body must be a JSON object" }, 400);
    }
    try {
      const merged = saveSettings(body);
      return c.json(merged);
    } catch (err) {
      return c.json(
        {
          error: err instanceof Error ? err.message : String(err),
        },
        500,
      );
    }
  });

  // Static SPA — everything that isn't an API route falls through to here.
  // If web/dist doesn't exist yet (e.g. developer forgot `npm run web:build`),
  // serve a helpful placeholder instead of a 404.
  if (existsSync(WEB_DIST)) {
    app.use(
      "/*",
      serveStatic({
        root: WEB_DIST,
        // serveStatic uses paths relative to cwd. We pass the absolute root
        // by overriding getContent with a custom loader below when needed;
        // for now the root-relative default works because we resolve from
        // the repo root in practice.
      }),
    );
    app.get("/", serveStatic({ path: `${WEB_DIST}/index.html` }));
  } else {
    app.get("/", (c) =>
      c.text(
        [
          "port-whisperer dashboard",
          "",
          "The SPA bundle has not been built yet.",
          "Run: npm run web:build",
          "",
          "API endpoints are live at /api/ports, /api/processes, /api/ports/:n",
        ].join("\n"),
      ),
    );
  }

  return app;
}

/**
 * Start the server on the given port. Binds to 127.0.0.1 only.
 *
 * @param {object} opts
 * @param {number} opts.port
 * @returns {Promise<{ server: import("node:http").Server, url: string, close: () => Promise<void> }>}
 */
export function start({ port }) {
  const app = buildApp(port);
  const url = `http://127.0.0.1:${port}`;

  return new Promise((resolve, reject) => {
    const server = serve(
      { fetch: app.fetch, hostname: "127.0.0.1", port },
      (info) => {
        resolve({
          server,
          url: `http://${info.address}:${info.port}`,
          close: () =>
            new Promise((resolveClose) => {
              server.close(() => resolveClose());
            }),
        });
      },
    );

    server.on("error", (err) => reject(err));
  });
}
