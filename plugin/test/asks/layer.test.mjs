/* One project's precedent layer, built from transcripts written here: what it takes from them, what
   it never takes, and how little a later build reads. */
import assert from "node:assert/strict";
import test from "node:test";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../fixtures.mjs";
import { addPrecedent, ownerRow, precedentsIn, refreshLayer, shortlistFor } from "../../src/asks/layer.mjs";

const QUESTION = { question: "Where should each day's report go?", header: "Delivery",
  options: [{ label: "A file on this device (Recommended)" }, { label: "A page on the tracker" }] };

const answered = (id, question, answer, notes) => `${JSON.stringify({
  type: "user", timestamp: "2026-09-24T08:00:00.000Z",
  message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: "answered" }] },
  toolUseResult: { questions: [question], answers: { [question.question]: answer },
    ...(notes ? { annotations: { [question.question]: { notes } } } : {}) },
})}\n`;

const decision = (id, command) => `${JSON.stringify({
  type: "assistant", timestamp: "2026-09-20T08:00:00.000Z",
  message: { role: "assistant", content: [{ type: "tool_use", id, name: "Bash", input: { command } }] },
})}\n`;

const layer = () => {
  const room = tempRoom("asks-layer-");
  const source = join(room, "store");
  mkdirSync(join(source, "session", "subagents"), { recursive: true });
  return { precedents: join(room, "asks", "precedents.jsonl"), scanned: join(room, "asks", "scanned.json"), source };
};

test("a build takes every answered question, free text included, and every recorded decision", () => {
  const paths = layer();
  writeFileSync(join(paths.source, "s1.jsonl"), [
    answered("toolu_a", QUESTION, "A page on the tracker"),
    answered("toolu_b", { ...QUESTION, question: "What should the plugin be called?" }, "call it forge", "short and ours"),
    '{"type":"user","message":{"content":"a line that is not an answer"}}\n',
  ].join(""));
  writeFileSync(join(paths.source, "session", "subagents", "agent-1.jsonl"),
    decision("toolu_d", 'forge record decision ISS-9 --decision "Keep one file | it is small | split it" --serves G-11'));
  assert.deepEqual(refreshLayer(paths), { added: 3, complete: true });
  const [owner, free, recorded] = precedentsIn(paths).sort((left, right) => left.id.localeCompare(right.id));
  assert.equal(owner.answer, "A page on the tracker");
  assert.equal(owner.matched, false, "the owner did not take the recommendation");
  assert.equal(owner.recommended, "A file on this device (Recommended)");
  assert.equal(free.free, true, "their own words are kept as the answer");
  assert.equal(free.notes, "short and ours");
  assert.deepEqual([recorded.kind, recorded.issue, recorded.readings], ["decision", "ISS-9", ["Keep one file | it is small | split it"]]);
});

test("a later build reads only what the transcripts gained since the last one", () => {
  const paths = layer();
  const file = join(paths.source, "s1.jsonl");
  writeFileSync(file, answered("toolu_a", QUESTION, "A page on the tracker"));
  refreshLayer(paths);
  const offset = JSON.parse(readFileSync(paths.scanned, "utf8")).files[file].offset;
  assert.equal(offset, readFileSync(file).length, "the build keeps where it stopped");
  /* Bytes before that offset are never read again: a row put there by hand stays unseen, while the
     one appended after it is taken. */
  const earlier = answered("toolu_z", QUESTION, "A page on the tracker");
  assert.equal(Buffer.byteLength(earlier), offset, "a whole valid line, exactly as long as the one it replaces");
  writeFileSync(file, `${earlier}${answered("toolu_new", QUESTION, "A file on this device (Recommended)")}`);
  assert.equal(refreshLayer(paths).added, 1);
  assert.deepEqual(precedentsIn(paths).map((one) => one.id).sort(), ["toolu_a#0", "toolu_new#0"]);
});

test("a question the gate decided itself is taken from no transcript and by no append that names it", () => {
  const paths = layer();
  writeFileSync(join(paths.source, "s1.jsonl"), answered("toolu_self", QUESTION, "A page on the tracker"));
  assert.equal(refreshLayer(paths, { skip: new Set(["toolu_self"]) }).added, 0);
  assert.equal(addPrecedent(paths, ownerRow({ id: "toolu_owner#0", question: QUESTION, answer: "A page on the tracker" })), true);
  assert.equal(addPrecedent(paths, ownerRow({ id: "toolu_owner#0", question: QUESTION, answer: "A page on the tracker" })), false,
    "and one row is kept once");
});

test("a build past its time keeps its place, and the next one carries on from there", () => {
  const paths = layer();
  writeFileSync(join(paths.source, "s1.jsonl"), answered("toolu_a", QUESTION, "A page on the tracker"));
  assert.deepEqual(refreshLayer(paths, { until: Date.now() - 1 }), { added: 0, complete: false });
  appendFileSync(join(paths.source, "s1.jsonl"), "");
  assert.equal(refreshLayer(paths).added, 1);
});

test("the shortlist holds what is close and nothing under the floor", () => {
  const rows = [
    ownerRow({ id: "near", question: QUESTION, answer: "A page on the tracker" }),
    ownerRow({ id: "far", question: { question: "Which colour for the chart?", options: [{ label: "Red" }, { label: "Blue" }] }, answer: "Red" }),
  ];
  const asked = { ...QUESTION, question: "Where should the weekly report go? [reversible: move it back]" };
  assert.deepEqual(shortlistFor(asked, rows).map((one) => one.id), ["near"]);
  assert.deepEqual(shortlistFor({ question: "Which font? [reversible: x]", options: [{ label: "Serif" }, { label: "Sans" }] }, rows), []);
});
