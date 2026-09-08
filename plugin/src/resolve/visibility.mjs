/* What this credential may see. Two mechanisms, deliberately not merged: the server REFUSES a
   tool, a human WITHHELD a verb. They differ in authority and consequence.
   docs/cli/withholding-a-verb.md. */
import { userConfig } from "./config.mjs";
import { fail, feedbackScope, projectScope } from "./settings.mjs";

/* A row names its group; `forge -h`'s headings are folded off that, so a verb reaching the table
   without one appears under no heading and `cli-help.test.mjs` refuses it rather than a reader. */
const BACKLOG = "The backlog";
const FLOW = "An issue's flow";
const METHOD = "The method";
const HARNESS = "The harness";

export const GROUPS = [BACKLOG, FLOW, METHOD, HARNESS];

export const VERBS = [
  ["issues", "[--status s] [--search q] [--limit n]", "every matching issue, walked; --limit is how many print",
    "forge_issues", { group: BACKLOG, wraps: { list: "`forge issues`" } }],
  ["issue", "<uuid|ISS-45> [--fields a,b] [--full] [--set f=v --why W] [--blocks ISS-46|--relates ISS-46|--unlink ISS-46]",
    "one body, or named parts of it, and the edges on it",
    "forge_issues", { group: BACKLOG, wraps: { get: "`forge issue`", update: "`forge issue --set`",
      link: "`forge issue --blocks`", unlink_edge: "`forge issue --unlink`" } }],
  ["new", "<file.md|@file|-> --title T --category C [--status S] [--priority P] [--complexity xs|s|m|l|xl] [--with ISS-45,ISS-46] [--new]",
    "file one, read against the shape its category needs",
    "forge_issues", { group: BACKLOG, wraps: { create: "`forge new`" } }],
  ["comment", "<uuid|ISS-45> <file.md|@file|-> [--title T]",
    "post a comment; the lease on the record decides whether it renews one",
    "forge_comments", { group: BACKLOG, wraps: { create: "`forge comment`" } }],
  ["claim", "<uuid|ISS-45> [--minutes n] [--next <line>] [--pushed] [--review] [--open <line>] [--ready] [--take] [--judged] [--reconciled <sha>]",
    "take the issue's lease, or reclaim one a dead run left", "forge_issues", { group: FLOW }],
  ["resume", "<uuid|ISS-45> [...]", "one issue's whole context, re-minted from the record and the worklog",
    "forge_issues", { group: FLOW }],
  ["record", "<kind> <uuid|ISS-45> [...]", "a contract payload in the one shape the CLI owns; read back by kind",
    "forge_issues", { group: FLOW, wraps: {
      mark_merged: "`forge record merged`",
      unmark: "`forge record merged --undo`" } }],
  ["advance", "<uuid|ISS-45> [...]", "the next status, earned by the record or refused with what it owes",
    "forge_issues", { group: FLOW, wraps: { transition: "`forge advance`" } }],
  ["spec", "<id>[~<rev>]", "one clause of the requirements tree, read by its identifier",
    null, { group: METHOD }],
  ["attach", "<issue|comment> <uuid|ISS-45> <file>...", "upload; no base64 through context",
    "forge_uploads", { group: BACKLOG, wraps: { request: "`forge attach`" } }],
  ["next", "[--count n] [--why] [--json] [--graph [ISS-45]] [--holding ISS-45] [--checkout <dir>]",
    "the open issues to work next, ranked off their metadata; writes nothing", "forge_issues",
    { group: BACKLOG }],
  /* `--tracker` unnamed, a maintainer's alone (docs/cli/withholding-a-verb.md); `--for` every run's. */
  ["guide", "[contract [part]|<skill> [reference]|slug] [--for ISS-nn]",
    "this plugin's contract and each skill's method, one part per call, and the tracker's guides this flow stands behind",
    null, { group: METHOD }],
  /* The tracker spells this action in the tool's own name, so the gate is that name whole. */
  ["project", "[new --name N --slug S | <slug> [--set k=v|--archive|--unarchive]]",
    "the projects themselves, this CLI's one verb outside any project's scope",
    "forge_projects.list", { group: HARNESS }],
  ["knowledge", "<list|get|write|search|delete>",
    "what a run learned of this codebase, stored where the next one reads it", "forge_knowledge",
    { group: METHOD,
      wraps: {
        list: "`forge knowledge list`",
        get: "`forge knowledge get`",
        upsert: "`forge knowledge write`",
        search: "`forge knowledge search`",
        delete: "`forge knowledge delete`" } }],
  ["cloudflare", "<zones|zone|dns|purge|search>", "zones and DNS at Cloudflare, on local credentials",
    null, { group: HARNESS }],
  ["codex", "<consult|verdict|pending|show|log|stats|eval|marks|replay>",
    "a second model reviews what this turn changed", null, { group: HARNESS }],
  ["hooks", "[--deny|--block|--notes|--rounds] [--hook h] [--last n] [--off h|--on h] [--how h]",
    "what the gates refused, why one does, which are off", null, { group: HARNESS }],
  /* No `needs`, though it writes: the gates below are the CALLER's project's — docs/cli/feedback.md. */
  ["feedback", "<file.md|@file|-> --title T [--kind K] [--with ISS-45,ISS-46] [--new]",
    "`forge new` with the kind, the project and the Where filled in: a defect in this plugin, from any checkout",
    null, { group: HARNESS }],
  ["doctor", "[--token t] [--url u] [--hide v|--show v] [--ship ready|self] [--set k=v] [--credentials]"
    + " [--refresh <file.md|@file|->] [--confirm <source>] [--line <n> <text>] [--title T]"
    + " [--confidence C] [--meta k=v]... [--full]",
    "what resolves and from where, this project's own record included, and the keys of it that are written here",
    null, { group: HARNESS }],
  ["stats", "<runs|eval|marks>",
    "where an issue-flow run's time and rounds go, read off the transcripts the harness keeps", null,
    { group: HARNESS }],
  ["tools", "[--all]", "the reachable surface", null, { group: HARNESS }],
  ["schema", "<tool>", "one tool's arguments", null, { group: HARNESS }],
  ["call", "<tool> <'json'|@file|->",
    "anything no verb wraps; an action one does is refused with the verb to type", null,
    { group: HARNESS }],
];

