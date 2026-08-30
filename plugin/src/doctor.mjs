/* `forge doctor` — every finding at once, because "not configured" and "configured in the wrong
   file" look identical from inside one failing command. docs/FORGE-CLI.md. */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { CONFIG_PATH, configDir, readJson, saveConfig, userConfig } from "./resolve/config.mjs";
import { didYouMean } from "./suggest.mjs";
import { BUNDLED } from "./vi.mjs";
import { accountCredentials, fail, projectScope, translateScope } from "./resolve/settings.mjs";
import { flags } from "./resolve/flags.mjs";
import { VERB_NAMES } from "./resolve/visibility.mjs";

const VI_CONFIG = join(configDir("vi-natural"), "config.json");

const OK = "  ok  ";
const BAD = " miss ";

const line = (mark, label, detail) => console.log(`[${mark}] ${label.padEnd(22)} ${detail}`);

/* Reports that each part resolved and from where, never the values: a credential fragment in a
   transcript is still a credential. `--full` is for a human holding two tokens. */
const masked = (token, full) => {
  const bare = token.replace(/^Bearer /u, "");
  if (!full) return `set (${bare.length} chars)`;
  return bare.length <= 12 ? "set" : `${bare.slice(0, 6)}…${bare.slice(-4)} (${bare.length} chars)`;
};

const hasViKey = () => {
  if (process.env.VI_NATURAL_API_KEY || process.env.MUSETOOLS_API_KEY) {
    return "from the environment";
  }
  return readJson(VI_CONFIG)?.api_key ? VI_CONFIG : null;
};

const checkVi = () => {
  const bundled = BUNDLED;
  const run = spawnSync(bundled, ["--help"], { encoding: "utf8" });
  if (run.error || run.status !== 0) {
    line(BAD, "vi-natural", `bundled copy will not run: ${run.error?.message ?? run.status}`);
    return false;
  }
  line(OK, "vi-natural", bundled);
  const key = hasViKey();
  if (key) line(OK, "vi-natural key", key);
  else line(BAD, "vi-natural key", "run `vi-natural login --key <key>` — no issue can be posted");
  return Boolean(key);
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
  return gated;
};

/* Lazy: the transport exits the process when credentials have not resolved. */
const checkEndpoint = async (full) => {
  const { refreshTools, projectId, scoped } = await import("./rpc.mjs");
  const declared = await refreshTools();
  line(OK, "tool surface", `${declared.length} declared in ${groups(declared)} groups`);
  const { value: slug } = projectScope();
  if (!slug) {
    console.log("\nNo project slug: capability probes are project-scoped and were skipped.");
    return;
  }
  const id = await projectId();
  line(OK, "project id", full ? id : `resolved from the slug (--full to print it)`);
  const gated = await probe(scoped, slug);
  if (gated) {
    console.log(
      `\n${gated} declared capability(ies) refuse this credential. Declared is not callable —\n` +
        "recorded, so `forge tools`, `forge schema` and the usage list now withhold them.",
    );
  }
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
  const canWrite = language.value ? language.value === "vi" && checkVi() : true;

  if (!url.value || !token.value) {
    console.log("\nNot reaching the endpoint: the account half is incomplete.");
    process.exit(1);
  }
  await checkEndpoint(full);
  if (full) console.log(`\nConfig file: ${CONFIG_PATH}`);
  /* Reads and writes differ here — `new` translates before it posts — and the exit code follows the
         stricter one. */
  if (!canWrite) process.exit(1);
};
