/* A landing given `--wait M` on a tree whose landing still runs waits for that one to end rather than
   refusing at once, which left the caller to chain a wait and a second landing by hand (ISS-2488).
   The wait is the detached landing's own and never its caller's: a host call ends at its ceiling long
   before an hour's `--wait` does, and the detached landing outlives the call. It writes nothing of
   the tree's landing record until the landing ahead has recorded its end there, so one landing per
   tree holds throughout, and it takes no step — so no lock and no gate place — while it waits. */
import { rmSync } from "node:fs";

import { read, stop } from "../../checkout.mjs";
import { recorded, reservationIn, reserved, startOf, stillLanding, waitCommand, waitingIn } from "./record.mjs";

/** Carries the landing ahead from the launcher to the waiter, and is taken off the waiter's
 *  environment before anything it runs could inherit it. */
export const BEHIND = "FORGE_LANDING_BEHIND";

/* How often the waiter reads the record, and how often it says it is still waiting: a caller relaying
   an hour's wait reads one line every few minutes rather than a silence it cannot tell from a hang. */
const POLL_MS = 250;
const TOLD_MS = 5 * 60_000;

/* A landing killed by a signal records no end of its own; its caller writes the signal a moment
   later. Gone with no end is only an answer once it has stayed so for this long. */
const GONE_MS = 2000;

const pause = new Int32Array(new SharedArrayBuffer(4));

const spent = (ms) => (ms < 60_000 ? `${Math.round(ms / 1000)} second(s)` : `${Math.round(ms / 60_000)} minute(s)`);

/** The minutes `--wait` gives, off the line the verb was already read whole from; undefined where it
 *  was not given, and refused here where it is no number of minutes, since the verb itself would
 *  refuse it only after this wait had spent it. */
export const waitGiven = (argv) => {
  const at = argv.indexOf("--wait");
  if (at < 0) return undefined;
  const given = argv[at + 1];
  const minutes = Number(given);
  if (!(minutes > 0)) stop(`--wait takes the minutes to wait behind another landing, not \`${given}\`.`);
  return minutes;
};

export const waiterSaid = (waiter, wait) => `a ${waiter.verb ?? "landing"} of this tree is already waiting `
  + `behind its running landing, as pid ${waiter.pid} since ${waiter.since}, and one waits at a time. `
  + `Its output is kept in ${waiter.out}. Wait on it in one call, which answers how it ended: ${wait}`;

const howEnded = (ended) => {
  if (ended.signal) return `was ended by ${ended.signal}`;
  return ended.code === 0 ? "succeeded" : `failed, exiting ${ended.code}`;
};

/* Only this waiter's own file, so a waiter refused past its deadline never removes a later one's. */
const unlisted = (dir) => {
  if (read(waitingIn(dir))?.pid === process.pid) rmSync(waitingIn(dir), { force: true });
};

const refused = (dir, said) => {
  unlisted(dir);
  stop(said);
};

const stillSaid = (ahead, minutes, wait) => `waited ${minutes} minute(s), all that --wait ${minutes} gave, `
  + `behind the ${ahead.verb ?? "landing"} of this tree, pid ${ahead.pid}, and it is still running, so this `
  + `landing ran no step. Wait on that one in one call, which answers how it ended: ${wait}\n`
  + `Then run this landing again, or give it more minutes with --wait.`;

const goneSaid = (was) => `the ${was.verb ?? "landing"} of this tree this landing waited behind, pid ${was.pid}, `
  + `is gone having recorded no end, so nothing says how it left the tree and this landing ran no step. `
  + `Read its output before landing again: ${was.out ?? "not recorded"}`;

/* Under the reservation, so no launcher can pass its check between this read and the record naming
   this landing. The landing ahead's two output files go, as a launch removes them, and never this
   landing's own. */
const tookOver = (ahead, { dir, record, files, started, waitedFrom }) => {
  const hold = reservationIn(dir);
  if (!reserved(hold)) return null;
  try {
    const was = read(record);
    if (stillLanding(was)) return null;
    for (const one of [was?.out, was?.err]) {
      if (typeof one === "string" && one.startsWith(dir) && one !== files.out && one !== files.err) rmSync(one, { force: true });
    }
    const ms = Date.now() - waitedFrom;
    const mine = { ...started, since: new Date().toISOString(), waited: { behind: ahead.pid, ms, ended: was?.ended ?? null } };
    recorded(record, mine);
    unlisted(dir);
    console.log(`  waited ${spent(ms)} behind pid ${ahead.pid}, whose ${ahead.verb ?? "landing"} `
      + `${was?.ended ? howEnded(was.ended) : "left no record"}; this ${mine.verb} now holds the tree`);
    return mine;
  } finally {
    rmSync(hold, { force: true });
  }
};

/** In the detached landing: wait for the landing ahead to record its end, then take the tree's record
 *  for this one and return it; stop, having run no step, past the minutes given or where the landing
 *  ahead is gone having recorded nothing. */
export const waitedBehind = (ahead, { dir, record, verb, argv, tree, files, script }) => {
  const { minutes } = ahead;
  const waitedFrom = Date.now();
  const until = waitedFrom + minutes * 60_000;
  const wait = waitCommand(script, tree);
  const started = { verb, argv, tree, pid: process.pid, start: startOf(process.pid), ...files, record };
  console.log(`  waiting behind the ${ahead.verb ?? "landing"} of this tree, pid ${ahead.pid}, running since `
    + `${ahead.since}: one landing per tree, and --wait ${minutes} lets this one wait up to ${minutes} minute(s) `
    + `for it to end rather than refusing. It holds no lock and no gate place while it waits, so this is a `
    + `wait and not a hang.`);
  let told = waitedFrom;
  let gone = null;
  for (;;) {
    const was = read(record);
    const now = Date.now();
    const over = !stillLanding(was);
    gone = over && was && !was.ended ? gone ?? now : null;
    if (gone !== null && now - gone >= GONE_MS) refused(dir, goneSaid(was));
    if (over && gone === null) {
      const mine = tookOver(ahead, { dir, record, files, started, waitedFrom });
      if (mine) return mine;
    }
    if (now >= until) refused(dir, stillSaid(ahead, minutes, wait));
    if (now - told >= TOLD_MS) {
      console.log(`  still waiting behind pid ${ahead.pid}, ${spent(now - waitedFrom)} of ${minutes} minute(s)`);
      told = now;
    }
    Atomics.wait(pause, 0, 0, Math.min(POLL_MS, until - now));
  }
};
