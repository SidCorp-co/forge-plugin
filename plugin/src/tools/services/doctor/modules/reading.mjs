/* What `forge doctor modules` prints after any write it makes, and the row a bare reading prints —
   both off the tracker's definition and one walk of the open issues. docs/cli/modules.md. */
import { fail, fromProject, projectScope, rankConvention } from "../../../../resolve/settings.mjs";
import { MODULE_TABLE, UNSET, weightsFrom } from "../../../../rank/weights.mjs";
import { moduleDefinition, undefinedKeys, undefinedRefusal, weightOf } from "../../../../tracker/modules/definition.mjs";
import { openCounts, shareOf } from "../../../../tracker/modules/attribution.mjs";

export const VERB = "doctor modules";
export const NONE = "none";

export const defined = async () => {
  const read = await moduleDefinition();
  if (read.refused) fail(`${VERB}: the tracker would not list this project's labels: ${read.refused}`);
  return read.modules;
};

/* Depth first, by name within a level: the order a parent reads above what it holds. */
const treeOf = (modules) => {
  const ids = new Set(modules.map((one) => one.id));
  const under = (parent) => modules
    .filter((one) => (one.parentId && ids.has(one.parentId) ? one.parentId : null) === parent)
    .sort((one, other) => one.name.localeCompare(other.name));
  const out = [];
  const seen = new Set();
  const walk = (parent, depth) => {
    for (const one of under(parent)) {
      if (seen.has(one.id)) continue;
      seen.add(one.id);
      out.push({ module: one, depth });
      walk(one.id, depth + 1);
    }
  };
  walk(null, 0);
  return [...out, ...modules.filter((one) => !seen.has(one.id)).map((module) => ({ module, depth: 0 }))];
};

/* Where the weight a module scores with was read, in the words a reader types to change it. */
const sourceOf = (weight, asked) => {
  const key = `rank.${MODULE_TABLE}.${weight.row}`;
  if (asked === undefined) return `no rank.${MODULE_TABLE} table in ${fromProject()}, so no module is weighed`;
  if (weight.via) return `${key}, its ancestor's, in ${fromProject()}`;
  if (weight.row !== UNSET || Object.hasOwn(asked, UNSET)) return `${key} in ${fromProject()}`;
  return `${key}, the plugin's default`;
};

/** The reading: every module, its parent, its open primaries, its weight and source, its text. */
export const moduleLines = (modules, counts) => {
  const { value: weights, refusal } = weightsFrom();
  const asked = rankConvention().value?.[MODULE_TABLE];
  const byId = new Map(modules.map((one) => [one.id, one]));
  const lines = [`${modules.length} module(s) on the tracker of ${projectScope().value ?? "this project"}.`];
  if (refusal) lines.push(`The rank's weights refuse, so no weight below is in force: ${refusal}`);
  const unknown = undefinedKeys(asked, modules, UNSET);
  if (unknown.length) lines.push(`The rank refuses to run: ${undefinedRefusal(unknown, modules)}`);
  for (const { module, depth } of treeOf(modules)) {
    const weight = weightOf(module, modules, weights[MODULE_TABLE], UNSET);
    const points = asked === undefined ? 0 : weight.points;
    lines.push(`  ${"  ".repeat(depth)}${module.name}`
      + `  parent ${byId.get(module.parentId)?.name ?? NONE}`
      + `  ${counts.primary.get(module.id) ?? 0} open as primary`
      + `  weight ${points} ← ${sourceOf(weight, asked)}`);
    if (module.description) lines.push(`  ${"  ".repeat(depth)}    ${module.description}`);
  }
  lines.push(`${counts.unassigned} of ${counts.open} open issue(s) carry no module `
    + `(${shareOf(counts.unassigned, counts.open)}%).`);
  if (!counts.whole) lines.push("The walk of the open issues stopped short, so every count above is a floor.");
  return lines;
};

/** The one row a bare `forge doctor` prints under the project, or the tracker's refusal as a note. */
export const moduleSummaryRow = async () => {
  const read = await moduleDefinition({ soft: true });
  if (read.refused) return { level: "note", label: "modules", detail: `the labels would not list: ${read.refused}` };
  if (!read.modules.length) {
    return { label: "modules", detail: "none defined, so every open issue carries none (100%) — "
      + "`forge doctor modules --add <name>` defines one" };
  }
  const counts = await openCounts();
  return { label: "modules", detail: `${read.modules.length} defined; ${counts.unassigned} of ${counts.open}`
    + ` open issue(s) carry none (${shareOf(counts.unassigned, counts.open)}%)`
    + `${counts.whole ? "" : ", a floor: the walk stopped short"} — \`forge doctor modules\`` };
};
