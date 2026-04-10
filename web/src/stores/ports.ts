import { defineStore } from "pinia";
import { ref, computed, readonly } from "vue";
import type { PortInfo, ProcessInfo } from "@/types/api";

// Central store for port + process snapshots.
//
// Ports come via SSE on /events (phase 3):
//   - Initial bootstrap: a burst of `new` events for every currently
//     listening port. These should NOT trigger the flash animation.
//   - Live updates: incremental `new` / `update` / `gone` / `heartbeat`
//     events from the shared server poll loop.
//
// Processes continue to use a slow poll (3s) on /api/processes — the
// spec scopes SSE to ports only, and processes are secondary context
// so a slower cadence is fine.

type SSEEvent =
  | { type: "new"; port: PortInfo }
  | { type: "update"; port: PortInfo }
  | { type: "gone"; port: number }
  | { type: "heartbeat" };

export type PendingAction =
  | { kind: "kill"; port: PortInfo }
  | { kind: "restart"; port: PortInfo };

export interface Toast {
  id: number;
  tone: "success" | "error";
  message: string;
}

export const usePortsStore = defineStore("ports", () => {
  // --- state
  const ports = ref<PortInfo[]>([]);
  const processes = ref<ProcessInfo[]>([]);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);
  const initialLoaded = ref(false);
  const connected = ref(false);

  // Filter state
  const searchQuery = ref("");
  const selectedFrameworks = ref<Set<string>>(new Set());

  // Pending destructive action (drives the confirm modal)
  const pendingAction = ref<PendingAction | null>(null);

  // Toasts (success / failure feedback for kill + restart)
  const toasts = ref<Toast[]>([]);
  let nextToastId = 1;

  // New-port flash tracking — ports that just appeared live.
  // Consumed by PortRow to apply the flash animation for ~2s.
  const recentlyNew = ref<Set<number>>(new Set());

  let eventSource: EventSource | null = null;
  let processPollTimer: number | null = null;
  // Events arriving within this window after open() are the bootstrap
  // burst and must not trigger flash animation.
  let bootstrapUntil = 0;

  // --- SSE plumbing

  function markNew(port: number): void {
    const next = new Set(recentlyNew.value);
    next.add(port);
    recentlyNew.value = next;
    window.setTimeout(() => {
      const updated = new Set(recentlyNew.value);
      updated.delete(port);
      recentlyNew.value = updated;
    }, 2000);
  }

  function applyEvent(ev: SSEEvent): void {
    lastUpdated.value = new Date();

    if (ev.type === "heartbeat") return;

    if (ev.type === "new") {
      const incoming = ev.port;
      // Skip duplicates if the server replays something.
      if (ports.value.some((p) => p.port === incoming.port)) return;
      const next = [...ports.value, incoming].sort((a, b) => a.port - b.port);
      ports.value = next;
      initialLoaded.value = true;
      // Only trigger the flash if this event arrives AFTER the
      // bootstrap window — bootstrap ports should appear silently.
      if (Date.now() > bootstrapUntil) {
        markNew(incoming.port);
      }
      return;
    }

    if (ev.type === "update") {
      const incoming = ev.port;
      const idx = ports.value.findIndex((p) => p.port === incoming.port);
      if (idx < 0) {
        // Update for a port we don't have yet — treat as new.
        const next = [...ports.value, incoming].sort((a, b) => a.port - b.port);
        ports.value = next;
        return;
      }
      const next = [...ports.value];
      next[idx] = incoming;
      ports.value = next;
      return;
    }

    if (ev.type === "gone") {
      const goneNumber = ev.port;
      ports.value = ports.value.filter((p) => p.port !== goneNumber);
      return;
    }
  }

  function openEventStream(): void {
    if (eventSource !== null) return;
    bootstrapUntil = Date.now() + 500;
    const es = new EventSource("/events");
    es.onopen = () => {
      connected.value = true;
      error.value = null;
    };
    es.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data) as SSEEvent;
        applyEvent(parsed);
      } catch (e) {
        // Malformed frame — log and drop, don't crash the stream.
        console.error("[ports store] failed to parse SSE event:", e, msg.data);
      }
    };
    es.onerror = () => {
      // EventSource handles its own reconnect. We just reflect the
      // visible status — no hard failure here.
      connected.value = false;
    };
    eventSource = es;
  }

  function closeEventStream(): void {
    if (eventSource !== null) {
      eventSource.close();
      eventSource = null;
    }
    connected.value = false;
  }

  // --- process polling (SSE scopes only to ports)

  async function refreshProcesses(): Promise<void> {
    try {
      const res = await fetch("/api/processes");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      processes.value = (await res.json()) as ProcessInfo[];
      error.value = null;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
  }

  function startProcessPolling(intervalMs = 3000): void {
    if (processPollTimer !== null) return;
    void refreshProcesses();
    processPollTimer = window.setInterval(() => {
      void refreshProcesses();
    }, intervalMs);
  }

  function stopProcessPolling(): void {
    if (processPollTimer !== null) {
      window.clearInterval(processPollTimer);
      processPollTimer = null;
    }
  }

  // --- kill / restart actions (phase 4)

  function pushToast(tone: Toast["tone"], message: string): void {
    const id = nextToastId++;
    toasts.value = [...toasts.value, { id, tone, message }];
    window.setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, 4500);
  }

  function dismissToast(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  function requestKill(port: PortInfo): void {
    pendingAction.value = { kind: "kill", port };
  }

  function requestRestart(port: PortInfo): void {
    pendingAction.value = { kind: "restart", port };
  }

  function cancelAction(): void {
    pendingAction.value = null;
  }

  async function confirmAction(): Promise<void> {
    const action = pendingAction.value;
    if (!action) return;
    pendingAction.value = null;

    const { kind, port } = action;
    const endpoint = kind === "kill" ? "/api/kill" : "/api/restart";
    const label = `:${port.port} — ${port.processName} (PID ${port.pid})`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pid: port.pid }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        error?: string;
        stage?: string;
      };
      if (body.ok) {
        pushToast(
          "success",
          kind === "kill"
            ? `killed ${label}`
            : `restarted ${label}`,
        );
      } else {
        const stage = body.stage ? ` [${body.stage}]` : "";
        pushToast(
          "error",
          `${kind} failed${stage}: ${body.error ?? "unknown error"}`,
        );
      }
    } catch (e) {
      pushToast(
        "error",
        `${kind} request failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // --- public start / stop

  function start(): void {
    openEventStream();
    startProcessPolling();
  }

  function stop(): void {
    closeEventStream();
    stopProcessPolling();
  }

  // --- filtered views (unchanged from previous impl)

  const filteredPorts = computed<PortInfo[]>(() => {
    const q = searchQuery.value.trim().toLowerCase();
    return ports.value.filter((p) => {
      if (selectedFrameworks.value.size > 0) {
        if (!p.framework || !selectedFrameworks.value.has(p.framework)) {
          return false;
        }
      }
      if (!q) return true;
      const haystack = [
        String(p.port),
        String(p.pid),
        p.processName,
        p.projectName ?? "",
        p.framework ?? "",
        p.command ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  });

  const filteredProcesses = computed<ProcessInfo[]>(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return processes.value;
    return processes.value.filter((p) => {
      const haystack = [
        String(p.pid),
        p.processName,
        p.projectName ?? "",
        p.framework ?? "",
        p.command ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  });

  const availableFrameworks = computed<string[]>(() => {
    const seen = new Set<string>();
    for (const p of ports.value) {
      if (p.framework) seen.add(p.framework);
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
  });

  function toggleFramework(name: string): void {
    const next = new Set(selectedFrameworks.value);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    selectedFrameworks.value = next;
  }

  function clearFilters(): void {
    searchQuery.value = "";
    selectedFrameworks.value = new Set();
  }

  return {
    // state (readonly for safety)
    ports: readonly(ports),
    processes: readonly(processes),
    error: readonly(error),
    lastUpdated: readonly(lastUpdated),
    initialLoaded: readonly(initialLoaded),
    connected: readonly(connected),
    recentlyNew: readonly(recentlyNew),
    pendingAction: readonly(pendingAction),
    toasts: readonly(toasts),

    // filter state (writable)
    searchQuery,
    selectedFrameworks: readonly(selectedFrameworks),

    // computed
    filteredPorts,
    filteredProcesses,
    availableFrameworks,

    // actions
    start,
    stop,
    toggleFramework,
    clearFilters,
    requestKill,
    requestRestart,
    confirmAction,
    cancelAction,
    dismissToast,
  };
});
