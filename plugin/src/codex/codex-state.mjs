/* The turn's bookkeeping: which files each checkout touched and has not consulted on, in one file
   for every repository on the machine, written under a lock. docs/cli/codex-the-log.md. */
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { basename, join } from "node:path";

import { configDir, readJson, writeJsonPrivate } from "../resolve/config.mjs";
import { logHook } from "../hooks/hook-log.mjs";

export const STATE_PATH = join(configDir("forge"), "codex.json");

export const readState = () => readJson(STATE_PATH) ?? {};

/* A list with no age reads as this turn's work however old it is. */
export const ageOf = (at, now = Date.now()) => {
  if (!at) return "at an unknown time";
  const minutes = Math.round((now - at) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute(s) ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} hour(s) ago` : `${Math.round(hours / 24)} day(s) ago`;
};

const LOCK_PATH = `${STATE_PATH}.lock`;
const STALE_MS = 5_000;
const WAIT_MS = 20;
const TRIES = 50;

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/* Whose lock this is: a stale break hands the file on, and a release by path would delete another's. */
const MINE = `${process.pid}-${randomBytes(4).toString("hex")}`;

/* One file serves every checkout on the machine, so read-add-write would lose another project's line.
   Bounded and stale-breaking: a gate that waits forever costs more than a list. */
const underLock = (fn) => {
  let held = null;
  try {
    mkdirSync(configDir("forge"), { recursive: true });
  } catch {
    /* no directory means no lock and no state; the caller's write fails the same way */
  }
  for (let tries = 0; tries < TRIES && held === null; tries += 1) {
    try {
      held = openSync(LOCK_PATH, "wx");
      writeFileSync(held, MINE);
    } catch (error) {
      if (error.code !== "EEXIST") break;
      let since = 0;
      try {
        since = statSync(LOCK_PATH).mtimeMs;
      } catch {
        since = 0;
      }
      if (since && Date.now() - since > STALE_MS) rmSync(LOCK_PATH, { force: true });
      else pause(WAIT_MS);
    }
  }
  /* Unlocked is the one moment a lost write is possible, so it leaves a trace. */
  if (held === null) {
    logHook({
      at: new Date().toISOString(),
      hook: basename(process.argv[1] ?? "", ".mjs"),
      decision: "note",
      tool: "",
      session: "",
      target: LOCK_PATH,
      reason: `the lock held for ${(TRIES * WAIT_MS) / 1000}s, so the state was written without it`,
    });
  }
  try {
    return fn();
  } finally {
    if (held !== null) {
      closeSync(held);
      try {
        if (readFileSync(LOCK_PATH, "utf8") === MINE) rmSync(LOCK_PATH, { force: true });
      } catch {
        held = null;
      }
    }
  }
};

export { underLock as holding };

/* The change is a function of the state read inside the lock, never of an earlier read. */
export const updateState = (change) =>
  underLock(() => {
    const before = readState();
    const after = change(before);
    if (after === before) return before;
    try {
      mkdirSync(configDir("forge"), { recursive: true });
      writeJsonPrivate(STATE_PATH, after);
    } catch {
      return before;
    }
    return after;
  });


/* Keyed by root: paths are relative, and two checkouts would otherwise trade files. */
export const turnsOf = (held) => held.turns ?? {};

export const pendingIn = (held, root) => turnsOf(held)[root]?.files ?? [];

export const pendingState = (root) => {
  const held = turnsOf(readState())[root];
  return { files: held?.files ?? [], at: held?.at ?? null };
};

/* A turn's second write must not repeat the first one's instruction, so the hook needs `first`. */
export const afterTouch = (held, root, rel) => {
  const files = pendingIn(held, root);
  if (files.includes(rel)) return { files, added: false, first: false };
  return { files: [...files, rel], added: true, first: files.length === 0 };
};

/* Only what was consulted on is dropped; a file recorded while the call was in flight survives. */
export const clearConsulted = (root, rels) => {
  let left = [];
  let since = null;
  updateState((held) => {
    since = turnsOf(held)[root]?.at ?? null;
    left = pendingIn(held, root).filter((rel) => !rels.includes(rel));
    return { ...held, turns: { ...turnsOf(held), [root]: { files: left, at: left.length ? since ?? Date.now() : Date.now() } } };
  });
  return { left, since };
};

/* What a commit carries, and what of this record it is asked for. `--name-only -z` needs no pairing
   for a rename and answers on a repository with no commits; a git that failed is not an empty tree,
   so it answers null, as a commit shape that cannot be enumerated does. `-a` adds every tracked
   change and a pathspec the worktree under it, added rather than substituted: one name too many
   costs a word, one too few loses the review. */
const GIT_MS = 3_000;

const names = (root, args, ms) => {
  const run = spawnSync("git", ["-C", root, ...args], { encoding: "utf8", timeout: ms });
  if (run.status !== 0) return null;
  return (run.stdout ?? "").split("\0").filter(Boolean);
};

export const stagedIn = (root, { all = false, paths = [], unknown = false } = {}, ms = GIT_MS) => {
  if (unknown) return null;
  const out = new Set();
  const add = (args) => {
    const held = names(root, args, ms);
    if (held === null) return false;
    for (const one of held) out.add(one);
    return true;
  };
  if (!add(["diff", "--cached", "--name-only", "-z"])) return null;
  if (all && !add(["diff", "--name-only", "-z"])) return null;
  if (paths.length && !add(["diff", "--name-only", "-z", "--", ...paths])) return null;
  return [...out];
};

/* An uncommitted file nobody staged is not this commit's to review (ISS-70), and where git cannot
   answer for the index the record stands whole: a gate that stands down on doubt is not a gate. */
export const demandIn = (files, staged) =>
  (staged === null ? [...files] : files.filter((rel) => staged.includes(rel)));

export const demandOf = (root, files, shape, ms) =>
  (files.length ? demandIn(files, stagedIn(root, shape, ms)) : []);
