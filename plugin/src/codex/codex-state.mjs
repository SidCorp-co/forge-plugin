/* The turn's bookkeeping: which files each checkout touched and has not consulted on, in one file
   for every repository on the machine, written under a lock. docs/cli/codex-the-log.md. */
import { lstatSync, mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isAbsolute, join } from "node:path";

import { configDir, readJson, writeJsonPrivate } from "../resolve/config.mjs";
import { underLock as holdingFile } from "../resolve/file-lock.mjs";
import { flags } from "../resolve/flags.mjs";
import { changedAgainst, digest } from "./codex-api.mjs";
import { logBytes } from "./codex-log.mjs";
import { sentShaOf } from "./log/asked.mjs";

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

/* The lock itself is `../resolve/file-lock.mjs`: the readings a mark holds are written under the
   same one, and a second copy of a bounded stale-breaking lock is how the two answers drift. */
const underLock = (fn) => holdingFile(lockPath(), fn);

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

/** The same reading as `goneFrom` of a path still on disk: no diff against the base and nothing of it staged, so a consult would be handed no bytes for it (ISS-1642).
 *  Asked of the paths themselves and never of `changedAgainst`, whose untracked half substitutes an empty list for its own failure: harmless where every subject is
 *  absent, and here it would read an unenumerated untracked file as settled. Tracked is therefore proven, not inferred. */
export const settledIn = (root, record, base = "HEAD", ms) => {
  const standing = record.filter((rel) => !absentFrom(root, rel));
  if (!standing.length) return [];
  const of = (argv) => names(root, [...argv, "--end-of-options", "--", ...standing], ms);
  const tracked = of(["ls-files", "-z"]);
  const differing = of(["diff", "--name-only", "-z", base]);
  const staged = of(["diff", "--cached", "--name-only", "-z", base]);
  if (tracked === null || differing === null || staged === null) return [];
  return standing.filter((rel) => tracked.includes(rel)
    && !differing.includes(rel) && !staged.includes(rel));
};

