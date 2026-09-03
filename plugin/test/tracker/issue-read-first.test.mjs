import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { keysIn, readsComments, unreadKeys, writesAnIssue } from "../../src/tracker/issue-read.mjs";
import { shellText, starts } from "../../hooks/_hook.mjs";
import { callHook } from "../fixtures.mjs";

const bash = (command) => ({ name: "Bash", input: { command } });
/* The hook's own wiring: the write test reads where a command starts, so it is given the starts. */
const writes = (command) => writesAnIssue(bash(command), starts(shellText(command)));
/* The same parser, injected the same way: a separator inside a quoted string is not a command. */
const SPOKEN = (input) => starts(shellText(input?.command));
const reads = (key, command) => readsComments(key, bash(command), SPOKEN);
const LIST = bash(`forge call forge_comments '{"action":"list","filters":{"issue":"ISS-29"}}'`);

test("a comment, a plan and an attach are writes", () => {
  for (const command of ["forge comment ISS-29 @n.md", "forge plan ISS-29 -", "forge attach issue ISS-29 a.png"]) {
    assert.equal(writes(command), true, command);
  }
});

test("a transition through `call` is a write; a list and a get are not", () => {
  assert.equal(writes(`forge call forge_issues '{"action":"transition","documentId":"ISS-29"}'`), true);
  assert.equal(writes(`forge call forge_issues '{"action":"list"}'`), false);
  assert.equal(writes(`forge call forge_issues '{"action":"get","documentId":"ISS-29"}'`), false);
});

test("reading the issue is not writing to it, however full", () => {
  assert.equal(writes("forge issue ISS-29 --full"), false);
  assert.equal(writes("forge issues --status open"), false);
});

test("an MCP call is judged by its action, not by its name", () => {
  const mcp = (action) => ({ name: "mcp__forge__forge_issues", input: { action, documentId: "ISS-29" } });
  assert.equal(writesAnIssue(mcp("update"), []), true);
  assert.equal(writesAnIssue(mcp("get"), []), false);
});

test("the key shape is a prefix and a number, so a tracker need not be named ISS", () => {
  assert.deepEqual(keysIn("forge comment ABC-7 and ISS-29"), ["ABC-7", "ISS-29"]);
});

test("`forge issue --full` is not a comments read — it returns none of them", () => {
  assert.equal(reads("ISS-29", "forge issue ISS-29 --full"), false);
  assert.equal(readsComments("ISS-29", LIST, SPOKEN), true);
});

test("a command that only MENTIONS both is not a read — measured against a real transcript", () => {
  // The first version searched the whole command for the key and the tool name, so a grep looking
  // for one that named the other cleared the gate. Its own diagnostics did it.
  const grep = bash(`python3 -c "if 'ISS-29' in t and 'forge_comments' in t: print(t)"`);
  assert.equal(readsComments("ISS-29", grep, SPOKEN), false);
});

test("the call and the key have to be on one line, not merely in one command", () => {
  const apart = bash(`forge call forge_comments '{"action":"list"}'\necho ISS-29`);
  assert.equal(readsComments("ISS-29", apart, SPOKEN), false);
});

/* The verb reads the whole record to assemble its brief, so it is a read of the comments — the same
   read the gate's own refusal asks for, by another name (ISS-44). */
test("forge resume is a read of the comments, and of the key it names alone", () => {
  assert.equal(reads("ISS-29", "forge resume ISS-29"), true);
  assert.equal(reads("ISS-29", "forge resume ISS-29 --json"), true);
  assert.equal(reads("ISS-29", "forge resume ISS-30"), false,
    "a brief of another issue read nothing about this one");
  assert.equal(reads("ISS-29", "forge resume ISS-30 && echo ISS-29"), false,
    "the key has to be the issue resume was given, not another word on the line");
  assert.equal(reads("ISS-29", "echo '; forge resume ISS-29'"), false,
    "and a separator inside a quoted string is not a command position");
  assert.equal(reads("ISS-29", "cd /tmp && forge resume ISS-29"), true, "after a separator it is the verb");
  assert.equal(reads("ISS-29", "/usr/local/bin/forge resume ISS-29"), true, "and a path before it is still it");
});

