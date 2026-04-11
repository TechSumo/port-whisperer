<script setup lang="ts">
import { computed } from "vue";

// Small monochrome framework marks, all tinted currentColor so they
// inherit from the parent (phosphor green by default). The shapes are
// simplified silhouettes — visually unambiguous for anyone who already
// knows the brand, but not pixel-perfect recreations of the official
// logos. Keeps the bundle tiny and avoids dragging in an icon library.
//
// Returns null for frameworks we don't have an icon for — the parent
// should render text only in that case.

const props = defineProps<{
  framework: string | null | undefined;
  /** Pixel size of the square viewport. Defaults to 14. */
  size?: number;
}>();

const size = computed(() => props.size ?? 14);

type IconKey =
  | "nuxt"
  | "node"
  | "postgres"
  | "docker"
  | "fastapi"
  | "mysql"
  | "vite";

const match = computed<IconKey | null>(() => {
  const f = (props.framework ?? "").toLowerCase();
  if (!f) return null;
  if (f.includes("nuxt")) return "nuxt";
  if (f.includes("node") || f === "node.js") return "node";
  if (f === "postgresql" || f === "postgres") return "postgres";
  if (f === "docker") return "docker";
  if (f === "fastapi") return "fastapi";
  if (f === "mysql") return "mysql";
  if (f === "vite") return "vite";
  return null;
});

const hasIcon = computed(() => match.value !== null);
</script>

<template>
  <svg
    v-if="hasIcon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    class="shrink-0 inline-block"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="framework ?? undefined"
  >
    <!-- Nuxt — mountain silhouette with an inner peak. -->
    <path
      v-if="match === 'nuxt'"
      d="M3 20 L10 8 L14 14 L16 11 L21 20 Z"
      fill="currentColor"
      stroke="none"
    />

    <!-- Node.js — classic hexagon. -->
    <path
      v-else-if="match === 'node'"
      d="M12 2 L21 7 V17 L12 22 L3 17 V7 Z"
    />

    <!-- PostgreSQL — database cylinder (three stacked rings). -->
    <g v-else-if="match === 'postgres'">
      <ellipse cx="12" cy="6" rx="7" ry="2" />
      <path d="M5 6 V18 C5 19.1 8.134 20 12 20 C15.866 20 19 19.1 19 18 V6" />
      <path d="M5 12 C5 13.1 8.134 14 12 14 C15.866 14 19 13.1 19 12" />
    </g>

    <!-- Docker — cargo containers with a whale-tail curl. -->
    <g v-else-if="match === 'docker'">
      <rect x="2" y="11" width="3.5" height="3.5" fill="currentColor" stroke="none" />
      <rect x="6.2" y="11" width="3.5" height="3.5" fill="currentColor" stroke="none" />
      <rect x="10.4" y="11" width="3.5" height="3.5" fill="currentColor" stroke="none" />
      <rect x="6.2" y="6.8" width="3.5" height="3.5" fill="currentColor" stroke="none" />
      <rect x="10.4" y="6.8" width="3.5" height="3.5" fill="currentColor" stroke="none" />
      <path d="M15 14.5 C17 17 20 18 22 17.5" />
    </g>

    <!-- FastAPI — lightning bolt inside a circle. -->
    <g v-else-if="match === 'fastapi'">
      <circle cx="12" cy="12" r="10" />
      <path
        d="M11.5 4 L7.5 13 H11 L10 20 L16.5 10 H12.5 Z"
        fill="currentColor"
        stroke="none"
      />
    </g>

    <!-- MySQL — dolphin curve over a database cylinder. -->
    <g v-else-if="match === 'mysql'">
      <path d="M2 8 C6 3 11 3 13 8 C15 3 20 4 22 9" />
      <ellipse cx="12" cy="14" rx="9" ry="2" />
      <path d="M3 14 V19 C3 20 7 21 12 21 C17 21 21 20 21 19 V14" />
    </g>

    <!-- Vite — stylized "flame" / triangle gradient feel. -->
    <g v-else-if="match === 'vite'">
      <path d="M12 3 L20 8 L12 22 L4 8 Z" />
      <path d="M12 10 L14 15 H10 Z" fill="currentColor" stroke="none" />
    </g>
  </svg>
</template>
