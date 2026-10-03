/* Which word hands an interpreter its inline program is that interpreter's own, so a command a body hands a
   shell is refused after each one the table lists, as it is after `python3 -c`, and a quoted word after
   php's `-e`, which takes no program, is an argument (ISS-3074). */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { INTERPRETERS } from "../../../src/hooks/program/spoken.mjs";
import { callHook, dirtyRepo, homeEnv } from "../../fixtures.mjs";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "hooks", "entries", "bash-guard.mjs");
const HOME = homeEnv("bash-guard-inline-words");
const DIRTY = dirtyRepo();

/* Assembled, so this file written by a shell is not itself a command the guard reads. */
const STAGE_ALL = `git ${"add"} -A`;
/* The call each language hands a shell a string through; perl, ruby and php keep every name, so python's serves them. */
const SPAWN = { python: `sub${"process"}.run`, node: `exec${"Sync"}` };
const handing = (speaks) => `${SPAWN[speaks] ?? SPAWN.python}("${STAGE_ALL}")`;

const allowed = (command) => {
  const run = callHook(HOOK, { session_id: randomUUID(), tool_name: "Bash", tool_input: { command }, cwd: DIRTY }, HOME);
  assert.equal(run.status, 0, run.stderr);
  return !run.stdout.trim() || JSON.parse(run.stdout).hookSpecificOutput.permissionDecision !== "deny";
};

test("a body handing a shell a refused command is refused after every interpreter's own inline word", () => {
  for (const [runner, { speaks, inline }] of Object.entries(INTERPRETERS)) {
    for (const word of inline) {
      assert.equal(allowed(`${runner} ${word} '${handing(speaks)}'`), false, `${runner} ${word}`);
    }
  }
});

test("the same body after php's -e is an argument, php taking no program by that switch", () => {
  assert.equal(allowed(`php -e '${handing("php")}'`), true);
});
