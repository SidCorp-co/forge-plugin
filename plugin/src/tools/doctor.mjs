/* `forge doctor` — every finding at once, because "not configured" and "configured in the wrong
   file" look identical from inside one failing command. docs/cli/doctor.md. */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  INHERITED,
  configDir,
  configPath,
  readJson,
  saveConfig,
  sessionPath,
  sessionSourced,
  userConfig,
} from "../resolve/config.mjs";
import { MACHINE_FLAGS, MACHINE_WRITES } from "./doctor-keys.mjs";
import { backoff, retrySeconds } from "../tracker/rest.mjs";
import { deadlineSeconds, waitSeconds } from "../wire/request.mjs";
import { BUNDLED } from "./vi.mjs";
import {
  FEEDBACK_CHANNELS, LANDING_ROUTES, RUNS_TAKES, Refusal, SHIP_MODES, accountCredentials, fail,
  feedbackScope, landingScope, mcpForgeIgnored, parallelRuns, projectRoot, projectScope, refusing,
  shipMode, translateScope,
} from "../resolve/settings.mjs";
import {
  MAX_CLAUDE_MD_LINES,
  checkClaims,
  checkStructure,
  checkerOwned,
  checkerRestated,
  readClaudeMd,
  reviewClaudeMd,
} from "../checks/claude-md.mjs";
import { harnessLines } from "./services/doctor-harness.mjs";
import { masked } from "./services/masked.mjs";
import { copyToRun, FROZEN, pluginCopy } from "./plugin-copy.mjs";
import { rolesDiffer, rolesIn } from "./roles.mjs";
import { flags, partition, pullRepeated, wantsHelp } from "../resolve/flags.mjs";
import { HOOKS_DIR, gateFile, hookEvent, hookNames, offNow, strandedSwitches } from "../hooks/hook-switch.mjs";
import { usageOf } from "../resolve/visibility.mjs";
import { PROJECT_USAGE, WITH_BODY, WRITES } from "../tracker/project-flags.mjs";
import { GUIDE_TABLE, REVIEWED_AT, reviewGuideTable, supersededSlugs } from "../guides/guides.mjs";
import { FLOW_SLUGS, flowPinned, flowRefusal } from "../guides/flow.mjs";
import { ORDER } from "../flow/earned.mjs";
import {
  addressed, contractParts, contractPath, contractProblems, flowProblems, identityOf, unansweredIn,
} from "../guides/contract.mjs";

const viConfig = () => join(configDir("vi-natural"), "config.json");

const OK = "  ok  ";
/* Counted in `line`, so the level and the exit code cannot disagree (ISS-102). */
const BAD = " miss ";
/* Whose the finding is, never how bad: prose doctor cannot classify, a guide the server owns, a
   field of the tracker's own project no edit here clears, a credential no verb here waits on. A
   check that stays red until somebody else acts gets switched off. */
const NOTE = " note ";

let missed = 0;

const line = (mark, label, detail) => {
  if (mark === BAD) missed += 1;
  console.log(`[${mark}] ${label.padEnd(22)} ${detail}`);
};

/* One vocabulary for every row this report is handed, the project's and the harness's alike: a level the map does not carry is an `ok`, and `miss` is the one that reaches the exit code. Exported so the suite can hold it to being that one map rather than reading the marks back out of a report (ISS-102). */
export const LEVELS = { note: NOTE, miss: BAD };

const report = (rows) => {
  for (const row of rows) line(LEVELS[row.level] ?? OK, row.label, row.detail);
};

/* Which part resolved and from where, never the value: `--full` is for a human holding two tokens. */
/* The sentence rides on the row that answered: a table here keyed on those names is a second copy a
   new source would throw against. The level stays this file's, and the read mints nothing. */
const checkSession = () => {
  const { id, source, said } = sessionSourced();
  if (!id) {
    return line(OK, "session id", `none held yet — the next verb needing one mints it and saves it at ${sessionPath()}`);
  }
  return line(source === INHERITED ? NOTE : OK, "session id", `${id}  ← ${said}`);
};

