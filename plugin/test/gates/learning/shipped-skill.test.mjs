/* A skill the project ships is the product, not a learning: the gate leaves it alone, while a memory
   file, a home skill, and one nobody committed yet are still asked, and a real learning is asked afresh
   whenever its content changes (ISS-58). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { answered, callHook, homeEnv, tempRoom } from "../../fixtures.mjs";
import { shippedSkill } from "../../../src/checks/learning.mjs";

const HOOK = new URL("../../../hooks/entries/learning/learning-gate.mjs", import.meta.url).pathname;
const HOME = homeEnv("learning-shipped-skill");

const git = (repo, args) => {
  const run = spawnSync("git", ["-C", repo, ...args], { cwd: repo, encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  assert.equal(run.status, 0, run.stderr);
};

const repoWith = (files) => {
  const repo = tempRoom("shipped-skill-");
  git(repo, ["init", "-q"]);
  for (const [rel, body] of Object.entries(files)) {
    const at = join(repo, rel);
    mkdirSync(join(at, ".."), { recursive: true });
    writeFileSync(at, body);
  }
  return repo;
};

test("a committed skill is shipped; one nobody committed, a memory file and one outside the tree are not", () => {
  const repo = repoWith({ "src/skills/deploy/SKILL.md": "the method\n", "memory/deploy.md": "a fact\n" });
  git(repo, ["add", "src/skills/deploy/SKILL.md", "memory/deploy.md"]);
  git(repo, ["commit", "-qm", "first"]);
  assert.equal(shippedSkill(join(repo, "src/skills/deploy/SKILL.md"), repo), true, "tracked under the source tree");
  assert.equal(shippedSkill(join(repo, "memory/deploy.md"), repo), false, "a memory file is never a shipped skill");
  mkdirSync(join(repo, "src/skills/fresh"), { recursive: true });
  writeFileSync(join(repo, "src/skills/fresh/SKILL.md"), "x\n");
  assert.equal(shippedSkill(join(repo, "src/skills/fresh/SKILL.md"), repo), false, "one nobody committed yet is not shipped");
  assert.equal(shippedSkill("/home/dev/elsewhere/skills/x/SKILL.md", repo), false, "a skill outside the tree is not the tree's");
});

test("a skill under a source the marketplace names is shipped, committed or not", () => {
  const repo = repoWith({
    ".claude-plugin/marketplace.json": JSON.stringify({ plugins: [{ name: "mod", source: "./mod" }] }),
    "mod/skills/run/SKILL.md": "x\n",
  });
  assert.equal(shippedSkill(join(repo, "mod/skills/run/SKILL.md"), repo), true, "under a marketplace plugin's source");
});

const decided = (run) => {
  const said = answered(run);
  return said === null ? { allowed: true } : { allowed: said.hookSpecificOutput.permissionDecision !== "deny" };
};
const edit = (session, file, content, cwd) =>
  decided(callHook(HOOK, { session_id: session, tool_name: "Edit",
    tool_input: { file_path: file, old_string: "x", new_string: content }, cwd }, HOME));

test("the gate leaves a shipped skill alone and still stops before a home skill", () => {
  const repo = repoWith({ "src/skills/deploy/SKILL.md": "the method\n" });
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-qm", "first"]);
  assert.equal(edit(randomUUID(), join(repo, "src/skills/deploy/SKILL.md"), "more", repo).allowed, true, "the tree's own shipped skill");
  assert.equal(edit(randomUUID(), join(HOME.HOME, ".claude/skills/demo/SKILL.md"), "more", repo).allowed, false, "a home skill is a learning");
});

test("a home skill is asked once per content: a re-send passes, a changed one is asked afresh", () => {
  const session = randomUUID();
  const repo = repoWith({ "src/skills/deploy/SKILL.md": "the method\n" });
  const home = join(HOME.HOME, ".claude/skills/learned/SKILL.md");
  assert.equal(edit(session, home, "first draft", repo).allowed, false, "first seen, so asked");
  assert.equal(edit(session, home, "first draft", repo).allowed, true, "the same text re-sent passes");
  assert.equal(edit(session, home, "second draft", repo).allowed, false, "changed, so asked again");
});
