/* One runner for the gates that ask git, and the budget it is asked with. Structural as well as
   behavioural: what a probe answers is worth little while a gate still spawns git itself, or hands it a constant as the event's own clock runs out (ISS-399). */
import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { gitProbe, probeMs } from "../../src/hooks/git-probe.mjs";
import { tempRoom } from "../fixtures.mjs";

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ROOT = join(PLUGIN, "..");

test("a probe answers what git said, and nothing at all where git did not run", () => {
  const inside = gitProbe(["rev-parse", "--is-inside-work-tree"], { cwd: ROOT, ms: 5_000 });
  assert.equal(inside?.status, 0, "git answered in this checkout");
  assert.equal(inside.out.trim(), "true");

  const outside = gitProbe(["status", "--porcelain"], { cwd: tempRoom("probe-"), ms: 5_000 });
  assert.notEqual(outside, null, "a directory that is no repository is an answer, not a failure");
  assert.notEqual(outside.status, 0, "and the answer is git's own refusal");

  assert.equal(gitProbe(["status"], { cwd: join(tempRoom("probe-gone-"), "no-such"), ms: 5_000 }), null,
    "where git could not be spawned at all there is no answer to read a status off");
});

/* The clamp is the reason this module exists: a gate handing git everything it has left has nothing left to answer with, and one handing it nothing gets a kill that reads like a failure. */
test("the budget is enough to answer and never the whole of what is left", () => {
  assert.equal(probeMs(100_000), 5_000, "capped, however much the event has");
  assert.equal(probeMs(3_000), 2_000);
  assert.ok(probeMs(3_000) < 3_000, "and always under it, so the gate can still answer");
  assert.equal(probeMs(1_000), 500, "floored, a probe killed at zero saying the same as one that failed");
  assert.equal(probeMs(-40_000), 500, "including past the deadline");
});

const sources = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((one) =>
  (one.isDirectory() ? sources(join(dir, one.name)) : (one.name.endsWith(".mjs") ? [join(dir, one.name)] : [])));

/* The two trees a gate's code lives in, a fourth hand-rolled runner being what this replaced: `plugin/hooks` is the gates, `plugin/src/hooks` the readings they share. */
const PROBE = join(PLUGIN, "src", "hooks", "git-probe.mjs");
const GATE_CODE = [...sources(join(PLUGIN, "hooks")), ...sources(join(PLUGIN, "src", "hooks"))]
  .filter((one) => one !== PROBE && !one.includes(`${join("hooks", "vendor")}`));

/* Read without them, so a comment saying why the shape changed is not itself a match. */
const code = (path) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gmu, "");

test("no gate spawns git itself, and every one of them names a budget", () => {
  const spawning = GATE_CODE.filter((one) => /spawnSync\(\s*"git"/u.test(code(one)));
  assert.deepEqual(spawning, [], `these spawn git beside the shared runner:\n${spawning.join("\n")}`);

  const asked = GATE_CODE.filter((one) => code(one).includes("gitProbe("));
  assert.ok(asked.length >= 3, `only ${asked.length} caller(s) found, so this case proves little`);
  for (const one of asked) {
    for (const call of code(one).split("gitProbe(").slice(1)) {
      const args = call.split(";")[0];
      assert.match(args, /ms:\s*\S/u,
        `${one} asks git with no budget at all, so a hung probe takes every gate's answer:\n${args}`);
    }
  }
});

/* `failed` was a second way to say "no answer", beside a `status` null in the same breath: every caller read both, and one of them read only the first. */
test("there is one way to say the probe got no answer", () => {
  assert.doesNotMatch(code(PROBE), /failed/u, "the probe answers nothing, rather than a second flag");
  for (const one of GATE_CODE) {
    assert.doesNotMatch(code(one), /\.failed\b/u, `${one} still reads a flag the probe does not answer with`);
  }
});