/* A gate a switch of its own holds down, read from the gates: printing one undo while another
   switch still holds a hook is worse than printing nothing, and each of these is its own decision
   rather than a second answer to `hooksOff`. */
const envHeld = () => {
  const found = {};
  for (const name of hookNames()) {
    /* A gate's text is wherever gates/ keeps it; an entry with no gate, link-cli, is its own text. */
    let source = "";
    for (const path of [gateFile(name), join(HOOKS_DIR, `${name}.mjs`)]) {
      try {
        source = readFileSync(path, "utf8");
        break;
      } catch {
        source = "";
      }
    }
    if (!source) continue;
    for (const [, variable] of source.matchAll(/process\.env\.([A-Z_]+)\s*===\s*"1"/gu)) {
      if (process.env[variable] === "1") (found[variable] ??= []).push(`${name} (${hookEvent(name)})`);
    }
  }
  return found;
};

/* Reported every run and, like cloudflare's, gating nothing by itself: the vi-natural skill
   translates a locale file with no tracker in sight. `translate` decides whether the tracker's own
   writes wait on it, so it decides the level too. The bundled copy is this plugin's own file. */
const checkVi = (waited) => {
  const run = spawnSync(BUNDLED, ["--help"], { encoding: "utf8" });
  if (run.error || run.status !== 0) {
    line(BAD, "vi-natural", `bundled copy will not run: ${run.error?.message ?? run.status}`);
    return;
  }
  line(OK, "vi-natural", BUNDLED);
  const login = waited ? BAD : NOTE;
  const saved = readJson(viConfig()) ?? {};
  const held = (field) => Boolean(saved[field]);
  if (held("base_url")) line(OK, "vi-natural gateway", viConfig());
  else line(login, "vi-natural gateway", "run `vi-natural login --base-url <url>` — there is no default host");
  if (held("api_key")) line(OK, "vi-natural key", viConfig());
  else line(login, "vi-natural key", "run `vi-natural login --key <key>` — no issue can be posted");
  if (held("model")) line(OK, "vi-natural model", viConfig());
  else line(login, "vi-natural model", "run `vi-natural login --model <id>` — `vi-natural models` lists them");
};

const checkHarness = (full) => report(harnessLines(full));

/* Something saying no, against a fault of the moment: a dropped socket or a 5xx is one bad minute,
   and recorded as a gate it hides the verb from every run after it (codex F4). */
const SAYS_NO = /FORBIDDEN|UNAUTHORIZED|NOT_ALLOWED|no route|not enabled|not allowed|may not/u;

/** Gating on a refusal of that kind and on no other, for every probe rather than one. */
export const gatingRefusal = (answer) => {
  const said = answer?.refused ? answer.refused.split("\n")[0] : null;
  return said && SAYS_NO.test(said) ? said : null;
};

/* Declared is not callable — all 67 are declared to a PAT and six then refuse. Probed, read-only. */
const CAPABILITIES = [
  ["guides", "forge_guide", { action: "list" }, "the tracker's own lifecycle rules"],
  ["project pm", "forge_project_pm", { action: "graph" }, "the counts, the runner load and the edges"],
  ["knowledge", "forge_knowledge", { action: "list" }, "codebase context"],
  ["memory", "forge_memory.search", { query: "forge", topK: 1 }, "recall across sessions"],
];

const groups = (declared) =>
  new Set(declared.map((tool) => /forge_([a-z]+)/u.exec(tool.name)?.[1] ?? tool.name)).size;

/* Recorded per project with its date: a refusal was true once, not forever. */
const remember = (slug, findings) => {
  const capabilities = { ...(userConfig().capabilities ?? {}) };
  capabilities[slug] = { checkedAt: new Date().toISOString(), ...findings };
  saveConfig({ capabilities });
};

