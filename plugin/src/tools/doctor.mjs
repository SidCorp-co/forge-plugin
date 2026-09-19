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
import { MACHINE_FLAGS, MACHINE_WRITES, WITH_BODY, WRITES } from "./doctor-keys.mjs";
import { backoff, retrySeconds } from "../tracker/rest.mjs";
import { deadlineSeconds, waitSeconds } from "../wire/request.mjs";
import { measured, offsetSaid } from "../wire/shared-clock.mjs";
import { BUNDLED } from "./vi.mjs";
import {
  Refusal, accountCredentials, checkoutRoot, fail, mcpForgeIgnored, projectScope, refusing,
  translateScope,
} from "../resolve/settings.mjs";
import { readClaudeMd, reviewClaudeMd } from "../checks/claude-md.mjs";
import { checkClaudeMdLocally, reportClaudeMd } from "./services/doctor/repo.mjs";
import { harnessLines } from "./services/doctor/harness.mjs";
import { installRows } from "./services/doctor/install.mjs";
import { copyRows, startRelease } from "./services/doctor/release.mjs";
import { withholdingLines } from "./services/doctor/jobs.mjs";
import { masked } from "./services/masked.mjs";
import { copyToRun, FROZEN } from "./plugin-copy.mjs";
import { stubRows } from "./services/skill-stubs.mjs";
import { rolesDiffer, rolesIn } from "./roles.mjs";
import { flags, helpAskedOf, partition, pullRepeated } from "../resolve/flags.mjs";
import { HOOKS_DIR, gateFile, hookEvent, hookNames, offNow, strandedSwitches } from "../hooks/hook-switch.mjs";
import { usageOf } from "../resolve/visibility.mjs";
import { GUIDE_TABLE, REVIEWED_AT, reviewGuideTable, supersededSlugs } from "../guides/guides.mjs";
import { FLOW_SLUGS, flowRefusal } from "../guides/flow.mjs";
import { rankLines } from "./services/doctor/rank.mjs";
import { SAYS, SUBJECT_SLUGS, USAGE as SUBJECT_USAGE } from "./services/doctor/subjects.mjs";
import { didYouMean } from "../suggest.mjs";
import {
  BAD, NOTE, OK, block, closing, line, missedHere, reading, report, shown, under,
} from "./services/doctor/showing.mjs";
import { held, projectKeyLines } from "./services/doctor/keys.mjs";
import { ORDER } from "../flow/earned.mjs";
import {
  addressed, contractParts, contractPath, contractProblems, flowProblems, identityOf, unansweredIn,
} from "../guides/contract.mjs";

const viConfig = () => join(configDir("vi-natural"), "config.json");

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
  under("serves");
  reportGuideTable(guides.map((guide) => guide.slug));
  under("repo");
  const found = readClaudeMd(checkoutRoot());
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
  under("brief");
  block(["", ...brief].join("\n"));
};

/** The one read left in this report that refuses through `fail()`, taken soft so it cannot: an exit here costs
 *  the report its project id, its probes, the guide table, the project's settings and the brief's goal list, with
 *  the reason on stderr — where a caller matching this report has only the lines that never came, and blames
 *  whatever it came for (ISS-891, AC-01-3-1). A refusal is a finding to print; a `TypeError` under it is this file's bug and stays a crash (3aa1cb, F1). */
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
  under("tracker");
  forgetProjects();
  const declared = served().map((row) => ({ name: row.tool }));
  line(OK, "rest base", `${restBase()}  ← derived from the endpoint url above, its trailing /mcp off`);
  line(OK, "route table", `${declared.length} route(s) over ${groups(declared)} tool(s)`);
  const { value: slug } = projectScope();
  if (!slug) {
    block("\nNo project slug: capability probes are project-scoped and were skipped.");
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
  line(measured() ? OK : NOTE, "tracker clock", offsetSaid());
  const findings = await probe(scoped, slug);
  if (!findings.forge_guide) await checkAgainstGuides(scoped);
  under("tracker");
  if (findings.gated) {
    block(
      `\n${findings.gated} declared capability(ies) refuse this credential. Declared is not callable —\n` +
        "recorded, so the usage list now withholds every verb that spends one of them.",
    );
  }
  under("project");
  await checkProject(credentials, findings.answered?.forge_project_pm ?? null);
};

const checkFlowKeys = () => {
  report(projectKeyLines());
  report(rankLines());
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
    value: `${deadlineSeconds()}s per attempt on the tracker, Cloudflare, Coolify and the chat backend, the ladder's four unchanged`,
    from: ownWait ? configPath() : "the plugin's default",
    unknown: waits === undefined || ownWait ? null : JSON.stringify(waits),
  };
  line(deadline.unknown ? BAD : OK, "deadline", held(deadline, ["a non-negative number of seconds"]));
};

const BOOLEAN = ["--full", "--credentials"];
/* The machine's, the checkout's and the project's, in one surface: `--set` and the brief's three
   are the project's half, and the keys doctor-keys.mjs writes this machine's. */
const PROJECT_FLAGS = ["set", "flow", "was", ...WRITES, ...WITH_BODY];

/** One write per call, then the report, because a run that asked to write is not asking to be
 *  diagnosed: the project's own writes print their lines and stop there. */
const wroteProject = async (asked, pairs, positionals) => {
  const { briefAsked, briefRoute, refuseCarried, refuseUnchecked, writeFlow, writeSetting } = await projectSettings();
  refuseUnchecked(asked);
  const brief = briefAsked(asked);
  if (asked.set !== undefined && asked.flow !== undefined) {
    fail("doctor: --set writes one key you name and --flow writes the flow with every key that flow "
      + "asks for, which are two answers to what this call writes. Send one of them.");
  }
  const key = asked.set ?? asked.flow;
  if (key !== undefined && brief) {
    fail("doctor: --set writes a key of the project's configuration and the brief's flags write the "
      + "brief, which are two resources and two calls. Send one of them.");
  }
  if (key !== undefined) {
    refuseCarried(asked, pairs, "--set writes one key of the project's configuration and takes neither.");
    return asked.set === undefined ? writeFlow(asked.flow) : writeSetting(asked.set);
  }
  return brief ? briefRoute(asked, pairs, positionals) : null;
};

