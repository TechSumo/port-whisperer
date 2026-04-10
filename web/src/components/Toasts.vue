<script setup lang="ts">
import { computed } from "vue";
import { usePortsStore, type Toast } from "@/stores/ports";

const store = usePortsStore();
const toasts = computed<readonly Toast[]>(
  () => store.toasts as readonly Toast[],
);

function onDismiss(id: number): void {
  store.dismissToast(id);
}
</script>

<template>
  <div
    v-if="toasts.length > 0"
    class="pointer-events-none fixed top-6 right-6 z-[100] flex flex-col items-end gap-2"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="pointer-events-auto cursor-pointer border-2 px-5 py-3 text-[14px] font-mono animate-fade-up min-w-[300px]"
      :class="{
        'border-accent bg-bg text-accent glow shadow-[0_0_32px_rgb(var(--accent)/0.3),0_8px_24px_rgb(var(--bg)/0.8)]':
          toast.tone === 'success',
        'border-zombie bg-bg text-zombie shadow-[0_0_32px_rgb(var(--zombie)/0.3),0_8px_24px_rgb(var(--bg)/0.8)]':
          toast.tone === 'error',
      }"
      @click="onDismiss(toast.id)"
    >
      <span class="mr-3 font-bold">
        {{ toast.tone === "success" ? "[ok]" : "[error]" }}
      </span>
      {{ toast.message }}
    </div>
  </div>
</template>
