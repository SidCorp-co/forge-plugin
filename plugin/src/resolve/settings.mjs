/* Where every setting comes from — never from an argument. Two scopes: the url and token are the
   ACCOUNT's, the slug and prose language the PROJECT's, so the slug is demanded lazily. Each
   resolves to `{ value, from }`, because provenance is what doctor reports. docs/cli/settings.md. */
import { dirname, join, resolve } from "node:path";

import { checkoutAt } from "../git/checkout-at.mjs";
import { configPath, once, readJson, userConfig } from "./config.mjs";

/* Registered by a caller holding something no exit may lose — a body that arrived on stdin. */
let kept = null;

export const keepOnFailure = (text) => {
  kept = text;
};

/** What `fail` throws inside `refusing`, where there is no process of this CLI's own to end — the release script files an issue mid-release, and an exit there leaves one half done. */
export class Refusal extends Error {}

let embedded = 0;

/** Inside `refusing()` the argv is the embedding script's, so nothing is built from it (ISS-842). */
export const embeddedRun = () => embedded > 0;

export const refusing = async (run) => {
  embedded += 1;
  try {
    return await run();
  } finally {
    embedded -= 1;
  }
};

export const fail = (message) => {
  if (embedded) throw new Refusal(message);
  console.error(message);
  if (kept) console.error(kept);
  process.exit(1);
};

const ancestors = (start) => {
  const seen = [];
  let current = resolve(start);
  for (;;) {
    seen.push(current);
    const parent = dirname(current);
    if (parent === current) return seen;
    current = parent;
  }
};

/* Walked once for this process, and both answers come off it: which CHECKOUT this process stands in,
   and which REPOSITORY that checkout belongs to, a linked worktree owning neither settings file. */
const standing = once(() => checkoutAt(process.cwd()));

const searchRoots = once(() => {
  const shared = standing()?.repository ?? null;
  return [...ancestors(process.cwd()), ...(shared ? [shared] : [])];
});

const nearest = (name) =>
  once(() => {
    for (const root of searchRoots()) {
      const parsed = readJson(join(root, name));
      if (parsed) return { parsed, from: name, root };
    }
    return { parsed: null, from: null, root: null };
  });

/** The project file, spelled here alone: `forge doctor` reports it, other lines name the project. */
export const FROM_PROJECT = ".forge.json";

const forgeJson = nearest(FROM_PROJECT);
const mcpJson = nearest(".mcp.json");

/* Reported, never resolved: doctor names a `forge` server in a `.mcp.json` rather than leaving its
   owner to guess, because credentials that answer by directory are the account's in name only. */
export const mcpForgeIgnored = () => {
  const server = mcpJson().parsed?.mcpServers?.forge ?? null;
  if (!server) return null;
  return {
    root: mcpJson().root,
    credentials: Boolean(server.url || server.headers?.Authorization),
    slug: Boolean(server.headers?.["X-Forge-Project-Slug"]),
  };
};

const sourced = (from, value) => (value ? { value, from } : { value: null, from: null });

export const accountCredentials = once(() => {
  const saved = userConfig();
  return {
    url: sourced(configPath(), saved.url),
    token: sourced(configPath(), saved.token),
  };
});

export const settings = once(() => {
  const { url, token } = accountCredentials();
  if (!url.value || !token.value) {
    /* The file this call read, not the one it would have read with the configuration directory left where it defaults: a run under a redirected home was told the live path was the one place either is read from, and went looking in a file nothing had opened (ISS-189). */
    fail(
      `No Forge endpoint. Run \`forge doctor --token <pat> --url <endpoint>\` to save one in\n${
        configPath()}\n`
        + "which is the one place either is read from. Neither the environment nor a `.mcp.json`\n"
        + "is a source; `forge doctor` names a `.mcp.json` it finds.",
    );
  }
  const bearer = token.value.startsWith("Bearer ") ? token.value : `Bearer ${token.value}`;
  return { url: url.value, token: bearer };
});

export const projectScope = once(() => sourced(FROM_PROJECT, forgeJson().parsed?.slug));

