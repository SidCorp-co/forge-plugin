/* Whether anybody can show a criterion once the change has landed. The project's gate passing is the
   landing's own proof, so a criterion making it the outcome is refused; a measurement over repeated
   runs or under load is the builder's to show, so it is written and named. Why the gate is the
   declared command and nothing else, and why the second reading refuses nothing: UC-04-10. */
import { refuse } from "../../refusal.mjs";
import { gatePassCriteria, measuredCriteria } from "../../prose.mjs";
import { translateTo } from "../../resolve/settings.mjs";
import { declaredGates } from "../earned/published.mjs";

const DECLARED_AT = "`stats.commands.gate`";

const named = (commands) => commands.map((one) => `\`${one}\``).join(" or ");

const gateRefusal = (found) => [
  `${found.length === 1 ? "One criterion makes" : `${found.length} criteria make`} the project's gate passing`
    + " an outcome, so nothing was written:",
  ...found.map((one) => `  ${one.number}. ${one.text}`),
  `${named([...new Set(found.map((one) => one.gate))])} is this project's gate under ${DECLARED_AT}, and the landing`
    + " runs it before the merge: that run is the proof, and no verdict after it repeats it.",
  "Drop each line, keeping anything else it asks of the change as a criterion of its own. A line on"
    + " what the gate prints, spends or refuses is written.",
].join("\n");

const measuredNote = (found) => [
  `record criteria: ${found.length === 1 ? "criterion" : "criteria"} ${found.map((one) => one.number).join(", ")}`
    + ` ${found.length === 1 ? "is" : "are"} measured over repeated runs or under load, which no judge observes on what is deployed, so`
    + ` ${found.length === 1 ? "it is" : "each is"} the builder's evidence. The plan's step citing it says the builder`
    + " shows it, and a judge writes it skipped; the line is not refused for it:",
  ...found.map((one) => `  ${one.number}. ${one.text}`),
].join("\n");

/** Refuses a set holding a criterion whose outcome is a declared gate passing, and says on stderr
 *  which of the rest are measurements only their builder can show. Silent where the project declared
 *  no gate, and where its prose language is one the reading does not carry. */
export const shownChecked = (criteria, gates = declaredGates(), language = translateTo()) => {
  const passing = gatePassCriteria(criteria, gates, language);
  if (passing.length) refuse(gateRefusal(passing));
  const measured = measuredCriteria(criteria, language);
  if (measured.length) console.error(measuredNote(measured));
};

/** The criteria help's account of both readings, naming the gate this project declared. */
export const shownBlocks = (gates = declaredGates()) => [
  ...(gates.length
    ? [`This project's gate is ${named(gates)}, under ${DECLARED_AT}.`,
      "A criterion whose outcome is the gate passing is refused, since the landing proves the gate",
      "before the merge; one naming the gate for what it prints, spends or refuses is written."]
    : [`This project declares no gate under ${DECLARED_AT}, so no criterion is refused for naming one.`]),
  "A criterion measured over repeated runs or under load is written and named on stderr as the",
  "builder's evidence, which no judge observes on a deployment: the plan's step citing it says who",
  "shows it.",
];
