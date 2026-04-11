/**
 * Minimal service worker for the Ports Console dashboard.
 *
 * Purpose: satisfy Chrome / Edge install criteria so the dashboard
 * can be added to the desktop as a standalone app. We explicitly do
 * NOT cache anything — the dashboard is localhost-only and every
 * number on screen is supposed to be live. Offline caching would
 * show stale port data and create confusion.
 *
 * Critical: the fetch handler must NOT intercept the /events SSE
 * stream. Service worker lifecycle (30s idle eviction) would otherwise
 * periodically break the long-lived SSE connection. By returning
 * without calling respondWith() for /events we let the browser handle
 * it directly, bypassing the SW entirely.
 */

self.addEventListener("install", () => {
  // Activate immediately on first install so the user doesn't have to
  // reload twice to get the PWA behavior.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Take control of any existing clients so the install prompt can
  // fire on the current tab.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Do not intercept the SSE endpoint. Falling through without calling
  // respondWith() hands the request back to the browser, which then
  // maintains the stream independent of the SW lifecycle.
  if (url.pathname === "/events") return;

  // Network-only passthrough for everything else. We don't build a
  // cache because the dashboard's entire value is live data.
  event.respondWith(fetch(event.request));
});