/** The project file a NAMED directory resolves to, whole, for a verb reading one checkout while standing in another: the same walk, off that path rather than this process's, and null where it names none. Whole rather than one key, since a reader of a second key would otherwise walk again and could disagree with this one about which file is the project's. */
export const projectFileAt = (directory) => {
  const shared = checkoutAt(directory)?.repository ?? null;
  const roots = [...ancestors(directory), ...(shared === null ? [] : [shared])];
  for (const root of roots) {
    const parsed = readJson(join(root, FROM_PROJECT));
    if (parsed) return parsed;
  }
  return null;
};

export const projectAt = (directory) => projectFileAt(directory)?.slug ?? null;

/* Where a project-scoped call GOES and in whose prose — the target's, not the caller's: docs/cli/feedback.md. */
let aimed = null;

export const useProject = ({ slug, from }) => {
  aimed = { value: slug, from };
};

export const projectTarget = () => aimed ?? projectScope();

/* Which paths, and which angles, are the checkout's answer: the account's covers every one. */
export const projectRecordPattern = () => sourced(FROM_PROJECT, forgeJson().parsed?.codex?.pathRe);

/* No plugin default, and an unreadable pattern is no declaration: docs/two-levels.md, README. */
const declaredWork = (at) => (at ? projectFileAt(at)?.lease?.workingRe : forgeJson().parsed?.lease?.workingRe);

export const workPatternOf = (said) => {
  if (!said) return { value: null, from: null, unreadable: false };
  try {
    new RegExp(said, "u");
  } catch {
    return { value: null, from: FROM_PROJECT, unreadable: said };
  }
  return { value: said, from: FROM_PROJECT, unreadable: false };
};

export const projectWorkPattern = (at = null) => workPatternOf(declaredWork(at));
export const projectCodex = () => forgeJson().parsed?.codex ?? {};

/** Which CHECKOUT this process stands in — what a caller reading FILES off a root wants, and what
 *  `--git-common-dir` gets wrong in a worktree (ISS-1245); else the project file's own directory. */
export const checkoutRoot = once(() => standing()?.tree ?? forgeJson().root);

/* The slug is a header when there is one, and an error only for a call needing a project id. */
export const slugIfAny = () => projectTarget().value;

export const projectSlug = () => {
  const { value } = projectTarget();
  if (!value) {
    fail(
      'This call is project-scoped and no project slug is set. Put `{ "slug": "<project>" }`\n' +
        "in the project file at the root of this checkout, the one place it is read from, which\n" +
        "`forge doctor` names — not the environment, and not a `.mcp.json` header.",
    );
  }
  return value;
};

/* A property of the tracker, not the CLI. Off by default: a wrong-language issue cannot be
   deleted, and a missing translation is an edit. */
export const translateScope = once(() => {
  const chosen = sourced(FROM_PROJECT, forgeJson().parsed?.translate);
  const off = !chosen.value || chosen.value === "off" || chosen.value === "false";
  return { value: off ? null : String(chosen.value), from: chosen.from };
});

export const translateTarget = () =>
  (aimed ? { value: null, from: aimed.from } : translateScope());

export const translateTo = () => translateTarget().value;

const DEFAULT_PROSE = {
  marker: "those edges are recorded",
  blockedBy: "blocked by",
  blocks: "blocks",
  noun: "issues?",
};

export const depsConvention = once(() => {
  const given = forgeJson().parsed?.deps;
  return {
    value: { ...DEFAULT_PROSE, ...(given ?? {}) },
    from: given ? FROM_PROJECT : "the built-in English default",
  };
});

export const rankConvention = once(() => sourced(FROM_PROJECT, forgeJson().parsed?.rank));

export const JOB_ALL = "all";

const names = (given) => (Array.isArray(given) && given.every((one) => typeof one === "string")
  ? [...given] : null);

/* A bare array is the verbs alone and declares no skills, which is what a checkout written before
   the skills half holds and what leaves every skill offered. docs/cli/a-job.md. */
