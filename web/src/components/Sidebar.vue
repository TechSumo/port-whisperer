<script setup lang="ts">
import { computed } from "vue";
import { usePortsStore } from "@/stores/ports";

type View = "ports" | "processes";

defineProps<{
  searchInputId?: string;
}>();

const view = defineModel<View>("view", { required: true });
const store = usePortsStore();

const views: Array<{ id: View; label: string; count: () => number }> = [
  { id: "ports", label: "Ports", count: () => store.ports.length },
  {
    id: "processes",
    label: "Processes",
    count: () => store.processes.length,
  },
];

const frameworks = computed(() => store.availableFrameworks);
const selected = computed(() => store.selectedFrameworks);

function isSelected(name: string): boolean {
  return (selected.value as ReadonlySet<string>).has(name);
}
</script>

<template>
  <aside
    class="flex w-[280px] shrink-0 flex-col border-r border-border bg-bg"
  >
    <!-- Brand slab -->
    <div class="border-b border-border px-6 py-6">
      <div class="flex items-center gap-2.5 text-fg">
        <span class="text-accent glow text-lg font-bold">&gt;_</span>
        <span class="text-sm font-semibold tracking-tight glow">
          TechSumo
        </span>
      </div>
      <p class="mt-1.5 text-[11px] uppercase tracking-[0.18em] text-fg-subtle">
        ports console
      </p>
    </div>

    <!-- View switcher -->
    <nav class="px-3 py-5">
      <p class="mb-2.5 px-3 text-[11px] uppercase tracking-[0.18em] text-fg-subtle">
        View
      </p>
      <ul class="space-y-0.5">
        <li v-for="item in views" :key="item.id">
          <button
            type="button"
            class="group flex w-full items-center justify-between px-3 py-2 text-left text-[14px] transition-colors duration-150"
            :class="
              view === item.id
                ? 'bg-bg-elevated text-fg glow'
                : 'text-fg-muted hover:bg-bg-elevated/60 hover:text-fg'
            "
            @click="view = item.id"
          >
            <span class="flex items-center gap-2.5">
              <span
                class="inline-block w-4 text-accent"
                :class="view === item.id ? 'glow' : 'opacity-30'"
              >
                {{ view === item.id ? "▸" : "·" }}
              </span>
              {{ item.label }}
            </span>
            <span class="text-[12px] text-fg-subtle">
              [{{ item.count() }}]
            </span>
          </button>
        </li>
      </ul>
    </nav>

    <!-- Filter bar -->
    <div class="border-t border-border px-6 py-5">
      <p class="mb-3 text-[11px] uppercase tracking-[0.18em] text-fg-subtle">
        Filters
      </p>

      <!-- Search -->
      <div class="relative mb-5">
        <span
          class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-accent/70"
          aria-hidden="true"
          >?</span
        >
        <input
          :id="searchInputId"
          v-model="store.searchQuery"
          type="text"
          placeholder="port pid project... (/ to focus)"
          class="w-full border border-border bg-bg-elevated pl-8 pr-3 py-2 text-[13px] text-fg placeholder:text-fg-subtle focus:border-accent/60 focus:outline-none"
        />
      </div>

      <!-- Framework chips -->
      <div v-if="frameworks.length > 0">
        <p class="mb-2 text-[11px] uppercase tracking-[0.18em] text-fg-subtle">
          Framework
        </p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="fw in frameworks"
            :key="fw"
            type="button"
            class="border px-2 py-1 text-[12px] transition-colors duration-150"
            :class="
              isSelected(fw)
                ? 'border-accent/60 bg-accent/15 text-accent glow'
                : 'border-border text-fg-muted hover:border-border-hover hover:text-fg'
            "
            @click="store.toggleFramework(fw)"
          >
            {{ fw }}
          </button>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="mt-auto border-t border-border px-6 py-4">
      <p class="text-[11px] leading-relaxed text-fg-subtle">
        <span :class="store.connected ? 'text-accent' : 'text-fg-subtle'">
          {{ store.connected ? "● live" : "○ offline" }}
        </span>
        ::
        <button
          class="underline-offset-2 hover:text-fg-muted hover:underline"
          @click="store.clearFilters"
        >
          clear
        </button>
      </p>
    </div>
  </aside>
</template>
