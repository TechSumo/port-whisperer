import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  detectFrameworkFromCommand,
  detectFrameworkFromPackageJson,
} from "../src/scanner.js";
import {
  matchFrameworkFromResponse,
  detectViaHttpProbe,
  __clearProbeCache,
} from "../src/server/detect.js";

// =============================================================================
// detectFrameworkFromCommand — table-driven
// =============================================================================

const commandCases = [
  // JS ecosystem
  ["next dev", "node", "Next.js"],
  ["vite", "node", "Vite"],
  ["nuxt dev", "node", "Nuxt"],
  ["ng serve", "node", "Angular"],
  ["webpack-dev-server", "node", "Webpack"],
  ["remix dev", "node", "Remix"],
  ["astro dev", "node", "Astro"],
  ["gatsby develop", "node", "Gatsby"],
  ["node dist/main.js --preserveWatchOutput @nestjs/cli start", "node", "NestJS"],

  // Alternative runtimes
  ["bun run dev", "bun", "Bun"],
  ["deno run --allow-net server.ts", "deno", "Deno"],
  ["deno task dev", "deno", "Deno"],

  // Python ASGI/WSGI — specificity order matters
  ["/usr/bin/python3 -m uvicorn app.main:app --reload", "Python", "FastAPI"],
  ["hypercorn app:asgi", "Python", "FastAPI"],
  ["granian --interface asgi app:asgi", "Python", "FastAPI"],
  ["daphne -b 0.0.0.0 -p 8000 myproject.asgi:application", "Python", "Django"],
  ["python3 manage.py runserver", "Python", "Django"],
  ["flask run --port 5000", "Python", "Flask"],
  ["gunicorn -w 4 app:wsgi", "Python", "Gunicorn"],

  // Ruby
  ["rails server -p 3000", "ruby", "Rails"],
  ["puma -C config/puma.rb", "ruby", "Rails"],
  ["sidekiq -q default", "ruby", "Sidekiq"],

  // Elixir
  ["mix phx.server", "beam", "Phoenix"],

  // JVM
  ["java -jar spring-boot-app.jar --server.port=8080", "java", "Spring Boot"],

  // .NET
  ["dotnet run --project src/Api.csproj", "dotnet", ".NET"],
  ["dotnet watch run", "dotnet", ".NET"],

  // Systems
  ["cargo run --release", "cargo", "Rust"],
];

for (const [cmd, procName, expected] of commandCases) {
  test(`detectFrameworkFromCommand: "${cmd}" → ${expected}`, () => {
    assert.equal(detectFrameworkFromCommand(cmd, procName), expected);
  });
}

test("detectFrameworkFromCommand: unknown command falls back to process name", () => {
  assert.equal(detectFrameworkFromCommand("", "node"), "Node.js");
  assert.equal(detectFrameworkFromCommand("/bin/sleep 100", "python3"), "Python");
  assert.equal(detectFrameworkFromCommand("/bin/true", "something-else"), null);
});

// =============================================================================
// detectFrameworkFromPackageJson — fixture-driven
// =============================================================================

test("detectFrameworkFromPackageJson: dependencies.next → Next.js", () => {
  assert.equal(
    detectFrameworkFromPackageJson({ dependencies: { next: "14.0.0" } }),
    "Next.js",
  );
});

test("detectFrameworkFromPackageJson: devDependencies.vite → Vite", () => {
  assert.equal(
    detectFrameworkFromPackageJson({
      devDependencies: { vite: "5.0.0", vue: "3.5.0" },
    }),
    "Vite",
  );
});

test("detectFrameworkFromPackageJson: peerDependencies scanned", () => {
  assert.equal(
    detectFrameworkFromPackageJson({
      peerDependencies: { "@sveltejs/kit": "2.0.0" },
    }),
    "SvelteKit",
  );
});

test("detectFrameworkFromPackageJson: scripts scanned when no dep found", () => {
  // A monorepo root might have no framework deps at the top level but
  // orchestrate the framework via workspace scripts.
  assert.equal(
    detectFrameworkFromPackageJson({
      dependencies: {},
      scripts: { dev: "cd apps/web && next dev --turbo" },
    }),
    "Next.js",
  );
});

test("detectFrameworkFromPackageJson: scripts: nuxt dev", () => {
  assert.equal(
    detectFrameworkFromPackageJson({
      scripts: { dev: "nuxt dev", build: "nuxt build" },
    }),
    "Nuxt",
  );
});

test("detectFrameworkFromPackageJson: scripts: vite", () => {
  assert.equal(
    detectFrameworkFromPackageJson({
      scripts: { dev: "vite --host" },
    }),
    "Vite",
  );
});

test("detectFrameworkFromPackageJson: scripts: ng serve → Angular", () => {
  assert.equal(
    detectFrameworkFromPackageJson({
      scripts: { start: "ng serve --port 4200" },
    }),
    "Angular",
  );
});

test("detectFrameworkFromPackageJson: Vite+Vue picks Vite (build tool wins)", () => {
  assert.equal(
    detectFrameworkFromPackageJson({
      dependencies: { vue: "3.5.0" },
      devDependencies: { vite: "5.0.0" },
    }),
    "Vite",
  );
});