const probe = async (scoped, slug) => {
  const findings = {};
  let gated = 0;
  const answers = await Promise.all(CAPABILITIES.map(([, tool, args]) => scoped(tool, args, true)));
  for (const [index, [label, tool, , why, gate]] of CAPABILITIES.entries()) {
    const refusal = gatingRefusal(answers[index]);
    findings[gate?.key ?? tool] = refusal;
    if (refusal) {
      gated += 1;
      line(NOTE, label, `${tool} is declared but refuses: ${refusal} — ${why}`);
    } else {
      line(OK, label, `${tool} answers — ${why}`);
    }
  }
  remember(slug, findings);
  const answered = Object.fromEntries(CAPABILITIES.map(([, tool], index) => [tool, answers[index]]));
  return { ...findings, gated, answered };
};

/* Bodies are one call each and `list` carries none, so the twelve go out together. */
const guideBodies = async (scoped) => {
  const listed = (await scoped("forge_guide", { action: "list" }, true))?.guides ?? [];
  const fetched = await Promise.all(
    listed.map((guide) => scoped("forge_guide", { action: "get", slug: guide.slug }, true)),
  );
  return fetched.map((answer, index) => ({ slug: listed[index].slug, body: answer?.guide?.body ?? "" }));
};

/* The guide is the authority, so it is named first and the CLAUDE.md line second. Nothing here
   claims which of the two a pair is — the measurement is blind to negation, so a contradiction and
   a restatement score alike, and saying which would be a resolution it does not have. */
const reportClaudeMd = (review, path) => {
  for (const marker of review.overrides) {
    const where = `CLAUDE.md:${marker.line}`;
    if (marker.known) line(OK, "claude.md override", `${marker.slug} — ${marker.reason} (${where})`);
    else line(BAD, "claude.md override", `${where} names no guide called ${marker.slug}`);
  }
  for (const { slug, evidence } of review.misScoped) {
    line(NOTE, "guide scope", `${slug} is global and names ${evidence.join(", ")} — one project's tools`);
  }
  if (!review.overlaps.length) {
    line(OK, "claude.md", `${path} restates no guide`);
    return;
  }
  line(NOTE, "claude.md", `${review.overlaps.length} statement(s) a guide already owns — ${path}`);
  for (const hit of review.overlaps) {
    console.log(`      ${hit.score.toFixed(2)}  guide ${hit.slug}\n            ${hit.theirs}`);
    console.log(`            CLAUDE.md:${hit.line}\n            ${hit.ours}`);
  }
  console.log(
    "\nThe guide is the authority and the project file is the copy. Where the two agree, delete the\n" +
      "CLAUDE.md line and let the guide carry it; where the project means to differ, say so on that\n" +
      "line — `overrides: <guide-slug> — <why this project differs>` — and doctor stops asking.\n" +
      "This is a measure of shared wording, not of meaning: a restatement and a contradiction score\n" +
      "alike, and only reading the pair tells you which you have.",
  );
};

/* A claim about the repo is the kind that rots without anyone noticing, and the kind a command can
   settle. Measured over 28 real CLAUDE.md files; the shapes that produced only false positives —
   a CIDR block, a date mask, a bare extension, a git ref — are excluded before this runs. */
const CLAIMS = [
  ["missingPaths", "claude.md path", "names no such path, and no file of that name anywhere"],
  ["missingScripts", "claude.md script", "is in no package.json this project holds"],
  ["missingHelp", "claude.md -h", "is told to answer `-h`, and handles no such flag"],
  ["missingTools", "claude.md tool", "is told to answer `-h`, and is not on PATH"],
  ["missingRefs", "claude.md ref", "is a git ref that does not resolve here"],
  ["presentForbidden", "claude.md absence", "is said not to exist, and it does"],
  ["strandedShas", "claude.md sha", "is cited and is no ancestor of HEAD"],
  ["uncitedIdentifiers", "claude.md id", "is cited and is defined nowhere else in the repo"],
];

/* Imprecise rather than dangling — the file exists, under another path. Volume is the reason this is
   a count: port-plan.md for the read tree's `<project>/docs/port-plan.md` is one line, not twenty-nine. */
