/* Core's issue machine as this CLI reads it (`@forge/contracts/issue-machine`, revision 24): ten
   statuses, and how far a run got inside `in_progress` kept as its work step (`workState.step`).
   Every other name is refused ISSUE_STATUS_LEGACY. The flow's ladder climbs places, and four of them
   are `in_progress` at a step, spelt `in_progress:<step>`: each is written as the status and then the
   step, and a row read back is named by its place again. The copy a test pins this against is
   `test/fixtures/dev-core/issue-machine.json`. */

export const ISSUE_STATUSES = [
  "draft", "open", "reopen", "in_progress", "approved", "needs_info", "on_hold", "awaiting_release", "closed", "dropped",
];

export const WORK_STEPS = ["triage", "clarify", "plan", "design", "build", "test", "release"];

const HELD_IN = "in_progress";
const SEP = ":";

/* The step a place inside `in_progress` is named by: the four steps before the plan is approved all
   stand at the plan, and an `in_progress` row carrying no step is the build, the one place a move to
   `in_progress` meant before the step was written. */
const PLACE_OF_STEP = Object.fromEntries(WORK_STEPS.map((step, at) =>
  [step, at < WORK_STEPS.indexOf("build") ? "plan" : step]));

/** The places inside `in_progress`, by the step each is written with. */
export const HELD = Object.freeze({
  plan: `${HELD_IN}${SEP}plan`,
  build: `${HELD_IN}${SEP}build`,
  test: `${HELD_IN}${SEP}test`,
  release: `${HELD_IN}${SEP}release`,
});

/** The names core refuses ISSUE_STATUS_LEGACY, each beside the place that took it over. */
export const LEGACY_STATUSES = Object.freeze({
  confirmed: HELD.plan,
  clarified: HELD.plan,
  waiting: "needs_info",
  developed: HELD.test,
  testing: HELD.release,
  tested: "awaiting_release",
  releasing: "awaiting_release",
});

/** The rungs this CLI's own flow named before its ladder was core's, each the same place under
 *  another name, read only off a record written then (a park's `left`, a claim history row). Priced: it ends once no open
 *  issue carries a park record written before 3.36.647. */
const FORMER_RUNGS = Object.freeze({ confirmed: HELD.plan, developed: HELD.test, testing: HELD.release });

/** The place a row stands at: its status, or `in_progress:<step>` inside `in_progress`. */
export const placeOf = (status, step = null) => {
  if (status === undefined || status === null) return null;
  return status === HELD_IN ? `${HELD_IN}${SEP}${PLACE_OF_STEP[step] ?? "build"}` : status;
};

/** A status this CLI wrote onto its own record, read as the place it names: a former rung name, a
 *  bare `in_progress`, or a place already. */
export const placeRead = (name) => FORMER_RUNGS[name] ?? placeOf(name);

/** The status core holds a place at. */
export const statusOfPlace = (place) => (typeof place === "string" ? place.split(SEP)[0] : place ?? null);

/** The work step a place is written with, null for a place that is a status of its own. */
export const stepOfPlace = (place) => (typeof place === "string" && place.includes(SEP) ? place.split(SEP)[1] : null);
