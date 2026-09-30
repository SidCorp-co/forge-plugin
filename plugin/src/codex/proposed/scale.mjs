/* The project's priority scale: what earns each level, in the project's own words, which is the whole
   of what the priority question is given to judge against. A scale written into code would be one
   project's idea of urgency applied to projects that judge it differently (G-12), so the levels are
   the tracker's and the text is the record's. docs/cli/proposed-fields.md. */
import { declaredFor } from "../../tracker/routes.mjs";
import { UNRANKED } from "../../tracker/declared/value-sets.mjs";

export const SCALE_KEY = "priorities";

/** The levels a scale may state: the tracker's declared priorities, highest first, less the one that
 *  means nobody judged — a proposal is a judgement, so it can never answer with that word. */
export const proposable = () => declaredFor("forge_issues", "priority").filter((one) => one !== UNRANKED);

/** The levels a record states, in the tracker's order and not the file's, as `[level, text]` pairs; a
 *  level outside the set or a blank text is left out here and refused where it is written. */
export const levelsOf = (given) => {
  if (!given || typeof given !== "object" || Array.isArray(given)) return [];
  return proposable()
    .filter((one) => typeof given[one] === "string" && given[one].trim())
    .map((one) => [one, given[one].trim()]);
};

/** What a write of the table is refused for, or null: the refusal names the key and what it takes. */
export const scaleProblem = (given) => {
  const levels = proposable();
  if (!given || typeof given !== "object" || Array.isArray(given)) {
    return { key: SCALE_KEY, takes: `a table of ${levels.join(", ")}, each with what earns it`, given };
  }
  for (const [level, text] of Object.entries(given)) {
    if (!levels.includes(level)) {
      return { key: `${SCALE_KEY}.${level}`, takes: `no level a proposal may answer with; they are ${levels.join(", ")}`, given: text };
    }
    if (typeof text !== "string" || !text.trim()) {
      return { key: `${SCALE_KEY}.${level}`, takes: "a non-empty sentence saying what earns that level", given: text };
    }
  }
  return null;
};
