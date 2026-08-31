/* The event on stdin and the decision on stdout, as Claude Code calls it. */
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "hooks", "bash-guard.mjs");
/* A refusal writes to the config dir, so a suite that skips this one logs onto the developer. */
const HOME = { ...process.env, XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), "bash-guard-home-")) };

/* The git rules stand down on a clean tree, so the fixtures run against this dirty checkout. */
const decide = (command) => {
  const run = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      session_id: randomUUID(),
      tool_name: "Bash",
      tool_input: { command },
      cwd: process.cwd(),
    }),
    encoding: "utf8",
    env: HOME,
  });
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
  assert.match(reason, /forge hooks --why bash-guard/u);
  assert.equal(decide(BY_NAME).allowed, false, "selects by name, so it is not the pid you meant");
});

/* Twice in one session a python heredoc was refused for holding the command in a *string literal*,
   with nothing for the shell to run, and no way for the developer to reword their own line. */
test("a quoted literal is data, and a heredoc that only quotes a rule is not a run", () => {
  assert.ok(decide(`python3 - <<'PY'\nt = t.replace("${STAGE_ALL}", "x")\nPY`).allowed);
  assert.ok(decide(`git commit -m "${STAGE_ALL} is refused by bash-guard"`).allowed);
  assert.equal(decide(`echo 'notes' > /tmp/x && ${STAGE_ALL}`).allowed, false, "outside quotes it runs");
});

/* Stripping quoted spans is only safe while a quoted string cannot become a command again. */
test("a string handed back to a shell is a command, and a body that can spawn keeps its quotes", () => {
  assert.equal(decide(`bash -c "${STAGE_ALL}"`).allowed, false, "-c runs what it is given");
  assert.equal(decide(`eval "${STAGE_ALL}"`).allowed, false);
  assert.equal(
    decide(`python3 - <<'PY'\n${SPAWNING}("${STAGE_ALL}", shell=True)\nPY`).allowed,
    false,
    "a body that can reach a shell keeps every literal",
  );
});
