/* Where every setting comes from — never from an argument. Two scopes: the url and token are the
   ACCOUNT's, the slug and prose language the PROJECT's, so the slug is demanded lazily. Each
   resolves to `{ value, from }`, because provenance is what doctor reports. docs/cli/settings.md. */
import { existsSync } from "node:fs";
import { basename, dirname, isAbsolute, join, normalize, resolve } from "node:path";

import { checkoutAt } from "../git/checkout-at.mjs";
import { escaped } from "../markdown.mjs";
import { configDir, configPath, once, readJson, userConfig } from "./config.mjs";

/* Registered by a caller holding something no exit may lose — a body that arrived on stdin, or a
   line owed only once a write lands. Several, each dropped by the caller that registered it. */
const kept = [];

export const keepOnFailure = (text) => {
  const held = { text };
  kept.push(held);
  return () => {
    const at = kept.indexOf(held);
    if (at >= 0) kept.splice(at, 1);
  };
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
  for (const one of kept) console.error(one.text);
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

/** The name a checkout's own tracked project file carries. No key is read out of one: it is named
 *  here for the row that reports one standing in a checkout, and for the command that adopts it. */
export const COMMITTED_FILE = ".forge.json";

/* This machine's record of one project. `projects/` keeps the project namespace disjoint from
   forge's own: this configuration directory holds files and directories of forge's that grow with
   every feature storing something, and a checkout whose root folder matched one of their names
   would merge into it rather than be refused. The prefix is `forge` and not the project, because
   `~/.config/` is every application's and a checkout named `git`, `gh` or `codex` would land on
   theirs. */
const PROJECT_ENTRY = ["projects", "config.json"];

/** Which project a directory belongs to: the name of its REPOSITORY's root folder, so every linked
 *  worktree of one checkout answers alike and nothing has to be read to find what is to be read.
 *  The user's decision, 2026-09-17. The tracker slug stays a value inside the file and is not what
 *  finds it — a slug is readable only out of the very file this locates, so keying on it cannot
 *  start. Two checkouts whose root folders share a name share an entry, which is the accepted cost
 *  of every worktree of one checkout sharing one. */
const entryFor = (repository) => {
  const [under, file] = PROJECT_ENTRY;
  return repository === null
    ? null : join(configDir("forge"), under, basename(repository), file);
};

const projectEntryAt = (directory) => entryFor(checkoutAt(directory)?.repository ?? null);

/* Off the memoised walk rather than through the line above, which would walk the disk again on
   every read of every key; the configuration directory is read per call either way, so a home the
   caller sets reaches this without a previous call's home answering for it. */
export const projectFilePath = () => entryFor(standing()?.repository ?? null);

/** Where a project value was read from, which is what `forge doctor` prints after its arrow (BR-08).
 *  A directory belonging to no checkout has no such file, and the bare name is what a message about
 *  one of its keys names instead. */
export const fromProject = () => projectFilePath() ?? PROJECT_ENTRY.join("/");

const forgeJson = once(() => {
  const path = projectFilePath();
  return { parsed: path === null ? null : readJson(path) };
});

/* Where a committed file may be for it to be THIS checkout's: from here up to the checkout's own
   root and no further, plus the repository's root, which is the same place except in a linked
   worktree. The general walk goes to the filesystem root, and a repository nested inside another
   would find the outer project's file there — which the report would name as this checkout's and
   `--adopt` would then copy in as this project's configuration. Outside a checkout there is no root
   to stop at, so only the directory the call was made in can carry one. */
const committedRoots = () => {
  const here = standing();
  if (here === null) return [resolve(process.cwd())];
  const walked = [];
  for (let at = resolve(process.cwd()); ; at = dirname(at)) {
    walked.push(at);
    if (at === here.tree || dirname(at) === at) break;
  }
  /* A path reached through a symlink resolves to a tree this walk never passes, so the walk is
     discarded rather than trusted to the filesystem root: the two roots below certainly belong to
     this checkout, and nothing above them ever does. */
  const within = walked.includes(here.tree) ? walked : [here.tree];
  return [...new Set([...within, here.repository])];
};

/** A `.forge.json` standing in this checkout, or null. Nothing here reads a key out of it: this is
 *  the one reading that reports it, and the command that adopts it takes its contents whole. Found
 *  by standing there and not by parsing, because a file that does not parse is still a file a
 *  checkout carries, and one whose reader answered null read as no file at all — so the report said
 *  there was none and the adoption said there was nothing to take over. */
export const committedFileHere = once(() => {
  for (const root of committedRoots()) {
    const path = join(root, COMMITTED_FILE);
    if (existsSync(path)) return path;
  }
  return null;
});

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

export const projectScope = once(() => sourced(fromProject(), forgeJson().parsed?.slug));

/** The project's configuration a NAMED directory resolves to, whole, for a verb reading one checkout while standing in another: the same derivation, off that path rather than this process's, and null where that path is in no checkout. Whole rather than one key, since a reader of a second key would otherwise derive it again and could disagree with this one about which file is the project's. */
export const projectFileAt = (directory) => {
  const path = projectEntryAt(directory);
  return path === null ? null : readJson(path);
};

export const projectAt = (directory) => projectFileAt(directory)?.slug ?? null;

/* Where a project-scoped call GOES and in whose prose — the target's, not the caller's: docs/cli/feedback.md. */
let aimed = null;

export const useProject = ({ slug, from }) => {
  aimed = { value: slug, from };
};

export const projectTarget = () => aimed ?? projectScope();

/* Which paths, and which angles, are the checkout's answer: the account's covers every one. */
export const projectRecordPattern = () => sourced(fromProject(), forgeJson().parsed?.codex?.pathRe);

/** Whether a `codex.pathRe` source compiles with no flags, the way the consult's record pattern is
 *  compiled: the consult passes over one that does not, and a write of the key refuses exactly those. */
export const compiles = (source) => {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
};

/* No plugin default, and an unreadable pattern is no declaration: docs/two-levels.md, README. */
const declaredWork = (at) => (at ? projectFileAt(at)?.lease?.workingRe : forgeJson().parsed?.lease?.workingRe);

/* The source is given rather than assumed: a value read off a NAMED directory came out of that
   directory's record, and reporting this process's would name a file the value was never in — the
   provenance every reading of this configuration carries is the file that answered (BR-08). */
export const workPatternOf = (said, source = fromProject()) => {
  if (!said) return { value: null, from: null, unreadable: false };
  try {
    new RegExp(said, "u");
  } catch {
    return { value: null, from: source, unreadable: said };
  }
  return { value: said, from: source, unreadable: false };
};

export const projectWorkPattern = (at = null) =>
  workPatternOf(declaredWork(at), at ? projectEntryAt(at) : fromProject());
export const projectCodex = () => forgeJson().parsed?.codex ?? {};

/** Which CHECKOUT this process stands in — what a caller reading FILES off a root wants, and what
 *  `--git-common-dir` gets wrong in a worktree (ISS-1245). It answers whatever the walk answers,
 *  which since ISS-1403 is the whole of it: there is no second source to fall back to, a project's
 *  configuration being found by the repository rather than carried by the directory. */
export const checkoutRoot = once(() => standing()?.tree ?? null);

/* The slug is a header when there is one, and an error only for a call needing a project id. */
export const slugIfAny = () => projectTarget().value;

const adoptableHere = () => {
  const path = projectFilePath();
  return Boolean(path && !existsSync(path) && committedFileHere());
};

/** The one command that would put a slug where this call stands, or null where none would: a
 *  directory in no checkout has nowhere for a record to go, so both commands refuse there and
 *  neither is worth naming. Read here once because every message that offers a way out offers one
 *  of these two, and each one deciding for itself is another route that refuses when followed.
 *  Answered unquoted, each reading marking a command the way its own rows mark one: the report
 *  spans it, the undecided rows do not, and a quote baked in here would be a third spelling. */
export const ADOPT_ROUTE = "forge doctor --adopt";
export const SET_SLUG_ROUTE = "forge doctor --set slug=<project>";

export const slugRouteHere = () => {
  if (projectFilePath() === null) return null;
  return adoptableHere() ? ADOPT_ROUTE : SET_SLUG_ROUTE;
};

/** Which command puts a slug where this call would read one. A checkout standing on a `.forge.json`
 *  is given the command that takes the whole of it over rather than the one that writes this key:
 *  every other key of that file answers nothing here too, so one call settles all of them. */
const noProjectHere = () => {
  const path = projectFilePath();
  const held = committedFileHere();
  /* A directory in no checkout is not a project with nothing set yet: the record is keyed on a
     repository's root folder, so there is nowhere for one to go and neither command below could
     run here if it were typed. So neither is named, for the reason `projectRoute` gives. */
  if (path === null) {
    return "This call is project-scoped and this directory is in no checkout, so there is no\n"
      + `project for it to be scoped to.${held ? ` ${held} is read by nothing.` : ""}\n`
      + "Run it from inside a checkout.";
  }
  /* Named only where it could run, off the one reading of that below. */
  if (adoptableHere()) {
    return `This call is project-scoped and no project slug is set. ${held} is this checkout's own\n`
      + `and is read by nothing: a project's configuration is this machine's record of it, at\n${path}.\n`
      + `Take that file's contents over: \`${ADOPT_ROUTE}\``;
  }
  return "This call is project-scoped and no project slug is set. Run\n"
    + `\`${slugRouteHere()}\`, which writes it to this machine's record of this\n`
    + `project at\n${path}\n`
    + `— not the environment, and not a \`.mcp.json\` header.${held
      ? `\n${held} is this checkout's own and is read by nothing; this machine holds a record of this\n`
        + "project already, so it is not adopted over."
      : ""}`;
};

export const projectSlug = () => {
  const { value } = projectTarget();
  if (!value) fail(noProjectHere());
  return value;
};

/* A property of the tracker, not the CLI. Off by default: a wrong-language issue cannot be
   deleted, and a missing translation is an edit. */
export const translateScope = once(() => {
  const chosen = sourced(fromProject(), forgeJson().parsed?.translate);
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
    from: given ? fromProject() : "the built-in English default",
  };
});

export const rankConvention = once(() => sourced(fromProject(), forgeJson().parsed?.rank));

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
        + ` so the job declared under it is offered nowhere — rename it in ${fromProject()}`);
    } else if (!shape) {
      problems.push(`the \`${name}\` job is neither a list of verb names nor a table of \`verbs\` and`
        + ` \`skills\` that are each one, so it is offered nowhere — write it as one in ${fromProject()}`);
    } else {
      jobs[name] = shape;
    }
  }
  return { jobs, from: fromProject(), problems };
};