const reportStale = (stale) => {
  if (!stale.length) return;
  const shown = stale.slice(0, 3).join(", ");
  const rest = stale.length > 3 ? `, +${stale.length - 3} more` : "";
  line(NOTE, "claude.md stale path", `${shown}${rest} — exists, under another path`);
};

/* The published rules, not taste: code.claude.com/docs/en/memory gives the line target and the
   emphasis rule, docs/en/best-practices the include/exclude table. */
const reportStructure = (root, text) => {
  const found = checkStructure(text, root);
  if (found.overLineTarget) {
    line(BAD, "claude.md size", `${found.lines} lines — target is under ${MAX_CLAUDE_MD_LINES}`);
  }
  for (const rel of found.brokenImports) {
    line(BAD, "claude.md import", `@${rel} resolves to no file, and an import loads at launch`);
  }
  if (found.emphasisDiluted) {
    line(NOTE, "claude.md emphasis", `${found.emphasised} of ${found.bullets} bullets are bold — emphasise many and none stands out`);
  }
  if (found.vague.length) {
    line(NOTE, "claude.md vague", `${found.vague.join(", ")} — write what is concrete enough to verify`);
  }
  if (found.absentTopics.length) {
    line(NOTE, "claude.md covers", `nothing on ${found.absentTopics.join(", ")} — a gap to look at, not a fault`);
  }
};

const reportClaims = (root, text) => {
  const found = checkClaims(text, root);
  let named = 0;
  for (const [key, label, why] of CLAIMS) {
    for (const name of found[key]) {
      named += 1;
      line(BAD, label, `\`${name}\` ${why}`);
    }
  }
  reportStale(found.stalePaths);
  for (const { rule, line: at } of checkerOwned(text, root)) {
    line(NOTE, "claude.md restates", `\`${rule}\` has a checker (CLAUDE.md:${at})`);
  }
  if (named) console.log(CLAIM_REMEDY);
  else line(OK, "claude.md claims", "every path, script, `-h`, ref and id it names is real");
};

/* Printed once for the group: the move is the same whichever claim broke, and a report that names a
   defect without it leaves the reader to guess which of the two sides is wrong. */
const CLAIM_REMEDY = "\nA claim like these is read as fact by every session this file opens. Correct the claim, or\n"
  + "delete it — the file it names is the authority, and a claim it has outlived is worse than silence.";

/* Printed once, not per rule: the remedy is the same for all of them. */
const RESTATES = "\nA rule with a checker is documented by the checker's own message, which is what a\n" +
  "developer reads at the moment it fails. Delete the prose, or keep one line stating the invariant\n" +
  "behind it and no more — an explanation in two places diverges at the first correction.";

/* The comment is named first for the same reason the guide is: it is the authority, being what a
   developer reads at the moment the checker fires. */
const reportRestated = (hits) => {
  if (!hits.length) return;
  line(NOTE, "claude.md comment", `${hits.length} statement(s) a comment already owns`);
  for (const hit of hits) {
    console.log(`      ${hit.score.toFixed(2)}  ${hit.where}\n            ${hit.theirs}`);
    console.log(`            CLAUDE.md:${hit.line}\n            ${hit.ours}`);
  }
  console.log(
    "\nDelete the CLAUDE.md line and let the comment carry it. Where both copies have to exist, put\n" +
      "`restated: deliberate — <why>` above the comment and this stops asking.",
  );
};

const checkClaudeMdLocally = () => {
  const root = projectRoot();
  const found = readClaudeMd(root);
  if (!found) return;
  reportStructure(root, found.text);
  reportClaims(root, found.text);
  if (checkerOwned(found.text, root).length) console.log(RESTATES);
  reportRestated(checkerRestated(found.text, root));
};

/* Whether an unknown guide contradicts the contract is a read and not a check: contradiction is
   meaning, and the one mechanical signal here is the slug. So a retired row is a finding and a
   guide the table has never seen is a note saying so. The replacements the rows name are checked by
   the suite instead, where this repository's own documents are on disk to resolve against. */
