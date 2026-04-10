<script setup lang="ts">
import { computed } from "vue";
import { usePortsStore } from "@/stores/ports";
import type { PortInfo } from "@/types/api";

const store = usePortsStore();

// Pull the live port snapshot from the store. SSE updates flow through
// here automatically, so memory / uptime / status stay fresh while the
// panel is open.
const port = computed<PortInfo | null>(() => {
  const target = store.detailPort;
  if (target === null) return null;
  return (store.ports as readonly PortInfo[]).find((p) => p.port === target) ?? null;
});

const isOpen = computed(() => store.detailPort !== null);

const formattedStart = computed(() => {
  const raw = port.value?.startTime;
  if (!raw) return null;
  try {
    return new Date(raw).toLocaleString();
  } catch {
    return raw;
  }
});

function onClose(): void {
  store.closeDetail();
}

function onBackdropClick(): void {
  store.closeDetail();
}

// Stop clicks inside the panel from bubbling to the backdrop.
function stopProp(e: Event): void {
  e.stopPropagation();
}
</script>

<template>
  <Transition name="detail">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[80] flex justify-end bg-bg/60 backdrop-blur-[2px]"
      @click="onBackdropClick"
    >
      <section
        class="detail-panel h-full w-[460px] max-w-[92vw] overflow-y-auto border-l border-border bg-bg"
        @click="stopProp"
      >
        <header
          class="sticky top-0 flex items-center justify-between border-b border-border bg-bg/95 px-7 py-5 backdrop-blur-sm"
        >
          <div>
            <p class="text-[11px] uppercase tracking-[0.18em] text-fg-subtle">
              port detail
            </p>
            <h2
              v-if="port"
              class="mt-0.5 text-lg font-semibold text-fg glow"
            >
              <span class="text-accent/70">:</span>{{ port.port }}
            </h2>
          </div>
          <button
            type="button"
            title="Close (Esc)"
            aria-label="Close detail panel"
            class="border border-border px-2.5 py-1.5 text-fg-subtle transition-colors hover:border-border-hover hover:text-fg"
            @click="onClose"
          >
            <svg
              viewBox="0 0 16 16"
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M3 3 L13 13" />
              <path d="M13 3 L3 13" />
            </svg>
          </button>
        </header>

        <div v-if="port" class="px-7 py-6 text-[13px] space-y-7">
          <section>
            <h3
              class="mb-3 text-[10px] uppercase tracking-[0.18em] text-fg-subtle"
            >
              process
            </h3>
            <dl class="grid grid-cols-[110px_1fr] gap-x-4 gap-y-2">
              <dt class="text-fg-subtle">Process</dt>
              <dd class="text-fg">{{ port.processName }}</dd>

              <dt class="text-fg-subtle">PID</dt>
              <dd class="text-fg">{{ port.pid }}</dd>

              <dt class="text-fg-subtle">Status</dt>
              <dd
                class="text-fg"
                :class="{
                  'text-healthy': port.status === 'healthy',
                  'text-orphan': port.status === 'orphaned',
                  'text-zombie': port.status === 'zombie',
                }"
              >
                ● {{ port.status ?? "unknown" }}
              </dd>

              <dt class="text-fg-subtle">Framework</dt>
              <dd class="text-fg">{{ port.framework ?? "—" }}</dd>

              <dt class="text-fg-subtle">Memory</dt>
              <dd class="text-fg">{{ port.memory ?? "—" }}</dd>

              <dt class="text-fg-subtle">Uptime</dt>
              <dd class="text-fg">{{ port.uptime ?? "—" }}</dd>

              <dt v-if="formattedStart" class="text-fg-subtle">Started</dt>
              <dd v-if="formattedStart" class="text-fg">
                {{ formattedStart }}
              </dd>
            </dl>
          </section>

          <section v-if="port.projectName || port.cwd || store.detailExtras?.gitBranch">
            <h3
              class="mb-3 text-[10px] uppercase tracking-[0.18em] text-fg-subtle"
            >
              location
            </h3>
            <dl class="grid grid-cols-[110px_1fr] gap-x-4 gap-y-2">
              <dt v-if="port.projectName" class="text-fg-subtle">Project</dt>
              <dd v-if="port.projectName" class="text-fg">
                {{ port.projectName }}
              </dd>

              <dt v-if="port.cwd" class="text-fg-subtle">Directory</dt>
              <dd
                v-if="port.cwd"
                class="break-all text-fg"
                :title="port.cwd"
              >
                {{ port.cwd }}
              </dd>

              <dt v-if="store.detailExtras?.gitBranch" class="text-fg-subtle">
                Git branch
              </dt>
              <dd v-if="store.detailExtras?.gitBranch" class="text-accent">
                {{ store.detailExtras.gitBranch }}
              </dd>
            </dl>
          </section>

          <section v-if="port.command">
            <h3
              class="mb-3 text-[10px] uppercase tracking-[0.18em] text-fg-subtle"
            >
              command
            </h3>
            <pre
              class="whitespace-pre-wrap break-all border border-border bg-bg-elevated/40 px-3 py-2.5 text-[12px] text-fg-muted"
            >{{ port.command }}</pre>
          </section>

          <section>
            <h3
              class="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-fg-subtle"
            >
              process tree
              <span v-if="store.detailLoading" class="text-accent/60">
                · loading
              </span>
            </h3>
            <ul
              v-if="store.detailExtras && store.detailExtras.processTree.length > 0"
              class="space-y-1 border-l border-border pl-4 text-[12px] text-fg-muted"
            >
              <li
                v-for="(node, index) in store.detailExtras.processTree"
                :key="node.pid"
                class="flex items-center gap-3"
              >
                <span class="text-accent/60">
                  {{ index === 0 ? "▸" : "└" }}
                </span>
                <span class="text-fg">{{ node.name }}</span>
                <span class="text-fg-subtle">({{ node.pid }})</span>
              </li>
            </ul>
            <p
              v-else-if="!store.detailLoading"
              class="text-[12px] text-fg-subtle"
            >
              no parent process information
            </p>
          </section>

          <section class="flex items-center gap-2 border-t border-border pt-6">
            <button
              type="button"
              class="border border-accent/60 bg-accent/10 px-4 py-2 text-[13px] font-semibold text-accent glow transition-colors hover:bg-accent/20"
              @click="store.requestRestart(port)"
            >
              restart
            </button>
            <button
              type="button"
              class="border border-zombie/60 px-4 py-2 text-[13px] font-semibold text-zombie transition-colors hover:bg-zombie/10"
              @click="store.requestKill(port)"
            >
              kill
            </button>
          </section>
        </div>

        <div v-else class="px-7 py-6 text-[13px] text-fg-subtle">
          port no longer listening
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
/* Slide-over animation — backdrop fades, panel slides from the right. */
.detail-enter-active,
.detail-leave-active {
  transition: opacity 220ms cubic-bezier(0.16, 1, 0.3, 1);
}
.detail-enter-active .detail-panel,
.detail-leave-active .detail-panel {
  transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
}
.detail-enter-from,
.detail-leave-to {
  opacity: 0;
}
.detail-enter-from .detail-panel,
.detail-leave-to .detail-panel {
  transform: translateX(100%);
}
</style>
