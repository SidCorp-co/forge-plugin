/* A run that backgrounded its landing had nothing to type to wait on it: the pid wait it was offered
   says a process ended and never how, answers a pid already gone or never there exactly as it
   answers a landing that finished, and it was taken from outside a run as often as inside (ISS-1352).
   This wait attaches to the record a detached landing keeps and exits on what that record says,
   never on a process: a landing gone having recorded no end is its own answer and not a success. */
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

import { read, stop } from "../../checkout.mjs";
import { DEADLINE, GONE, NO_GATE } from "../../gates/verdict.mjs";
import { watching } from "../../watching.mjs";
import { heldMinutes } from "../../../plugin/src/host/call-ceiling.mjs";
import { gitDir, liveWaiter, recordIn, reservationIn, startOf, stillLanding, waitCommand } from "./record.mjs";

/* The gate's wait's three numbers, so a caller holding both reads one table: past every code a
   landing exits with, 76 a landing gone without deciding, 77 this wait's own deadline, 78 nothing to
   wait on. */
export { DEADLINE, GONE };
export const NO_LANDING = NO_GATE;

export const TERMINAL = "landing verdict:";
export const WAITED = "landing wait:";

// A landing killed with its caller changes no file and so wakes no watcher; this tick is what answers it.
const TICK_MS = 3000;

const spent = (ms) => (ms < 60_000 ? `${Math.round(ms / 1000)} second(s)` : `${Math.round(ms / 60_000)} minute(s)`);

const ago = (at) => {
  const when = Date.parse(at ?? "");
  return Number.isFinite(when) ? spent(Date.now() - when) : null;
};

const whose = (was, tree) => `the ${was.verb ?? "landing"} of ${was.tree ?? tree}, pid ${was.pid}`;

/* Said of a record written before this wait began, since that is the resume case — answered at once,
   and it must not read as a landing this call watched end. */
const when = (was, since) => {
  const end = Date.parse(was.ended?.at ?? "");
  if (!Number.isFinite(end)) return "";
  return `, ended ${ago(was.ended.at)} ago${end < since ? " and before this wait began" : ""}`;
};

const endedSaid = (was, tree, since) => {
  const { code, step } = was.ended;
  const how = code === 0 ? "succeeded" : `failed, exiting ${code}${step ? ` at ${step}` : ""}`;
  return `${TERMINAL} ${how} — ${whose(was, tree)}${when(was, since)}. Its output: ${was.out ?? "not recorded"}`;
};

const signalSaid = (was, tree, since) => `${TERMINAL} failed — ${whose(was, tree)} was ended by `
  + `${was.ended.signal} ${was.ended.step ? `during ${was.ended.step}` : "before its first step"}${when(was, since)}, `
  + `so it decided nothing. A lock it held stays, and the next landing names the command that clears it. `
  + `Its output: ${was.out ?? "not recorded"}`;

const goneSaid = (was, tree) => `${TERMINAL} failed — ${whose(was, tree)} is gone having recorded no end`
  + `${ago(was.since) ? `, ${ago(was.since)} after it started` : ""}, so nothing says how it ended. `
  + `A wait exits on what a landing recorded and never on a process, and one gone having recorded nothing `
  + `is not a success: read its output before landing again: ${was.out ?? "not recorded"}`;

const noLandingSaid = (tree, script) => `${WAITED} no landing — ${tree} holds no landing record, so nothing `
  + `has landed from it that this could wait on, and this waited for nothing.\nLand from that tree, then `
  + `wait on it:\n  node ${script} ship\n  ${waitCommand(script, tree)}`;

const watchingSaid = (tree, minutes) => `${WAITED} watching — the landing of ${tree}, for up to ${minutes} `
  + `minute(s). An answer is one more line of its own, so a result carrying this one alone is a call that `
  + `reached none.`;

