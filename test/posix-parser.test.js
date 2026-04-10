import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parsePsBatchLine,
  parsePsAllProcessesLine,
} from "../src/platform/posix-shared.js";

test("parsePsBatchLine: C-locale English line parses", () => {
  const line =
    "12345 6789 Ss     4128 Fri Apr 10 08:19:34 2026     /bin/zsh -c foo";
  const r = parsePsBatchLine(line);
  assert.equal(r.pid, 12345);
  assert.equal(r.ppid, 6789);
  assert.equal(r.stat, "Ss");
  assert.equal(r.rss, 4128);
  assert.equal(r.lstart, "Apr 10 08:19:34 2026");
  assert.equal(r.command, "/bin/zsh -c foo");
});

test("parsePsBatchLine: different weekday (Sat) still parses", () => {
  // Guards against the regex being accidentally over-fit to one weekday.
  const line = "12345 6789 Ss     4128 Sat Jan  1 00:00:00 2026     node";
  const r = parsePsBatchLine(line);
  assert.ok(r, "expected match");
  assert.equal(r.lstart, "Jan  1 00:00:00 2026");
});

test("parsePsBatchLine: Slovenian locale line returns null", () => {
  // sl_SI emits "pet 10 apr 08:19:34 2026" — day-num and month are swapped.
  // LC_ALL=C in batchProcessInfo prevents this from reaching the parser,
  // but we lock the behavior so a future refactor can't silently
  // reintroduce the bug that was fixed in commit 68009e3.
  const line =
    "12345 6789 Ss     4128 pet 10 apr 08:19:34 2026     /bin/zsh -c foo";
  assert.equal(parsePsBatchLine(line), null);
});

test("parsePsBatchLine: malformed input returns null, never throws", () => {
  assert.equal(parsePsBatchLine(""), null);
  assert.equal(parsePsBatchLine("junk"), null);
  assert.equal(parsePsBatchLine("12345 garbage"), null);
});

test("parsePsAllProcessesLine: C-locale English line parses", () => {
  const line =
    "12345 72.5 4.2 524288 Fri Apr 10 08:19:34 2026     uvicorn app.main:app";
  const r = parsePsAllProcessesLine(line);
  assert.equal(r.pid, 12345);
  assert.equal(r.cpu, 72.5);
  assert.equal(r.memPercent, 4.2);
  assert.equal(r.rss, 524288);
  assert.equal(r.lstart, "Apr 10 08:19:34 2026");
  assert.equal(r.command, "uvicorn app.main:app");
});

test("parsePsAllProcessesLine: Slovenian locale returns null", () => {
  const line =
    "12345 72.5 4.2 524288 pet 10 apr 08:19:34 2026     uvicorn app.main:app";
  assert.equal(parsePsAllProcessesLine(line), null);
});

test("parsePsAllProcessesLine: malformed input returns null", () => {
  assert.equal(parsePsAllProcessesLine(""), null);
  assert.equal(parsePsAllProcessesLine("junk"), null);
});
