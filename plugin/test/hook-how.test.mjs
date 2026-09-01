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
const HOW = join(HOOKS, "how");
const CLI = join(PLUGIN, "src", "cli.mjs");

const scripts = readdirSync(HOOKS).filter((one) => one.endsWith(".mjs") && !one.startsWith("_"));
const documented = readdirSync(HOW).filter((one) => one.endsWith(".md")).map((one) => one.slice(0, -3));

test("every gate that points at its reasoning has some", () => {
  const pointing = scripts
    .filter((one) => /\bhow\(\)/u.test(readFileSync(join(HOOKS, one), "utf8")))
    .map((one) => one.replace(/\.mjs$/u, ""));
  assert.ok(pointing.length >= 5, `${pointing.length} hooks print the pointer`);
  for (const name of pointing) {
    assert.ok(documented.includes(name), `${name} prints \`forge hooks --how ${name}\` and has no how/${name}.md`);
  }
});

/* A hook renamed leaves a document nothing reads, and `--how` would offer it. A shared topic is
   allowed one, cited by the harness rather than listed, so the pair cannot drift. */
test("every document names a hook, or a topic the harness cites", () => {
  const harness = readFileSync(join(HOOKS, "_hook.mjs"), "utf8");
  for (const name of documented) {
    const named = scripts.includes(`${name}.mjs`) || harness.includes(`how/${name}.md`);
    assert.ok(named, `how/${name}.md names no hook, and _hook.mjs does not cite it`);
  }
});

/* Every rule of the shape was got wrong here first: a document opening without naming its gate, one
   past what anyone reads, an argument filling the file an agent opened for a route out, and a pointer
   into `docs/` — which does not exist in the copy a gate fires from. */
test("each document opens with its claim, argues briefly, and points nowhere unreachable", () => {
  const CEILING = 1300;
  const WHY = 280; // 65 tokens: the reason a rule exists, not a defence of it
  for (const name of documented) {
    const text = readFileSync(join(HOW, `${name}.md`), "utf8");
    const [first] = text.split("\n");
    const why = text.split("\n\n")[1].replace(/\n/gu, " ");
    assert.equal(first, `# ${name} — ${first.replace(/^# \S+ — /u, "")}`, `how/${name}.md: ${first}`);
    assert.ok(why.startsWith("Why: "), `how/${name}.md: second paragraph is not the why — ${why.slice(0, 60)}`);
    assert.ok(why.length <= WHY, `how/${name}.md: the why is ${why.length} characters, and ${WHY} is the budget`);
    assert.ok(
      text.length <= CEILING,
      `how/${name}.md is ${text.length} characters; the ceiling is ${CEILING}, and what does not fit `
        + "is an argument where a route out belongs",
    );
    assert.match(text, /^Not judged:/mu, `how/${name}.md says nothing it declines to judge`);
    assert.doesNotMatch(text, /(?:^|[\s(`])(?:\/(?:home|run|Users|tmp)\/|docs\/)/u, `how/${name}.md`);
  }
});

test("the reasoning is what --how prints, and a near miss is named", () => {
  const forge = (...argv) => spawnSync(process.execPath, [CLI, "hooks", ...argv], { encoding: "utf8" });
  const out = forge("--how", "codex-second");
  assert.equal(out.status, 0);
  assert.equal(
    out.stdout.trimEnd(),
    readFileSync(join(HOW, "codex-second.md"), "utf8").trimEnd(),
    "the file itself, so the argument has one home",
  );
  const missed = forge("--how", "codex-secnod");
  assert.equal(missed.status, 1);
  assert.match(missed.stderr, /No hook named codex-secnod\. Did you mean: codex-second/u);
});
