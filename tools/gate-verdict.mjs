/* What the gate decided, written where a second process can read it: 230 calls of one wave asked that by re-reading a log, in seven
   spellings of a line no gate writes, and two runs parked on a notice that says a process ended and never what it decided (ISS-1102).
   A wait exits on the line and never on the process, one that exited having written nothing being its own answer and not a pass. */
import { gitOut, lines, parsed } from "./checkout.mjs";
import { gatesOn, PROC, runnersOf, startedAt } from "./gates/machine.mjs";
import { recordDir } from "./gates/timing.mjs";
import { watching } from "./watching.mjs";
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

// The wait's own answers, past every code a gate run exits with — 0, a step's status, 75 declined — so one number says which of the five it got.
export const GONE = 76;
export const DEADLINE = 77;
export const NO_GATE = 78;

export const DEFAULT_MINUTES = 30;
export const TERMINAL = "gate verdict:";
export const WAITED = "gate wait:";
// A killed gate changes no file and so wakes no watcher: this tick re-reads the table, spending a syscall inside one call and no turn, which is what NFR-11 prices.
const TICK_MS = 3000;

export const verdictPath = (root) => join(recordDir(root), `verdict-${basename(root).replace(/[^\w.-]+/gu, "-")}`
  + `.${createHash("sha256").update(root).digest("hex").slice(0, 8)}`);

// One file per tree — the basename to read it by, the digest because two worktrees may share one — appended and never rewritten, since two gates of one tree would overwrite each other and B's verdict over A's is A's waiter told that A wrote none.
const wrote = (root, record) => {
  mkdirSync(recordDir(root), { recursive: true });
  appendFileSync(verdictPath(root), `${JSON.stringify(record)}\n`);
  return record;
};

/** Every run this tree recorded, oldest first, `null` where no gate has written one and no entry where a run has written nothing yet; a line that will not parse is dropped, one short write being no reason to refuse the rest. */
export const verdictRuns = (root) => {
  let text;
  try {
    text = readFileSync(verdictPath(root), "utf8");
  } catch {
    return null;
  }
  return lines(text).map(parsed).filter(Boolean);
};

export const runOf = (root, pid, start = null) => {
  const runs = verdictRuns(root) ?? [];
  const mine = pid === null
    ? runs
    : runs.filter((one) => one.pid === pid && (start === null || one.start === start));
  return mine.at(-1) ?? null;
};

/* The incarnation beside the pid, in the kernel's ticks since boot: the record outlives every process in it, and a pid the kernel
   reuses would hand a wait the verdict of the run before it. Null off a machine with no /proc, where a wait matches by pid alone;
   one that knows an incarnation demands the line say the same, a line that cannot prove it is this run's certifying nothing. */
const ownStart = () => {
  try {
    return startedAt(readFileSync(join(PROC, "self", "stat"), "utf8"));
  } catch {
    return null;
  }
};

/** Before the first step, so a wait armed while this gate runs finds this run and not the one before it; `head` is what it judged, or null where git would not say. */
export const gateStarted = (root, { full }) => wrote(root, {
  tree: root, pid: process.pid, start: ownStart(), full,
  head: gitOut(["rev-parse", "--short", "HEAD"], root), started: new Date().toISOString(), verdict: null,
});

/** Every exit past the tree it judges, the decline and the refusals included: no verdict where a run reached the tree is what leaves a waiter unable to tell a crash from a pass. */
export const gateDecided = (root, started, decided) =>
  wrote(root, { ...started, ...decided, at: new Date().toISOString() });

const spent = (ms) => (ms < 60_000 ? `${Math.round(ms / 1000)} second(s)` : `${Math.round(ms / 60_000)} minute(s)`);

const figures = (record) => {
  if (Number.isInteger(record.ran)) {
    return `${record.ran} of ${record.total} step(s)${Number.isInteger(record.seconds) ? ` in ${record.seconds}s` : ""}`;
  }
  return record.step ? `at the step ${record.step}` : "with no step spent";
};

