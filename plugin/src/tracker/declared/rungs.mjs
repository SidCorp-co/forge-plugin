/* The tracker holds ten statuses and keeps how far a run got inside `in_progress` as its work step
   (`workState.step`); every other name is refused ISSUE_STATUS_LEGACY. This CLI's flow climbs rungs,
   four of which are that one status at a step: each is written as the status and then the step, and
   a row read back is named by its rung again, so the ladder in `flow/earned.mjs` reads what it wrote. */
const HELD_IN = "in_progress";

const STEP_OF_RUNG = { confirmed: "plan", in_progress: "build", developed: "test", testing: "release" };

const RUNG_OF_STEP = {
  triage: "confirmed", clarify: "confirmed", plan: "confirmed", design: "confirmed",
  build: "in_progress", test: "developed", release: "testing",
};

/** The status the tracker holds a rung at: the rung itself unless it is a step. */
export const trackerStatusOf = (rung) => (Object.hasOwn(STEP_OF_RUNG, rung) ? HELD_IN : rung);

/** The work step a rung is written with, null for a rung that is a status of its own. */
export const stepOfRung = (rung) => STEP_OF_RUNG[rung] ?? null;

/** The rung a row stands at. `in_progress` with no step reads as the build, which is the one rung a
 *  move to `in_progress` meant before the step was written. */
export const rungOf = (status, step) => (status === HELD_IN ? RUNG_OF_STEP[step] ?? HELD_IN : status ?? null);
