/* The tree's notation left a reader several readings, and each narrow one below is a rule the
   parser holds: without it the case here answers with a clause nobody asked for. */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* A fixture directory left behind is a directory left behind on every run: the quota on `/tmp` is
   what a run reaching it loses, and it takes the whole shell with it. */
const scratch = [];
const temporary = (prefix) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
};
after(() => scratch.forEach((dir) => rmSync(dir, { force: true, recursive: true })));

process.env.XDG_CONFIG_HOME = temporary("spec-");
const { citationsIn, clausesOf, digest, fieldsOf, normalise, parseRef } = await import("../../src/spec/parse.mjs");
const { ambiguousUnder, clauseIndex, lookup, nearest, withDescendants } = await import("../../src/spec/index.mjs");
const { TREE } = await import("../../src/spec/tree.mjs");
const { usageOf } = await import("../../src/resolve/visibility.mjs");

const ROOT = new URL("../../..", import.meta.url).pathname;
const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const ask = (...argv) => spawnSync(FORGE, argv, { encoding: "utf8", env: process.env, cwd: ROOT });

const REQUIREMENT = `# SRS §3 — FR-01 — The first capability

**Status: proposal for \`forge spec\`.** Nothing below is built,
and the issue owing each clause is named beside it.

Rev: 2 · Actors: agent · Enforces: BR-01, BR-02 · Source: docs/x.md

← [Index](./README.md) · Next: [§4 FR-02](./b.md)

## Purpose

*Why does this requirement exist?*

Because a clause nobody can cite is a clause nobody can trace.

## Use cases

*What has to exist?*

### UC-01-1 — A clause read by its identifier

Rev: 1 · Actors: agent · Enforces: BR-01

The identifier is the whole surface, as UC-01-1~1 already claimed.

- **AC-01-1-1** · Rev: 1 · Proof: plugin/test/spec.test.mjs
  WHEN a clause is asked for THEN the CLI SHALL print it.
- **AC-01-1-2** · Rev: 3 · Proof: none yet — ISS-99
  IF the identifier is unknown THEN the CLI SHALL refuse.

## The way back

*What undoes a change here?*

Nothing, and this sentence belongs to no clause of the file.
`;

const NON_FUNCTIONAL = `# SRS §17 — Non-functional requirements

## What holds across every requirement

*Which qualities are not any one capability's?*

### NFR-02 — A gate fails open

Rev: 1 · Enforces: BR-02

The failure in this direction is undetectable.

- **AC-17-2-1** · Rev: 1 · Proof: plugin/test/hook-switch.test.mjs
  IF the switch cannot be read THEN every gate SHALL run.
`;

const RULES = `# BRD §4 — Business rules

## The rules

*Which rules hold whatever the software is asked to do?*

| Rule | Rev | Name | Stated in |
|---|---|---|---|
| **BR-01** | 1 | the shape of a refusal | CLAUDE.md |
| **BR-02** | 2 | the record as the only witness | the contract |

| Goal | Met by |
|---|---|
| **G-01** A status is earned by a record. | [FR-01](../srs/a.md) |
`;

/* Every requirement closes with a table naming the rules it carries out, in a plain cell. */
const REFERENCES = `## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-01 | a missing field is refused by name |
| BR-02 | every payload is on the record |
`;

const tree = () =>
  clauseIndex([
    { file: "srs/fr-01-first.md", text: REQUIREMENT },
    { file: "srs/17-nfr.md", text: NON_FUNCTIONAL },
    { file: "brd/04-business-rules.md", text: RULES },
  ]);

const held = (index, id) => index.clauses.get(id);