export const declaredJobs = () => jobsOf(forgeJson().parsed?.jobs);

export const projectReview = () => forgeJson().parsed?.review ?? {};
export const projectStop = () => forgeJson().parsed?.stop ?? {};
/** Which project of a saved Coolify instance this checkout is pinned to, written by `forge coolify
 *  pin` and read nowhere else: the checkout's own `.coolify.json` is not a source (ISS-1401). */
export const projectCoolify = () => forgeJson().parsed?.coolifyPin ?? {};

/* Where a project keeps its tests is its own decision and never a guess of this plugin's: a root
   written relative to the checkout, and a pattern matched against a file's own name, `*` standing for
   any run of characters and `?` for one. Both are demanded, since a list computed off either half
   guessed would be a built-in by another name (ISS-2503). */
const TESTS_TAKES = {
  root: "a directory relative to the checkout that stays inside it",
  pattern: "a file-name pattern with no slash in it, `*` and `?` its only wildcards",
};

const rootProblem = (given) => typeof given !== "string" || !given.trim() || isAbsolute(given)
  || normalize(given).split(/[\\/]/u)[0] === "..";

const patternProblem = (given) => typeof given !== "string" || !given.trim() || /[\\/]/u.test(given);

/** The first half of `tests` a reader cannot take, as `{ key, takes, given }`, or null: the write
 *  refuses on it and the reading reports it, so the two cannot disagree about what the key takes. */
