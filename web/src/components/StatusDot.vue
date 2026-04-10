<script setup lang="ts">
import { computed } from "vue";
import type { PortStatus } from "@/types/api";

const props = defineProps<{
  status: PortStatus | undefined;
}>();

const variant = computed<"healthy" | "orphan" | "zombie">(() => {
  if (props.status === "orphaned") return "orphan";
  if (props.status === "zombie") return "zombie";
  return "healthy";
});

const label = computed(() => {
  if (props.status === "orphaned") return "orphaned";
  if (props.status === "zombie") return "zombie";
  return "healthy";
});
</script>

<template>
  <span
    class="inline-flex items-center gap-2 text-[12px] tracking-wide text-fg-muted"
  >
    <span
      class="block h-2 w-2 rounded-full"
      :class="{
        'bg-healthy shadow-[0_0_8px_rgb(var(--healthy)/0.6)]':
          variant === 'healthy',
        'bg-orphan shadow-[0_0_8px_rgb(var(--orphan)/0.6)]':
          variant === 'orphan',
        'bg-zombie shadow-[0_0_8px_rgb(var(--zombie)/0.6)]':
          variant === 'zombie',
      }"
      aria-hidden="true"
    />
    <span>{{ label }}</span>
  </span>
</template>
