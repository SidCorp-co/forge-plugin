/* A heredoc body another language reads is that language and no shell word: what the readings take
   from it is the files its own file calls write and the strings it hands a shell, and nothing else.
   Each case is read the two ways the gates read a command — plan-scope's, which strikes what it
   cannot place, and the learning gate's, which keeps every candidate. The shapes are ISS-3038's and
   ISS-2010's, with the report folded onto the second. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { shellWrites, writtenPaths } from "../../../hooks/_hook.mjs";
import { struck } from "../../../src/hooks/shell-spans.mjs";
import { answered, callHook, homeEnv } from "../../fixtures.mjs";

const CWD = "/w/tree";
const SKILL = ".claude/skills/y/SKILL.md";
const read = (command, unplaceable) =>
  writtenPaths(struck(shellWrites(command), { unplaceable }), CWD).map((one) => one.token);
const strict = (command) => read(command, "strike");
const keeps = (command) => read(command, "keep");
const both = (command, want, why = command) => {
  assert.deepEqual(strict(command), want, `strike: ${why}`);
  assert.deepEqual(keeps(command), want, `keep: ${why}`);
};
const heredoc = (runner, ...lines) => [`${runner} - <<'PY'`, ...lines, "PY"].join("\n");
const python = (...lines) => heredoc("python3", ...lines);

test("nothing a python body leaves open reaches the redirect after the heredoc", () => {
  both(`${python("x = [[1], [2] ]")}\necho x > ${SKILL}`, [SKILL], "a test the body opens");
  both(`${python("s = '''don't'''")}\necho x > ${SKILL}`, [SKILL], "a quote the body opens");
  both(`${python("y = ((1)")}\necho x > ${SKILL}`, [SKILL], "an arithmetic the body opens");
});

test("an assignment or a cd in a python body moves no command after the heredoc", () => {
  const placed = (command) => writtenPaths(shellWrites(command), CWD).map(({ token, trees }) => [token, trees]);
  assert.deepEqual(placed(`${python("d=foo")}\necho x > $d/a.md`), [["d/a.md", []]], "an assignment resolves nothing");
  assert.deepEqual(placed(`${python("cd = 1")}\necho x > a.md`), [["a.md", [CWD]]], "a cd moves nothing");
});

test("a body whose lines only assign names no file", () => {
  both(python("n=re.search('a', b)", "s=s.replace('x', 'y')"), [], "ISS-2010's assignments");
  both(python("m = n.start", "if a > n.end: pass"), [], "a dotted name beside a comparison");
});

test("a body's own file call is still a write, at the argument its API writes", () => {
  both(python("open('x.md','w').write(s)"), ["x.md"], "open with a write mode");
  both(heredoc("node", "require('fs').writeFileSync('w.md', 'x')"), ["w.md"], "node's writeFileSync");
  both(python("from pathlib import Path", "Path('docs/p.md').write_text('x')"), ["docs/p.md"], "pathlib's receiver");
  both(python("shutil.copy('a.md', 'b.md')"), ["b.md"], "a copy's destination and not its source");
  both(python("shutil.copyfile('a.md', dst='b.md')"), ["b.md"], "a destination given by keyword");
  both(python("shutil.move('a.md', 'b.md')"), ["a.md", "b.md"], "a move takes its source away");
  both(python("os.replace('a.md', 'b.md')"), ["a.md", "b.md"], "so does a replace");
  both(python("os.symlink('a.md', 'b.md')"), ["b.md"], "a link is its own name");
  both(heredoc("node", "fs.appendFileSync('log.md', 'x')"), ["log.md"], "an append");
  both(heredoc("deno", "await Deno.writeTextFile('d.md', 'x')"), ["d.md"], "deno's write");
  both(heredoc("bun", "await Bun.write('b.md', 'x')"), ["b.md"], "bun's write");
});

test("a read beside a write is not one, and a target the program computes is placed nowhere", () => {
  both(python("open('a.md','w').write(open('r.md').read())"), ["a.md"], "an open with no write mode");
  assert.deepEqual(strict(python("open(os.path.expanduser(base), 'w')")), [], "a computed target is struck");
});

test("a call spelt inside a string or a comment is no call", () => {
  both(python(`message = "open('unplanned.md','w')"`), [], "a python string");
  both(python("# open('unplanned.md','w')", "s = '''Path('u.md').write_text(x)'''"), [], "a comment and a docstring");
  both(heredoc("node", "// writeFileSync('u.md', 'x')", "const s = `writeFileSync('v.md', 'x')`;"), [], "node's comment and template");
});

test("a name the body bound to a whole literal is the file its call writes", () => {
  both(python("p='a/b.go'", "s=open(p).read()", "open(p,'w').write(s)"), ["a/b.go"], "the folded report's shape");
  both(python("p = 'a.md'", "p = sys.argv[1]", "open(p, 'w')"), [], "a rebinding to anything else unsets it");
});

test("an inline body's file call is aimed the same as a heredoc's", () => {
  assert.deepEqual(strict(`python3 -c "open('docs/x.md','w').write('x')"`), ["docs/x.md"]);
  assert.deepEqual(strict(`python3 -c "import shutil; shutil.copy('a.md','b.md')"`), ["b.md"]);
  assert.deepEqual(strict(`node -e "require('fs').writeFileSync('w.md','x')"`), ["w.md"]);
  assert.deepEqual(strict(`python3 -c "open('docs/x.md','w')" && echo x > ${SKILL}`), ["docs/x.md", SKILL], "and what follows it is still read");
});

const LEARNING = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "hooks", "entries", "learning-gate.mjs");
const HOME = homeEnv("body-calls");

test("the learning gate refuses a skill write behind a python body that opens a test", () => {
  const skill = "/home/dev/app/plugin/skills/issue-flow/SKILL.md";
  const command = `${python("x = [[1], [2] ]")}\necho x > ${skill}`;
  const run = callHook(LEARNING, { session_id: randomUUID(), tool_name: "Bash", tool_input: { command } }, HOME);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(answered(run)?.hookSpecificOutput?.permissionDecision, "deny", run.stdout);
});