/** The one line both a gate's exit and the wait print; `since` is the wait's own start, because a verdict written before it is the resume case, which answers at once and must not read as this run's. */
export const said = (record, { since = null } = {}) => {
  const written = Date.parse(record.at ?? record.started);
  const age = Number.isFinite(written) ? `, written ${spent(Date.now() - written)} ago` : "";
  const before = since !== null && Number.isFinite(written) && written < since ? " and before this wait began" : "";
  return `${TERMINAL} ${record.verdict} — ${figures(record)}, head ${record.head ?? "unknown"}, `
    + `pid ${record.pid}${age}${before} — the tree judged: ${record.tree}`;
};

const noGateSaid = (root) => `${WAITED} no gate — nothing has ever written a verdict for ${root}, so there is nothing `
  + `here to wait for and this waited for nothing.\nStart one, then wait on it:\n  npm run check\n`
  + `  node tools/gates.mjs --wait`;

const goneSaid = (root, pid, record) => `${TERMINAL} failed — the gate of this tree, pid ${pid}, is gone having `
  + `written no verdict${record
    ? `, ${spent(Date.now() - Date.parse(record.started))} after starting at head ${record.head ?? "unknown"}`
    : ` and having written no record of itself at all`}, so nothing judged ${root}.\nA wait exits on a verdict and never `
  + `on a process, and a process that exited having written nothing is not a pass. Run the gate again:\n  npm run check`;

const deadlineSaid = (root, pid, minutes, held) => `${WAITED} deadline — the gate of ${root} (pid ${pid}) has been `
  + `running ${spent(held)} and has written no verdict, and this wait was given ${minutes} minute(s), which is what it `
  + `hit. The gate is still running, so nothing here judges that tree either way.\nWait again, longer:\n`
  + `  node tools/gates.mjs --wait ${minutes * 2}`;

export const gatesHere = (root, ours = runnersOf(root)) =>
  (gatesOn(ours) ?? []).filter((one) => one.tree === root && one.pid !== process.pid);

/** One call, armed on the record's own directory, and one of five answers. The pid it latches onto comes off the process table before the record, since a gate that has execed and not yet written its start record is the second in which the only verdict on file is the run before it. The worktrees are read once and the table each round, a wait spawning git every three seconds being the cost this removes; `gates` is the seam a case drives an interleaving through, a verdict landing between one round's read and its liveness answer being a race no real table produces to order. */
export const waitForVerdict = async (root, { minutes = DEFAULT_MINUTES, say = console.log, warn = console.error,
  tick = TICK_MS, gates = gatesHere } = {}) => {
  const began = Date.now();
  const until = began + minutes * 60_000;
  const path = verdictPath(root);
  // The directory, because `fs.watch` cannot arm on one the gate has not made yet, and this wait would then have no notification at all.
  mkdirSync(recordDir(root), { recursive: true });
  const ours = runnersOf(root);
  const here = () => gates(root, ours);
  const held = here().at(0) ?? null;
  const latched = held?.pid ?? null;
  for (;;) {
    const mine = runOf(root, latched, held?.start ?? null);
    if (mine?.verdict) {
      say(said(mine, { since: began }));
      return mine.code;
    }
    if (!here().some((one) => one.pid === latched)) {
      // Read again, since a gate writes its verdict and then exits; and one watched running that wrote no line at all is gone rather than absent, `no gate` being for a tree nothing has ever run in.
      const last = runOf(root, latched, held?.start ?? null);
      if (last?.verdict) {
        say(said(last, { since: began }));
        return last.code;
      }
      if (!last && latched === null) {
        warn(noGateSaid(root));
        return NO_GATE;
      }
      warn(goneSaid(root, latched ?? last.pid, last));
      return GONE;
    }
    if (Date.now() >= until) {
      warn(deadlineSaid(root, latched, minutes, Date.now() - Date.parse(mine?.started ?? new Date().toISOString())));
      return DEADLINE;
    }
    const ms = Math.min(tick, Math.max(until - Date.now(), 1));
    const wake = watching(path, ms);
    // A timer this process references beside it: the ceiling inside `watching` is unreferenced, and a wait holding only that exits with nothing said rather than waiting.
    await Promise.race([wake.settled, new Promise((woke) => setTimeout(woke, ms))]);
    wake.cancel();
  }
};
