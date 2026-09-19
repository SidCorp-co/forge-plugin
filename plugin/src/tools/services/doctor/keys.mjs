/* The keys a project sets for itself, each with the value in force and where it was read; why rows
   and not lines is doctor/harness.mjs's. docs/cli/doctor.md. */
import { FEEDBACK_CHANNELS, LANDING_ROUTES, OWED_DOORS, RUNS_TAKES, SHIP_MODES, codexOwed,
  feedbackScope, landingScope, parallelRuns, projectWorkPattern, shipMode } from "../../../resolve/settings.mjs";
import { flowPinned, flowRefusal } from "../../../guides/flow.mjs";

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

/* Three answers and not two, because an absent key and a declared pattern that will not compile
   decide the same claims and mean opposite things: one project chose silence, the other wrote a
   declaration nothing can read. */
const workRow = () => {
  const work = projectWorkPattern();
  if (work.unreadable) {
    return { level: MISS, label: "lease.workingRe", detail: `${work.unreadable} is no regular expression, `
      + `so no process reads as a run's work and a claim over a live sibling is taken  ← ${work.from}` };
  }
  return { label: "lease.workingRe", detail: work.value
    ? `${work.value} — a process standing in a tree and running this holds that tree, so a claim `
      + `reading the tree's own lease as its own is refused  ← ${work.from}`
    : "unset, so no process in a tree reads as a run working there and a lease is decided by the record alone" };
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
  ];
};
