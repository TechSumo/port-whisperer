import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import "./styles/main.css";

// Ensure the dark class is on the html element before mount.
// Prevents any flash of un-themed content since darkMode: "class"
// in tailwind.config.ts requires an explicit class toggle.
document.documentElement.classList.add("dark");

const app = createApp(App);
app.use(createPinia());
app.mount("#app");

// Register the service worker so the browser treats the dashboard as
// an installable PWA. The SW itself is a minimal passthrough — its
// only job is to satisfy Chrome/Edge's install criteria.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => {
        console.warn("[sw] registration failed:", err);
      });
  });
}
