/* What this credential may see. Two mechanisms, deliberately not merged: the server REFUSES a
   tool, a human WITHHELD a verb. They differ in authority and consequence.
   docs/cli/withholding-a-verb.md. */
import { ROUTES } from "../tracker/routes.mjs";
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
  ["issue", "[<uuid|ISS-45>] [--status s] [--search q] [--limit n] [--fields a,b] [--full] [--set f=v... --why W] [--blocks|--relates|--unlink ISS-46]",
    "every matching issue with no key, or one body and the edges on it with one",
    "forge_issues", { group: BACKLOG, wraps: { list: "`forge issue`", get: "`forge issue ISS-45`",
      at: "`forge issue ISS-45`",
      update: "`forge issue --set`", link: "`forge issue --blocks`", unlink_edge: "`forge issue --unlink`" } }],
  ["new", "<file.md|@file|-> --title T --category C [--status S] [--priority P] [--complexity xs|s|m|l|xl] [--with ISS-45,ISS-46] [--new]",
    "file one, read against the shape its category needs",
    "forge_issues", { group: BACKLOG, wraps: { create: "`forge new`" } }],
  ["comment", "<uuid|ISS-45> [<file.md|@file|->] [--title T]",
    "the thread whole with no body, or post one; the lease on the record decides whether it renews",
    "forge_comments", { group: BACKLOG,
      wraps: { create: "`forge comment`", list: "`forge comment ISS-45`" } }],
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
    "forge_guide", { group: METHOD, needs: null,
      wraps: { list: "`forge guide`", get: "`forge guide <slug>`" } }],
  /* Owns the seven and spends the one the tracker spells in its own tool name, which is `needs`. */
  ["project", "[new --name N --slug S | <slug> [--set k=v|--archive|--unarchive]]",
    "the projects themselves, this CLI's one verb outside any project's scope",
    "forge_projects", { group: HARNESS, needs: "forge_projects.list",
      wraps: {
        list: "`forge project`",
        get: "`forge project <slug>`",
        create: "`forge project new`",
        read: "`forge project <slug>`",
        update: "`forge project <slug> --set`",
        archive: "`forge project <slug> --archive`",
        unarchive: "`forge project <slug> --unarchive`" } }],
  /* The store's own search left with its route; the recall that replaced it is another tool's, and
     `needs` stays this one's, because a refused recall must not hide the three reads that work. */
  ["knowledge", "<list|get|write|search|delete>",
    "what a run learned of this codebase, stored where the next one reads it", "forge_knowledge",
    { group: METHOD,
      wraps: {
        list: "`forge knowledge list`",
        get: "`forge knowledge get`",
        upsert: "`forge knowledge write`",
        "forge_memory.search": "`forge knowledge search`",
        delete: "`forge knowledge delete`" } }],
  ["cloudflare", "<zones|zone|dns|purge|search>", "zones and DNS at Cloudflare, on local credentials",
    null, { group: HARNESS }],
  ["codex", "<consult|verdict|pending|show|log|stats|eval|marks|replay>",
    "a second model reviews what this turn changed", null, { group: HARNESS }],
  ["chatgpt", "\"<prompt>\" [--resume id] [--model slug] [--file path|url]... [--save path]",
    "one ChatGPT turn, or an image, over the endpoint this machine has saved", null,
    { group: HARNESS }],
  ["hooks", "[--deny|--block|--notes|--rounds] [--hook h] [--last n] [--off h|--on h] [--how h]",
    "what the gates refused, why one does, which are off", null, { group: HARNESS }],
  /* No `needs`, though it writes: the gates below are the CALLER's project's — docs/cli/feedback.md. */
  ["feedback", "<file.md|@file|-> --title T [--kind K] [--with ISS-45,ISS-46] [--new]",
    "`forge new` with the kind, the project and the Where filled in: a defect in this plugin, from any checkout",
    null, { group: HARNESS }],
  ["doctor", "[--token t] [--url u] [--chatgpt-url u] [--chatgpt-key k] [--hide v|--show v]"
    + " [--ship ready|self] [--runs n] [--set k=v] [--credentials]"
    + " [--refresh <file.md|@file|->] [--confirm <source>] [--line <n> <text>] [--title T]"
    + " [--confidence C] [--meta k=v]... [--full]",
    "what resolves and from where, this project's own record included, and the keys of it that are written here",
    "forge_config", { group: HARNESS, needs: null,
      wraps: {
        get: "`forge doctor`",
        pipeline: "`forge doctor`",
        set_pipeline: "`forge doctor --set`",
        facts: "`forge doctor`",
        set_facts: "`forge doctor --set`",
        "forge_project_pm.graph": "`forge doctor`",
        "forge_project_pm.snapshot": "`forge doctor`",
        "forge_project_pm.runner_load": "`forge doctor`" } }],
  ["stats", "<runs|eval|marks>",
    "where an issue-flow run's time and rounds go, read off the transcripts the harness keeps", null,
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

/* Read off the routes the verb owns, so the answer arrives with the question rather than in a second command that could go out of step with the table. Owning a route is the whole condition: a verb's own argument vocabulary says nothing about what the tracker takes, and a verb owning no route names no field. */
const fieldsOwned = (row) => {
  const owned = wrapsOf(row);
  if (!owned) return [];
  const said = Object.keys(owned).flatMap((key) => ROUTES[key]?.sends ?? []);
  /* `data` is the body every write is wrapped in and names no field, so a verb whose only send is
     that one names none: the fields inside it are `DECLARES`, which the verb's own flags carry. */
  return [...new Set(said)].filter((one) => one !== "data").sort();
};

/** What `-h` on a verb answers: what to type, what it is for, and the fields the tracker itself
 *  takes for the routes this verb is the route for. */
export const helpOf = (verb) => {
  const row = rowFor(verb);
  const fields = fieldsOwned(row);
  const detail = fields.length && `The fields the tracker takes: ${fields.join(", ")}.`;
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

/* Two jobs, two columns: `row[3]` is the tool whose routes this verb OWNS, `needs` the capability it
   SPENDS, and a verb can own a route it must not be hidden by. Read by presence, so an explicit
   `null` spends none and an omitted one derives what it always did. */
export const gateKey = (row) => {
  const held = row?.[4];
  if (held && Object.hasOwn(held, "needs")) return held.needs;
  return held?.action ? `${row[3]}.${held.action}` : row?.[3];
};

/* One spelling everywhere, `<tool>.<action>`: a claim writes the bare action under the tool its row owns, or the whole key where the route is another tool's, and two spellings of one route is how a claim stops matching. */
export const routeKey = (owns, action) => (String(action).includes(".") ? String(action) : `${owns}.${action}`);

/* The routes this verb is the ROUTE for, not every route it spends; wrapped.test.mjs keeps the two apart. */
export const wrapsOf = (row) => {
  const claims = row?.[4]?.wraps
    ?? (row?.[4]?.action ? { [row[4].action]: `\`forge ${row[0]}\`` } : null);
  if (!claims) return null;
  return Object.fromEntries(Object.entries(claims)
    .map(([action, line]) => [routeKey(row[3], action), line]));
};

/* Read backwards: which verb is the route a raw call asks for, the table's silence being a decision. */
export const actionIn = (input) => {
  const held = input?.action;
  return typeof held === "string" ? held : null;
};

/* The ask too, its callers spelling it differently: the MCP gate names a bare tool with an action, the generated help a whole key with none. Matched on the route, never the owning column, or a verb owning another tool's route answers for nothing. */
export const verbFor = (tool, action) => {
  if (!tool || (!action && !String(tool).includes("."))) return null;
  const wanted = String(tool).includes(".") ? String(tool) : routeKey(tool, action);
  for (const row of VERBS) {
    const claimed = wrapsOf(row);
    if (claimed && Object.hasOwn(claimed, wanted)) return { verb: row[0], line: claimed[wanted], key: wanted };
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
  /* Named off the key that matched, not the arguments: a caller naming the whole pair in the tool slot leaves the action slot empty, and `<key> null` is a refusal that reads as a bug. */
  const said = found.key.replace(".", " ");
  const gone = unavailable(found.verb);
  if (gone) {
    return `${said} is what ${found.line} wraps, and ${gone.replace(/\.$/u, "")}. `
      + "The raw call is not the way round that.";
  }
  return `${said} is what ${found.line} wraps: type it instead — it makes this call `
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
