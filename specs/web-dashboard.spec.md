# Web Dashboard — Feature Specification

**Feature name:** `web-dashboard`
**CLI invocation:** `ports serve [--port <N>] [--open]`
**Delivery:** HTTP server bound to `127.0.0.1`, Vue SPA served from the same origin, SSE for live updates
**Status:** Draft — pending validation

---

## 1. Overview and user value

### What it is
A local-only web dashboard for port-whisperer. Running `ports serve` starts a Node HTTP server on `127.0.0.1:<port>` (default `7777`), serves a pre-built Vue 3 SPA, streams live port data over Server-Sent Events, and exposes REST endpoints for destructive actions (kill, restart). The user opens the URL in their browser and gets a richer, interactive version of everything the CLI does.

### Why it exists
The CLI is a good scanner but a poor interactive surface: killing a port requires typing the port number; filtering requires `grep`; watching is a one-line event log; restart doesn't exist; the framework list is narrow and hand-curated. Moving to a browser UI trades zero-build simplicity for:

- **Discoverability.** Visual scanning beats `ports` output for "what's on my machine right now?"
- **Speed of destructive actions.** Click-to-kill is an order of magnitude faster than typing port numbers.
- **Richer live view.** Sparklines and new-port flashes convey information that ASCII tables cannot.
- **Persistent filters.** Save a filter preset once, reuse it every day.
- **Extensibility.** A Vue component tree is easier to evolve than hand-formatted chalk strings.

### Who it's for
Primary user: the developer (`papak69`) running this fork locally. Single-user, single-machine, no auth. Personal fork, not published.

### Scope

**In scope for v1:**
- HTTP server subcommand (`ports serve`)
- Vue 3 SPA: table view, process view, detail view (CLI parity)
- Filter bar (framework / project / port range / free-text search)
- Live updates via SSE with automatic reconnect
- Kill action with confirm dialog
- Restart action with best-effort re-exec
- Better framework detection: deep `package.json` scan, HTTP probe signatures, tighter command-line pattern matching
- Richer watch view: per-row uptime sparklines, new-port flash animation
- Light/dark theme following system preference
- Settings persistence (`~/.port-whisperer/config.json`)

**Out of scope for v1 (flagged for future):**
- Persistent port history (ports that have closed)
- Event log scrolling feed (deferred — user did not select)
- Timeline chart
- Multi-user / authentication
- Remote mode (non-localhost bind)
- Electron / Tauri / native packaging
- Cross-machine port discovery
- CI integration

---