const deadlineSaid = (was, tree, minutes, script) => `${WAITED} deadline — ${was
  ? `${whose(was, tree)} has been running ${ago(was.since) ?? "for an unrecorded time"}`
  : `the landing of ${tree} is still being started`} and has recorded no end, and this wait was given `
  + `${minutes} minute(s), which is what it hit. It is still running, so nothing here says how it ends.\n`
  + `Wait again, in a call that returns:\n  ${waitCommand(script, tree)}`;

/* A launcher between its check and the record naming its landing: the record read in that moment is
   the landing before it, so the wait holds on rather than answering for that one. */
const starting = (dir) => {
  const path = reservationIn(dir);
  const pid = Number.parseInt(existsSync(path) ? readFileSync(path, "utf8") : "", 10);
  return Number.isInteger(pid) && pid > 1 && startOf(pid) !== null;
};

/** What the tree's landing record answers now, or null while its landing still runs. A landing waiting
 *  behind the running one is the tree's next, and the one a caller that started it is waiting on, so
 *  the record's end is not the answer while that waiter lives. */
const answer = (dir, tree, { since, say, warn, script }) => {
  if (starting(dir) || liveWaiter(dir)) return null;
  const was = read(recordIn(dir));
  if (!was) {
    warn(noLandingSaid(tree, script));
    return NO_LANDING;
  }
  if (was.ended?.signal) {
    warn(signalSaid(was, tree, since));
    return GONE;
  }
  if (Number.isInteger(was.ended?.code)) {
    (was.ended.code === 0 ? say : warn)(endedSaid(was, tree, since));
    return was.ended.code;
  }
  if (stillLanding(was)) return null;
  // Read again, since a landing records its end and then exits.
  const last = read(recordIn(dir));
  if (Number.isInteger(last?.ended?.code) || last?.ended?.signal) return answer(dir, tree, { since, say, warn, script });
  warn(goneSaid(was, tree));
  return GONE;
};

/** One call and one of five answers: the landing's own code, GONE, DEADLINE or NO_LANDING. `tick`
 *  is the seam a case drives a landing killed without a word through. */
export const waitForLanding = async (tree, { minutes = heldMinutes(), script, say = console.log,
  warn = console.error, tick = TICK_MS } = {}) => {
  const dir = gitDir(tree);
  if (!dir) stop(`${tree} is no git checkout, so it keeps no landing record to wait on.`);
  const since = Date.now();
  const until = since + minutes * 60_000;
  const said = { since, say, warn, script };
  let armed = false;
  for (;;) {
    const got = answer(dir, tree, said);
    if (got !== null) return got;
    if (Date.now() >= until) {
      warn(deadlineSaid(starting(dir) ? null : read(recordIn(dir)), tree, minutes, script));
      return DEADLINE;
    }
    if (!armed) warn(watchingSaid(tree, minutes));
    armed = true;
    const ms = Math.min(tick, Math.max(until - Date.now(), 1));
    const wake = watching(recordIn(dir), ms);
    await Promise.race([wake.settled, new Promise((woke) => setTimeout(woke, ms))]);
    wake.cancel();
  }
};

/** The verb: the tree given or this one, the minutes given or as many as a call can hold. */
export const landingWait = async ({ flags, words }, { script }) => {
  const most = heldMinutes();
  const given = flags.get("--tree");
  const tree = given ? (isAbsolute(given) ? given : resolve(given)) : process.cwd();
  const [asked] = words;
  const minutes = asked === undefined ? most : Number(asked);
  if (!(minutes > 0)) stop(`wait takes the minutes to wait for a landing, not \`${asked}\`.\n  ${waitCommand(script, tree)}`);
  if (minutes > most) {
    stop(`wait ${asked} is past what a call can hold, so the host would end the call before the wait could `
      + `answer; ${most} minute(s) is the most it may be given:\n  ${waitCommand(script, tree)} ${most}`);
  }
  process.exitCode = await waitForLanding(tree, { minutes, script });
};
