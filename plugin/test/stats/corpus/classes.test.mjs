/* A project's own gate, test and ship, and what a class this reading could not recognise prints. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { classOf, classesFor } from "../../../src/stats/corpus/classes.mjs";
import { declaredClasses, declaredIn, unarmedDoors } from "../../../src/stats/corpus/declared.mjs";
import { slugFor } from "../../../src/stats/corpus/corpus.mjs";
import { projectRoom, tempRoom } from "../../fixtures.mjs";
import { askedIn, at, result, transcript, use } from "../fixture-runs.mjs";

/* This process's own record of a project is read out of its configuration home, and a case here
   writes one — so the home moves off the developer's before the first reader runs. */
process.env.XDG_CONFIG_HOME = tempRoom("stats-classes-config-");

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

/* The half a route that refuses is handed. A reading's fallback costs a miscounted row; the same
   fallback at a door refuses an adopting project at a command it never named (ISS-1905). */
test("the declared half of the table holds what the project declared and nothing this repository calls its own", () => {
  const declaredSaid = (shell, declared) => classOf("Bash", shell, declaredClasses(declared));
  assert.equal(declaredSaid("npm run check", null), "shell", "a project that declared nothing arms no door");
  assert.equal(declaredSaid("node tools/gates.mjs", null), "shell", "by either spelling this repository uses");
  assert.equal(declaredSaid("make verify", { gate: "make verify" }), "gate", "what it did declare is its gate");
  assert.equal(declaredSaid("npm run check", { gate: "make verify" }), "shell",
    "and this repository's gate command is an ordinary call in a project that named its own");
  for (const wrote of ["", "   ", 42, [], ["  "]]) {
    assert.equal(declaredSaid("npm run check", { gate: wrote }), "shell",
      `\`${JSON.stringify(wrote)}\` is no command, and no command is no declaration`);
  }
  assert.equal(said("npm run check", { gate: "" }), "gate",
    "while the reading keeps the fallback it was built with: a wrong row there costs a number, not a door");
});

test("the doors nothing arms are read off the same declaration the table is built from", () => {
  assert.deepEqual(unarmedDoors(["gate", "commit"], { gate: "make verify" }), [],
    "a door with a command, and a door this plugin serves itself, are both armed");
  assert.deepEqual(unarmedDoors(["gate"], null), [{ label: "gate", wrote: null }],
    "a key nobody wrote is named with nothing quoted back");
  assert.deepEqual(unarmedDoors(["gate", "ship"], { gate: "", ship: "pnpm ship" }),
    [{ label: "gate", wrote: '""' }], "and a value that is no command is named with what was written");
});

test("the declarations are the profiled checkout's own, and absent where it declares none", () => {
  const project = tempRoom("stats-declared-");
  assert.equal(declaredIn(project), null, "a directory no record of a project answers for declares nothing");
  projectRoom(project, process.env.XDG_CONFIG_HOME,
    { slug: "fixture", stats: { commands: { gate: "node scripts/gates.mjs" } } });
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

/* The checkout profiled and the configuration home this machine keeps its record under, which the
   child has to be given for the declaration to be the profiled checkout's own. One home per
   checkout, so no reading here inherits a mark another wrote. */
const declaring = (commands) => {
  const home = tempRoom("stats-classes-home-");
  return { at: projectRoom(tempRoom("stats-other-project-"), home, { slug: "fixture", ...commands }), home };
};

test("a corpus whose gate is spelled otherwise is counted where the checkout declares it", () => {
  const project = declaring({ stats: { commands: { gate: "node scripts/gates.mjs" } } });
  const room = corpusFor(project.at, OTHER_GATE);
  const run = askedIn(room, project.home, "--checkout", project.at);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^per run {9}1 gate,/mu, "the call the project named is its gate");
  assert.match(run.stdout, /^gate\s+1\.0\s/mu, "and it carries its minute in the class table");
});

test("a class nothing was classed as and no checkout declared is unrecognised, not nought", () => {
  const project = declaring({});
  const run = askedIn(corpusFor(project.at, OTHER_GATE), project.home, "--checkout", project.at);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^per run {9}unrecognised gate, unrecognised test,/mu);
  assert.match(run.stdout, /^ships {11}unrecognised$/mu,
    "a pass count and a median over a class nothing was classed as are two more zeroes read as measurement");
  assert.match(run.stdout, /^ {2}declare `stats\.commands\.gate`, `stats\.commands\.ship`, `stats\.commands\.test`, `stats\.commands\.cleanup` in the \S+config\.json/mu,
    "and what would declare each of them is named rather than left to be known");
  assert.match(run.stdout, /^7 Ship {6}unrecognised: nothing here was classed ship$/mu);
  assert.match(run.stdout, /^8 Clean up {2}unrecognised: reached only past a call classed ship, and nothing here was$/mu,
    "a phase reachable only past an unrecognised one would otherwise print the most confident zero in the table");
  assert.match(run.stdout, /^unknown\s+1\s.*\sunrecognised$/mu,
    "and the rung table's gate cell says it too, a populated rung being where a nought reads most like measurement");
});

/* A landing and the call that ends the workspace after it, spelled as a project other than this one
   would spell the second: the phase the method ends a run in opens on a command every project names
   for itself, so it is declared beside the gate, the ship and the test rather than pattern-matched. */
const SHIPPED_THEN_CLEANED = [
  JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-99" } }),
  use("c1", 10, "Bash", { command: "node /w/tools/run.mjs ship" }),
  result("c1", 20, "released"),
  use("c2", 30, "Bash", { command: "workspace finish ISS-99" }),
  result("c2", 40, "ended"),
].join("\n");

test("a cleanup command the checkout declares opens the last phase, and nothing is read from its shape", () => {
  const project = declaring({ stats: { commands: { cleanup: "workspace finish" } } });
  const run = askedIn(corpusFor(project.at, SHIPPED_THEN_CLEANED), project.home, "--checkout", project.at);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^7 Ship\s+1\s/mu, "the landing opens the phase it always did");
  assert.match(run.stdout, /^8 Clean up\s+1\s+[\d.]+\s+\d+\s+1\.0\s+cleanup 1 0m$/mu,
    "and the word this project typed for ending a workspace opens the phase the method ends a run in");

  const bare = declaring({});
  const held = askedIn(corpusFor(bare.at, SHIPPED_THEN_CLEANED), bare.home, "--checkout", bare.at);
  assert.match(held.stdout, /^8 Clean up\s+0\s+0\.0/mu,
    "while the same transcript reaches it nowhere under the built-in, which is this repository's own command and not a shape");
});

test("this repository's own reading does not move: a checkout declaring nothing keeps every built-in", () => {
  const project = declaring({});
  const room = corpusFor(project.at, transcript());
  const run = askedIn(room, project.home, "--checkout", project.at);
  assert.match(run.stdout, /^per run {9}1 gate, 1 test,/mu,
    "the fixture run's `npm run check` and `node --test` are still its gate and its test");
  assert.match(run.stdout, /^ships {11}1 pass\(es\)/mu, "and its ship is still a ship");
  assert.match(run.stdout, /^unknown\s+1\s.*\s1\.0$/mu, "and the rung table carries its gate as a figure");
});