export const testsProblem = (given) => {
  if (given === undefined) return null;
  if (!given || typeof given !== "object" || Array.isArray(given)) return { key: "tests", takes: "a table", given };
  if (given.root !== undefined && rootProblem(given.root)) return { key: "tests.root", takes: TESTS_TAKES.root, given: given.root };
  if (given.pattern !== undefined && patternProblem(given.pattern)) {
    return { key: "tests.pattern", takes: TESTS_TAKES.pattern, given: given.pattern };
  }
  return null;
};

const globRe = (pattern) => new RegExp(`^${[...pattern].map((one) => {
  if (one === "*") return ".*";
  if (one === "?") return ".";
  return escaped(one);
}).join("")}$`, "u");

/** The project's test files as it declared them: `root`, and `named` testing a file's own name;
 *  or `missing`, the halves it has not set; or `problem`, a value the file holds that the key does
 *  not take. */
const testsOf = (given) => {
  const problem = testsProblem(given);
  if (problem) return { problem, from: fromProject() };
  const missing = ["root", "pattern"].filter((one) => given?.[one] === undefined);
  if (missing.length) return { missing: missing.map((one) => `tests.${one}`), from: fromProject() };
  return { root: normalize(given.root), pattern: given.pattern, named: globRe(given.pattern), from: fromProject() };
};

