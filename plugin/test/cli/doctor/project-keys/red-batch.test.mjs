/* What a landing does with a set its combined gate refused: `redBatch`, a key of the project's own
   record, printed with the value in force and where it was read, a word it does not take named rather
   than read as the default, and the landing refusing that word before it takes anything (ISS-2480). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

import { projectRoom, tempRoom } from "../../../fixtures.mjs";

const CLI = new URL("../../../../src/cli.mjs", import.meta.url).pathname;
const GATE = new URL("../../../../../tools/run/land-ready/gate.mjs", import.meta.url).href;

const envOf = (home) => ({ PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home });

const inProject = (config, argv) => {
  const home = tempRoom("doctor-red-batch-");
  const cwd = projectRoom(tempRoom("doctor-red-batch-cwd-"), home, config);
  return spawnSync(process.execPath, argv, { encoding: "utf8", cwd, env: envOf(home) });
};

const report = (config) => inProject(config, [CLI, "doctor", "project"]).stdout;

test("a project that set no redBatch is told the default searches, and that nobody chose it", () => {
  assert.match(report({ slug: "demo" }), /\[ {2}ok {2}\] redBatch\s+attribute-then-split {2}← the plugin's default/u);
});

test("a project that set one-by-one is read at that value, from its own file", () => {
  assert.match(report({ slug: "demo", redBatch: "one-by-one" }), /\[ {2}ok {2}\] redBatch\s+one-by-one {2}← \S+config\.json/u);
});

test("a word redBatch does not take is named in the report with the two it does", () => {
  assert.match(report({ slug: "demo", redBatch: "bisect" }),
    /redBatch\s+bisect is no value of this key — it takes attribute-then-split, one-by-one; reading attribute-then-split/u);
});

test("the landing refuses a redBatch word the key does not take before it takes anything", () => {
  const run = inProject({ slug: "demo", redBatch: "bisect" }, ["--input-type=module", "-e",
    `const { strategyRefused } = await import(${JSON.stringify(GATE)}); strategyRefused(); console.log("taken");`]);
  assert.notEqual(run.status, 0, run.stdout);
  assert.doesNotMatch(run.stdout, /taken/u);
  assert.match(run.stderr, /this project's `redBatch` is `bisect`, which is no value of that key: it takes attribute-then-split or one-by-one/u,
    run.stderr);
});