## 2. Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (http://127.0.0.1:7777)                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Vue 3 SPA (built by Vite to web/dist/)              │   │
│  │  - Composition API, <script setup>                   │   │
│  │  - TypeScript                                         │   │
│  │  - Tailwind CSS                                       │   │
│  │  - Pinia store for reactive port state               │   │
│  │  - EventSource → /events  (live stream)               │   │
│  │  - fetch → /api/kill, /api/restart, /api/probe        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │ localhost only
┌─────────────────────────┴───────────────────────────────────┐
│  Node server (src/server/index.js, started by `ports serve`)│
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Hono app                                             │   │
│  │  - GET  /                → serves web/dist/index.html │   │
│  │  - GET  /assets/*        → serves Vite build output   │   │
│  │  - GET  /api/ports       → snapshot JSON              │   │
│  │  - GET  /api/processes   → snapshot JSON (ps view)    │   │
│  │  - GET  /api/ports/:n    → detail JSON                │   │
│  │  - GET  /events          → SSE live stream            │   │
│  │  - POST /api/kill        → { pid }                    │   │
│  │  - POST /api/restart     → { pid }                    │   │
│  │  - POST /api/probe       → { port } (framework)      │   │
│  │  - GET  /api/settings    → config.json                │   │
│  │  - PUT  /api/settings    → update config.json         │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         ↓                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Existing scanner + platform layer (unchanged)       │   │
│  │  - src/scanner.js                                     │   │
│  │  - src/platform/{darwin,linux,win32}.js               │   │
│  │  - src/platform/posix-shared.js                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Directory layout (new)

```
port-whisperer/
├── src/
│   ├── index.js              # existing CLI entry (adds `serve` subcommand)
│   ├── scanner.js            # unchanged
│   ├── display.js            # unchanged
│   ├── platform/             # unchanged
│   ├── server/               # NEW — Node backend
│   │   ├── index.js          # Hono app, SSE loop, route wiring
│   │   ├── sse.js            # SSE stream helper + diff logic
│   │   ├── actions.js        # kill + restart implementations
│   │   ├── probe.js          # HTTP probe framework detection
│   │   ├── settings.js       # config.json read/write
│   │   └── detect.js         # improved framework detection (extends scanner)
│   └── ...
├── web/                       # NEW — Vue SPA
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── main.ts           # Vue app bootstrap
│   │   ├── App.vue
│   │   ├── stores/
│   │   │   └── ports.ts      # Pinia store + SSE consumer
│   │   ├── components/
│   │   │   ├── PortTable.vue
│   │   │   ├── PortRow.vue
│   │   │   ├── ProcessTable.vue
│   │   │   ├── DetailPanel.vue
│   │   │   ├── FilterBar.vue
│   │   │   ├── KillConfirm.vue
│   │   │   ├── Sparkline.vue
│   │   │   └── ThemeToggle.vue
│   │   ├── composables/
│   │   │   ├── useEventSource.ts
│   │   │   ├── useFilters.ts
│   │   │   └── useMetricsHistory.ts
│   │   ├── types/
│   │   │   └── api.ts        # shared types (mirrors server responses)
│   │   └── styles/
│   │       └── main.css
│   └── dist/                 # Vite build output (gitignored)
├── test/                     # existing
│   ├── posix-parser.test.js
│   ├── scanner.test.js
│   ├── server.test.js        # NEW — integration tests for HTTP routes
│   └── detect.test.js        # NEW — tests for improved framework detection
└── specs/
    └── web-dashboard.spec.md # this document
```

---

## 3. Functional requirements (EARS)

### 3.1 Server lifecycle

**FR-1** When the user runs `ports serve`, the system shall start a Hono HTTP server bound to `127.0.0.1` on port 7777 by default and print the full URL to stdout.

**FR-2** When the user runs `ports serve --port <N>`, the system shall bind to port `<N>` instead of the default; if `<N>` is already in use the system shall exit with a non-zero code and print the port conflict.

**FR-3** When the user runs `ports serve --open`, the system shall additionally launch the system default browser at the served URL after the server has accepted its first connection.

**FR-4** When the user sends SIGINT (Ctrl+C) to a running `ports serve` process, the system shall close all active SSE connections, stop the polling loop, and exit with code 0 within 2 seconds.

**FR-5** The system shall refuse all requests where the `Host` header is not `127.0.0.1:<port>` or `localhost:<port>`, responding with HTTP 403.

### 3.2 Snapshot endpoints

**FR-6** When the client issues `GET /api/ports`, the system shall respond with a JSON array of all listening ports, each object matching the shape returned by the existing `getListeningPorts()` function in `src/scanner.js`.

**FR-7** When the client issues `GET /api/processes`, the system shall respond with a JSON array matching the shape of `getAllProcesses()` from `src/scanner.js`, sorted by CPU descending.

**FR-8** When the client issues `GET /api/ports/:n` with a numeric port `:n`, the system shall respond with detailed port info (uptime, memory, process tree, git branch, framework) using `getPortDetails(n)`; if no process listens on port `n`, the system shall respond with HTTP 404.

### 3.3 Live updates (SSE)

**FR-9** When the client issues `GET /events`, the system shall open a Server-Sent Events stream and hold it open until the client disconnects.

**FR-10** While an SSE client is connected, the system shall poll `getListeningPorts()` every 2 seconds and push diff events to that client:
  - `{"type": "new", "port": <full_port_object>}` when a port appears
  - `{"type": "gone", "port": <port_number>}` when a port disappears
  - `{"type": "update", "port": <full_port_object>}` when an existing port's PID, status, memory, or framework changes
  - `{"type": "heartbeat"}` every 30 seconds if nothing changed (to keep connection alive through proxies)

**FR-11** The system shall deduplicate polling work across connected clients: one polling loop feeds all SSE subscribers. If zero clients are connected the polling loop shall be idle.

**FR-12** When an SSE client disconnects (network drop, browser close), the system shall remove it from the subscriber set within one poll cycle.

**FR-13** The client shall automatically reconnect via the native `EventSource` reconnect behavior when the stream drops, with no code changes required beyond standard `EventSource` usage.

### 3.4 Kill action

**FR-14** When the client issues `POST /api/kill` with body `{"pid": <number>}`, the system shall send `SIGTERM` to the specified PID using the existing `killProcess()` function in `src/scanner.js`.

**FR-15** When the kill request body includes `{"pid": <number>, "force": true}`, the system shall send `SIGKILL` instead of `SIGTERM`.

**FR-16** When a kill succeeds, the system shall respond with HTTP 200 and JSON `{"ok": true, "pid": <number>, "signal": "SIGTERM"}`.

**FR-17** When a kill fails (no such PID, permission denied, or any other error), the system shall respond with HTTP 409 and JSON `{"ok": false, "pid": <number>, "error": "<human-readable reason>"}`.

**FR-18** When a POST to `/api/kill` has no valid CSRF guard (the `Origin` header must match the server's own origin), the system shall respond with HTTP 403 and not invoke any kill logic.

**FR-19** The UI shall require the user to confirm every kill via a modal dialog that names the PID, process, project, framework, and port before the POST is sent.

### 3.5 Restart action

**FR-20** When the client issues `POST /api/restart` with body `{"pid": <number>}`, the system shall:
  1. Fetch the process's `command` and `cwd` from the current snapshot
  2. Send `SIGTERM` to the PID
  3. Wait up to 1 second for the PID to exit (polling `kill(pid, 0)`)
  4. Spawn `sh -c <command>` in the captured `cwd`, detached, with `stdio: "ignore"`, and `unref()` the child

**FR-21** When a restart succeeds (the new child spawns without throwing), the system shall respond with HTTP 200 and JSON `{"ok": true, "pid": <oldPid>, "command": "<captured command>", "cwd": "<captured cwd>"}`.

**FR-22** When restart fails at any step (PID gone before we could read it, kill failed, command empty, spawn threw), the system shall respond with HTTP 409 and JSON `{"ok": false, "pid": <number>, "error": "<reason>", "stage": "fetch|kill|spawn"}`.

**FR-23** The UI shall warn the user before restart that the re-launched process will inherit the server's environment, not the original shell's — and that processes using `nvm`, `direnv`, or interactive TTYs may fail.

### 3.6 Better framework detection

**FR-24** The system shall extend the existing framework detection in `src/scanner.js` with three new strategies, called in this order until one returns a non-null framework name:
  1. **Deep package.json scan** — check `dependencies`, `devDependencies`, `peerDependencies`, and the text of every `scripts.*` value for framework keywords (e.g. `next dev`, `vite`, `astro`, `gatsby develop`, `ng serve`)
  2. **Command-line pattern matching** — extended regexes on `ps.command` covering the strings missed by the current list (e.g. `uvicorn`, `daphne`, `granian`, `hypercorn`, `gunicorn`, `bun run dev`, `deno task dev`)
  3. **HTTP probe** — send a `HEAD` or `GET /` to `127.0.0.1:<port>` with a 200ms timeout, read response headers (`X-Powered-By`, `Server`) and the first 2KB of HTML for `<meta name="generator">`; map known signatures to framework names

**FR-25** The HTTP probe shall be opt-in per call, not run eagerly for every port during SSE polling. The UI shall trigger it on demand via `POST /api/probe { "port": <n> }` and cache the result for 60 seconds per port.

**FR-26** Framework detection strategies shall be implemented as pure functions in `src/server/detect.js`, each accepting the existing port info object and returning `string | null`. This file shall have unit tests in `test/detect.test.js`.

### 3.7 Filters and search (UI)

**FR-27** The UI shall provide a filter bar with four controls:
  - **Framework** — multi-select dropdown populated from the current snapshot's distinct framework values
  - **Project** — multi-select dropdown populated from distinct project names
  - **Port range** — two number inputs (min/max), both optional
  - **Text search** — free-text input that matches case-insensitively against port, PID, process name, project, framework, and command

**FR-28** When the user changes any filter, the table shall update within 50ms without re-fetching from the server (filtering is client-side over the reactive Pinia store).

**FR-29** When the user saves a filter preset via a "Save preset" button, the UI shall PUT the current filter state to `/api/settings` under a user-chosen name.

**FR-30** The UI shall show a preset dropdown listing all saved presets; clicking a preset shall apply its filter state.

### 3.8 Watch view enhancements

**FR-31** For each port row, the UI shall render an inline sparkline (width ~60px, height ~20px) showing the process's memory (RSS) over the last 60 seconds. Data points are the values from SSE `update` events.

**FR-32** When a new port appears in the table (via SSE `new` event), the UI shall flash that row with a green highlight that fades over 2 seconds.

**FR-33** When a port disappears (via SSE `gone` event), the UI shall fade the row to gray over 1 second before removing it from the DOM.

**FR-34** The sparkline history shall be kept in-memory only, capped at the most recent 30 data points (60 seconds at the default 2s poll interval). It shall NOT be persisted.

### 3.9 Settings and persistence

**FR-35** On first launch, the system shall create `~/.port-whisperer/config.json` if it does not exist, pre-populated with defaults: `{ "theme": "system", "pollIntervalMs": 2000, "presets": {}, "defaultView": "ports" }`.

**FR-36** When the client issues `GET /api/settings`, the system shall respond with the current config file contents as JSON.

**FR-37** When the client issues `PUT /api/settings` with a JSON body, the system shall merge the body into the existing config (shallow merge at the top level), write it atomically via temp-file-then-rename, and respond with the merged state.

**FR-38** The UI shall load settings on startup and apply them before rendering any view.

### 3.10 CLI integration

**FR-39** The CLI `ports` command shall continue to work exactly as today; the web dashboard is additive. All existing subcommands (`ps`, `clean`, `kill`, `watch`, numeric port) remain unchanged.

**FR-40** The new `serve` subcommand shall be documented in `ports --help` output.

---

## 4. Non-functional requirements

### 4.1 Performance

- **NFR-1** Cold boot: `ports serve` shall print the URL within 500ms of invocation on a MacBook Pro M-series.
- **NFR-2** Snapshot endpoints (`/api/ports`, `/api/processes`) shall respond within 300ms p95 on a machine with ≤50 listening ports.
- **NFR-3** SSE poll cycle shall complete within 300ms p95 (same budget as above — the SSE loop shares the scanner call).
- **NFR-4** The Vue SPA bundle (JS + CSS, gzipped) shall be under 150KB.
- **NFR-5** Initial paint in the browser shall happen within 500ms of the first navigation on localhost.

### 4.2 Security

- **NFR-6** The server shall bind to `127.0.0.1` only; `0.0.0.0` bind is forbidden.
- **NFR-7** All POST endpoints shall verify the `Origin` header matches the server's own origin; mismatched origins get HTTP 403 with no action taken.
- **NFR-8** The server shall not serve any file outside `web/dist/` via the static file route; path traversal attempts (`..`, encoded slashes) shall return HTTP 400.
- **NFR-9** The kill/restart endpoints shall not accept arbitrary shell strings — `restart` uses the captured `command` from our own scanner output, not from the request body.
- **NFR-10** The server shall log every kill/restart request (PID, timestamp, outcome) to stderr for post-hoc auditing.
- **NFR-11** There shall be no authentication; the security model is "only processes running as the current user on this machine can reach localhost".

### 4.3 Reliability

- **NFR-12** If the scanner call inside the SSE poll loop throws, the system shall catch the exception, log it, and continue polling on the next interval (not crash the server).
- **NFR-13** If a client's SSE write fails, the system shall drop that client and continue serving others.
- **NFR-14** Config file corruption (invalid JSON) shall not crash the server; on load failure, log the error and fall back to defaults without overwriting the corrupt file.

### 4.4 Accessibility

- **NFR-15** All interactive elements (buttons, filter inputs, dialog) shall be keyboard-accessible.
- **NFR-16** The kill confirm dialog shall trap focus and dismiss on `Esc`.
- **NFR-17** Color shall not be the only indicator of status; the green/yellow/red dots in the existing design shall be paired with text labels (`healthy`, `orphaned`, `zombie`).

### 4.5 Compatibility

- **NFR-18** The dashboard shall work in Chrome, Safari, Firefox, and Edge (evergreen). No IE11, no pre-Chromium Edge.
- **NFR-19** The backend shall work on macOS, Linux, and Windows (same as the CLI).
- **NFR-20** Node runtime requirement stays at `>=20` (matching the upgrade we just shipped).

### 4.6 Maintainability

- **NFR-21** Server-side code shall have at least one test file per module in `test/server*.test.js`.
- **NFR-22** Shared types (`src/types/api.ts`) shall be consumed by both backend (via JSDoc `@type` imports if we keep backend JS) and frontend TS, so API contracts can't drift.
- **NFR-23** No `any` types in the frontend TS codebase; use `unknown` + type guards instead.

---

## 5. Acceptance criteria

### AC-1 — Cold boot

```
Given port-whisperer is installed and port 7777 is free,
When the user runs `ports serve`,
Then within 500ms the process prints "Listening on http://127.0.0.1:7777"
  and a GET to that URL returns HTTP 200 with the SPA index.html.
```

### AC-2 — Port conflict

```
Given another process is already listening on port 7777,
When the user runs `ports serve`,
Then the process exits with code 1 within 2 seconds
  and prints "Port 7777 is already in use. Try: ports serve --port 7778".
```

### AC-3 — Live update on new port

```
Given the dashboard is open in a browser with an SSE connection,
When a new dev server binds to port 3000,
Then within 2.5 seconds the dashboard displays a new row for :3000,
  and the row flashes green for 2 seconds before settling,
  and the PORTS counter in the header increments by one.
```

### AC-4 — Kill with confirm

```
Given the dashboard is showing a row for port 3000,
When the user clicks the Kill button on that row,
Then a modal appears with "Kill PID <pid>? node — <project> — Nuxt on :3000"
  and two buttons: Cancel and Kill;
When the user clicks Kill in the modal,
Then a POST /api/kill is sent with the correct PID,
  the modal closes,
  and within 2.5 seconds the row disappears (via SSE "gone" event).
```

### AC-5 — Kill failure

```
Given a row for port 3000 owned by root,
When the user confirms Kill,
Then the server responds HTTP 409 with error "operation not permitted",
  a toast appears: "Failed to kill PID <pid>: operation not permitted",
  and the row remains in the table.
```

### AC-6 — Restart best-effort

```
Given a row for port 3000 running `npm run dev` in /Users/foo/proj,
When the user clicks Restart and confirms,
Then the server sends SIGTERM to the PID,
  waits for the PID to exit,
  spawns `sh -c "npm run dev"` in /Users/foo/proj detached,
  returns HTTP 200,
  and within 10 seconds a new row for :3000 (new PID) appears in the table.
```

### AC-7 — Restart best-effort failure

```
Given a row whose captured command contains `nvm use 18 && npm run dev`,
When the user clicks Restart,
Then the server attempts the restart,
  the new child may fail to bind the port,
  and within 15 seconds the UI shows a toast "Restart completed but the port did not come back. Check your terminal."
```

### AC-8 — Filter by framework

```
Given the dashboard shows 20 ports across 5 frameworks,
When the user selects "Nuxt" in the framework filter,
Then the table updates within 50ms to show only Nuxt rows,
  and the URL updates to include ?framework=Nuxt (for shareability).
```

### AC-9 — Save and reuse a filter preset

```
Given the user has set filters to "Framework=Nuxt, Port 3000-3010",
When they click "Save preset" and enter the name "frontend",
Then a PUT /api/settings writes { presets: { frontend: {...} } },
  and "frontend" appears in the preset dropdown;
When the user reloads the page and picks "frontend" from the dropdown,
Then the same filters are reapplied.
```

### AC-10 — Better framework detection (FastAPI)

```
Given a Python process runs `uvicorn app.main:app --port 9000`,
When `ports serve` scans,
Then that row shall show framework "FastAPI" (via command-line pattern),
  not "Python" or "—" as in the current CLI.
```

### AC-11 — HTTP probe fallback

```
Given a process on :4000 whose package.json has no recognizable deps
  and whose command line is `node dist/server.js`,
When the user clicks "Probe" on that row,
Then POST /api/probe is sent with { port: 4000 },
  the server sends a GET / to 127.0.0.1:4000 with 200ms timeout,
  reads headers and body,
  and returns the detected framework (e.g. "Express" from X-Powered-By header)
  or null if no signature matches.
```

### AC-12 — Settings persistence survives restart

```
Given the user has toggled the theme to "dark" and saved a preset "frontend",
When they quit `ports serve` (Ctrl+C) and start it again,
Then ~/.port-whisperer/config.json exists with both changes,
  and reopening the browser shows dark theme + the "frontend" preset.
```

### AC-13 — Origin header CSRF guard

```
Given an attacker-hosted page at http://evil.example runs
  `fetch('http://127.0.0.1:7777/api/kill', { method: 'POST', body: '{"pid": 1234}' })`,
When the request reaches the server,
Then the server rejects it with HTTP 403 "invalid origin"
  and does NOT invoke killProcess.
```

### AC-14 — SSE heartbeat

```
Given an SSE client is connected and the port list has not changed for 30 seconds,
When 30 seconds elapse,
Then the server emits a `{"type": "heartbeat"}` event,
  and the client's EventSource stays open without triggering a reconnect.
```

### AC-15 — Graceful server shutdown

```
Given `ports serve` is running with 2 SSE clients connected,
When the user presses Ctrl+C,
Then within 2 seconds the server closes both SSE streams,
  stops the polling loop,
  and exits with code 0.
```

---

## 6. Error handling

| # | Error | Where | Server response | UI response |
|---|---|---|---|---|
| E1 | Port conflict on boot (`EADDRINUSE`) | `ports serve` startup | process exits code 1 with message | N/A |
| E2 | Scanner throws during SSE poll | SSE poll loop | log to stderr, continue | no visible change, counters still tick |
| E3 | Kill fails (`EPERM` / `ESRCH`) | POST /api/kill | HTTP 409 with `{ok: false, error}` | toast: "Failed to kill — <reason>" |
| E4 | Restart fails at kill stage | POST /api/restart | HTTP 409 `{stage: "kill"}` | toast: "Couldn't kill PID — aborted restart" |
| E5 | Restart fails at spawn stage | POST /api/restart | HTTP 409 `{stage: "spawn"}` | toast: "Killed PID, but couldn't relaunch — run `<command>` manually" + Copy button |
| E6 | Restart succeeds but port never comes back | UI timeout | n/a — detected client-side | toast: "Restart completed but :port did not come back. Check your terminal." |
| E7 | Invalid Origin on POST | any POST route | HTTP 403 `{error: "invalid origin"}` | should not happen for our own UI; log only |
| E8 | Malformed SSE event (parse error) | client side | n/a | console.error, discard event, don't crash store |
| E9 | Config file corrupt | server startup | log, fall back to defaults | UI loads with default settings, console warning |
| E10 | Config file write fails (disk full / perms) | PUT /api/settings | HTTP 500 `{error}` | toast: "Could not save settings — <reason>" |
| E11 | Probe timeout (port open but no response in 200ms) | POST /api/probe | HTTP 200 `{framework: null, reason: "timeout"}` | row framework cell shows "—" with tooltip "probe timed out" |
| E12 | SSE client disconnects mid-write | SSE loop | catch, remove from subscriber set | EventSource auto-reconnects |
| E13 | SIGINT while kill is in flight | Ctrl+C handler | wait up to 2s for in-flight actions to settle, then exit | browser's EventSource shows reconnect attempt, fails, user closes tab |
| E14 | PID re-assigned between snapshot and kill | POST /api/kill | kill still sent (best effort); if fails, normal E3 path | same as E3 |

---

## 7. Implementation TODO checklist

### Phase 1 — Backend scaffolding
- [ ] Add `hono` to `package.json` dependencies
- [ ] Create `src/server/index.js` with Hono app, route stubs, and `start(port)` export
- [ ] Wire `ports serve [--port] [--open]` subcommand in `src/index.js`
- [ ] Implement `ports serve` help output in `--help` block
- [ ] Origin header CSRF middleware
- [ ] Bind-to-127.0.0.1 only
- [ ] SIGINT handler with 2-second grace window

### Phase 2 — Snapshot endpoints
- [ ] `GET /api/ports` — calls `getListeningPorts()`
- [ ] `GET /api/processes` — calls `getAllProcesses()`
- [ ] `GET /api/ports/:n` — calls `getPortDetails(n)`, 404 on miss
- [ ] JSON response shape matches existing scanner objects verbatim
- [ ] Test: `test/server-snapshot.test.js` with a mocked platform layer

### Phase 3 — SSE stream
- [ ] `GET /events` — SSE endpoint using Hono's `streamSSE`
- [ ] Shared polling loop (one interval for all subscribers)
- [ ] Diff computation: compare previous snapshot to new, emit new/gone/update events
- [ ] Heartbeat every 30 seconds
- [ ] Subscriber set cleanup on disconnect
- [ ] Test: `test/server-sse.test.js` with a fake scanner

### Phase 4 — Kill and restart actions
- [ ] `POST /api/kill` — body `{pid, force?}`, reuses `killProcess()`
- [ ] `POST /api/restart` — fetch command+cwd, kill, wait, spawn detached
- [ ] Kill audit log to stderr
- [ ] Error response shape matches spec (`{ok: false, error, stage?}`)
- [ ] Test: `test/server-actions.test.js` with a mock child_process

### Phase 5 — Better framework detection
- [ ] Create `src/server/detect.js` with `detectFromPackageJsonDeep`, `detectFromCommandExtended`, `detectViaHttpProbe`
- [ ] Deep package.json scan: include peerDeps + scripts
- [ ] Extended command-line patterns: daphne, granian, hypercorn, gunicorn, bun run, deno task
- [ ] HTTP probe: GET / with 200ms timeout, parse X-Powered-By / Server / meta generator
- [ ] Probe cache: 60s TTL, keyed by port+pid
- [ ] `POST /api/probe` endpoint
- [ ] Test: `test/detect.test.js` with canned command strings and fake HTTP responses

### Phase 6 — Settings persistence
- [ ] `src/server/settings.js`: load/save with atomic temp-file-rename
- [ ] Default config object
- [ ] `GET /api/settings` and `PUT /api/settings` routes
- [ ] Create `~/.port-whisperer/` dir if missing
- [ ] Handle corrupt config gracefully
- [ ] Test: `test/server-settings.test.js` with a temp HOME

### Phase 7 — Frontend scaffold
- [ ] `web/` directory with Vite + Vue 3 + TS + Tailwind
- [ ] `vite.config.ts` with build output to `web/dist`
- [ ] `tsconfig.json` with strict mode, no `any`
- [ ] `tailwind.config.ts` with dark-mode via class
- [ ] `main.ts`, `App.vue`, base layout
- [ ] Pinia store `stores/ports.ts`
- [ ] EventSource composable `composables/useEventSource.ts`
- [ ] Shared types in `web/src/types/api.ts`
- [ ] npm scripts: `web:dev` (vite dev), `web:build` (vite build)

### Phase 8 — Frontend components
- [ ] `PortTable.vue` — table with sortable columns
- [ ] `PortRow.vue` — single row with status, framework, project, kill/restart buttons
- [ ] `ProcessTable.vue` — `ps` view
- [ ] `DetailPanel.vue` — slide-over panel for single-port detail
- [ ] `FilterBar.vue` — framework/project/range/search controls
- [ ] `KillConfirm.vue` — modal with focus trap
- [ ] `Sparkline.vue` — 60px × 20px inline SVG sparkline
- [ ] `ThemeToggle.vue` — system/light/dark tri-state

### Phase 9 — Frontend behavior
- [ ] SSE consumer in Pinia store: handle new/gone/update/heartbeat
- [ ] New-port flash animation (CSS keyframe)
- [ ] Port-gone fade-out animation
- [ ] Filter state in URL query params (for shareable URLs)
- [ ] Filter presets: load from /api/settings, save via PUT
- [ ] Kill confirm flow + toast notifications
- [ ] Restart confirm flow + warning about env inheritance
- [ ] Probe button per row

### Phase 10 — Integration and polish
- [ ] Server serves `web/dist` in production (after `npm run web:build`)
- [ ] Dev mode: `ports serve --dev` proxies to `vite dev` for HMR
- [ ] Update CLI `--help` output
- [ ] Update README with dashboard screenshots and `ports serve` docs
- [ ] E2E smoke: start server, open in browser, verify all 15 ACs pass manually

### Phase 11 — Test suite growth
- [ ] Unit tests per module (listed in phases above)
- [ ] Integration test: start Hono server on ephemeral port, hit all routes with fetch
- [ ] Framework detection tests with canned fixtures
- [ ] Ensure `npm test` remains green and adds at least 20 new assertions

### Phase 12 — Documentation
- [ ] `README.md` — new "Web Dashboard" section with screenshot + usage
- [ ] `CHANGELOG.md` — first entry, document the dashboard
- [ ] Inline JSDoc on public server APIs
- [ ] `specs/web-dashboard.spec.md` — this file, marked "implemented" once shipped

---

## 8. Open questions — resolved

All questions that shaped this spec have been resolved. Recording them here for future reference:

1. ✅ **Filter state in URL** — **In-memory store only.** No vue-router. Dashboard stays a true single-page view; filters are not bookmarkable in v1.
2. ✅ **`ports serve --dev` HMR mode** — **Proxy to Vite dev.** `ports serve --dev` spawns `vite dev` and proxies frontend routes to it, full HMR. Production build serves `web/dist` directly.
3. ✅ **Keyboard shortcuts** — **Yes, in v1.** Bindings:
   - `k` — kill focused row (opens confirm dialog)
   - `r` — restart focused row (opens confirm dialog)
   - `d` — open detail panel for focused row
   - `/` — focus the search input
   - `Esc` — close dialog or clear filters if no dialog open
   - `j` / `k` or `↑` / `↓` — move row focus (aligning with `k` for kill is a minor collision; `j`/`↓` is the "next" binding, and row focus is consumed by dialogs so `k`-for-kill only fires when no row move is active)
4. ✅ **Kill audit log destination** — **stderr only.** No separate audit log file in v1. Users who want persistence can redirect: `ports serve 2>> ~/.port-whisperer/audit.log`.
5. ✅ **Probe concurrency** — **Parallelize with a cap of 5 concurrent in-flight probes.** Queue the rest. Avoids flooding localhost with dozens of simultaneous HEAD requests when the user clicks "probe all".
6. ✅ **Dep bump** — **Accepted.** Full Vue 3 + Vite + TS + Tailwind + Pinia + Hono stack approved. Runtime additions: `hono`, `vue`, `pinia`. Dev additions: `vite`, `typescript`, `@vitejs/plugin-vue`, `vue-tsc`, `@tsconfig/node20`, `@types/node`, `tailwindcss`, `postcss`, `autoprefixer`.
7. ✅ **Out-of-scope items** — **No promotions.** The list in §1 stays deferred. v1 is already large.
