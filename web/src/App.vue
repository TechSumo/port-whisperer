<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { usePortsStore } from "@/stores/ports";
import AppHeader from "@/components/AppHeader.vue";
import Sidebar from "@/components/Sidebar.vue";
import PortTable from "@/components/PortTable.vue";
import ProcessTable from "@/components/ProcessTable.vue";
import KillConfirm from "@/components/KillConfirm.vue";
import Toasts from "@/components/Toasts.vue";

type View = "ports" | "processes";

const store = usePortsStore();
const view = ref<View>("ports");

onMounted(() => {
  store.start();
});
onUnmounted(() => {
  store.stop();
});
</script>

<template>
  <div class="flex min-h-[100dvh] bg-bg text-fg">
    <Sidebar v-model:view="view" />
    <main class="flex min-w-0 flex-1 flex-col">
      <AppHeader />
      <div class="relative flex-1 overflow-auto">
        <PortTable v-if="view === 'ports'" />
        <ProcessTable v-else />
      </div>
    </main>
    <KillConfirm />
    <Toasts />
  </div>
</template>
