/* Which shell children the audit may stop treating as blinding, one shape at a time. The exemption
   is the whole risk of ISS-1793: a rule that answered true for a shell which does read the tree
   would hold that file back on a change it had to be spent on, and nothing would say so. */
import assert from "node:assert/strict";
import test from "node:test";

import { opensNothing } from "../../../../../tools/gates/reads/shell.mjs";

const sh = (line, file = "sh") =>
  ({ ticket: null, file, cwd: "/anywhere", args: ["-c", line], pathIn: false, funcIn: false });

const OPENS_NOTHING = [
  ["command -v git", "the shape gates.test.mjs spawns, which asks the box where a program is"],
  ["command -V git", "the other flag that asks rather than runs"],
  ["command -v git node", "two names asked about at once"],
  ["type git", "a lookup that is a builtin under its own name"],
  ["type -a git", "and one carrying a flag of its own"],
  ["hash git", "a lookup that fills the shell's own table"],
  ["printf %s hello", "a builtin that writes its operands and opens none"],
  ["printf %s 'docs/cli/$HOME-`id`.md, docs/cli/it'\\''s-here.md, plugin/bin/forge'", "the shape"
    + " run-wrote-line.test.mjs spawns: a quoted run gives nothing inside it any meaning, and printf"
    + " prints its operands rather than opening them, so a tracked path among them is still text"],
  ["echo one two", "the other writer"],
  ["true", "a program with no operand at all"],
  [":", "and the one whose name is punctuation"],
];

const BLINDS = [
  ["cat plugin/src/one.mjs", "a program that opens what it is handed, which is the case that matters"],
  ["cat one", "the same program on a name the reading follows perfectly well"],
  ["command git status", "`command` without a flag runs what it is handed"],
  ["command cat README.md -v", "a `-v` further along the line is the operand of what would run"],
  ["command -- cat README.md -v", "and one behind a `--` the same"],
  ["command -v", "`command -v` naming nothing at all"],
  ["command -v ./plugin/bin/forge", "an operand holding a slash is a path answered about, not a name"],
  ["type plugin/src/one.mjs", "the same of a lookup under its own name"],
  ["which git", "`which` is a program `PATH` chooses, not a builtin of the shell"],
  ["command -v git; cat one", "a second command"],
  ["command -v git && cat one", "a second command reached the other way"],
  ["command -v git | cat", "a pipe"],
  ["printf %s $(cat one)", "a substitution"],
  ["printf %s `cat one`", "the older substitution"],
  ["printf %s $PWD", "an expansion"],
  ["printf %s \"one\"", "a double quote, whose inside is expanded again"],
  ["printf %s 'one", "a quote nothing closes"],
  ["printf %s one\\", "a backslash with nothing after it"],
  ["echo one > out", "a redirection"],
  ["echo one < in", "a redirection the other way"],
  ["echo *", "a glob the shell answers from the directory it stands in"],
  ["echo ~", "a tilde"],
  ["FOO=one printf %s two", "an assignment, which makes the first word no program at all"],
  ["printf %s one\ncat two", "a second command on a second line"],
  ["", "a line with no command in it"],
];

test("a shell asked to run one builtin that opens no file is read as opening none", () => {
  for (const [line, why] of OPENS_NOTHING) {
    assert.equal(opensNothing(sh(line)), true, `sh -c ${JSON.stringify(line)} blinds its test file: ${why}`);
  }
});

test("every other shell command line blinds the file that spawned it, as it always did", () => {
  for (const [line, why] of BLINDS) {
    assert.equal(opensNothing(sh(line)), false,
      `sh -c ${JSON.stringify(line)} stopped blinding its test file: ${why}`);
  }
});

/* The environment decides what the words mean before the words do: a directory of this tree on PATH
   makes a lookup's answer this tree's content, and an exported function replaces a builtin outright. */
test("an environment that can reach this repository blinds whatever the line asked for", () => {
  assert.equal(opensNothing({ ...sh("command -v git"), pathIn: true }), false, "a lookup along it");
  assert.equal(opensNothing({ ...sh("printf %s hello"), pathIn: true }), false, "and a writer too");
  assert.equal(opensNothing({ ...sh("printf %s hello"), funcIn: true }), false,
    "an exported shell function of that name is what would run");
  assert.equal(opensNothing({ ...sh("command -v git"), pathIn: undefined }), false,
    "a record that never said what its search path was");
  assert.equal(opensNothing({ ...sh("command -v git"), funcIn: undefined }), false,
    "nor what its environment could rename");
});

test("the shell a record names decides whether the line is a shell's at all", () => {
  assert.equal(opensNothing(sh("command -v git", "/bin/sh")), true, "a shell named by its path");
  assert.equal(opensNothing(sh("command -v git", "/bin/dash")), true, "and the other one named here");
  assert.equal(opensNothing(sh("command -v git", "bash")), false,
    "bash under its own name reads BASH_ENV before it runs the line");
  assert.equal(opensNothing(sh("command -v git", "zsh")), false, "and zsh its own startup file");
  assert.equal(opensNothing(sh("command -v git", "node")), false, "node's -c is not a shell's");
  assert.equal(opensNothing({ ...sh("x"), args: ["-e", "-c", "command -v git"] }), false,
    "a shell handed anything beside -c is not a line this reads");
  assert.equal(opensNothing({ ...sh("x"), args: ["script.sh"] }), false,
    "a shell handed a script reads that script");
});

/* `exec` and `execSync` record the line itself and the shell they were given, so neither has to be
   guessed from a program name holding spaces. */
test("the line exec and execSync record is read the same way, under the shell they named", () => {
  const ran = (file, shell) =>
    ({ ticket: null, shell, file, args: [], cwd: "/anywhere", pathIn: false, funcIn: false });
  assert.equal(opensNothing(ran("command -v git", "sh")), true);
  assert.equal(opensNothing(ran("cat one", "sh")), false);
  assert.equal(opensNothing(ran("command -v git", "/usr/bin/zsh")), false,
    "the shell the call chose is the one that runs the line");
  assert.equal(opensNothing({ ticket: "t-1", file: "command -v git", args: [], cwd: "/anywhere",
    pathIn: false, funcIn: false }), false,
  "a spawned program whose own name is that string is not a shell line");
});
