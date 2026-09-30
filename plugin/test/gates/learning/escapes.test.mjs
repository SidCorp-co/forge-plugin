/* A guarded path spelt through a backslash escape, which the shell takes out before the write lands.
   Beside the gate's own suite rather than in it, which is at its length cap. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { answered, callHook, homeEnv } from "../../fixtures.mjs";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "hooks", "entries", "learning-gate.mjs");
const HOME = homeEnv("learning-gate-escapes");

/* Every call its own session, since the gate asks once per file per session. */
const decide = (command) => {
  const run = callHook(HOOK, { session_id: randomUUID(), tool_name: "Bash", tool_input: { command } }, HOME);
  assert.equal(run.status, 0, run.stderr);
  const said = answered(run)?.hookSpecificOutput;
  return { allowed: !said || said.permissionDecision !== "deny", reason: said?.permissionDecisionReason ?? "" };
};

/* A glob bracket a backslash made literal is the directory's own character, so the write it spells is the
   memory write the plain spelling is, and it went through unasked (ISS-2867). */
test("a memory write through an escaped glob bracket is refused as the plain spelling is", () => {
  const plain = decide("echo x | tee /home/dev/.claude/projects/-a1/memory/trap.md");
  const escaped = decide(String.raw`echo x | tee /home/dev/.claude/projects/-a\[1\]/memory/trap.md`);
  assert.equal(escaped.allowed, false);
  assert.match(escaped.reason, /Record only what cost a cycle/u, "with the conditions the answer has to meet");
  assert.equal(escaped.reason, plain.reason);
});
