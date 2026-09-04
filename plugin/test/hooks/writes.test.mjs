/* The freshness reading had a ceiling and no floor, so for two minutes after a checkout was cut every
   path a read command named answered as written — met in the first minute of every worktree per
   session run (ISS-200). The floor is the call, so the cases are a young file nobody wrote, a young
   file this call wrote, and a transcript that cannot say. */
import assert from "node:assert/strict";
import test from "node:test";
import { realpathSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { FRESH_MS, callAt, touched } from "../../hooks/_hook.mjs";
import { tempRoom } from "../fixtures.mjs";

const room = tempRoom("writes-");
const NOW = Date.now();
let made = 0;

/* What the transcript says about when a call began: the last assistant record is the message asking
   for its tool, and a user record after it is the previous call's result. */
const asked = (at, { assistant = true } = {}) => {
  const path = join(room, `t-${(made += 1)}.jsonl`);
  const lines = [{ type: "user", promptSource: "typed", timestamp: new Date(at - 60_000).toISOString() }];
  if (assistant) {
    lines.push({
      type: "assistant",
      timestamp: new Date(at).toISOString(),
      message: { content: [{ type: "tool_use", name: "Bash", input: { command: "x" } }] },
    });
  }
  writeFileSync(path, `${lines.map((one) => JSON.stringify(one)).join("\n")}\n`);
  return path;
};

const stamped = (name, at) => {
  const path = join(room, name);
  writeFileSync(path, "x\n");
  utimesSync(path, new Date(at), new Date(at));
  return realpathSync(path);
};

const bash = (command, transcript = "") => ({
  session_id: "s1",
  tool_name: "Bash",
  tool_input: { command },
  cwd: room,
  transcript_path: transcript,
});

/* The defect itself: `git worktree add` stamps every file in the tree, and a read is not a write. */
test("a file the checkout stamped before the call began is nobody's write", () => {
  const file = stamped("checked-out.md", NOW - 30_000);
  const found = touched(bash("cat checked-out.md", asked(NOW - 10_000)));
  assert.deepEqual(found, [], `${file} was 30s old, well inside the ${FRESH_MS} ms window`);
});

test("a file this call wrote still answers as written", () => {
  const file = stamped("written.md", NOW - 5_000);
  assert.deepEqual(touched(bash("printf x > written.md", asked(NOW - 10_000))), [file]);
});

test("a file older than the window is no write, floor or no floor", () => {
  stamped("stale.md", NOW - 10 * FRESH_MS);
  assert.deepEqual(touched(bash("cat stale.md", asked(NOW - 10_000))), []);
  assert.deepEqual(touched(bash("cat stale.md")), [], "and the same with nothing to read the floor from");
});

/* A hand-run gate and a suite fixture have no transcript, and a wall that stands down on doubt is
   not a wall: with no floor to read, a young file the call named answers as it always did. */
test("where nothing says when the call began, a young file answers as written", () => {
  const file = stamped("no-floor.md", NOW - 30_000);
  assert.deepEqual(touched(bash("cat no-floor.md")), [file], "no transcript");
  assert.deepEqual(touched(bash("cat no-floor.md", join(room, "gone.jsonl"))), [file], "an unreadable one");
  assert.deepEqual(
    touched(bash("cat no-floor.md", asked(NOW - 10_000, { assistant: false }))),
    [file],
    "a transcript holding no assistant record",
  );
});

test("the file tools answer with their own path and consult no clock", () => {
  const file = stamped("edited.md", NOW - 10 * FRESH_MS);
  const ev = { session_id: "s1", tool_name: "Edit", tool_input: { file_path: file }, cwd: room };
  assert.deepEqual(touched(ev), [file]);
});

test("the call began where the last assistant record stands, and a record with no timestamp says nothing", () => {
  const at = "2026-09-01T10:00:00.000Z";
  const records = [
    { type: "assistant", timestamp: "2026-09-01T09:00:00.000Z" },
    { type: "assistant", timestamp: at },
    { type: "user", timestamp: "2026-09-01T11:00:00.000Z" },
  ];
  assert.equal(callAt(records), Date.parse(at), "the user record after it is the previous result");
  assert.equal(callAt([{ type: "assistant" }]), 0, "a record with no timestamp");
  assert.equal(callAt([{ type: "user", timestamp: at }]), 0, "no assistant record at all");
  assert.equal(callAt(null), 0, "a transcript that could not be read");
});
