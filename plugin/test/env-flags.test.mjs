/* Values come from config files; the environment holds only what config cannot. Without this the
   rule is worth nothing: an env read is one line that looks like every other line, and it gives a
   decision a second source. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import assert from "node:assert/strict";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* Decided, not derived: where config lives, what the platform passes in, and one kill switch that
   has to work when the config file is what is broken. */
const ALLOWED = new Set([
  "XDG_CONFIG_HOME",
  "CLAUDE_PROXY_ENV",
  "CLAUDE_PLUGIN_ROOT",
  "CLAUDE_PROJECT_DIR",
  "CLAUDE_CODE_DISABLE_ADVISOR_TOOL",
  "FORGE_CODEX_DISABLE",
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

test("no value is read from the environment", () => {
  const found = [];
  for (const path of sources(join(ROOT))) {
    const text = readFileSync(path, "utf8");
    for (const [, name] of text.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/gu)) {
      if (!ALLOWED.has(name)) found.push(`${relative(ROOT, path)}: ${name}`);
    }
  }
  assert.deepEqual(
    found,
    [],
    "a credential, a url, a model id or a threshold belongs in a config file, where one source "
      + `answers for it: ${[...ALLOWED].join(", ")} are the only names read here`,
  );
});

test("only doctor reads the environment by computed name", () => {
  const found = sources(join(ROOT))
    .filter((path) => /process\.env\[/u.test(readFileSync(path, "utf8")))
    .map((path) => relative(ROOT, path));
  assert.deepEqual(found, ["src/doctor.mjs"], "it reports which kill switch holds a gate down");
});