/* A mention is not a run, on either form: a line that merely names the verb and the key credited the
   read, and the write side has always judged command position. One anchor, so the two cannot drift. */
test("a line that only names the read verb credits nothing, on either form", () => {
  for (const command of [
    "echo forge resume ISS-29",
    `echo 'forge call forge_comments {"issue":"ISS-29"}'`,
    "grep -rn 'forge resume ISS-29' docs/",
  ]) {
    assert.equal(reads("ISS-29", command), false, command);
  }
  assert.equal(reads("ISS-29", `forge call forge_comments '{"action":"list","filters":{"issue":"ISS-29"}}'`), true,
    "while the call itself still counts");
  assert.equal(reads("ISS-29", `forge call forge_comments '{"filters":{"issue":"ISS-29"}}'`), false,
    "and a call naming no action is not demonstrably a read, which is how the write side reads it too");
  /* JSON keeps the last of two keys of one name and a text search finds the first, so a payload
     saying `action` twice could read as a list and post a comment. It counts as neither. */
  const twice = `forge call forge_comments '{"action":"list","action":"create","data":{"issue":"ISS-29","body":"x"}}'`;
  assert.equal(reads("ISS-29", twice), false, "a payload that names the action twice names none");
  assert.equal(writes(twice), true, "and the write side calls it a write, which is the safe way round");
  const escaped = `forge call forge_comments '{"action":"list","\\u0061ction":"create","data":{"issue":"ISS-29"}}'`;
  assert.equal(reads("ISS-29", escaped), false, "and an escaped spelling of the key is the same key to JSON");
  assert.equal(writes(escaped), true);
  const mangled = `forge call forge_comments '{"action":"list"`;
  assert.equal(reads("ISS-29", mangled), false, "a payload nothing can parse says nothing about itself");
  assert.equal(writesAnIssue({ name: "mcp__forge__forge_comments", input: { action: "list" } }, []), false,
    "while the tool's own object needs no parsing: the client already resolved its keys");
  assert.equal(writes("forge resume ISS-29"), false, "and it is not itself a write");
  assert.deepEqual(unreadKeys([bash("forge resume ISS-29")], bash("forge comment ISS-29 @n.md"), SPOKEN), [],
    "so a write to the issue it read is allowed");
  assert.deepEqual(unreadKeys([bash("forge resume ISS-30")], bash("forge comment ISS-29 @n.md"), SPOKEN), ["ISS-29"]);
});

/* The gate tells a write from a read by the action it names, and then credited any comments call
   naming the key — a `create`, including one it had itself refused, read nothing. */
test("a comments call that writes is no read of them, by either route", () => {
  const posted = { name: "mcp__forge__forge_comments", input: { action: "create", data: { issue: "ISS-29", body: "x" } } };
  assert.equal(readsComments("ISS-29", posted, SPOKEN), false, "posting a comment is not reading them");
  assert.equal(reads("ISS-29", `forge call forge_comments '{"action":"create","data":{"issue":"ISS-29"}}'`), false);
  assert.equal(reads("ISS-29", `forge call forge_comments '{"action":"get","filters":{"issue":"ISS-29"}}'`), true,
    "while a get is a read, as the write side already reads the same two actions");
});

test("a listing of a different issue does not satisfy this one", () => {
  assert.equal(readsComments("ISS-30", LIST, SPOKEN), false);
});

test("every key the command names has to have been read", () => {
  const write = bash("forge comment ISS-29 @n.md # relates to ISS-30");
  assert.deepEqual(unreadKeys([LIST], write, SPOKEN), ["ISS-30"]);
  assert.deepEqual(unreadKeys([], write, SPOKEN), ["ISS-29", "ISS-30"]);
});

test("an MCP comments listing satisfies it too", () => {
  const read = { name: "mcp__forge__forge_comments", input: { action: "list", filters: { issue: "ISS-29" } } };
  assert.deepEqual(unreadKeys([read], bash("forge plan ISS-29 -"), SPOKEN), []);
});

/* End to end through the hook itself: the pure functions above decide, but the exit code, the
   refusal text and where the search looks are the hook's, and only running it measures those. */
