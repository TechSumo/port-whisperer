import { test } from "node:test";
import assert from "node:assert/strict";
// Importing scanner.js is safe at test time: platform/index.js uses dynamic
// import() inside getPlatform(), so no OS-specific module loads unless we
// actually call getListeningPorts(). These tests hit pure functions only.
import { isDevProcess } from "../src/scanner.js";

test("isDevProcess: recognises common dev binaries by name", () => {
  assert.equal(isDevProcess("node", ""), true);
  assert.equal(isDevProcess("python3", ""), true);
  assert.equal(isDevProcess("cargo", ""), true);
  assert.equal(isDevProcess("bun", ""), true);
});

test("isDevProcess: filters out desktop and system apps", () => {
  assert.equal(isDevProcess("Spotify", ""), false);
  assert.equal(isDevProcess("kernel_task", ""), false);
  assert.equal(isDevProcess("svchost.exe", ""), false);
  assert.equal(isDevProcess("systemd", ""), false);
});

test("isDevProcess: matches framework keywords in command string", () => {
  assert.equal(isDevProcess("ruby", "rails server"), true);
  assert.equal(isDevProcess("python", "uvicorn app.main:app"), true);
  assert.equal(isDevProcess("node", "next dev"), true);
  assert.equal(isDevProcess("unknown", "manage.py runserver"), true);
});
