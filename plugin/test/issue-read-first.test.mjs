import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { keysIn, readsComments, unreadKeys, writesAnIssue } from "../src/issue-read.mjs";
import { shellText, starts } from "../hooks/_hook.mjs";
import { callHook } from "./fixtures.mjs";

const bash = (command) => ({ name: "Bash", input: { command } });
/* The hook's own wiring: the write test reads where a command starts, so it is given the starts. */
const writes = (command) => writesAnIssue(bash(command), starts(shellText(command)));
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
  assert.equal(readsComments("ISS-29", bash("forge issue ISS-29 --full")), false);
  assert.equal(readsComments("ISS-29", LIST), true);
});

test("a command that only MENTIONS both is not a read — measured against a real transcript", () => {
  // The first version searched the whole command for the key and the tool name, so a grep looking
  // for one that named the other cleared the gate. Its own diagnostics did it.
  const grep = bash(`python3 -c "if 'ISS-29' in t and 'forge_comments' in t: print(t)"`);
  assert.equal(readsComments("ISS-29", grep), false);
});

test("the call and the key have to be on one line, not merely in one command", () => {
  const apart = bash(`forge call forge_comments '{"action":"list"}'\necho ISS-29`);
  assert.equal(readsComments("ISS-29", apart), false);
});

test("a listing of a different issue does not satisfy this one", () => {
  assert.equal(readsComments("ISS-30", LIST), false);
});

test("every key the command names has to have been read", () => {
  const write = bash("forge comment ISS-29 @n.md # relates to ISS-30");
  assert.deepEqual(unreadKeys([LIST], write), ["ISS-30"]);
  assert.deepEqual(unreadKeys([], write), ["ISS-29", "ISS-30"]);
});

test("an MCP comments listing satisfies it too", () => {
  const read = { name: "mcp__forge__forge_comments", input: { action: "list", filters: { issue: "ISS-29" } } };
  assert.deepEqual(unreadKeys([read], bash("forge plan ISS-29 -")), []);
});

/* End to end through the hook itself: the pure functions above decide, but the exit code, the
   refusal text and where the search looks are the hook's, and only running it measures those. */
const HOOK = new URL("../hooks/issue-read-first.mjs", import.meta.url).pathname;
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
