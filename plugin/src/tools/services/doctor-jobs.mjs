/* Silent where the project declares no job, that level's own rule: docs/cli/a-job.md.
   Why a match and not a cause: `matchingJobs`. Why rows and not lines: doctor-harness.mjs. */
import { declaredJobs } from "../../resolve/settings.mjs";
import { HIDDEN, OFF, VERB_NAMES, jobProblems, matchingJobs, verbStates } from "../../resolve/visibility.mjs";

const ON = "on";

const SAID = {
  [OFF]: "unlisted and refused wherever the call arrives; `forge doctor --show <verb>` offers one again",
  [HIDDEN]: "unlisted and still served when typed; `forge doctor --show <verb>` lists one again",
  [ON]: "listed and served, which is where a verb no entry names stands",
};

const matchRow = (matched, withheld) => {
  if (!matched.length) {
    return withheld.length
      ? "no declared job matches what this machine withholds"
      : "none — this machine withholds nothing";
  }
  const said = matched.length > 1 ? "are the declared jobs" : "is the declared job";
  return `${matched.join(", ")} ${said} this machine's withheld verbs match`
    + " — `forge doctor --job all` offers every verb again";
};

/* Every verb under its state, and only once this machine withholds one: where it withholds nothing
   the row below already says so, and a full list of verbs nothing has touched answers no question. */
const stateRows = (states) => {
  if (!Object.keys(states).length) return [];
  return [OFF, HIDDEN, ON]
    .map((state) => [state, VERB_NAMES.filter((verb) => (states[verb] ?? ON) === state)])
    .filter(([, held]) => held.length)
    .map(([state, held]) => ({ label: `verbs ${state}`, detail: `${held.join(", ")} — ${SAID[state]}` }));
};

export const withholdingLines = () => {
  const states = verbStates();
  const { jobs, from } = declaredJobs();
  const names = Object.keys(jobs);
  return [
    ...stateRows(states),
    ...(from && names.length ? [{ label: "jobs", detail: `${names.join(", ")}  ← ${from}` }] : []),
    ...(from ? [{ label: "job", detail: matchRow(matchingJobs(), Object.keys(states)) }] : []),
    ...jobProblems().map((problem) => ({ level: "miss", label: "jobs", detail: problem })),
  ];
};
