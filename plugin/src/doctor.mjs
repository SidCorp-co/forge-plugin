/* `forge doctor` — every finding at once, because "not configured" and "configured in the wrong
   file" look identical from inside one failing command. docs/FORGE-CLI.md. */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { CONFIG_PATH, configDir, readJson, saveConfig, userConfig } from "./resolve/config.mjs";
import { didYouMean } from "./suggest.mjs";
import { BUNDLED } from "./vi.mjs";
import { accountCredentials, fail, projectRoot, projectScope, translateScope } from "./resolve/settings.mjs";
import {
  MAX_CLAUDE_MD_LINES,
  checkClaims,
  checkStructure,
  checkerOwned,
  checkerRestated,
  readClaudeMd,
  reviewClaudeMd,
} from "./claude-md.mjs";
import { cloudflareAccounts } from "./cloudflare.mjs";
import { modelBehind, profile } from "./codex-api.mjs";
import { LOG_PATH, consults, logEntries } from "./codex-log.mjs";
import { flags } from "./resolve/flags.mjs";
import { VERB_NAMES } from "./resolve/visibility.mjs";

const VI_CONFIG = join(configDir("vi-natural"), "config.json");

const OK = "  ok  ";
const BAD = " miss ";
/* A finding doctor cannot resolve and the exit code must not gate on: prose it measured but cannot
   classify, and a guide belonging to the server rather than to this checkout. */
const NOTE = " note ";

const line = (mark, label, detail) => console.log(`[${mark}] ${label.padEnd(22)} ${detail}`);

/* Reports that each part resolved and from where, never the values: a credential fragment in a
   transcript is still a credential. `--full` is for a human holding two tokens. */
const masked = (token, full) => {
  const bare = token.replace(/^Bearer /u, "");
  if (!full) return `set (${bare.length} chars)`;
  return bare.length <= 12 ? "set" : `${bare.slice(0, 6)}…${bare.slice(-4)} (${bare.length} chars)`;
};

const viSetting = (field, envNames) => {
  if (envNames.some((name) => process.env[name])) return "from the environment";
  return readJson(VI_CONFIG)?.[field] ? VI_CONFIG : null;
};

/* Reported every run and, like cloudflare's, gating nothing by itself: the vi-natural skill
   translates a locale file with no tracker in sight. `translate` decides only whether the
   tracker's own writes wait on it. */
const checkVi = () => {
  const bundled = BUNDLED;
  const run = spawnSync(bundled, ["--help"], { encoding: "utf8" });
  if (run.error || run.status !== 0) {
    line(BAD, "vi-natural", `bundled copy will not run: ${run.error?.message ?? run.status}`);
    return false;
  }
  line(OK, "vi-natural", bundled);
  const url = viSetting("base_url", ["VI_NATURAL_BASE_URL", "MUSETOOLS_BASE_URL"]);
  if (url) line(OK, "vi-natural gateway", url);
  else line(BAD, "vi-natural gateway", "run `vi-natural login --base-url <url>` — there is no default host");
  const key = viSetting("api_key", ["VI_NATURAL_API_KEY", "MUSETOOLS_API_KEY"]);
  if (key) line(OK, "vi-natural key", key);
  else line(BAD, "vi-natural key", "run `vi-natural login --key <key>` — no issue can be posted");
  const model = viSetting("model", ["VI_NATURAL_MODEL"]);
  if (model) line(OK, "vi-natural model", model);
  else line(BAD, "vi-natural model", "run `vi-natural login --model <id>` — `vi-natural models` lists them");
  return Boolean(url && key && model);
};

/* Cloudflare's credentials are this machine's, not the tracker's, so they resolve and report here
   and gate nothing: every other verb works with none saved. */
const checkCloudflare = (full) => {
  const { accounts, from, problem } = cloudflareAccounts();
  if (problem) {
    line(BAD, "cloudflare", `half configured from the environment — ${problem}`);
    return;
  }
  if (!accounts.length) {
    line(BAD, "cloudflare", "no account — `forge cloudflare login --name n --account-id a --token t`");
    return;
  }
  const held = accounts.map((account) => `${account.name} ${masked(account.apiToken, full)}`);
  line(OK, "cloudflare", `${held.join(", ")}  ← ${from}`);
};

/* codex answers from a gateway of the user's own, over one HTTPS call, so it reports and gates
   nothing: a missing profile costs the second opinion and no verb. */
