import assert from "node:assert/strict";
import test from "node:test";

import { dirtyRepo, tempRoom } from "../fixtures.mjs";
import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const room = tempRoom("hook-log-");
process.env.XDG_CONFIG_HOME = room;
const { hookEntries, hookLogPath, roundsBy } = await import("../../src/hooks/log/hook-log.mjs");
const { jsonLines, jsonlBack, jsonlBytes, jsonlMark } = await import("../../src/hooks/log/hook-log-file.mjs");
const CLI = new URL("../../src/cli.mjs", import.meta.url).pathname;
test.after(() => rmSync(room, { recursive: true, force: true }));

test("a missing log reads as no entries, not as a throw", () => {
  assert.deepEqual(hookEntries(), []);
});

/* The gate is what writes it, so the case that proves the wiring drives a real refusal. */
test("a refusal from a live hook lands in the log, redacted", () => {
  const path = join(room, "t.jsonl");
  writeFileSync(
    path,
    `${JSON.stringify({
      type: "user",
      promptSource: "typed",
      timestamp: "2026-08-31T13:00:00Z",
      message: { content: [{ type: "text", text: "go" }] },
    })}\n`,
  );
  spawnSync(process.execPath, [new URL("../../hooks/entries/bash-guard.mjs", import.meta.url).pathname], {
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: { command: "coolify login --token 7|secretsecret && git add -A" },
      transcript_path: path,
      session_id: "logged",
      cwd: dirtyRepo(),
    }),
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: room },
  });
  const entry = hookEntries().at(-1);
  assert.equal(entry.hook, "bash-guard");
  assert.equal(entry.decision, "deny");
  assert.equal(entry.tool, "Bash");
  assert.equal(entry.session, "logged");
  assert.match(entry.target, /--token \*\*\* && git add -A/u);
  assert.ok(!entry.target.includes("secretsecret"), "the log is a file on disk, so it never holds one");
  assert.match(entry.reason, /^Refused — stage the paths you changed/u, "the first line, which is the route");
  assert.match(entry.refused, /stages everything in the tree/u, "and the shape beside it, which is how a false positive is found");
  assert.equal(readFileSync(hookLogPath(), "utf8").trim().split("\n").length, hookEntries().length);
});

/* A filter nobody checked answered "no refusals logged", which is a wrong answer to a mistyped
   question rather than a refusal of it — and the name of a hook since renamed is still filterable. */
test("a mistyped hook filter is refused with the near miss", () => {
  const forge = (...argv) =>
    spawnSync(process.execPath, [CLI, "hooks", ...argv], {
      encoding: "utf8",
      env: { PATH: process.env.PATH, HOME: room, XDG_CONFIG_HOME: room },
    });
  const missed = forge("--hook", "bash-gaurd");
  assert.equal(missed.status, 1);
  assert.match(missed.stderr, /No hook named bash-gaurd\. Did you mean: bash-guard/u);
  assert.match(forge("--hook", "bash-guard").stdout, /bash-guard\s+deny/u, "the real name filters");
});

/* Found by running it: two filters for one field ANDed to nothing, and the empty answer said the log
   would appear on the first refusal — of 121 already in it. */
test("naming both refusals asks for either, and an empty answer is not an empty log", () => {
  const forge = (...argv) =>
    spawnSync(process.execPath, [CLI, "hooks", ...argv], {
      encoding: "utf8",
      env: { PATH: process.env.PATH, HOME: room, XDG_CONFIG_HOME: room },
    });
  for (const [decision, hook] of [["deny", "bash-guard"], ["block", "claude-md"], ["note", "codex-turn"]]) {
    appendFileSync(
      hookLogPath(),
      `${JSON.stringify({ at: new Date().toISOString(), hook, decision, tool: "Bash", target: "x", reason: "r", session: "s" })}\n`,
    );
  }
  const both = forge("--deny", "--block");
  assert.match(both.stdout, /bash-guard/u, "the deny");
  assert.match(both.stdout, /claude-md/u, "and the block, which ANDing dropped");
  assert.doesNotMatch(both.stdout, /codex-turn/u, "a note is neither");
  const none = forge("--hook", "link-cli");
  assert.match(none.stdout, /match nothing asked for/u);
  assert.doesNotMatch(none.stdout, /appears on the first one/u, "the log is right there");
});

