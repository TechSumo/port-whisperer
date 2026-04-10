<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  framework: string | null | undefined;
}>();

// In the Ports Console aesthetic, everything is phosphor green — but we
// still want at-a-glance clustering. Rather than introducing rainbow
// accent colors (which would fight the palette), we use opacity / weight
// variations on the single accent and a border intensity per ecosystem.
const intensity = computed<"strong" | "medium" | "subtle">(() => {
  const f = (props.framework ?? "").toLowerCase();
  if (!f) return "subtle";
  // Frontend frameworks → strong glow
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
    f.includes("vite")
  )
    return "strong";
  // Backend / API
  if (
    f === "fastapi" ||
    f === "flask" ||
    f === "django" ||
    f === "rails" ||
    f === "express" ||
    f === "hono" ||
    f === "nestjs" ||
    f === "fastify" ||
    f === "koa"
  )
    return "strong";
  // Languages
  if (
    f === "node.js" ||
    f === "python" ||
    f === "ruby" ||
    f === "go" ||
    f === "rust" ||
    f === "java"
  )
    return "medium";
  // Infrastructure
  return "medium";
});
</script>

<template>
  <span
    v-if="framework"
    class="inline-flex items-center border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.1em]"
    :class="{
      'border-accent/60 bg-accent/10 text-accent glow': intensity === 'strong',
      'border-accent/30 text-fg-muted': intensity === 'medium',
      'border-border text-fg-subtle': intensity === 'subtle',
    }"
  >
    {{ framework }}
  </span>
  <span v-else class="text-fg-subtle">—</span>
</template>
