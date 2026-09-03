/* Values come from config files; the environment holds only what config cannot. An env read is one
   line that looks like every other line, and it gives a decision a second source. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import assert from "node:assert/strict";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* Decided, not derived: where config lives, what the platform passes in, a kill switch for when
   config broke, and a run's identity — no file names a run, its kind or its pid (ISS-4, ISS-22). */
const ALLOWED = new Set([
  "AI_AGENT",
  "CLAUDE_PID",
  "XDG_CONFIG_HOME",
  "CLAUDE_PROXY_ENV",
  "CLAUDE_PLUGIN_ROOT",
  "CLAUDE_PROJECT_DIR",
  "CLAUDE_CODE_DISABLE_ADVISOR_TOOL",
  "CLAUDE_CODE_SESSION_ID",
  "FORGE_CODEX_DISABLE",
  "FORGE_SESSION_ID",
]);

const SKIP = new Set(["vendor", "node_modules", "test"]);

const sources = (dir) => {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (SKIP.has(name)) continue;
    if (statSync(path).isDirectory()) out.push(...sources(path));
    else if (name.endsWith(".mjs") || name.endsWith(".js")) out.push(path);
  }
  return out;
};

/* Every read, not every `process.env.NAME`: destructuring and `process["env"]` reach the same
   place while matching no name at all. */
const READ = /process\s*(?:\.\s*env|\[\s*["']env["']\s*\])/gu;

const offences = (path) => {
  const text = readFileSync(path, "utf8");
  const found = [];
  for (const one of text.matchAll(READ)) {
    const after = text.slice(one.index + one[0].length);
    const named = /^\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)/u.exec(after);
    if (named && ALLOWED.has(named[1])) continue;
    /* doctor asks by computed name on purpose: it reports which kill switch holds a gate down. */
    if (relative(ROOT, path) === "src/doctor.mjs" && /^\[/u.test(after)) continue;
    found.push(`${relative(ROOT, path)}: ${named ? named[1] : one[0].trim()}`);
  }
  return found;
};

test("no value is read from the environment", () => {
  const found = sources(ROOT).flatMap(offences);
  assert.deepEqual(
    found,
    [],
    "a credential, a url, a model id or a threshold belongs in a config file, where one source "
      + `answers for it: ${[...ALLOWED].join(", ")} are the only names read here, by name`,
  );
});