const jobShape = (given) => {
  const bare = names(given);
  if (bare) return { verbs: bare, skills: null };
  if (!given || typeof given !== "object" || Array.isArray(given)) return null;
  const verbs = names(given.verbs);
  const skills = given.skills === undefined ? null : names(given.skills);
  if (!verbs || (given.skills !== undefined && !skills)) return null;
  return { verbs, skills };
};

/* A job is the project's because which jobs exist cannot be stated without naming the project, and
   `all` clears one rather than naming one. Which words are verbs is the verb table's. */
export const jobsOf = (given) => {
  if (!given || typeof given !== "object" || Array.isArray(given)) return { jobs: {}, from: null, problems: [] };
  const jobs = {};
  const problems = [];
  for (const [name, declared] of Object.entries(given)) {
    const shape = name === JOB_ALL ? null : jobShape(declared);
    if (name === JOB_ALL) {
      problems.push(`\`${JOB_ALL}\` is reserved, being what clears a job rather than a name one may take,`
        + ` so the job declared under it is offered nowhere — rename it in ${FROM_PROJECT}`);
    } else if (!shape) {
      problems.push(`the \`${name}\` job is neither a list of verb names nor a table of \`verbs\` and`
        + ` \`skills\` that are each one, so it is offered nowhere — write it as one in ${FROM_PROJECT}`);
    } else {
      jobs[name] = shape;
    }
  }
  return { jobs, from: FROM_PROJECT, problems };
};

export const declaredJobs = () => jobsOf(forgeJson().parsed?.jobs);

export const projectReview = () => forgeJson().parsed?.review ?? {};
export const projectStop = () => forgeJson().parsed?.stop ?? {};

const PLUGIN_DEFAULT = "the plugin's default";

/** One shape for every keyed choice, so doctor and the guides' conditions read them all the same way, and the judgement with it: `unknown` is what this key will not take, which is what a write of that key refuses on rather than deciding for itself what the set is. */
export const chosen = (given, allowed, fallback, { source = FROM_PROJECT, absent = PLUGIN_DEFAULT } = {}) => {
  if (given === undefined || given === null) return { value: fallback, from: absent };
  const held = String(given);
  return allowed.includes(held)
    ? { value: held, from: source }
    : { value: fallback, from: absent, unknown: held };
};

export const OWED_DOORS = ["gate", "commit", "ship"];
const OWED_ABSENT = ["commit"];

/** Every door at which a consult is demanded, read by each hook that holds one so none keeps a second
 *  copy. Absent is the commit alone, what this did before the key; an empty list is the off switch. */
export const codexOwedOf = (codex) => {
  const given = codex?.owed;
  if (given === undefined || given === null) return { value: OWED_ABSENT, from: PLUGIN_DEFAULT };
  const listed = Array.isArray(given) && given.every((one) => typeof one === "string") ? given : null;
  const wrong = listed ? listed.filter((one) => !OWED_DOORS.includes(one)) : null;
  if (!listed || wrong.length) {
    return { value: OWED_ABSENT, from: PLUGIN_DEFAULT, unknown: wrong?.join(", ") || JSON.stringify(given) };
  }
  return { value: [...new Set(listed)], from: FROM_PROJECT };
};

export const codexOwed = () => codexOwedOf(projectCodex());

export const CHECK_MS_TAKES = "a whole number of milliseconds above 0";
/* Beside the key that overrides it and not beside the spawn it was handed to, so the reader that reports what resolved and the caller that enforces it read one number (BR-08). */
export const CHECK_MS_ABSENT = 300_000;

/** The check a project declares for the reviewer, with the clock it runs under: the command, the budget in milliseconds and where each was read. Null where the project declares no command, that being the case the reviewer is given no such tool at all rather than one with a default. The type is asked before the value, `Number` reading `true` as 1 and `[600000]` as 600000, and what the key will not take is carried stringified rather than cast, `""` and `[]` casting to nothing at all and a row naming nothing being the row a project that set the key legally would read (BR-14). */
/** The budget alone, the reader below reaching it only once a command is declared: a `checkMs` written on its own is judged by nobody until one is, so a write of that key asks this directly rather than through the reader that would pass over it. */
export const checkMsOf = (given) => {
  if (given === undefined || given === null) return { ms: CHECK_MS_ABSENT, msFrom: PLUGIN_DEFAULT };
  return typeof given === "number" && Number.isInteger(given) && given > 0
    ? { ms: given, msFrom: FROM_PROJECT }
    : { ms: CHECK_MS_ABSENT, msFrom: PLUGIN_DEFAULT, unknown: JSON.stringify(given) };
};

