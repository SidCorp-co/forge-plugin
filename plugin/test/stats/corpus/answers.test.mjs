/* A failed call is a refusal, a command's answer or an error, and an error is filed under what failed
   rather than under its class alone (ISS-2454). */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { answerOf, answersProblem, errorKeyOf, returningOf } from "../../../src/stats/corpus/answers.mjs";
import { shellOf } from "../../../src/stats/corpus/transcripts.mjs";
import { slugFor } from "../../../src/stats/corpus/corpus.mjs";
import { projectRoom, tempRoom } from "../../fixtures.mjs";
import { askedIn, at, result, use } from "../fixture-runs.mjs";

const failed = (command, body, clazz = "shell") =>
  ({ name: "Bash", command, shell: shellOf(command), class: clazz, error: true, body });

test("an exit is the command's answer only where that command is the one whose status the line returns", () => {
  assert.equal(answerOf(failed("pgrep -f 'tools/run.mjs ship'", "Exit code 1\n")), "pgrep, exit 1");
  assert.equal(answerOf(failed("cd /w && grep -rq TODO src 2>&1", "Exit code 1\n")), "grep -q, exit 1",
    "a redirection's `&` joins nothing, so the grep is still the last command");
  assert.equal(answerOf(failed("timeout 590 tail --pid=4242 -f /dev/null", "Exit code 124\n")),
    "timeout on a tail --pid wait, exit 124");
  assert.equal(answerOf(failed("git merge-base --is-ancestor abc123 HEAD && echo in", "Exit code 1\n")),
    "git --quiet or --is-ancestor, exit 1", "an inert echo after `&&` leaves the status the command's");
  assert.equal(answerOf(failed("node tools/red.mjs plugin/test/a.test.mjs 'a case'", "Exit code 1\n")),
    "tools/red.mjs, exit 1");

  assert.equal(answerOf(failed("pgrep -x forge && node failing.test.mjs", "Exit code 1\n")), null,
    "a pgrep that found its process, then a test that failed: the 1 is the test's");
  assert.equal(answerOf(failed('pgrep -x forge && echo "$state"', "Exit code 1\n")), null,
    "an echo with an expansion can fail, so it does not carry the status back");
  assert.equal(answerOf(failed("pgrep -x forge | head -1", "Exit code 1\n")), null, "a pipeline returns its last command's status");
  assert.equal(answerOf(failed("pgrep -x forge", "Exit code 2\n")), null, "and only the exit the table names is an answer");
  assert.deepEqual(returningOf("a; b && echo done && true").map((one) => one.trim()), ["b"],
    "b, whose status the inert commands after it carry back, and never the `a` a `;` closed");
});

test("an exit is the command's answer only where that command certainly ran and its status was not inverted", () => {
  assert.equal(answerOf(failed("false && pgrep -x forge", "Exit code 1\n")), null, "false's 1, the pgrep never having run");
  assert.equal(answerOf(failed("! pgrep -x forge", "Exit code 1\n")), null, "a negated pgrep that found its process");
  assert.equal(answerOf(failed("cd /w && export A=b && pgrep -x forge", "Exit code 1\n")), "pgrep, exit 1",
    "a cd and an export of literal words leave it certain to have run");
  assert.equal(answerOf(failed("cd /gone && pgrep -x forge", "Exit code 1\nbash: line 1: cd: /gone: No such file or directory")), null,
    "unless the cd says it failed");
  assert.equal(answerOf(failed("export 1bad=x && pgrep -x forge", "Exit code 1\nbash: line 1: export: `1bad=x': not a valid identifier")), null,
    "and an export of a name no shell accepts is no prelude");
  assert.equal(answerOf(failed("export A=b && pgrep -x forge", "Exit code 1\nbash: export: A: readonly variable")), null,
    "nor one whose failure the body shows");
  assert.equal(answerOf(failed("test -f x || pgrep -x forge", "Exit code 1\n")), "pgrep, exit 1",
    "after `||` a non-zero status means the right side ran");
  assert.equal(answerOf(failed("cat /tmp/gate.log | grep -q '^exit '", "Exit code 1\n")), "grep -q, exit 1",
    "and a pipe's earlier members decide nothing about it");
});

test("an error is keyed on its class, its exit and the first line printed, held steady across days", () => {
  const monday = errorKeyOf(failed("git log", "Exit code 128\nfatal: bad object 4319c246 in /run/media/a/wt-ISS-12/x.mjs at 10:22", "git"));
  const tuesday = errorKeyOf(failed("git log", "Exit code 128\nfatal: bad object 9f0e1d2c in /tmp/b/wt-ISS-845/y.mjs at 09:01", "git"));
  assert.equal(monday, "git · exit 128: fatal: bad object <sha> in <path> at N:N");
  assert.equal(monday, tuesday, "a path, a hash, an issue key and a time move nothing");
  assert.notEqual(errorKeyOf(failed("git x", "Exit code 128\nfatal: not a git repository", "git")), monday,
    "two different failures of one class are two rows");
  assert.notEqual(errorKeyOf(failed("git x", "Exit code 1\nfatal: bad object 1234abcd", "git")), monday,
    "and so are two exits of one failure");
  assert.equal(errorKeyOf(failed("npm test", "Exit code 1\n\n", "test")), "test · exit 1", "no line leaves the exit");
  assert.equal(errorKeyOf({ name: "Monitor", class: "monitor", error: true, body: "<tool_use_error>InputValidationError: bad</tool_use_error>" }),
    "monitor: InputValidationError: bad", "a tool with no exit keys on its line alone");
});