export const VERB_NAMES = VERBS.map(([verb]) => verb);

const groupOf = (row) => row?.[4]?.group ?? null;

/** The offered rows under their heading, in `GROUPS`'s order; an empty group prints no heading. */
export const grouped = (rows) =>
  GROUPS.map((group) => [group, rows.filter((row) => groupOf(row) === group)])
    .filter(([, held]) => held.length);

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

const FEEDBACK_VERB = "feedback";

/** The project's say over the channel to this plugin's backlog, beside this machine's over the verb:
 *  neither grants what the other withholds, and a closed one is refused in a line naming the key. */
export const pluginChannel = () => feedbackScope().plugin;

const closedByProject = (verb) => verb === FEEDBACK_VERB && pluginChannel().value === "off";

export const verbForPluginDefect = () =>
  (closedByProject(FEEDBACK_VERB) || withheldVerbs().has(FEEDBACK_VERB) ? null : FEEDBACK_VERB);

export const channelRefusal = (verb) =>
  (closedByProject(verb)
    ? `\`forge ${verb}\` is withheld here: this project sets feedback.plugin to off in`
      + ` ${pluginChannel().from}, so a defect in this plugin goes in the run's report and is filed nowhere.`
    : null);

/* A row naming one action is gated on it, and `row[3]` stays the schema pointer either way. Off
   `action` and never off the column existing, or a routing row composes a key nothing records. */
export const gateKey = (row) => (row?.[4]?.action ? `${row[3]}.${row[4].action}` : row?.[3]);

/* The actions this verb is the ROUTE for — not every action it spends. A gated row routes the one
   it names, every other route says so in `wraps`, and wrapped.test.mjs watches the two apart. */
export const wrapsOf = (row) =>
  row?.[4]?.wraps ?? (row?.[4]?.action ? { [row[4].action]: `\`forge ${row[0]}\`` } : null);

/* And read backwards: which verb is the route to the tool and action a raw call asks for. A pair no
   row claims is what `forge call` is left for, and the table's silence is that decision. */
export const actionIn = (input) => {
  const held = input?.action;
  return typeof held === "string" ? held : null;
};

export const verbFor = (tool, action) => {
  if (!tool || !action) return null;
  for (const row of VERBS) {
    if (row[3] !== tool) continue;
    const claimed = wrapsOf(row);
    if (claimed && Object.hasOwn(claimed, action)) return { verb: row[0], line: claimed[action] };
  }
  return null;
};

/* Why a verb cannot be typed, in the words its own refusal already carries, or nothing where it
   can. The argument for refusing rather than falling back: how/wrapped-route.md. */
const unavailable = (verb) => {
  if (withheldVerbs().has(verb)) {
    return `\`forge ${verb}\` is withheld on this machine — \`forge doctor --show ${verb}\` offers it again`;
  }
  const blocked = blockedBy(verb);
  return blocked
    ? `\`forge ${verb}\` cannot spend ${blocked} on this credential — \`forge doctor\` measured that`
    : null;
};

export const wrappedRefusal = (tool, action) => {
  const found = verbFor(tool, action);
  if (!found) return null;
  const gone = unavailable(found.verb);
  if (gone) {
    return `${tool} ${action} is what ${found.line} wraps, and ${gone.replace(/\.$/u, "")}. `
      + "The raw call is not the way round that.";
  }
  return `${tool} ${action} is what ${found.line} wraps: type it instead — it makes this call `
    + "and takes the reading this route skips.";
};


export const offeredVerbs = () => {
  const withheld = withheldVerbs();
  return VERBS.filter((row) => {
    const key = gateKey(row);
    return !withheld.has(row[0]) && !closedByProject(row[0]) && !(key && isGated(key));
  });
};

export const blockedBy = (verb) => {
  const key = gateKey(rowFor(verb));
  return key && isGated(key) ? key : null;
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
