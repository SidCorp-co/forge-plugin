/* A project's own gate, test and ship, and what a class this reading could not recognise prints. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { classOf, classesFor, declaredIn } from "../../src/stats/classes.mjs";
import { slugFor } from "../../src/stats/corpus.mjs";
import { tempRoom } from "../fixtures.mjs";
import { asked, at, result, transcript, use } from "./fixture-runs.mjs";

const said = (shell, declared) => classOf("Bash", shell, classesFor(declared));

test("a declared command is the class, and it replaces the built-in rather than joining it", () => {
  for (const [label, declared, built] of [
    ["gate", "node scripts/gates.mjs", "npm run check"],
    ["test", "pnpm verify", "node --test plugin/test/x.test.mjs"],
    ["ship", "make release", "node /w/tools/run.mjs ship"],
  ]) {
    assert.equal(said(declared, { [label]: declared }), label, `${declared} is this project's ${label}`);
    assert.equal(said(built, { [label]: declared }), "shell",
      `and ${built} is no longer counted as ${label}: a project that said what its ${label} is has said it`);
    assert.equal(said(built), label, "while a project declaring nothing keeps the built-in pattern");
  }
});

test("several commands may be declared for one class, and a class declares nothing by omission", () => {
  const declared = { gate: ["make check", "make check-fast"] };
  assert.equal(said("make check-fast", declared), "gate");
  assert.equal(said("make check", declared), "gate");
  assert.equal(said("npm run check", declared), "shell", "the declaration is the whole of the class");
  assert.equal(said("node --test x.mjs", declared), "test", "and the classes it did not name are untouched");
});

/* Nothing is inferred from a command's shape: guessing that any script named `gates.mjs` is a gate
   is how a profiler starts counting a project's unrelated tooling (ISS-1586). */
test("a declared command is matched as text at a command position, never as a shape", () => {
  assert.equal(said("node scripts/g.tes.mjs", { gate: "node scripts/g?tes.mjs" }), "shell",
    "a regular-expression character in the declaration is the character the project typed");
  assert.equal(said("xmake check", { gate: "make check" }), "shell", "and a word it is only the tail of is not one");
  assert.equal(said("cd /w && make check", { gate: "make check" }), "gate", "while a real command position is");
});

test("the declarations are the profiled checkout's own, and absent where it declares none", () => {
  const project = tempRoom("stats-declared-");
  assert.equal(declaredIn(project), null, "a checkout with no project file declares nothing");
  writeFileSync(join(project, ".forge.json"),
    JSON.stringify({ slug: "fixture", stats: { commands: { gate: "node scripts/gates.mjs" } } }));
  assert.deepEqual(declaredIn(project), { gate: "node scripts/gates.mjs" });
});

const corpusFor = (project, text) => {
  const room = tempRoom("stats-classes-");
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(project), "session-one", "tasks");
  mkdirSync(tasks, { recursive: true });
  writeFileSync(join(tasks, "a0001.output"), `${text}\n`);
  return room;
};

const OTHER_GATE = [
  JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-99" } }),
  use("g1", 10, "Bash", { command: "forge claim ISS-99" }),
  result("g1", 15, "claimed"),
  use("g2", 30, "Bash", { command: "node scripts/gates.mjs" }),
  result("g2", 90, "all steps passed"),
].join("\n");

const declaring = (commands) => {
  const project = tempRoom("stats-other-project-");
  writeFileSync(join(project, ".forge.json"), JSON.stringify({ slug: "fixture", ...commands }));
  return project;
};

test("a corpus whose gate is spelled otherwise is counted where the checkout declares it", () => {
  const project = declaring({ stats: { commands: { gate: "node scripts/gates.mjs" } } });
  const room = corpusFor(project, OTHER_GATE);
  const run = asked(room, "--checkout", project);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^per run {9}1 gate,/mu, "the call the project named is its gate");
  assert.match(run.stdout, /^gate\s+1\.0\s/mu, "and it carries its minute in the class table");
});

test("a class nothing was classed as and no checkout declared is unrecognised, not nought", () => {
  const project = declaring({});
  const run = asked(corpusFor(project, OTHER_GATE), "--checkout", project);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^per run {9}unrecognised gate, unrecognised test,/mu);
  assert.match(run.stdout, /^ships {11}unrecognised$/mu,
    "a pass count and a median over a class nothing was classed as are two more zeroes read as measurement");
  assert.match(run.stdout, /^ {2}declare `stats\.commands\.gate`, `stats\.commands\.ship`, `stats\.commands\.test` in the \.forge\.json/mu,
    "and what would declare each of them is named rather than left to be known");
  assert.match(run.stdout, /^7 Ship {6}unrecognised: nothing here was classed ship$/mu);
  assert.match(run.stdout, /^8 Learn {5}unrecognised: reached only past a call classed ship, and nothing here was$/mu,
    "a phase reachable only past an unrecognised one would otherwise print the most confident zero in the table");
  assert.match(run.stdout, /^unknown\s+1\s.*\sunrecognised$/mu,
    "and the rung table's gate cell says it too, a populated rung being where a nought reads most like measurement");
});

test("this repository's own reading does not move: a checkout declaring nothing keeps every built-in", () => {
  const project = declaring({});
  const room = corpusFor(project, transcript());
  const run = asked(room, "--checkout", project);
  assert.match(run.stdout, /^per run {9}1 gate, 1 test,/mu,
    "the fixture run's `npm run check` and `node --test` are still its gate and its test");
  assert.match(run.stdout, /^ships {11}1 pass\(es\)/mu, "and its ship is still a ship");
  assert.match(run.stdout, /^unknown\s+1\s.*\s1\.0$/mu, "and the rung table carries its gate as a figure");
});
