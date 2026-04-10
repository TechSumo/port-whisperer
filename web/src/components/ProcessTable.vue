<script setup lang="ts">
import { computed } from "vue";
import { usePortsStore } from "@/stores/ports";
import FrameworkBadge from "./FrameworkBadge.vue";
import EmptyState from "./EmptyState.vue";

const store = usePortsStore();
const rows = computed(() => store.filteredProcesses);

function cpuBar(cpu: number): string {
  const clamped = Math.max(0, Math.min(100, cpu));
  return `${clamped.toFixed(0)}%`;
}
</script>

<template>
  <section class="min-h-full">
    <!-- Column header -->
    <div
      class="sticky top-0 z-10 grid items-center gap-4 border-b border-border bg-bg/95 backdrop-blur-sm pl-10 pr-8 py-3 text-[11px] uppercase tracking-[0.16em] text-fg-subtle"
      :style="{
        gridTemplateColumns: '92px 1fr 92px 104px 150px 1fr 104px',
      }"
    >
      <div>PID</div>
      <div>Process</div>
      <div class="text-right">CPU</div>
      <div>Memory</div>
      <div>Framework</div>
      <div>Command</div>
      <div>Uptime</div>
    </div>

    <template v-if="!store.initialLoaded">
      <div
        v-for="i in 8"
        :key="i"
        class="grid items-center gap-4 border-b border-border/60 pl-10 pr-8 py-3.5"
        :style="{
          gridTemplateColumns: '92px 1fr 92px 104px 150px 1fr 104px',
        }"
      >
        <div class="h-3.5 w-14 animate-pulse bg-border" />
        <div class="h-3.5 w-32 animate-pulse bg-border" />
        <div class="h-3.5 w-10 animate-pulse bg-border" />
        <div class="h-3.5 w-16 animate-pulse bg-border" />
        <div class="h-3.5 w-20 animate-pulse bg-border" />
        <div class="h-3.5 w-44 animate-pulse bg-border" />
        <div class="h-3.5 w-14 animate-pulse bg-border" />
      </div>
    </template>

    <EmptyState
      v-else-if="rows.length === 0"
      title="no processes"
      description="nothing matches your search"
    />

    <template v-else>
      <div
        v-for="(proc, index) in rows"
        :key="proc.pid"
        class="row stagger grid items-center gap-4 border-b border-border/70 pl-10 pr-8 py-3.5 text-[14px]"
        :style="{
          '--i': Math.min(index, 60),
          gridTemplateColumns: '92px 1fr 92px 104px 150px 1fr 104px',
        }"
      >
        <div class="text-fg-muted">{{ proc.pid }}</div>
        <div class="truncate text-fg">{{ proc.processName }}</div>
        <div class="flex items-center justify-end gap-2">
          <span
            class="relative block h-1 w-12 overflow-hidden bg-border"
            aria-hidden="true"
          >
            <span
              class="absolute inset-y-0 left-0 bg-accent/80 glow"
              :style="{ width: cpuBar(proc.cpu) }"
            />
          </span>
          <span class="w-10 text-right text-[13px] text-fg-muted">
            {{ proc.cpu.toFixed(1) }}
          </span>
        </div>
        <div class="text-[13px] text-fg-muted">
          {{ proc.memory ?? "—" }}
        </div>
        <div>
          <FrameworkBadge :framework="proc.framework" />
        </div>
        <div class="truncate text-[13px] text-fg-muted">
          {{ proc.description ?? proc.command ?? "—" }}
        </div>
        <div class="text-[13px] text-fg-muted">
          {{ proc.uptime ?? "—" }}
        </div>
      </div>
    </template>
  </section>
</template>
