/* A run armed a landing without the checks this project spends before one, and the landing was the
   first thing to run them: nothing it read named them (ISS-2515). The capture that arms nothing is
   read before the one that does, so that is where the project's own list is printed. */
import assert from "node:assert/strict";
import test from "node:test";

import { BUILDER, CHANGED, declared, field, ran } from "./fixture.mjs";

const { readyProblem } = await import("../../../src/flow/landing/ready-checks.mjs");

const CHECKS = ["npm run lint:code-quality", "npm run check:dup"];
const HEADING = /the checks this project declares \(`ready\.checks` in [^)]+\):/u;

test("a plain capture prints every check the project declares, and where the list was read", async () => {
  declared(CHANGED, { ready: { checks: CHECKS } });
  field(null, null);
  const run = await ran(["claim", "ISS-673", "--pushed"], BUILDER, CHANGED);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const said = run.stdout.split("\n");
  const at = said.findIndex((one) => HEADING.test(one));
  assert.notEqual(at, -1, run.stdout);
  assert.match(said[at], /^Before `forge claim ISS-673 --pushed --ready`/u, said[at]);
  assert.match(said[at], /projects\/[^/]+\/config\.json/u, "the file it was read from");
  assert.deepEqual(said.slice(at + 1, at + 1 + CHECKS.length), CHECKS.map((one) => `  ${one}`));
});

test("a project declaring no list hears nothing about one", async () => {
  declared(CHANGED, {});
  field(null, null);
  const run = await ran(["claim", "ISS-673", "--pushed"], BUILDER, CHANGED);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.doesNotMatch(run.stdout, /ready\.checks|--pushed --ready`/u, run.stdout);
});

test("the capture that arms the landing is past the moment the list was for, so it does not print it", async () => {
  declared(CHANGED, { ready: { checks: CHECKS } });
  field(null, null);
  const run = await ran(["claim", "ISS-673", "--pushed", "--ready"], BUILDER, CHANGED);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.doesNotMatch(run.stdout, HEADING, run.stdout);
});

test("a value the key does not take is said on the capture, never read as no list", async () => {
  declared(CHANGED, { ready: { checks: "npm run check:dup" } });
  field(null, null);
  const run = await ran(["claim", "ISS-673", "--pushed"], BUILDER, CHANGED);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /`ready\.checks` in \S+ is a list of one or more commands, none of them blank, not `"npm run check:dup"`/u,
    run.stdout);
  assert.match(run.stdout, /forge doctor --set ready\.checks=<command>,<command>/u, run.stdout);
});

test("the key takes a table holding a list of commands, and nothing else", () => {
  assert.equal(readyProblem(undefined), null, "absent");
  assert.equal(readyProblem({}), null, "a table naming no checks");
  assert.equal(readyProblem({ checks: CHECKS }), null);
  assert.equal(readyProblem([]).key, "ready", "a list where the table goes");
  assert.equal(readyProblem("npm test").key, "ready");
  for (const wrong of ["npm test", [], ["npm test", " "], [3], null]) {
    assert.equal(readyProblem({ checks: wrong })?.key, "ready.checks", JSON.stringify(wrong));
  }
});