const HOOK = new URL("../../hooks/entries/issue-read-first.mjs", import.meta.url).pathname;
const room = mkdtempSync(join(tmpdir(), "issue-read-first-"));
const HOME = { ...process.env, XDG_CONFIG_HOME: room };
test.after(() => rmSync(room, { recursive: true, force: true }));

let count = 0;
const used = (name, input) => ({ type: "assistant", message: { content: [{ type: "tool_use", name, input }] } });
const heard = (text) => ({ type: "user", message: { content: [{ type: "tool_result", content: text }] } });

const gate = (command, records) => {
  count += 1;
  const path = join(room, `t${count}.jsonl`);
  writeFileSync(path, `${records.map((one) => JSON.stringify(one)).join("\n")}\n`);
  const run = callHook(
    HOOK,
    { tool_name: "Bash", tool_input: { command }, transcript_path: path, cwd: process.cwd() },
    HOME,
  );
  return run.stdout.trim() ? JSON.parse(run.stdout) : null;
};
const because = (out) => out?.hookSpecificOutput?.permissionDecisionReason ?? "";

test("a comment with the comments unread is refused, and the refusal names the call to make", () => {
  const out = gate("forge comment ISS-29 @note.md", [used("Bash", { command: "forge issue ISS-29 --full" })]);
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(because(out), /ISS-29/);
  assert.match(because(out), /forge_comments/);
});

test("the listing in the transcript clears it", () => {
  const read = used("Bash", { command: `forge call forge_comments '{"action":"list","filters":{"issue":"ISS-29"}}'` });
  assert.equal(gate("forge comment ISS-29 @note.md", [read]), null);
});

test("the hook's own refusal does not satisfy the next attempt", () => {
  // It names the command to run, so a search over anything but tool_use blocks feeds on itself.
  const echoed = heard("Do this: forge call forge_comments '{\"action\":\"list\",\"filters\":{\"issue\":\"ISS-29\"}}'");
  assert.equal(gate("forge comment ISS-29 @note.md", [echoed])?.hookSpecificOutput?.permissionDecision, "deny");
});

test("a transcript that will not open stands the gate down", () => {
  const run = callHook(
    HOOK,
    { tool_name: "Bash", tool_input: { command: "forge comment ISS-29 -" }, transcript_path: "/nope" },
    HOME,
  );
  assert.equal(run.stdout.trim(), "");
});

/* Reported by the gate refusing this very patch twice: prose that quotes a write verb near a
   reference is not a write. A heredoc body is data and a quoted argument belongs to the program
   holding it — while a real payload keeps its key in quotes, so keys are still read raw. */
test("a write verb in prose is not a write; one in a payload still is", () => {
  const fixture = 'cat > t.mjs <<\'EOF\'\nassert.equal(writes("forge comment ISS-45 @n.md"), true);\nEOF';
  assert.equal(gate(fixture, []), null, "a heredoc body naming a write verb");
  const note = 'echo "the gate refused forge comment ISS-45 on a test file" | forge codex consult --diff';
  assert.equal(gate(note, []), null, "an intent quoting one, past a pipe");
  const real = `forge call forge_issues '{"action":"update","documentId":"ISS-45","data":{"title":"x"}}'`;
  assert.equal(gate(real, [])?.hookSpecificOutput?.permissionDecision, "deny", "the write itself");
  const after = gate("git status --short && forge comment ISS-45 @note.md", []);
  assert.equal(after?.hookSpecificOutput?.permissionDecision, "deny", "and a write past a separator");
  assert.equal(writes('echo "run this: | forge comment ISS-45 -" > n.md'), false, "a quoted separator");
});

/* A start is wherever the shared grammar says one is, and not the first token of the line: each of
   these reaches the verb past a prefix, and each is a write. */
test("a prefix before the verb is still the verb", () => {
  for (const command of [
    "sudo forge comment ISS-45 @n.md",
    "(forge comment ISS-45 @n.md)",
    "find . -name n.md -exec forge comment ISS-45 {} ;",
    "printf ISS-45 | xargs -I{} forge comment {} @n.md",
    "NOTE='review now' forge comment ISS-45 @n.md",
    "/usr/local/bin/forge plan ISS-45 -",
    `sh -c "forge comment ISS-45 @n.md"`,
  ]) {
    assert.equal(writes(command), true, command);
  }
});
