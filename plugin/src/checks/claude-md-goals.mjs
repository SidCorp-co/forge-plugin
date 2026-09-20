/* The one claim in a CLAUDE.md that the repository around it cannot settle: a goal is a clause of
   this project's requirements tree or it is nothing, so answering it means walking and parsing
   docs/requirements. Kept out of the claims the checkout itself answers because the two are read by
   different callers at different costs. docs/cli/doctor.md. */
import { clauseOf } from "../spec/index.mjs";
import { identifiersIn } from "../spec/parse.mjs";
import { specTreeAt } from "../spec/tree.mjs";

/* A goal is a claim about the requirements tree and not about repository text, and the tree's own
   parser spells it: the identifier sweep beside this one reads every file, so a goal held as a
   fixture's constant would answer for one nothing defines, and a second grammar reading `G-11-1` as
   `G-11` answers for a clause nobody wrote. Silent where the project keeps no tree, the rule being
   the project's. */
const GOAL_PREFIX = "G";

/** Every goal the file names, spelled as the tree spells it, sub-number and all. */
export const goalsIn = (text) =>
  [...new Set(identifiersIn(text).filter((one) => one.prefix === GOAL_PREFIX).map((one) => one.id))].sort();

/** The goals it names that this project's tree holds no clause for, keyed as `checkClaims` keys its
 *  own, so the report reads one row off two readings. A project with no tree is told nothing. */
export const checkGoals = (text, root) => {
  const goals = goalsIn(text);
  const tree = goals.length ? specTreeAt(root) : null;
  return { uncitedGoals: tree ? goals.filter((id) => !clauseOf(tree, id)) : [] };
};
