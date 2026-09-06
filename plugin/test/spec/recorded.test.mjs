/* R-10, the one rule of the tree that compares what a clause says now with what it said then. Every
   case below is a tree that breaks it and a record that does not, because a comparison with nothing
   recorded reads exactly like a tree with nothing wrong. The CLI cases run in a fixture project,
   since the record's storage and the flag that writes it are outside the module that judges it. */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { clauseIndex } from "../../src/spec/index.mjs";
import { RECORD, entriesOf, malformedIn, movedIn, recordProblems } from "../../src/spec/recorded.mjs";
import { TREE } from "../../src/spec/tree.mjs";
import { tempRoom } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const scratch = [];
const temporary = (prefix) => {
  const dir = tempRoom(prefix);
  scratch.push(dir);
  return dir;
};
after(() => scratch.forEach((dir) => rmSync(dir, { force: true, recursive: true })));

const REQUIREMENT = `# SRS §3 — FR-01 — The first capability

Rev: 1 · Actors: agent · Enforces: BR-01

## Purpose

*Why does this requirement exist?*

Because a clause nobody can cite is a clause nobody can trace.

## Use cases

*What has to exist?*

### UC-01-1 — A clause read by its identifier

Rev: 1 · Actors: agent · Enforces: BR-01

The identifier is the whole surface, and AC-01-1-1~1 is the criterion that says so.

- **AC-01-1-1** · Rev: 1 · Proof: none yet — ISS-99
  WHEN a clause is asked for THEN the CLI SHALL print it.
`;

const BUSINESS_RULES = `# BRD §4 — Business rules

## The rules

*Which rules hold whatever the software is asked to do?*

| Rule | Name | Stated in |
|---|---|---|
| **BR-01** | the shape of a refusal | \`CLAUDE.md\` |
`;

const DOCUMENTS = [
  { file: "docs/requirements/srs/fr-01-first.md", text: REQUIREMENT },
  { file: "docs/requirements/brd/04-business-rules.md", text: BUSINESS_RULES },
];

const FILE = `${TREE}/${RECORD}`;

const treeOf = (documents) => ({ documents, index: clauseIndex(documents) });

const reworded = (text, from, to) => {
  assert.ok(text.includes(from), `the fixture no longer carries "${from}"`);
  return text.replace(from, to);
};

const withRequirement = (text) => [{ ...DOCUMENTS[0], text }, DOCUMENTS[1]];

const recordedAs = (clauses) => ({ file: FILE, clauses, why: null });

const said = (documents, recorded) =>
  recordProblems({ ...treeOf(documents), recorded }).map((one) => `${one.file}:${one.line} ${one.id} ${one.rule} ${one.fix}`);

const CURRENT = entriesOf(treeOf(DOCUMENTS).index).clauses;

test("the record covers every clause carrying a revision, in document order, and no clause without one", () => {
  assert.deepEqual(Object.keys(CURRENT), ["FR-01", "UC-01-1", "AC-01-1-1"]);
  for (const entry of Object.values(CURRENT)) {
    assert.equal(entry.rev, 1);
    assert.match(entry.digest, /^[0-9a-f]{64}$/u);
  }
  assert.equal(CURRENT["BR-01"], undefined, "a row with no Rev column carries no revision to record");
});

test("the tree this record was written from raises nothing", () => {
  assert.deepEqual(said(DOCUMENTS, recordedAs(CURRENT)), []);
});

/* The case the rule exists for: the words moved and the revision did not, so every citation of that
   clause is a claim about text that is gone. Without the comparison this tree is green. */
test("a citation of a clause whose words moved at the same revision is suspect", () => {
  const moved = withRequirement(reworded(REQUIREMENT,
    "WHEN a clause is asked for THEN the CLI SHALL print it.",
    "WHEN a clause is asked for THEN the CLI SHALL print it and everything under it."));
  const found = said(moved, recordedAs(CURRENT));
  const suspect = found.filter((one) => one.includes("is suspect"));
  assert.equal(suspect.length, 1, found.join(" · "));
  assert.match(suspect[0], /^docs\/requirements\/srs\/fr-01-first\.md:19 AC-01-1-1~1 R-10 is suspect/u);
  assert.match(suspect[0], /AC-01-1-1 is at revision 1 and its words have moved/u);
  assert.match(suspect[0], /Bump the clause's revision, which drops the verdicts that cited revision 1/u,
    "the first route out");
  assert.match(suspect[0], /re-record with `forge spec check --record`/u, "and the second");
  assert.deepEqual(said(moved, recordedAs(entriesOf(treeOf(moved).index).clauses)), [],
    "and re-recording is what clears it");
});

/* Found by moving a clause of this repository's own tree that nothing cites: the entry was there at
   the right revision, so coverage passed, and with no citation to call suspect the gate said the
   record was fine while it held a fingerprint of words that were gone. */
