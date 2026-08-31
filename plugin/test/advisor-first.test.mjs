import assert from "node:assert/strict";
import test from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOOK = new URL("../hooks/advisor-first.mjs", import.meta.url).pathname;
const room = mkdtempSync(join(tmpdir(), "advisor-first-"));
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
    env: { ...process.env, FORGE_HOOK_SETTLE_MS: "0" },
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

/* The failure this cost twice in one session: the record lands as the message that made the call
   ends, which is when the tool dispatches, so the first read raced it. The appender is its own
   process because `spawnSync` below blocks this one's timers. */
test("a record that lands while the hook is reading still lifts the wall", () => {
  const path = transcriptOf([userTurn("go"), said("working")]);
  const late = spawn(
    process.execPath,
    ["-e", 'setTimeout(() => require("node:fs").appendFileSync(process.argv[1], process.argv[2]), 250);',
      path, `${JSON.stringify(advised())}\n`],
    { stdio: "ignore" },
  );
  const run = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      tool_name: "Write",
      tool_input: { file_path: "/tmp/late.mjs" },
      transcript_path: path,
      session_id: "late",
      cwd: process.cwd(),
    }),
    encoding: "utf8",
  });
  late.unref();
  assert.equal(run.stdout.trim(), "", "it waited for the writer instead of refusing");
});

test("but the wait is bounded: a record that never lands is refused", () => {
  const path = transcriptOf([userTurn("go")]);
  const run = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      tool_name: "Write",
      tool_input: { file_path: "/tmp/never.mjs" },
      transcript_path: path,
      session_id: "never",
      cwd: process.cwd(),
    }),
    encoding: "utf8",
    env: { ...process.env, FORGE_HOOK_SETTLE_MS: "300" },
  });
  assert.equal(JSON.parse(run.stdout).hookSpecificOutput.permissionDecision, "deny");
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
    env: { ...process.env, CLAUDE_CODE_DISABLE_ADVISOR_TOOL: "1", FORGE_HOOK_SETTLE_MS: "0" },
  });
  assert.equal(run.stdout.trim(), "");
});
