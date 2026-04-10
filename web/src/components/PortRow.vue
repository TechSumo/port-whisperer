<script setup lang="ts">
import { computed } from "vue";
import type { PortInfo } from "@/types/api";
import StatusDot from "./StatusDot.vue";
import FrameworkBadge from "./FrameworkBadge.vue";

const props = defineProps<{
  port: PortInfo;
  index: number;
  isNew: boolean;
}>();

const uptime = computed(() => props.port.uptime ?? "—");
const memory = computed(() => props.port.memory ?? "—");
const projectName = computed(() => props.port.projectName ?? "—");
</script>

<template>
  <div
    class="row stagger grid items-center gap-4 border-b border-border/70 pl-10 pr-8 py-3.5 text-[14px]"
    :class="{ 'animate-flash-new': isNew }"
    :style="{
      '--i': index,
      gridTemplateColumns: '92px 1fr 100px 1fr 150px 96px 104px 120px',
    }"
  >
    <div class="text-fg">
      <span class="text-accent/70">:</span>{{ port.port }}
    </div>
    <div class="truncate text-fg-muted">{{ port.processName }}</div>
    <div class="text-[13px] text-fg-muted">{{ port.pid }}</div>
    <div class="truncate text-fg">{{ projectName }}</div>
    <div>
      <FrameworkBadge :framework="port.framework" />
    </div>
    <div class="text-[13px] text-fg-muted">{{ memory }}</div>
    <div class="text-[13px] text-fg-muted">{{ uptime }}</div>
    <div class="flex justify-end">
      <StatusDot :status="port.status" />
    </div>
  </div>
</template>
