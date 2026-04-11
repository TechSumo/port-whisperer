/**
 * Shared SSE stream for port changes.
 *
 * Design (spec §3.3, FR-9 through FR-13):
 *   - ONE polling loop feeds every connected subscriber. Zero subscribers →
 *     the loop stops; it restarts when the first client connects.
 *   - Each poll diffs the previous snapshot against the new one and emits
 *     `new` / `gone` / `update` events. Unchanged ports are silent.
 *   - A separate heartbeat timer emits `{type: "heartbeat"}` every 30 s so
 *     proxies and idle-timeout middleware don't drop the connection.
 *   - Scanner exceptions are caught and logged — the loop survives them.
 *
 * Why this lives in its own file: the state (subscriber set, previous
 * snapshot, timers) is module-scoped. Keeping it out of index.js prevents
 * accidental coupling with the Hono route definitions and makes the test
 * surface explicit.
 */

import { getListeningPorts } from "../scanner.js";

const POLL_INTERVAL_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 30_000;

/** Module-scoped singleton state. */
const state = {
  /** @type {Set<(event: object) => void>} */
  subscribers: new Set(),
  /** @type {Map<number, import("../scanner.js").PortInfo>} */
  previousSnapshot: new Map(),
  /** @type {ReturnType<typeof setInterval> | null} */
  pollTimer: null,
  /** @type {ReturnType<typeof setInterval> | null} */
  heartbeatTimer: null,
};

/**
 * Compact signature of a port. If signatures differ between polls, we
 * emit an `update` event. Covers everything the UI visibly cares about —
 * ignores command strings and cwds which don't change for a live process.
 */
function signature(info) {
  return [
    info.pid,
    info.status ?? "healthy",
    info.memory ?? "",
    info.uptime ?? "",
    info.framework ?? "",
    info.processName,
    info.gitBranch ?? "",
  ].join("|");
}

/**
 * Diff two snapshots and return the list of SSE events to emit.
 * Pure function — exported for testing.
 */
export function computeDiff(prev, next) {
  const events = [];

  for (const [port, info] of next) {
    const prevInfo = prev.get(port);
    if (!prevInfo) {
      events.push({ type: "new", port: info });
    } else if (signature(prevInfo) !== signature(info)) {
      events.push({ type: "update", port: info });
    }
  }

  for (const port of prev.keys()) {
    if (!next.has(port)) {
      events.push({ type: "gone", port });
    }
  }

  return events;
}

async function tick() {
  if (state.subscribers.size === 0) return;
  try {
    // gitBranches: true → scanner uses its lazy async cache. First
    // tick returns null branches (cache cold), subsequent ticks pick
    // up the populated values and the diff below will emit `update`
    // events so the frontend rerenders with the new branch.
    const fresh = await getListeningPorts({ gitBranches: true });
    const nextMap = new Map(fresh.map((p) => [p.port, p]));
    const events = computeDiff(state.previousSnapshot, nextMap);
    state.previousSnapshot = nextMap;
    for (const ev of events) {
      for (const send of state.subscribers) send(ev);
    }
  } catch (err) {
    // NFR-12: catch and continue, never crash the loop.
    console.error("[sse] poll failed:", err instanceof Error ? err.message : err);
  }
}

function emitHeartbeat() {
  if (state.subscribers.size === 0) return;
  for (const send of state.subscribers) send({ type: "heartbeat" });
}

function startLoopIfNeeded() {
  if (state.pollTimer === null) {
    state.pollTimer = setInterval(tick, POLL_INTERVAL_MS);
  }
  if (state.heartbeatTimer === null) {
    state.heartbeatTimer = setInterval(emitHeartbeat, HEARTBEAT_INTERVAL_MS);
  }
}

function stopLoopIfIdle() {
  if (state.subscribers.size > 0) return;
  if (state.pollTimer !== null) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
  if (state.heartbeatTimer !== null) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
  state.previousSnapshot = new Map();
}

/**
 * Register a subscriber. Returns the bootstrap snapshot (as "new" events)
 * the caller should emit immediately, plus an unsubscribe function.
 *
 * The caller is responsible for:
 *   - Calling `send` with each bootstrap event
 *   - Passing those events to the subscriber callback BEFORE subscribing
 *     (to avoid seeing duplicates from the next poll tick)
 *   - Calling the returned unsubscribe function on disconnect
 */
export async function subscribe(send) {
  // Prime the shared snapshot if this is the first subscriber, so the
  // diff baseline is correct for everyone.
  if (state.previousSnapshot.size === 0) {
    try {
      const initial = await getListeningPorts({ gitBranches: true });
      state.previousSnapshot = new Map(initial.map((p) => [p.port, p]));
    } catch (err) {
      console.error("[sse] initial snapshot failed:", err);
    }
  }

  // Give this subscriber a bootstrap view of the current world.
  const bootstrap = [];
  for (const info of state.previousSnapshot.values()) {
    bootstrap.push({ type: "new", port: info });
  }

  state.subscribers.add(send);
  startLoopIfNeeded();

  return {
    bootstrap,
    unsubscribe() {
      state.subscribers.delete(send);
      stopLoopIfIdle();
    },
  };
}

/**
 * Test-only: reset all module state. Lets the suite start from a clean
 * slate between cases.
 */
export function __resetForTests() {
  state.subscribers.clear();
  state.previousSnapshot = new Map();
  if (state.pollTimer !== null) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
  if (state.heartbeatTimer !== null) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
}

/** Test-only: inspect current subscriber count. */
export function __subscriberCount() {
  return state.subscribers.size;
}
