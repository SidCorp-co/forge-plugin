/* The turn's bookkeeping: which files each checkout touched and has not consulted on, in one file
   for every repository on the machine, written under a lock. docs/cli/codex-the-log.md. */
import { closeSync, lstatSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { basename, isAbsolute, join } from "node:path";

import { configDir, readJson, writeJsonPrivate } from "../resolve/config.mjs";
import { logHook } from "../hooks/hook-log-file.mjs";
import { changedAgainst, digest } from "./codex-api.mjs";
import { logEntries, sentShaOf } from "./codex-log.mjs";

export const statePath = () => join(configDir("forge"), "codex.json");

export const readState = () => readJson(statePath()) ?? {};

/* A list with no age reads as this turn's work however old it is. */
export const ageOf = (at, now = Date.now()) => {
  if (!at) return "at an unknown time";
  const minutes = Math.round((now - at) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute(s) ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} hour(s) ago` : `${Math.round(hours / 24)} day(s) ago`;
};

const lockPath = () => `${statePath()}.lock`;
const STALE_MS = 5_000;
const WAIT_MS = 20;
const TRIES = 50;

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/* Whose lock this is: a stale break hands the file on, and a release by path would delete another's. */
const MINE = `${process.pid}-${randomBytes(4).toString("hex")}`;

/* One file serves every checkout on the machine, so read-add-write would lose another project's line.
   Bounded and stale-breaking: a gate that waits forever costs more than a list. */
const underLock = (fn) => {
  const lock = lockPath();
  let held = null;
  try {
    mkdirSync(configDir("forge"), { recursive: true });
  } catch {
    /* no directory means no lock and no state; the caller's write fails the same way */
  }
  for (let tries = 0; tries < TRIES && held === null; tries += 1) {
    try {
      held = openSync(lock, "wx");
      writeFileSync(held, MINE);
    } catch (error) {
      if (error.code !== "EEXIST") break;
      let since = 0;
      try {
        since = statSync(lock).mtimeMs;
      } catch {
        since = 0;
      }
      if (since && Date.now() - since > STALE_MS) rmSync(lock, { force: true });
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
      target: lock,
      reason: `the lock held for ${(TRIES * WAIT_MS) / 1000}s, so the state was written without it`,
    });
  }
  try {
    return fn();
  } finally {
    if (held !== null) {
      closeSync(held);
      try {
        if (readFileSync(lock, "utf8") === MINE) rmSync(lock, { force: true });
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
      writeJsonPrivate(statePath(), after);
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

const turnAt = (files, since) => (files.length ? since ?? Date.now() : Date.now());

/* A turn's second write must not repeat the first one's instruction, so the hook needs `first`; and a
   write leaving the bytes a consult was shown clears a standing entry, nothing else being able to. */
export const afterTouch = (held, root, rel, read = false) => {
  const files = pendingIn(held, root);
  const has = files.includes(rel);
  const since = turnsOf(held)[root]?.at ?? null;
  if (read) {
    const left = files.filter((one) => one !== rel);
    return { files: left, at: turnAt(left, since), added: false, first: false, cleared: has };
  }
  if (has) return { files, at: turnAt(files, since), added: false, first: false, cleared: false };
  return { files: [...files, rel], at: Date.now(), added: true, first: files.length === 0, cleared: false };
};

/* Content codex has read is not owed a second reading: the digest of what went up is the log's. */
export const readByCodex = (root, rel, log) => {
  let text;
  try {
    text = readFileSync(join(root, rel), "utf8");
  } catch {
    return false;
  }
  return digest(text) === sentShaOf(log(), root, rel);
};

/** The three classes a recorded path can be in, one home, so the gate and `pending` cannot differ. */
export const pendingNow = (root, files, log = logEntries, { apart = [], ms } = {}) => {
  let entries = null;
  const read = () => (entries ??= log());
  const gone = goneFrom(root, files, "HEAD", false, ms);
  const left = files.filter((rel) => !gone.includes(rel));
  const seen = left.filter((rel) => !apart.includes(rel) && readByCodex(root, rel, read));
  return { owed: left.filter((rel) => !seen.includes(rel)), read: seen, gone };
};

/* Only what was consulted on is dropped; a file recorded while the call was in flight survives. */
export const clearConsulted = (root, rels) => {
  let left = [];
  let since = null;
  updateState((held) => {
    since = turnsOf(held)[root]?.at ?? null;
    left = pendingIn(held, root).filter((rel) => !rels.includes(rel));
    return { ...held, turns: { ...turnsOf(held), [root]: { files: left, at: turnAt(left, since) } } };
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

/* Whose staged copy is not what is on disk: with no `-a` the index is carried, and a failed git answers all. */
export const apartFrom = (root, rels, ms = GIT_MS) =>
  (rels.length ? names(root, ["diff", "--name-only", "-z", "--", ...rels], ms) ?? rels : []);

/** Whether a commit would carry bytes for one path that are not the ones on disk: a change staged for it, and that staged copy apart from the working copy. The second probe alone is not the question — a file whose read bytes are in no commit reads apart while nothing of it is staged and a commit carries none of it. Either probe unanswered says yes, no answer being no evidence a reviewer saw what would land (ISS-1005); `staged` is for a caller already holding that list. */
export const stagedApart = (root, rel, { staged, ms = GIT_MS } = {}) => {
  const held = staged === undefined ? stagedIn(root, {}, ms) : staged;
  if (held === null) return true;
  if (!held.includes(rel)) return false;
  return apartFrom(root, [rel], ms).includes(rel);
};

/** One index read per checkout, for a caller asking about several paths of it: git answers the same for every path of one checkout, and a memo any longer-lived than the caller would answer from an index that had moved. */
export const stagedReader = () => {
  const held = new Map();
  return (root, ms) => {
    if (!held.has(root)) held.set(root, stagedIn(root, {}, ms));
    return held.get(root);
  };
};

/* `lstat` not `stat`, so a dangling link is present; and only ENOENT, so an EACCES file stays. */
export const absentFrom = (root, rel) => {
  try {
    lstatSync(isAbsolute(rel) ? rel : join(root, rel));
    return false;
  } catch (error) {
    return error.code === "ENOENT";
  }
};

/** What no write stands behind: absent, no change against the base, and nothing of it staged either,
 *  a removed working copy hiding a staged addition from both. A probe that failed drops nothing. */
export const goneFrom = (root, record, base = "HEAD", fromParting = false, ms) => {
  const absent = record.filter((rel) => absentFrom(root, rel));
  if (!absent.length) return [];
  const changed = changedAgainst(root, base, fromParting, ms);
  const staged = stagedIn(root, {}, ms);
  if (changed === null || staged === null) return [];
  return absent.filter((rel) => !changed.includes(rel) && !staged.includes(rel));
};

export const goneSaid = (gone, base) => `${gone.length} path(s) this turn's record held are absent from `
  + `the tree and carry no diff against ${base}: ${gone.join(", ")}. Out of the review, out of the log `
  + "and out of the record, so no later consult is offered them.";
