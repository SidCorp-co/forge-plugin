/* The real tree against the real test files, because the rot this holds was three live citations
   nothing could see. The floors below are the point: a Proof reader that matches nothing reports a
   clean tree and reads exactly like one. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

import { casesIn, proofOf, proofProblems } from "../../src/spec/proof.mjs";

const ROOT = new URL("../../..", import.meta.url).pathname;
const TREE = "docs/requirements";

const walk = (dir, out = []) => {
  for (const name of readdirSync(join(ROOT, dir)).sort()) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (name.endsWith(".md")) out.push(rel);
  }
  return out;
};

/* R-19's two bases and no third: the citing document's own directory, then the repository root. A
   reader that tried only one would skip a clause in silence, which is the rot this file holds. */
const read = (path, from = "") => {
  for (const one of [join(ROOT, dirname(from), path), join(ROOT, path)]) {
    if (existsSync(one)) return readFileSync(one, "utf8");
  }
  return null;
};
const documents = walk(TREE).map((file) => ({ file, text: read(file) }));
const proofs = documents
  .flatMap(({ text }) => [...text.matchAll(/^\s*[-*]\s+\*\*AC-[\d-]+\*\*.*Proof:\s*(.*)$/gmu)])
  .map((one) => proofOf(one[1]))
  .filter((one) => one?.path?.endsWith(".test.mjs"));

const clause = (proof) =>
  `## UC-01-1 — A use case\n\nRev: 1\n\n- **AC-01-1-1** · Rev: 1 · Proof: ${proof}\n`
  + "  WHEN a case is named THEN the checker SHALL read it.\n";
const said = (proof, answer = () => "") =>
  proofProblems([{ file: "docs/requirements/srs/fr-01-x.md", text: clause(proof) }], answer);

test("every Proof naming a test file names a case that file declares", () => {
  assert.ok(documents.length > 20, `${documents.length} document(s) under ${TREE}`);
  assert.ok(proofs.length > 150, `${proofs.length} criteria cite a test file; the field reader sees too few`);
  assert.ok(new Set(proofs.map((one) => one.path)).size > 30, "and they are spread over the test tree");
  const found = proofProblems(documents, read);
  assert.deepEqual(found, [], `a Proof names a case nothing holds:\n${found.join("\n")}`);
});

/* The three forms the rot took: the case renamed, the case never named, and a value written by
   hand. Each says which clause, which file and the way out, because the developer who reads it is
   whoever renamed a case in a tree they were not editing. */
test("a case that has gone is a finding naming the clause, the file and the route out", () => {
  const holds = 'test("a case that is there", () => {});\n';
  const found = said('plugin/test/flow/advance.test.mjs "a case that has gone"', () => holds);
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(found[0], /^docs\/requirements\/srs\/fr-01-x\.md:5 AC-01-1-1 names the case/u);
  assert.ok(found[0].includes('"a case that has gone" in plugin/test/flow/advance.test.mjs'), found[0]);
  assert.ok(found[0].endsWith("Rename the case back, or name the case that proves this clause now"), found[0]);
  const near = said('plugin/test/flow/advance.test.mjs "a case that is here"', () => holds);
  assert.ok(near[0].includes('Nearest there: "a case that is there".'), near[0]);
});

test("a Proof naming a test file and no case is a finding, so dropping the name settles nothing", () => {
  const found = said("plugin/test/flow/advance.test.mjs", () => 'test("a case", () => {});\n');
  assert.equal(found.length, 1, found.join("\n"));
  assert.ok(found[0].includes("names no case in it, so nothing fails here when the case does"), found[0]);
  assert.ok(found[0].includes("`none yet` with the issue key"), "and the escape is named beside it");
});

test("a Proof no form reads is reported as unreadable rather than passed over", () => {
  const found = said('plugin/test/flow/advance.test.mjs "a case with no closing');
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(found[0], /has a Proof this checker cannot read/u);
});

test("an escape naming no issue is a finding, so nothing is left unproved and owed to nobody", () => {
  const found = said("none yet");
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(found[0], /names no issue that owes the case/u);
  assert.match(said("none yet, ask Dan")[0], /names no issue that owes the case/u);
});

/* The path is R-19's to resolve and this reader is handed both of R-19's bases, or a clause citing
   a path from its own directory would be read as a file the checkout lacks and skipped. */
test("a cited path is asked for with the document that cited it", () => {
  const asked = [];
  said('plugin/test/flow/advance.test.mjs "a case"', (path, from) => {
    asked.push(`${path} from ${from}`);
    return 'test("a case", () => {});\n';
  });
  assert.deepEqual(asked, ["plugin/test/flow/advance.test.mjs from docs/requirements/srs/fr-01-x.md"]);
});

test("the escape, a checker script and a file this checkout lacks are each no finding", () => {
  assert.deepEqual(said("none yet — ISS-231"), []);
  assert.deepEqual(said("plugin/scripts/skill-dup.mjs"), [], "a checker proving by running is cited by path");
  assert.deepEqual(said("plugin/test/flow/advance.test.mjs \"a case\"", () => null), [],
    "and a path that resolves nowhere is R-19's finding, reported by cited-paths and not twice");
});

test("a case named where no test file holds one is refused, and a bare path there is not", () => {
  const found = said('plugin/scripts/skill-dup.mjs "a case"');
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(found[0], /which is no test file and declares none/u);
});

/* Read off this file, so the reader is proven against the shapes this suite really writes rather
   than against a fixture written to match it. */
test("the reader takes every case shape the suite writes, and no pattern's own test call", () => {
  const mine = casesIn(readFileSync(new URL(import.meta.url), "utf8"));
  assert.ok(mine.includes("the reader takes every case shape the suite writes, and no pattern's own test call"),
    "this case names itself");
  assert.deepEqual(casesIn('  await t.test("a subtest", () => {});\ntest.only("one only", () => {});\n'),
    ["a subtest", "one only"]);
  assert.deepEqual(casesIn('const NAMED = /x/u;\nif (NAMED.test("a string")) return;\n'), [],
    "a pattern asked whether it matches declares no case");
  assert.deepEqual(casesIn("test('in single quotes', () => {});\ntest(`in backticks`, () => {});\n"),
    ["in single quotes", "in backticks"], "the quote styles eslint leaves open are all read");
  assert.deepEqual(casesIn("test(`a name for ${slug}`, () => {});\n"), [],
    "and a name computed at run time is no name a clause can cite");
  assert.deepEqual(casesIn(""), []);
});

test("the field reader tells a path, a path with a case and the escape apart", () => {
  assert.deepEqual(proofOf("a/b.test.mjs"), { path: "a/b.test.mjs", name: null, held: "a/b.test.mjs" });
  assert.equal(proofOf('a/b.test.mjs "a case: with a colon"').name, "a case: with a colon");
  assert.equal(proofOf("none yet — ISS-231").escaped, true);
  assert.equal(proofOf(""), null);
});
