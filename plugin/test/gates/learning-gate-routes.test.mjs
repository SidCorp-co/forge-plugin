/* What each of learning-gate's refusals tells a run to do, and in which order. Beside the gate's own
   suite rather than in it, which is at its length cap; the fixtures here are this file's own. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { answered, callHook, homeEnv, tempRoom } from "../fixtures.mjs";
import { assertRouteFirst } from "../fixtures/route-first.mjs";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "hooks", "entries", "learning-gate.mjs");
const HOME = homeEnv("learning-gate-routes");

/* Every call its own session: the gate asks once per file per session, and a shared id would pass the
   second case for the first case's reason. */
const reasonOf = (event, env = HOME) => {
  const session = randomUUID();
  const run = callHook(HOOK, { session_id: session, ...event }, { ...env, FORGE_SESSION_ID: session });
  assert.equal(run.status, 0, run.stderr);
  return answered(run)?.hookSpecificOutput?.permissionDecisionReason ?? null;
};
const shell = (command) => reasonOf({ tool_name: "Bash", tool_input: { command } });
const written = (file, content, tool = "Write") =>
  reasonOf({ tool_name: tool, tool_input: { file_path: file, [tool === "Write" ? "content" : "new_string"]: content } });

/* A real directory for each kind, since whether the file is there is the question. */
const memory = join(tempRoom("learning-routes-"), "memory");
mkdirSync(memory);
const HELD = join(memory, "background-work-survives-tool-timeout.md");
const FACT = "A Bash tool timeout stops the waiting and never the process, so an empty output file beside a "
  + "live pid means the work is still running rather than killed.";
writeFileSync(HELD, `---\nname: background-work-survives-tool-timeout\nmetadata:\n  type: feedback\n---\n\n${FACT}\n`);
const skill = join(tempRoom("learning-routes-skill-"), "skills", "demo");
mkdirSync(join(skill, "references"), { recursive: true });
const LINE = "A refusal names the shape it refused and the one action that clears it.";
writeFileSync(join(skill, "SKILL.md"), `# demo\n\n${LINE}\n`);

/* A correction sent through the shell was told the new-memory bar and "write nothing", and the run
   dropped the fix: Edit asks what a change to a file already there owes, so that is where one is sent,
   and the bar is for a file that is not. */
test("a shell write to a memory or skill file that exists is sent to Edit, and only a new one hears the bar", () => {
  for (const file of [HELD, join(skill, "SKILL.md")]) {
    const reason = shell(`sed -i 's/a/b/' ${file}`);
    assert.match(reason, /^Hold — re-send this change with Edit/u, reason);
    assert.match(reason, /already exists, written through the shell/u, "the shape follows the route");
    assert.doesNotMatch(reason, /Record only what cost a cycle|write nothing|change nothing/u,
      `a file that exists is not asked the new-memory question: ${reason}`);
  }
  const fresh = shell(`cat > ${join(memory, "never-written.md")} <<'EOF'\nbody\nEOF`);
  assert.match(fresh, /^Hold — write it with Write and declare `type:`/u, fresh);
  assert.match(fresh, /\n\nRecord only what cost a cycle/u, "and the bar is served after the route");
});

/* AC-07-3-4. Every route this gate refuses on, each read for the order and not for its words. */
test("every refusal this gate writes leads with its route", () => {
  const reasons = {
    tracker: reasonOf({ tool_name: `mcp__forge__forge${"_"}memory${"_"}write`, tool_input: { source: "note", text: "x" } }),
    "shell, a memory that exists": shell(`sed -i 's/a/b/' ${HELD}`),
    "shell, a skill that exists": shell(`sed -i 's/a/b/' ${join(skill, "SKILL.md")}`),
    "shell, a new memory": shell(`cat > ${join(memory, "trap.md")}`),
    "shell, a new skill file": shell(`echo x > ${join(skill, "references", "new.md")}`),
    "a new memory": written(join(memory, "a-fresh-trap.md"), "A pnpm workspace resolves a symlinked package twice."),
    "a memory already written": written(join(memory, "killed-jobs-keep-running.md"), `${FACT}\n`),
    "an edit to a memory": written(HELD, "a corrected sentence", "Edit"),
    "a skill's own text": written(join(skill, "SKILL.md"), "a line of method"),
    "a skill duplicate": written(join(skill, "references", "shape.md"), `${LINE}\n`),
  };
  for (const [label, reason] of Object.entries(reasons)) assertRouteFirst(reason, label);
  assert.match(reasons["a memory already written"], /\n\nAlready in `background-work-survives-tool-timeout\.md`/u,
    "the twin is named after the route, not in it");
});
