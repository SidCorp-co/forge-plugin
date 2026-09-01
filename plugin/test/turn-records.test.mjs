/* A transcript reaches hundreds of megabytes — 214 MB here, 3.2s to read and parse — and two gates
   want one thing from it: this turn, which is at the end. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { promptIndex, turnAt, turnRecords, unspentAdvice } from "../hooks/_hook.mjs";

const room = mkdtempSync(join(tmpdir(), "turn-records-"));

const filler = (bytes) => {
  const one = `${JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "x".repeat(400) }] } })}\n`;
  return one.repeat(Math.ceil(bytes / one.length));
};

const prompt = (at) => `${JSON.stringify({ type: "user", promptSource: "typed", timestamp: at })}\n`;
const advised = (at) =>
  `${JSON.stringify({ type: "assistant", timestamp: at, message: { content: [{ type: "advisor_tool_result", content: {} }] } })}\n`;

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
    filler(500_000) + prompt("2026-09-01T11:00:00.000Z") + filler(3_500_000) + advised("2026-09-01T11:40:00.000Z"),
  );
  const records = turnRecords(path);
  assert.equal(turnAt(records), "2026-09-01T11:00:00.000Z", "the prompt sat 3.5 MB back");
  assert.ok(unspentAdvice(records.slice(promptIndex(records) + 1)), "and the advice after it is still seen");
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
  assert.ok(spent < 1000, `${spent}ms for a 30 MB transcript: the window is not being used`);
});
