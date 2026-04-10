/**
 * Shared helpers for darwin.js and linux.js.
 *
 * INVARIANT: this module must remain pure — no execSync, no filesystem IO,
 * no top-level side effects. win32.js must never import from here.
 *
 * Rationale: both POSIX platforms load this module at first use; any
 * top-level work would become a hidden cost on every CLI invocation.
 */

/**
 * Snapshot of process.env with LC_ALL forced to C, for use as the `env`
 * option of execSync calls that parse `ps lstart`. Non-English locales
 * reorder day/month (e.g. sl_SI "pet 10 apr" vs C "Fri Apr 10") and break
 * the regexes below. Captured once at module load — do not mutate
 * process.env after CLI startup.
 */
export const LC_ALL_C_ENV = { ...process.env, LC_ALL: "C" };

/** Max ancestry depth when walking the process tree. */
export const PROCESS_TREE_DEPTH_LIMIT = 8;

/**
 * Parse one line of `ps -o pid=,ppid=,stat=,rss=,lstart=,command=` output.
 * Returns { pid, ppid, stat, rss, lstart, command } or null if the line
 * does not match (e.g. blank, malformed, or emitted under a non-C locale).
 */
export function parsePsBatchLine(line) {
  const m = line
    .trim()
    .match(
      /^(\d+)\s+(\d+)\s+(\S+)\s+(\d+)\s+\w+\s+(\w+\s+\d+\s+[\d:]+\s+\d+)\s+(.*)$/,
    );
  if (!m) return null;
  return {
    pid: parseInt(m[1], 10),
    ppid: parseInt(m[2], 10),
    stat: m[3],
    rss: parseInt(m[4], 10),
    lstart: m[5],
    command: m[6],
  };
}

/**
 * Parse one line of `ps -eo pid=,pcpu=,pmem=,rss=,lstart=,{command|cmd}=`
 * output. Returns { pid, cpu, memPercent, rss, lstart, command } or null.
 * Note: darwin uses `command=` and linux uses `cmd=` in the `-o` format;
 * both produce the same column shape so this parser handles both.
 */
export function parsePsAllProcessesLine(line) {
  const m = line
    .trim()
    .match(
      /^(\d+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s+\w+\s+(\w+\s+\d+\s+[\d:]+\s+\d+)\s+(.*)$/,
    );
  if (!m) return null;
  return {
    pid: parseInt(m[1], 10),
    cpu: parseFloat(m[2]),
    memPercent: parseFloat(m[3]),
    rss: parseInt(m[4], 10),
    lstart: m[5],
    command: m[6],
  };
}
