<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { usePortsStore } from "@/stores/ports";

const store = usePortsStore();
const now = ref(Date.now());

let interval: number | null = null;
onMounted(() => {
  interval = window.setInterval(() => {
    now.value = Date.now();
  }, 1000);
});
onUnmounted(() => {
  if (interval !== null) window.clearInterval(interval);
});

const elapsed = computed(() => {
  if (!store.lastUpdated) return "—";
  const delta = Math.max(
    0,
    Math.floor((now.value - store.lastUpdated.getTime()) / 1000),
  );
  if (delta < 2) return "just now";
  if (delta < 60) return `${delta}s ago`;
  const m = Math.floor(delta / 60);
  return `${m}m ago`;
});

const portCount = computed(() => store.ports.length);
const procCount = computed(() => store.processes.length);
</script>

<template>
  <header
    class="flex items-center justify-between gap-6 border-b border-border px-8 py-6"
  >
    <div class="flex items-baseline gap-3">
      <span class="text-[11px] uppercase tracking-[0.18em] text-fg-subtle">
        session
      </span>
      <h1 class="text-base font-semibold tracking-tight text-fg glow cursor">
        port::TechSumo
      </h1>
    </div>

    <div class="flex items-center gap-5 text-sm">
      <div class="flex items-center gap-2.5 text-fg-muted">
        <span
          class="block h-2 w-2 rounded-full bg-accent animate-pulse-dot glow"
          aria-hidden="true"
        />
        <span>
          <span class="text-fg">{{ portCount }}</span>
          ports
        </span>
        <span class="text-fg-subtle">::</span>
        <span>
          <span class="text-fg">{{ procCount }}</span>
          processes
        </span>
        <span class="text-fg-subtle">::</span>
        <span>
          updated
          <span class="text-fg">{{ elapsed }}</span>
        </span>
      </div>
    </div>
  </header>
</template>
