<script setup lang="ts">
import { computed } from "vue";
import type { PortInfo } from "@/types/api";
import { usePortsStore } from "@/stores/ports";
import StatusDot from "./StatusDot.vue";
import FrameworkBadge from "./FrameworkBadge.vue";

const props = defineProps<{
  port: PortInfo;
  index: number;
  isNew: boolean;
}>();

const store = usePortsStore();

const uptime = computed(() => props.port.uptime ?? "—");
const memory = computed(() => props.port.memory ?? "—");
const projectName = computed(() => props.port.projectName ?? "—");
const isFocused = computed(() => store.focusedPort === props.port.port);

function onKill(): void {
  store.requestKill(props.port);
}
function onRestart(): void {
  store.requestRestart(props.port);
}
function onClick(): void {
  store.focusPort(props.port.port);
  void store.openDetail(props.port.port);
}
</script>

<template>
  <div
    class="row stagger grid items-center gap-4 border-b border-border/70 pl-10 pr-8 py-3.5 text-[14px] cursor-pointer"
    :class="{
      'animate-flash-new': isNew,
      'row-focused': isFocused,
    }"
    :style="{
      '--i': index,
      gridTemplateColumns:
        '92px 1fr 100px 1fr 150px 96px 96px 100px 72px',
    }"
    @click="onClick"
  >
    <div class="text-fg">
      <span class="text-accent/70">:</span>{{ port.port }}
    </div>
    <div class="truncate text-fg-muted">{{ port.processName }}</div>
    <div class="text-[13px] text-fg-muted">{{ port.pid }}</div>
    <div class="truncate text-fg">{{ projectName }}</div>
    <div>
      <FrameworkBadge :framework="port.framework" :port="port" />
    </div>
    <div class="text-[13px] text-fg-muted">{{ memory }}</div>
    <div class="text-[13px] text-fg-muted">{{ uptime }}</div>
    <div>
      <StatusDot :status="port.status" />
    </div>
    <div class="flex items-center justify-end gap-1">
      <button
        type="button"
        title="Restart"
        aria-label="Restart process"
        class="border border-transparent px-1.5 py-1 text-fg-subtle transition-colors duration-150 hover:border-accent/50 hover:text-accent"
        @click.stop="onRestart"
      >
        <svg
          viewBox="0 0 16 16"
          class="h-4 w-4"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M3 8a5 5 0 0 1 8.5-3.5L13 6" />
          <path d="M13 3v3h-3" />
          <path d="M13 8a5 5 0 0 1-8.5 3.5L3 10" />
          <path d="M3 13v-3h3" />
        </svg>
      </button>
      <button
        type="button"
        title="Kill"
        aria-label="Kill process"
        class="border border-transparent px-1.5 py-1 text-fg-subtle transition-colors duration-150 hover:border-zombie/60 hover:text-zombie"
        @click.stop="onKill"
      >
        <svg
          viewBox="0 0 16 16"
          class="h-4 w-4"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M3 3 L13 13" />
          <path d="M13 3 L3 13" />
        </svg>
      </button>
    </div>
  </div>
</template>
