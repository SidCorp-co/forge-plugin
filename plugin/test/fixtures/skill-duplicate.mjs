/* A skill that already says one sentence, and a write of that sentence into a second file of it. The
   learning gate teaches a duplicate before its once-per-file stamp, so this route has its own fixture. */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { answered, callHook, tempRoom } from "../fixtures.mjs";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "hooks", "entries", "learning", "learning-gate.mjs");

export const dupRoom = () => {
  const room = join(tempRoom("skill-dup-gate-"), "skills", "demo");
  const line = "A refusal names the shape it refused and the one action that clears it.";
  const other = "A payload file is written outside the checkout, under the run's own scratch directory.";
  mkdirSync(join(room, "references"), { recursive: true });
  writeFileSync(join(room, "SKILL.md"), `# demo\n\n${line}\n\n${other}\n`);
  return { room, line, other };
};

/* As the harness sends it. A run's own session sits on the event and in the environment both, the id
   a run was handed outranking the event's; a subagent's names the run only in `agent_id`, beside the wave's id. */
export const dupWrite = (session, { room, line }, { home, name = "shape.md", agent = null, says = line }) => {
  const write = { tool_name: "Write", tool_input: { file_path: join(room, "references", name), content: `${says}\n` } };
  const env = agent ? { ...home, CLAUDE_CODE_SESSION_ID: "the-wave" } : { ...home, FORGE_SESSION_ID: session };
  if (agent) delete env.FORGE_SESSION_ID;
  const run = callHook(HOOK, { session_id: session, ...(agent ? { agent_id: agent } : {}), ...write }, env);
  return answered(run)?.hookSpecificOutput?.additionalContext ?? "";
};