const reportGuideTable = (served) => {
  const { retired, unreviewed } = reviewGuideTable({ served });
  for (const slug of retired) {
    line(BAD, "guide table", `${slug} has a row in src/guides/guides.mjs and the tracker no longer`
      + " serves it — drop the row, in the change that notices");
  }
  for (const slug of unreviewed) {
    line(NOTE, "guide table", `${slug} is new since ${REVIEWED_AT}: whether it contradicts the`
      + " contract is a read nobody has made");
  }
  if (!retired.length) {
    line(OK, "guide table", `${GUIDE_TABLE.length} disposition(s), every slug still served`);
  }
};

/* The rules that are not code travel inside the plugin, so a copy without them is a copy whose every
   route to them is a dead end — which is what an installed copy was before ISS-78. */
/* Reports and never refuses: a flow deliberately without a part is allowed and `stageLine` degrades gracefully for one, so this is here for the flow accidentally without it, at the moment a set is chosen rather than the moment a run reaches for the part. */
const reportFlowSets = () => {
  for (const flow of FLOW_SLUGS) {
    const entries = contractParts({ flow });
    if (entries === null) continue;
    const absent = unansweredIn(addressed(entries), ORDER);
    const said = absent.length
      ? `leaves ${absent.join(", ")} unanswered, which \`stageLine\` says at the call`
      : "every stage of the ladder answered";
    line(absent.length ? NOTE : OK, "flow set", `${flow}: ${entries.length} part(s) — ${said}`);
  }
};

const checkContract = () => {
  const refused = flowRefusal();
  if (refused) return line(BAD, "contract", refused);
  const wrong = contractProblems({});
  for (const said of wrong) {
    line(BAD, "contract", `${said} — install the plugin again for a whole copy`);
  }
  if (wrong.length) return;
  const path = contractPath();
  for (const said of flowProblems()) line(BAD, "contract", said);
  line(OK, "contract", `${path} states contract ${identityOf(contractParts({}))} — \`forge guide contract\``);
  reportFlowSets();
};

/* The guide half, which needs the server. */
const checkAgainstGuides = async (scoped) => {
  const guides = await guideBodies(scoped);
  reportGuideTable(guides.map((guide) => guide.slug));
  const found = readClaudeMd(projectRoot());
  if (!found) return;
  const review = reviewClaudeMd(found.text, guides, { superseded: supersededSlugs() });
  reportClaudeMd(review, found.path);
};

/* The two copy lines' question, for the half a dispatcher acts on: which names resolve. A note for
   the reason the copy line above it is one — a checkout ahead of its install is ordinary here. */
const checkRoles = (dispatched) => {
  const here = rolesIn();
  const loaded = rolesIn(dispatched.dir);
  if (!here.length && !loaded.length) return line(NOTE, "roles", "this plugin ships none to dispatch through");
  line(OK, "roles", `${loaded.length ? loaded.join(", ") : "none"}  ← ${dispatched.dir}`);
  const said = rolesDiffer(here, loaded);
  if (!said) return;
  const parts = [
    said.missing.length && `${said.missing.join(", ")} is here and not there, so a dispatch naming it refuses`,
    said.extra.length && `${said.extra.join(", ")} is there and not here`,
  ].filter(Boolean);
  line(NOTE, "roles", `${parts.join("; ")} — \`claude plugin update\` then restart`);
};

/* The project's own record, under the names its owner uses rather than the tracker's columns, and
   in this report rather than under a verb named for the project: one surface reports every level of
   configuration with its source, and the project is a level of it. */
const projectSettings = () => import("./project-settings.mjs");

const checkProject = async (credentials, graph = null) => {
  const { projectReport } = await projectSettings();
  const { rows, brief } = await projectReport({ credentials, graph });
  report(rows);
  if (!brief.length) return;
  console.log("");
  for (const said of brief) console.log(said);
};

