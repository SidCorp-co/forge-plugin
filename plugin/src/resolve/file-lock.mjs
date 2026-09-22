/* One writer at a time over a file under the forge config directory, for the stores a second process
   can reach at the same moment: the turn's bookkeeping, and the readings a mark holds. Bounded and
   stale-breaking, because a gate that waits forever costs more than the write it is guarding, and
   the one moment a lost write is possible leaves a trace rather than passing silently. */
import { linkSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { basename } from "node:path";

import { configDir } from "./config.mjs";
import { logHook } from "../hooks/log/hook-log-file.mjs";

const STALE_MS = 5_000;
const WAIT_MS = 20;
const TRIES = 50;

/** What a strict caller is refused with, rather than being run unguarded. */
export class Unlocked extends Error {}

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/* Whose lock this is: a break hands the file on, and a release by path would delete another's. The
   pid leads it so a waiter can ask the system whether that holder is still there. */
const MINE = `${process.pid}-${randomBytes(4).toString("hex")}`;

const ALIVE = "alive";
const GONE = "gone";
/* A third answer, and the reason there are three: a lock whose text cannot be read is not a lock
   nobody holds. Read as `gone` it could be taken from a process that is at that moment publishing
   it, and two callers would run inside one guard. */
const UNKNOWN = "unknown";

const holderOf = (lock) => {
  let text = "";
  try {
    text = readFileSync(lock, "utf8");
  } catch {
    return UNKNOWN;
  }
  const pid = Number.parseInt(text.split("-")[0], 10);
  if (!Number.isInteger(pid) || pid <= 0) return UNKNOWN;
  try {
    process.kill(pid, 0);
    return ALIVE;
  } catch (error) {
    /* Someone else's process, which this one may not signal: alive, and not this caller's to take. */
    return error.code === "EPERM" ? ALIVE : GONE;
  }
};

/** Takes the lock, or answers null. The text is written to a name of this caller's own and LINKED
 *  into place, so the lock never exists at its own path holding anything but a whole owner: link
 *  publishes an inode that was already complete, and refuses outright where the path is taken. */
const claim = (lock) => {
  const aside = `${lock}.${MINE}`;
  try {
    writeFileSync(aside, MINE, { flag: "wx", mode: 0o600 });
    linkSync(aside, lock);
    return aside;
  } catch {
    rmSync(aside, { force: true });
    return null;
  }
};

/** Hands on a lock whose holder has ended. The name is renamed away before it is removed, so of two
 *  waiters reading one dead holder exactly one moves it: the other's rename finds nothing there and
 *  it goes back to waiting, rather than removing the replacement the first has since taken. */
const reclaim = (lock) => {
  const aside = `${lock}.gone.${MINE}`;
  try {
    renameSync(lock, aside);
  } catch {
    return;
  }
  rmSync(aside, { force: true });
};

/** Runs `fn` with `lock` held, and returns whatever it returns. The lock path is the caller's, so two
 *  stores under one config directory do not queue behind each other.
 *
 *  Three things a store says for itself, because what a lost write costs is not the same for all of
 *  them. `strict` refuses rather than running unguarded, for a store where a lost record is the
 *  reading somebody will later compare against; without it the function runs anyway, which is right
 *  where the write is bookkeeping and a queue would cost more than the line. `stale` is how long a
 *  holder may be quiet before a caller that is not strict takes the lock from it anyway. `waits` is
 *  the budget spent before either answer. */
export const underLock = (lock, fn, { strict = false, stale = STALE_MS, waits = TRIES * WAIT_MS } = {}) => {
  let held = null;
  try {
    mkdirSync(configDir("forge"), { recursive: true });
  } catch {
    /* no directory means no lock and no state; the caller's write fails the same way */
  }
  const tries = Math.max(1, Math.round(waits / WAIT_MS));
  for (let n = 0; n < tries && held === null; n += 1) {
    held = claim(lock);
    if (held !== null) break;
    const holder = holderOf(lock);
    let since = 0;
    try {
      since = statSync(lock).mtimeMs;
    } catch {
      since = 0;
    }
    /* A holder that has ended is handed on at once, whichever mode this is: waiting out a budget for
       a process that is not there helps nobody. A holder still running is never taken from a strict
       caller — it waits out the budget and is refused — because the alternative is two callers inside
       one guard. A caller that is not strict keeps the age rule, a queue costing it more than the
       write it is guarding. */
    if (holder === GONE) reclaim(lock);
    else if (holder !== UNKNOWN && !strict && since && Date.now() - since > stale) reclaim(lock);
    else pause(WAIT_MS);
  }
  if (held === null && strict) {
    throw new Unlocked(`${lock} was held for ${waits / 1000}s, so nothing was written under it.`);
  }
  if (held === null) {
    logHook({
      at: new Date().toISOString(),
      hook: basename(process.argv[1] ?? "", ".mjs"),
      decision: "note",
      tool: "",
      session: "",
      target: lock,
      reason: `the lock held for ${waits / 1000}s, so the state was written without it`,
    });
  }
  try {
    return fn();
  } finally {
    if (held !== null) {
      rmSync(held, { force: true });
      try {
        if (readFileSync(lock, "utf8") === MINE) rmSync(lock, { force: true });
      } catch {
        /* Already handed on, or gone: either way this caller has nothing left to release. */
      }
    }
  }
};
