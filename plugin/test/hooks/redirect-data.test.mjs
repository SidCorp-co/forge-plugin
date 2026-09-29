/* A `>` the shell reads as data redirects nothing, so the word after it is no file the command
   writes. Each case is read the two ways the gates read a command: plan-scope's, which strikes what
   it cannot place, and the learning gate's, which keeps it. The shapes are the ones reported against
   ISS-2445 and ISS-2403 and the reports folded onto them. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { shellWrites, writtenPaths } from "../../hooks/_hook.mjs";
import { struck } from "../../src/hooks/shell-spans.mjs";
import { answered, callHook, homeEnv } from "../fixtures.mjs";

const CWD = "/w/tree";
const read = (command, unplaceable) =>
  writtenPaths(struck(shellWrites(command), { unplaceable }), CWD).map((one) => one.token);
const both = (command, want, why = command) => {
  assert.deepEqual(read(command, "strike"), want, `strike: ${why}`);
  assert.deepEqual(read(command, "keep"), want, `keep: ${why}`);
};
const heredoc = (runner, ...lines) => [`${runner} - <<'PY'`, ...lines, "PY"].join("\n");

test("a > in an interpreter's heredoc body is its program's, and names no file", () => {
  for (const line of [
    "if n > buf.len():",
    "if (t > '2026-03-01T00:00:00.000Z'): pass",
    "if len(s) > n.start:",
    "go = 'if d > time.Time{} {'",
    "r.count > best.count and limits.maxBytes > 1",
  ]) both(heredoc("python3", line, "    pass"), [], line);
  both(heredoc("node", "if (n > limits.maxBytes) process.exit(1);"), [], "a node body");
  both(`cd src/daemon && ${heredoc("python3", "if n > buf.len():", "    pass")}`, [], "after a cd");
  both([`python3 - <<PY`, "if n > buf.len():", "PY"].join("\n"), [], "an unquoted delimiter");
});

test("a redirect on the heredoc's own line, and one in a shell's heredoc body, are still writes", () => {
  both(["python3 - <<'PY' > out.txt", "if n > buf.len():", "PY"].join("\n"), ["out.txt"]);
  both(["bash <<'EOF'", "echo x > real.md", "EOF"].join("\n"), ["real.md"]);
});

test("a body's own write is read beside a > in its source, and the > names nothing", () => {
  const command = heredoc("python3", "open('x.md','w').write(s)", "if a > b.md: pass");
  assert.deepEqual(read(command, "keep"), ["x.md"]);
});

test("a > inside a quoted argument is data", () => {
  both("echo 'a > b.c'", []);
  both(`echo "a > b.c"`, []);
  both("forge record verdict ISS-379 --why \"a relative echo > .claude/skills/uat/references/run.md is allowed\"", []);
  both(`node -e "const fs = require('fs'); if (a > '/home/dev/p/memory/trap.md') {}"`, []);
  both("python3 -c 'if a > b.md: pass'", []);
});

test("a sed script is data, and only the files it edits are written", () => {
  both("sed -i 's/x/y > z.c/' f.rs", ["f.rs"]);
  both("sed -i -e 's/a/b/' -e 's/c/d/' f.rs g.rs", ["f.rs", "g.rs"]);
  both("sed 's/a/b/' f.rs > out.rs", ["out.rs"]);
  both(`sed -i "5a\\\\ const f = () => '../pipeline/failure-causes.js';" f.js`, ["f.js"]);
  both(`sed -i "5a\\\\ if (n > '../pipeline/failure-causes.js') f();" f.js`, ["f.js"]);
  both("perl -pi -e 's/a > b.c/d/' f.rs", []);
});

test("under a double quote a substitution is still run, and only its own > redirects", () => {
  both(`echo "at $(git rev-parse HEAD) the ring is >=3.97:1" | forge codex consult`, []);
  both("echo \"at `git rev-parse HEAD` the ring is >=3.97:1\"", []);
  both(`echo "$(cat a > inner.md)"`, ["inner.md"]);
  both("echo \"`cat a > ticked.md`\"", ["ticked.md"]);
});

test("a quoted target is read as it was", () => {
  both(`echo x > "a b.md"`, ["b.md"]);
  both("echo x > 'a(1).md'.txt", []);
  both("printf x >'q.md'", ["q.md"]);
});

test("a > in a comment, a test, an arithmetic or behind a backslash redirects nothing", () => {
  both("echo ok # > fabricated.md", []);
  both("[[ a > b.md ]] && echo y", []);
  both("if [[ $x > y.md ]]; then :; fi", []);
  both("(( a > b.c )) && echo y", []);
  both("echo $(( a > b.c ))", []);
  both("echo a \\> b.md", []);
  both("[[ a > b ]] && echo x > after.md", ["after.md"], "a redirect after the test is still one");
});

/* The learning gate's own suite is at its length cap, so its case for this reading stands here. */
const LEARNING = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "hooks", "entries", "learning-gate.mjs");
const HOME = homeEnv("redirect-data");
const refused = (command) => {
  const run = callHook(LEARNING, { session_id: randomUUID(), tool_name: "Bash", tool_input: { command } }, HOME);
  assert.equal(run.status, 0, run.stderr);
  return answered(run)?.hookSpecificOutput?.permissionDecision === "deny";
};

test("the learning gate lets a node -e program compare against a memory path, and refuses a redirect to one", () => {
  const memory = "/home/dev/.claude/projects/-home-dev-app/memory";
  assert.equal(refused(`node -e "const fs = require('fs'); if (a > '${memory}/trap.md') {}"`), false);
  assert.equal(refused(`node -e "x" > ${memory}/trap.md`), true, "a redirect outside the quotes still is one");
});
