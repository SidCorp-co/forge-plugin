/* What this credential may see. Two mechanisms, deliberately not merged: the server REFUSES a
   tool, a human WITHHELD a verb. They differ in authority and consequence.
   docs/cli/withholding-a-verb.md. */
import { userConfig } from "./config.mjs";
import { fail, projectScope } from "./settings.mjs";

export const VERBS = [
  ["issues", "[--status s] [--search q] [--limit n]", "every matching issue, walked; --limit is how many print", "forge_issues"],
  ["issue", "<uuid|ISS-45> [--fields a,b] [--full]", "one body, or named parts of it", "forge_issues"],
  ["new", "<file.md|@file|-> --title T [--kind K] [--status S] [--priority P] [--size fix] [--into ISS-45] [--with ISS-45] [--new]",
    "file one, read against the shape its kind needs; --into comments there instead", "forge_issues"],
  ["comment", "<uuid|ISS-45> <file.md|@file|->", "post a comment", "forge_comments"],
  ["plan", "<uuid|ISS-45> <file.md|@file|->", "write the issue's plan field, and read it back", "forge_issues"],
  ["claim", "<uuid|ISS-45> [--minutes n] [--next line] [--pushed] [--review] [--open line]",
    "take the issue's lease, or reclaim one a dead run left", "forge_issues"],
  ["resume", "<uuid|ISS-45> [...]", "one issue's whole context, re-minted from the record and the worklog", "forge_issues"],
  ["record", "<kind> <uuid|ISS-45> [...]", "a contract payload in the one shape the CLI owns; read back by kind", "forge_issues"],
  ["advance", "<uuid|ISS-45> [...]", "the next status, earned by the record or refused with what it owes", "forge_issues"],
  ["spec", "<id>[~<rev>]", "one clause of the requirements tree, read by its identifier"],
  ["attach", "<issue|comment> <uuid|ISS-45> <file>...", "upload; no base64 through context", "forge_uploads"],
  ["deps", "[ISS-45] [--long]", "the graph the issue bodies claim", "forge_issues"],
  ["next", "[--count n] [--why] [--json] [--holding ISS-45] [--project dir]",
    "the open issues to work next, ranked off their metadata; writes nothing", "forge_issues"],
  ["dep", "<blocker> <blocked> [blocks|relates]", "record a dependency edge", "forge_project_pm",
    { action: "set_dependency",
      refusal: "forge dep needs forge_project_pm set_dependency, which the tracker gives to a "
        + "paired device alone and this credential may not call: no edge is written from here, and "
        + "no other verb needs a device. `forge doctor` measured that." }],
  /* No flag of this verb is named here, deliberately — docs/cli/withholding-a-verb.md. */
  ["guide", "[contract [part]|<skill> [reference]|slug]",
    "this plugin's contract and each skill's method, one part per call, and the tracker's guides this flow stands behind",
    null],
  ["project", "[--credentials] [--refresh <file.md|@file|->] [--confirm <source>] [--line <n> <text>] [--title T] [--confidence C] [--meta k=v]...",
    "the id, the branches a change lands on, the staging deploy, and the project's own brief",
    "forge_projects.list"],
  ["knowledge", "<list|get|write|search|delete>",
    "what a run learned of this codebase, stored where the next one reads it", "forge_knowledge"],
  ["cloudflare", "<zones|zone|dns|purge|search>", "zones and DNS at Cloudflare, on local credentials"],
  ["codex", "<consult|verdict|pending|show|log|stats|eval|replay>", "a second model reviews what this turn changed"],
  ["hooks", "[--deny|--block|--notes|--rounds] [--hook h] [--last n] [--off h|--on h] [--how h]",
    "what the gates refused, why one does, which are off", null],
  /* No `needs`, though it writes: the gates below are the CALLER's project's — docs/cli/feedback.md. */
  ["feedback", "<file.md|@file|-> --title T",
    "a defect in this plugin, filed as a bug on the plugin's own project from any checkout", null],
  ["doctor", "[--token t] [--url u] [--hide v|--show v] [--full]", "what resolves, and from where"],
  ["stats", "runs [--since 3d] [--project dir] [--json]",
    "where an issue-flow run's time and rounds go, read off the transcripts the harness keeps", null],
  ["tools", "[--all]", "the reachable surface"],
  ["schema", "<tool>", "one tool's arguments"],
  ["call", "<tool> <'json'|@file|->", "anything not wrapped above"],
];

export const VERB_NAMES = VERBS.map(([verb]) => verb);

const rowFor = (verb) => VERBS.find(([name]) => name === verb);

export const usageOf = (verb) => {
  const row = rowFor(verb);
  return `Usage: forge ${verb}${row?.[1] ? ` ${row[1]}` : ""}`;
};

/* The pointer invites a reader to name a field, so a row earns it only where every value it
   declares is one the tracker names: a flag line has nothing to pass, and a value the caller fills
   from this machine — a file, an `@file`, `-` for stdin — sends a reader to a schema answering a
   question they did not ask. That vocabulary is the whole of it; cli-help.test.mjs judges each row. */
const readFromHere = (value) =>
  value
    .replaceAll(/[<>]|\.{3}$/gu, "")
    .split("|")
    .some((one) => /^(?:-|@\S*|file|dir|\S*\.\w+)$/u.test(one));

export const takesATrackerField = (args = "") => {
  const values = args
    .replaceAll(/[[\]]/gu, " ")
    .split(/\s+/u)
    .filter((one) => one && !one.startsWith("-"));
  return values.length > 0 && !values.some(readFromHere);
};

/** What `-h` on a verb answers: what to type, what it is for, and which schema holds the fields the
 *  tracker itself takes — the detail, fetched only when it is asked for. */
export const helpOf = (verb) => {
  const row = rowFor(verb);
  const detail = takesATrackerField(row?.[1]) && row?.[3]
    && `The fields the tracker takes: \`forge schema ${row[3]}\`.`;
  return [usageOf(verb), row?.[2], detail]
    .filter(Boolean)
    .join("\n");
};

export const helpLine = ([verb, args, blurb]) =>
  `  ${`${verb} ${args}`.trim().padEnd(46)} ${blurb}`;

/* A replay of what doctor measured, never a fresh probe, each record carrying its date. */
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

/* A row naming one action is gated on it, so what is asked about tools goes on seeing the tool a
   verb cannot spend, and `row[3]` stays the schema pointer either way — docs/cli/deps.md. */
export const gateKey = (row) => (row?.[4] ? `${row[3]}.${row[4].action}` : row?.[3]);

export const offeredVerbs = () => {
  const withheld = withheldVerbs();
  return VERBS.filter((row) => {
    const key = gateKey(row);
    return !withheld.has(row[0]) && !(key && isGated(key));
  });
};

export const blockedBy = (verb) => {
  const row = rowFor(verb);
  const key = gateKey(row);
  return key && isGated(key) ? { key, said: row[4]?.refusal ?? null } : null;
};

/* A gated tool's schema is an invitation to a call that cannot succeed. */
export const refuseIfGated = (tool, override = false) => {
  const { gates, checkedAt } = recorded();
  if (override || !gates[tool]) return;
  fail(
    `${tool} is not available to this credential: ${gates[tool]}\n` +
      `Measured ${checkedAt} by \`forge doctor\`. Re-run it after a credential change, or --all.`,
  );
};

export const callable = (declared) => declared.filter((tool) => !isGated(tool.name));
