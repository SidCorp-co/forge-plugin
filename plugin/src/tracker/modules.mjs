/* A project's modules, as its own tracker defines them: labels of kind `module`, nested by parent.
   Nothing here names a module or a weight — docs/cli/modules.md says why both are the project's. */
import { scoped } from "./rest.mjs";
import { suggest } from "../suggest.mjs";
import { NO_LONGER_OWES } from "../flow/earned/park-status.mjs";

export const MODULE = "module";

/* The route's own page size, which is the most one ask may carry. */
const PAGE = 200;

/** The project's modules off its label list, or the tracker's refusal: `soft` hands a caller that
 *  must not exit on one the refusal instead. */
export const moduleDefinition = async ({ soft = false } = {}) => {
  const read = await scoped("forge_labels", { action: "list" }, soft);
  if (read?.refused) return { modules: [], refused: read.refused };
  const modules = (read?.labels ?? []).filter((one) => one.kind === MODULE)
    .map(({ id, name, parentId, description }) => ({ id, name, parentId: parentId ?? null,
      description: description ?? null }));
  return { modules, refused: null };
};

const namesOf = (modules) => modules.map((one) => one.name);

/** The defined names as a refusal lists them, or the sentence saying there are none. */
const definedSaid = (modules) => (modules.length
  ? `This project defines: ${namesOf(modules).join(", ")}.`
  : "This project defines no module yet.");

/** The one module `name` names, or the refusal naming what is defined. `what` is how the caller's
 *  own flag spells the slot, so the refusal names the word the caller typed. */
export const moduleNamed = (modules, name, what) => {
  const found = modules.find((one) => one.name === name);
  if (found) return { found, refusal: null };
  const close = suggest(name, namesOf(modules));
  const near = close.length ? ` Did you mean: ${close.join(", ")}?` : "";
  return { found: null,
    refusal: `${what} names \`${name}\`, which is no module of this project.${near} ${definedSaid(modules)}` };
};

/** The module, its parent, its parent's parent, and so on to the top. The tracker's foreign key
 *  permits a cycle, so the walk ends at the first module it has already met. */
export const lineOf = (module, modules) => {
  const byId = new Map(modules.map((one) => [one.id, one]));
  const line = [];
  const seen = new Set();
  for (let at = module; at && !seen.has(at.id); at = byId.get(at.parentId)) {
    seen.add(at.id);
    line.push(at);
  }
  return line;
};

/** What a module scores under `table`: its own row, else the nearest ancestor's, else `unset`.
 *  `row` is the key that answered and `via` the ancestor it belongs to where that is not the module.
 *  A module the tracker lets be called `unset` has no row of its own, that key being the fallback's. */
export const weightOf = (module, modules, table, unset) => {
  if (module) {
    for (const [depth, one] of lineOf(module, modules).entries()) {
      if (one.name !== unset && Object.hasOwn(table, one.name)) {
        return { points: table[one.name], row: one.name, via: depth ? one.name : null };
      }
    }
  }
  return { points: table[unset] ?? 0, row: unset, via: null };
};

/** Each `rank.module` key naming no module the project defines, the `unset` row excepted. */
export const undefinedKeys = (table, modules, unset) => {
  const names = new Set(namesOf(modules));
  return Object.keys(table ?? {}).filter((key) => key !== unset && !names.has(key));
};

export const undefinedRefusal = (keys, modules) =>
  `\`rank.module\` weighs ${keys.map((one) => `\`${one}\``).join(", ")}, which ${keys.length === 1
    ? "is no module" : "are no modules"} this project defines, so the ranking would score nothing by `
  + `${keys.length === 1 ? "it" : "them"} and say nothing about it. ${definedSaid(modules)} Rename or `
  + "drop the key where the project's configuration sets it, or define the module with "
  + "`forge doctor modules --add <name>`.";

/** The module a filing's `--module` names, off the definition of the project the filing is aimed at,
 *  or the refusal naming what that project defines and the call that defines one. */
export const moduleForFiling = async (name, verb) => {
  if (name === undefined) return { module: null, refusal: null };
  const { modules, refused } = await moduleDefinition({ soft: true });
  if (refused) return { module: null, refusal: `${verb}: --module could not be checked, the tracker would not list this project's labels: ${refused} Nothing was filed.` };
  const { found, refusal } = moduleNamed(modules, name, "--module");
  if (found) return { module: found, refusal: null };
  return { module: null, refusal: `${verb}: ${refusal} Nothing was filed: \`forge doctor modules --add ${name}\``
    + " defines it, where the project means to have it." };
};

/** Whether an issue as read back carries `module` as its primary. */
export const carriesPrimary = (labels, module) =>
  (labels ?? []).some((one) => one?.id === module.id && one?.isPrimary === true);

/** An issue's primary module id off the attributions a search row carries, or null. */
export const primaryOf = (attributions) =>
  (attributions ?? []).find((one) => one?.isPrimary)?.labelId ?? null;

/* One walk of the search route, a page at a time, to the end or to where it stopped short. */
const walked = async (narrowing, each) => {
  let offset = 0;
  for (;;) {
    const page = await scoped("forge_issues", { action: "attributed", ...narrowing, limit: PAGE, offset });
    const rows = page?.issues ?? [];
    for (const row of rows) each(row);
    if (page?.hasMore !== true) return page?.hasMore === false;
    if (!rows.length) return false;
    offset += rows.length;
  }
};

/** Every issue at `statuses` and the id of its primary module, paged to the end; `whole` false where
 *  the walk stopped short, which the caller says rather than reading absence as no module. */
export const primaryModules = async (statuses) => {
  const found = new Map();
  const whole = await walked({ statuses }, (row) => found.set(row.issueId, primaryOf(row.modules)));
  return { found, whole };
};

/** The open issues — every status but the two that owe nothing more — counted in one walk: how many
 *  there are, how many carry no module at all, and how many carry each module as primary. One walk
 *  rather than the tracker's rollup, whose buckets cannot give the whole the share is taken over. */
export const openCounts = async () => {
  const counted = { open: 0, unassigned: 0, primary: new Map() };
  const whole = await walked({ statusNot: NO_LONGER_OWES }, (row) => {
    counted.open += 1;
    if (!(row.modules ?? []).length) counted.unassigned += 1;
    const primary = primaryOf(row.modules);
    if (primary) counted.primary.set(primary, (counted.primary.get(primary) ?? 0) + 1);
  });
  return { ...counted, whole };
};

/** The share `part` is of `whole`, as a whole percentage rounded to nearest. */
export const shareOf = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

/** Every issue carrying module `id` at all, primary or not, whatever its status. */
export const carriersOf = async (id) => {
  const rows = [];
  const whole = await walked({ module: id }, (row) => rows.push(row));
  return { rows, whole };
};
