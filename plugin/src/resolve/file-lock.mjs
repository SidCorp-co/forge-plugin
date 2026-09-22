/* One writer at a time over a file under the forge config directory, for the stores a second process
   can reach at the same moment: the turn's bookkeeping, and the readings a mark holds. Bounded and
   stale-breaking, because a gate that waits forever costs more than the write it is guarding, and
   the one moment a lost write is possible leaves a trace rather than passing silently. */
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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

/** Whether the process that took this lock is still running. Asked before any break, because elapsed
 *  time is not evidence that a holder is gone — it is evidence that its work is long, which is
 *  exactly what a whole-file rewrite is. A pid this process may not signal is alive and someone
 *  else's; an unreadable or malformed lock answers for nobody and may be taken. */
const holderAlive = (lock) => {
  let pid = 0;
  try {
    pid = Number.parseInt(readFileSync(lock, "utf8").split("-")[0], 10);
  } catch {
    return false;
  }
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
};

/** Runs `fn` with `lock` held, and returns whatever it returns. The lock path is the caller's, so two
 *  stores under one config directory do not queue behind each other.
 *
 *  Three things a store says for itself, because what a lost write costs is not the same for all of
 *  them. `strict` refuses rather than running unguarded, for a store where a lost record is the
 *  reading somebody will later compare against; without it the function runs anyway, which is right
 *  where the write is bookkeeping and a queue would cost more than the line. `stale` is how long a
 *  holder may be quiet before it is taken for gone, and a store whose guarded work is a whole-file
 *  rewrite needs longer than one whose work is a field. `waits` is the budget before either. */
export const underLock = (lock, fn, { strict = false, stale = STALE_MS, waits = TRIES * WAIT_MS } = {}) => {
  let held = null;
  try {
    mkdirSync(configDir("forge"), { recursive: true });
  } catch {
    /* no directory means no lock and no state; the caller's write fails the same way */
  }
  const tries = Math.max(1, Math.round(waits / WAIT_MS));
  for (let n = 0; n < tries && held === null; n += 1) {
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
      /* A holder that is gone is broken at once, whichever mode this is: waiting out a budget for a
         process that ended helps nobody. A holder that is still there is never broken for a strict
         caller — it waits out the budget and is refused — because the alternative is two processes
         inside one critical section, which is the thing the lock is for. A caller that is not strict
         keeps the age rule, a queue costing it more than the write it is guarding. */
      if (!holderAlive(lock)) rmSync(lock, { force: true });
      else if (!strict && since && Date.now() - since > stale) rmSync(lock, { force: true });
      else pause(WAIT_MS);
    }
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
      closeSync(held);
      try {
        if (readFileSync(lock, "utf8") === MINE) rmSync(lock, { force: true });
      } catch {
        held = null;
      }
    }
  }
};
