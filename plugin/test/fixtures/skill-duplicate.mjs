/* A skill that already says one sentence, and a write of that sentence into a second file of it. The
   learning gate refuses a duplicate before its once-per-file stamp, so this route has its own fixture. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { callHook, tempRoom } from "../fixtures.mjs";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "hooks", "entries", "learning-gate.mjs");

export const dupRoom = () => {
  const room = join(tempRoom("skill-dup-gate-"), "skills", "demo");
  const line = "A refusal names the shape it refused and the one action that clears it.";
  mkdirSync(join(room, "references"), { recursive: true });
  writeFileSync(join(room, "SKILL.md"), `# demo\n\n${line}\n`);
  return { room, line };
};

/* As the harness sends it. A run's own session sits on the event and in the environment both, the id
   a run was handed outranking the event's. A subagent's names the dispatcher in `session_id` and the
   run in `agent_id` alone, and its process carries the wave's id and none of the run's. */
export const dupWrite = (session, { room, line }, { home, name = "shape.md", agent = null }) => {
  const env = agent ? { ...home, CLAUDE_CODE_SESSION_ID: "the-wave" } : { ...home, FORGE_SESSION_ID: session };
  if (agent) delete env.FORGE_SESSION_ID;
  const event = {
    session_id: session,
    ...(agent ? { agent_id: agent } : {}),
    tool_name: "Write",
    tool_input: { file_path: join(room, "references", name), content: `${line}\n` },
  };
  const run = callHook(HOOK, event, env);
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout).hookSpecificOutput.permissionDecisionReason;
};
