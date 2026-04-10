#!/usr/bin/env node

import {
  getListeningPorts,
  getPortDetails,
  findOrphanedProcesses,
  killProcess,
  watchPorts,
  isDevProcess,
  getAllProcesses,
  resolveKillTarget,
} from "./scanner.js";
import {
  displayPortTable,
  displayPortDetail,
  displayCleanResults,
  displayWatchEvent,
  displayWatchHeader,
  displayProcessTable,
} from "./display.js";
import chalk from "chalk";
import { createInterface } from "readline";

const args = process.argv.slice(2);
const showAll = args.includes("--all") || args.includes("-a");
const filteredArgs = args.filter((a) => a !== "--all" && a !== "-a");
const command = filteredArgs[0];

async function main() {
  // No args: show dev ports by default, --all for everything
  if (!command) {
    let ports = await getListeningPorts();
    if (!showAll) {
      ports = ports.filter((p) => isDevProcess(p.processName, p.command));
    }
    displayPortTable(ports, !showAll);
    return;
  }

  // Specific port number
  const portNum = parseInt(command, 10);
  if (!isNaN(portNum)) {
    const info = await getPortDetails(portNum);
    displayPortDetail(info);

    if (info) {
      // Interactive kill prompt
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(
        chalk.yellow(`  Kill process on :${portNum}? [y/N] `),
        (answer) => {
          if (answer.toLowerCase() === "y") {
            const success = killProcess(info.pid);
            if (success) {
              console.log(chalk.green(`\n  ✓ Killed PID ${info.pid}\n`));
            } else {
              console.log(
                chalk.red(`\n  ✕ Failed. Try: sudo kill -9 ${info.pid}\n`),
              );
            }
          }
          rl.close();
        },
      );
    }
    return;
  }

  // Named commands
  switch (command) {
    case "ps": {
      let processes = await getAllProcesses();
      if (!showAll) {
        processes = processes.filter((p) =>
          isDevProcess(p.processName, p.command),
        );
        // Collapse Docker internal processes into one summary row
        const dockerProcs = processes.filter(
          (p) =>
            p.processName.startsWith("com.docke") ||
            p.processName.startsWith("Docker") ||
            p.processName === "docker" ||
            p.processName === "docker-sandbox",
        );
        const nonDocker = processes.filter(
          (p) =>
            !p.processName.startsWith("com.docke") &&
            !p.processName.startsWith("Docker") &&
            p.processName !== "docker" &&
            p.processName !== "docker-sandbox",
        );
        if (dockerProcs.length > 0) {
          const totalCpu = dockerProcs.reduce((s, p) => s + p.cpu, 0);
          const totalRssKB = dockerProcs.reduce((s, p) => {
            const m = (p.memory || "").match(/([\d.]+)\s*(GB|MB|KB)/);
            if (!m) return s;
            const val = parseFloat(m[1]);
            if (m[2] === "GB") return s + val * 1048576;
            if (m[2] === "MB") return s + val * 1024;
            return s + val;
          }, 0);
          const memStr =
            totalRssKB > 1048576
              ? `${(totalRssKB / 1048576).toFixed(1)} GB`
              : totalRssKB > 1024
                ? `${(totalRssKB / 1024).toFixed(1)} MB`
                : `${Math.round(totalRssKB)} KB`;
          nonDocker.push({
            pid: dockerProcs[0].pid,
            processName: "Docker",
            command: "",
            description: `${dockerProcs.length} processes`,
            cpu: totalCpu,
            memory: memStr,
            cwd: null,
            projectName: null,
            framework: "Docker",
            uptime: dockerProcs[0].uptime,
          });
        }
        processes = nonDocker;
      }
      processes.sort((a, b) => b.cpu - a.cpu);
      displayProcessTable(processes, !showAll);
      break;
    }

    case "clean": {
      const orphaned = await findOrphanedProcesses();
      const killed = [];
      const failed = [];

      if (orphaned.length === 0) {
        displayCleanResults(orphaned, killed, failed);
        return;
      }

      // Confirm before killing
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      console.log();
      console.log(
        chalk.yellow.bold(
          `  Found ${orphaned.length} orphaned/zombie process${orphaned.length === 1 ? "" : "es"}:`,
        ),
      );
      for (const p of orphaned) {
        console.log(
          `  ${chalk.gray("•")} :${chalk.white.bold(p.port)} — ${p.processName} ${chalk.gray(`(PID ${p.pid})`)}`,
        );
      }
      console.log();

      rl.question(chalk.yellow("  Kill all? [y/N] "), (answer) => {
        if (answer.toLowerCase() === "y") {
          for (const p of orphaned) {
            if (killProcess(p.pid)) {
              killed.push(p.pid);
            } else {
              failed.push(p.pid);
            }
          }
          displayCleanResults(orphaned, killed, failed);
        } else {
          console.log(chalk.gray("\n  Aborted.\n"));
        }
        rl.close();
      });
      break;
    }

    case "kill": {
      const rawKillArgs = filteredArgs
        .slice(1)
        .filter((a) => a !== "--force" && a !== "-f");
      const force =
        filteredArgs.includes("--force") || filteredArgs.includes("-f");
      const signal = force ? "SIGKILL" : "SIGTERM";

      if (rawKillArgs.length === 0) {
        console.log(
          chalk.red(
            `\n  Usage: ports kill [-f|--force] <port|pid|range> [port|pid|range...]\n`,
          ),
        );
        console.log(
          chalk.gray(
            "  Kills listener on port (1-65535), or process by PID. Use -f for SIGKILL.",
          ),
        );
        console.log(chalk.gray("  Ranges: ports kill 3000-3010\n"));
        process.exit(1);
      }

      // Expand port ranges (e.g. "3000-3010") into individual args
      const killArgs = [];
      const rangeSpans = []; // track which args came from ranges
      for (const arg of rawKillArgs) {
        const rangeMatch = arg.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1], 10);
          const end = parseInt(rangeMatch[2], 10);
          if (start > end) {
            console.log(
              chalk.red(
                `\n  ✕ Invalid range: ${arg} (start must be less than end)\n`,
              ),
            );
            process.exitCode = 1;
            return;
          }
          if (end - start > 1000) {
            console.log(
              chalk.red(`\n  ✕ Range too large: ${arg} (max 1000 ports)\n`),
            );
            process.exitCode = 1;
            return;
          }
          if (start < 1 || end > 65535) {
            console.log(
              chalk.red(
                `\n  ✕ Invalid range: ${arg} (ports must be 1-65535)\n`,
              ),
            );
            process.exitCode = 1;
            return;
          }
          const rangeStart = killArgs.length;
          for (let p = start; p <= end; p++) {
            killArgs.push(String(p));
          }
          rangeSpans.push({
            start: rangeStart,
            end: killArgs.length,
            label: arg,
          });
        } else {
          killArgs.push(arg);
        }
      }

      let anyFailed = false;
      let killed = 0;
      let noListener = 0;
      console.log();

      for (let i = 0; i < killArgs.length; i++) {
        const arg = killArgs[i];
        const n = parseInt(arg, 10);
        const isFromRange = rangeSpans.some((r) => i >= r.start && i < r.end);

        if (isNaN(n) || String(n) !== arg.trim()) {
          console.log(chalk.red(`  ✕ "${arg}" is not a valid port/PID`));
          anyFailed = true;
          continue;
        }

        const resolved = await resolveKillTarget(n);
        if (!resolved) {
          // Silently count misses from ranges instead of spamming
          if (isFromRange) {
            noListener++;
            continue;
          }
          const msg =
            n <= 65535
              ? `No listener on :${n} and no process with PID ${n}`
              : `No process with PID ${n}`;
          console.log(chalk.red(`  ✕ ${msg}`));
          anyFailed = true;
          continue;
        }

        const { pid, via } = resolved;
        const label =
          via === "port"
            ? `:${resolved.port} — ${resolved.info?.processName || "unknown"} (PID ${pid})`
            : `PID ${pid}`;

        console.log(chalk.white(`  Killing ${label}`));
        const ok = killProcess(pid, signal);
        if (ok) {
          console.log(chalk.green(`  ✓ Sent ${signal} to ${label}`));
          killed++;
        } else {
          console.log(
            chalk.red(`  ✕ Failed. Try: sudo kill${force ? " -9" : ""} ${pid}`),
          );
          anyFailed = true;
        }
      }

      // Print summary for ranges
      if (rangeSpans.length > 0) {
        const parts = [];
        if (killed > 0) parts.push(chalk.green(`${killed} killed`));
        if (noListener > 0) parts.push(chalk.gray(`${noListener} empty`));
        if (anyFailed) parts.push(chalk.red(`some failed`));
        console.log(
          `  ${chalk.dim("Range summary:")} ${parts.join(chalk.dim(", "))}`,
        );
      }

      console.log();
      process.exitCode = anyFailed ? 1 : 0;
      break;
    }

    case "serve": {
      const serveArgs = filteredArgs.slice(1);
      let port = 7777;
      let open = false;
      for (let i = 0; i < serveArgs.length; i++) {
        const a = serveArgs[i];
        if (a === "--open") {
          open = true;
        } else if (a === "--port" || a === "-p") {
          const next = serveArgs[i + 1];
          const parsed = parseInt(next, 10);
          if (isNaN(parsed) || parsed < 1 || parsed > 65535) {
            console.log(chalk.red(`\n  ✕ --port requires a number 1-65535\n`));
            process.exit(1);
          }
          port = parsed;
          i++;
        } else {
          console.log(chalk.red(`\n  ✕ Unknown flag: ${a}\n`));
          process.exit(1);
        }
      }

      const { start } = await import("./server/index.js");
      let handle;
      try {
        handle = await start({ port });
      } catch (err) {
        if (err.code === "EADDRINUSE") {
          console.log(
            chalk.red(`\n  ✕ Port ${port} is already in use.`) +
              chalk.gray(` Try: ports serve --port ${port + 1}\n`),
          );
          process.exit(1);
        }
        throw err;
      }

      console.log();
      console.log(
        chalk.cyan.bold("  Port Whisperer") + chalk.gray(" — web dashboard"),
      );
      console.log(`  ${chalk.gray("Listening on")} ${chalk.white.bold(handle.url)}`);
      console.log(chalk.gray("  Press Ctrl+C to stop\n"));

      if (open) {
        const opener =
          process.platform === "darwin"
            ? "open"
            : process.platform === "win32"
              ? "start"
              : "xdg-open";
        try {
          const { spawn } = await import("node:child_process");
          spawn(opener, [handle.url], { detached: true, stdio: "ignore" }).unref();
        } catch {}
      }

      // Graceful shutdown on Ctrl+C — 2-second grace window per spec FR-4.
      let shuttingDown = false;
      const shutdown = async () => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(chalk.gray("\n  Shutting down..."));
        const timeout = new Promise((resolve) => setTimeout(resolve, 2000));
        await Promise.race([handle.close(), timeout]);
        console.log(chalk.gray("  Stopped.\n"));
        process.exit(0);
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
      break;
    }

    case "watch": {
      displayWatchHeader();
      const interval = watchPorts((type, info) => {
        displayWatchEvent(type, info);
      }, 2000);

      // Handle graceful exit
      process.on("SIGINT", () => {
        clearInterval(interval);
        console.log(chalk.gray("\n\n  Stopped watching.\n"));
        process.exit(0);
      });
      break;
    }

    case "help":
    case "--help":
    case "-h": {
      console.log();
      console.log(
        chalk.cyan.bold("  Port Whisperer") +
          chalk.gray(" — listen to your ports"),
      );
      console.log();
      console.log(chalk.white("  Usage:"));
      console.log(
        `    ${chalk.cyan("ports")}              Show dev server ports`,
      );
      console.log(
        `    ${chalk.cyan("ports --all")}        Show all listening ports`,
      );
      console.log(
        `    ${chalk.cyan("ports ps")}           Show all running dev processes`,
      );
      console.log(
        `    ${chalk.cyan("ports <number>")}     Detailed info about a specific port`,
      );
      console.log(
        `    ${chalk.cyan("ports kill <n>")}     Kill by port, PID, or range (-f for SIGKILL)`,
      );
      console.log(
        `    ${chalk.cyan("ports kill 3000-3010")} Kill all listeners in a port range`,
      );
      console.log(
        `    ${chalk.cyan("ports clean")}        Kill orphaned/zombie dev servers`,
      );
      console.log(
        `    ${chalk.cyan("ports watch")}        Monitor port changes in real-time`,
      );
      console.log(
        `    ${chalk.cyan("ports serve")}        Launch web dashboard (default :7777, --open to open browser)`,
      );
      console.log(
        `    ${chalk.cyan("whoisonport <num>")} Alias for ports <number>`,
      );
      console.log();
      break;
    }

    default:
      console.log(chalk.red(`\n  Unknown command: ${command}`));
      console.log(
        chalk.gray(`  Run ${chalk.cyan("ports --help")} for usage.\n`),
      );
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(chalk.red(`\n  Error: ${err.message}\n`));
  process.exit(1);
});