export const projectTests = () => testsOf(forgeJson().parsed?.tests);

const PLUGIN_DEFAULT = "the plugin's default";

/** One shape for every keyed choice, so doctor and the guides' conditions read them all the same way, and the judgement with it: `unknown` is what this key will not take, which is what a write of that key refuses on rather than deciding for itself what the set is. */
export const chosen = (given, allowed, fallback, { source = fromProject(), absent = PLUGIN_DEFAULT } = {}) => {
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
  return { value: [...new Set(listed)], from: fromProject() };
};

export const codexOwed = () => codexOwedOf(projectCodex());

export const CHECK_MS_TAKES = "a whole number of milliseconds above 0";

/* The one figure here that no code can read for itself. A consult is spent inside one call of
   whatever tool asked for it, and an answer arriving after that call has ended is one the caller
   paid five model calls for and never sees; this is the foreground ceiling of the harness this
   plugin is called from, stated rather than discovered, and `codex.budgetMs` is what a caller able
   to wait longer than one such call declares instead (ISS-2108). */
const CALLER_CALL_MS = 600_000;

/** The whole clock one consult runs under. Every clock inside a consult is a share of this rather
 *  than a second number standing beside it, so a bound on any one part is read against the sum. */
export const budgetMs = () => Number(userConfig().codex?.budgetMs || CALLER_CALL_MS);

/** What a consult holds back from its check for the calls that follow it and the reply it streams.
 *  Measured rather than chosen: of the consults on the machine that raised ISS-2108 whose check was
 *  stopped at its clock, every one ran a further 55.9s to 117.9s past it, and those offered a check
 *  and not running one read a 99th centile of 166.9s for a whole consult. */
export const AROUND_CHECK_MS = 120_000;

/** The most a check may ever be given, which is what it has at a consult's first call. What it is
 *  handed at the call it is actually made on is that less what the consult has spent by then, and
 *  `codex/codex-tools.mjs` is where the two meet: a configuration is judged against this figure and
 *  never against the allowance one round happened to have left (BR-08). */
export const checkCeilingMs = () => budgetMs() - AROUND_CHECK_MS;

/** Where that ceiling came from, for the surfaces that print it, and what the key will take, for the
 *  write that refuses past it — the same arithmetic said the two ways its two readers need. */
