/* What a landing writes about each attempt it makes and each gate it runs, and the reader that counts
   them: attempts, the ones that landed on their first gate, hand-backs by cause and the gate minutes
   spent and lost. Written by the landing into the store red sets live in, because the lease history
   carries no cause and a landing run in the background leaves no transcript. What each figure counts
   and what it cannot see: docs/cli/stats-the-landing.md. */
import { ATTEMPTS, WRITTEN, marksOf, scopeOf, writeMark } from "./marks.mjs";

const OPENED = "opened";
const ENDED = "ended";
const GATE = "gate";

export const LANDED = "landed";
export const BACK = "back";

/* The closed set a hand-back names, each for the stop that sets it; anything else is unrecorded. */
export const BRANCH = "branch";
export const COMBINATION = "combination";
export const MOVED_BASE = "moved-base";
export const DECLINED = "declined";
export const TRACKER = "tracker";
export const JUDGE = "judge";
export const CAUSES = [BRANCH, COMBINATION, MOVED_BASE, DECLINED, TRACKER, JUDGE];
export const UNRECORDED = "unrecorded";

/* A gate's verdict: only the first two judged a tree, so only they spend gate minutes. */
export const GREEN = "green";
export const RED = "red";
export const GATE_ERROR = "error";
const JUDGED = new Set([GREEN, RED]);

/* Said and carried past, as a red set's record is: the landing goes on whatever the store answers. */
const written = (record, what) => {
  let outcome;
  try {
    outcome = writeMark(record);
  } catch (error) {
    console.error(`stats: could not write the landing attempt record (${error.message}).`);
  }
  if (outcome === WRITTEN) return;
  console.error(`landing attempts: ${what} is not on record, so \`forge stats runs\` reads it as unrecorded; `
    + "the landing goes on as it would have.");
};

/* A checkout whose project file cannot be read is held under no scope: the daily page reads every scope. */
const scopeTried = (root) => {
  try {
    return scopeOf(root);
  } catch {
    return null;
  }
};

const momentOf = (record) => Date.parse(record.at) || 0;

/* An issue, an attempt or a candidate within its project: two projects' keys and hashes can coincide. */
const within = (record, id) => `${record.scope ?? ""}\u0000${id}`;

const landedEndings = (records) => records.filter((one) => one.phase === ENDED && one.outcome === LANDED);

/** The opening of one issue's attempt, written before its first step, and the handle its ending is
 *  written against. `null`, writing nothing, where a landed ending already carries `candidate`: a
 *  resume past a push that landed lands nothing a second time. */
export const attemptOpened = ({ root, issue, verb, candidate = null }) => {
  const scope = scopeTried(root);
  if (candidate && landedEndings(marksOf(ATTEMPTS, scope)).some((one) => one.issue === issue && one.candidate === candidate)) {
    return null;
  }
  const at = new Date().toISOString();
  const handle = { kind: ATTEMPTS, scope, attempt: `${issue}@${at}`, issue, verb };
  written({ ...handle, phase: OPENED, at }, `the opening of ${issue}'s attempt`);
  return handle;
};

/** The ending: `landed` with the candidate its gate read, or `back` with the one cause that stopped it. */
export const attemptEnded = (handle, { outcome, cause = null, candidate = null }) => {
  if (!handle) return;
  written({ ...handle, phase: ENDED, at: new Date().toISOString(), outcome, cause, candidate },
    `how ${handle.issue}'s attempt ended`);
};

/** One gate the landing ran: its candidate, the issues it judged, its verdict and the seconds its steps
 *  ran, which a gate that declined or could not run has none of. */
export const gateRecorded = ({ root, candidate, members, verdict, seconds = null }) => {
  const at = new Date().toISOString();
  written({ kind: ATTEMPTS, scope: scopeTried(root), phase: GATE, gate: `${candidate}@${at}`, at, candidate,
    members, verdict, seconds: Number.isFinite(seconds) ? seconds : null }, `the gate over ${String(candidate).slice(0, 7)}`);
};

const tenth = (value) => Math.round(value * 10) / 10;

