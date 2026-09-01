/* The gate is a decision, so it is exercised the way Claude Code calls it: the event on stdin and
   the permission decision on stdout. The Bash fixtures are shapes observed slipping through. */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "hooks", "learning-gate.mjs");
/* A refusal writes to the config dir now, so a suite that skips this one logs onto the developer. */
const HOME = { ...process.env, XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), "learning-gate-home-")) };
/* A fixture path, not this machine's: the Bash cases need only a string holding /memory/, and
   the ones that judge content build a real directory below. */
const MEMORY = "/home/dev/.claude/projects/-home-dev-app/memory";
const SKILL = "plugin/skills/issue-flow/SKILL.md";

/* The gate stamps /tmp once per session per file, so a fixture reusing a session id passes on a
   re-run for the wrong reason. Every call gets its own session. */
const ask = (event) =>
  spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: randomUUID(), ...event }),
    encoding: "utf8",
    env: HOME,
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
  assert.match(reason, /Record only what cost a cycle/, "the rule, not only the tool");
  assert.match(reason, /Do this: if all four hold, write it with Write/);
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

/* A heredoc body is data — but `python3 - <<PY` executes it, and stripping it as data let a memory
   file be rewritten with no question asked. Found by doing it. */
test("a body an interpreter executes is command, not data", () => {
  const write = `import pathlib\npathlib.Path("${MEMORY}/trap.md").write_text("x")`;
  assert.equal(decide(`python3 - <<'PY'\n${write}\nPY`).allowed, false);
  assert.equal(decide(`node - <<'JS'\nwriteFileSync("${MEMORY}/trap.md", "x")\nJS`).allowed, false);
});

test("the same shape aimed anywhere else stays free", () => {
  assert.equal(decide(`python3 - <<'PY'\nimport pathlib\npathlib.Path("docs/HOOKS.md").write_text("x")\nPY`).allowed, true);
  /* `cat` executes nothing, so its body is data again and only the operator line is read. */
  assert.equal(decide(`cat > docs/X.md <<'MD'\nsee ${MEMORY}/a.md for the fact\nMD`).allowed, true);
});

test("a heredoc keeps the rest of its own operator line", () => {
  assert.equal(decide(`M=${MEMORY}\ncat <<EOF > $M/trap.md\nx\nEOF`).allowed, false);
});

/* A redirect is aim, not coexistence. Anchoring `>` to the start of a token made `2>/dev/null`
   a write shape, so reading a skill file with stderr silenced was refused — this suite's own
   harness hit it first. */
test("stderr redirection is not a write", () => {
  assert.equal(decide(`ls -la ${SKILL} 2>/dev/null | head`).allowed, true);
  assert.equal(decide(`cat ${MEMORY}/a.md 2>&1 | head -5`).allowed, true);
});

test("a read of a guarded file that writes somewhere else is free", () => {
  assert.equal(decide(`sed -n 1,5p ${MEMORY}/a.md > /tmp/out.txt`).allowed, true);
});

test("a redirect aimed at a guarded file is refused, appended or truncated", () => {
  assert.equal(decide(`cat > ${MEMORY}/trap.md`).allowed, false);
  assert.equal(decide(`echo x >> ${MEMORY}/trap.md`).allowed, false);
  assert.equal(decide(`echo x > ${SKILL}`).allowed, false);
});

/* A memory write is judged on content, so these need a real directory to compare against. */
const room = join(mkdtempSync(join(tmpdir(), "memory-gate-")), "memory");
mkdirSync(room);
const KNOWN = `---
name: background-work-survives-tool-timeout
metadata:
  type: feedback
---

A Bash tool timeout stops the waiting and never the process, so an empty output file beside a live
pid means the work is still running rather than killed.
`;
writeFileSync(join(room, "background-work-survives-tool-timeout.md"), KNOWN);

const write = (name, content, tool = "Write") => {
  const key = tool === "Write" ? "content" : "new_string";
  const session = randomUUID();
  const once = () => {
    const run = spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({ session_id: session, tool_name: tool, tool_input: { file_path: join(room, name), [key]: content } }),
      encoding: "utf8",
      env: HOME,
    });
    assert.equal(run.status, 0, run.stderr);
    return run.stdout.trim() ? JSON.parse(run.stdout).hookSpecificOutput.permissionDecisionReason : null;
  };
  return { first: once(), again: once() };
};