export const CHECK_MS_SPARED = () => `what a consult can spare a check: its ${budgetMs() / 1000}s `
  + `budget less the ${AROUND_CHECK_MS / 1000}s after one`;
export const CHECK_MS_AT_MOST = () => `at most ${checkCeilingMs()}, ${CHECK_MS_SPARED()}`;

/** The budget alone, the reader below reaching it only once a command is declared: a `checkMs` written on its own is judged by nobody until one is, so a write of that key asks this directly rather than through the reader that would pass over it. The type is asked before the value, `Number` reading `true` as 1 and `[600000]` as 600000, and what the key will not take is carried stringified rather than cast, `""` and `[]` casting to nothing at all and a row naming nothing being the row a project that set the key legally would read (BR-14). `over` is the third answer and the one this key grew: a number of the shape it asks for that no consult can honour is an input written and then ignored wherever nothing says so, so the reader carries what was declared beside the ceiling that displaced it. */
export const checkMsOf = (given) => {
  const spared = { ms: checkCeilingMs(), msFrom: CHECK_MS_SPARED() };
  if (given === undefined || given === null) return spared;
  if (!(typeof given === "number" && Number.isInteger(given) && given > 0)) {
    return { ...spared, unknown: JSON.stringify(given) };
  }
  return given > spared.ms ? { ...spared, over: given } : { ms: given, msFrom: fromProject() };
};

/** The check a project declares for the reviewer, with the clock it runs under: the command, the most that clock may be in milliseconds and where each was read. Null where the project declares no command, that being the case the reviewer is given no such tool at all rather than one with a default. */

export const codexCheckOf = (codex) => {
  const command = codex?.check;
  if (!command || typeof command !== "string") return null;
  return { command, from: fromProject(), ...checkMsOf(codex?.checkMs) };
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
    ? { value: parsed[key], from: fromProject() }
    : { value: undefined, from: PLUGIN_DEFAULT };
};

export const flowScope = once(() => written("flow"));

/** The project file this process resolved, whole, for the one reading that asks which of its keys
 *  this project has NOT set. Every line above takes a single key out of the same document, and a
 *  second read of the file could disagree with them about which file is this project's. */
export const projectFileHere = () => {
  const parsed = forgeJson().parsed;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
};

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

export const RED_BATCH_KEY = "redBatch";
export const RED_BATCHES = ["attribute-then-split", "one-by-one"];

/** What a landing does with a set its combined gate refused: find the members at fault by what the
 *  failing cases read and by halves of the rest, landing the others as one candidate, or land every
 *  member alone as before ISS-2480. The PROJECT's, beside `landing` and `ship`, which describe the
 *  same landing; the first is the default because a red batch then costs a gate per round rather
 *  than one per member. */
export const redBatchScope = once(() => chosen(forgeJson().parsed?.redBatch, RED_BATCHES, RED_BATCHES[0]));

export const SHIP_MODES = ["self", "ready"];

/** Whether a run lands its own change or stops at a pushed branch and a landing checkpoint. The
 *  PROJECT's, beside `landing` and `drainedBy`, which describe the same landing this decides the
 *  existence of: two projects on one box may answer differently, and one value in the machine's own
 *  file answered for every checkout on it at once (ISS-2174). */
export const shipMode = once(() => chosen(forgeJson().parsed?.ship, SHIP_MODES, SHIP_MODES[0]));

export const ASK_MODES = ["off", "decide"];

/** Whether a question this project's sessions declare reversible may be decided without the owner.
 *  The PROJECT's and nobody else's, `off` where unset or unreadable, because this plugin runs in
 *  repositories whose owners have not decided: plugin/hooks/how/ask-decide.md. */
export const asksScope = once(() => chosen(forgeJson().parsed?.asks?.mode, ASK_MODES, ASK_MODES[0]));

/** The terms this project adds to the owner categories; anything but a list of strings adds none. */
export const asksOwnerTerms = once(() => {
  const given = forgeJson().parsed?.asks?.owner;
  return Array.isArray(given) ? given.filter((one) => typeof one === "string" && one.trim()).map((one) => one.trim()) : [];
});

