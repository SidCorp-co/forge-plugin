/* A citation resolved at a write is the tree's notation read outside the tree, so the cases here
   are the ways a reference fails and the boundary that keeps the writer's reader from moving what a
   clause hashes. Every index is built from fixture text: the resolver reads no file. */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRoom } from "../fixtures.mjs";

const scratch = [];
const temporary = (prefix) => {
  const dir = tempRoom(prefix);
  scratch.push(dir);
  return dir;
};
after(() => scratch.forEach((dir) => rmSync(dir, { force: true, recursive: true })));

process.env.XDG_CONFIG_HOME = temporary("citation-");
const { citationsIn, identifiersIn } = await import("../../src/spec/parse.mjs");
const { clauseIndex } = await import("../../src/spec/index.mjs");
const { TREE } = await import("../../src/spec/tree.mjs");
const {
  citationProblems, citationRefusal, revisionSaid, unrevisionedIn,
} = await import("../../src/spec/citation.mjs");

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;

const REQUIREMENT = `# SRS §3 — FR-01 — The first capability

Rev: 2 · Actors: agent · Enforces: BR-01

## Purpose

*Why does this requirement exist?*

Because a clause nobody can cite is a clause nobody can trace.

## Use cases

*What has to exist?*

### UC-01-1 — A clause read by its identifier

Rev: 1 · Actors: agent · Enforces: BR-01

The identifier is the whole surface.

- **AC-01-1-1** · Rev: 1 · Proof: none yet — ISS-99
  WHEN a clause is asked for THEN the CLI SHALL print it.
- **AC-01-1-2** · Rev: 3 · Proof: none yet — ISS-99
  IF the identifier is unknown THEN the CLI SHALL refuse.
`;

const RULES = `# BRD §4 — Business rules

## The rules

*Which rules hold whatever the software is asked to do?*

| Rule | Rev | Name |
|---|---|---|
| **BR-01** | 1 | the shape of a refusal |

| Goal | Met by |
|---|---|
| **G-01** A status is earned by a record. | FR-01 |
`;

const tree = () => clauseIndex([
  { file: "srs/fr-01-first.md", text: REQUIREMENT },
  { file: "brd/04-business-rules.md", text: RULES },
]);

const problems = (text) => citationProblems(tree(), text);

test("a citation naming no clause is refused with the nearest identifiers", () => {
  const said = problems("this serves AC-01-1-9~1");
  assert.equal(said.length, 1);
  assert.match(said[0], /No clause named AC-01-1-9/u);
  assert.match(said[0], /AC-01-1-1/u, "and the clauses it might have meant");
});

test("a citation at a revision the clause has moved past names the revision it is at now", () => {
  const said = problems("this serves AC-01-1-2~1");
  assert.equal(said.length, 1);
  assert.match(said[0], /AC-01-1-2~1 is stale/u);
  assert.match(said[0], /at revision 3, not 1/u);
  assert.match(said[0], /cite AC-01-1-2~3/u, "and what to write instead");
});

test("a citation of a clause with no revision column is told that, not called stale", () => {
  const said = problems("this serves G-01~1");
  assert.equal(said.length, 1);
  assert.match(said[0], /names a revision and G-01 carries none/u);
  assert.ok(!said[0].includes("stale"), said[0]);
});

test("a rule of the tree's own index is named as one and never looked up as a clause", () => {
  const said = problems("this serves R-10~1");
  assert.equal(said.length, 1);
  assert.match(said[0], /R-10 names a rule of this tree/u);
  assert.match(said[0], /not a clause of the specification/u);
});

/* The fix a refusal names has to clear it: retiring a clause keeps its number (R-12), so the only
   thing that gives an identifier one home is the second definition becoming a reference. */
test("a clause two documents define is refused as two, and citing it from one of them clears that", () => {
  const twice = clauseIndex([
    { file: "srs/fr-01-first.md", text: REQUIREMENT },
    { file: "srs/fr-01-copy.md", text: REQUIREMENT },
  ]);
  const said = citationProblems(twice, "this serves FR-01~2");
  assert.equal(said.length, 1);
  assert.match(said[0], /defined in srs\/fr-01-first\.md and srs\/fr-01-copy\.md/u);
  assert.match(said[0], /keep the clause in one document and cite it from the other/u);
  const retired = clauseIndex([
    { file: "srs/fr-01-first.md", text: REQUIREMENT },
    { file: "srs/fr-01-copy.md", text: REQUIREMENT.replace("Rev: 2 ·", "Rev: 2 · Status: retired ·") },
  ]);
  assert.equal(citationProblems(retired, "this serves FR-01~2").length, 1, "a retired clause is a second home still");
  const referenced = clauseIndex([
    { file: "srs/fr-01-first.md", text: REQUIREMENT },
    { file: "srs/fr-01-copy.md", text: "# SRS §4 — FR-02 — The second\n\nRev: 1 · Enforces: BR-01\n\nIt extends FR-01~2.\n" },
  ]);
  assert.deepEqual(citationProblems(referenced, "this serves FR-01~2"), [], "the fix the refusal names is one that clears it");
});

