/* A project's own gate, test and ship, and what a class this reading could not recognise prints. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DEPLOY, EDIT_ROUTES, POLL, READY_CLASS, SHELL, SHELL_EDITS, WAIT, classOf, classesFor }
  from "../../../src/stats/corpus/classes.mjs";
import { DECIDED_BY_RELEASE, MOVED_AT, TABLE } from "../../../src/stats/corpus/generations.mjs";
import { WAITS_ON_PID, WAIT_COMMAND } from "../../../src/hooks/wait-idiom.mjs";
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
  assert.match(run.stdout,
    /^ {2}declare `stats\.commands\.gate`, `stats\.commands\.ship`, `stats\.commands\.test`, `stats\.commands\.cleanup` with `forge doctor --set` in the checkout profiled/mu,
    "and what would declare each of them is named rather than left to be known");
  /* The two phases that read `unrecognised` here now open on records this CLI writes as well as on
     a command the project declares, so this run's nought at each is a run that did not get there
     rather than a class the reading could not see (ISS-1975). */
  assert.match(run.stdout, /^7 Ship {10}0 {6}0\.0 {8}0 {8}0\.0 {2}$/mu);
  assert.match(run.stdout, /^8 Clean up {6}0 {6}0\.0 {8}0 {8}0\.0 {2}$/mu);
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

/* The wait this plugin prescribes for work already running, against the read of a file's tail it is
   spelled like. The two are one row apart and the wait is the largest class this project's corpus
   holds, 4042 tool-minutes over 895 calls, so a row that takes either of them takes both (ISS-2086). */
test("the prescribed wait on a running process is a wait, and a read of a file's tail is still a read", () => {
  assert.equal(said(WAIT_COMMAND.replace("<seconds>", "880").replace("<pid>", "12345")), WAIT,
    "the command the refusal and the polling text prescribe, as a run types it");
  assert.equal(said("tail --pid=12345 -f /dev/null"), WAIT, "and without the timeout that bounds it");
  assert.equal(said("tail -f --pid=12345 /dev/null"), WAIT,
    "the argument is the discriminator wherever among the options it stands, not the word after `tail`");
  assert.equal(said("tail -n 0 --pid=12345 -f /dev/null"), WAIT, "past an option carrying a separate value");
  assert.equal(said("tail /dev/null -f --pid=12345"), WAIT, "and past an operand standing before its options");
  assert.equal(said("tail -n 30 run.log"), "read", "while a bare tail of a file is the read it always was");
  assert.equal(said("tail -f run.log"), "read", "following one included");
  assert.equal(said("tail --pidfile=run.pid"), "read", "the option ends where its own name does");
  assert.equal(said("tail -- --pid=12345"), "read", "and past a bare `--` a word is a filename, however it is spelled");
  assert.equal(said("tail run.log; grep --pid other"), "read", "the argument belongs to this tail and not to a later command");
  assert.equal(said('P=$(pgrep -f "tools/run.mjs ship" | head -1); timeout 880 tail --pid=$P -f /dev/null'), WAIT,
    "a line that locates the pid and then waits on it is the wait, the pgrep being how it found the pid");
  assert.equal(said("while sleep 10; do echo x; done"), POLL, "and a loop that sleeps is still a poll");
  assert.equal(said("tailscale --pid=1 up"), "shell", "a word `tail` only opens is no wait at all");
});

test("every row above the wait row keeps a line that also waits, so a launch that waits is the launch", () => {
  const order = classesFor(null).map(([label]) => label);
  assert.deepEqual(order.slice(order.indexOf("git"), order.indexOf(POLL) + 1), ["git", WAIT, POLL],
    "the wait row stands between the last row that names a command and the poll row");
  assert.ok(order.indexOf(WAIT) > order.indexOf("cleanup"), "below every row a declaration arms");
  assert.ok(order.indexOf(WAIT) < order.indexOf("read"), "and above the read row that would shadow it");
  for (const [label, launch, declared] of [
    ["gate", "npm run check", undefined],
    ["gate", "make check", { gate: "make check" }],
    ["ship", "node /w/tools/run.mjs ship", undefined],
    ["test", "node --test plugin/test/x.test.mjs", undefined],
    ["cleanup", "node /w/tools/run.mjs finish ISS-99", undefined],
    ["forge issue", "forge issue ISS-99", undefined],
    ["git", "git log --oneline -1", undefined],
  ]) {
    assert.equal(said(`${launch} > run.log 2>&1 & timeout 880 tail --pid=$! -f /dev/null`, declared), label,
      `${launch} launched and waited on in one line is that launch, and a phase it opens still opens`);
  }
});

/* Armed, because the row is in the table on one answer only and a case over an unarmed one would
   prove the shell fallback rather than this row: `release.test.mjs` holds which answer arms it. */
const ARMED = { key: "deploy", deploy: true };

