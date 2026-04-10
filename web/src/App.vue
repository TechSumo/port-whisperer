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

// Id used by the `/` shortcut to focus the search input.
// The Sidebar component reads this via a DOM query; keeping it as a
// constant here so both sides agree on the contract.
const SEARCH_INPUT_ID = "ports-search-input";

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function onKeydown(e: KeyboardEvent): void {
  // Modifier combos are never ours.
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  // If a modal is open, let it handle Esc and swallow everything else.
  if (store.pendingAction !== null) {
    return;
  }

  // `/` focuses the search input regardless of current focus (except
  // when already in an editable element — that's a literal slash).
  if (e.key === "/" && !isEditable(e.target)) {
    e.preventDefault();
    const input = document.getElementById(SEARCH_INPUT_ID);
    if (input instanceof HTMLInputElement) {
      input.focus();
      input.select();
    }
    return;
  }

  // Esc clears filters + blurs row focus when no modal is open.
  if (e.key === "Escape") {
    if (isEditable(e.target)) {
      (e.target as HTMLElement).blur();
      return;
    }
    store.clearFilters();
    store.focusPort(null);
    return;
  }

  // Everything else is for the Ports view only and not while typing.
  if (view.value !== "ports") return;
  if (isEditable(e.target)) return;

  if (e.key === "ArrowDown" || e.key === "j") {
    e.preventDefault();
    store.focusNext();
    return;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    store.focusPrev();
    return;
  }

  // Single-letter actions on the focused row.
  const focused = store.focusedPortInfo();
  if (!focused) return;

  if (e.key === "k" || e.key === "K") {
    e.preventDefault();
    store.requestKill(focused);
    return;
  }
  if (e.key === "r" || e.key === "R") {
    e.preventDefault();
    store.requestRestart(focused);
    return;
  }
}

onMounted(() => {
  store.start();
  window.addEventListener("keydown", onKeydown);
});
onUnmounted(() => {
  store.stop();
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div class="flex min-h-[100dvh] bg-bg text-fg">
    <Sidebar v-model:view="view" :search-input-id="SEARCH_INPUT_ID" />
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
