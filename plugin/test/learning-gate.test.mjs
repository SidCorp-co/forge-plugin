/* The gate is a decision, so it is exercised the way Claude Code calls it: the event on stdin and
   the permission decision on stdout. The Bash fixtures are shapes observed slipping through. */
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "hooks", "learning-gate.mjs");
const MEMORY = "/home/thanh/.claude/projects/-run-media-thanh-New-ai-project-sid-erp/memory";

/* The gate stamps /tmp once per session per file, so a fixture reusing a session id passes on a
   re-run for the wrong reason. Every call gets its own session. */
const ask = (event) =>
  spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: randomUUID(), ...event }),
    encoding: "utf8",
  });

const decide = (command) => {
  const run = ask({ tool_name: "Bash", tool_input: { command } });
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

test("a `-i` inside the filename is not an in-place edit", () => {
  assert.equal(decide(`sed -n 1,7p ${MEMORY}/erp-issue-workflow.md`).allowed, true);
});

test("a real in-place edit of the same file is still refused", () => {
  assert.equal(decide(`sed -i s/a/b/ ${MEMORY}/erp-issue-workflow.md`).allowed, false);
  assert.equal(decide(`sed --in-place s/a/b/ ${MEMORY}/erp-issue-workflow.md`).allowed, false);
  assert.equal(decide(`sed -i.bak s/a/b/ ${MEMORY}/erp-issue-workflow.md`).allowed, false);
});

test("a memory file declaring its type under metadata is not asked about", () => {
  const body = "---\nname: a-fact\nmetadata:\n  type: reference\n---\n\nbody\n";
  const run = ask({ tool_name: "Write", tool_input: { file_path: `${MEMORY}/a-fact.md`, content: body } });
  assert.equal(run.stdout.trim(), "", "indented `type:` should satisfy the gate");
});

test("a memory file declaring no type is still asked about", () => {
  const run = ask({
    tool_name: "Write",
    tool_input: { file_path: `${MEMORY}/no-type.md`, content: "---\nname: x\n---\n\nbody\n" },
  });
  assert.match(JSON.parse(run.stdout).hookSpecificOutput.permissionDecisionReason, /valid `type:`/);
});

test("a commit trailer's `>` is not a redirect", () => {
  const body = "msg\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>";
  const { allowed, reason } = decide(
    `git add plugin/skills/issue-flow/SKILL.md && git commit -F - <<'EOF'\n${body}\nEOF`,
  );
  assert.equal(allowed, true, reason);
});

test("an arrow in a commit message is not a redirect", () => {
  assert.equal(decide('git add plugin/skills/forge/SKILL.md && git commit -m "list -> table"').allowed, true);
});

test("a quoted write target is still found", () => {
  assert.equal(decide(`M=${MEMORY}\ncat > "$M/trap.md" <<EOF\nx\nEOF`).allowed, false);
});

test("a python write through the shell is still found", () => {
  assert.equal(decide(`python3 -c "open('${MEMORY}/trap.md','w').write('x')"`).allowed, false);
});

test("a heredoc keeps the rest of its own operator line", () => {
  assert.equal(decide(`M=${MEMORY}\ncat <<EOF > $M/trap.md\nx\nEOF`).allowed, false);
});
