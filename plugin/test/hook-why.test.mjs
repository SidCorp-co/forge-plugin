/* A refusal ends by naming a command, so the document that command reads has to exist in every
   installed copy — a pointer to a file that is not there is worse than the paragraph it replaced. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const HOOKS = join(PLUGIN, "hooks");
const WHY = join(HOOKS, "why");
const CLI = join(PLUGIN, "src", "cli.mjs");

const scripts = readdirSync(HOOKS).filter((one) => one.endsWith(".mjs") && !one.startsWith("_"));
const documented = readdirSync(WHY).filter((one) => one.endsWith(".md")).map((one) => one.slice(0, -3));

test("every gate that points at its reasoning has some", () => {
  const pointing = scripts
    .filter((one) => /\bwhy\(\)/u.test(readFileSync(join(HOOKS, one), "utf8")))
    .map((one) => one.replace(/\.mjs$/u, ""));
  assert.ok(pointing.length >= 6, `${pointing.length} hooks print the pointer`);
  for (const name of pointing) {
    assert.ok(documented.includes(name), `${name} prints \`forge hooks --why ${name}\` and has no why/${name}.md`);
  }
});

/* The other direction: a hook renamed leaves a document nothing reads, and `--why` would offer it. */
test("every document names a hook that exists", () => {
  for (const name of documented) {
    assert.ok(scripts.includes(`${name}.mjs`), `why/${name}.md names no hook`);
  }
});

test("the reasoning is what --why prints, and a near miss is named", () => {
  const forge = (...argv) => spawnSync(process.execPath, [CLI, "hooks", ...argv], { encoding: "utf8" });
  const out = forge("--why", "advisor-first");
  assert.equal(out.status, 0);
  assert.equal(
    out.stdout.trimEnd(),
    readFileSync(join(WHY, "advisor-first.md"), "utf8").trimEnd(),
    "the file itself, so the argument has one home",
  );
  const missed = forge("--why", "advisor-frist");
  assert.equal(missed.status, 1);
  assert.match(missed.stderr, /No hook named advisor-frist\. Did you mean: advisor-first/u);
});
