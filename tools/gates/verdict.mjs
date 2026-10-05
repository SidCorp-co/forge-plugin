/* What the gate decided, written where a second process can read it: 230 calls of one wave asked that by re-reading a log, in seven
   spellings of a line no gate writes, and two runs parked on a notice that says a process ended and never what it decided (ISS-1102).
   A landing reads its gate's verdict off this record and never off the process, one that exited having written nothing being no pass. */
import { gitOut, lines, parsed } from "../checkout.mjs";
import { verdictSaid } from "./report/said.mjs";
import { recordDir, treeKey } from "./timing.mjs";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const TERMINAL = "gate verdict:";

export const verdictPath = (root) => join(recordDir(root), `verdict-${treeKey(root)}`);

// Appended and never rewritten, since two gates of one tree would overwrite each other and B's verdict over A's is A's reader told that A wrote none.
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

/** The newest run this tree recorded, or null where none has written one. */
export const runOf = (root) => (verdictRuns(root) ?? []).at(-1) ?? null;

/** Before the first step, so a reader of this record finds this run and not the one before it; `head` is what it judged, or null where git would not say. */
export const gateStarted = (root, { full }) => wrote(root, {
  tree: root, pid: process.pid, full,
  head: gitOut(["rev-parse", "--short", "HEAD"], root), started: new Date().toISOString(), verdict: null,
});

/** Every exit past the tree it judges, the refusals included: no verdict where a run reached the tree is what leaves a reader unable to tell a crash from a pass. */
export const gateDecided = (root, started, decided) =>
  wrote(root, { ...started, ...decided, at: new Date().toISOString() });

const spent = (ms) => (ms < 60_000 ? `${Math.round(ms / 1000)} second(s)` : `${Math.round(ms / 60_000)} minute(s)`);

const steps = (record) => {
  if (Number.isInteger(record.ran)) {
    return `${record.ran} of ${record.total} step(s)${Number.isInteger(record.seconds) ? ` in ${record.seconds}s` : ""}`;
  }
  return record.step ? `at the step ${record.step}` : "with no step spent";
};

// The file unit after the step count and never in place of it, so a run that spent no step still reads as one.
const figures = (record) => [steps(record), ...verdictSaid(record)].join(", ");

/** The one line a gate's every exit past the tree prints. */
export const said = (record) => {
  const written = Date.parse(record.at ?? record.started);
  const age = Number.isFinite(written) ? `, written ${spent(Date.now() - written)} ago` : "";
  return `${TERMINAL} ${record.verdict} — ${figures(record)}, head ${record.head ?? "unknown"}, `
    + `pid ${record.pid}${age} — the tree judged: ${record.tree}`;
};
