import assert from "node:assert/strict";
import test from "node:test";

import { dirtyRepo } from "./fixtures.mjs";
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const room = mkdtempSync(join(tmpdir(), "hook-log-"));
process.env.XDG_CONFIG_HOME = room;
const { HOOK_LOG_PATH, hookEntries, scrubbed } = await import("../src/hook-log.mjs");
const CLI = new URL("../src/cli.mjs", import.meta.url).pathname;
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
  spawnSync(process.execPath, [new URL("../hooks/entries/bash-guard.mjs", import.meta.url).pathname], {
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
