import assert from "node:assert/strict";
import test from "node:test";

import { dirtyRepo, tempRoom } from "../fixtures.mjs";
import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const room = tempRoom("hook-log-");
process.env.XDG_CONFIG_HOME = room;
const { HOOK_LOG_PATH, hookEntries, roundsBy, scrubbed } = await import("../../src/hooks/hook-log.mjs");
const CLI = new URL("../../src/cli.mjs", import.meta.url).pathname;
test.after(() => rmSync(room, { recursive: true, force: true }));

/* A Coolify token reached a session transcript through a redaction that missed one nesting level.
   These are the shapes that read as a credential without knowing the service. */
test("a credential is masked before it is written down", () => {
  assert.equal(scrubbed("coolify login --token 7|abc123def456"), "coolify login --token ***");
  assert.equal(scrubbed("forge x --api-key sk-live-1 y"), "forge x --api-key *** y");
  assert.match(scrubbed('curl -H "Authorization: Bearer abcdefghij"'), /Authorization: \*\*\*/u);
  const env = scrubbed("COOLIFY_TOKEN=7|abcdefghijklmnopqrstuvwxyz0123456789 forge x");
  assert.equal(env, "COOLIFY_TOKEN=*** forge x", "the name reads; only the value goes");
  assert.match(scrubbed("auth eyJhbGciOiJIUzI1NiJ9.eyJhIjoxfQ.sig"), /auth \*\*\*/u);
  assert.match(scrubbed("token ghp_abcdefghijklmnopqrstuv"), /token \*\*\*/u);
});

/* The four shapes above read as credentials by their value. These read as credentials by their
   name, and the log is not private: `forge hooks` prints it back into a session, so an unmasked
   secret here is one a later model request carries. */
test("a credential named as one is masked whatever its value looks like", () => {
  assert.equal(scrubbed("COOLIFY_TOKEN=9|Xk3mQp7 forge x"), "COOLIFY_TOKEN=*** forge x");
  assert.equal(scrubbed("export FORGE_SECRET=notarealone && forge x"), "export FORGE_SECRET=*** && forge x");
  assert.equal(scrubbed("PGPASSWORD=notarealone psql -h db"), "PGPASSWORD=*** psql -h db");
  assert.match(scrubbed("psql postgres://app:notarealone@db:5432/f"), /postgres:\/\/app:\*\*\*@db/u);
  assert.match(scrubbed('forge call x \'{"password":"notarealone"}\''), /"password":"\*\*\*"/u);
});

/* A name-based rule masks these too, so each case here carries no name a rule would read: without
   one, only the value's own shape stands between it and the log. The token rule was covered by a
   fixture the name rule now catches first, which is how a rule goes quietly untested. */
test("a value shaped like a credential is masked with nothing beside it to say so", () => {
  assert.match(scrubbed("forge x 7|abcdefghijklmnopqrstuvwxyz0123456789"), /forge x \*\*\*/u);
  assert.match(scrubbed("send Bearer abcdefghijklmnop"), /send Bearer \*\*\*/u);
});

/* Masking to the next space left most of a phrase behind, and what survives is printed back into a
   session. A quoted value goes whole. */
test("a quoted credential is masked past its spaces", () => {
  assert.equal(scrubbed("PASSWORD='not a real one' psql -h db"), "PASSWORD=*** psql -h db");
  assert.equal(scrubbed('forge x --token "not a real one" y'), "forge x --token *** y");
});

test("what is not a credential survives, and a long line is cut", () => {
  const query = "forge cloudflare dns f699ca3c1fae884abd0c47f2e5ff1622 --name cp.musetools.com";
  assert.equal(scrubbed(query), query, "a zone id and a hostname are what the log is read for");
  const long = scrubbed("x".repeat(400));
  assert.equal(long.length, 221, "220 kept plus the ellipsis");
  assert.ok(long.endsWith("…"));
});

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
  assert.match(entry.reason, /stages everything in the tree/u);
  assert.equal(readFileSync(HOOK_LOG_PATH, "utf8").trim().split("\n").length, hookEntries().length);
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
      HOOK_LOG_PATH,
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
    entry("four", "deny", `forge call forge_issues '{"action":"get","documentId":"ISS-65"}'`, "2026-09-03T10:01:00.000Z"),
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
    HOOK_LOG_PATH,
    `${JSON.stringify({ at: new Date().toISOString(), hook: "issue-read-first", decision: "deny", tool: "Bash", target: "forge claim ISS-65", reason: "r", session: "a-session" })}\n`,
  );
  const said = forge("--rounds");
  assert.equal(said.status, 0, said.stderr);
  assert.match(said.stdout, /a-sessio\s+\d+ refusal\(s\)/u, "one line per session");
  assert.match(said.stdout, /1 of them before a tracker write, over 1 refused write = 1 per write/u);
  assert.match(said.stdout, /only refusals are logged/u, "and the line says what the number is not");
});