/** The one read left in this report that refuses through `fail()`, taken soft so it cannot: an exit
 *  here costs the report its project id, its probes, the guide table, the project's settings and the
 *  brief's goal list, with the reason on stderr — where a caller matching this report has only the
 *  lines that never came, and blames whatever it came for (ISS-891, AC-01-3-1). A refusal is a
 *  finding to print; a `TypeError` under it is this file's bug and stays a crash (3aa1cb, F1). */
export const trackerId = async (projectId) => {
  try {
    return { id: await refusing(projectId) };
  } catch (error) {
    if (!(error instanceof Refusal)) throw error;
    return { refused: error.message.split("\n")[0] };
  }
};

const checkEndpoint = async (full, credentials) => {
  const { forgetProjects, projectId, restBase, scoped } = await import("../tracker/rest.mjs");
  const { served } = await import("../tracker/routes.mjs");
  forgetProjects();
  const declared = served().map((row) => ({ name: row.tool }));
  line(OK, "rest base", `${restBase()}  ← derived from the endpoint url above, its trailing /mcp off`);
  line(OK, "route table", `${declared.length} route(s) over ${groups(declared)} tool(s)`);
  const { value: slug } = projectScope();
  if (!slug) {
    console.log("\nNo project slug: capability probes are project-scoped and were skipped.");
    return;
  }
  const held = await trackerId(projectId);
  /* Neutral about which half: a dead host and a slug the tracker holds no project for both refuse
     here, and the refusal's own words are what tells them apart (consult 3aa1cb, F2). */
  if (held.refused) {
    return line(BAD, "tracker", `${restBase()} did not answer for this project, so nothing below `
      + `this line was read — ${held.refused}. Check \`endpoint url\` and \`project slug\` above`);
  }
  line(OK, "project id", full ? held.id : `resolved from the slug (--full to print it)`);
  const clock = await import("../wire/shared-clock.mjs");
  line(clock.measured() ? OK : NOTE, "tracker clock", clock.offsetSaid());
  const findings = await probe(scoped, slug);
  if (!findings.forge_guide) await checkAgainstGuides(scoped);
  if (findings.gated) {
    console.log(
      `\n${findings.gated} declared capability(ies) refuse this credential. Declared is not callable —\n` +
        "recorded, so the usage list now withholds every verb that spends one of them.",
    );
  }
  await checkProject(credentials, findings.answered?.forge_project_pm ?? null);
};

/* This is the surface allowed to say what a project or a machine turned off, so each key prints its
   value and where it was read; a value the key does not take is named here and nowhere else. */
const held = (one, allowed) =>
  (one.unknown ? `${one.unknown} is no value of this key — it takes ${allowed.join(", ")}; reading ${one.value}  ← ${one.from}`
    : `${one.value}  ← ${one.from}`);

const checkFlowKeys = () => {
  for (const [which, one] of Object.entries(feedbackScope())) {
    line(one.unknown ? BAD : OK, `feedback.${which}`, held(one, FEEDBACK_CHANNELS));
  }
  const flow = flowPinned();
  const refused = flowRefusal();
  if (refused) line(BAD, "flow", refused);
  else if (flow.retired) {
    line(BAD, "flow", `${flow.value}, read off the retired \`method: ${flow.retired}\``
      + `  ← ${flow.from}. Set \`flow\` instead`);
  } else line(OK, "flow", `${flow.value}  ← ${flow.from}`);
  const landing = landingScope();
  if (landing.unknown) line(BAD, "landing", held({ ...landing, value: "the derived route" }, LANDING_ROUTES));
  else if (landing.value) line(OK, "landing", `${landing.value}  ← ${landing.from}`);
  else line(OK, "landing", "unset, so the branches on the tracker's record derive where the merge sits");
  const ship = shipMode();
  line(ship.unknown ? BAD : OK, "ship", held(ship, SHIP_MODES));
  const runs = parallelRuns();
  if (runs.unknown) line(BAD, "parallel runs", held({ ...runs, value: "no bound" }, [RUNS_TAKES]));
  else if (runs.value) line(OK, "parallel runs", `${runs.value}  ← ${runs.from}`);
  else line(OK, "parallel runs", "unset, so a wave is sized by whoever dispatches it and a gate declines for no sibling");
  const given = userConfig().retrySeconds;
  const own = retrySeconds({ retrySeconds: given }) === given;
  const retry = {
    value: `${backoff(1)}s first, doubling under 60s`,
    from: own ? configPath() : "the plugin's default",
    unknown: given === undefined || own ? null : JSON.stringify(given),
  };
  line(retry.unknown ? BAD : OK, "retry", held(retry, ["a non-negative number of seconds"]));
  const waits = userConfig().waitSeconds;
  const ownWait = waitSeconds({ waitSeconds: waits }) === waits;
  const deadline = {
    value: `${deadlineSeconds()}s per attempt, the ladder's four unchanged`,
    from: ownWait ? configPath() : "the plugin's default",
    unknown: waits === undefined || ownWait ? null : JSON.stringify(waits),
  };
  line(deadline.unknown ? BAD : OK, "deadline", held(deadline, ["a non-negative number of seconds"]));
};

