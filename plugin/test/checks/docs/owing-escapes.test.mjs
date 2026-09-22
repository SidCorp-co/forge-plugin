/* The other half of R-11's escape: not whether the line is well formed, which plugin/test/spec/
   proof-cases.test.mjs holds, but whether the issue it names can still keep the promise. Every case
   here is offline — the reading is handed in, so what a tracker did or did not answer is a value
   this file writes rather than a network it needs. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  MISSING, owingEscapeRows, owingEscapesFrom, owingRead,
} from "../../../src/checks/docs/owing-escapes.mjs";

const clause = (id, proof) =>
  `- **${id}** · Rev: 1 · Proof: ${proof}\n  WHEN a case is named THEN the checker SHALL read it.\n`;

const document = (file, ...clauses) => ({
  file: `docs/requirements/srs/${file}`,
  text: `## UC-01-1 — A use case\n\nRev: 1\n\n${clauses.join("")}`,
});

const TREE = {
  documents: [
    document("fr-01-x.md",
      clause("AC-01-1-1", "none yet — ISS-7"),
      clause("AC-01-1-2", "none yet — ISS-7"),
      clause("AC-01-1-3", "none yet — ISS-8"),
      clause("AC-01-1-4", "none yet — ISS-9")),
    document("fr-02-y.md",
      clause("AC-02-1-1", "none yet — ISS-7"),
      clause("AC-02-1-2", "none yet — ISS-4444"),
      clause("AC-02-1-3", "plugin/test/flow/advance.test.mjs \"a case\"")),
  ],
};

const HELD = [
  { issueId: "ISS-7", status: "closed" },
  { issueId: "ISS-8", status: "dropped" },
  { issueId: "ISS-9", status: "open" },
];

const whole = (rows = HELD) => ({ whole: true, rows, pages: 1 });

test("the row counts the escapes read, the ones no longer owed, and the document carrying most of those", () => {
  const rows = owingEscapeRows(owingEscapesFrom(whole(), TREE));
  assert.equal(rows.length, 1, JSON.stringify(rows));
  const { detail } = rows[0];
  assert.match(detail, /^5 of 6 escape\(s\) under docs\/requirements\/ are owed to an issue that no longer owes the case/u);
  assert.ok(detail.includes("ISS-7 3"), detail);
  assert.ok(detail.includes("docs/requirements/srs/fr-01-x.md (3)"), `the worst document, not the first: ${detail}`);
  assert.ok(detail.includes("`grep -rn \"none yet — ISS-7\" docs/requirements`"), `and the way to the lines: ${detail}`);
});

test("a key the whole reading holds no issue for keeps no promise either", () => {
  const { read } = owingEscapesFrom(whole(), TREE);
  assert.deepEqual(read.gone.filter((one) => one.status === MISSING).map((one) => one.id), ["AC-02-1-2"]);
  assert.deepEqual(read.gone.filter((one) => one.status === "open"), []);
  assert.equal(read.escapes, 6, "the bare path is no escape and is not counted as one");
});

test("one escape no longer owed makes the row a fault and not a note", () => {
  assert.equal(owingEscapeRows(owingEscapesFrom(whole(), TREE))[0].level, "miss");
  const owing = whole([{ issueId: "ISS-7", status: "open" }, { issueId: "ISS-8", status: "in_progress" },
    { issueId: "ISS-9", status: "open" }, { issueId: "ISS-4444", status: "confirmed" }]);
  const clean = owingEscapeRows(owingEscapesFrom(owing, TREE))[0];
  assert.equal(clean.level, "ok");
  assert.match(clean.detail, /6 escape\(s\).*every one of them owed to an issue that still owes the case/u);
  assert.deepEqual(owingEscapeRows(owingEscapesFrom(whole(), null)), [],
    "and a project that keeps no tree gets no row at all");
});

test("a tracker that did not answer leaves every escape unjudged, and the row is neither a pass nor a fault", () => {
  const refused = owingEscapeRows(owingEscapesFrom({ whole: false, rows: [], refused: "403 forbidden" }, TREE));
  assert.equal(refused[0].level, "note", JSON.stringify(refused));
  assert.match(refused[0].detail, /^6 of 6 escape\(s\) under docs\/requirements\/ went unjudged/u);
  assert.ok(refused[0].detail.includes("403 forbidden"), refused[0].detail);
  assert.ok(refused[0].detail.endsWith("Nothing is passed or failed on a reading that did not reach it"),
    refused[0].detail);
  const short = owingEscapeRows(owingEscapesFrom({ whole: false, rows: HELD, pages: 1 }, TREE));
  assert.equal(short[0].level, "note", "a page with rows behind it judges nothing either");
  assert.ok(short[0].detail.includes("reported rows behind the last page it answered"), short[0].detail);
  const { read } = owingEscapesFrom({ whole: false, rows: HELD }, TREE);
  assert.deepEqual(read.gone, [], "and no escape is called gone off a reading that may be short");
});

test("the judgement is one function of the documents and one answer about each key", () => {
  const read = owingRead(TREE.documents, () => "closed");
  assert.equal(read.gone.length, 6, "every named escape, judged by the answer it was handed");
  assert.deepEqual(owingRead(TREE.documents, () => null).unjudged.length, 6);
  assert.deepEqual(owingRead([], () => "closed"),
    { escapes: 0, unnamed: 0, gone: [], unjudged: [] });
});
