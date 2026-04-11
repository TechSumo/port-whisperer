<script setup lang="ts">
import { computed } from "vue";
import type { PortInfo } from "@/types/api";
import { usePortsStore } from "@/stores/ports";
import { deriveRepoFolder } from "@/lib/paths";
import StatusDot from "./StatusDot.vue";
import FrameworkBadge from "./FrameworkBadge.vue";
import Sparkline from "./Sparkline.vue";

const props = defineProps<{
  port: PortInfo;
  index: number;
  isNew: boolean;
}>();

const store = usePortsStore();

const uptime = computed(() => props.port.uptime ?? "—");
const memory = computed(() => props.port.memory ?? "—");
const projectName = computed(() => props.port.projectName ?? null);
const repoFolder = computed(() => deriveRepoFolder(props.port.cwd));
const gitBranch = computed(() => props.port.gitBranch ?? null);
const isFocused = computed(() => store.focusedPort === props.port.port);

const isVsCode = computed(() =>
  (props.port.command ?? "").includes("/Applications/Visual Studio Code.app/"),
);
const isWorkspace = computed(() => repoFolder.value !== null);
// Replace the raw process name ("Code\x20H", "Code Helper (Plugin)", etc.)
// with a clean label — VS Code spawns a dozen helper processes and the
// raw names are a distraction in the table.
const displayProcessName = computed(() =>
  isVsCode.value ? "VS Code" : props.port.processName,
);

const memPoints = computed<number[]>(() => {
  const history = store.memoryHistory as ReadonlyMap<number, readonly number[]>;
  return [...(history.get(props.port.port) ?? [])];
});

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
      'row-workspace': isWorkspace,
    }"
    :style="{
      '--i': index,
      gridTemplateColumns:
        '92px 1fr 100px 1fr 140px 140px 96px 100px 72px',
    }"
    @click="onClick"
  >
    <div class="text-fg">
      <span class="text-accent/70">:</span>{{ port.port }}
    </div>
    <div class="flex min-w-0 items-center gap-2 truncate text-fg-muted">
      <svg
        v-if="isVsCode"
        viewBox="0 0 24 24"
        class="h-3.5 w-3.5 shrink-0 text-accent/90"
        fill="currentColor"
        aria-label="Visual Studio Code"
        role="img"
      >
        <path
          d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"
        />
      </svg>
      <span class="truncate">{{ displayProcessName }}</span>
    </div>
    <div class="text-[13px] text-fg-muted">{{ port.pid }}</div>
    <div class="min-w-0 truncate">
      <span v-if="repoFolder" class="text-fg glow">{{ repoFolder }}</span>
      <span
        v-if="repoFolder && projectName && projectName !== repoFolder"
        class="text-fg-subtle"
      >
        / {{ projectName }}</span
      >
      <span v-else-if="!repoFolder && projectName" class="text-fg">
        {{ projectName }}
      </span>
      <span v-else-if="!repoFolder && !projectName" class="text-fg-subtle">
        —
      </span>
      <span
        v-if="gitBranch"
        class="ml-2 inline-flex items-center gap-1 text-[12px] text-accent/85"
        :title="`git branch: ${gitBranch}`"
      >
        <svg
          viewBox="0 0 24 24"
          class="h-3 w-3 shrink-0"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.11.82-.26.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.627-5.373-12-12-12z"
          />
        </svg>
        {{ gitBranch }}
      </span>
    </div>
    <div>
      <FrameworkBadge :framework="port.framework" :port="port" />
    </div>
    <div class="flex items-center gap-2.5 text-[13px] text-fg-muted">
      <Sparkline :points="memPoints" label="memory over last 60s" />
      <span>{{ memory }}</span>
    </div>
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