test("a citation that resolves at the revision it names is no problem, and is said twice as once", () => {
  assert.deepEqual(problems("this serves UC-01-1~1 and again UC-01-1~1"), []);
  assert.equal(problems("AC-01-1-9~1 and AC-01-1-9~1").length, 1, "one wrong citation is one sentence");
  assert.equal(citationRefusal([]), null);
  assert.match(citationRefusal(["what went wrong"]), /nothing was written/u);
});

test("an identifier written with no revision is said and never refused, and only where it resolves", () => {
  const index = tree();
  assert.deepEqual(unrevisionedIn(index, "this serves UC-01-1 and FR-01"), ["UC-01-1", "FR-01"]);
  assert.deepEqual(unrevisionedIn(index, "this serves AC-01-1-9"), [], "an identifier naming nothing is not an unrevised citation");
  assert.deepEqual(unrevisionedIn(index, "this serves UC-01-1~1"), [], "and neither is one that carries its revision");
  assert.deepEqual(citationProblems(index, "this serves AC-01-1-9"), [], "a bare identifier makes no citation to refuse");
  assert.match(revisionSaid(["UC-01-1"]), /names a clause and carries no revision/u);
  assert.match(revisionSaid(["UC-01-1", "FR-01"]), /name clauses and carry no revision/u);
  assert.equal(revisionSaid([]), null);
});

/* The boundary F1 of consult bd9e1c named: the writer has to see `R-10~1` to refuse it, and every
   clause of every tree hashes `citationsIn`'s answer, so widening one must not widen the other. */
test("the tree's own rules are identifiers to the writer and citations to no clause", () => {
  assert.deepEqual(citationsIn("R-10~1"), [], "a rule of the index is no clause's citation");
  assert.deepEqual(identifiersIn("R-10~1"), [{ id: "R-10", prefix: "R", rev: 1 }]);
  assert.deepEqual(citationsIn("AC-01-1-2~3"), [{ id: "AC-01-1-2", rev: 3 }], "and a clause's is unchanged");
  assert.deepEqual(citationsIn("AC-01-1-2"), [], "a revision is what makes a citation");
  assert.deepEqual(identifiersIn("AR-01~1"), [], "and a prefix that is not one is not read as one");
});

test("the resolver reads no file, so what it answers is the index it was handed", () => {
  const source = readFileSync(new URL("../../src/spec/citation.mjs", import.meta.url), "utf8");
  assert.ok(!/node:fs/u.test(source), "a resolver that reads the checkout cannot be proven on a fixture");
});

const project = (prefix, withTree) => {
  const root = temporary(prefix);
  writeFileSync(join(root, ".forge.json"), '{"slug":"citation-fixture"}');
  if (withTree) {
    const srs = join(root, TREE, "srs");
    mkdirSync(srs, { recursive: true });
    writeFileSync(join(srs, "fr-01-first.md"), REQUIREMENT);
  }
  return root;
};

/* The verb's next step after the check is the tracker, and a temporary config directory holds no
   endpoint: a run that reached this refusal is a run the citation check let through. */
const REACHED_THE_TRACKER = /No Forge endpoint/u;

const planned = (root, text) => {
  const file = join(root, "plan.md");
  writeFileSync(file, text);
  return spawnSync(FORGE, ["plan", "ISS-1", file], {
    encoding: "utf8",
    cwd: root,
    env: { ...process.env, FORGE_CODEX_DISABLE: "1" },
  });
};

test("the plan verb refuses a citation that does not resolve, before anything is sent", () => {
  const run = planned(project("plan-tree-", true), "Screen change: no\n\nThis serves AC-01-1-9~1.\n");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /nothing was written/u);
  assert.match(run.stderr, /No clause named AC-01-1-9/u);
});

test("the plan verb says R-10 for a bare identifier and does not refuse the write for it", () => {
  const run = planned(project("plan-bare-", true), "Screen change: no\n\nThis serves UC-01-1.\n");
  assert.match(run.stderr, /R-10 asks for/u);
  assert.match(run.stderr, REACHED_THE_TRACKER, "a said line stops nothing");
});

test("a plan whose citations resolve says nothing about citations", () => {
  const run = planned(project("plan-clean-", true), "Screen change: no\n\nThis serves UC-01-1~1.\n");
  assert.match(run.stderr, REACHED_THE_TRACKER);
  assert.ok(!run.stderr.includes("R-10"), run.stderr);
});

test("a project with no requirements tree reads none, and its plans are written as they were", () => {
  const run = planned(project("plan-no-tree-", false), "Screen change: no\n\nThis serves AC-01-1-9~1.\n");
  assert.match(run.stderr, REACHED_THE_TRACKER, "the citation nothing resolved it against never refused it");
  assert.ok(!run.stderr.includes(TREE), `a project with no tree is never told about one: ${run.stderr}`);
});
