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
  both(python("open('r.md', r'w')", "open(f'a.md', mode=b'ab')"), ["r.md", "a.md"], "a mode with a prefix");
  both(heredoc("node", "require('fs').writeFileSync('w.md', 'x')"), ["w.md"], "node's writeFileSync");
  both(python("from pathlib import Path", "Path('docs/p.md').write_text('x')"), ["docs/p.md"], "pathlib's receiver");
  both(python("shutil.copy('a.md', 'b.md')"), ["b.md"], "a copy's destination and not its source");
  both(python("shutil.copyfile('a.md', dst='b.md')"), ["b.md"], "a destination given by keyword");
  both(python("shutil.move('a.md', 'b.md')"), ["a.md", "b.md"], "a move takes its source away");
  both(python("os.replace('a.md', 'b.md')"), ["a.md", "b.md"], "so does a replace");
  both(python("os.symlink('a.md', 'b.md')"), ["b.md"], "a link is its own name");
  both(heredoc("node", "fs.appendFileSync('log.md', 'x')"), ["log.md"], "an append");
  both(heredoc("node", "const fs = require('fs'); fs.open('o.md', 'w', () => {});", "fs.openSync('p.md', 'a');"), ["o.md", "p.md"], "node's open");
  both(heredoc("deno", "await Deno.writeTextFile('d.md', 'x')"), ["d.md"], "deno's write");
  both(heredoc("bun", "await Bun.write('b.md', 'x')"), ["b.md"], "bun's write");
  /* A name holding a quote is read as the same redirect spelt in the shell is, whatever that reader makes of it. */
  both(python(`open("author's.md", "w")`), strict(`echo x > "author's.md"`), "a name holding the other quote");
  both(heredoc("node", `writeFileSync('say "hi".md', 'x')`), strict(`echo x > 'say "hi".md'`), "and the other way round");
  assert.deepEqual(strict(String.raw`python3 -c "open(\"author's.md\", \"w\")"`), strict(`echo x > "author's.md"`), "an inline body's");
});

test("a call writing a literal and a computed operand keeps both readings of it", () => {
  const command = python("shutil.move(base + '/src.md', 'planned.md')");
  assert.deepEqual(strict(command), ["planned.md"], "strike aims the literal and places nothing for the other");
  assert.ok(keeps(command).includes("/src.md"), "keep still reads what the computed source spells");
});

test("a read beside a write is not one, and a target the program computes is placed nowhere", () => {
  both(python("open('a.md','w').write(open('r.md').read())"), ["a.md"], "an open with no write mode");
  const archived = python("zf.open('member.md', 'w')", "gzip.open('log.md', 'wt')");
  assert.deepEqual(strict(archived), ["log.md"], "strike: an archive's member is no file, a module's open is");
  assert.deepEqual(keeps(archived), ["log.md", "member.md"], "keep: an object's own open is still a candidate");
  both(python("with Path('po.md').open('w') as f: f.write(s)", "Path('pr.md').open()", "Path('pk.md').open(mode='a')"), ["po.md", "pk.md"],
    "a path's open writes under a write mode, its first argument or by keyword");
  both(python("writer = Path('unplanned.md').write_text", "copy = shutil.copy"), [], "a method named and not called");
  assert.deepEqual(strict(python("open(os.path.expanduser(base), 'w')")), [], "a computed target is struck");
  for (const target of ["base > unplanned.md", "a if b else c; d", "'$(' + x", "x | y.md", "`x` + y", "a[[0]]"]) {
    const command = `${python(`open(${target}, 'w')`)}\necho x > ${SKILL}`;
    assert.deepEqual(strict(command), [SKILL], `strike: ${target}`);
    assert.ok(keeps(command).includes(SKILL), `keep, which may still read a name the call spells: ${target}`);
  }
  both(python("open('$(a.md', 'w')", "open('a`b`.md', 'w')"), [], "a literal holding a substitution");
  const received = `${python("(base / '.claude/skills/z/SKILL.md').write_text('x')")}\necho x > ${SKILL}`;
  assert.deepEqual(strict(received), [SKILL], "strike: a receiver the program computes");
  assert.ok(keeps(received).includes(".claude/skills/z/SKILL.md"), "keep still reads what a computed receiver spells");
  const returned = python("pick('unplanned.md').write_text('x')", "pick ('unplanned.md').write_text('x')", "Path(x).parent.write_text('y')");
  assert.deepEqual(strict(returned), [], "strike: a receiver another call returns");
  assert.ok(keeps(returned).includes("unplanned.md"), "keep still reads what it spells");
});

test("a call spelt inside a string or a comment is no call", () => {
  both(python(`message = "open('unplanned.md','w')"`), [], "a python string");
  both(python("# open('unplanned.md','w')", "s = '''Path('u.md').write_text(x)'''"), [], "a comment and a docstring");
  both(heredoc("node", "// writeFileSync('u.md', 'x')", "const s = `writeFileSync('v.md', 'x')`;"), [], "node's comment and template");
  both(heredoc("node", "const re = /writeFileSync('r.md', 'x')/g;", "if (/open\\('q.md'/.test(s)) f();"), [], "node's regular expression");
  both(heredoc("node", "const n = a / b; writeFileSync('d.md', n / 2);"), ["d.md"], "where a division stands, the call is still one");
  both(python(String.raw`message = "say \"; open('u.md','w')"`), [], "a python string holding an escaped quote");
});

test("a comment between a call's arguments splits and closes nothing", () => {
  both(python("open('unplanned.md', # the mode, then (a note)", "     'w')"), ["unplanned.md"], "python's comment");
  both(heredoc("node", "writeFileSync(/* a, b) */ 'n.md', 'x')"), ["n.md"], "node's block comment");
});

test("what a string still runs is code, and a call there is one", () => {
  both(heredoc("node", "const s = `${writeFileSync('t.md', 'x')}`;"), ["t.md"], "a template's interpolation");
  both(python("s = f\"{open('f.md','w').write('x')}\""), ["f.md"], "an f-string's field");
  both(python("s = f\"{open('g.md','w').write(str({'a': 1}))}\""), ["g.md"], "a field holding braces of its own");
  both(heredoc("node", "const s = `${writeFileSync('h.md', JSON.stringify({ a: 1 }))}`;"), ["h.md"], "an interpolation holding braces");
  both(python("s = f\"{{open('i.md','w')}}\""), [], "an f-string's doubled brace is a literal one");
  both(heredoc("node", "const s = `${\"writeFileSync('j.md', 'x')\"}`;"), [], "a string inside an interpolation is still a string");
  both(heredoc("node", "const s = `\\${writeFileSync('l.md', 'x')}`;"), [], "an escaped interpolation is data");
  both(heredoc("node", "const s = `\\\\${writeFileSync('m.md', 'x')}`;"), ["m.md"], "one behind an escaped backslash runs");
  both(python(String.raw`s = rf"\{open('n.md','w')}"`), ["n.md"], "a backslash before an f-string's field escapes nothing");
  both(python("s = f\"{'open(\\'k.md\\', \\'w\\')'}\""), [], "and inside an f-string's field");
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
