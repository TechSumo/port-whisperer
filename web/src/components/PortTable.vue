<script setup lang="ts">
import { computed } from "vue";
import { usePortsStore } from "@/stores/ports";
import PortRow from "./PortRow.vue";
import EmptyState from "./EmptyState.vue";

const store = usePortsStore();
const rows = computed(() => store.filteredPorts);
const isNew = (port: number): boolean =>
  (store.recentlyNew as ReadonlySet<number>).has(port);
</script>

<template>
  <section class="min-h-full">
    <!-- Column header -->
    <div
      class="sticky top-0 z-10 grid items-center gap-4 border-b border-border bg-bg/95 backdrop-blur-sm pl-10 pr-8 py-3 text-[11px] uppercase tracking-[0.16em] text-fg-subtle"
      :style="{
        gridTemplateColumns:
          '92px 1fr 100px 1fr 150px 96px 96px 100px 72px',
      }"
    >
      <div>Port</div>
      <div>Process</div>
      <div>PID</div>
      <div>Project</div>
      <div>Framework</div>
      <div>Memory</div>
      <div>Uptime</div>
      <div>Status</div>
      <div class="text-right">Actions</div>
    </div>

    <!-- Skeleton loaders -->
    <template v-if="!store.initialLoaded">
      <div
        v-for="i in 6"
        :key="i"
        class="grid items-center gap-4 border-b border-border/60 pl-10 pr-8 py-3.5"
        :style="{
          gridTemplateColumns:
            '92px 1fr 100px 1fr 150px 96px 96px 100px 72px',
        }"
      >
        <div class="h-3.5 w-14 animate-pulse bg-border" />
        <div class="h-3.5 w-36 animate-pulse bg-border" />
        <div class="h-3.5 w-12 animate-pulse bg-border" />
        <div class="h-3.5 w-28 animate-pulse bg-border" />
        <div class="h-3.5 w-20 animate-pulse bg-border" />
        <div class="h-3.5 w-16 animate-pulse bg-border" />
        <div class="h-3.5 w-14 animate-pulse bg-border" />
        <div class="h-3.5 w-20 animate-pulse bg-border" />
        <div class="h-3.5 w-12 animate-pulse bg-border" />
      </div>
    </template>

    <EmptyState
      v-else-if="rows.length === 0"
      title="no matches"
      description="refine your query or clear the framework filter"
    />

    <template v-else>
      <PortRow
        v-for="(port, index) in rows"
        :key="port.port"
        :port="port"
        :index="index"
        :is-new="isNew(port.port)"
      />
    </template>
  </section>
</template>
