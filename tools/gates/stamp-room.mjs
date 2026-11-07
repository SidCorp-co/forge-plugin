import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { madeIn } from "../../plugin/test/fixtures/room.mjs";
import { stampRoom } from "../../plugin/src/hooks/stamps.mjs";

/** Said where the root outlived its sweep: a machine that accumulates them is otherwise silent, and a throw out
 *  of an exit handler replaces the code the run chose with node's own (ISS-1728). */
const rootLeftSaid = (dir, error) => `This process could not remove its temporary root ${dir}: `
  + `${error.code ?? error.message}. Something may still be writing into it, or a directory in it refuses the removal. `
  + `Once nothing is, remove it:\n  rm -rf ${dir}\n`;

export const ROOT_PREFIX = "forge-gate-tmp-";
export const OWNER = "forge-gate-owner.pid";
// cm:why no gate runs a day, so a root that old is a killed run's whatever pid its owner file names, a reused pid included
export const ORPHANED_AFTER_MS = 24 * 60 * 60 * 1000;

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
};

const ownerOf = (dir) => {
  try {
    return Number(readFileSync(join(dir, OWNER), "utf8"));
  } catch {
    return Number.NaN;
  }
};

const orphaned = (dir, now) => {
  const pid = ownerOf(dir);
  return (Number.isInteger(pid) && pid > 0 && !alive(pid)) || now - statSync(dir).mtimeMs > ORPHANED_AFTER_MS;
};

/** The roots a killed run left, which its exit handler never reached (ISS-65); returns the ones removed. */
export const sweepOrphans = (tmp = tmpdir(), now = Date.now()) => {
  let names;
  try {
    names = readdirSync(tmp).filter((one) => one.startsWith(ROOT_PREFIX));
  } catch {
    return [];
  }
  const swept = [];
  for (const name of names) {
    const dir = join(tmp, name);
    try {
      if (!orphaned(dir, now)) continue;
      rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      swept.push(dir);
    } catch {
      // cm:why a root another user owns, or one a concurrent sweep removed first, is not this run's to report
    }
  }
  return swept;
};

/** One temp root per run, every step spawned under it. Removed however the run ends, since a throw from a step or the
 *  ledger exits past every verdict; a SIGKILL leaves it for the next run's sweep, and `KEEP_TEST_ROOMS` keeps it a day.
 *  Node's own retries cover a worker still dying into it; past them the root is named rather than thrown about. */
export const gateTmp = () => {
  const swept = sweepOrphans();
  if (swept.length) process.stderr.write(`removed ${swept.length} temp root(s) a killed gate left under ${tmpdir()}\n`);
  const at = join(tmpdir(), ROOT_PREFIX);
  const dir = madeIn(at, () => mkdtempSync(at));
  if (process.env.KEEP_TEST_ROOMS === "1") process.stderr.write(`keeping this gate's temp root: ${dir}\n`);
  else {
    writeFileSync(join(dir, OWNER), String(process.pid));
    process.on("exit", () => {
      try {
        rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      } catch (error) {
        process.stderr.write(rootLeftSaid(dir, error));
      }
    });
  }
  return dir;
};

const ROOM = basename(stampRoom());

/** Where a step left the stamp room, with how many stamps are in it; null is the pass. */
export function roomLeft(dir) {
  const at = join(dir, ROOM);
  if (!existsSync(at)) return null;
  return { at, stamps: readdirSync(at).length };
}

export const leakMessage = ({ at, stamps }) =>
  `This step left ${stamps} hook stamp(s) in ${at}, the temporary directory this gate handed it.\n`
  + `A gate resolves that room under TMPDIR at every call, so on a developer's machine the same\n`
  + `write lands in the room every hook reads and reaps before every stamp of its own — and a\n`
  + `suite's green says nothing about what it left there.\n`
  + `Counting the machine's room instead would prove nothing: the session running this gate stamps\n`
  + `into it throughout. So the run gives its steps a temp root no hook outside it can name, and the\n`
  + `room turning up in it at all is the leak.\n`
  + `plugin/test/fixtures.mjs points TMPDIR at the test process's own root for every test file that\n`
  + `imports it. The file to fix is the one that reached a gate without it.`;
