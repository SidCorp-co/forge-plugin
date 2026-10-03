/* A refused command standing at the opening backtick of a pair is run by the shell as the substitution's
   body, so the guard refuses it there as it does at the head of a line, and an argument after the closing
   backtick is still an argument (ISS-3069). */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { callHook, dirtyRepo, homeEnv } from "../../fixtures.mjs";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "hooks", "entries", "bash-guard.mjs");
const HOME = homeEnv("bash-guard-backticks");
const DIRTY = dirtyRepo();
const TICK = "\x60";

const allowed = (command) => {
  const run = callHook(HOOK, { session_id: randomUUID(), tool_name: "Bash", tool_input: { command }, cwd: DIRTY }, HOME);
  assert.equal(run.status, 0, run.stderr);
  return !run.stdout.trim() || JSON.parse(run.stdout).hookSpecificOutput.permissionDecision !== "deny";
};

test("a refused command at an opening backtick is refused, bare or under a double quote", () => {
  assert.equal(allowed("git reset --hard"), false, "the shape itself, on this tree");
  assert.equal(allowed(`echo ${TICK}git reset --hard${TICK}`), false, "bare");
  assert.equal(allowed(`echo "${TICK}git reset --hard${TICK}"`), false, "under a double quote");
});

test("the same words after a closing backtick are an argument", () => {
  assert.equal(allowed(`echo ${TICK}date${TICK} git reset --hard`), true);
});
