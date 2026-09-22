/* The keys a project sets for itself, each with the value in force and where it was read; why rows
   and not lines is doctor/harness.mjs's. docs/cli/doctor.md. */
import { CHECK_MS_SPARED, CHECK_MS_TAKES, FEEDBACK_CHANNELS, fromProject, LANDING_ROUTES,
  OWED_DOORS, RUNS_TAKES, SHIP_MODES, checkCeilingMs, codexCheck, codexOwed, checkoutRoot,
  feedbackScope, landingScope, parallelRuns, projectWorkPattern, shipLeftOnMachine,
  shipMode } from "../../../resolve/settings.mjs";
import { MACHINE_RETIRED } from "../../doctor-keys.mjs";
import { DECLARES, declaredCommands, declaredIn, unarmedDoors } from "../../../stats/corpus/declared.mjs";
import { logBytes } from "../../../codex/codex-log.mjs";
import { checkStops } from "../../../codex/log/asked.mjs";
import { flowPinned, flowRefusal } from "../../../guides/flow.mjs";
import { readingFor, REVIEWED, reviewStanding, whereFrom } from "../../../git/reviewed.mjs";
import { firstLine } from "../../../resolve/flags.mjs";
import { accountCredentials, refusing } from "../../../resolve/settings.mjs";

const MISS = "miss";
const NOTE = "note";

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

/* What a value left at the other level means: `MACHINE_RETIRED` in doctor-keys.mjs. A note and not a
   miss — no verb removes such a leftover, so a report that went red over one would stay red until
   somebody edited that file by hand. */
const [SHIP_RETIRED] = MACHINE_RETIRED;

const shipRow = () => {
  const ship = shipMode();
  const left = shipLeftOnMachine();
  const detail = held(ship, SHIP_MODES);
  if (ship.unknown) return { level: MISS, label: "ship", detail };
  if (!left.value) return { label: "ship", detail };
  return { level: NOTE, label: "ship", detail: `${detail}; \`${SHIP_RETIRED.key}: `
    + `${JSON.stringify(left.value)}\` in ${left.from} is ignored — the key that decides this is now `
    + `${SHIP_RETIRED.now}. Remove that line by hand` };
};

const armedSaid = (label, commands) =>
  (commands.length ? `${label} at ${commands.map((one) => `\`${one}\``).join(" or ")}` : label);

const unarmedSaid = (one) => (one.wrote === null
  ? `\`${DECLARES}.${one.label}\` names none`
  : `\`${DECLARES}.${one.label}\` is ${one.wrote}, which is no command`);

/* Every door the list names, the empty list apart from the absent key, and the door no declared
   command arms: three answers, and a reader told only "nothing" can tell neither the off switch from
   a tree that never chose nor either from a door standing silent. The gate is silent at that third
   one — a hook guesses no command for a repository it has never seen — so this row is the only thing
   that can say the door is there (ISS-1905). */
const owedRow = () => {
  const owed = codexOwed();
  if (owed.unknown) {
    return { level: MISS, label: "codex.owed", detail: held({ ...owed, value: owed.value.join(", ") }, OWED_DOORS) };
  }
  if (!owed.value.length) {
    return { label: "codex.owed", detail: `nothing — the key is an empty list, so no door asks  ← ${owed.from}` };
  }
  const root = checkoutRoot();
  const declared = root ? declaredIn(root) : null;
  const unarmed = unarmedDoors(owed.value, declared);
  const commands = Object.fromEntries(owed.value.map((one) => [one, declaredCommands(one, declared)]));
  const armed = owed.value.filter((one) => !unarmed.some((door) => door.label === one))
    .map((one) => armedSaid(one, commands[one]));
  if (!unarmed.length) {
    const arming = owed.value.some((one) => commands[one].length)
      ? `, and each command door at what \`${DECLARES}\` names` : "";
    return { label: "codex.owed", detail: `${armed.join(", ")} — each held until a consult has read `
      + `what it would judge${arming}  ← ${owed.from}` };
  }
  return { level: MISS, label: "codex.owed", detail: `${unarmed.map((one) => one.label).join(", ")} `
    + `${unarmed.length > 1 ? "are doors" : "is a door"} this project asks at that no command arms — `
    + `${unarmed.map(unarmedSaid).join(", ")} — so nothing is held there, this plugin guessing no `
    + `command for a repository it has never seen. Arm it in ${fromProject()}: `
    + `"stats": { "commands": { "${unarmed[0].label}": "<the command this project runs>" } }, one `
    + `command or a list of them; or drop the door from \`codex.owed\``
    + `${armed.length ? `. ${armed.join(", ")} ${armed.length > 1 ? "are armed" : "is armed"}` : ""}`
    + `  ← ${owed.from}` };
};

const WEEK = 7 * 24 * 60 * 60 * 1000;