/** The repository this process stands in, whose root folder names the project's entry. */
export const projectRepository = () => standing()?.repository ?? null;

/** A `ship` a release before that move left in the machine's own file, read to be reported ignored
 *  and by nothing that decides: honouring it as a fallback is the second layer the move removed, and
 *  dropping it in silence is a value somebody set and nothing tells them about. Presence and never
 *  truthiness, for that same reason: a key edited to `null` or to a blank is a line somebody wrote
 *  at a level that has stopped answering for it. */
export const shipLeftOnMachine = () => (Object.hasOwn(userConfig(), "ship")
  ? { present: true, value: userConfig().ship, from: configPath() }
  : { present: false, value: null, from: null });

export const PROJECT_SHAPES = ["storefront", "staged", "direct"];

/** What kind of project a checkout belongs to, which decides where work is exercised: a `storefront`
 *  keeps no repository and the store is its own source of truth, a `staged` project has a preview
 *  deployment somebody opens before live, and a `direct` project is live only, so preview IS this
 *  box. Declared and never inferred — every reader before this one guessed it from whether the
 *  tracker happened to hold a preview environment, and two runs in one checkout reached opposite
 *  answers (ISS-2190). Absent is no shape rather than a fourth behaviour: a run that cannot read
 *  which of the three it is standing in is owed silence, not a default somebody never chose. */
export const shapeScope = once(() =>
  chosen(forgeJson().parsed?.shape, PROJECT_SHAPES, null, { absent: null }));

export const RELEASE_MODES = ["auto", "manual"];

/** Whether a change of this project goes out without a person's look. The PROJECT's, beside `ship`,
 *  `landing` and `drainedBy`, and the one source the flow reads for it as of ISS-2190 — the tracker's
 *  `pipelineConfig.autoProdDeploy` answered it before, at a level a checkout cannot set and a level
 *  no local declaration could ever override. Absent here is not `manual`: `releaseFrom` in
 *  tracker/project-config.mjs decides what an absence resolves to, one level down, so that a project
 *  which has not spoken is moved by no upgrade of this plugin.
 *
 *  A NAMED directory is read the way `declaredWork` above reads one, and for the same reason: a
 *  reading aimed at another checkout takes the tracker half by slug and would otherwise take this
 *  half out of the file the shell happens to stand in, pairing one project's release model with
 *  another's switch. The source is that checkout's own file, never this process's (BR-08). */
export const releaseScope = (at = null) => chosen(
  at === null ? forgeJson().parsed?.release : projectFileAt(at)?.release,
  RELEASE_MODES, null, { absent: null, source: at === null ? fromProject() : `the project file under ${at}` },
);

export const RUNS_TAKES = "a whole number above 0";

// How many runs this project carries at once, whoever dispatched them: the width of a wave the dispatcher fills and the ceiling a gate of this project admits itself against, which are one number because they bound one thing. One ceiling over the project is not one allowance per master, so a session that cannot see another master's runs is bounded by what the project is already carrying rather than by this number afresh. The key is the PROJECT's — ISS-1157 reverses ISS-917 on that, the user's decision on 2026-09-11 — so two projects on one box each answer for their own work and neither inherits the other's; the file holding it is this MACHINE's, per ISS-1403, so two boxes carrying one project may differ. The two are one shape and neither reverses the other: the store is keyed on the project and kept on the device. Absent it is null, and every reader then behaves as it did before the key existed.
export const runsOf = (given) => {
  if (given === undefined || given === null) return { value: null, from: PLUGIN_DEFAULT };
  const held = Number(given);
  return Number.isInteger(held) && held > 0
    ? { value: held, from: fromProject() }
    : { value: null, from: PLUGIN_DEFAULT, unknown: String(given) };
};

export const parallelRuns = () => runsOf(forgeJson().parsed?.runs);