test("a deploy another actor lands is neither a poll nor a read", () => {
  const under = (shell) => classOf("Bash", shell, classesFor(null, ARMED));
  for (const [shell, was] of [
    ["until s=$(coolify deployment get --uuid abc); do sleep 20; done", POLL],
    ["coolify deployment get --uuid abc | grep status", "read"],
    ["coolify deploy --uuid abc --yes", SHELL],
    ["P=$(cat /tmp/p); tail --pid=$P -f /dev/null; coolify deployment get --uuid abc", WAIT],
  ]) {
    assert.equal(under(shell), DEPLOY, `the deploy act, where it used to be a ${was}`);
    assert.equal(classOf("Bash", shell, classesFor(null)), was,
      "and the row it came out of is the one it fell to before, so the population that moved is named");
  }
  assert.equal(under("coolify app list"), "shell",
    "a call to that platform which is not the deploy act is not this row");
});

test("a line that writes a file and then reads a deployment is the deploy, and the route it came out of is named", () => {
  const under = (shell) => classOf("Bash", shell, classesFor(null, ARMED));
  for (const [shell, was] of [
    ["sed -i s/a/b/ plan.md; coolify deployment get --uuid abc", "edit sed"],
    ["cat > /tmp/x <<EOF\nhi\nEOF\ncoolify deploy --uuid abc --yes", "edit file"],
    ["python3 - <<PY\npass\nPY\ncoolify deployment get --uuid abc", "edit heredoc"],
  ]) {
    assert.equal(under(shell), DEPLOY, `the deploy act, where it used to be an ${was}`);
    assert.equal(classOf("Bash", shell, classesFor(null)), was,
      "so the route this row displaces is one the generation bookkeeping has to name");
    assert.ok(MOVED_AT.has(was) && DECIDED_BY_RELEASE.includes(was),
      `${was} is named in both halves, or a reading taken without this row compares two populations`);
  }
  assert.deepEqual(SHELL_EDITS, EDIT_ROUTES.slice(2),
    "and the three are read off the routes rather than spelled a second time");
});

test("the verb's own row and git keep their calls", () => {
  const under = (shell) => classOf("Bash", shell, classesFor(null, ARMED));
  assert.equal(under("forge coolify deployment get abc"), "forge coolify",
    "this CLI's own verb is its own row above this one, which is what keeps a lookup of its help "
    + "filed where its work is");
  assert.equal(under("export PATH=$HOME/.local/bin:$PATH; forge coolify deploy --uuid abc --yes"), "forge coolify");
  assert.equal(under("git log --oneline --grep 'coolify deployment'"), "git",
    "and a git call naming a deployment is the git it always was");
});

test("a ready checkpoint is the landing's own class", () => {
  assert.equal(classOf("Bash", "forge claim ISS-99 --pushed --ready"), READY_CLASS,
    "the landing a run leaves for another actor is not the claim that opened the run");
  assert.equal(classOf("Bash", "forge claim ISS-99 --pushed"), "forge claim",
    "while a capture that leaves nothing ready is that claim");
  assert.equal(classOf("Bash", "forge claim ISS-99"), "forge claim");
});

test("the rows this generation moved are the ones it names", () => {
  for (const label of [DEPLOY, "read", POLL, WAIT, SHELL, "forge claim", ...SHELL_EDITS]) {
    assert.equal(MOVED_AT.get(label), TABLE,
      `${label} holds a different population than it did at the generation before this one`);
  }
  assert.equal(MOVED_AT.get("gate"), undefined, "while a row nothing moved names no generation");
  assert.equal(MOVED_AT.get("git"), undefined,
    "and a row this generation's own row sits below keeps every call it had");
});

test("the discriminator and the generation each have one home the table reads", () => {
  assert.ok(classesFor(null).some(([label, match]) => label === WAIT && match.source.includes(WAITS_ON_PID)),
    "the table matches on the shared fragment rather than spelling the argument again");
  assert.equal(MOVED_AT.get(WAIT), TABLE, "the row this generation added names this generation");
  for (const label of [WAIT, POLL, "read"]) {
    assert.equal(MOVED_AT.get(label), TABLE, `${label} holds a different population than it did before`);
  }
  assert.equal(MOVED_AT.get("gate"), undefined, "while a row nothing moved names no generation");
});

/* A wait armed on the call that ends a workspace, which is the second phase marker a line can carry
   away: read as a wait, the run reaches the phase the method ends in nowhere. */
const CLEANED_UNDER_A_WAIT = [
  JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-99" } }),
  use("w1", 10, "Bash", { command: "node /w/tools/run.mjs ship" }),
  result("w1", 20, "released"),
  use("w2", 30, "Bash", { command: "workspace finish ISS-99 & timeout 60 tail --pid=$! -f /dev/null" }),
  result("w2", 40, "ended"),
].join("\n");

test("a cleanup waited on in its own line still opens the last phase", () => {
  const project = declaring({ stats: { commands: { cleanup: "workspace finish" } } });
  const run = askedIn(corpusFor(project.at, CLEANED_UNDER_A_WAIT), project.home, "--checkout", project.at);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^8 Clean up\s+1\s+[\d.]+\s+\d+\s+1\.0\s+cleanup 1 0m$/mu,
    "the phase the method ends a run in opens on the launch, the wait armed on it taking nothing away");
});
