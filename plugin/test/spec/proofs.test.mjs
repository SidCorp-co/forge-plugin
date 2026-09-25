/* The Proof lines read backwards, on documents and test files handed in, so each list is proved on
   the rows that make it and not on whatever this repository's tree holds today. */
import assert from "node:assert/strict";
import test from "node:test";

import { proofsRead } from "../../src/spec/proofs/read.mjs";

const OPEN = "ISS-7";
const CLOSED = "ISS-8";
const escape = (key) => `none yet — ${key}`;

const criterion = (id, proof) =>
  `- **${id}** · Rev: 1 · Proof: ${proof}\n  WHEN a case is named THEN the checker SHALL read it.\n`;

const document = (file, ...rows) => ({ file, text: `## UC-01-1 — A use case\n\nRev: 1\n\n${rows.join("")}` });

const DOCUMENTS = [document("docs/requirements/srs/fr-01-x.md",
  criterion("AC-01-1-1", 'tests/a.test.mjs "a shared case"'),
  criterion("AC-01-1-2", 'tests/a.test.mjs "a shared case"'),
  criterion("AC-01-1-3", 'tests/a.test.mjs "a case of its own"'),
  criterion("AC-01-1-4", escape(OPEN)),
  criterion("AC-01-1-5", escape(CLOSED)),
  criterion("AC-01-1-6", "none yet"))];

const cases = (count) => Array.from({ length: count }, (_, at) => `test("case ${at}", () => {});\n`).join("");

const TESTS = [
  { path: "tests/a.test.mjs", text: cases(2) },
  { path: "tests/small.test.mjs", text: cases(1) },
  { path: "tests/sub/big.test.mjs", text: `${cases(2)}\n\n\n\n` },
  { path: "tests/level.test.mjs", text: cases(3) },
];

const STATUSES = { [OPEN]: "open", [CLOSED]: "closed" };
const read = (over = {}) => proofsRead({
  documents: DOCUMENTS,
  tests: TESTS,
  statusOf: (key) => STATUSES[key] ?? null,
  owes: (status) => status !== "closed",
  ...over,
});

test("every criterion on the escape is listed with its file, line, identifier and the key it names", () => {
  const { unproven } = read();
  assert.deepEqual(unproven.map(({ file, line, id, key }) => ({ file, line, id, key })), [
    { file: "docs/requirements/srs/fr-01-x.md", line: 11, id: "AC-01-1-4", key: OPEN },
    { file: "docs/requirements/srs/fr-01-x.md", line: 13, id: "AC-01-1-5", key: CLOSED },
    { file: "docs/requirements/srs/fr-01-x.md", line: 15, id: "AC-01-1-6", key: null },
  ]);
});

test("an unproven row says whether the issue it names still owes the case, and one naming none says nothing of it", () => {
  const { unproven } = read();
  assert.deepEqual(unproven.map(({ status, owes }) => ({ status, owes })), [
    { status: "open", owes: true },
    { status: "closed", owes: false },
    { status: null, owes: null },
  ]);
});

test("a status reading that could not say leaves every row's status unread rather than guessed", () => {
  const { unproven } = read({ statusOf: () => null });
  assert.deepEqual(unproven.map(({ status, owes }) => ({ status, owes })),
    [{ status: null, owes: null }, { status: null, owes: null }, { status: null, owes: null }]);
});

test("the unnamed list holds every declared test file no Proof names, and none a Proof does", () => {
  const { unnamed } = read();
  assert.deepEqual(unnamed.map((one) => one.path).sort(),
    ["tests/level.test.mjs", "tests/small.test.mjs", "tests/sub/big.test.mjs"]);
});

test("the unnamed list runs from most lines to fewest", () => {
  const { unnamed } = read();
  assert.deepEqual(unnamed.map((one) => [one.path, one.lines]), [
    ["tests/sub/big.test.mjs", 6], ["tests/level.test.mjs", 3], ["tests/small.test.mjs", 1],
  ]);
});

test("each unnamed row carries the number of cases its file declares", () => {
  const { unnamed } = read();
  assert.deepEqual(unnamed.map((one) => [one.path, one.cases]), [
    ["tests/sub/big.test.mjs", 2], ["tests/level.test.mjs", 3], ["tests/small.test.mjs", 1],
  ]);
});

test("a case more than one criterion names is shared, with those criteria, and a case one names is not", () => {
  const { shared } = read();
  assert.deepEqual(shared, [{ path: "tests/a.test.mjs", name: "a shared case", criteria: ["AC-01-1-1", "AC-01-1-2"] }]);
});

test("a Proof path written from its own document names the file it resolves to", () => {
  const beside = [document("docs/requirements/srs/fr-01-x.md", criterion("AC-01-1-1", '../../../tests/small.test.mjs "case 0"'))];
  const exists = (path) => path === "tests/small.test.mjs";
  const { unnamed } = proofsRead({ documents: beside, tests: TESTS, exists });
  assert.ok(!unnamed.some((one) => one.path === "tests/small.test.mjs"), JSON.stringify(unnamed));
  assert.equal(unnamed.length, 3);
});

test("no test root declared is no unnamed list, and the other two are still read", () => {
  const held = read({ tests: null });
  assert.equal(held.unnamed, null);
  assert.equal(held.unproven.length, 3);
  assert.equal(held.shared.length, 1);
});

test("a tree whose criteria carry no Proof is one answer and no lists", () => {
  const bare = [{ file: "docs/requirements/srs/fr-01-x.md", text: "## UC-01-1 — A use case\n\nRev: 1\n" }];
  assert.deepEqual(proofsRead({ documents: bare, tests: TESTS }), { proofs: 0 });
});
