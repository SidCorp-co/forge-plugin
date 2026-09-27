/* A transcript reaches hundreds of megabytes — 214 MB here, 3.2s to read and parse — and what is
   wanted from it is one thing: this turn, which is at the end. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { callAt, turnAt, turnRecords } from "../../../hooks/_hook.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { patience } from "../../patience.mjs";

const room = tempRoom("turn-records-");

const filler = (bytes) => {
  const one = `${JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "x".repeat(400) }] } })}\n`;
  return one.repeat(Math.ceil(bytes / one.length));
};

const prompt = (at) => `${JSON.stringify({ type: "user", promptSource: "typed", timestamp: at })}\n`;
const asked = (at) =>
  `${JSON.stringify({ type: "assistant", timestamp: at, message: { content: [{ type: "tool_use", name: "Bash" }] } })}\n`;

const wrote = (name, text) => {
  const path = join(room, name);
  writeFileSync(path, text);
  return path;
};

test("the turn is found at the end of the file", () => {
  const path = wrote("short.jsonl", filler(200_000) + prompt("2026-09-01T10:00:00.000Z") + filler(50_000));
  const records = turnRecords(path);
  assert.equal(turnAt(records), "2026-09-01T10:00:00.000Z");
});

/* A turn of this session's own size overruns the first window, so the reader doubles rather than
   answering "no prompt" — which would tell a repository once a session instead of once a turn. */
test("a window too small for one turn is grown, not given up on", () => {
  const path = wrote(
    "long-turn.jsonl",
    filler(500_000) + prompt("2026-09-01T11:00:00.000Z") + filler(3_500_000) + asked("2026-09-01T11:40:00.000Z"),
  );
  const records = turnRecords(path);
  assert.equal(turnAt(records), "2026-09-01T11:00:00.000Z", "the prompt sat 3.5 MB back");
  assert.equal(callAt(records), Date.parse("2026-09-01T11:40:00.000Z"), "and the 3.5 MB after it came back too");
});

/* Past the cap the reader answered "no turn", and that empty answer is a key of its own: told twice
   in one turn, then never for the next oversized one. The cap is the suite's, so the fixture is small. */
test("a turn past the window is found rather than given up on", () => {
  const path = wrote(
    "past-the-cap.jsonl",
    filler(100_000) + prompt("2026-09-01T13:00:00.000Z") + filler(400_000),
  );
  const found = turnRecords(path, { tail: 4096, cap: 8192 });
  assert.equal(turnAt(found), "2026-09-01T13:00:00.000Z");
});

/* Past the cap the prompt is found by its bytes, and a record carrying a record has the key nested
   inside it, unescaped. Read as the prompt, the turn is the wrong turn — or no turn at all. */
test("the key inside a record a record carries is not the prompt", () => {
  const carrying = `${JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "tool_result", content: { type: "user", promptSource: "typed" } }] },
  })}\n`;
  const path = wrote(
    "nested-key.jsonl",
    filler(50_000) + prompt("2026-09-01T14:00:00.000Z") + carrying + filler(50_000) + carrying,
  );
  assert.equal(turnAt(turnRecords(path, { tail: 4096, cap: 8192 })), "2026-09-01T14:00:00.000Z");
});

test("a transcript with no prompt in it at all reads as no turn", () => {
  const path = wrote("no-prompt.jsonl", filler(100_000));
  assert.equal(turnAt(turnRecords(path)), "");
});

test("a transcript that will not open is null, not an empty turn", () => {
  assert.equal(turnRecords(join(room, "nope.jsonl")), null);
});

/* The measurement is the point of the change, so it is asserted: the bound is loose enough that only
   reading the whole file can break it. */
test("a session far larger than one turn is read in the time one turn takes", () => {
  const path = wrote("huge.jsonl", filler(30_000_000) + prompt("2026-09-01T12:00:00.000Z"));
  const started = Date.now();
  const records = turnRecords(path);
  const spent = Date.now() - started;
  assert.equal(turnAt(records), "2026-09-01T12:00:00.000Z");
  assert.ok(spent < patience(1000), `${spent}ms for a 30 MB transcript: the window is not being used`);
});

/* A subagent's transcript opens on the prompt the Agent tool handed it, which carries no
   `promptSource`, so no record in it is a typed prompt. Lines of uneven length, so a window's end
   lands inside a record rather than on a boundary. */
const handed = (count) => {
  let text = "";
  for (let at = 0; at < count; at += 1) {
    const stamp = new Date(Date.UTC(2026, 8, 1, 15, 0, at)).toISOString();
    text += `${JSON.stringify({ type: at ? "assistant" : "user", seq: at, timestamp: stamp, pad: "y".repeat(97 + (at * 37) % 300) })}\n`;
  }
  return text;
};

test("a transcript with no typed prompt, longer than the cap, is read whole", () => {
  const path = wrote("subagent-past-cap.jsonl", handed(400));
  const found = turnRecords(path, { tail: 4096, cap: 8192 });
  assert.equal(found.length, 400, "every record, not the capped tail");
  assert.equal(found[0].seq, 0, "the prompt the subagent was handed comes first");
  assert.equal(found.at(-1).seq, 399);
  assert.equal(found[0].timestamp, "2026-09-01T15:00:00.000Z", "the stop gate's first moment of a subagent's turn");
});

test("no record is lost or split where one window of the whole read ends and the next begins", () => {
  const path = wrote("subagent-windows.jsonl", handed(1500));
  const found = turnRecords(path, { tail: 4096, cap: 8192 });
  assert.deepEqual(found.map((one) => one.seq), Array.from({ length: 1500 }, (_, at) => at));
});

test("a typed prompt further back than the cap still bounds the turn", () => {
  const path = wrote(
    "typed-past-cap.jsonl",
    handed(50) + prompt("2026-09-01T16:00:00.000Z") + filler(40_000),
  );
  const found = turnRecords(path, { tail: 4096, cap: 8192 });
  assert.equal(found[0].promptSource, "typed", "the turn begins at the prompt");
  assert.ok(!found.some((one) => "seq" in one), "and nothing before it comes back");
});
