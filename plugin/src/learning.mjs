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

/* Where a guarded file can land with nothing naming it: the session's own memory directory, which is
   the transcript's neighbour rather than a slug this code spells out, and the skill directories the
   repository already keeps — asked of git, since a tree's layout is not this plugin's to assume. */
const guardedDirs = (ev) => {
  const out = [];
  const transcript = ev.transcript_path ?? "";
  if (transcript) out.push(join(dirname(transcript), "memory"));
  const root = git(ev.cwd || process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
  if (root) {
    for (const rel of git(root, ["ls-files", "--full-name", "--", "*/SKILL.md", "SKILL.md"]).split("\n")) {
      if (rel) out.push(join(root, dirname(dirname(rel))));
    }
  }
  return [...new Set(out)];
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
    if (!entry.isFile() || !guarded(full)) continue;
    try {
      if (statSync(full).mtimeMs >= since) out.push(realpathSync(full));
    } catch {
      /* gone between the listing and the question */
    }
  }
  return out;
};

/* A fresh mtime is not authorship: `git pull` and `git checkout` restamp every skill file they carry.
   A tracked file the tree agrees with was not written here, whoever touched it. */
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
  const root = git(ev.cwd || process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
  const found = [...new Set(guardedDirs(ev).flatMap((dir) => freshIn(dir, since)))].sort();
  const inside = root ? found.filter((one) => !relative(root, one).startsWith("..")) : [];
  const outside = found.filter((one) => !inside.includes(one));
  return [...outside, ...(inside.length ? changedIn(root, inside) : [])].sort();
};
