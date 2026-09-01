/* Two entry points ask one question — before a write, and after one no check could read. */
import { spawnSync } from "node:child_process";
import { readdirSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

export const GUARDED = /\/memory\/|\/skills\//;
export const FILE_TYPES = ["user", "feedback", "project", "reference"];
export const SKILL_CATEGORIES = ["trap", "method", "invariant", "discovery", "boundary"];
export const FORGE_SOURCES = ["note", "knowledge", "decision", "policy"];

export const BRIEF =
  "Record only what cost a cycle, will recur, fails silently, and is not already written. Most "
  + "rounds record nothing.";

export const guarded = (path) =>
  GUARDED.test(path) && path.endsWith(".md") && basename(path) !== "MEMORY.md";

const GIT_MS = 2_000;
const DEPTH = 3;

const git = (cwd, args) => {
  const run = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", timeout: GIT_MS });
  return run.status === 0 ? String(run.stdout) : "";
};

/* Where a guarded file lands with nothing naming it: the memory directory beside the transcript rather
   than at a slug spelled out here, and the skill directories git reports — a layout is the tree's. */
const guardedDirs = (ev, root) => {
  const out = [];
  const transcript = ev.transcript_path ?? "";
  if (transcript) out.push(join(dirname(transcript), "memory"));
  const listed = root
    ? git(root, ["ls-files", "-c", "-o", "--exclude-standard", "--full-name", "--", "*/SKILL.md", "SKILL.md"])
    : "";
  /* Untracked as well as tracked: a skill nobody has committed yet is exactly the one to look for. */
  for (const rel of listed.split("\n")) {
    if (rel) out.push(join(root, dirname(dirname(rel))));
  }
  return [...new Set(out)];
};

/* Canonical, because the swept paths are, and one path of a comparison resolved while the other is not
   puts every file outside its own repository. Git resolves the link today; this does not rely on it. */
const repoRoot = (from) => {
  const said = git(from, ["rev-parse", "--show-toplevel"]).trim();
  if (!said) return "";
  try {
    return realpathSync(said);
  } catch {
    return said;
  }
};

const freshIn = (dir, since, depth = DEPTH) => {
  const out = [];
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (depth > 1) out.push(...freshIn(full, since, depth - 1));
      continue;
    }
    /* A link is no file to `readdir`, and a guarded name pointing out of the tree is a guarded write. */
    if (!guarded(full)) continue;
    try {
      const held = statSync(full);
      if (held.isFile() && held.mtimeMs >= since) out.push(full);
    } catch {
      /* a broken link, or gone between the listing and the question */
    }
  }
  return out;
};

/* A fresh mtime is not authorship: a tracked file the tree agrees with was restamped, not written. */
const changedIn = (root, files) => {
  const asked = files.map((one) => relative(root, one));
  const said = git(root, ["status", "--porcelain", "-z", "--untracked-files=all", "--", ...asked]);
  const seen = new Set(said.split("\0").filter(Boolean).map((line) => line.slice(3)));
  return files.filter((one) => seen.has(relative(root, one)));
};

/** The guarded files written lately that no call named: a script writing one is invisible to a check
 *  reading the command, so the directories it could have written are read instead. */
export const swept = (ev, freshMs) => {
  const since = Date.now() - freshMs;
  const root = repoRoot(ev.cwd || process.cwd());
  const found = [...new Set(guardedDirs(ev, root).flatMap((dir) => freshIn(dir, since)))].sort();
  const inside = root ? found.filter((one) => !relative(root, one).startsWith("..")) : [];
  const outside = found.filter((one) => !inside.includes(one));
  return [...outside, ...(inside.length ? changedIn(root, inside) : [])].sort();
};
