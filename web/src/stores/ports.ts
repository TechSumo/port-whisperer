import { defineStore } from "pinia";
import { ref, computed, readonly } from "vue";
import type { PortInfo, ProcessInfo } from "@/types/api";

// Central store for port + process snapshots. Polling happens here
// so any component can subscribe without re-fetching. Once SSE lands
// in a later phase, startPolling() gets swapped for a streaming impl
// with the same public surface.
export const usePortsStore = defineStore("ports", () => {
  // --- state
  const ports = ref<PortInfo[]>([]);
  const processes = ref<ProcessInfo[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);
  const initialLoaded = ref(false);

  // Filter state
  const searchQuery = ref("");
  const selectedFrameworks = ref<Set<string>>(new Set());

  // New-port flash tracking — ports that appeared on the most recent poll.
  // Consumed by PortRow to apply the flash animation for ~2s.
  const recentlyNew = ref<Set<number>>(new Set());

  let pollTimer: number | null = null;
  let knownPorts: Set<number> = new Set();

  async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  async function refresh(): Promise<void> {
    try {
      const [nextPorts, nextProcesses] = await Promise.all([
        fetchJson<PortInfo[]>("/api/ports"),
        fetchJson<ProcessInfo[]>("/api/processes"),
      ]);

      // Detect newly appeared ports (used for the flash animation).
      if (initialLoaded.value) {
        const fresh: number[] = [];
        for (const p of nextPorts) {
          if (!knownPorts.has(p.port)) fresh.push(p.port);
        }
        if (fresh.length > 0) {
          const next = new Set(recentlyNew.value);
          for (const port of fresh) next.add(port);
          recentlyNew.value = next;
          // Clear each flagged port after the animation duration.
          for (const port of fresh) {
            window.setTimeout(() => {
              const updated = new Set(recentlyNew.value);
              updated.delete(port);
              recentlyNew.value = updated;
            }, 2000);
          }
        }
      }

      knownPorts = new Set(nextPorts.map((p) => p.port));
      ports.value = nextPorts;
      processes.value = nextProcesses;
      lastUpdated.value = new Date();
      error.value = null;
      initialLoaded.value = true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
  }

  async function hardRefresh(): Promise<void> {
    loading.value = true;
    await refresh();
    loading.value = false;
  }

  function startPolling(intervalMs = 2000): void {
    if (pollTimer !== null) return;
    void hardRefresh();
    pollTimer = window.setInterval(() => {
      void refresh();
    }, intervalMs);
  }

  function stopPolling(): void {
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // --- filtered views

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
    loading: readonly(loading),
    error: readonly(error),
    lastUpdated: readonly(lastUpdated),
    initialLoaded: readonly(initialLoaded),
    recentlyNew: readonly(recentlyNew),

    // filter state (writable — these are the mutation surface)
    searchQuery,
    selectedFrameworks: readonly(selectedFrameworks),

    // computed
    filteredPorts,
    filteredProcesses,
    availableFrameworks,

    // actions
    refresh,
    hardRefresh,
    startPolling,
    stopPolling,
    toggleFramework,
    clearFilters,
  };
});
