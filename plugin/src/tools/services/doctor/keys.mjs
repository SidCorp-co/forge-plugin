/* The keys a project sets for itself, each with the value in force and where it was read; why rows
   and not lines is doctor/harness.mjs's. docs/cli/doctor.md. */
import { FEEDBACK_CHANNELS, FROM_PROJECT, LANDING_ROUTES, OWED_DOORS, RUNS_TAKES, SHIP_MODES,
  codexOwed, checkoutRoot, feedbackScope, landingScope, parallelRuns, projectWorkPattern,
  shipMode } from "../../../resolve/settings.mjs";
import { flowPinned, flowRefusal } from "../../../guides/flow.mjs";
import { REVIEWED, reviewStanding } from "../../../git/reviewed.mjs";

const MISS = "miss";

/** Which value is in force and where it was read; a value the key does not take is named here and
 *  nowhere else, since this is the surface allowed to say what a project turned off. */
export const held = (one, allowed) =>
  (one.unknown ? `${one.unknown} is no value of this key — it takes ${allowed.join(", ")}; reading ${one.value}  ← ${one.from}`
    : `${one.value}  ← ${one.from}`);

const flowRow = () => {
  const refused = flowRefusal();
  if (refused) return { level: MISS, label: "flow", detail: refused };
  const flow = flowPinned();
  if (flow.retired) {
    return { level: MISS, label: "flow", detail: `${flow.value}, read off the retired \`method: ${flow.retired}\``
      + `  ← ${flow.from}. Set \`flow\` instead` };
  }
  return { label: "flow", detail: `${flow.value}  ← ${flow.from}` };
};

const landingRow = () => {
  const landing = landingScope();
  if (landing.unknown) {
    return { level: MISS, label: "landing", detail: held({ ...landing, value: "the derived route" }, LANDING_ROUTES) };
  }
  return { label: "landing", detail: landing.value
    ? `${landing.value}  ← ${landing.from}`
    : "unset, so the branches on the tracker's record derive where the merge sits" };
};

/* Every door the list names, and the empty list apart from the absent key: the two are different
   answers and a reader told only "nothing" cannot tell the off switch from a tree that never chose. */
const owedRow = () => {
  const owed = codexOwed();
  if (owed.unknown) {
    return { level: MISS, label: "codex.owed", detail: held({ ...owed, value: owed.value.join(", ") }, OWED_DOORS) };
  }
  return { label: "codex.owed", detail: owed.value.length
    ? `${owed.value.join(", ")} — each held until a consult has read what it would judge  ← ${owed.from}`
    : `nothing — the key is an empty list, so no door asks  ← ${owed.from}` };
};

const runsRow = () => {
  const runs = parallelRuns();
  if (runs.unknown) return { level: MISS, label: "parallel runs", detail: held({ ...runs, value: "no bound" }, [RUNS_TAKES]) };
  return { label: "parallel runs", detail: runs.value
    ? `${runs.value} at once for the whole project, whoever dispatched them, so a second master sizes `
      + `itself by what is left rather than taking this number afresh  ← ${runs.from}`
    : "unset, so a wave is sized by whoever dispatches it and a gate declines for no sibling" };
};

/* Three answers: an absent key and a pattern that will not compile decide the same claim and mean
   opposite things, one project having chosen silence and the other written what nothing reads. */
const workRow = () => {
  /* The root a claim reads it off, a nested file otherwise advertising what no refusal applies. */
  const work = projectWorkPattern(checkoutRoot());
  if (work.unreadable) {
    return { level: MISS, label: "lease.workingRe", detail: `${work.unreadable} is no regular expression, `
      + `so no process reads as a run's work and a claim over a live sibling is taken  ← ${work.from}` };
  }
  return { label: "lease.workingRe", detail: work.value
    ? `${work.value} — a process standing in a tree and running this holds that tree, so a claim `
      + `reading the tree's own lease as its own is refused  ← ${work.from}`
    : "unset, so no process in a tree reads as a run working there and a lease is decided by the record alone" };
};

const PLANT = `git update-ref ${REVIEWED}`;

const whereFrom = ({ lines, paths }) => (lines.from === paths.from
  ? lines.from
  : `the volume ${lines.from}, the paths ${paths.from}`);

const cannotCount = ({ missing, checkout, paths }) => {
  const named = missing.join(", ");
  if (!checkout) {
    return `a review volume is declared and this directory stands in no checkout, so ${named} can `
      + `never be counted and no reading is ever owed`;
  }
  return `${named} ${missing.length > 1 ? "are counted paths" : "is a counted path"} this repository `
    + `does not hold, so nothing here can count towards the volume. Declare this repository's own `
    + `under \`review.paths\` in .forge.json${paths.from === FROM_PROJECT ? "" : `, the three above being this plugin's own layout`}`;
};

/* The trigger a project declares for reading what has landed: silent where it declared neither key,
   and a miss where it declared one nothing here can ever count (ISS-1883). */
const reviewRow = () => {
  const standing = reviewStanding(checkoutRoot());
  if (!standing) return null;
  const { lines, paths, missing, mark, files, changed, owed } = standing;
  const counted = paths.value.join(", ");
  if (missing.length) return { level: MISS, label: "review", detail: cannotCount(standing) };
  if (!mark) {
    return { label: "review", detail: `${lines.value} changed line(s) under ${counted} earn a reading `
      + `of what has landed, and ${REVIEWED} is unplanted, so nothing is counted yet — plant it at the `
      + `commit the first reading starts from: ${PLANT} <that commit>  ← ${whereFrom(standing)}` };
  }
  return { label: "review", detail: `${changed} changed line(s) in ${files} file(s) under ${counted} `
    + `since ${mark.slice(0, 7)}, ${owed ? "at or past" : "short of"} the ${lines.value} that earn a `
    + `reading of what has landed  ← ${whereFrom(standing)}` };
};

/** Every keyed choice this project makes, in the order the report prints them. */
export const projectKeyLines = () => {
  const ship = shipMode();
  return [
    ...Object.entries(feedbackScope()).map(([which, one]) =>
      ({ level: one.unknown ? MISS : undefined, label: `feedback.${which}`, detail: held(one, FEEDBACK_CHANNELS) })),
    flowRow(),
    landingRow(),
    { level: ship.unknown ? MISS : undefined, label: "ship", detail: held(ship, SHIP_MODES) },
    owedRow(),
    runsRow(),
    workRow(),
    reviewRow(),
  ].filter(Boolean);
};
