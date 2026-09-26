/* The module term `forge next` adds to a score: the project's `rank.module` row for an issue's primary
   module, read once per ranking and only where there is something to weigh. docs/cli/modules.md. */
import { fail, rankConvention } from "../resolve/settings.mjs";
import { MODULE_TABLE, TAKEABLE, UNSET } from "./weights.mjs";
import { moduleDefinition, undefinedKeys, undefinedRefusal, weightOf } from "../tracker/modules/definition.mjs";
import { primaryModules } from "../tracker/modules/attribution.mjs";

const flat = (said) => () => ({ said, points: 0 });

/* How the term names what it read: the module, and the row that answered where it is not the
   module's own — an ancestor's, or `unset` because no row on the line held one. */
const saidOf = (module, weight) => {
  if (!module) return `none (${UNSET})`;
  if (weight.via) return `${module.name} (${weight.via}'s row)`;
  return weight.row === UNSET ? `${module.name} (${UNSET})` : module.name;
};

/** `termOf(row)` for every row the ranking scores, the refusal where the table weighs a name the
 *  project does not define — none defined included — and `whole` false where the attribution read
 *  stopped short. No table, or no module defined, is a zero term and no attribution read: every
 *  issue scores as it did. */
const moduleTerms = async (weights) => {
  const asked = rankConvention().value?.[MODULE_TABLE];
  if (asked === undefined) return { termOf: flat(`no rank.${MODULE_TABLE} table`), whole: true, refusal: null };
  const { modules } = await moduleDefinition();
  const unknown = undefinedKeys(asked, modules, UNSET);
  if (unknown.length) return { termOf: null, whole: true, refusal: undefinedRefusal(unknown, modules) };
  if (!modules.length) return { termOf: flat("no module defined"), whole: true, refusal: null };
  const { found, whole } = await primaryModules(TAKEABLE);
  const byId = new Map(modules.map((one) => [one.id, one]));
  const termOf = (row) => {
    const module = byId.get(found.get(row?.issueId)) ?? null;
    const weight = weightOf(module, modules, weights[MODULE_TABLE], UNSET);
    return { said: saidOf(module, weight), points: weight.points };
  };
  return { termOf, whole, refusal: null };
};

/** The terms as `forge next` spends them: a refusal stops the ranking, and a walk cut short is said
 *  on stderr, since an issue it did not reach scores `unset` rather than its module's row. */
export const moduleTermsFor = async (weights) => {
  const terms = await moduleTerms(weights);
  if (terms.refusal) fail(`next: ${terms.refusal}`);
  if (!terms.whole) {
    console.error("warning: the read of each open issue's primary module stopped short, so an issue it"
      + " did not reach scores the `unset` row of rank.module rather than its module's.");
  }
  return terms;
};
