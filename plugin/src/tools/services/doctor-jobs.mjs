/* Silent where the project declares no job, that level's own rule: docs/cli/a-job.md.
   Why a match and not a cause: `matchingJobs`. Why rows and not lines: doctor-harness.mjs. */
import { declaredJobs } from "../../resolve/settings.mjs";
import { HIDDEN, OFF, VERB_NAMES, blockedBy, channelRefusal, jobProblems, matchingJobs,
  offeredSkills, shippedSkills, skillWithheld, stateOf, verbStates,
  withheldSkills } from "../../resolve/visibility.mjs";
import { UNCONFIGURED, unconfiguredTool } from "./tool-config.mjs";
import { skillGuideSlugs } from "../../guides/skill-guides.mjs";

const ON = "on";
const CLOSED = "closed";
const GATED = "gated";

/* Ordered, first match winning, and `on` last: that is what makes the row `on` exactly the verbs
   `forge -h` offers, since the four above it are the four questions that filter offer's own list.
   A row saying `on` about a verb the help had dropped is the report contradicting the help. */
const STATES = [
  { state: OFF, holds: (verb) => stateOf(verb) === OFF,
    said: "unlisted and refused wherever the call arrives; `forge doctor --show <verb>` offers one again" },
  { state: HIDDEN, holds: (verb) => stateOf(verb) === HIDDEN,
    said: "unlisted and still served when typed; `forge doctor --show <verb>` lists one again" },
  { state: UNCONFIGURED, holds: unconfiguredTool,
    said: "unlisted because this machine saved nothing it needs, and still served when typed; each one's own row below names what configures it" },
  { state: CLOSED, holds: (verb) => channelRefusal(verb) !== null,
    said: "unlisted because this project turned the channel off; the `feedback.plugin` row names it" },
  { state: GATED, holds: (verb) => blockedBy(verb) !== null,
    said: "unlisted because this credential may not call what it needs, which `forge doctor` measured" },
  { state: ON, holds: () => true,
    said: "listed and served, which is where a verb none of the rows above names stands" },
];

const matchRow = (matched, withheld) => {
  if (!matched.length) {
    return withheld
      ? "no declared job matches what this machine withholds"
      : "none — this machine withholds nothing";
  }
  const said = matched.length > 1 ? "are the declared jobs" : "is the declared job";
  return `${matched.join(", ")} ${said} this machine's withholding matches`
    + " — `forge doctor --job all` offers every verb and skill again";
};

const stateIn = (verb) => STATES.find(({ holds }) => holds(verb)).state;

/* Every verb under its state, and only once something is unlisted — whatever put it there, so a channel the
   project closed prints as readily as a verb a person hid; where nothing is, a full list answers no question. */
const stateRows = () => {
  const under = new Map(VERB_NAMES.map((verb) => [verb, stateIn(verb)]));
  if ([...under.values()].every((state) => state === ON)) return [];
  return STATES
    .map(({ state, said }) => [state, said, VERB_NAMES.filter((verb) => under.get(verb) === state)])
    .filter(([, , held]) => held.length)
    .map(([state, said, held]) => ({ label: `verbs ${state}`, detail: `${held.join(", ")} — ${said}` }));
};

/* What a job's withholding of a skill does and does not reach: docs/cli/a-job.md. */
const heldSaid = (held) => {
  const served = skillGuideSlugs();
  const unserved = held.filter((slug) => !served.includes(slug));
  const many = unserved.length > 1;
  return `${held.join(", ")} — unlisted by \`forge guide\` and refused when one is asked for by name;`
    + (unserved.length
      ? ` ${unserved.join(", ")} ${many ? "are" : "is"} withheld from nothing else,`
        + ` this copy serving no guide for ${many ? "them" : "it"};`
      : "")
    + " `forge doctor --job all` offers them again";
};

/* Silent where nothing is withheld, as the verb rows are. */
const skillRows = () => {
  const shipped = shippedSkills();
  const held = shipped.filter(skillWithheld);
  if (!held.length) return [];
  const on = offeredSkills(shipped);
  return [
    { label: `skills ${OFF}`, detail: heldSaid(held) },
    ...(on.length
      ? [{ label: `skills ${ON}`, detail: `${on.join(", ")} — offered, which is where a skill no job withholds stands` }]
      : []),
  ];
};

export const withholdingLines = () => {
  const states = verbStates();
  const { jobs, from } = declaredJobs();
  const names = Object.keys(jobs);
  const withheld = Object.keys(states).length > 0 || withheldSkills().size > 0;
  return [
    ...stateRows(),
    ...skillRows(),
    ...(from && names.length ? [{ label: "jobs", detail: `${names.join(", ")}  ← ${from}` }] : []),
    ...(from ? [{ label: "job", detail: matchRow(matchingJobs(), withheld) }] : []),
    ...jobProblems().map((problem) => ({ level: "miss", label: "jobs", detail: problem })),
  ];
};