const BOOLEAN = ["--full", "--credentials"];
/* The machine's, the checkout's and the project's, in one surface: `--set` and the brief's three
   are the project's half, and the keys doctor-keys.mjs writes this machine's. */
const PROJECT_FLAGS = ["set", ...WRITES, ...WITH_BODY];

/** One write per call, then the report, because a run that asked to write is not asking to be
 *  diagnosed: the project's own writes print their lines and stop there. */
const wroteProject = async (asked, pairs, positionals) => {
  const { briefAsked, briefRoute, refuseCarried, writeSetting } = await projectSettings();
  const brief = briefAsked(asked);
  if (asked.set !== undefined && brief) {
    fail("doctor: --set writes a key of the project's configuration and the brief's flags write the "
      + "brief, which are two resources and two calls. Send one of them.");
  }
  if (asked.set !== undefined) {
    refuseCarried(asked, pairs, "--set writes one key of the project's configuration and takes neither.");
    return writeSetting(asked.set);
  }
  return brief ? briefRoute(asked, pairs, positionals) : null;
};

export const doctor = async (argv) => {
  const usage = usageOf("doctor");
  if (wantsHelp(argv)) return console.log(`${usage}\nwhat resolves, and from where.\n${PROJECT_USAGE}`);
  const { values: pairs, rest } = pullRepeated(argv, "--meta", "doctor", { usage });
  const { positionals, flagArgv } = partition(rest, BOOLEAN, { verb: "doctor", usage });
  const asked = flags(flagArgv, "doctor", BOOLEAN, { usage, secret: ["--token", "--chatgpt-key"] });
  const { full, credentials } = asked;
  if (positionals.length && asked.line === undefined) {
    fail(`doctor: \`${positionals[0]}\` names no flag, and the prose of a line is --line's: `
      + "forge doctor --line <n> <text>");
  }
  /* Two stores: the project write returns before the report, dropping the machine's half silently. */
  const machine = MACHINE_FLAGS.filter((key) => asked[key] !== undefined);
  const project = PROJECT_FLAGS.filter((key) => asked[key] !== undefined);
  if (project.length && machine.length) {
    fail(`doctor: \`--${project[0]}\` writes the project's own record and \`--${machine[0]}\` writes this `
      + "machine's, which are two stores and two calls. Nothing was sent: send one of them.");
  }
  const wrote = await wroteProject(asked, pairs, positionals);
  if (wrote) return wrote.forEach((said) => console.log(said));
  for (const row of MACHINE_WRITES) {
    if (row.flags.some((flag) => asked[flag] !== undefined)) row.write(asked);
  }

  const { url, token } = accountCredentials();
  if (url.value) line(OK, "endpoint url", `${url.value}  ← ${url.from}`);
  else line(BAD, "endpoint url", "nothing saved — `forge doctor --url <endpoint>`");
  if (token.value) line(OK, "token", `${masked(token.value, full)}  ← ${token.from}`);
  else line(BAD, "token", "run `forge doctor --token <pat>` to save one");
  checkSession();

  const stale = mcpForgeIgnored();
  /* Each half is named separately: a project whose credentials are already saved and whose slug
     still sits in that header loses only its project scope, and only one command fixes it. */
  if (stale?.credentials || stale?.slug) {
    const fix = [
      stale.credentials && "`forge doctor --token <pat> --url <endpoint>`",
      stale.slug && '`{ "slug": "<project>" }` in a .forge.json',
    ].filter(Boolean);
    line(BAD, "mcp.json", `${join(stale.root, ".mcp.json")} carries settings this CLI does not read`
      + ` — ${fix.join(", and ")}`);
  }
  const chosen = userConfig().withheld ?? [];
  if (chosen.length) line(OK, "withheld verbs", `${chosen.join(", ")} — \`forge doctor --show <verb>\``);
  checkFlowKeys();
  for (const { name, event } of offNow()) {
    line(OK, "hooks off", `${name} (${event}) — \`forge hooks --on ${name}\``);
  }
  for (const [variable, names] of Object.entries(envHeld())) {
    line(OK, "hooks off", `${names.join(", ")} — \`unset ${variable}\``);
  }
  for (const name of strandedSwitches()) {
    line(BAD, "hooks off", `${name} is switched off and is no hook here — \`forge hooks --on ${name}\``);
  }
  const { value: slug, from } = projectScope();
  if (slug) line(OK, "project slug", `${slug}  ← ${from}`);
  /* Not the miss the endpoint and the token are: only the scoped verbs refuse, and counting it
     would fail the run that just saved a working credential from outside any checkout. */
  else line(NOTE, "project slug", "project-scoped calls will refuse; account-level ones still work");

  const language = translateScope();
  if (language.value === "vi") {
    line(OK, "prose language", `vi  ← ${language.from} — every title and body is rewritten`);
  } else if (language.value) {
    line(BAD, "prose language", `${language.value}  ← ${language.from} — vi is the only language this CLI writes; writes refuse`);
  } else {
    line(OK, "prose language", "as written; set translate in .forge.json to rewrite");
  }
  const copy = pluginCopy();
  if (copy && !copy.stale) line(OK, "plugin copy", `${copy.running} — running and installed`);
  else if (copy) {
    line(NOTE, "plugin copy", `${copy.running} here, ${copy.installed} installed — a session keeps the `
      + "registration it started with: `claude plugin update` then restart");
  }
  /* Which copy `forge` on PATH is, from here — the answer changes with the directory, and the link
     itself names one copy for the whole machine. */
  const dispatched = copyToRun();
  line(OK, "copy on PATH", `${dispatched.kind} ${dispatched.version ?? "?"} at ${dispatched.dir}`
    + ` — ${dispatched.why}`);
  const gating = copyToRun({ entry: join("hooks", "_hook.mjs") });
  line(OK, "copy the gates run", `${gating.kind} ${gating.version ?? "?"} at ${gating.dir}`
    + ` — ${gating.why}`);
  /* The two lines above say which copy answers a call; this one says what no call reaches. One reading, spent by the release step and by the gate that holds a write to any of them. */
  line(OK, "restart set", `${FROZEN.join(", ")} — a session keeps these as of its start, whatever `
    + "copy the lines above name");
  checkRoles(dispatched);
  checkContract();
  /* Reads and writes differ: `new` translates before it posts, and a read never asks. */
  checkVi(language.value === "vi");
  checkHarness(full);
  checkClaudeMdLocally();

  if (!url.value || !token.value) {
    console.log("\nNot reaching the endpoint: the account half is incomplete.");
    process.exit(1);
  }
  await checkEndpoint(full, credentials);
  if (full) console.log(`\nConfig file: ${configPath()}`);
  if (missed) process.exit(1);
};

/* Its own `-h`: what a stale line means and which resource holds a key are read nowhere else. */
doctor.answersHelp = true;
