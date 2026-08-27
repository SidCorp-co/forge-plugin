/* `forge doctor` — what resolves, where each part came from, and whether the endpoint answers.

   Every other verb fails at the first missing piece and tells you about that one. Doctor is the
   opposite: it reports all of them at once, because "no credentials" and "credentials from the
   wrong file" look identical from inside a single failing command. It also installs the account
   half, since the fix for the commonest finding is to write a token somewhere private. */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { CONFIG_PATH, saveConfig } from "./config.mjs";
import { accountCredentials, fail, projectScope, translateTo } from "./settings.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const VI_CONFIG = join(
  process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
  "vi-natural",
  "config.json",
);

const OK = "  ok  ";
const BAD = " miss ";

const line = (mark, label, detail) => console.log(`[${mark}] ${label.padEnd(22)} ${detail}`);

/* Enough of the token to recognise which one it is, never enough to use. */
const masked = (token) => {
  const bare = token.replace(/^Bearer /u, "");
  if (bare.length <= 12) return "set";
  return `${bare.slice(0, 6)}…${bare.slice(-4)} (${bare.length} chars)`;
};

const hasViKey = () => {
  if (process.env.VI_NATURAL_API_KEY || process.env.MUSETOOLS_API_KEY) {
    return "from the environment";
  }
  try {
    return JSON.parse(readFileSync(VI_CONFIG, "utf8")).api_key ? VI_CONFIG : null;
  } catch {
    return null;
  }
};

const checkVi = () => {
  const bundled = join(HERE, "..", "bin", "vi-natural");
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

/* A tool appearing in `tools/list` says nothing about whether this credential may call it — every
   one of the 67 is declared to a PAT and `forge_project_pm` then refuses all six of its actions.
   An external agent reads the list and reasonably assumes otherwise, so the capabilities it needs
   to work correctly are probed rather than counted. Read-only, one call each. */
const CAPABILITIES = [
  ["guides", "forge_guide", { action: "list" }, "the lifecycle rules an agent works from"],
  ["dependency graph", "forge_project_pm", { action: "graph" }, "blocks/relates edges"],
  ["knowledge", "forge_knowledge", { action: "list" }, "codebase context"],
  ["memory", "forge_memory.search", { query: "forge", topK: 1 }, "recall across sessions"],
];

const groups = (declared) =>
  new Set(declared.map((tool) => /forge_([a-z]+)/u.exec(tool.name)?.[1] ?? tool.name)).size;

const probe = async (scoped) => {
  let gated = 0;
  for (const [label, tool, args, why] of CAPABILITIES) {
    const answer = await scoped(tool, args, true);
    if (answer?.refused) {
      gated += 1;
      line(BAD, label, `${tool} is declared but refuses: ${answer.refused.split("\n")[0]} — ${why}`);
    } else {
      line(OK, label, `${tool} answers — ${why}`);
    }
  }
  return gated;
};

/* Imported lazily: reaching the endpoint is the one check that needs credentials to already have
   passed, and the transport exits the process when they have not. */
const checkEndpoint = async () => {
  const { tools, projectId, scoped } = await import("./rpc.mjs");
  const declared = await tools();
  line(OK, "tool surface", `${declared.length} declared in ${groups(declared)} groups`);
  const { slug } = projectScope();
  if (!slug) {
    console.log("\nNo project slug: capability probes are project-scoped and were skipped.");
    return;
  }
  line(OK, "project id", await projectId());
  const gated = await probe(scoped);
  if (gated) {
    console.log(`\n${gated} declared capability(ies) refuse this credential. Declared is not callable.`);
  }
};

const install = (values) => {
  const written = saveConfig(values);
  console.log(`Saved ${Object.keys(values).join(" and ")} to ${written} (mode 0600).\n`);
};

export const doctor = async (rest) => {
  const values = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    if (!["--token", "--url"].includes(key)) {
      fail("Usage: forge doctor [--token <pat>] [--url <endpoint>]");
    }
    if (index + 1 >= rest.length) fail(`doctor: ${key} was given no value.`);
    values[key.slice(2)] = rest[index + 1];
  }
  if (Object.keys(values).length) install(values);

  const { url, urlFrom, token, tokenFrom } = accountCredentials();
  if (url) line(OK, "endpoint url", `${url}  ← ${urlFrom}`);
  else line(BAD, "endpoint url", "no FORGE_MCP_URL, no saved url, no .mcp.json");
  if (token) line(OK, "token", `${masked(token)}  ← ${tokenFrom}`);
  else line(BAD, "token", "run `forge doctor --token <pat>` to save one");

  const { slug, from } = projectScope();
  if (slug) line(OK, "project slug", `${slug}  ← ${from}`);
  else line(BAD, "project slug", "project-scoped calls will refuse; account-level ones still work");

  const language = translateTo();
  if (language) line(OK, "prose language", `${language} — every title and body is rewritten`);
  else line(OK, "prose language", "as written; set translate in .forge.json to rewrite");
  const canWrite = !language || checkVi();

  if (!url || !token) {
    console.log("\nNot reaching the endpoint: the account half is incomplete.");
    process.exit(1);
  }
  await checkEndpoint();
  console.log(`\nConfig file: ${CONFIG_PATH}`);
  /* A missing vi-natural key is not a reachability problem, but `forge new` and `forge comment`
     translate before they post, so a green doctor would send `doctor && new` into a certain
     failure. Reads and writes differ here, and the exit code follows the stricter one. */
  if (!canWrite) process.exit(1);
};
