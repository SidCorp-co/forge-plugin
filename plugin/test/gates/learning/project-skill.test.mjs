/* The host loads a project's own `.claude/skills/` for that project alone, so its text is a note about
   one repository by construction: the question the gate asks there has no honest answer (ISS-379).
   Called the way Claude Code calls the gate, the event on stdin and the decision on stdout. */
import { mkdirSync, symlinkSync } from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { answered, callHook, homeEnv, tempRoom } from "../../fixtures.mjs";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "hooks", "entries", "learning", "learning-gate.mjs");
const HOME = homeEnv("learning-gate-project-skill");
const SKILL_DIR = "/home/dev/app/plugin/skills/issue-flow";
const PROJECT_SKILL = "/home/dev/app/.claude/skills/uat/SKILL.md";

const decided = (run) => {
  const said = answered(run);
  if (said === null) return { allowed: true };
  const answer = said.hookSpecificOutput;
  return { allowed: answer.permissionDecision !== "deny", reason: answer.permissionDecisionReason };
};
const ask = (event, env = HOME) => decided(callHook(HOOK, { session_id: randomUUID(), ...event }, env));
const decide = (command, env) => ask({ tool_name: "Bash", tool_input: { command } }, env);
const at = (cwd, command) => ask({ tool_name: "Bash", tool_input: { command }, cwd });
const edit = (file_path) => ask({ tool_name: "Edit", tool_input: { file_path, old_string: "a", new_string: "b" } });

test("a project's own skill is not a skill's own text", () => {
  assert.equal(edit(PROJECT_SKILL).allowed, true);
  assert.equal(ask({ tool_name: "Write", tool_input: { file_path: PROJECT_SKILL, content: "x" } }).allowed, true, "written whole too");
  assert.equal(decide(`sed -i s/a/b/ ${PROJECT_SKILL}`).allowed, true, "and through the shell");
  assert.equal(at("/home/dev/app", "echo x > .claude/skills/uat/references/run.md").allowed, true, "spelt from the project's own tree");
  assert.equal(edit(`${SKILL_DIR}/SKILL.md`).allowed, false, "while a plugin's skill still is");
});

const home = HOME.HOME;
const [parent, user] = [dirname(home), home.split("/").pop()];

test("the home's skills are still guarded, however the path reaches them", () => {
  assert.equal(edit(join(home, ".claude", "skills", "demo", "SKILL.md")).allowed, false, "the home's serve every project");
  assert.equal(at(home, "echo x > .claude/skills/demo/SKILL.md").allowed, false, "spelt from the home as well");
  assert.equal(decide("echo x > ~/.claude/skills/demo/SKILL.md").allowed, false, "and `~` is");
  assert.equal(decide("echo x > ~/app/.claude/skills/demo/SKILL.md").allowed, true, "while a project under it is not");
  assert.equal(decide(`echo x > ~/../${user}/.claude/skills/demo/SKILL.md`).allowed, false, "and a `..` back into the home is the home");
  assert.equal(edit("/home/dev/app/.claude/skills/../../plugin/skills/issue-flow/SKILL.md").allowed, false, "or out into a plugin");
  const project = tempRoom("project-linked-skills-");
  mkdirSync(join(home, ".claude", "skills", "demo"), { recursive: true });
  mkdirSync(join(project, ".claude"), { recursive: true });
  symlinkSync(join(home, ".claude", "skills"), join(project, ".claude", "skills"));
  assert.equal(edit(join(project, ".claude", "skills", "demo", "SKILL.md")).allowed, false, "and a project's link to the home's is the home's");
  const fresh = join(project, ".claude", "skills", "not-made-yet", "SKILL.md");
  assert.equal(ask({ tool_name: "Write", tool_input: { file_path: fresh, content: "x" } }).allowed, false, "for a skill it has not made yet too");
});

test("an owner the command built rather than spelt is no project's", () => {
  const env = { ...HOME, BASE: parent };
  const tail = `${user}/.claude/skills/demo/SKILL.md`;
  assert.equal(decide("echo x > $HOME/.claude/skills/demo/SKILL.md").allowed, false, "a variable nobody resolved may be the home");
  assert.equal(decide(`echo x > \${BASE}/${tail}`, env).allowed, false, "and so may the rooted tail one leaves behind");
  assert.equal(decide(`echo x > "\${BASE}"/${tail}`, env).allowed, false, "with the substitution quoted apart from it too");
  assert.equal(decide(`touch \${BASE}\\\n/${tail}`, env).allowed, false, "or a line continued onto it");
  assert.equal(decide(`echo x > "/home/dev/app/.claude/skills/demo/SKILL.md"`, env).allowed, true, "while a quoted owner spelt whole is one");
});
