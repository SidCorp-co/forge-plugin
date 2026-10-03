/* Which file a shell write into a guarded directory lands on, where the command names the directory
   and not the file. Beside the gate's own suite rather than in it, which is at its length cap. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { answered, callHook, homeEnv } from "../../fixtures.mjs";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "hooks", "entries", "learning-gate.mjs");
const HOME = homeEnv("learning-gate-aims");
/* Fixture paths, not this machine's: a string holding /memory/ or /skills/ is what the gate guards. */
const MEMORY = "/home/dev/.claude/projects/-home-dev-app/memory";
const SKILL_DIR = "/home/dev/app/plugin/skills/issue-flow";
const SKILL = `${SKILL_DIR}/SKILL.md`;

/* Every call its own session, since the gate asks once per file per session. */
const decide = (command) => {
  const run = callHook(HOOK, { session_id: randomUUID(), tool_name: "Bash", tool_input: { command } }, HOME);
  assert.equal(run.status, 0, run.stderr);
  const said = answered(run);
  return { allowed: said === null || said.hookSpecificOutput.permissionDecision !== "deny" };
};

/* Into a `-t` directory the file written is the directory joined with the source's name, which the command never spells, so a new skill file went through unasked (ISS-2684). */
test("a copy, a move or an install into a guarded directory is a write to the file it lands on", () => {
  for (const dir of [SKILL_DIR, MEMORY]) assert.equal(decide(`cp -t ${dir} /tmp/new.md`).allowed, false, dir);
  assert.equal(decide(`cp -t ${SKILL_DIR} /tmp/one.md /tmp/two.txt`).allowed, false, "the first of several sources");
  assert.equal(decide(`cp -t ${SKILL_DIR} /tmp/one.txt /tmp/two.md`).allowed, false, "and the last");
  for (const spelling of [`mv -t ${SKILL_DIR}`, `install -t ${SKILL_DIR}`, `cp --target-directory ${SKILL_DIR}`,
    `cp --target-directory=${SKILL_DIR}`, `cp -t${SKILL_DIR}`, `cp -vt ${SKILL_DIR}`]) {
    assert.equal(decide(`${spelling} /tmp/new.md`).allowed, false, spelling);
  }
  assert.equal(decide("cp -t /tmp/elsewhere /tmp/new.md").allowed, true, "a directory nothing guards");
  assert.equal(decide(`cp -t /tmp ${SKILL}`).allowed, true, "and a guarded file copied out is only read");
});

/* The walk placed only a substitution a double quote opened, so the whole-name reading stopped at the first bare one and a quoted target after it was cut at its bracket (ISS-3087). */
test("a substitution closed in an earlier command does not hide the next command's quoted target", () => {
  for (const opened of ["$(date)", "`date`", '"$(date)"', "$\\\n(date)"]) {
    assert.equal(decide(`x=${opened}; touch '${MEMORY}/r(1).md'`).allowed, false, opened);
    assert.equal(decide(`x=${opened}; cp notes.md '${MEMORY}/r (1).md'`).allowed, false, opened);
  }
});
