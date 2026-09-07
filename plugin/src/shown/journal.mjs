/* How a credit survives; what a row means is `ledger.mjs`'s. Moved whole from `tracker/comments.mjs`
   with its proofs, so the mechanism is unchanged. Why it is shaped so: docs/cli/the-shown-ledger.md. */
import {
  closeSync, fstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync,
  statSync, writeFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { basename, join } from "node:path";

import { configDir, readJson, writeJsonPrivate } from "../resolve/config.mjs";
import { jsonLines } from "../hooks/hook-log-file.mjs";

/* A credit is an append and a read is the fold: two appending lose neither line, where two that
   rebuild this file leave only the later's, and no lock closes that (ISS-661). */
const STATE = () => join(configDir("forge"), "shown.json");
const LOG = () => join(configDir("forge"), "shown.jsonl");
export const KEPT = { items: 400, perSession: 6_000, days: 1, lines: 200 };

const DAY_MS = 86_400_000;

const timeOf = (row) => Date.parse(row?.at ?? "") || 0;

const base = () => {
  const held = readJson(STATE());
  return held && typeof held === "object" ? held : {};
};

const lines = (path) => {
  try {
    return jsonLines(readFileSync(path, "utf8"));
  } catch {
    return [];
  }
};

/* An aside is a journal a fold is holding, and reads like one: a failed fold is owed again, not lost. */
const journals = () => {
  const room = configDir("forge");
  const mine = `${basename(LOG())}.`;
  let aside = [];
  try {
    aside = readdirSync(room).filter((one) => one.startsWith(mine) && one.endsWith(".folding"));
  } catch { /* a directory that cannot be listed holds nothing folding */ }
  return [LOG(), ...aside.map((one) => join(room, one))];
};

const creditsIn = (paths) => paths
  .flatMap(lines)
  .filter((one) => one?.session && one?.surface && Array.isArray(one.items))
  .sort((one, two) => String(one.at).localeCompare(String(two.at)));

/* Insertion order is touch order, so the front is coldest and one short keeps the surface just read. */
const budgeted = (surfaces) => {
  const rows = Object.entries(surfaces);
  let total = rows.reduce((sum, [, items]) => sum + items.length, 0);
  let from = 0;
  while (total > KEPT.perSession && from < rows.length - 1) {
    total -= rows[from][1].length;
    from += 1;
  }
  return Object.fromEntries(rows.slice(from));
};

const added = (all, one) => {
  const mine = { ...(all[one.session]?.surfaces ?? {}) };
  const older = (mine[one.surface] ?? []).filter((item) => !one.items.includes(item));
  const kept = [...new Set([...older, ...one.items])].slice(-KEPT.items);
  delete mine[one.surface];
  const at = one.at ?? all[one.session]?.at ?? new Date().toISOString();
  return { ...all, [one.session]: { at, surfaces: budgeted({ ...mine, [one.surface]: kept }) } };
};

const living = (all) => {
  const since = Date.now() - KEPT.days * DAY_MS;
  return Object.fromEntries(Object.entries(all).filter(([, row]) => timeOf(row) >= since));
};

const foldedFrom = (paths) => living(creditsIn(paths).reduce(added, base()));

export const folded = () => foldedFrom(journals());

/* Never memoised: two processes of one session share these files, and a stale read drops a delivery. */
const creditsOf = (session, surface) => folded()[session]?.surfaces?.[surface] ?? [];

export const creditedTo = (session, surface) => new Set(creditsOf(session, surface));

/** The newest item on a surface, or null: the list is kept in the order it was credited. */
export const lastCredited = (session, surface) => creditsOf(session, surface).at(-1) ?? null;

/* A token for the reason `codex-state.mjs` gives its own, ISS-661; here it guards the fold alone. */
const MINE = `${process.pid}-${randomBytes(4).toString("hex")}`;
const LOCK = { staleMs: 5_000, tries: 25, pauseMs: 20 };

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const owner = (lock) => {
  try {
    return readFileSync(lock, "utf8");
  } catch {
    return null;
  }
};

/** Still that holder, still stale, and there at all: a missing lock is not an old one (ISS-673). */
export const shedable = (since, whose, mine) => since !== undefined && whose !== null
  && (whose === mine || Date.now() - since > LOCK.staleMs);

const shed = (lock, whose) => {
  if (!shedable(statSync(lock, { throwIfNoEntry: false })?.mtimeMs, whose, MINE)) return;
  if (owner(lock) === whose) rmSync(lock, { force: true });
};

/* A fold not taken is a longer journal and nothing else, so a lock this cannot get is left alone. */
const heldLock = (lock) => {
  for (let tries = 0; tries < LOCK.tries; tries += 1) {
    try {
      const held = openSync(lock, "wx", 0o600);
      writeFileSync(held, MINE);
      closeSync(held);
      return true;
    } catch (error) {
      if (error.code !== "EEXIST") return false;
      shed(lock, owner(lock));
      pause(LOCK.pauseMs);
    }
  }
  return false;
};

/* Exactly one of several concurrent folds wins the rename; the loser leaves the file alone. */
const fold = () => {
  if (lines(LOG()).length < KEPT.lines) return;
  /* Per rotation, not per process: a second one would rename over its own waiting aside. */
  const aside = `${LOG()}.${MINE}-${randomBytes(4).toString("hex")}.folding`;
  try {
    renameSync(LOG(), aside);
  } catch {
    return;
  }
  const lock = `${STATE()}.lock`;
  if (!heldLock(lock)) return;
  try {
    /* No time cutoff stands in for reading the set: a rename carries the journal's own mtime. */
    const read = journals();
    const built = foldedFrom(read);
    /* Lost mid-fold: another is folding from a later base, and these asides are its to sweep. */
    if (owner(lock) !== MINE) return;
    writeJsonPrivate(STATE(), built);
    for (const one of read.slice(1)) rmSync(one, { force: true });
  } catch { /* the file is as it was and the aside still reads, so the fold is simply owed again */ }
  shed(lock, MINE);
};

/* The append and the rotation under it are one call each, so the line is confirmed against the
   journal it was for and written again where it landed elsewhere; items are a set, so twice is once. */
const APPEND_TRIES = 25;

const appended = (row) => {
  const line = `${JSON.stringify(row)}\n`;
  for (let tries = 0; tries < APPEND_TRIES; tries += 1) {
    let held = null;
    try {
      mkdirSync(configDir("forge"), { recursive: true });
      held = openSync(LOG(), "a", 0o600);
      writeFileSync(held, line);
      const mine = fstatSync(held);
      if (mine.nlink > 0 && statSync(LOG(), { throwIfNoEntry: false })?.ino === mine.ino) return true;
    } catch {
      return false;
    } finally {
      if (held !== null) closeSync(held);
    }
  }
  return false;
};

/** One credit: the items this session has now been shown on this surface. Folded on the way out, so
 *  the journal is bounded by whoever writes it rather than by whoever happens to read it next. */
export const credit = (session, surface, items) => {
  const kept = [...new Set(items.filter(Boolean).map(String))];
  if (!session || !surface || !kept.length) return false;
  if (!appended({ at: new Date().toISOString(), session, surface, items: kept })) return false;
  fold();
  return true;
};