export const doctor = async (argv) => {
  const usage = usageOf("doctor");
  const help = helpAskedOf(argv, SUBJECT_SLUGS);
  if (help) return console.log(help.subject ? SAYS[help.subject] : `${usage}\n${SUBJECT_USAGE}`);
  const subject = SUBJECT_SLUGS.includes(argv[0]) ? argv[0] : null;
  reading(subject);
  const { values: pairs, rest } = pullRepeated(subject ? argv.slice(1) : argv, "--meta", "doctor", { usage });
  const { positionals, flagArgv } = partition(rest, BOOLEAN, { verb: "doctor", usage });
  const asked = flags(flagArgv, "doctor", BOOLEAN, { usage, secret: ["--token", "--chatgpt-key"] });
  const { full, credentials } = asked;
  /* Two readings of one stray word, told apart by whitespace: a mistyped subject earns the nearest
     names, and a sentence is --line's prose, which no suggestion could be about. */
  if (positionals.length && asked.line === undefined) {
    const route = "and the prose of a line is --line's: forge doctor --line <n> <text>";
    fail(/\s/u.test(positionals[0])
      ? `doctor: \`${positionals[0]}\` names no flag, ${route}`
      : `doctor: ${didYouMean("doctor subject", positionals[0], SUBJECT_SLUGS)} A word here is a `
        + `subject to read, ${route}`);
  }
  /* The one flag that asks for a reading rather than writing one: a subject that never reaches the
     project's rows would drop it in silence, and an input is used or refused. */
  if (credentials && !shown("project")) {
    fail("doctor: --credentials prints the test credentials the project's own deploy rows withhold, "
      + "and this reading holds no project row. Send `forge doctor project --credentials`.");
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

  const release = shown("copy") ? startRelease() : null;
  under("machine");
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
  under("offer");
  report(withholdingLines());
  under("project");
  checkFlowKeys();
  under("machine");
  for (const { name, event } of offNow()) {
    line(OK, "hooks off", `${name} (${event}) — \`forge hooks --on ${name}\``);
  }
  for (const [variable, names] of Object.entries(envHeld())) {
    line(OK, "hooks off", `${names.join(", ")} — \`unset ${variable}\``);
  }
  for (const name of strandedSwitches()) {
    line(BAD, "hooks off", `${name} is switched off and is no hook here — \`forge hooks --on ${name}\``);
  }
  under("project");
  const { value: slug, from } = projectScope();
  if (slug) line(OK, "project slug", `${slug}  ← ${from}`);
  /* Not the miss the endpoint and the token are: only the scoped verbs refuse, and counting it
     would fail the run that just saved a working credential from outside any checkout. */
  else line(NOTE, "project slug", "project-scoped calls will refuse; account-level ones still work");

  const language = translateScope();
  if (language.value === "vi") {
    line(OK, "prose language", `vi  ← ${language.from} — every title and body is rewritten; set translate to off there to store prose as it is typed`);
  } else if (language.value) {
    line(BAD, "prose language", `${language.value}  ← ${language.from} — vi is the only language this CLI writes; writes refuse`);
  } else {
    line(OK, "prose language", "as written; set translate in .forge.json to rewrite");
  }
  /* Which copy `forge` on PATH is, from here — the answer changes with the directory, and the link
     itself names one copy for the whole machine. */
  under("copy");
  const dispatched = copyToRun();
  line(OK, "copy on PATH", `${dispatched.kind} ${dispatched.version ?? "?"} at ${dispatched.dir}`
    + ` — ${dispatched.why}`);
  const gating = copyToRun({ entry: join("hooks", "_hook.mjs") });
  line(OK, "copy the gates run", `${gating.kind} ${gating.version ?? "?"} at ${gating.dir}`
    + ` — ${gating.why}`);
  /* The two lines above say which copy answers a call; this one says what no call reaches. One reading, spent by the release step and by the gate that holds a write to any of them. */
  line(OK, "restart set", `${FROZEN.join(", ")} — a session keeps these as of its start, whatever `
    + "copy the lines above name");
  under("serves");
  report(stubRows(dispatched.installed));
  checkRoles(dispatched);
  checkContract();
  under("services");
  /* Reads and writes differ: `new` translates before it posts, and a read never asks. */
  checkVi(language.value === "vi");
  checkHarness(full);
  under("repo");
  report(installRows(checkoutRoot()));
  checkClaudeMdLocally();

  /* Below the work this overlaps and above the endpoint check: higher costs the report the whole round trip, lower drops the row on a box with no credential, which is the box least able to tell (ISS-1324). */
  under("copy");
  if (release) report(await copyRows(release));

  /* One read answers for five subjects, so it is spent where any of them prints and not one alone. */
  if (shown("tracker", "serves", "repo", "project", "brief")) {
    if (!url.value || !token.value) {
      for (const said of closing()) console.log(said);
      console.log("\nNot reaching the endpoint: the account half is incomplete.");
      process.exit(1);
    }
    await checkEndpoint(full, credentials);
  }
  under("machine");
  if (full) block(`\nConfig file: ${configPath()}`);
  for (const said of closing()) console.log(said);
  if (missedHere()) process.exit(1);
};

/* Its own `-h`: what a stale line means and which resource holds a key are read nowhere else. */
doctor.answersHelp = true;
