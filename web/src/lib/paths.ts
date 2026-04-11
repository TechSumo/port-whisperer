// Helpers for deriving display values from filesystem paths.
//
// `deriveRepoFolder` is the "show me the repo name" heuristic: when a
// process's cwd lives under a known workspace root (like ~/Desktop/_GITHUB),
// the immediate child of that root is almost always the repo name. For
// a cwd of /Users/aljosag/Desktop/_GITHUB/kamni/frontend, the repo is
// "kamni" and the project (already exposed by the scanner as
// PortInfo.projectName) is "frontend".

const WORKSPACE_ROOTS: readonly string[] = [
  // Personal fork convention — can be extended later via settings.
  "/Users/aljosag/Desktop/_GITHUB/",
  // Common conventions on other machines.
  "/Users/aljosag/Projects/",
  "/Users/aljosag/Code/",
  "/Users/aljosag/repos/",
];

/**
 * If `cwd` sits under one of the known workspace roots, return the
 * first path segment under that root (= repo name). Otherwise null.
 */
export function deriveRepoFolder(
  cwd: string | null | undefined,
): string | null {
  if (!cwd) return null;
  for (const root of WORKSPACE_ROOTS) {
    if (cwd.startsWith(root)) {
      const rest = cwd.slice(root.length);
      const firstSegment = rest.split("/")[0];
      return firstSegment && firstSegment.length > 0 ? firstSegment : null;
    }
  }
  return null;
}