/** The four classes a recorded path can be in, one home, so the gate and `pending` cannot differ. */
export const pendingNow = (root, files, log = logBytes, { apart = [], ms } = {}) => {
  let entries = null;
  const read = () => (entries ??= log());
  const gone = goneFrom(root, files, "HEAD", false, ms);
  const standing = files.filter((rel) => !gone.includes(rel));
  const seen = standing.filter((rel) => !apart.includes(rel) && readByCodex(root, rel, read));
  const rest = standing.filter((rel) => !seen.includes(rel));
  const settled = settledIn(root, rest, "HEAD", ms);
  return { owed: rest.filter((rel) => !settled.includes(rel)), read: seen, gone, settled };
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
  const run = spawnSync("git", args, { cwd: root, encoding: "utf8", timeout: ms });
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

/* Whether the copy on disk has moved off the one that went up: a consult's own row carries the digest of the whole file, so a call the tree outlived is read against what the reviewer saw rather than against the log. A row with no digest is a path that was already absent when the set was bundled, and a deletion is what went up for it, so nothing on disk contradicts it; one carrying a digest and holding nothing on disk now was deleted under the call, which is a change nobody was shown. A file that is there and will not open is read as moved, no answer being no evidence. */
const movedSince = (root, { rel, sha }) => {
  try {
    return digest(readFileSync(isAbsolute(rel) ? rel : join(root, rel), "utf8")) !== sha;
  } catch {
    return sha !== undefined || !absentFrom(root, rel);
  }
};

/** Which of a set a consult sent the record lets go, on the reading the gate makes of the same paths: the working copy still the bytes that went up, and no copy staged apart from it. A consult reads the working copy, so a path whose index holds something else is one no consult can answer for — and clearing it on the send alone is what let the very consult a refusal asks for take that refusal away (ISS-1011). A git that will not answer holds every path, no answer being no evidence a reviewer saw what would land. */
export const clearableOf = (root, sent, ms = GIT_MS) => {
  const rels = sent.map((one) => one.rel);
  if (!rels.length) return { clear: [], held: [] };
  const staged = stagedIn(root, {}, ms);
  if (staged === null) return { clear: [], held: rels };
  const apart = apartFrom(root, rels.filter((rel) => staged.includes(rel)), ms);
  const held = sent.filter((one) => apart.includes(one.rel) || movedSince(root, one)).map((one) => one.rel);
  return { clear: rels.filter((rel) => !held.includes(rel)), held };
};

export const heldSaid = (held) => `${held.length} file(s) this consult sent stay in the record: what a `
  + `commit would carry for them is not what went up — ${held.join(", ")}. Stage the copy that was read `
  + "with `git add`, since the next consult reads that same working copy, or drop them with `forge "
  + "codex pending --drop`.";

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

/* The verb that prints this record, beside the record it reads, as the log's own printing sits beside the log: a listing that named 726 paths the gate never looked at cost five consults and cleared nothing (ISS-70). */
export const PENDING_USAGE = [
  "Usage: forge codex pending [--drop]",
  "What this turn touched and has not been consulted on, which is what a commit is asked for.",
  "",
  "  --drop         discard every path this checkout's record still holds, staged or not,",
  "                 read or not. Two sessions in one checkout share that record",
].join("\n");

export const pending = (rest, root) => {
  const { drop } = flags(rest, "codex pending", ["--drop"], { usage: PENDING_USAGE });
  const held = readState();
  const waiting = root ? pendingIn(held, root) : [];
  /* Said on every branch, the empty one most of all: this record and the commit gate's both sit
     under XDG_CONFIG_HOME and the gate reads the session's, so `nothing pending` here and a refusal
     naming the same file there are two answers about two records (ISS-189). */
  const from = () => console.log(`read from ${configDir("forge")}`);
  if (!waiting.length) {
    console.log("nothing pending");
    return from();
  }
  const { owed, read, gone, settled } = pendingNow(root, waiting, logBytes, { apart: apartFrom(root, waiting) });
  /* Dropped as the record is read: a path no write stands behind was reported as work owed by every later consult, and no consult could ever be handed bytes for it (ISS-952). A settled path is the same case standing still (ISS-1642). */
  const behind = [...gone, ...settled];
  if (behind.length) clearConsulted(root, behind);
  const goneLine = `recorded and no longer in the tree, so out of the record now: ${gone.join(", ")}`;
  const settledLine = `recorded and carrying no diff a consult could be handed, so out of the record `
    + `now: ${settled.join(", ")}`;
  const kept = owed.length + read.length;
  if (!kept) {
    console.log(`nothing pending. ${[gone.length ? goneLine : "", settled.length ? settledLine : ""].filter(Boolean).join("\n")}`);
    return from();
  }
  /* The record's own set and never the index's: scoped to what a commit stages, this discard left the gate's own hold over the working copy standing while three surfaces named it as the way out (ISS-392). `gone` and `settled` left above, and a consult's rows stay in the log with every verdict they are owed. */
  if (drop) {
    const { left } = clearConsulted(root, [...owed, ...read]);
    console.log(`dropped ${kept} recorded file(s), ${owed.length} of which no consult had read; `
      + "nothing recorded for this checkout is owed a reading now.");
    if (left.length) console.log(`still recorded, written while this call read: ${left.join(", ")}`);
    return from();
  }
  const demand = demandOf(root, owed);
  const unstaged = owed.filter((rel) => !demand.includes(rel));
  console.log(demand.length ? demand.join("\n") : "nothing staged that codex has not read");
  console.log(`\nwhat a commit made now is asked for, out of ${kept} file(s) recorded `
    + `${ageOf(held.turns?.[root]?.at)}; \`forge codex pending --drop\` discards all ${kept} unread.`);
  if (unstaged.length) {
    console.log(`recorded and not staged, which a commit takes only with -a or a pathspec: ${unstaged.join(", ")}`);
  }
  if (read.length) {
    console.log(`recorded and read at the bytes a commit would carry, so none is held for them: ${read.join(", ")}`);
  }
  if (gone.length) console.log(goneLine);
  if (settled.length) console.log(settledLine);
  return from();
};
