<script setup lang="ts">
import { computed } from "vue";

// Inline SVG sparkline. 60×20 viewBox, accent-tinted stroke.
// Handles the edge cases:
//   - 0 points: render nothing visible
//   - 1 point:  render a flat horizontal line at the middle
//   - 2+ points: polyline normalized to [min, max] of the visible window
//
// Pure presentational — receives a numeric series and paints it.
// The store owns the history buffer; this component just draws.

const props = defineProps<{
  points: readonly number[];
  /** Label describing what the numbers represent, for aria-label. */
  label?: string;
}>();

const WIDTH = 60;
const HEIGHT = 20;
const PADDING_Y = 2;

const pathData = computed<string>(() => {
  const pts = props.points;
  if (pts.length === 0) return "";

  if (pts.length === 1) {
    // One point → flat line across the middle.
    const y = HEIGHT / 2;
    return `M 0 ${y} L ${WIDTH} ${y}`;
  }

  let min = Infinity;
  let max = -Infinity;
  for (const p of pts) {
    if (p < min) min = p;
    if (p > max) max = p;
  }

  const usableHeight = HEIGHT - PADDING_Y * 2;
  // Flat series (min === max): render a horizontal line at the middle.
  const range = max - min === 0 ? 1 : max - min;
  const stepX = pts.length > 1 ? WIDTH / (pts.length - 1) : 0;

  const coords: string[] = [];
  for (let i = 0; i < pts.length; i++) {
    const x = i * stepX;
    const normalized =
      max === min ? HEIGHT / 2 : HEIGHT - PADDING_Y - ((pts[i]! - min) / range) * usableHeight;
    coords.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${normalized.toFixed(1)}`);
  }
  return coords.join(" ");
});

const isEmpty = computed(() => props.points.length === 0);
</script>

<template>
  <svg
    v-if="!isEmpty"
    :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
    :width="WIDTH"
    :height="HEIGHT"
    class="sparkline block shrink-0"
    role="img"
    :aria-label="label ?? 'memory history'"
  >
    <path
      :d="pathData"
      fill="none"
      stroke="currentColor"
      stroke-width="1.2"
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
  </svg>
  <span
    v-else
    class="inline-block shrink-0"
    :style="{ width: `${WIDTH}px`, height: `${HEIGHT}px` }"
    aria-hidden="true"
  />
</template>

<style scoped>
.sparkline {
  color: rgb(var(--accent) / 0.8);
  filter: drop-shadow(0 0 3px rgb(var(--accent) / 0.28));
}
</style>
