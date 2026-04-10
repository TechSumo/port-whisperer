<script setup lang="ts">
import { computed } from "vue";
import type { PortInfo } from "@/types/api";
import { usePortsStore } from "@/stores/ports";

const props = defineProps<{
  framework: string | null | undefined;
  // Optional port context — when provided, a null framework becomes
  // a clickable "probe" button. Port cells in the Ports table pass
  // this; the Processes table doesn't (we can't probe a process).
  port?: PortInfo;
}>();

const store = usePortsStore();

// Resolve the display value: client-side probed override > server value.
const effective = computed<string | null>(() => {
  if (props.framework) return props.framework;
  if (props.port) {
    const probed = (
      store.probedFrameworks as ReadonlyMap<number, string | null>
    ).get(props.port.port);
    if (probed) return probed;
  }
  return null;
});

const isProbing = computed<boolean>(() => {
  if (!props.port) return false;
  return (store.probing as ReadonlySet<number>).has(props.port.port);
});

// Everything stays phosphor green — we cluster by intensity instead
// of fighting the palette with rainbow accents.
const intensity = computed<"strong" | "medium" | "subtle">(() => {
  const f = (effective.value ?? "").toLowerCase();
  if (!f) return "subtle";
  if (
    f.includes("next") ||
    f.includes("nuxt") ||
    f.includes("vue") ||
    f.includes("react") ||
    f.includes("svelte") ||
    f.includes("angular") ||
    f.includes("astro") ||
    f.includes("remix") ||
    f.includes("gatsby") ||
    f.includes("vite") ||
    f.includes("solid") ||
    f.includes("qwik")
  )
    return "strong";
  if (
    f === "fastapi" ||
    f === "flask" ||
    f === "django" ||
    f === "rails" ||
    f === "express" ||
    f === "hono" ||
    f === "nestjs" ||
    f === "fastify" ||
    f === "koa" ||
    f === "phoenix" ||
    f === "spring boot"
  )
    return "strong";
  return "medium";
});

function onProbe(): void {
  if (props.port && !isProbing.value) {
    void store.probePort(props.port);
  }
}
</script>

<template>
  <span
    v-if="effective"
    class="inline-flex items-center border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.1em]"
    :class="{
      'border-accent/60 bg-accent/10 text-accent glow': intensity === 'strong',
      'border-accent/30 text-fg-muted': intensity === 'medium',
      'border-border text-fg-subtle': intensity === 'subtle',
    }"
  >
    {{ effective }}
  </span>

  <!-- Probing spinner -->
  <span
    v-else-if="isProbing"
    class="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-accent/80"
  >
    <span class="inline-block animate-pulse-dot">▢</span>
    probing
  </span>

  <!-- Clickable probe button — only when we have port context -->
  <button
    v-else-if="port"
    type="button"
    title="Probe this port over HTTP to identify the framework"
    aria-label="Probe framework"
    class="inline-flex items-center gap-1 border border-border px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] text-fg-subtle transition-colors duration-150 hover:border-accent/60 hover:text-accent"
    @click="onProbe"
  >
    <span class="font-bold">?</span>
    probe
  </button>

  <span v-else class="text-fg-subtle">—</span>
</template>
