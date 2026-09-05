/* A refusal ends by naming a command, so the document that command reads has to exist in every
   installed copy — a pointer to a file that is not there is worse than the paragraph it replaced. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { NARRATES } from "../../src/checks/doc-shape.mjs";
import { RETIRED } from "../../src/checks/retired-names.mjs";

const PLUGIN = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const HOOKS = join(PLUGIN, "hooks");
const HOW = join(HOOKS, "how");
const CLI = join(PLUGIN, "src", "cli.mjs");

const GATES = join(HOOKS, "gates");
const scripts = [...readdirSync(HOOKS), ...readdirSync(join(HOOKS, "entries"))]
  .filter((one) => one.endsWith(".mjs") && !one.startsWith("_") && one !== "gate.mjs");
const gates = readdirSync(GATES).filter((one) => one.endsWith(".mjs"));
const documented = readdirSync(HOW).filter((one) => one.endsWith(".md")).map((one) => one.slice(0, -3));

test("every gate that points at its reasoning has some", () => {
  const pointing = gates
    .filter((one) => /\bhow\(\)/u.test(readFileSync(join(GATES, one), "utf8")))
    .map((one) => one.replace(/\.mjs$/u, ""));
  assert.ok(pointing.length >= 5, `${pointing.length} hooks print the pointer`);
  for (const name of pointing) {
    assert.ok(documented.includes(name), `${name} prints \`forge hooks --how ${name}\` and has no how/${name}.md`);
  }
});

/* A hook renamed leaves a document nothing reads, and `--how` would offer it. A shared topic is
   allowed one, cited from whatever prints the pointer: the harness, or a gate refusing two
   unrelated things, which the ceiling below leaves no room to argue on one page. A retired gate
   keeps its page as the note, since `--how` on the name it printed has to answer with the
   retirement and not with a did-you-mean. */
test("every document names a hook, a topic the code that prints it cites, or a retired name", () => {
  const citing = [join(HOOKS, "_hook.mjs"), ...gates.map((one) => join(GATES, one))]
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  const retired = RETIRED.map((one) => one.name);
  for (const name of documented) {
    const named = scripts.includes(`${name}.mjs`) || citing.includes(`how/${name}.md`) || retired.includes(name);
    assert.ok(named, `how/${name}.md names no hook, no harness or gate cites it, and nothing retired it`);
  }
  assert.ok(
    documented.some((name) => retired.includes(name) && !scripts.includes(`${name}.mjs`)),
    "and a retirement note is what that last clause is for, so one is here to have been judged",
  );
});

/* The note is a page with no gate behind it; every other rule of the shape still holds over it. */
test("a retirement note says it is retired, and points at no gate to clear", () => {
  for (const name of documented.filter((one) => RETIRED.some((two) => two.name === one))) {
    const text = readFileSync(join(HOW, `${name}.md`), "utf8");
    const release = RETIRED.find((one) => one.name === name).release;
    assert.match(text.split("\n")[0], /retired/u, `how/${name}.md does not open by saying so`);
    assert.ok(!scripts.includes(`${name}.mjs`), `how/${name}.md is retired and ${name}.mjs still runs`);
    assert.ok(release, `how/${name}.md is a retirement note and the registry names no release`);
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
    const why = (text.split("\n\n")[1] ?? "").replace(/\n/gu, " ");
    assert.ok(first.startsWith(`# ${name} — `), `how/${name}.md opens with: ${first}`);
    assert.ok(why.startsWith("Why: "), `how/${name}.md: second paragraph is not the why — ${why.slice(0, 60)}`);
    assert.ok(why.length <= WHY, `how/${name}.md: the why is ${why.length} characters, and ${WHY} is the budget`);
    assert.ok(
      text.length <= CEILING,
      `how/${name}.md is ${text.length} characters; the ceiling is ${CEILING}, and what does not fit `
        + "is an argument where a route out belongs",
    );
    assert.match(text, /^Not judged:/mu, `how/${name}.md says nothing it declines to judge`);
    const narrating = text.match(NARRATES);
    assert.equal(narrating, null, `how/${name}.md explains code: "${narrating?.[0]}"`);
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