test("a requirement carries the field line after its proposal paragraph, and its own text stops at its first use case", () => {
  const index = tree();
  const fr = held(index, "FR-01");
  assert.equal(fr.rev, 2, "the proposal paragraph is two lines, and the field line follows it");
  assert.equal(fr.title, "The first capability");
  assert.deepEqual(fr.enforces, ["BR-01", "BR-02"]);
  assert.equal(fr.fields.Source, "docs/x.md");
  assert.match(fr.text, /^## Purpose/u, "a section heading inside a clause is part of it");
  assert.match(fr.text, /## Use cases/u);
  assert.ok(!fr.text.includes("Rev: 2"), "its own field line is not its text");
  assert.ok(!fr.text.includes("← "), "and neither is the navigation line");
  assert.ok(!fr.text.includes("A clause read by its identifier"), "a use case is a clause, not prose");
  assert.ok(!fr.text.includes("belongs to no clause"), "and the sections after the last clause are the file's");
  for (const clause of index.clauses.values()) {
    assert.ok(!clause.text.includes("belongs to no clause"), `${clause.id} swallowed a closing section`);
  }
});

test("a clause's children and parent come from the document, and a criterion is its own clause", () => {
  const index = tree();
  assert.deepEqual(held(index, "FR-01").children, ["UC-01-1"]);
  assert.deepEqual(held(index, "UC-01-1").parents, ["FR-01"]);
  assert.deepEqual(held(index, "UC-01-1").children, ["AC-01-1-1", "AC-01-1-2"]);
  const criterion = held(index, "AC-01-1-1");
  assert.equal(criterion.text, "WHEN a clause is asked for THEN the CLI SHALL print it.");
  assert.equal(criterion.fields.Proof, "plugin/test/spec.test.mjs");
  assert.equal(held(index, "AC-01-1-2").rev, 3, "a criterion carries its own revision");
  assert.deepEqual(
    withDescendants(index, "FR-01").map((one) => one.id),
    ["FR-01", "UC-01-1", "AC-01-1-1", "AC-01-1-2"],
  );
});

/* A criterion of a non-functional requirement is numbered from its section, so `17` names no
   requirement: arithmetic on the identifier answers with a clause that does not exist. */
test("a criterion numbered from a section belongs to the clause that encloses it", () => {
  const index = tree();
  assert.deepEqual(held(index, "AC-17-2-1").parents, ["NFR-02"]);
  assert.deepEqual(held(index, "NFR-02").children, ["AC-17-2-1"]);
  assert.equal(held(index, "NFR-02").kind, "non-functional requirement");
});

test("a table row defines a clause where its identifier is emphasised, and a plain one references it", () => {
  const plain = clausesOf(REFERENCES);
  assert.deepEqual(plain, [], "every requirement's closing table would otherwise redefine the rules");
  const index = clauseIndex([
    { file: "brd/04-business-rules.md", text: RULES },
    { file: "srs/fr-01-first.md", text: `${REQUIREMENT}\n${REFERENCES}` },
  ]);
  assert.deepEqual([...index.duplicates.keys()], [], "and a reference is no second definition");
  assert.equal(held(index, "BR-01").title, "the shape of a refusal");
  assert.equal(held(index, "BR-01").rev, 1);
  assert.equal(held(index, "BR-01").fields["Stated in"], "CLAUDE.md");
  assert.deepEqual(held(index, "BR-01").enforcedBy, ["FR-01", "UC-01-1"]);
  assert.deepEqual(held(index, "BR-02").enforcedBy, ["FR-01"]);
});

test("a sequence whose table has no revision column carries none, rather than a revision of zero", () => {
  const index = tree();
  assert.equal(held(index, "G-01").rev, null);
  assert.equal(held(index, "G-01").title, "A status is earned by a record.");
  assert.equal(held(index, "G-01").fields["Met by"], "[FR-01](../srs/a.md)");
  assert.equal(held(index, "BR-02").rev, 2, "and one whose table has the column carries it");
});

test("an identifier two documents define is ambiguous, and neither answer is given", () => {
  const index = clauseIndex([
    { file: "srs/fr-01-first.md", text: REQUIREMENT },
    { file: "srs/fr-01-copy.md", text: REQUIREMENT },
  ]);
  assert.deepEqual(index.duplicates.get("FR-01"), ["srs/fr-01-first.md", "srs/fr-01-copy.md"]);
  assert.deepEqual(lookup(index, "FR-01").ambiguous, ["srs/fr-01-first.md", "srs/fr-01-copy.md"]);
  assert.equal(lookup(index, "FR-01").clause, undefined);
});

test("an unknown identifier answers with the nearest ones, and a rule of the tree with what it is", () => {
  const index = tree();
  assert.ok(nearest(index, "FR-02").includes("FR-01"), nearest(index, "FR-02").join(", "));
  assert.ok(lookup(index, "UC-01-9").nearest.includes("UC-01-1"));
  assert.match(lookup(index, "R-10").foreign, /rule of this tree/u);
  assert.equal(lookup(index, "R-10").nearest, undefined, "a known prefix is not a spelling mistake");
});

test("a citation inside a clause is read off it, revision and all", () => {
  const index = tree();
  assert.deepEqual(held(index, "UC-01-1").citations, [{ id: "UC-01-1", rev: 1 }]);
  assert.deepEqual(citationsIn("BR-09~1 and AC-01-1-2~14 and FR-01"), [
    { id: "BR-09", rev: 1 },
    { id: "AC-01-1-2", rev: 14 },
  ]);
  assert.deepEqual(citationsIn("FR-01~1x names nothing"), [], "a malformed citation is not a citation");
});

test("the digest follows the words and not the layout", () => {
  const one = "WHEN a clause is asked for THEN the CLI SHALL print it.";
  assert.equal(digest(one), digest(`WHEN a clause is asked for\n  THEN the CLI   SHALL print it.`));
  assert.equal(digest(one), digest(`**WHEN** a clause is asked for THEN the \`CLI\` SHALL print it.`));
  assert.notEqual(digest(one), digest(one.replace("print", "refuse")));
  assert.notEqual(digest("the status is in_progress"), digest("the status is inprogress"),
    "an underscore is inside words this tree quotes, not emphasis around them");
  assert.match(digest(one), /^[0-9a-f]{64}$/u);
  assert.equal(digest(one), digest(one), "and a second run of the same text is the same digest");
  assert.equal(normalise("- **a** [b](./c.md)  d"), "a b d");
  assert.equal(clausesOf(REQUIREMENT)[0].hash, clausesOf(REQUIREMENT)[0].hash);
});

test("a field line is key and value separated by the tree's own separator, and nothing else is one", () => {
  assert.deepEqual(fieldsOf("Rev: 1 · Proof: none yet — ISS-99"), { Rev: "1", Proof: "none yet — ISS-99" });
  assert.equal(fieldsOf("WHEN a thing happens THEN it SHALL be so"), null);
  assert.equal(fieldsOf("- **The agent**, which reads a clause"), null);
});

test("an identifier is one token, and a path is not one", () => {
  assert.deepEqual(parseRef("FR-04"), { id: "FR-04", prefix: "FR", cited: null });
  assert.deepEqual(parseRef("fr-04~2"), { id: "FR-04", prefix: "FR", cited: 2 });
  assert.deepEqual(parseRef("AC-04-3-1"), { id: "AC-04-3-1", prefix: "AC", cited: null });
  assert.equal(parseRef("NFR-03").prefix, "NFR", "the longer prefix wins over the one inside it");
  assert.equal(parseRef("docs/requirements/README.md"), null);
  assert.equal(parseRef("FR-04~x"), null, "a revision is an integer");
  assert.equal(parseRef("FR-04~1~2"), null, "and a citation names one");
  assert.equal(parseRef("UC-05-3 AC 2"), null, "a criterion is one token, not three");
});

/* R-17 asks every list of clauses to be renderable as a table, so a table is a clause's own
   content: read as structure it vanishes from the text a phase reads and from the digest. */
const WITH_A_TABLE = `### UC-02-1 — A list stated as a table

Rev: 1 · Actors: agent

Every list this clause holds is a table.

| Kind | Read from |
|---|---|
| a requirement | its own file |
| a rule | the business document |

- **AC-02-1-1** · Rev: 1 · Proof: none yet — ISS-99
  WHEN a clause states a list THEN the reader SHALL keep it.
`;

test("a table inside a clause is part of it, and a cell changing changes the digest", () => {
  const [clause, criterion] = clausesOf(WITH_A_TABLE);
  assert.equal(clause.id, "UC-02-1");
  assert.match(clause.text, /^\| a requirement \| its own file \|$/mu);
  assert.match(clause.text, /^\| Kind \| Read from \|$/mu);
  assert.equal(criterion.id, "AC-02-1-1", "and the criterion after it still parses");
  assert.deepEqual(criterion.parents, ["UC-02-1"]);
  const moved = clausesOf(WITH_A_TABLE.replace("the business document", "the specification"))[0];
  assert.notEqual(clause.hash, moved.hash);
});

test("a use case under an identifier two documents define cannot be answered either", () => {
  const index = clauseIndex([
    { file: "srs/fr-01-first.md", text: REQUIREMENT },
    { file: "srs/fr-01-other.md", text: REQUIREMENT.replace(/UC-01-1/gu, "UC-01-2").replace(/AC-01-1-/gu, "AC-01-2-") },
  ]);
  assert.ok(index.clauses.has("UC-01-2"), "the second document's own numbering is indexed");
  const found = lookup(index, "UC-01-2");
  assert.equal(found.clause, undefined, "but which requirement holds it cannot be told");
  assert.equal(found.via, "FR-01");
  assert.deepEqual(found.ambiguous, ["srs/fr-01-first.md", "srs/fr-01-other.md"]);
  assert.equal(lookup(index, "AC-01-2-1").via, "FR-01", "and the ambiguity reaches its criteria");
});

test("a clause two documents define is left out of its parent's answer, not picked between", () => {
  const index = clauseIndex([
    { file: "srs/fr-01-first.md", text: REQUIREMENT },
    { file: "srs/fr-02-other.md", text: REQUIREMENT.replace("FR-01", "FR-02") },
  ]);
  assert.ok(lookup(index, "FR-01").clause, "the requirement itself is unambiguous");
  assert.deepEqual(index.duplicates.get("UC-01-1"), ["srs/fr-01-first.md", "srs/fr-02-other.md"]);
  assert.deepEqual(withDescendants(index, "FR-01").map((one) => one.id), ["FR-01"]);
  assert.deepEqual(ambiguousUnder(index, "FR-01"), ["UC-01-1"]);
  assert.deepEqual(lookup(index, "UC-01-1").ambiguous, ["srs/fr-01-first.md", "srs/fr-02-other.md"]);
  const run = spawnSync(FORGE, ["spec", "BR-01"], { encoding: "utf8", env: process.env, cwd: ROOT });
  assert.ok(!run.stdout.includes("ask for it alone"), "and a tree with no duplicate says none of this");
});

test("a clause under an identifier two documents define is not named by the copy read first", () => {
  const root = temporary("two-homes-");
  const srs = join(root, TREE, "srs");
  const brd = join(root, TREE, "brd");
  mkdirSync(srs, { recursive: true });
  mkdirSync(brd, { recursive: true });
  writeFileSync(join(root, ".forge.json"), '{"slug":"spec-fixture"}');
  writeFileSync(join(srs, "fr-01-first.md"), REQUIREMENT);
  writeFileSync(join(srs, "fr-01-copy.md"), REQUIREMENT.replace(/UC-01-1/gu, "UC-01-2").replace(/AC-01-1-/gu, "AC-01-2-"));
  writeFileSync(join(brd, "04-business-rules.md"), RULES);
  const run = spawnSync(FORGE, ["spec", "BR-01"], { encoding: "utf8", env: process.env, cwd: root });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /FR-01 {2}two documents define this/u, "the rule is enforced by a requirement with two homes");
  assert.match(run.stdout, /UC-01-2 {2}sits under FR-01, which two documents define/u, "and so is its use case");
  assert.ok(!run.stdout.includes("A clause read by its identifier"),
    "a use case under a duplicated requirement is never titled from whichever copy was read first");
});

test("the verb says what to type, with no credential and no tracker", () => {
  const run = ask("spec", "-h");
  assert.equal(run.status, 0, run.stderr);
  assert.ok(run.stdout.includes(usageOf("spec")), run.stdout);
  assert.equal(run.stderr, "", `help is an answer: ${run.stderr}`);
});

test("this repository's own tree answers by identifier", () => {
  const run = ask("spec", "FR-14");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^FR-14 — The requirements tree {2}rev 1$/mu);
  assert.match(run.stdout, /UC-14-2 — A clause read by its identifier/u);
  assert.match(run.stdout, /AC-14-2-4/u, "a requirement prints its criteria too");
  assert.match(run.stdout, /BR-01 {2}the shape of a refusal/u, "and names the rules it enforces");
  assert.ok(!/docs\/requirements\//u.test(run.stdout.split("\n")[0]), "no path where an identifier answers");
});

test("a citation against another revision prints the clause and calls itself stale", () => {
  const run = ask("spec", "AC-14-2-1~9");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /AC-14-2-1~9 is stale: AC-14-2-1 is at revision 1, not 9/u);
  assert.match(run.stdout, /SHALL print that clause/u, "the clause prints anyway");
});

