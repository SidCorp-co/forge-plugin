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
  assert.deepEqual(placed(`${python("d=foo")}\necho x > $d/a.md`), [["$d/a.md", []]], "an assignment resolves nothing");
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
  /* A name holding a quote is read whole, as the redirect spelt in the shell is (ISS-3052). */
  both(python(`open("author's.md", "w")`), ["author's.md"], "a name holding the other quote");
  both(heredoc("node", `writeFileSync('say "hi".md', 'x')`), ['say "hi".md'], "and the other way round");
  both(python(`open("""say "hi" it's.md""", "w")`), [`say "hi" it's.md`], "and one holding both");
  assert.deepEqual(strict(String.raw`python3 -c "open(\"author's.md\", \"w\")"`), ["author's.md"], "an inline body's");
});

test("a call writing a literal and a computed operand keeps both readings of it", () => {
  const command = python("shutil.move(base + '/src.md', 'planned.md')");
  assert.deepEqual(strict(command), ["planned.md"], "strike aims the literal and places nothing for the other");
  assert.ok(keeps(command).includes("/src.md"), "keep still reads what the computed source spells");
  for (const call of ["fs.open", "fs.openSync"]) {
    assert.ok(keeps(heredoc("node", `${call}(base + '/x.md', 'w')`)).includes("/x.md"), `keep reads what ${call}'s computed file spells`);
  }
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
  both(python("open('$(a.md', 'w')", "open('a`b`.md', 'w')"), ["$(a.md", "a`b`.md"], "a literal holding a substitution is that name (ISS-3052)");
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
  both(heredoc("node", "const n = (a + b) / 2; fs.writeFileSync('w.md', 'x'); const m = a[0] / 2;"), ["w.md"], "a slash after a bracket that ends a value");
  both(heredoc("node", "let n = 4; const x = n++ / 2; fs.writeFileSync('w3.md', 'x'); const y = n / 2;"), ["w3.md"], "a slash after a postfix increment");
  both(heredoc("node", `let n = 4; const x = n${" ".repeat(13)}/ 2; fs.writeFileSync('w4.md', 'x'); const y = n / 2;`), ["w4.md"], "a slash after a run of blanks");
  for (const word of ["return", "typeof"]) {
    both(heredoc("node", `const x = obj.${word} / 2; fs.writeFileSync('w5.md', 'x'); const y = n / 2;`), ["w5.md"], `a property named ${word}`);
  }
  both(heredoc("node", "f(a, b / 2, writeFileSync('w6.md', 'x'), c / 3)"), ["w6.md"], "two divisions a call stands between, after a comma");
  both(heredoc("node", "const n = a\n/ 2; fs.writeFileSync('w2.md', 'x');"), ["w2.md"], "a slash that closes nothing on its line");
  assert.deepEqual(strict(heredoc("node", "const s = `${`inner`}`; fs.writeFileSync(`tu.md`, 'x');")), ["tu.md"],
    "a nested template beside a plain one leaves the plain one folded");
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
  both(python('s = f"{open("fq.md", "w")}"'), ["fq.md"], "a field reusing its f-string's own quote");
  both(python('s = f"""{open("fc.md", # the mode', "'w')}\"\"\""), ["fc.md"], "a comment in a field of an f-string spread over lines");
  both(python('open("""tq.md""", "w")', "open('''tq2.md''', 'a')"), ["tq.md", "tq2.md"], "a triple-quoted literal");
  both(python('p = """tb.md"""', "open(p, 'w')"), ["tb.md"], "a name bound to a triple-quoted literal");
  both(python('Path("""pt.md""").write_text("x")', "Path('''pt2.md''').write_text('x')"), ["pt.md", "pt2.md"], "a triple-quoted receiver");
  both(python('p = r"rb.md"', "open(p, 'w')"), ["rb.md"], "a name bound to a prefixed literal");
  both(heredoc("node", "const s = `${writeFileSync('h.md', JSON.stringify({ a: 1 }))}`;"), ["h.md"], "an interpolation holding braces");
  both(python("s = f\"{{open('i.md','w')}}\""), [], "an f-string's doubled brace is a literal one");
  both(heredoc("node", "const s = `${\"writeFileSync('j.md', 'x')\"}`;"), [], "a string inside an interpolation is still a string");
  both(heredoc("node", "const s = `${fs.writeFileSync('nt.md', `content ${`deep`}`)}`;"), ["nt.md"], "a template inside an interpolation");
  both(heredoc("node", "const s = `${`writeFileSync('nu.md', 'x')`}`;"), [], "and a call spelt in that inner template is none");
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

const LEARNING = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "hooks", "entries", "learning", "learning-gate.mjs");
const HOME = homeEnv("body-calls");

test("the learning gate refuses a skill write behind a python body that opens a test", () => {
  const skill = "/home/dev/app/plugin/skills/issue-flow/SKILL.md";
  const command = `${python("x = [[1], [2] ]")}\necho x > ${skill}`;
  const run = callHook(LEARNING, { session_id: randomUUID(), tool_name: "Bash", tool_input: { command } }, HOME);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(answered(run)?.hookSpecificOutput?.permissionDecision, "deny", run.stdout);
});
