# port-whisperer

**A beautiful CLI — and now a live web dashboard — to see what's running on your ports.**

Stop guessing which process is hogging port 3000. `port-whisperer` gives you a color-coded table of every dev server, database, and background process listening on your machine — with framework detection, Docker container identification, and interactive process management. Run it as a terminal command, or launch `ports serve` to get a phosphor-green Vue 3 dashboard in your browser with live SSE updates, kill/restart buttons, HTTP probing, and keyboard shortcuts.

## What it looks like

```
$ ports

 ┌─────────────────────────────────────┐
 │  Port Whisperer                     │
 │  listening to your ports...         │
 └─────────────────────────────────────┘

┌───────┬─────────┬───────┬──────────────────────┬────────────┬────────┬───────────┐
│ PORT  │ PROCESS │ PID   │ PROJECT              │ FRAMEWORK  │ UPTIME │ STATUS    │
├───────┼─────────┼───────┼──────────────────────┼────────────┼────────┼───────────┤
│ :3000 │ node    │ 42872 │ frontend             │ Next.js    │ 1d 9h  │ ● healthy │
├───────┼─────────┼───────┼──────────────────────┼────────────┼────────┼───────────┤
│ :3001 │ node    │ 95380 │ preview-app          │ Next.js    │ 2h 40m │ ● healthy │
├───────┼─────────┼───────┼──────────────────────┼────────────┼────────┼───────────┤
│ :4566 │ docker  │ 58351 │ backend-localstack-1 │ LocalStack │ 10d 3h │ ● healthy │
├───────┼─────────┼───────┼──────────────────────┼────────────┼────────┼───────────┤
│ :5432 │ docker  │ 58351 │ backend-postgres-1   │ PostgreSQL │ 10d 3h │ ● healthy │
├───────┼─────────┼───────┼──────────────────────┼────────────┼────────┼───────────┤
│ :6379 │ docker  │ 58351 │ backend-redis-1      │ Redis      │ 10d 3h │ ● healthy │
└───────┴─────────┴───────┴──────────────────────┴────────────┴────────┴───────────┘

  5 ports active  ·  Run ports <number> for details  ·  --all to show everything
```

Colors: green = healthy, yellow = orphaned, red = zombie.

## Install

```bash
npm install -g port-whisperer
```

Or run it directly without installing:

```bash
npx port-whisperer
```

### Or let Claude Code install it for you