/* How many judged gates named the issue after its previous landing and at or before this one. */
const judgedBefore = (ending, gates, landings) => {
  const at = momentOf(ending);
  const issue = within(ending, ending.issue);
  const before = landings.filter((one) => within(one, one.issue) === issue && momentOf(one) < at).map(momentOf);
  const after = before.length ? Math.max(...before) : -Infinity;
  return gates.filter((one) => Array.isArray(one.members) && one.members.some((key) => within(one, key) === issue)
    && momentOf(one) > after && momentOf(one) <= at).length;
};

const causedBy = (ending) => {
  if (!ending || ending.outcome !== BACK) return UNRECORDED;
  return CAUSES.includes(ending.cause) ? ending.cause : UNRECORDED;
};

const gateFigures = (gates, landings) => {
  const carried = new Set(landings.filter((one) => one.candidate).map((one) => within(one, one.candidate)));
  const judged = gates.filter((one) => JUDGED.has(one.verdict));
  const priced = judged.filter((one) => Number.isFinite(one.seconds));
  const minutesOf = (held) => tenth(held.reduce((sum, one) => sum + one.seconds, 0) / 60);
  return {
    judged: judged.length,
    unpriced: judged.length - priced.length,
    declined: gates.filter((one) => one.verdict === DECLINED).length,
    error: gates.filter((one) => one.verdict === GATE_ERROR).length,
    minutes: minutesOf(priced),
    lostMinutes: minutesOf(priced.filter((one) => !carried.has(within(one, one.candidate)))),
  };
};

/** The attempts opened in `[from, to)` — either bound null for none — under one project's scope, or
 *  every scope where `scope` is null, each read with its ending wherever it falls; the gates whose
 *  record falls in the window; and the first-gate and lost-minute lookups over the whole store. */
export const attemptsOver = (scope, from = null, to = null, records = marksOf(ATTEMPTS, scope)) => {
  const inWindow = (one) => {
    const at = momentOf(one);
    return (from === null || at >= from) && (to === null || at < to);
  };
  const endings = new Map(records.filter((one) => one.phase === ENDED).map((one) => [within(one, one.attempt), one]));
  const landings = landedEndings(records);
  const allGates = records.filter((one) => one.phase === GATE);
  const judgedGates = allGates.filter((one) => JUDGED.has(one.verdict));
  const opened = records.filter((one) => one.phase === OPENED && inWindow(one));
  const causes = Object.fromEntries([...CAUSES, UNRECORDED].map((one) => [one, 0]));
  const first = { landed: 0, first: 0, ungated: 0, share: null };
  for (const one of opened) {
    const ending = endings.get(within(one, one.attempt));
    if (ending?.outcome !== LANDED) {
      causes[causedBy(ending)] += 1;
      continue;
    }
    first.landed += 1;
    const gates = judgedBefore(ending, judgedGates, landings);
    if (gates === 0) first.ungated += 1;
    if (gates === 1) first.first += 1;
  }
  const gated = first.landed - first.ungated;
  first.share = gated ? tenth((first.first / gated) * 100) : null;
  return { attempts: opened.length, landed: first.landed, back: opened.length - first.landed, causes, firstGate: first,
    gates: gateFigures(allGates.filter(inWindow), landings) };
};

const causesSaid = (causes) => Object.entries(causes).filter(([, many]) => many).map(([cause, many]) => `${cause} ${many}`)
  .join(", ") || "none";

const firstSaid = ({ landed, first, ungated, share }) => (landed - ungated
  ? `${first} of the ${landed - ungated} on a judged gate on their first (${share}%)`
  : "none on a judged gate")
  + (ungated ? `, ${ungated} with no judged gate on record` : "");

const gatesSaid = (gates) => `${gates.judged} judged gate(s) spent ${gates.minutes} min, ${gates.lostMinutes} min of it lost`
  + `${gates.unpriced ? `, ${gates.unpriced} with no seconds on record` : ""}`
  + `${gates.declined ? `, ${gates.declined} declined` : ""}${gates.error ? `, ${gates.error} could not run` : ""}`;

/** The sentence both readers print. */
export const attemptsSaid = (held) => (held.attempts || held.gates.judged || held.gates.declined || held.gates.error
  ? `${held.attempts} attempt(s): ${held.landed} landed, ${firstSaid(held.firstGate)} · ${held.back} not landed: `
    + `${causesSaid(held.causes)} · ${gatesSaid(held.gates)}`
  : "none recorded, so no landing attempt is read");

export const attemptsLine = (held) => `attempts        ${attemptsSaid(held)}`;
