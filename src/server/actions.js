/**
 * Kill + Restart action handlers (spec §3.4, §3.5).
 *
 * Both actions run against a PID supplied in the request body. Kill is
 * a direct signal. Restart looks up the command + cwd from the current
 * port snapshot (so the request body can't inject shell strings —
 * NFR-9) and then spawns the captured command detached in that cwd.
 *
 * All outcomes are logged to stderr for audit (NFR-10).
 */

import { spawn } from "node:child_process";
import { getListeningPorts, killProcess, pidExists } from "../scanner.js";

function auditLog(kind, details) {
  const ts = new Date().toISOString();
  console.error(`[${ts}] [${kind}] ${JSON.stringify(details)}`);
}

/**
 * Send a signal to a PID. force=true means SIGKILL, otherwise SIGTERM.
 * Returns { ok, pid, signal, error? }.
 */
export async function killAction(pid, { force = false } = {}) {
  const signal = force ? "SIGKILL" : "SIGTERM";
  try {
    const ok = killProcess(pid, signal);
    if (!ok) {
      const result = { ok: false, pid, signal, error: "kill failed" };
      auditLog("kill", result);
      return result;
    }
    const result = { ok: true, pid, signal };
    auditLog("kill", result);
    return result;
  } catch (err) {
    const result = {
      ok: false,
      pid,
      signal,
      error: err instanceof Error ? err.message : String(err),
    };
    auditLog("kill", result);
    return result;
  }
}

/**
 * Wait for a PID to exit, polling every 50ms up to `timeoutMs`.
 * Returns true if the PID is gone by the deadline, false if it's still alive.
 */
async function waitForExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!pidExists(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return !pidExists(pid);
}

/**
 * Best-effort restart of a listening process.
 *
 * Flow (FR-20):
 *   1. Fetch the port info matching this PID from the current snapshot
 *   2. SIGTERM the PID
 *   3. Wait up to 1 second for it to exit
 *   4. Spawn `sh -c <command>` in the captured cwd, detached, unref'd
 *
 * Restart does NOT work on Windows in v1 — no sh.
 * Returns { ok, pid, command?, cwd?, error?, stage? }.
 */
export async function restartAction(pid) {
  if (process.platform === "win32") {
    const result = {
      ok: false,
      pid,
      stage: "spawn",
      error: "restart not supported on win32 in v1",
    };
    auditLog("restart", result);
    return result;
  }

  // Stage 1: fetch
  let target;
  try {
    const snapshot = await getListeningPorts();
    target = snapshot.find((p) => p.pid === pid);
    if (!target) {
      const result = {
        ok: false,
        pid,
        stage: "fetch",
        error: "no listening port found for this PID",
      };
      auditLog("restart", result);
      return result;
    }
  } catch (err) {
    const result = {
      ok: false,
      pid,
      stage: "fetch",
      error: err instanceof Error ? err.message : String(err),
    };
    auditLog("restart", result);
    return result;
  }

  const command = target.command;
  const cwd = target.cwd;
  if (!command) {
    const result = {
      ok: false,
      pid,
      stage: "fetch",
      error: "scanner did not capture a command string for this process",
    };
    auditLog("restart", result);
    return result;
  }

  // Stage 2: kill
  try {
    const killed = killProcess(pid, "SIGTERM");
    if (!killed) {
      const result = {
        ok: false,
        pid,
        command,
        cwd,
        stage: "kill",
        error: "SIGTERM failed",
      };
      auditLog("restart", result);
      return result;
    }
  } catch (err) {
    const result = {
      ok: false,
      pid,
      command,
      cwd,
      stage: "kill",
      error: err instanceof Error ? err.message : String(err),
    };
    auditLog("restart", result);
    return result;
  }

  // Stage 3: wait for exit (up to 1s)
  await waitForExit(pid, 1000);

  // Stage 4: spawn replacement
  try {
    const child = spawn("sh", ["-c", command], {
      cwd: cwd || undefined,
      detached: true,
      stdio: "ignore",
      // Inherit server env — NOT the original shell env. UI warns about this.
    });
    child.on("error", (err) => {
      auditLog("restart", {
        ok: false,
        pid,
        command,
        cwd,
        stage: "spawn",
        error: err.message,
      });
    });
    child.unref();

    const result = { ok: true, pid, command, cwd };
    auditLog("restart", result);
    return result;
  } catch (err) {
    const result = {
      ok: false,
      pid,
      command,
      cwd,
      stage: "spawn",
      error: err instanceof Error ? err.message : String(err),
    };
    auditLog("restart", result);
    return result;
  }
}
