/**
 * Persistent settings for the web dashboard (spec §3.9).
 *
 * Stored as JSON at ~/.port-whisperer/config.json. Writes are atomic:
 * we serialize to a temp file in the same directory, then rename it
 * into place. A corrupt config file is treated as "use defaults, don't
 * overwrite" — the user can fix it by hand without the server
 * clobbering their edits.
 *
 * The functions accept an explicit configDir parameter so tests can
 * point at a mkdtempSync() temp directory without touching the real
 * home directory.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";

const CONFIG_FILENAME = "config.json";
const TEMP_SUFFIX = ".tmp";

/** Default configuration. Keep keys stable — these are the public API. */
export const DEFAULT_SETTINGS = Object.freeze({
  theme: "dark",
  /** @type {Record<string, { searchQuery: string; selectedFrameworks: string[] }>} */
  presets: {},
});

/** Default config directory: ~/.port-whisperer */
export function getDefaultConfigDir() {
  return join(homedir(), ".port-whisperer");
}

function configPath(configDir) {
  return join(configDir, CONFIG_FILENAME);
}

function tempPath(configDir) {
  return join(configDir, CONFIG_FILENAME + TEMP_SUFFIX);
}

/**
 * Ensure the config directory exists. Idempotent.
 */
function ensureDir(configDir) {
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
}

/**
 * Load settings from disk. Falls back to defaults on any IO/parse
 * failure and logs a warning to stderr. Never throws.
 *
 * @param {string} [configDir=getDefaultConfigDir()]
 * @returns {typeof DEFAULT_SETTINGS}
 */
export function loadSettings(configDir = getDefaultConfigDir()) {
  try {
    const path = configPath(configDir);
    if (!existsSync(path)) {
      return cloneDefaults();
    }
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      console.warn(`[settings] config at ${path} is not an object; using defaults`);
      return cloneDefaults();
    }
    return { ...cloneDefaults(), ...parsed };
  } catch (err) {
    console.warn(
      `[settings] failed to load config, using defaults:`,
      err instanceof Error ? err.message : err,
    );
    return cloneDefaults();
  }
}

/**
 * Shallow-merge a patch into the current settings and atomically
 * write the result. Returns the merged settings.
 *
 * @param {Partial<typeof DEFAULT_SETTINGS>} patch
 * @param {string} [configDir=getDefaultConfigDir()]
 * @returns {typeof DEFAULT_SETTINGS}
 */
export function saveSettings(patch, configDir = getDefaultConfigDir()) {
  ensureDir(configDir);
  const current = loadSettings(configDir);
  const merged = { ...current, ...(patch || {}) };

  const tmp = tempPath(configDir);
  const dest = configPath(configDir);
  writeFileSync(tmp, JSON.stringify(merged, null, 2) + "\n", "utf8");
  renameSync(tmp, dest);
  return merged;
}

function cloneDefaults() {
  // Deep-ish clone — defaults have one level of nested objects (presets).
  return { theme: DEFAULT_SETTINGS.theme, presets: {} };
}
