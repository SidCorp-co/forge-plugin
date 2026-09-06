/* Git as a gate asks it, and what a gate may give one child it waits for. Apart from the gates because three of them had a runner of their own and each read a failure differently — nothing at all is no answer, git having not run or been killed, and a `status` is git's own, which is the difference between a tree at stake and a directory that is not a repository. `probeMs` clamps to enough to answer, never the whole of what is left, and never nothing, a probe killed at zero saying the same as one that failed; it takes what remains rather than reading it, so the clock stays the harness's, this side may not reach up for it, and each caller still spells `remaining()` where it spends it. */
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { dirname, relative } from "node:path";

export const gitProbe = (argv, { cwd = undefined, ms } = {}) => {
  try {
    const run = spawnSync("git", argv, { cwd, encoding: "utf8", timeout: ms });
    return run.error ? null : { status: run.status, out: String(run.stdout ?? "") };
  } catch {
    return null;
  }
};

export const LEAST_MS = 500;

export const probeMs = (left) => Math.max(LEAST_MS, Math.min(5_000, left - 1_000));

/* The tree's half of what counts as a write after a call, which `forge hooks --how writes` states:
   the mtime floor is the call's own start, so a git operation inside one stamps above it. */
/* `--ignored` for a build output no other flag reports, `--no-renames` for one entry per path. */
const ASK = ["status", "--porcelain", "-z", "--untracked-files=all", "--ignored", "--no-renames", "--"];

const canonical = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

const byRoot = (paths, left) => {
  const roots = new Map();
  const known = new Map();
  for (const path of paths) {
    const at = dirname(path);
    if (!known.has(at)) {
      if (left() < LEAST_MS) break;
      const said = gitProbe(["-C", at, "rev-parse", "--show-toplevel"], { ms: probeMs(left()) });
      known.set(at, said && said.status === 0 && said.out.trim() ? canonical(said.out.trim()) : null);
    }
    const root = known.get(at);
    if (!root || relative(root, path).startsWith("..")) continue;
    if (!roots.has(root)) roots.set(root, []);
    roots.get(root).push(path);
  }
  return roots;
};

/** Of the absolute paths given, the ones git reports nothing about — tracked, matching HEAD and the
 *  index. One git could not be asked about is absent rather than in it: doubt keeps a candidate, and
 *  a probe starts only where `left` still covers the least allowance, so no run outlasts the event. */
export const agreedWithHead = (paths, left) => {
  const out = new Set();
  for (const [root, held] of byRoot(paths, left)) {
    if (left() < LEAST_MS) break;
    const said = gitProbe(["-C", root, ...ASK, ...held], { ms: probeMs(left()) });
    if (!said || said.status !== 0) continue;
    const seen = new Set(said.out.split("\0").filter(Boolean).map((one) => one.slice(3)));
    for (const path of held) {
      if (!seen.has(relative(root, path))) out.add(path);
    }
  }
  return out;
};