test("the identifier is the whole input, and the data shape is one object per clause", () => {
  const unknown = ask("spec", "FR-99");
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /No clause named FR-99. Did you mean: FR-09/u);
  assert.equal(ask("spec", "--json").status, 1, "an identifier is not optional");
  assert.match(ask("spec", "FR-14", "--nope").stderr, /spec takes no --nope/u);
  assert.match(ask("spec", "FR-14", "UC-14-2").stderr, /one clause at a time/u);
  const first = JSON.parse(ask("spec", "UC-14-2", "--json").stdout);
  assert.equal(first.clauses[0].id, "UC-14-2");
  assert.deepEqual(first.ambiguous, [], "and the shape says so rather than leaving a clause out silently");
  assert.deepEqual(first.clauses.map((one) => one.id).slice(1), first.clauses[0].children);
  assert.deepEqual(Object.keys(first.clauses[0]), [
    "id", "prefix", "kind", "rev", "title", "text", "fields",
    "parents", "children", "enforces", "enforcedBy", "citations", "hash",
  ]);
  assert.equal(first.clauses[0].file, undefined, "a path is asked for, never volunteered");
  const again = JSON.parse(ask("spec", "UC-14-2", "--json", "--where").stdout);
  assert.equal(again.clauses[0].hash, first.clauses[0].hash, "the digest is stable across runs");
  assert.match(again.clauses[0].file, /docs\/requirements\/srs\//u);
});

test("a project with no tree is refused with the directory the reader looked for", () => {
  const elsewhere = spawnSync(FORGE, ["spec", "FR-01"], {
    encoding: "utf8",
    env: process.env,
    cwd: temporary("no-tree-"),
  });
  assert.equal(elsewhere.status, 1);
  assert.match(elsewhere.stderr, /docs\/requirements\//u);
  assert.match(elsewhere.stderr, /ISS-30/u, "and the issue that will scaffold one");
});