/* Codex ruled on the neighbours of the bug above: a hint whose job is to say the notes are there was
   computed after the filter that took them out, and a tailed listing summed a set it had not printed. */
test("a filtered listing still points at the notes, and says what it cut", () => {
  const forge = (...argv) =>
    spawnSync(process.execPath, [CLI, "hooks", ...argv], {
      encoding: "utf8",
      env: { PATH: process.env.PATH, HOME: room, XDG_CONFIG_HOME: room },
    });
  const denied = forge("--deny");
  assert.match(denied.stdout, /note\(s\): `forge hooks --notes`/u, "the route to the notes survives");
  const tailed = forge("--deny", "--last", "1");
  assert.equal(tailed.stdout.trim().split("\n").filter((one) => one.startsWith("2026")).length, 1);
  assert.match(tailed.stdout, /refusal\(s\), last 1 shown:/u, "the count is not the lines");
  assert.doesNotMatch(denied.stdout, /shown:/u, "and nothing is said when nothing was cut");
});

/* A class of refusal that names a next command the CLI already knew costs a round and teaches
   nothing, and an agent that meets three in a row is looping rather than working. What is countable
   from this log is refusals per refused write: only refusals are written down (ISS-65). */
test("the rounds count is per session, per refused write, and says which write repeated", () => {
  const entry = (session, decision, target, at = "2026-09-03T10:00:00.000Z", tool = "Bash") =>
    ({ at, hook: "issue-read-first", decision, tool, target, session });
  const held = roundsBy([
    entry("one", "deny", "forge record verdict ISS-65 --criterion 1"),
    entry("one", "deny", "forge record verdict ISS-65 --criterion 1", "2026-09-03T10:05:00.000Z"),
    entry("one", "deny", "forge advance ISS-65", "2026-09-03T10:06:00.000Z"),
    entry("one", "block", "forge advance ISS-65", "2026-09-03T10:06:00.400Z"),
    entry("one", "note", "forge advance ISS-65"),
    entry("one", "deny", "git add -A"),
    entry("two", "block", "rm -rf /"),
  ]);
  const [first] = held.filter((one) => one.session === "one");
  assert.equal(first.refusals, 5, "a note is no refusal, and a shell command that is no write still is one");
  assert.equal(first.writes, 2, "two writes were refused");
  assert.equal(first.spent, 3, "and the second gate to answer one attempt is not a second round");
  assert.equal(first.per, 1.5);
  assert.deepEqual(first.worst, { target: "forge record verdict ISS-65 --criterion 1", times: 2 },
    "and the one that repeated is named, because that is the loop");
  /* The tracker's own tool carries the write in the tool name: the target holds a path or nothing,
     so a call through a client rather than a shell counted as no write at all. */
  const mcp = roundsBy([
    entry("three", "deny", "", "2026-09-03T10:00:00.000Z", "mcp__forge__forge_issues"),
    entry("three", "deny", "", "2026-09-03T10:01:00.000Z", "mcp__forge__forge_issues"),
    entry("three", "deny", "/some/path.md", "2026-09-03T10:02:00.000Z", "Edit"),
  ]);
  assert.equal(mcp[0].writes, 1, "one write, refused twice");
  assert.equal(mcp[0].per, 2, "which is the loop the number exists to show");
  const read = roundsBy([
    { ...entry("four", "deny", "", "2026-09-03T10:00:00.000Z", "mcp__forge__forge_issues"), hook: "codex-second" },
    entry("four", "deny", "forge issue ISS-65", "2026-09-03T10:01:00.000Z"),
  ]);
  assert.equal(read[0].writes, 0,
    "a gate that does not read the event for its issues could have refused a read, and `call` reaches "
    + "the reads by name: neither is a write");
  const [second] = held.filter((one) => one.session === "two");
  assert.equal(second.writes, 0, "a session whose refusals guarded no write divides by nothing");
  assert.equal(second.per, 0);
  assert.equal(second.worst, null, "and nothing repeated is nothing to name");
});

