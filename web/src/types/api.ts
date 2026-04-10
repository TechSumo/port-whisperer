// Shared API types mirroring the backend responses from src/scanner.js.
// Backend is still plain JS — these types are the contract the frontend
// relies on. Keep them in sync by hand until we migrate the backend.

export type PortStatus = "healthy" | "orphaned" | "zombie" | "unknown";

export interface ProcessTreeNode {
  pid: number;
  ppid: number;
  name: string;
}

export interface PortInfo {
  port: number;
  pid: number;
  processName: string;
  rawName?: string;
  command?: string;
  cwd?: string | null;
  projectName?: string | null;
  framework?: string | null;
  uptime?: string | null;
  startTime?: string | null;
  status?: PortStatus;
  memory?: string | null;
  gitBranch?: string | null;
  processTree?: ProcessTreeNode[];
}

export interface ProcessInfo {
  pid: number;
  processName: string;
  command?: string;
  description?: string;
  cpu: number;
  memory?: string | null;
  cwd?: string | null;
  projectName?: string | null;
  framework?: string | null;
  uptime?: string | null;
}
