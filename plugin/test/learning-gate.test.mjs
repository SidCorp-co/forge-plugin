/* The gate is a decision, so it is exercised the way Claude Code calls it: the event on stdin and
   the permission decision on stdout. The Bash fixtures are shapes observed slipping through. */
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "hooks", "learning-gate.mjs");
const MEMORY = "/home/thanh/.claude/projects/-run-media-thanh-New-ai-project-sid-erp/memory";

const decide = (command) => {
  const run = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  if (!run.stdout.trim()) return { allowed: true };
  const answer = JSON.parse(run.stdout).hookSpecificOutput;
  return { allowed: answer.permissionDecision !== "deny", reason: answer.permissionDecisionReason };
};

test("a heredoc through a variable-held memory path is refused", () => {
  const { allowed, reason } = decide(
    `M=${MEMORY}\ncat > $M/coolify-deploy-log-location.md <<'EOF'\nbody\nEOF`,
  );
  assert.equal(allowed, false);
  assert.match(reason, /coolify-deploy-log-location\.md/);
  assert.match(reason, /Use Write or Edit/);
});

test("the braced form resolves too", () => {
  assert.equal(decide(`M=${MEMORY}\ncat > \${M}/trap.md <<'EOF'\nx\nEOF`).allowed, false);
});

test("a relative write after cd into the guarded directory is refused", () => {
  assert.equal(decide(`cd ${MEMORY} && cat > trap.md <<'EOF'\nx\nEOF`).allowed, false);
});

test("a literal path is still refused", () => {
  assert.equal(decide(`sed -i s/a/b/ ${MEMORY}/trap.md`).allowed, false);
});

test("a skill file through a variable is refused", () => {
  assert.equal(decide("S=plugin/skills/issue-flow\ncat > $S/SKILL.md <<'EOF'\nx\nEOF").allowed, false);
});

test("MEMORY.md is the index, not a memory", () => {
  assert.equal(decide(`M=${MEMORY}\ncat > $M/MEMORY.md <<'EOF'\n- a line\nEOF`).allowed, true);
});

test("reading a memory is free", () => {
  assert.equal(decide(`M=${MEMORY}\ncat $M/trap.md | head -5`).allowed, true);
});

test("an unrelated variable-held markdown write is free", () => {
  assert.equal(decide("D=/tmp/docs\ncat > $D/notes.md <<'EOF'\nx\nEOF").allowed, true);
});

test("an unresolvable variable does not deny by accident", () => {
  assert.equal(decide("cat > $UNSET/notes.md <<'EOF'\nx\nEOF").allowed, true);
});
