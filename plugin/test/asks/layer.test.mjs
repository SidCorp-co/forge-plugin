/* One project's precedent layer, built from transcripts written here: what it takes from them, what
   it never takes, and how little a later build reads. */
import assert from "node:assert/strict";
import test from "node:test";
import { appendFileSync, chmodSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../fixtures.mjs";
import { addPrecedent, ownerRow, precedentsIn, refreshLayer, shortlistFor } from "../../src/asks/layer.mjs";
import { decidedIds, logOutcome } from "../../src/asks/decided.mjs";

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

/* A thread as `forge comment` prints it, one decision record among its comments. */
const thread = (issue, reading) => [
  `--- ${issue}, comment 1 of 2, 0000, posted 2026-09-20T08:00:00 ---`, "## Plan", "",
  `--- ${issue}, comment 2 of 2, 0001, posted 2026-09-20T08:01:00 ---`, "## Decision", "", "```forge-record",
  `decision: ${reading}`, "serves: G-11", "```", "", "`forge-record: decision · contract 1`", "",
].join("\n");

const result = (id, text, isError = false) => `${JSON.stringify({
  type: "user", timestamp: "2026-09-20T08:00:01.000Z",
  message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: text, is_error: isError }] },
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
    result("toolu_read", thread("ISS-9", "Keep one file | it is small | split it")));
  assert.deepEqual(refreshLayer(paths), { added: 3, complete: true });
  const held = precedentsIn(paths);
  const [owner, free, recorded] = [held.find((one) => one.id === "toolu_a#0"), held.find((one) => one.id === "toolu_b#0"),
    held.find((one) => one.kind === "decision")];
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

test("a decision joins the layer only as the tracker holds it, read back, and once however often it is read", () => {
  const paths = layer();
  const file = join(paths.source, "s1.jsonl");
  writeFileSync(file, [
    decision("toolu_ask", 'forge record decision ISS-1 --decision "Asked | not | confirmed"'),
    result("toolu_ask", "## Decision\n```forge-record\ndecision: Asked | not | confirmed\n```"),
    result("toolu_read1", thread("ISS-4", "Take the page | the owner reads it there | move it back")),
    result("toolu_read2", thread("ISS-4", "Take the page | the owner reads it there | move it back")),
  ].join(""));
  assert.equal(refreshLayer(paths).added, 1, "a command asking for a write, and its echo, are no record");
  const [row] = precedentsIn(paths);
  assert.deepEqual([row.kind, row.issue, row.readings], ["decision", "ISS-4", ["Take the page | the owner reads it there | move it back"]]);
});

test("equally close precedents are never cut apart at the cap, so a disagreeing one is still shown", () => {
  const rows = Array.from({ length: 6 }, (one, at) => ownerRow({ id: `same${at}`, question: QUESTION,
    answer: at === 5 ? "A page on the tracker" : "A file on this device (Recommended)" }));
  const asked = { ...QUESTION, question: "Where should each day's report go? [reversible: move it back]" };
  const shown = shortlistFor(asked, rows);
  assert.equal(shown.length, 6);
  assert.ok(shown.some((one) => one.answer === "A page on the tracker"));
});

test("a transcript that cannot be read leaves the build incomplete", () => {
  const paths = layer();
  writeFileSync(join(paths.source, "s1.jsonl"), answered("toolu_a", QUESTION, "A page on the tracker"));
  symlinkSync(join(paths.source, "gone.jsonl.target"), join(paths.source, "s2.jsonl"));
  assert.equal(refreshLayer(paths).complete, false);
  const shut = layer();
  chmodSync(join(shut.source, "session"), 0o000);
  try {
    assert.equal(refreshLayer(shut).complete, false, "and so does a directory that cannot be listed");
  } finally {
    chmodSync(join(shut.source, "session"), 0o755);
  }
  assert.equal(refreshLayer({ ...layer(), source: join(tempRoom("asks-none-"), "absent") }).complete, true,
    "while a project with no transcripts at all is simply read to its end");
});

test("a line that should hold an answer and cannot be read stops the build before it, to be read again", () => {
  const paths = layer();
  const file = join(paths.source, "s1.jsonl");
  const whole = answered("toolu_b", QUESTION, "A file on this device (Recommended)");
  const torn = whole.slice(0, whole.indexOf("\"toolUseResult\"") + 30);
  writeFileSync(file, `${answered("toolu_a", QUESTION, "A page on the tracker")}${torn}\n${answered("toolu_c", QUESTION, "A page on the tracker")}`);
  assert.deepEqual(refreshLayer(paths), { added: 1, complete: false }, "nothing past the unreadable answer is taken");
  writeFileSync(file, `${answered("toolu_a", QUESTION, "A page on the tracker")}${answered("toolu_b", QUESTION, "A file on this device (Recommended)")}`
    + answered("toolu_c", QUESTION, "A page on the tracker"));
  assert.deepEqual(refreshLayer(paths), { added: 2, complete: true }, "and once it reads whole, it and what follows are");
});

test("the decision log takes only the outcome shapes it can read back, and names its calls", () => {
  const room = join(tempRoom("asks-log-"), "asks");
  const decision = { outcome: "decided", toolUseId: "toolu_x", questions: [{ question: "Q?", option: "A", reason: "r",
    reversal: "undo it", precedent: { id: "p1" } }] };
  for (const wrong of [{ questions: ["Q?"], reason: "r" }, { ...decision, questions: [] }, { ...decision, toolUseId: null },
    { outcome: "owner", reason: "r", questions: "Q?" }, { ...decision, questions: [{ question: "Q?", option: "A" }] },
    { ...decision, questions: [{ ...decision.questions[0], reason: "" }] }]) {
    assert.equal(logOutcome(wrong, room), false, JSON.stringify(wrong));
  }
  assert.deepEqual(decidedIds(room), { ids: new Set() }, "nothing was written");
  assert.equal(logOutcome({ ...decision, at: "1999-01-01", extra: "not a field" }, room), true);
  assert.equal(logOutcome({ outcome: "owner", reason: "new ground", questions: ["Q?"] }, room), true);
  assert.deepEqual(decidedIds(room), { ids: new Set(["toolu_x"]) });
  const [written] = readFileSync(join(room, "decided.jsonl"), "utf8").split("\n").map((one) => one && JSON.parse(one));
  assert.equal(written.extra, undefined, "a field the caller added is not written");
  assert.notEqual(written.at, "1999-01-01", "nor a time the caller sent");
});

test("a last line still being written that may hold an answer leaves the build incomplete until it lands", () => {
  const paths = layer();
  const file = join(paths.source, "s1.jsonl");
  const last = answered("toolu_b", QUESTION, "A file on this device (Recommended)");
  writeFileSync(file, `${answered("toolu_a", QUESTION, "A page on the tracker")}${last.slice(0, -1)}`);
  assert.deepEqual(refreshLayer(paths), { added: 1, complete: false });
  appendFileSync(file, "\n");
  assert.deepEqual(refreshLayer(paths), { added: 1, complete: true });
});

test("a layer holding a row that will not parse is refused, rather than read without it", () => {
  const paths = layer();
  writeFileSync(join(paths.source, "s1.jsonl"), answered("toolu_a", QUESTION, "A page on the tracker"));
  refreshLayer(paths);
  appendFileSync(paths.precedents, '{"id":"toolu_b#0","kind":"owner","answer":\n');
  assert.match(refreshLayer(paths).unreadable, /line 2 is not a precedent/u);
  assert.equal(refreshLayer(paths).complete, false);
  for (const partial of [{ id: "d1", kind: "decision" }, { id: "o1", kind: "owner", question: "Q?", options: ["A"] }]) {
    const whole = layer();
    mkdirSync(join(whole.precedents, ".."), { recursive: true });
    writeFileSync(whole.precedents, `${JSON.stringify(partial)}\n`);
    assert.match(refreshLayer(whole).unreadable, /line 1 is not a precedent/u, `${JSON.stringify(partial)} is not a whole row`);
  }
});

test("a link out of the project's own transcripts is never read, and leaves the build incomplete", () => {
  const paths = layer();
  const foreign = join(tempRoom("asks-foreign-"), "theirs.jsonl");
  writeFileSync(foreign, answered("toolu_theirs", QUESTION, "A page on the tracker"));
  writeFileSync(join(paths.source, "s1.jsonl"), answered("toolu_mine", QUESTION, "A file on this device (Recommended)"));
  symlinkSync(foreign, join(paths.source, "s2.jsonl"));
  assert.deepEqual(refreshLayer(paths), { added: 1, complete: false });
  assert.deepEqual(precedentsIn(paths).map((one) => one.id), ["toolu_mine#0"]);
  const inside = layer();
  writeFileSync(join(inside.source, "session", "real.jsonl"), answered("toolu_in", QUESTION, "A page on the tracker"));
  symlinkSync(join(inside.source, "session"), join(inside.source, "linked"));
  assert.equal(refreshLayer(inside).complete, true, "while one landing inside them is read as they are");
});
