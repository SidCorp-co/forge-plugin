import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const room = mkdtempSync(join(tmpdir(), "hook-log-"));
process.env.XDG_CONFIG_HOME = room;
const { HOOK_LOG_PATH, hookEntries, scrubbed } = await import("../src/hook-log.mjs");
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
  spawnSync(process.execPath, [new URL("../hooks/advisor-first.mjs", import.meta.url).pathname], {
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: { command: "coolify login --token 7|secretsecret && cp a b" },
      transcript_path: path,
      session_id: "logged",
      cwd: process.cwd(),
    }),
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: room },
  });
  const entry = hookEntries().at(-1);
  assert.equal(entry.hook, "advisor-first");
  assert.equal(entry.decision, "deny");
  assert.equal(entry.tool, "Bash");
  assert.equal(entry.session, "logged");
  assert.match(entry.target, /--token \*\*\* && cp a b/u);
  assert.ok(!entry.target.includes("secretsecret"), "the log is a file on disk, so it never holds one");
  assert.match(entry.reason, /advisor\(\) has not run/u);
  assert.equal(readFileSync(HOOK_LOG_PATH, "utf8").trim().split("\n").length, hookEntries().length);
});