If you use [Claude Code](https://claude.ai/code), you can ask it to `npm install -g port-whisperer` and start using `ports` right away -- no setup steps needed.

## Usage

### Show dev server ports

```bash
ports
```

Shows dev servers, Docker containers, and databases. System apps (Spotify, Raycast, etc.) are filtered out by default.

### Show all listening ports

```bash
ports --all
```

Includes system services, desktop apps, and everything else listening on your machine.

### Inspect a specific port

```bash
ports 3000
# or
whoisonport 3000
```

Detailed view: full process tree, repository path, current git branch, memory usage, and an interactive prompt to kill the process.

### Kill a process

```bash
ports kill 3000                # kill by port
ports kill 3000 5173 8080      # kill multiple
ports kill 3000-3010           # kill a port range
ports kill 42872               # kill by PID
ports kill -f 3000             # force kill (SIGKILL)
```

Resolves port to process automatically. Falls back to PID if no listener matches. Use `-f` when a process won't die gracefully.

Port ranges expand into individual kills -- empty ports are silently skipped and shown as a summary:

```
$ ports kill 3000-3005

  Killing :3000 — node (PID 42872)
  ✓ Sent SIGTERM to :3000 — node (PID 42872)
  Killing :3001 — node (PID 95380)
  ✓ Sent SIGTERM to :3001 — node (PID 95380)

  Range summary: 2 killed, 4 empty
```

### Show all dev processes

```bash
ports ps
```

A beautiful `ps aux` for developers. Shows all running dev processes (not just port-bound ones) with CPU%, memory, framework detection, and a smart description column. Docker processes are collapsed into a single summary row.

```
$ ports ps

┌───────┬─────────┬──────┬──────────┬──────────┬───────────┬─────────┬────────────────────────────────┐
│ PID   │ PROCESS │ CPU% │ MEM      │ PROJECT  │ FRAMEWORK │ UPTIME  │ WHAT                           │
├───────┼─────────┼──────┼──────────┼──────────┼───────────┼─────────┼────────────────────────────────┤
│ 592   │ Docker  │ 1.3  │ 735.5 MB │ —        │ Docker    │ 13d 12h │ 14 processes                   │
├───────┼─────────┼──────┼──────────┼──────────┼───────────┼─────────┼────────────────────────────────┤
│ 36664 │ python3 │ 0.2  │ 17.6 MB  │ —        │ Python    │ 6d 10h  │ browser_use.skill_cli.daemon   │
├───────┼─────────┼──────┼──────────┼──────────┼───────────┼─────────┼────────────────────────────────┤
│ 26408 │ node    │ 0.1  │ 9.2 MB   │ —        │ Node.js   │ 10d 13h │ jest jest_runner_cloud.js      │
├───────┼─────────┼──────┼──────────┼──────────┼───────────┼─────────┼────────────────────────────────┤
│ 25752 │ node    │ 0.0  │ 17.3 MB  │ —        │ Node.js   │ 10d 13h │ server.js                      │
├───────┼─────────┼──────┼──────────┼──────────┼───────────┼─────────┼────────────────────────────────┤
│ 66921 │ Python  │ 0.0  │ 4.1 MB   │ —        │ Python    │ 2h 25m  │ src.server                     │
└───────┴─────────┴──────┴──────────┴──────────┴───────────┴─────────┴────────────────────────────────┘

  5 processes  ·  --all to show everything
```

```bash
ports ps --all    # show all processes, not just dev
```

### Clean up orphaned processes

```bash
ports clean
```

Finds and kills orphaned or zombie dev server processes. Only targets dev runtimes (node, python, etc.) -- won't touch your desktop apps.

### Watch for port changes

```bash
ports watch
```

Real-time monitoring that notifies you whenever a port starts or stops listening.

### Open the web dashboard

```bash
ports serve                     # start on :7777
ports serve --port 8080         # different port
ports serve --open              # also open in your browser
```

Starts a local-only HTTP server (`127.0.0.1`, never `0.0.0.0`) that serves a Vue 3 + Vite single-page dashboard. Same data the CLI shows, but as a dense live table you can click around in. Polling is replaced by a Server-Sent Events stream from the same scanner code, so new ports, killed ports, and updates flow in within ~2 seconds of the actual change.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ >_ TechSumo                 port::TechSumo ▌  ● 12 ports · 723 procs    │
│    PORTS CONSOLE                              · updated just now         │
│                                                                          │
│  ▸ Ports                 > :3000    node    42872  frontend   Nuxt   ↻ ✕│
│    Processes             > :3001    node    95380  dashboard  Nuxt   ↻ ✕│
│                            :4321    python3 44562  —          [? probe] │
│  Filters                   :5432    docker  58351  postgres-1 PSQL   ↻ ✕│
│  ┌──────────────────────┐  :6379    docker  58351  redis-1    Redis  ↻ ✕│
│  │ ? port pid project...│  :9000    Python  74263  backend    FastAPI↻ ✕│
│  └──────────────────────┘                                                │
│                                                                          │
│  [ Nuxt ] [ FastAPI ]                                                    │
│                                                                          │
│  Presets                                                                 │
│  └ frontend                                                              │
│  └ backend                                                               │
│                                                                          │
│  ● live :: clear                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**What you get:**
- **Live table** — Server-Sent Events, no polling from the browser. New ports flash into the row list, killed ports fade out.
- **Kill + restart per row** — dedicated icon buttons open a confirm modal. Restart does a best-effort `sh -c <captured command>` in the captured cwd.
- **HTTP probe** — click `[? probe]` on a row where framework detection missed, and the server sends a fast `GET /` to read `X-Powered-By` / `Server` / `<meta generator>`. Result cached 60s.
- **Filters** — framework multi-select, port/pid/project/framework text search. Save them as **presets** that persist in `~/.port-whisperer/config.json`.
- **Detail slide-over** — click any row to pop a panel with command, cwd, git branch, memory, uptime, process tree, framework, and row-level kill/restart buttons.
- **Keyboard shortcuts** — `↑`/`↓` navigate rows, `k` kill, `r` restart, `d` open detail, `/` focus search, `Esc` close dialog / clear filters.
- **"Ports Console" aesthetic** — JetBrains Mono throughout, phosphor-green CRT palette, subtle scanline overlay, glow on accents. Dark-only.

**How it's built:**
- Backend: [Hono](https://hono.dev) on Node, reuses `src/scanner.js` verbatim — no duplicate code for CLI vs. web.
- Frontend: Vue 3 + Vite + TypeScript + Tailwind + Pinia, built once to `web/dist/`, served as static files by Hono.
- SSE endpoint: one shared polling loop feeds every connected browser. Zero clients → the loop idles.
- All POSTs are Origin-header CSRF guarded. Scanner command strings are never interpolated from request bodies — restart re-runs the command that was already running.

**Dev mode:**
```bash
npm run web:dev      # vite dev with HMR, proxies /api and /events to 7777
npm run web:build    # production build to web/dist/
```

In dev mode you want both running:
```bash
ports serve --port 7777    # terminal 1: backend
npm run web:dev            # terminal 2: Vite dev server on :5173
```

Then open `http://localhost:5173`. The Vite proxy forwards API and SSE calls to `:7777`.

## How it works

Three shell calls, runs in ~0.2s:

1. **`lsof -iTCP -sTCP:LISTEN`** -- finds all processes listening on TCP ports
2. **`ps`** (single batched call) -- retrieves process details for all PIDs at once: command line, uptime, memory, parent PID, status
3. **`lsof -d cwd`** (single batched call) -- resolves the working directory of each process to detect the project and framework

For Docker ports, a single `docker ps` call maps host ports to container names and images.

Framework detection runs three strategies in order: a deep scan of `package.json` (dependencies + devDependencies + peerDependencies + scripts text, so monorepo roots with `next dev` in a script work even without a direct `next` dep), extended command-line pattern matching (Next.js, Vite, Nuxt, Angular, Remix, Astro, Gatsby, NestJS, Bun, Deno, uvicorn/hypercorn/granian → FastAPI, daphne → Django, gunicorn, Rails, Phoenix, Spring Boot, .NET), and — in the web dashboard only, on demand — a fast HTTP probe that reads `X-Powered-By` / `Server` headers and `<meta name="generator">`. Docker images are identified as PostgreSQL, Redis, MongoDB, LocalStack, nginx, etc.

## Platform support

| Platform | Status |
|----------|--------|
| macOS    | Supported |
| Linux    | Supported |
| Windows  | Supported |

## License

[MIT](LICENSE)
