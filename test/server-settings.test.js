import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadSettings,
  saveSettings,
  DEFAULT_SETTINGS,
} from "../src/server/settings.js";

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "pw-settings-"));
}

function cleanup(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {}
}

test("loadSettings: returns defaults when dir does not exist", (t) => {
  const dir = makeTempDir();
  t.after(() => cleanup(dir));
  rmSync(dir, { recursive: true });
  const settings = loadSettings(dir);
  assert.equal(settings.theme, DEFAULT_SETTINGS.theme);
  assert.deepEqual(settings.presets, {});
});

test("loadSettings: returns defaults when config.json is missing", (t) => {
  const dir = makeTempDir();
  t.after(() => cleanup(dir));
  const settings = loadSettings(dir);
  assert.equal(settings.theme, "dark");
  assert.deepEqual(settings.presets, {});
});

test("loadSettings: returns defaults when config is corrupt JSON (does not overwrite)", (t) => {
  const dir = makeTempDir();
  t.after(() => cleanup(dir));
  const path = join(dir, "config.json");
  writeFileSync(path, "{ not valid json ::: }", "utf8");

  const settings = loadSettings(dir);
  assert.equal(settings.theme, "dark");

  // Confirm the corrupt file was NOT overwritten during load.
  const after = readFileSync(path, "utf8");
  assert.equal(after, "{ not valid json ::: }");
});

test("saveSettings: writes new config and returns merged", (t) => {
  const dir = makeTempDir();
  t.after(() => cleanup(dir));
  const merged = saveSettings(
    { presets: { frontend: { searchQuery: "", selectedFrameworks: ["Nuxt"] } } },
    dir,
  );
  assert.equal(merged.theme, "dark");
  assert.deepEqual(merged.presets, {
    frontend: { searchQuery: "", selectedFrameworks: ["Nuxt"] },
  });

  const reloaded = loadSettings(dir);
  assert.deepEqual(reloaded.presets, merged.presets);
});

test("saveSettings: shallow-merges with existing values", (t) => {
  const dir = makeTempDir();
  t.after(() => cleanup(dir));

  saveSettings({ theme: "dark" }, dir);
  saveSettings(
    { presets: { backend: { searchQuery: "fastapi", selectedFrameworks: [] } } },
    dir,
  );
  const settings = loadSettings(dir);
  assert.equal(settings.theme, "dark");
  assert.ok(settings.presets.backend);
  assert.equal(settings.presets.backend.searchQuery, "fastapi");
});

test("saveSettings: atomic write leaves no stray .tmp file behind", (t) => {
  const dir = makeTempDir();
  t.after(() => cleanup(dir));
  saveSettings({ theme: "dark" }, dir);
  assert.equal(existsSync(join(dir, "config.json")), true);
  assert.equal(existsSync(join(dir, "config.json.tmp")), false);
});

test("saveSettings: subsequent save replaces rather than appends", (t) => {
  const dir = makeTempDir();
  t.after(() => cleanup(dir));
  saveSettings({ presets: { a: { searchQuery: "a", selectedFrameworks: [] } } }, dir);
  const after = saveSettings(
    { presets: { b: { searchQuery: "b", selectedFrameworks: [] } } },
    dir,
  );
  // Shallow merge means `presets` is REPLACED wholesale by the latest
  // patch — the caller is responsible for passing the full presets map
  // when updating a single entry. This matches the spec's "shallow merge"
  // contract (FR-37).
  assert.ok(after.presets.b);
  assert.equal(after.presets.a, undefined);
});