/* What the log can and cannot settle. A consult row names the checkout it ran in and no project, so
   two projects declaring one command are one record here: the recorded stops are reported as what
   they are, each with its own checkout, and the two readings that ARE a miss are the ones
   configuration settles on its own (ISS-1882, consult 30fdbc F1). Neither says the command will
   fail — a check that returns early returns under any clock. */
const stoppedSaid = (check) => {
  const stops = checkStops(logBytes(), { command: check.command, ms: check.ms, since: Date.now() - WEEK });
  if (!stops.length) return "";
  return `. This machine's consult log holds ${stops.length} consult(s) in the last 7 days whose `
    + `check of that command was stopped at or above ${check.ms / 1000}s, the newest on `
    + `${stops[0].at.slice(0, 10)} in ${stops[0].root ?? "a checkout it did not record"}`;
};

/* Silent where the project declared no check: the reviewer is then given no such tool at all, and a
   row about a clock nothing runs under is a line every project without the key would read (G-12). */
const checkRow = () => {
  const check = codexCheck();
  if (!check) return null;
  /* The most a check may be given, which is what a reading taken before any consult can answer for:
     the clock one round hands the spawn is that less whatever the consult has spent by then, and a
     row printing a figure without saying which of the two it is has a run reading its own
     configuration as the allowance a stopped check had (ISS-2108). */
  const clock = `${check.command} \u2014 at most ${check.ms / 1000}s  \u2190 ${check.msFrom}`;
  if (check.unknown !== undefined) {
    return { level: MISS, label: "codex.check", detail: `${check.unknown} is no value of \`codex.checkMs\` `
      + `\u2014 it takes ${CHECK_MS_TAKES}; reading ${clock}` };
  }
  /* The one reading configuration settles on its own: both numbers are on disk before a consult is
     spent, so a declaration no consult can honour is said here rather than met by a caller whose own
     call has already died. */
  if (check.over !== undefined) {
    return { level: MISS, label: "codex.check", detail: `${check.over} is past the `
      + `${checkCeilingMs()} \`codex.checkMs\` may name \u2014 ${CHECK_MS_SPARED()} \u2014 so `
      + `${check.command} runs at most ${check.ms / 1000}s instead. Lower it in ${fromProject()}, or `
      + `raise \`codex.budgetMs\` where the caller can wait longer than one call` };
  }
  const stopped = stoppedSaid(check);
  return { level: stopped ? "note" : undefined, label: "codex.check", detail: `${clock}${stopped}` };
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

/* Asked only where a reading is owed and the account resolves: below the volume there is nothing to
   hold, and a box with no credential is told that by the rows that read one (ISS-1887). */
const holding = async (mark) => {
  const { url, token } = accountCredentials();
  if (!url.value || !token.value) return "";
  try {
    const found = await refusing(() => readingFor(mark));
    if (found.key) return `, and ${found.key} holds it at ${found.status ?? "a status it did not carry"}`;
    return found.short
      ? `, and which issue holds it is unread: ${firstLine(found.short)}`
      : ", and no issue holds it — the next release files one";
  } catch (error) {
    return `, and which issue holds it is unread: ${firstLine(error.message)}`;
  }
};

/* The trigger a project declares for reading what has landed, silent where it declared neither key (ISS-1883). */
const reviewRow = async () => {
  const standing = reviewStanding(checkoutRoot());
  if (!standing) return null;
  if (standing.refusal) return { level: MISS, label: "review", detail: standing.refusal };
  const { lines, paths, mark, files, changed, owed, uncountable } = standing;
  const counted = paths.value.join(", ");
  if (uncountable) return { level: MISS, label: "review", detail: uncountable };
  if (!mark) {
    return { label: "review", detail: `${lines.value} changed line(s) under ${counted} earn a reading `
      + `of what has landed, and ${REVIEWED} is unplanted, so nothing is counted yet — plant it at the `
      + `commit the first reading starts from: ${PLANT} <that commit>  ← ${whereFrom(standing)}` };
  }
  return { label: "review", detail: `${changed} changed line(s) in ${files} file(s) under ${counted} `
    + `since ${mark.slice(0, 7)}, ${owed ? "at or past" : "short of"} the ${lines.value} that earn a `
    + `reading of what has landed${owed ? await holding(mark) : ""}  ← ${whereFrom(standing)}` };
};

/** Every keyed choice this project makes, in the order the report prints them. */
export const projectKeyLines = async () => [
  ...Object.entries(feedbackScope()).map(([which, one]) =>
    ({ level: one.unknown ? MISS : undefined, label: `feedback.${which}`, detail: held(one, FEEDBACK_CHANNELS) })),
  flowRow(),
  landingRow(),
  shipRow(),
  owedRow(),
  checkRow(),
  runsRow(),
  workRow(),
  await reviewRow(),
].filter(Boolean);
