/* One landing at a time on this checkout: four worktrees push to one branch, and a five-minute gate
   is long enough that the remote always moves under one of them. The lock is a file whose existence
   is the lock, never flock(2), because the kernel drops an advisory lock when the holder dies and a
   landing lock that vanishes silently is one nobody is told about (ISS-333). */
import { closeSync, existsSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { gitCommonDir, gitOut, stop } from "../checkout.mjs";
import { watching } from "../watching.mjs";

const LOCK = "forge-ship-lock";

/* The COMMON directory, never `--absolute-git-dir`: a linked worktree answers that per-worktree, so
   a lock there contends with nothing and looks exactly like a lock that works. */
export const lockFile = (from) => join(gitCommonDir(from) ?? from, LOCK);

/** A legitimate wait is long; past this the holder is wedged or the notification was lost. */
export const WAIT_MS = 30 * 60 * 1000;

const held = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};

const running = (pid) => {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
};

/* `wx` is the whole of the exclusion: create-or-fail is one syscall. */
const took = (path, mine) => {
  let handle = null;
  try {
    handle = openSync(path, "wx");
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  }
  try {
    writeFileSync(handle, `${JSON.stringify(mine, null, 2)}\n`);
  } catch (error) {
    /* Created and then unwritable is the worst of both: the branch is held, nothing in the file
       names a holder, and the caller gets an exception rather than the release to call. */
    rmSync(path, { force: true });
    throw error;
  } finally {
    closeSync(handle);
  }
  return true;
};

const whose = (one) => (one
  ? `${one.tree} (pid ${one.pid}${one.branch ? ` on ${one.branch}` : ""}, since ${one.since})`
  : "a ship that left no name in it");

const staleSaid = (path, one) => `a landing that is no longer running left this checkout's landing lock behind, `
  + `so nothing can land until it is cleared:\n  ${path}\n  taken by ${whose(one)}, and that pid is not `
  + `running.\nNothing removes it for you — a lock taken over silently is one that was never a lock. `
  + `Clear it, then run this landing again:\n  rm ${path}`;

const spent = (ms) => (ms < 60_000 ? `${Math.round(ms / 1000)} second(s)` : `${Math.round(ms / 60_000)} minute(s)`);

const wedgedSaid = (path, one, ms) => `this checkout's landing lock has been held by ${whose(one)} for `
  + `${spent(ms)} and that process is still running, so this landing waited rather `
  + `than racing it. Read what that run is doing. Where it is wedged rather than gating, clear the lock `
  + `and run this landing again:\n  rm ${path}`;

/** The lock, waited for on a notification rather than a poll, and the release to call. */
export const takeShipLock = async (from, mine, { ms = WAIT_MS, say = console.log } = {}) => {
  const path = lockFile(from);
  const record = { ...mine, pid: process.pid, since: new Date().toISOString() };
  const until = Date.now() + ms;
  let waited = false;
  for (;;) {
    /* Armed BEFORE the create, and this order is the whole of the race: a release landing between a
       failed create and a wait armed after it leaves the ship waiting out the ceiling behind nobody. */
    const wait = watching(path, Math.max(until - Date.now(), 1));
    let taken = false;
    try {
      taken = took(path, record);
    } catch (error) {
      wait.cancel();
      throw error;
    }
    if (taken) {
      wait.cancel();
      if (waited) say(`  the landing ahead has pushed; this one holds the lock`);
      return () => dropShipLock(path, record.pid);
    }
    const other = held(path);
    if (other && !running(other.pid)) {
      wait.cancel();
      stop(staleSaid(path, other));
    }
    if (Date.now() >= until) {
      wait.cancel();
      stop(wedgedSaid(path, other, ms));
    }
    if (!waited && other) {
      say(`  waiting behind the landing in ${whose(other)} — one landing at a time on this checkout, `
        + `and a gate takes minutes, so this is a wait and not a hang`);
      waited = true;
    }
    await wait.settled;
    wait.cancel();
  }
};

/** Only ever one's own: removing another's hands the branch to two landings at once. */
export const dropShipLock = (path, pid) => {
  if (!existsSync(path)) return false;
  if (held(path)?.pid !== pid) return false;
  rmSync(path, { force: true });
  return true;
};

export const shipHolder = (tree) => ({ tree, branch: gitOut(["rev-parse", "--abbrev-ref", "HEAD"], tree) });
