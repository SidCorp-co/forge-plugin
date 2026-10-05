/* A program body that hands a string to a shell hands it a command, so a `>` in that string is the
   spawned shell's redirect and the word after it a file the call writes. Reading every non-shell body's
   `>` as the program's own let a skill write sent through `os.system` past the learning gate (ISS-2956);
   a body that spawns nothing keeps the reading ISS-2445 gave it. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { shellWrites, writtenPaths } from "../../../hooks/_hook.mjs";
import { struck } from "../../../src/hooks/shell-spans.mjs";
import { answered, callHook, homeEnv } from "../../fixtures.mjs";

const CWD = "/w/tree";
const SKILL = ".claude/skills/x/SKILL.md";
const read = (command, unplaceable) =>
  writtenPaths(struck(shellWrites(command), { unplaceable }), CWD).map((one) => one.token);
const both = (command, want, why = command) => {
  assert.deepEqual(read(command, "strike"), want, `strike: ${why}`);
  assert.deepEqual(read(command, "keep"), want, `keep: ${why}`);
};

test("a > in a string a program body hands a shell names that shell's write", () => {
  both(`python3 -c "import os; os.system('echo hi > ${SKILL}')"`, [SKILL], "python -c through os.system");
  both(`python3 -c 'import subprocess; subprocess.run("echo hi > ${SKILL}", shell=True)'`, [SKILL],
    "python -c through subprocess with shell=True");
  both(`python3 -c "import os; os.system('echo hi > ' '${SKILL}')"`, [SKILL], "two adjacent literals python joins");
  both(`node -e "require('child_process').execSync('echo hi > ${SKILL}')"`, [SKILL], "node -e through execSync");
  both(["python3 - <<'PY'", "import os", `os.system('echo hi > ${SKILL}')`, "PY"].join("\n"), [SKILL],
    "a python heredoc through os.system");
  both(["node <<'JS'", "const { execSync } = require('child_process');", `execSync('printf x > ${SKILL}');`, "JS"].join("\n"),
    [SKILL], "a node heredoc through execSync");
});

test("a string a spawned shell could not parse leaves every other command as it was", () => {
  both([`python3 - <<'PY'`, "import subprocess", `print("don't")`, "PY", `echo x > ${SKILL}`].join("\n"), [SKILL], "a heredoc");
  both(`python3 -c "import os; print('don\\'t'); os.system('ls')" && echo x > ${SKILL}`, [SKILL], "an inline body");
  both(`python3 -c "import os; print('[[ x'); os.system('echo hi > ${SKILL}')"`, [SKILL], "a test left open");
  both(`python3 -c "import os; print('(( x'); os.system('echo hi > ${SKILL}')"`, [SKILL], "an arithmetic left open");
  both(["python3 - <<'PY'", "import os", "x = [[1], [2] ]", "os.system('echo hi > ' # the target", `    '${SKILL}')`, "PY"].join("\n"),
    [SKILL], "a body leaving a test open, and literals a comment separates");
});

test("a cd one spawned shell makes moves neither the next one nor the caller", () => {
  const placed = (command) => writtenPaths(shellWrites(command), CWD).map(({ token, trees }) => [token, trees]);
  assert.deepEqual(placed(`python3 -c "import os; os.system('cd /tmp'); os.system('echo hi > a.md')"; echo z > b.md`),
    [["a.md", [CWD]], ["b.md", [CWD]]], "inline");
  assert.deepEqual(placed(["python3 - <<'PY'", "import os", "os.system('cd /tmp')", "os.system('echo hi > a.md')", "PY", "echo z > b.md"].join("\n")),
    [["a.md", [CWD]], ["b.md", [CWD]]], "a heredoc");
});

test("a > in a program body that spawns no shell is still the program's own", () => {
  both(`python3 -c "print(1 > 0); open('x.md').read()"`, []);
  both(`node -e "const fs = require('fs'); if (a > 'b.md') {}"`, []);
  both(["python3 - <<'PY'", "if n > buf.len():", "    print('a > b.md')", "PY"].join("\n"), []);
});

const LEARNING = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "hooks", "entries", "learning", "learning-gate.mjs");
const HOME = homeEnv("redirect-spawned");

test("the learning gate refuses a memory write a python program sends through the shell it spawns", () => {
  const memory = "/home/dev/.claude/projects/-home-dev-app/memory/trap.md";
  const command = `python3 -c "import os; print('[[ x'); os.system('echo hi > ${memory}')"`;
  const run = callHook(LEARNING, { session_id: randomUUID(), tool_name: "Bash", tool_input: { command } }, HOME);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(answered(run)?.hookSpecificOutput?.permissionDecision, "deny", run.stdout);
});