test("a declared answer table is refused where the reader could not use it, naming the key", () => {
  assert.equal(answersProblem({ 1: { probe: "make[ \\t]+probe" } }), null);
  assert.equal(answersProblem({}), null, "a project may declare that nothing is an answer");
  assert.equal(answersProblem({ 300: { x: "pgrep" } }).key, "stats.answers.300");
  assert.equal(answersProblem({ one: { x: "pgrep" } }).key, "stats.answers.one");
  assert.equal(answersProblem({ 1: { bad: "(" } }).key, "stats.answers.1.bad");
  assert.equal(answersProblem({ 1: ["pgrep"] }).key, "stats.answers.1");
  assert.equal(answersProblem(["pgrep"]).key, "stats.answers");
});

const OPENING = JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-7" } });

const corpusOf = (project, calls) => {
  const room = tempRoom("stats-answers-");
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(project), "session-one", "tasks");
  mkdirSync(tasks, { recursive: true });
  const lines = calls.flatMap(([command, body], index) => [
    use(`a${index}`, 10 + index * 10, "Bash", { command }),
    result(`a${index}`, 15 + index * 10, body, true),
  ]);
  writeFileSync(join(tasks, "a0001.output"), `${[OPENING, use("c", 5, "Bash", { command: "forge claim ISS-7" }),
    result("c", 6, "claimed"), ...lines].join("\n")}\n`);
  return room;
};

const CALLS = [
  ["pgrep -f 'tools/run.mjs ship'", "Exit code 1\n"],
  ["grep -q '^exit ' /tmp/gate.log", "Exit code 1\n"],
  ["timeout 590 tail --pid=4242 -f /dev/null", "Exit code 124\n"],
  ["git diff --quiet HEAD", "Exit code 1\n"],
  ["node tools/red.mjs plugin/test/a.test.mjs 'a case'", "Exit code 1\n"],
  ["make probe", "Exit code 1\nprobe: nothing listening"],
  ["node --test plugin/test/a.test.mjs", "Exit code 1\n# fail 1"],
];

const readingOf = (declared) => {
  const home = tempRoom("stats-answers-home-");
  const project = projectRoom(tempRoom("stats-answers-project-"), home, { slug: "fixture", ...declared });
  const run = askedIn(corpusOf(project, CALLS), home, "--checkout", project, "--json");
  assert.equal(run.status, 0, run.stderr);
  const held = JSON.parse(run.stdout);
  return { answers: Object.fromEntries(held.answers ?? []), errors: Object.fromEntries(held.errors), rows: held.errorRows };
};

test("an exit that is the command's answer is counted apart from the errors, by the project's own table where it declared one", () => {
  const built = readingOf({});
  assert.deepEqual(built.answers, {
    "pgrep, exit 1": 1, "grep -q, exit 1": 1, "timeout on a tail --pid wait, exit 124": 1,
    "git --quiet or --is-ancestor, exit 1": 1, "tools/red.mjs, exit 1": 1,
  });
  assert.deepEqual(built.errors, { "shell · exit 1: probe: nothing listening": 1, "test · exit 1: # fail N": 1 },
    "a failure is an error, filed under what failed");
  assert.equal(built.rows, 2, "the reading carries the generation its error rows were keyed at");

  const own = readingOf({ stats: { answers: { 1: { "make probe": "make[ \\t]+probe" } } } });
  assert.deepEqual(own.answers, { "make probe, exit 1": 1 }, "the project's table is the one read");
  assert.equal(own.errors["poll · exit 1"], 1, "and it replaces the built-in one, so a pgrep's 1 is an error there");
});

test("an answer table the reader cannot use is refused rather than read as the built-in one", () => {
  const home = tempRoom("stats-answers-home-");
  const project = projectRoom(tempRoom("stats-answers-project-"), home,
    { slug: "fixture", stats: { answers: { 1: { broken: "(" } } } });
  const run = askedIn(corpusOf(project, CALLS), home, "--checkout", project);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /`stats\.answers\.1\.broken` in the project configuration of .* is a regular expression this CLI can compile/u, run.stderr);
  assert.match(run.stderr, /forge doctor --set stats\.answers\.<exit code>\.<name>=<pattern>/u, "and it names the write that clears it");
});
