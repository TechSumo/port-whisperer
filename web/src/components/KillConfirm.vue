<script setup lang="ts">
import { computed, useTemplateRef, watch } from "vue";
import { usePortsStore, type PendingAction } from "@/stores/ports";

const store = usePortsStore();
const dialogRef = useTemplateRef<HTMLDialogElement>("dialog-el");

// Narrow type for template access.
const pending = computed<PendingAction | null>(
  () => store.pendingAction as PendingAction | null,
);

const verb = computed(() =>
  pending.value?.kind === "restart" ? "Restart" : "Kill",
);

// When pendingAction becomes non-null, open the native dialog.
// The browser gives us focus trap + Esc-to-close for free.
watch(pending, (next) => {
  const el = dialogRef.value;
  if (!el) return;
  if (next) {
    if (!el.open) el.showModal();
  } else {
    if (el.open) el.close();
  }
});

function onCancel(): void {
  store.cancelAction();
}

function onConfirm(): void {
  void store.confirmAction();
}

function onDialogClose(): void {
  // Esc or backdrop click emits "close" — reflect that back into the store.
  if (store.pendingAction !== null) store.cancelAction();
}
</script>

<template>
  <dialog
    ref="dialog-el"
    class="bg-transparent backdrop:bg-bg/80 backdrop:backdrop-blur-sm text-fg"
    @close="onDialogClose"
    @cancel.prevent="onCancel"
  >
    <div
      v-if="pending"
      class="border border-border bg-bg p-8 font-mono text-[14px] min-w-[420px] max-w-[520px]"
    >
      <p class="text-[11px] uppercase tracking-[0.18em] text-fg-subtle">
        confirm
      </p>
      <h2 class="mt-1 text-lg font-semibold text-fg glow">
        {{ verb }} process?
      </h2>

      <dl class="mt-6 grid grid-cols-[88px_1fr] gap-x-4 gap-y-2 text-[13px]">
        <dt class="text-fg-subtle">Port</dt>
        <dd class="text-fg">
          <span class="text-accent/70">:</span>{{ pending.port.port }}
        </dd>

        <dt class="text-fg-subtle">PID</dt>
        <dd class="text-fg">{{ pending.port.pid }}</dd>

        <dt class="text-fg-subtle">Process</dt>
        <dd class="text-fg">{{ pending.port.processName }}</dd>

        <dt v-if="pending.port.projectName" class="text-fg-subtle">
          Project
        </dt>
        <dd v-if="pending.port.projectName" class="text-fg">
          {{ pending.port.projectName }}
        </dd>

        <dt v-if="pending.port.framework" class="text-fg-subtle">
          Framework
        </dt>
        <dd v-if="pending.port.framework" class="text-fg">
          {{ pending.port.framework }}
        </dd>
      </dl>

      <p
        v-if="pending.kind === 'restart'"
        class="mt-6 border-l-2 border-orphan/50 pl-3 text-[12px] leading-relaxed text-orphan/80"
      >
        restart runs <span class="font-bold">sh -c &lt;captured command&gt;</span>
        in the captured cwd, inheriting the server process env — NOT your
        original shell env. nvm, direnv, and interactive TTY processes may
        fail to come back.
      </p>

      <div class="mt-8 flex items-center justify-end gap-3">
        <button
          type="button"
          class="border border-border px-4 py-2 text-[13px] text-fg-muted transition-colors duration-150 hover:border-border-hover hover:text-fg"
          @click="onCancel"
        >
          cancel
        </button>
        <button
          type="button"
          class="border border-accent/60 bg-accent/10 px-4 py-2 text-[13px] font-semibold text-accent glow transition-colors duration-150 hover:bg-accent/20"
          @click="onConfirm"
        >
          {{ verb.toLowerCase() }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
/* Native dialog centering + border reset — Tailwind preflight doesn't
   fully cover dialog defaults. */
dialog {
  border: 0;
  padding: 0;
  margin: auto;
}
</style>
