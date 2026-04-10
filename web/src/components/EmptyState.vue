<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <div class="flex h-full min-h-[280px] flex-col items-center justify-center px-6 py-24">
    <pre
      class="text-[11px] leading-tight text-accent/60 glow"
      aria-hidden="true"
    >  ┌─────────┐
  │  &gt;_&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│
  │         │
  └─────────┘</pre>
    <p class="mt-6 text-[14px] font-semibold uppercase tracking-[0.12em] text-fg">
      {{ title }}
    </p>
    <p v-if="description" class="mt-2 max-w-xs text-center text-[12px] text-fg-muted">
      {{ description }}
    </p>
  </div>
</template>