test("detectFrameworkFromPackageJson: empty / invalid input → null", () => {
  assert.equal(detectFrameworkFromPackageJson(null), null);
  assert.equal(detectFrameworkFromPackageJson(undefined), null);
  assert.equal(detectFrameworkFromPackageJson({}), null);
  assert.equal(detectFrameworkFromPackageJson({ dependencies: {} }), null);
});

// =============================================================================
// matchFrameworkFromResponse — header + body pattern matching
// =============================================================================

const headerCases = [
  [{ "x-powered-by": "Express" }, "", "Express"],
  [{ "X-Powered-By": "Next.js" }, "", "Next.js"],
  [{ server: "uvicorn" }, "", "FastAPI"],
  [{ server: "gunicorn/21.2.0" }, "", "Gunicorn"],
  [{ server: "Werkzeug/2.3.7 Python/3.11" }, "", "Flask"],
  [{ server: "daphne" }, "", "Django"],
  [{ server: "nginx/1.24.0" }, "", "nginx"],
  [{ server: "Apache/2.4.58" }, "", "Apache"],
  [{ server: "puma 6.0.0" }, "", "Rails"],
  [{ server: "Cowboy" }, "", "Phoenix"],
  [{ "x-powered-by": "Fastify" }, "", "Fastify"],
  [{ "x-powered-by": "Hono" }, "", "Hono"],
];

for (const [headers, body, expected] of headerCases) {
  const label = JSON.stringify(headers).slice(0, 40);
  test(`matchFrameworkFromResponse: ${label} → ${expected}`, () => {
    assert.equal(matchFrameworkFromResponse({ headers, body }), expected);
  });
}

test("matchFrameworkFromResponse: meta generator Astro", () => {
  const body = '<html><meta name="generator" content="Astro v4.5.2"></html>';
  assert.equal(matchFrameworkFromResponse({ headers: {}, body }), "Astro");
});

test("matchFrameworkFromResponse: meta generator Docusaurus", () => {
  const body = '<meta name="generator" content="Docusaurus v3.0.0">';
  assert.equal(
    matchFrameworkFromResponse({ headers: {}, body }),
    "Docusaurus",
  );
});

test("matchFrameworkFromResponse: __NEXT_DATA__ body marker", () => {
  const body = '<script id="__NEXT_DATA__" type="application/json">{...}';
  assert.equal(
    matchFrameworkFromResponse({ headers: {}, body }),
    "Next.js",
  );
});

test("matchFrameworkFromResponse: nothing matches → null", () => {
  assert.equal(
    matchFrameworkFromResponse({
      headers: { server: "weirdserver/1.0" },
      body: "<html><body>hello</body></html>",
    }),
    null,
  );
});

// =============================================================================
// detectViaHttpProbe — end-to-end against a real http server on ephemeral port
// =============================================================================

async function spawnFixtureServer(headers, body) {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, headers);
      res.end(body);
    });
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({
        port,
        close: () => new Promise((r) => server.close(() => r(undefined))),
      });
    });
  });
}

test("detectViaHttpProbe: live server with X-Powered-By header → framework", async () => {
  __clearProbeCache();
  const { port, close } = await spawnFixtureServer(
    { "X-Powered-By": "Express" },
    "<html>hello</html>",
  );
  try {
    const result = await detectViaHttpProbe({ port });
    assert.equal(result.framework, "Express");
  } finally {
    await close();
  }
});

test("detectViaHttpProbe: live server with meta generator → framework", async () => {
  __clearProbeCache();
  const { port, close } = await spawnFixtureServer(
    { "Content-Type": "text/html" },
    '<html><head><meta name="generator" content="Astro v4.5.2"></head></html>',
  );
  try {
    const result = await detectViaHttpProbe({ port });
    assert.equal(result.framework, "Astro");
  } finally {
    await close();
  }
});

test("detectViaHttpProbe: unknown server → null with reason", async () => {
  __clearProbeCache();
  const { port, close } = await spawnFixtureServer(
    { Server: "weirdserver/1.0" },
    "<html>plain</html>",
  );
  try {
    const result = await detectViaHttpProbe({ port });
    assert.equal(result.framework, null);
    assert.ok(result.reason);
  } finally {
    await close();
  }
});

test("detectViaHttpProbe: unreachable port → timeout/econnrefused reason", async () => {
  __clearProbeCache();
  // Port 1 is reserved on most systems; connect attempts refuse quickly.
  const result = await detectViaHttpProbe({ port: 1, timeoutMs: 200 });
  assert.equal(result.framework, null);
  assert.ok(typeof result.reason === "string");
});

test("detectViaHttpProbe: invalid port → null with reason", async () => {
  __clearProbeCache();
  const result = await detectViaHttpProbe({ port: 0 });
  assert.equal(result.framework, null);
  assert.equal(result.reason, "invalid port");
});

test("detectViaHttpProbe: cache serves repeat calls without re-fetching", async () => {
  __clearProbeCache();
  const { port, close } = await spawnFixtureServer(
    { "X-Powered-By": "Fastify" },
    "ok",
  );
  try {
    const first = await detectViaHttpProbe({ port });
    assert.equal(first.framework, "Fastify");
    await close(); // server is gone
    // Second call should hit the cache, not try to re-probe.
    const second = await detectViaHttpProbe({ port });
    assert.equal(second.framework, "Fastify");
  } catch (e) {
    // If the cache broke, we'd re-probe a dead server and get null —
    // the assertion above would have failed before reaching here.
    throw e;
  }
});