test("the count is offered by the verb, and reads the log the gates write", () => {
  const forge = (...argv) =>
    spawnSync(process.execPath, [CLI, "hooks", ...argv], {
      encoding: "utf8",
      env: { PATH: process.env.PATH, HOME: room, XDG_CONFIG_HOME: room },
    });
  appendFileSync(
    hookLogPath(),
    `${JSON.stringify({ at: new Date().toISOString(), hook: "issue-read-first", decision: "deny", tool: "Bash", target: "forge claim ISS-65", reason: "r", session: "a-session" })}\n`,
  );
  const said = forge("--rounds");
  assert.equal(said.status, 0, said.stderr);
  assert.match(said.stdout, /a-sessio\s+\d+ refusal\(s\)/u, "one line per session");
  assert.match(said.stdout, /1 of them before a tracker write, over 1 refused write = 1 per write/u);
  assert.match(said.stdout, /only refusals are logged/u, "and the line says what the number is not");
});

/* A store this size is read to answer a question about one row, and holding it as rows cost 503 ms
   and 167 MB of heap on the live consult log (ISS-1044). These are what the bytes answer instead. */
const rows = [
  { kind: "consult", id: "c1", root: "/a", sent: [{ rel: "docs/a.md", sha: "aa" }] },
  { kind: "verdict", of: "c1" },
  { kind: "consult", id: "c2", root: "/b", text: 'a reviewed file whose own body says "kind":"consult"' },
];
const stored = (held = rows) => Buffer.from(held.map((one) => `${JSON.stringify(one)}\n`).join(""));

const marked = (bytes, mark) => [...jsonlBack(bytes, [mark])];

test("a mark selects rows by a field, and no spelling of it inside a row's own text", () => {
  const bytes = stored();
  assert.deepEqual(marked(bytes, jsonlMark("kind", "consult")).map((one) => one.id), ["c2", "c1"],
    "the second row says it in its own text, where every quote is escaped and no mark can be");
  assert.equal(marked(bytes, jsonlMark("kind", "verdict")).length, 1);
  assert.deepEqual(marked(Buffer.alloc(0), jsonlMark("kind", "consult")), [], "no store is no rows");
  assert.equal(marked(bytes, jsonlMark("root", "/a"))[0].id, "c1");
  assert.deepEqual(marked(bytes, jsonlMark("root", "/nowhere")), [], "a root the store never held");
});

test("the scan reads rows newest first, takes every one of the `all` marks, and stops where the caller does", () => {
  const bytes = stored();
  assert.deepEqual([...jsonlBack(bytes, [jsonlMark("kind", "consult")])].map((one) => one.id), ["c2", "c1"]);
  assert.deepEqual([...jsonlBack(bytes, [jsonlMark("kind", "consult")], [jsonlMark("root", "/a")])].map((one) => one.id), ["c1"],
    "the `all` mark is asked for in the same row");
  let read = 0;
  for (const one of jsonlBack(bytes, [jsonlMark("kind", "consult")])) {
    read += 1;
    if (one.id === "c2") break;
  }
  assert.equal(read, 1, "the row before the answer was never parsed");
});

const asRows = (bytes) => jsonLines(bytes.toString("utf8")).filter((one) => one.kind === "consult").length;

test("a row torn by an append that stopped is no row to either reader, wherever the tear is", () => {
  const half = '{"kind":"consult","id":"c3"';
  const ended = Buffer.concat([stored(), Buffer.from(half)]);
  assert.equal(asRows(ended), 2, "the parsing reader drops a tear at the end");
  assert.equal(marked(ended, jsonlMark("kind", "consult")).length, 2, "and the scan reads no row out of it either");
  /* The tear that outlives the append after it: the next whole record lands on the same line, and neither reader has a row. */
  const inside = Buffer.concat([stored(), Buffer.from(`${half}${JSON.stringify({ kind: "consult", id: "c4" })}\n`)]);
  assert.equal(marked(inside, jsonlMark("kind", "consult")).length, asRows(inside), "and the two agree there too");
  const broken = Buffer.from(`{"kind":"consult","id":"c0"}\nnot json at all\n${'{"kind":"verdict","of":"c0"}'}\n`);
  assert.deepEqual(marked(broken, jsonlMark("kind", "consult")).map((one) => one.id), ["c0"], "a line that will not parse is skipped, as it is by the parse");
});

test("a store with no file reads as no bytes, not as a throw", () => {
  assert.equal(jsonlBytes(join(room, "nothing-here.jsonl")).length, 0);
});
