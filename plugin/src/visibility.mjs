/* What this credential may see, in one place.

   Two mechanisms, deliberately not merged: the server *refuses* a tool (measured by `doctor`,
   cached per project), and a human *chose* to withhold a verb (`doctor --hide`). They differ in
   authority and in consequence — a gated verb cannot run, a withheld one is merely unlisted and
   still works — so collapsing them would lose the distinction that makes each correct.

   `needs` is declared on every verb that has a backing tool, not only on the two the probe list
   happens to cover: if `forge_issues` is ever gated, six verbs must disappear together rather than
   stay offered and fail one at a time. */
import { userConfig } from "./config.mjs";
import { fail, projectScope } from "./settings.mjs";

export const VERBS = [
  ["issues", "[--status s] [--search q] [--limit n]", "the browse projection", "forge_issues"],
  ["issue", "<uuid|ISS-45> [--fields a,b]", "one body, or named parts of it", "forge_issues"],
  ["new", "<file.md|@file|-> --title T [--status S] [--priority P]", "file one; open unless --status says", "forge_issues"],
  ["comment", "<uuid|ISS-45> <file.md|@file|->", "post a comment", "forge_comments"],
  ["attach", "<issue|comment> <uuid|ISS-45> <file>...", "upload; no base64 through context", "forge_uploads"],
  ["deps", "[ISS-45] [--long]", "the graph the issue bodies claim", "forge_issues"],
  ["dep", "<blocker> <blocked> [blocks|relates]", "record a dependency edge", "forge_project_pm"],
  ["guide", "[slug]", "the tracker's own guides", "forge_guide"],
  ["project", "", "the resolved project id", "forge_projects.list"],
  ["doctor", "[--token t] [--url u] [--hide v|--show v] [--full]", "what resolves, and from where"],
  ["tools", "[--all]", "the reachable surface"],
  ["schema", "<tool>", "one tool's arguments"],
  ["call", "<tool> <'json'|@file|->", "anything not wrapped above"],
];

export const VERB_NAMES = VERBS.map(([verb]) => verb);

const rowFor = (verb) => VERBS.find(([name]) => name === verb);

/* The usage line lived twice — once in this table and once inline in each verb's `fail()` — and
   the two had drifted four ways, so `forge -h` and the error a caller hits disagreed about which
   payload forms exist. */
export const usageOf = (verb) => {
  const row = rowFor(verb);
  return `Usage: forge ${verb}${row?.[1] ? ` ${row[1]}` : ""}`;
};

export const helpLine = ([verb, args, blurb]) =>
  `  ${`${verb} ${args}`.trim().padEnd(46)} ${blurb}`;

/* A refusal `doctor` measured, replayed where the tool would otherwise be offered. Deliberately a
   replay and not a fresh probe: filtering a listing must not cost a call per tool, and each record
   carries the date it was taken, because a refusal was true once rather than forever. */
const recorded = () => {
  const { value: slug } = projectScope();
  const held = slug ? (userConfig().capabilities ?? {})[slug] : null;
  if (!held) return { gates: {}, checkedAt: null };
  const { checkedAt, ...gates } = held;
  return { gates, checkedAt };
};

export const knownGates = recorded;
export const isGated = (tool) => Boolean(recorded().gates[tool]);
export const gatedTools = () => new Set(Object.keys(recorded().gates).filter(isGated));
export const withheldVerbs = () => new Set(userConfig().withheld ?? []);

export const offeredVerbs = () => {
  const withheld = withheldVerbs();
  return VERBS.filter(([verb, , , needs]) => !withheld.has(verb) && !(needs && isGated(needs)));
};

export const blockedBy = (verb) => {
  const needs = rowFor(verb)?.[3];
  return needs && isGated(needs) ? needs : null;
};

/* The schema a gated tool publishes is an invitation to a call that cannot succeed, so it is not
   printed at all. */
export const refuseIfGated = (tool, override = false) => {
  const { gates, checkedAt } = recorded();
  if (override || !gates[tool]) return;
  fail(
    `${tool} is not available to this credential: ${gates[tool]}\n` +
      `Measured ${checkedAt} by \`forge doctor\`. Re-run it after a credential change, or --all.`,
  );
};

export const callable = (declared) => declared.filter((tool) => !isGated(tool.name));