export const codexCheckOf = (codex) => {
  const command = codex?.check;
  if (!command || typeof command !== "string") return null;
  return { command, from: FROM_PROJECT, ...checkMsOf(codex?.checkMs) };
};

export const codexCheck = () => codexCheckOf(projectCodex());

export const FEEDBACK_CHANNELS = ["off", "bugs", "all"];
const FEEDBACK_DEFAULTS = { plugin: "bugs", project: "all" };

/** Each channel defaults on its own: a project naming one says nothing about the other. */
export const feedbackScope = once(() => Object.fromEntries(
  Object.entries(FEEDBACK_DEFAULTS).map(([which, fallback]) =>
    [which, chosen(forgeJson().parsed?.feedback?.[which], FEEDBACK_CHANNELS, fallback)]),
));

/* As written and by presence, an explicit `null` being a value: `guides/flow.mjs` reads both keys. */
const written = (key) => {
  const parsed = forgeJson().parsed;
  return parsed && Object.hasOwn(parsed, key)
    ? { value: parsed[key], from: FROM_PROJECT }
    : { value: undefined, from: PLUGIN_DEFAULT };
};

export const flowScope = once(() => written("flow"));

/** Where the project file every line above was read from actually is, or null where the search found none. A write to a project key takes this rather than building a path of its own: the search runs once per process and reaches a linked worktree's shared checkout, so a path composed from `cwd` at the moment of the write is a different file on exactly the trees a delegated run works in. */
export const projectFilePath = () => (forgeJson().root ? join(forgeJson().root, FROM_PROJECT) : null);

export const methodScope = once(() => written("method"));

export const DRAINS = ["dispatcher", "qa-master"];

/** Which master claims this project's issues at `developed`. A value outside the pair resolves to no master rather than to the default, nothing looking more like a project that chose the dispatcher than one whose key was misspelled; the tracker's own schema declares no key for this, which is why it is the project file's — docs/cli/doctor.md. */
export const drainScope = once(() => {
  const given = forgeJson().parsed?.drainedBy;
  const held = chosen(given, DRAINS, DRAINS[0]);
  const declared = given !== undefined && given !== null;
  return held.unknown === undefined ? { ...held, declared } : { ...held, value: null, declared };
});

export const LANDING_ROUTES = ["after-merge", "before-merge"];

export const landingScope = once(() =>
  chosen(forgeJson().parsed?.landing, LANDING_ROUTES, null, { absent: null }));

export const SHIP_MODES = ["self", "ready"];

/** Unmemoised: `forge doctor --ship` writes the option and reports it in the same process. */
export const shipMode = () => chosen(userConfig().ship, SHIP_MODES, SHIP_MODES[0], { source: configPath() });

export const RUNS_TAKES = "a whole number above 0";

// How many runs this project carries at once, whoever dispatched them: the width of a wave the dispatcher fills and the ceiling a gate of this project admits itself against, which are one number because they bound one thing. One ceiling over the project is not one allowance per master, so a session that cannot see another master's runs is bounded by what the project is already carrying rather than by this number afresh. The project's and not the machine's — ISS-1157 reverses ISS-917 on that, the user's decision on 2026-09-11 — so two checkouts on one box each answer for their own work, and neither inherits the other's. Absent it is null, and every reader then behaves as it did before the key existed.
export const runsOf = (given) => {
  if (given === undefined || given === null) return { value: null, from: PLUGIN_DEFAULT };
  const held = Number(given);
  return Number.isInteger(held) && held > 0
    ? { value: held, from: FROM_PROJECT }
    : { value: null, from: PLUGIN_DEFAULT, unknown: String(given) };
};

export const parallelRuns = () => runsOf(forgeJson().parsed?.runs);
