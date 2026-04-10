/**
 * HTTP probe framework detection (spec §3.6, FR-25).
 *
 * Sends a short GET request to 127.0.0.1:<port>, reads the first ~2KB
 * of the response, and inspects headers + body for framework signatures.
 * Used as the last-resort detection strategy after package.json scanning
 * and command-line pattern matching have both failed.
 *
 * Rules:
 *   - Opt-in per call. Never invoked from the shared SSE poll loop.
 *   - Default timeout: 300ms (covers local round-trips; anything slower
 *     is probably not a dev server we can meaningfully identify).
 *   - Results cached for 60s per port, keyed so that a PID rollover
 *     invalidates the entry.
 *   - Concurrency cap of 5 in-flight probes to avoid flooding localhost
 *     with a dozen simultaneous HEAD/GET requests.
 */

const CACHE_TTL_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 300;
const MAX_CONCURRENT = 5;
const BODY_SNIFF_BYTES = 2048;

/** @type {Map<string, { expires: number; framework: string | null; reason?: string }>} */
const probeCache = new Map();

let inFlight = 0;
/** @type {Array<() => void>} */
const waiters = [];

async function acquireSlot() {
  if (inFlight < MAX_CONCURRENT) {
    inFlight++;
    return;
  }
  await new Promise((resolve) => waiters.push(resolve));
  inFlight++;
}

function releaseSlot() {
  inFlight--;
  const next = waiters.shift();
  if (next) next();
}

function cacheKey(port, pid) {
  return `${port}:${pid ?? "-"}`;
}

/**
 * Parse a small HTTP response (headers + first 2KB of body) and return
 * a framework name if we recognise a signature. Pure function — exported
 * for testing.
 *
 * @param {{headers: Headers | Record<string, string>, body: string}} response
 * @returns {string | null}
 */
export function matchFrameworkFromResponse({ headers, body }) {
  const get = (name) => {
    if (!headers) return "";
    if (typeof headers.get === "function") return headers.get(name) ?? "";
    const lookup = name.toLowerCase();
    for (const k of Object.keys(headers)) {
      if (k.toLowerCase() === lookup) return headers[k] ?? "";
    }
    return "";
  };

  const xPoweredBy = get("x-powered-by").toLowerCase();
  const server = get("server").toLowerCase();
  const haystack = `${xPoweredBy}\n${server}`;

  // Headers are the strongest signal.
  if (haystack.includes("express")) return "Express";
  if (haystack.includes("fastify")) return "Fastify";
  if (haystack.includes("hapi")) return "Hapi";
  if (haystack.includes("hono")) return "Hono";
  if (haystack.includes("koa")) return "Koa";
  if (haystack.includes("next.js")) return "Next.js";
  if (haystack.includes("nuxt")) return "Nuxt";
  if (haystack.includes("werkzeug")) return "Flask";
  if (haystack.includes("gunicorn")) return "Gunicorn";
  if (haystack.includes("uvicorn")) return "FastAPI";
  if (haystack.includes("daphne")) return "Django";
  if (haystack.includes("webrick") || haystack.includes("puma"))
    return "Rails";
  if (haystack.includes("cowboy") || haystack.includes("phoenix"))
    return "Phoenix";
  if (haystack.includes("nginx")) return "nginx";
  if (haystack.includes("apache")) return "Apache";
  if (haystack.includes("caddy")) return "Caddy";

  // Body-level: <meta name="generator" content="...">
  if (body) {
    const bodyLower = body.toLowerCase();
    const metaGen = bodyLower.match(
      /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i,
    );
    if (metaGen && metaGen[1]) {
      const gen = metaGen[1].toLowerCase();
      if (gen.includes("next")) return "Next.js";
      if (gen.includes("nuxt")) return "Nuxt";
      if (gen.includes("astro")) return "Astro";
      if (gen.includes("gatsby")) return "Gatsby";
      if (gen.includes("hugo")) return "Hugo";
      if (gen.includes("jekyll")) return "Jekyll";
      if (gen.includes("docusaurus")) return "Docusaurus";
      if (gen.includes("vitepress")) return "VitePress";
    }

    // Loose body-level cues (last resort — only when nothing else matched)
    if (bodyLower.includes("__next_data__")) return "Next.js";
    if (bodyLower.includes("id=\"__nuxt\"")) return "Nuxt";
    if (bodyLower.includes("<script src=\"/_astro/")) return "Astro";
  }

  return null;
}

/**
 * Probe a listening port and try to identify the framework.
 *
 * @param {object} params
 * @param {number} params.port
 * @param {number=} params.pid          - Used as a cache-key tiebreaker.
 * @param {number=} params.timeoutMs    - Per-request timeout (default 300ms).
 * @returns {Promise<{framework: string | null; reason?: string}>}
 */
export async function detectViaHttpProbe({
  port,
  pid,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { framework: null, reason: "invalid port" };
  }

  // Cache hit?
  const key = cacheKey(port, pid);
  const cached = probeCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return { framework: cached.framework, reason: cached.reason };
  }

  await acquireSlot();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(`http://127.0.0.1:${port}/`, {
        method: "GET",
        signal: ctrl.signal,
        // Some apps 404 on / but still emit X-Powered-By; don't treat
        // non-2xx as failure — the headers are still useful.
        redirect: "manual",
      });
    } catch (err) {
      const reason =
        err instanceof Error && err.name === "AbortError"
          ? "timeout"
          : err instanceof Error
            ? err.message
            : String(err);
      const result = { framework: null, reason };
      probeCache.set(key, { ...result, expires: Date.now() + CACHE_TTL_MS });
      return result;
    } finally {
      clearTimeout(timer);
    }

    // Read at most BODY_SNIFF_BYTES.
    let body = "";
    try {
      const reader = res.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        while (body.length < BODY_SNIFF_BYTES) {
          const { value, done } = await reader.read();
          if (done) break;
          body += decoder.decode(value, { stream: true });
        }
        try {
          await reader.cancel();
        } catch {}
      }
    } catch {
      // Body read failed — headers may still have a signature.
    }

    const framework = matchFrameworkFromResponse({
      headers: res.headers,
      body,
    });
    const result = framework
      ? { framework }
      : { framework: null, reason: "no signature matched" };
    probeCache.set(key, { ...result, expires: Date.now() + CACHE_TTL_MS });
    return result;
  } finally {
    releaseSlot();
  }
}

/** Test-only: clear the probe cache. */
export function __clearProbeCache() {
  probeCache.clear();
}