const checkCodex = () => {
  const { problem, values } = profile();
  if (problem) return line(BAD, "codex", `${problem} — \`forge codex\` cannot consult`);
  const model = modelBehind(values);
  if (!model) return line(BAD, "codex", "the profile maps that model slot to nothing");
  line(OK, "codex", `${model}  ${consults(logEntries()).length} consult(s) logged at ${LOG_PATH}`);
};

/* Declared is not callable — all 67 are declared to a PAT and six then refuse. Probed, read-only. */
const CAPABILITIES = [
  ["guides", "forge_guide", { action: "list" }, "the lifecycle rules an agent works from"],
  ["dependency graph", "forge_project_pm", { action: "graph" }, "blocks/relates edges"],
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
  for (const [label, tool, args, why] of CAPABILITIES) {
    const answer = await scoped(tool, args, true);
    const refusal = answer?.refused ? answer.refused.split("\n")[0] : null;
    findings[tool] = refusal;
    if (refusal) {
      gated += 1;
      line(BAD, label, `${tool} is declared but refuses: ${refusal} — ${why}`);
    } else {
      line(OK, label, `${tool} answers — ${why}`);
    }
  }
  remember(slug, findings);
  return { ...findings, gated };
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
  let broken = 0;
  for (const marker of review.overrides) {
    const where = `CLAUDE.md:${marker.line}`;
    if (marker.known) line(OK, "claude.md override", `${marker.slug} — ${marker.reason} (${where})`);
    else {
      broken += 1;
      line(BAD, "claude.md override", `${where} names no guide called ${marker.slug}`);
    }
  }
  for (const { slug, evidence } of review.misScoped) {
    line(NOTE, "guide scope", `${slug} is global and names ${evidence.join(", ")} — one project's tools`);
  }
  if (!review.overlaps.length) {
    line(OK, "claude.md", `${path} restates no guide`);
    return broken;
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
  return broken;
};

/* An override naming no guide waives nothing, so the exit code follows it. A pair doctor cannot
   classify does not: a check that stays red until someone edits prose gets switched off. */

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

/* Imprecise rather than dangling — the file exists, under another path. Volume is the reason this
   is a count: `port-plan.md` for `docs/port-plan.md` is worth one line, not twenty-nine. */
const reportStale = (stale) => {
  if (!stale.length) return;
  const shown = stale.slice(0, 3).join(", ");
  const rest = stale.length > 3 ? `, +${stale.length - 3} more` : "";
  line(NOTE, "claude.md stale path", `${shown}${rest} — exists, under another path`);
};

/* The published rules, not taste: code.claude.com/docs/en/memory gives the line target and the
   emphasis rule, docs/en/best-practices the include/exclude table. Only the two mechanical ones
   gate — a file legitimately has no deploy section, and "vague" is a reading. */
const reportStructure = (root, text) => {
  const found = checkStructure(text, root);
  let broken = 0;
  if (found.overLineTarget) {
    broken += 1;
    line(BAD, "claude.md size", `${found.lines} lines — target is under ${MAX_CLAUDE_MD_LINES}`);
  }
  for (const rel of found.brokenImports) {
    broken += 1;
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
  return broken;
};

const reportClaims = (root, text) => {
  const found = checkClaims(text, root);
  let broken = 0;
  for (const [key, label, why] of CLAIMS) {
    for (const name of found[key]) {
      broken += 1;
      line(BAD, label, `\`${name}\` ${why}`);
    }
  }
  reportStale(found.stalePaths);
  for (const { rule, line: at } of checkerOwned(text, root)) {
    line(NOTE, "claude.md restates", `\`${rule}\` has a checker (CLAUDE.md:${at})`);
  }
  if (!broken) line(OK, "claude.md claims", "every path, script, `-h`, ref and id it names is real");
  return broken;
};

/* Printed once, not per rule: the remedy is the same for all of them. */
const RESTATES = "\nA rule with a checker is documented by the checker's own message, which is what a\n" +
  "developer reads at the moment it fails. Delete the prose, or keep one line stating the invariant\n" +
  "behind it and no more — an explanation in two places diverges at the first correction.";

/* Reads the tree and nothing else, so it runs before the endpoint: a project with no Forge slug,
   or none at all, still gets its CLAUDE.md checked. */
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
  if (!found) return 0;
  const broken = reportStructure(root, found.text) + reportClaims(root, found.text);
  if (checkerOwned(found.text, root).length) console.log(RESTATES);
  reportRestated(checkerRestated(found.text, root));
  return broken;
};

/* The guide half, which needs the server. */
const checkAgainstGuides = async (scoped) => {
  const found = readClaudeMd(projectRoot());
  if (!found) return 0;
  return reportClaudeMd(reviewClaudeMd(found.text, await guideBodies(scoped)), found.path);
};

/* Lazy: the transport exits the process when credentials have not resolved. */
const checkEndpoint = async (full) => {
  const { refreshTools, projectId, scoped } = await import("./rpc.mjs");
  const declared = await refreshTools();
  line(OK, "tool surface", `${declared.length} declared in ${groups(declared)} groups`);
  const { value: slug } = projectScope();
  if (!slug) {
    console.log("\nNo project slug: capability probes are project-scoped and were skipped.");
    return 0;
  }
  const id = await projectId();
  line(OK, "project id", full ? id : `resolved from the slug (--full to print it)`);
  const findings = await probe(scoped, slug);
  const broken = findings.forge_guide ? 0 : await checkAgainstGuides(scoped);
  const gated = findings.gated;
  if (gated) {
    console.log(
      `\n${gated} declared capability(ies) refuse this credential. Declared is not callable —\n` +
        "recorded, so `forge tools`, `forge schema` and the usage list now withhold them.",
    );
  }
  return broken;
};

const install = (values) => {
  const written = saveConfig(values);
  console.log(`Saved ${Object.keys(values).join(" and ")} to ${written} (mode 0600).\n`);
};

const setVisibility = (verb, hide) => {
  if (!VERB_NAMES.includes(verb)) fail(didYouMean("verb", verb, VERB_NAMES));
  const withheld = new Set(userConfig().withheld ?? []);
  if (hide) withheld.add(verb);
  else withheld.delete(verb);
  saveConfig({ withheld: [...withheld] });
  console.log(`${verb} is now ${hide ? "withheld from" : "offered in"} the usage list.\n`);
};

export const doctor = async (rest) => {
  const { full, hide, show: reveal, ...values } = flags(rest, "doctor", ["--full"]);
  for (const key of Object.keys(values)) {
    if (!["token", "url"].includes(key)) {
      fail("Usage: forge doctor [--token <pat>] [--url <endpoint>] [--hide <verb>|--show <verb>] [--full]");
    }
  }
  if (hide) setVisibility(hide, true);
  if (reveal) setVisibility(reveal, false);
  if (Object.keys(values).length) install(values);

  const { url, token } = accountCredentials();
  if (url.value) line(OK, "endpoint url", `${url.value}  ← ${url.from}`);
  else line(BAD, "endpoint url", "no FORGE_MCP_URL, no saved url, no .mcp.json");
  if (token.value) line(OK, "token", `${masked(token.value, full)}  ← ${token.from}`);
  else line(BAD, "token", "run `forge doctor --token <pat>` to save one");

  const chosen = userConfig().withheld ?? [];
  if (chosen.length) line(OK, "withheld verbs", `${chosen.join(", ")} — \`forge doctor --show <verb>\``);
  const { value: slug, from } = projectScope();
  if (slug) line(OK, "project slug", `${slug}  ← ${from}`);
  else line(BAD, "project slug", "project-scoped calls will refuse; account-level ones still work");

  const language = translateScope();
  if (language.value === "vi") {
    line(OK, "prose language", `vi  ← ${language.from} — every title and body is rewritten`);
  } else if (language.value) {
    line(BAD, "prose language", `${language.value}  ← ${language.from} — vi is the only language this CLI writes; writes refuse`);
  } else {
    line(OK, "prose language", "as written; set translate in .forge.json to rewrite");
  }
  const vi = checkVi();
  const canWrite = language.value ? language.value === "vi" && vi : true;
  checkCloudflare(full);
  checkCodex();
  const local = checkClaudeMdLocally();

  if (!url.value || !token.value) {
    console.log("\nNot reaching the endpoint: the account half is incomplete.");
    process.exit(1);
  }
  const broken = local + (await checkEndpoint(full));
  if (full) console.log(`\nConfig file: ${CONFIG_PATH}`);
  if (broken) process.exit(1);
  /* Reads and writes differ here — `new` translates before it posts — and the exit code follows the
         stricter one. */
  if (!canWrite) process.exit(1);
};
