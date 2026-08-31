import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOOK = new URL("../hooks/advisor-first.mjs", import.meta.url).pathname;
const room = mkdtempSync(join(tmpdir(), "advisor-first-"));
/* A refusal writes to the config dir now, so a suite that skips this one logs onto the developer. */
const HOME = { ...process.env, XDG_CONFIG_HOME: room };
test.after(() => rmSync(room, { recursive: true, force: true }));

const userTurn = (text, at = "2026-08-31T11:00:00Z") => ({
  type: "user",
  promptSource: "typed",
  timestamp: at,
  message: { content: [{ type: "text", text }] },
});
const advised = () => ({
  type: "assistant",
  timestamp: "2026-08-31T11:01:00Z",
  message: { content: [{ type: "advisor_tool_result", content: { type: "advisor_redacted_result" } }] },
});
const said = (text) => ({ type: "assistant", message: { content: [{ type: "text", text }] } });

let count = 0;
const transcriptOf = (records) => {
  count += 1;
  const path = join(room, `t${count}.jsonl`);
  writeFileSync(path, `${records.map((one) => JSON.stringify(one)).join("\n")}\n`);
  return path;
};

const gate = (input, records, { tool = "Write", session } = {}) => {
  const event = {
    tool_name: tool,
    tool_input: input,
    transcript_path: transcriptOf(records),
    session_id: session ?? `s${count}-${process.pid}`,
    cwd: process.cwd(),
  };
  const run = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(event),
    encoding: "utf8",
    env: HOME,
  });
  return run.stdout.trim() ? JSON.parse(run.stdout) : null;
};
const because = (out) => out?.hookSpecificOutput?.permissionDecisionReason ?? "";

test("a write before the turn's advisor call is stopped, and the file is named", () => {
  const out = gate({ file_path: "/tmp/notes.mjs", content: "x" }, [userTurn("do it"), said("working")]);
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(because(out), /notes\.mjs/);
  assert.match(because(out), /advisor\(\)/);
});

/* The hook reads notebook_path, so the matcher has to send it: found by codex, not by a test. */
test("a notebook edit is a write too", () => {
  const out = gate({ notebook_path: "/tmp/run.ipynb" }, [userTurn("go")], { tool: "NotebookEdit" });
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(because(out), /run\.ipynb/);
});

test("advice given this turn lets the writes through", () => {
  assert.equal(gate({ file_path: "/tmp/a.mjs" }, [userTurn("go"), advised(), said("acting on it")]), null);
});

/* A wall and not a nudge, safe here because the condition is a fact the agent can clear: calling
   advisor() lifts it. `learning-gate` cannot be one — only the agent can judge its re-send. */
test("the re-send is refused too, until the call is in the transcript", () => {
  const records = [userTurn("go"), said("working")];
  const session = `wall-${process.pid}-${Date.now()}`;
  const first = gate({ file_path: "/tmp/a.mjs" }, records, { session });
  assert.equal(first.hookSpecificOutput.permissionDecision, "deny");
  const again = gate({ file_path: "/tmp/a.mjs" }, records, { session });
  assert.equal(again.hookSpecificOutput.permissionDecision, "deny", "no stamp lets it through");
  assert.equal(gate({ file_path: "/tmp/a.mjs" }, [...records, advised()], { session }), null, "the call lifts it");
});

/* Most of this repo's edits arrive as an interpreter writing a file, not as the Write tool. */
test("a shell write counts; reading and searching do not", () => {
  const records = [userTurn("go")];
  assert.ok(gate({ command: 'python3 -c \'open("/tmp/x","w").write("y")\'' }, records, { tool: "Bash" }));
  assert.ok(gate({ command: "cp plugin/src/codex.mjs /tmp/keep.mjs" }, records, { tool: "Bash" }));
  assert.ok(gate({ command: "cat > /tmp/new.md <<'MD'\nbody\nMD" }, records, { tool: "Bash" }), "a heredoc redirect");
  assert.equal(gate({ command: "grep -rn thing plugin/" }, records, { tool: "Bash" }), null);
  assert.equal(gate({ command: "npm test 2>/dev/null" }, records, { tool: "Bash" }), null, "not a real target");
});

/* The real incident: a DNS query refused as a write, because `cp` was read outside command
   position. The re-send that follows a live advisor call is the other half of that turn. */
test("an argument that merely contains a verb is not a write", () => {
  const records = [userTurn("point cp.musetools.com at coolify")];
  const query = "forge cloudflare dns f699 --name cp.musetools.com";
  assert.equal(gate({ command: query }, records, { tool: "Bash" }), null);
  assert.equal(gate({ command: 'git commit -m "refactor: mv the module"' }, records, { tool: "Bash" }), null);
  assert.ok(gate({ command: "npm test && cp a b" }, records, { tool: "Bash" }), "in command position it is");
  assert.ok(gate({ command: "for f in *; do mv $f /tmp; done" }, records, { tool: "Bash" }), "and after do");
});

/* Refused three real commands in one session: a DNS query, a commit message, and the intent of the
   consult itself, whose heredoc body quoted the very patterns WRITES looks for. */
test("a data heredoc is data; an interpreter's body is not", () => {
  const records = [userTurn("go")];
  const bash = { tool: "Bash" };
  const intent = "cat <<'I' | forge codex consult\nit uses writeFileSync and open(\"x\",\"w\")\nI";
  assert.equal(gate({ command: intent }, records, bash), null, "prose about writing is not writing");
  assert.ok(gate({ command: "python3 - <<'PY'\np.write_text(x)\nPY" }, records, bash), "a program is");
  assert.ok(gate({ command: "cd plugin\ncp a b" }, records, bash), "a second line is command position");
});

/* Codex found these: the first anchor read only separators and a wrapper list, and a shell has more
   ways to reach command position than that. */
test("an assignment or a wrapper before the verb is still command position", () => {
  const records = [userTurn("go")];
  const bash = { tool: "Bash" };
  assert.ok(gate({ command: "MODE=fast cp a b" }, records, bash), "an assignment prefix");
  assert.ok(gate({ command: "command mv a b" }, records, bash), "the command builtin");
  assert.ok(gate({ command: "if cp a b; then echo x; fi" }, records, bash), "a conditional");
  assert.ok(gate({ command: "find . -name x -exec cp {} /tmp ;" }, records, bash), "find -exec");
});

/* The message has to be true: a wait cannot close this, so re-sending is the instruction. */
test("the refusal says the record lands a round-trip later", () => {
  const out = gate({ file_path: "/tmp/a.mjs" }, [userTurn("go")]);
  assert.match(because(out), /round-trip later/);
  assert.match(because(out), /re-send/);
});

/* This lands in a context window on every write of every turn, so the argument for the rule is a
   command and not a paragraph. It was 498 characters of standing prose before the split. */
test("the refusal is short, and names where the reasoning is", () => {
  const reason = because(gate({ file_path: "/tmp/a.mjs" }, [userTurn("go")]));
  assert.match(reason, /forge hooks --why advisor-first/);
  assert.ok(reason.length < 300, `${reason.length} characters printed on every refused write`);
});

test("the gate stands down when the advisor tool itself is off", () => {
  const event = {
    tool_name: "Write",
    tool_input: { file_path: "/tmp/a.mjs" },
    transcript_path: transcriptOf([userTurn("go")]),
    session_id: `off-${process.pid}`,
    cwd: process.cwd(),
  };
  const run = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(event),
    encoding: "utf8",
    env: { ...HOME, CLAUDE_CODE_DISABLE_ADVISOR_TOOL: "1" },
  });
  assert.equal(run.stdout.trim(), "");
});
