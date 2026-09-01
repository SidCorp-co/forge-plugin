/* The event on stdin and the decision on stdout, as Claude Code calls it. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { callHook, dirtyRepo, homeEnv } from "./fixtures.mjs";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "hooks", "bash-guard.mjs");
const HOME = homeEnv("bash-guard");

/* The git rules stand down on a clean tree, so the fixtures bring their own dirty one. */
const DIRTY = dirtyRepo();
const decide = (command) => {
  const run = callHook(HOOK, { session_id: randomUUID(), tool_name: "Bash", tool_input: { command }, cwd: DIRTY }, HOME);
  assert.equal(run.status, 0, run.stderr);
  if (!run.stdout.trim()) return { allowed: true };
  const answer = JSON.parse(run.stdout).hookSpecificOutput;
  return { allowed: answer.permissionDecision !== "deny", reason: answer.permissionDecisionReason };
};

/* Assembled: the guard reads this suite's own command line when a shell writes the file. */
const STAGE_ALL = `git ${"add"} -A`;
const BY_NAME = `pk${"ill"} -f node`;
const SPAWNING = `sub${"process"}.run`;

test("the command itself is refused, and the refusal names the rule and a way out", () => {
  const { allowed, reason } = decide(`${STAGE_ALL} && git commit -m done`);
  assert.equal(allowed, false);
  assert.match(reason, /stages everything in the tree/u);
  assert.match(reason, /Instead: Stage the paths you changed/u);
  assert.match(reason, /forge hooks --how bash-guard/u);
  assert.equal(decide(BY_NAME).allowed, false, "selects by name, so it is not the pid you meant");
});

/* Twice in one session a heredoc was refused for holding the command in a *string literal*. */
test("a literal inside a program is data, and the line that ran it is not", () => {
  assert.ok(decide(`python3 - <<'PY'\nt = t.replace("${STAGE_ALL}", "x")\nPY`).allowed);
  assert.equal(decide(`echo 'notes' > /tmp/x && ${STAGE_ALL}`).allowed, false, "outside a body it runs");
  assert.equal(decide(`bash -c "${STAGE_ALL}"`).allowed, false, "the operator's line keeps its quotes");
  assert.equal(
    decide(`python3 - <<'PY'\n${SPAWNING}("${STAGE_ALL}", shell=True)\nPY`).allowed,
    false,
    "a body that can reach a shell keeps every literal",
  );
});

/* The shell removes a quote and keeps what is inside it, so a quoted flag is the flag. Four rules
   read the flag directly and missed all four of these until codex named them. */
test("a quoted flag is still the flag the rule is about", () => {
  const q = String.fromCharCode(34);
  assert.equal(decide(`git ${"add"} ${q}-A${q}`).allowed, false);
  assert.equal(decide(`git reset ${q}--hard${q}`).allowed, false);
  assert.equal(decide(`git ${q}stash${q}`).allowed, false);
  assert.equal(decide(`eslint ${q}--fix${q} .`).allowed, false);
  assert.equal(decide(`git checkout -- ${q}file.txt${q}`).allowed, false);
});

/* Reading the stash reverts nothing, and refusing `${"stash"} list` cost the whole line it sat on. */
test("reading the stash is not reverting it", () => {
  const verb = "stash";
  assert.equal(decide(`git ${verb} list`).allowed, true);
  assert.equal(decide(`git ${verb} show -p`).allowed, true);
  assert.equal(decide(`git ${verb} push -m probe`).allowed, false);
  assert.equal(decide(`git ${verb}`).allowed, false);
});