test("a clause whose words moved is the record's drift, whether or not anything cites it", () => {
  const moved = withRequirement(reworded(REQUIREMENT,
    "Because a clause nobody can cite is a clause nobody can trace.",
    "Because a clause nobody can cite is a clause nobody can trace, and tracing is the point."));
  const found = said(moved, recordedAs(CURRENT));
  assert.deepEqual(found.filter((one) => one.includes("is suspect")), [], "FR-01 is cited by nothing");
  assert.equal(found.length, 1, found.join(" · "));
  assert.match(found[0], new RegExp(`^${FILE}:1 FR-01 R-10 is at revision 1 and the digest recorded`, "u"));
  assert.match(found[0], /for that revision is not this clause's words now/u);
  assert.match(found[0], /Bump the clause's revision, .* or re-record with `forge spec check --record`/u);
});

/* Stale and suspect are two words for two failures: a citation at a revision the clause has left is
   the reader's to call stale, and this rule says nothing about it. */
test("a citation at a revision the clause has left raises no suspicion, only an uncovered record", () => {
  const bumped = withRequirement(reworded(reworded(REQUIREMENT,
    "- **AC-01-1-1** · Rev: 1", "- **AC-01-1-1** · Rev: 2"),
  "WHEN a clause is asked for THEN the CLI SHALL print it.",
  "WHEN a clause is asked for THEN the CLI SHALL print it and everything under it."));
  const found = said(bumped, recordedAs(CURRENT));
  assert.deepEqual(found.filter((one) => one.includes("suspect")), [], found.join(" · "));
  assert.equal(found.length, 1, found.join(" · "));
  assert.match(found[0], /AC-01-1-1 R-10 is at revision 2 and the digest recorded for it is revision 1's/u);
});

test("a clause the record does not reach, and an entry the tree no longer carries, are each a finding", () => {
  const { "AC-01-1-1": dropped, ...rest } = CURRENT;
  assert.ok(dropped, "the fixture carries the clause this case removes from the record");
  const found = said(DOCUMENTS, recordedAs({ ...rest, "AC-09-9-9": { rev: 1, digest: "0".repeat(64) } }));
  assert.deepEqual(found.map((one) => one.split(" ").slice(0, 3).join(" ")),
    [`${FILE}:1 AC-01-1-1 R-10`, `${FILE}:1 AC-09-9-9 R-10`], found.join(" · "));
  assert.match(found[0], /covers no revision of it\. Re-record with `forge spec check --record`/u);
  assert.match(found[1], /this tree defines no clause of that identifier/u);
});

test("a record that is not there is one finding naming the file, never one per clause", () => {
  const found = said(DOCUMENTS, { file: FILE, clauses: null, why: "is not there" });
  assert.deepEqual(found.map((one) => one.split(" ").slice(0, 3).join(" ")), [`${FILE}:1 digests.json R-10`]);
  assert.match(found[0], /records the digest of every clause of this tree and is not there/u);
  assert.match(found[0], /Write it with `forge spec check --record`/u);
});

/* An entry that kept its revision and lost its digest is covered and compared by nothing, so a
   reader that took it would pass a clause with no fingerprint whether or not anything cites it
   (consult 4d4dcb F1). The record is generated, so this shape is a hand edit or a bad merge. */
test("an entry that is not a revision and a digest is what the whole record is refused on", () => {
  for (const broken of [{ rev: 1 }, { rev: 1, digest: "short" }, { rev: "1", digest: "0".repeat(64) }, null]) {
    assert.equal(malformedIn({ ...CURRENT, "AC-01-1-1": broken }), "AC-01-1-1", JSON.stringify(broken));
  }
  assert.equal(malformedIn(CURRENT), null, "and a record the writer wrote is not refused");
});

test("a tree with no clause carrying a revision owes no record at all", () => {
  assert.deepEqual(said([DOCUMENTS[1]], { file: FILE, clauses: null, why: "is not there" }), []);
});

test("the writer names the entries that moved, one line each, and says nothing about the rest", () => {
  const { "FR-01": kept, "UC-01-1": bumped, ...rest } = CURRENT;
  const held = { ...rest, "FR-01": kept, "UC-01-1": { rev: 0, digest: bumped.digest }, "EI-09": { rev: 1, digest: "x" } };
  const want = { ...CURRENT, "AC-01-1-1": { rev: 1, digest: "moved" }, "NFR-02": { rev: 4, digest: "new" } };
  assert.deepEqual(movedIn(held, want).sort(), [
    "  + NFR-02 at revision 4",
    "  - EI-09, which this tree no longer carries",
    "  ~ AC-01-1-1 at revision 1, its words having moved",
    "  ~ UC-01-1 from revision 0 to 1",
  ]);
  assert.deepEqual(movedIn(CURRENT, CURRENT), [], "an unchanged tree moves nothing");
});

const project = (prefix, withTree) => {
  const root = temporary(prefix);
  writeFileSync(join(root, ".forge.json"), '{"slug":"recorded-fixture"}');
  if (withTree) {
    for (const { file, text } of DOCUMENTS) {
      mkdirSync(join(root, file, ".."), { recursive: true });
      writeFileSync(join(root, file), text);
    }
  }
  return root;
};

const ran = (root, argv) => spawnSync(FORGE, ["spec", "check", ...argv], { encoding: "utf8", cwd: root });

test("--record writes the file, names what it wrote, and the check then reports no R-10 finding", () => {
  const root = project("recorded-write-", true);
  const wrote = ran(root, ["--record"]);
  assert.equal(wrote.status, 0, wrote.stdout + wrote.stderr);
  assert.match(wrote.stdout, /docs\/requirements\/digests\.json: 3 clause\(s\), 3 moved\./u);
  assert.match(wrote.stdout, /\+ AC-01-1-1 at revision 1/u);
  assert.deepEqual(wrote.stdout.split("\n").filter((one) => one.includes("R-10")), [],
    "the record it just wrote covers the tree it was written from");
  const held = JSON.parse(readFileSync(join(root, TREE, RECORD), "utf8"));
  assert.deepEqual(Object.keys(held.clauses), ["FR-01", "UC-01-1", "AC-01-1-1"]);
  assert.match(held.note, /forge spec check --record/u);
});

test("and a clause reworded after the write makes the citation of it suspect at the CLI", () => {
  const root = project("recorded-suspect-", true);
  ran(root, ["--record"]);
  writeFileSync(join(root, TREE, "srs", "fr-01-first.md"), reworded(REQUIREMENT,
    "WHEN a clause is asked for THEN the CLI SHALL print it.",
    "WHEN a clause is asked for THEN the CLI SHALL print it and everything under it."));
  const found = ran(root, []);
  assert.equal(found.status, 1);
  const printed = found.stdout.trim().split("\n");
  assert.equal(printed.length, 2, "the reworded clause is the whole of what this tree gets wrong");
  assert.match(found.stderr, /^2 finding\(s\) in 2 document\(s\)\./mu);
  const [drifted, line] = printed;
  assert.match(drifted, /digests\.json:1 {2}AC-01-1-1 {2}R-10 {2}is at revision 1 and the digest recorded/u,
    "the record itself no longer records the clause");
  assert.match(line, /fr-01-first\.md:19 {2}AC-01-1-1~1 {2}R-10 {2}is suspect/u, found.stdout);
  assert.match(line, /or re-record with `forge spec check --record`, which clears the suspicion/u);
});

/* The cited clause and an uncited one, because the two go wrong differently: without the refusal one
   would be read as words that moved and the other as a tree with nothing wrong. */
for (const id of ["AC-01-1-1", "FR-01"]) {
  test(`a record whose ${id} entry lost its digest is refused at the CLI, whatever cites it`, () => {
    const root = project(`recorded-broken-${id}-`, true);
    ran(root, ["--record"]);
    const path = join(root, TREE, RECORD);
    const held = JSON.parse(readFileSync(path, "utf8"));
    delete held.clauses[id].digest;
    writeFileSync(path, JSON.stringify(held, null, 2));
    const found = ran(root, []);
    assert.equal(found.status, 1);
    const printed = found.stdout.trim().split("\n");
    assert.equal(printed.length, 1, found.stdout);
    assert.match(printed[0], /digests\.json:1 {2}digests\.json {2}R-10 {2}records the digest of every clause/u);
    assert.match(printed[0], new RegExp(`and has no revision and digest for ${id}\\.`, "u"));
    assert.doesNotMatch(printed[0], /suspect/u, "and never as words that moved");
  });
}

test("a project keeping no requirements tree is written nothing and told nothing", () => {
  const wrote = ran(project("recorded-none-", false), ["--record"]);
  assert.equal(wrote.status, 0);
  assert.equal(wrote.stdout, "");
});

test("the flag is the only argument the sub-verb takes", () => {
  const refused = ran(project("recorded-argv-", true), ["--record", "FR-01"]);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /reads the whole tree and takes no argument but --record, not `FR-01`/u);
});

/* A fixture proves the notation and never the tree: this is the case that reads the record this
   repository actually commits, against the clauses it actually carries. */
test("this repository's own record covers its own tree, and no citation in it is suspect", () => {
  const root = new URL("../../..", import.meta.url).pathname;
  const walk = (dir, out = []) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path, out);
      else if (name.endsWith(".md")) out.push(path);
    }
    return out;
  };
  const documents = walk(join(root, TREE)).map((path) => ({ file: relative(root, path), text: readFileSync(path, "utf8") }));
  assert.ok(documents.length >= 20, `${documents.length} document(s) read; the walk found nothing`);
  const clauses = JSON.parse(readFileSync(join(root, TREE, RECORD), "utf8")).clauses;
  assert.deepEqual(said(documents, { file: FILE, clauses, why: null }), []);
  assert.ok(Object.keys(clauses).length >= 50, `${Object.keys(clauses).length} clause(s) recorded`);
});
