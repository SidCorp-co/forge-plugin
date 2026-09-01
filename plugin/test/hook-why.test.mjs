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
  assert.ok(pointing.length >= 5, `${pointing.length} hooks print the pointer`);
  for (const name of pointing) {
    assert.ok(documented.includes(name), `${name} prints \`forge hooks --why ${name}\` and has no why/${name}.md`);
  }
});

/* The other direction: a hook renamed leaves a document nothing reads, and `--why` would offer it.
   A shared topic is allowed one document, and the harness every hook loads is what names it — cited
   rather than listed, so the pair cannot drift. */
test("every document names a hook, or a topic the harness cites", () => {
  const harness = readFileSync(join(HOOKS, "_hook.mjs"), "utf8");
  for (const name of documented) {
    const named = scripts.includes(`${name}.mjs`) || harness.includes(`why/${name}.md`);
    assert.ok(named, `why/${name}.md names no hook, and _hook.mjs does not cite it`);
  }
});

/* The shape docs/HOOKS.md sets out. Each of these was got wrong before it was written down: a
   document that opened without naming its gate, one that grew past what anyone reads, and a pointer
   into `docs/` or an absolute path — neither of which exists in the copy a gate fires from. */
test("each document opens with its claim, stays short, and points nowhere unreachable", () => {
  const CEILING = 2600;
  for (const name of documented) {
    const text = readFileSync(join(WHY, `${name}.md`), "utf8");
    const [first] = text.split("\n");
    assert.equal(first, `# ${name} — ${first.replace(/^# \S+ — /u, "")}`, `why/${name}.md: ${first}`);
    assert.ok(
      text.length <= CEILING,
      `why/${name}.md is ${text.length} characters; the ceiling is ${CEILING}, and the argument that `
        + "does not fit is the one to cut",
    );
    assert.doesNotMatch(text, /(?:^|[\s(`])(?:\/(?:home|run|Users|tmp)\/|docs\/)/u, `why/${name}.md`);
  }
});

test("the reasoning is what --why prints, and a near miss is named", () => {
  const forge = (...argv) => spawnSync(process.execPath, [CLI, "hooks", ...argv], { encoding: "utf8" });
  const out = forge("--why", "codex-second");
  assert.equal(out.status, 0);
  assert.equal(
    out.stdout.trimEnd(),
    readFileSync(join(WHY, "codex-second.md"), "utf8").trimEnd(),
    "the file itself, so the argument has one home",
  );
  const missed = forge("--why", "codex-secnod");
  assert.equal(missed.status, 1);
  assert.match(missed.stderr, /No hook named codex-secnod\. Did you mean: codex-second/u);
});
