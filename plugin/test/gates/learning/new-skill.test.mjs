/* The first part of a skill this copy does not serve yet: the flow directory it would sit in does not
   exist, and reading that as a fault stood the gate down and let the write through unasked. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { callHook, homeEnv, tempRoom } from "../../fixtures.mjs";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "hooks", "entries", "learning-gate.mjs");
const HOME = homeEnv("learning-gate-new-skill");
/* Sentences long enough for the duplicate reading to compare, which is the reading that met the missing directory. */
const FIRST = "# Fresh\n\nA master reads which command answers the question a pass is asking before it reaches for one.\n";

test("the first part of a new served skill is held like any other part", () => {
  const file = join(tempRoom("skill-gate-first-"), "plugin", "guides", "skills", "fresh", "default", "guide", "01-fresh.md");
  const run = callHook(HOOK, { session_id: randomUUID(), tool_name: "Write",
    tool_input: { file_path: file, content: FIRST } }, HOME);
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /could not judge/u, "the gate stood down on a directory not yet made");
  assert.match(JSON.parse(run.stdout).hookSpecificOutput.permissionDecisionReason,
    /trap \| method \| invariant \| discovery \| boundary/u, "the write is held on the skill-text question");
});