/* The shape of a second copy is not what is wrong with it, so a declared type buys no pass: a
   well-formed write is stopped exactly like a malformed one. */
test("every memory write is stopped once, well-formed or not", () => {
  const fact = "Zed opens a worktree without its main checkout, so a project-wide search misses vendored files.";
  const { first, again } = write("zed-typed.md", `---\nname: zed\nmetadata:\n  type: reference\n---\n\n${fact}\n`);
  assert.match(write("zed-untyped.md", `---\nname: zed\n---\n\n${fact}\n`).first, /Record only what cost/);
  assert.match(first, /Record only what cost a cycle/);
  assert.match(first, /One file, one fact/, "the shape, so re-sending is not guesswork");
  assert.match(first, /one pointer line in MEMORY\.md/);
  assert.match(first, /Do this: if a memory already states this, fix that file/);
  assert.equal(again, null, "the re-send passes, or the file could never be written");
});

test("a fact already written names the file that has it", () => {
  const { first } = write("killed-jobs-keep-running.md", KNOWN);
  assert.match(first, /Already in `background-work-survives-tool-timeout\.md`/);
  assert.match(first, /fix that file if its rule is wrong/);
  assert.doesNotMatch(first, /One file, one fact/, "the shape belongs where a file is being shaped");
});

test("editing an existing memory is told to replace, not append", () => {
  const { first } = write("background-work-survives-tool-timeout.md", "a corrected sentence", "Edit");
  assert.match(first, /never append a second version/);
  assert.doesNotMatch(first, /Already in/, "a file is not a copy of itself");
});

/* A refusal on every edit reprinted the same 300 tokens; the document it restated is one file. */
const skillWrite = (session, name) => {
  const room = mkdtempSync(join(tmpdir(), "skill-gate-"));
  const file = join(room, "skills", "demo", name);
  mkdirSync(dirname(file), { recursive: true });
  const run = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: session, tool_name: "Write", tool_input: { file_path: file, content: "a line of method" } }),
    encoding: "utf8",
    env: HOME,
  });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout).hookSpecificOutput.permissionDecisionReason;
};

test("the refusal names the categories and does not reprint the test", () => {
  const first = skillWrite(randomUUID(), "SKILL.md");
  assert.match(first, /trap \| method \| invariant \| discovery \| boundary/);
  assert.doesNotMatch(first, /it cost a cycle, not a thought/, "the four conditions belong to one file");
  assert.ok(first.split("\n").length <= 10, `five lines, not twenty-five: got ${first.split("\n").length}`);
});

/* A duplicate is refused before the once-per-file stamp, so this route has its own fixture: the
   skill already says the sentence being written into a second file. */
const skillDuplicate = () => {
  const room = join(mkdtempSync(join(tmpdir(), "skill-dup-gate-")), "skills", "demo");
  const line = "A refusal names the shape it refused and the one action that clears it.";
  mkdirSync(join(room, "references"), { recursive: true });
  writeFileSync(join(room, "SKILL.md"), `# demo\n\n${line}\n`);
  const run = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      session_id: randomUUID(),
      tool_name: "Write",
      tool_input: { file_path: join(room, "references", "shape.md"), content: `${line}\n` },
    }),
    encoding: "utf8",
    env: HOME,
  });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout).hookSpecificOutput.permissionDecisionReason;
};

/* Every route, not the one that was easiest to reach: the memory write fires most and shipped
   without the pointer, and the duplicate refusal named a repository script instead — a path the
   project a gate fires in does not have, and cannot run. */
test("every refusal ends by naming where the argument is, and names no path", () => {
  const session = randomUUID();
  const reasons = [
    skillWrite(session, "SKILL.md"),
    skillWrite(session, "SKILL.md"),
    skillDuplicate(),
    write("a-new-trap.md", "A pnpm workspace resolves a symlinked package twice.").first,
    write("background-work-survives-tool-timeout.md", KNOWN).first,
  ];
  for (const reason of reasons) {
    assert.match(reason, /forge hooks --how learning-gate/u, reason);
    assert.doesNotMatch(reason, /[\w.-]+\/[\w./-]+\.(?:mjs|js|md)\b/u, `names a path: ${reason}`);
  }
});
