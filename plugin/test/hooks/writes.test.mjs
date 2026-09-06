/* The freshness reading had a ceiling and no floor, so for two minutes after a checkout was cut every
   path a read command named answered as written — met in the first minute of every worktree per
   session run (ISS-200). The floor is the call, so the cases are a young file nobody wrote, a young
   file this call wrote, and a transcript that cannot say.

   The floor stops at the call's own edge: a git operation *inside* one stamps above it, so every name
   after the `&&` read as written (ISS-39). The second half of the evidence is the tree, and the cases
   for it are at the foot of this file. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, realpathSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { FRESH_MS, callAt, shellWrites, touched } from "../../hooks/_hook.mjs";
import { glued } from "../../src/hooks/assembled.mjs";
import { agreedWithHead, LEAST_MS } from "../../src/hooks/git-probe.mjs";
import { tempRoom } from "../fixtures.mjs";

const room = tempRoom("writes-");
mkdirSync(join(room, "plugin", "src"), { recursive: true });
const NOW = Date.now();
let made = 0;

/* What the transcript says about when a call began: the last assistant record is the message asking
   for its tool, and a user record after it is the previous call's result. */
const asked = (at, { assistant = true } = {}) => {
  const path = join(room, `t-${(made += 1)}.jsonl`);
  const lines = [{ type: "user", promptSource: "typed", timestamp: new Date(at - 60_000).toISOString() }];
  if (assistant) {
    lines.push({
      type: "assistant",
      timestamp: new Date(at).toISOString(),
      message: { content: [{ type: "tool_use", name: "Bash", input: { command: "x" } }] },
    });
  }
  writeFileSync(path, `${lines.map((one) => JSON.stringify(one)).join("\n")}\n`);
  return path;
};

const stamped = (name, at) => {
  const path = join(room, name);
  writeFileSync(path, "x\n");
  utimesSync(path, new Date(at), new Date(at));
  return realpathSync(path);
};

const bash = (command, transcript = "") => ({
  session_id: "s1",
  tool_name: "Bash",
  tool_input: { command },
  cwd: room,
  transcript_path: transcript,
});

/* The defect itself: `git worktree add` stamps every file in the tree, and a read is not a write. */
test("a file the checkout stamped before the call began is nobody's write", () => {
  const file = stamped("checked-out.md", NOW - 30_000);
  const found = touched(bash("cat checked-out.md", asked(NOW - 10_000)));
  assert.deepEqual(found, [], `${file} was 30s old, well inside the ${FRESH_MS} ms window`);
});

test("a file this call wrote still answers as written", () => {
  const file = stamped("written.md", NOW - 5_000);
  assert.deepEqual(touched(bash("printf x > written.md", asked(NOW - 10_000))), [file]);
});

test("a file older than the window is no write, floor or no floor", () => {
  stamped("stale.md", NOW - 10 * FRESH_MS);
  assert.deepEqual(touched(bash("cat stale.md", asked(NOW - 10_000))), []);
  assert.deepEqual(touched(bash("cat stale.md")), [], "and the same with nothing to read the floor from");
});

/* A hand-run gate and a suite fixture have no transcript, and a wall that stands down on doubt is
   not a wall: with no floor to read, a young file the call named answers as it always did. */
test("where nothing says when the call began, a young file answers as written", () => {
  const file = stamped("no-floor.md", NOW - 30_000);
  assert.deepEqual(touched(bash("cat no-floor.md")), [file], "no transcript");
  assert.deepEqual(touched(bash("cat no-floor.md", join(room, "gone.jsonl"))), [file], "an unreadable one");
  assert.deepEqual(
    touched(bash("cat no-floor.md", asked(NOW - 10_000, { assistant: false }))),
    [file],
    "a transcript holding no assistant record",
  );
});

test("the file tools answer with their own path and consult no clock", () => {
  const file = stamped("edited.md", NOW - 10 * FRESH_MS);
  const ev = { session_id: "s1", tool_name: "Edit", tool_input: { file_path: file }, cwd: room };
  assert.deepEqual(touched(ev), [file]);
});

/* The other half of the same reading: a name the command computes rather than spells. ISS-242 gave
   the harness `expanded` for a shell's own bindings and `glued` for an interpreter body's, and
   `shellWrites` runs both — but only the readings taken before a call spent it. The post-call reader
   spends it *beside* the raw text and never instead of it, because `bodiless` drops a data heredoc's
   body and the tokens in there are answers this reader has always given (ISS-37). */
const heredoc = (...lines) => ["python3 - <<'PY'", ...lines, "PY"].join("\n");

test("a path the shell assembled from a binding of its own is a write the reader sees", () => {
  const file = stamped("plugin/src/piece.mjs", NOW - 5_000);
  assert.deepEqual(touched(bash("H=plugin/src; sed -i s/x/y/ $H/piece.mjs", asked(NOW - 10_000))), [file]);
});

test("a path an interpreter body assembled from a binding of its own is one too", () => {
  const file = stamped("plugin/src/glued.mjs", NOW - 5_000);
  const bind = ["from pathlib import Path", 'root = "plugin/src"'];
  const at = asked(NOW - 10_000);
  assert.deepEqual(
    touched(bash(heredoc(...bind, 'Path(root + "/glued.mjs").write_text("z")'), at)),
    [file],
    "concatenation",
  );
  assert.deepEqual(
    touched(bash(heredoc(...bind, 'Path(f"{root}/glued.mjs").write_text("z")'), at)),
    [file],
    "the f-string",
  );
  assert.deepEqual(
    touched(bash(`python3 -c 'root = "plugin/src"; open(root + "/glued.mjs", "w").write("z")'`, at)),
    [],
    "an inline body is not folded, only a heredoc's — ISS-444, and how/writes.md names it",
  );
});

/* The case a reader that resolved *instead of* reading the raw text would lose. */
test("a data heredoc's body still names a write, though the resolved text has dropped it", () => {
  const file = stamped("plugin/src/data.mjs", NOW - 5_000);
  const command = ["cat <<'EOF' | grep x", "plugin/src/data.mjs", "EOF"].join("\n");
  assert.equal(shellWrites(command).includes("data.mjs"), false, "the body is data, so it is gone");
  assert.deepEqual(touched(bash(command, asked(NOW - 10_000))), [file]);
});

test("a loop over names the command spells is read, and one over a glob is a write nobody sees", () => {
  const one = stamped("plugin/src/one.mjs", NOW - 5_000);
  const two = stamped("plugin/src/two.mjs", NOW - 5_000);
  const at = asked(NOW - 10_000);
  assert.deepEqual(
    touched(bash('for f in plugin/src/one.mjs plugin/src/two.mjs; do sed -i s/x/y/ "$f"; done', at)),
    [one, two],
  );
  assert.deepEqual(
    touched(bash('for f in plugin/src/*.mjs; do sed -i s/x/y/ "$f"; done', at)),
    [],
    "no spelling in the text produces what a glob matched, and how/writes.md says so",
  );
});

test("a name only a binding produces still answers to this call's floor", () => {
  stamped("plugin/src/stamped.mjs", NOW - 30_000);
  assert.deepEqual(
    touched(bash("H=plugin/src; sed -i s/x/y/ $H/stamped.mjs", asked(NOW - 10_000))),
    [],
    "young enough for the window and older than the call, so the floor is what turns it down",
  );
});

test("the call began where the last assistant record stands, and a record with no timestamp says nothing", () => {
  const at = "2026-09-01T10:00:00.000Z";
  const records = [
    { type: "assistant", timestamp: "2026-09-01T09:00:00.000Z" },
    { type: "assistant", timestamp: at },
    { type: "user", timestamp: "2026-09-01T11:00:00.000Z" },
  ];
  assert.equal(callAt(records), Date.parse(at), "the user record after it is the previous result");
  assert.equal(callAt([{ type: "assistant" }]), 0, "a record with no timestamp");
  assert.equal(callAt([{ type: "user", timestamp: at }]), 0, "no assistant record at all");
  assert.equal(callAt(null), 0, "a transcript that could not be read");
});

/* What an interpreter would have built before it wrote, read straight rather than through a gate: a
   binding reaches the text after it only, a join keeps its own API's rule, and a form that does not
   interpolate is a literal (ISS-242). */
const py = (body) => glued(body, "python3");
const js = (body) => glued(body, "node");

test("a body's own binding is substituted where the runner would have substituted it", () => {
  assert.match(py('root = "a/b"\np = root + "/SKILL.md"'), /"a\/b\/SKILL\.md"/u, "concatenation");
  assert.match(py('root = "a/b"\np = f"{root}/SKILL.md"'), /"a\/b\/SKILL\.md"/u, "an f-string");
  assert.match(py('root = "a/b"\np = "{root}/SKILL.md"'), /p = "\{root\}\/SKILL\.md"/u, "but not an ordinary string");
  assert.match(js('const root = "a/b";\nconst p = `${root}/SKILL.md`;'), /"a\/b\/SKILL\.md"/u, "a template literal");
  assert.match(js('const root = "a/b";\nconst p = "${root}/SKILL.md";'), /p = "\$\{root\}\/SKILL\.md"/u, "but not a quoted string");
});

test("a join keeps the rule of the API that was called", () => {
  assert.match(py('root = "a/b"\np = os.path.join(root, "SKILL.md")'), /"a\/b\/SKILL\.md"/u);
  assert.match(py('root = "a/b"\np = os.path.join(root, "/tmp/o.md")'), /"\/tmp\/o\.md"/u, "python drops what is before an absolute member");
  assert.match(js('const root = "a/b";\nconst p = path.join(root, "/SKILL.md");'), /"a\/b\/SKILL\.md"/u, "node's does not");
  assert.match(py('p = pathlib.Path("a/b") / "SKILL.md"'), /"a\/b\/SKILL\.md"/u, "and an assembly needs no binding");
  assert.match(py('p = path.join(__dirname, "SKILL.md")'), /__dirname/u, "a member this cannot read leaves the call alone");
});

test("a binding answers for the text after it, and only while it holds a literal", () => {
  assert.match(py('p = root + "/SKILL.md"\nroot = "a/b"'), /p = root \+ "\/SKILL\.md"/u, "a binding after the use");
  assert.match(py('root = "a/b"\nroot = sys.argv[1]\np = root + "/SKILL.md"'), /p = root \+ "\/SKILL\.md"/u, "rebound to a value this cannot read");
  assert.match(py('root = "a/b" if x else "/tmp"\np = root + "/SKILL.md"'), /p = root \+ "\/SKILL\.md"/u, "a literal that opens a larger expression");
  const long = py('root = "a/b"\nlabel = f"{root}{root}{root}{root}"\np = root + "/SKILL.md"\nroot = "/tmp"');
  assert.match(long, /"a\/b\/SKILL\.md"/u, "a substitution that lengthens the body moves no later binding into reach");
});

test("more than one assembly in a body, and more than two members in one", () => {
  const both = py('a = "one" + "/x.md"\nb = "two" + "/y.md"');
  assert.match(both, /"one\/x\.md"/u);
  assert.match(both, /"two\/y\.md"/u, "the second assembly folds too");
  assert.match(py('p = "plugin" + "/skills" + "/issue-flow" + "/SKILL.md"'), /"plugin\/skills\/issue-flow\/SKILL\.md"/u);
});

/* ISS-39: one call, a git operation and then the names. The floor is the moment the call was asked
   for, so the checkout stamps above it and every name after the `&&` answered as written. What
   separates the two is the tree: a file it still agrees with HEAD about was restamped, not written. */

const git = (at, ...args) =>
  spawnSync("git", ["-C", at, "-c", "user.email=t@t", "-c", "user.name=t", ...args], { encoding: "utf8" });

/* Two branches whose files differ, so checking one out rewrites all three and stamps them now. */
const repoWithBranches = () => {
  const at = tempRoom("writes-repo-");
  spawnSync("git", ["init", "-q", "-b", "one", at], { encoding: "utf8" });
  for (const name of ["a.md", "b.md", "c.md"]) writeFileSync(join(at, name), "one\n");
  git(at, "add", "a.md", "b.md", "c.md");
  git(at, "commit", "-qm", "one");
  git(at, "checkout", "-qb", "two");
  for (const name of ["a.md", "b.md", "c.md"]) writeFileSync(join(at, name), "two\n");
  git(at, "commit", "-qm", "two", "a.md", "b.md", "c.md");
  return { at, files: ["a.md", "b.md", "c.md"].map((one) => realpathSync(join(at, one))) };
};

const inRepo = (at, command, floor = NOW - 20_000) => ({
  session_id: "s1",
  tool_name: "Bash",
  tool_input: { command },
  cwd: at,
  transcript_path: asked(floor),
});

/* The defect: `git rebase master && <read the files>` is this repository's own Phase 4 last step. */
test("a checkout in the same call stamped the files, and the verb after it only named them", () => {
  const { at } = repoWithBranches();
  assert.deepEqual(touched(inRepo(at, "git checkout -q one && cat a.md b.md c.md")), []);
});

test("a tracked file the same call really changed is a write, whichever route wrote it", () => {
  const { at, files } = repoWithBranches();
  writeFileSync(join(at, "a.md"), "a script the command text says nothing about wrote this\n");
  assert.deepEqual(touched(inRepo(at, "node tools/fix.mjs a.md")), [files[0]]);
});

test("a file the call created is a write, and one the repository ignores is too", () => {
  const { at } = repoWithBranches();
  writeFileSync(join(at, ".gitignore"), "made.log\nbuilt/\n");
  mkdirSync(join(at, "built"), { recursive: true });
  writeFileSync(join(at, "made.md"), "new\n");
  writeFileSync(join(at, "made.log"), "new\n");
  writeFileSync(join(at, "built", "out.js"), "new\n");
  assert.deepEqual(touched(inRepo(at, "node tools/make.mjs made.md")), [realpathSync(join(at, "made.md"))]);
  assert.deepEqual(
    touched(inRepo(at, "node tools/make.mjs made.log")),
    [realpathSync(join(at, "made.log"))],
    "an ignored path is reported under --ignored and under no other flag",
  );
  assert.deepEqual(
    touched(inRepo(at, "node tools/make.mjs built/out.js")),
    [realpathSync(join(at, "built", "out.js"))],
    "and one inside an ignored directory is reported by name, which --ignored=matching would not",
  );
});

/* The tree cannot report a write that puts back the bytes HEAD holds, so the command's own text is
   asked first and a claim there answers on the stamp alone. */
test("a redirect onto a file the tree agrees with HEAD about is still a write", () => {
  const { at, files } = repoWithBranches();
  writeFileSync(join(at, "a.md"), "two\n");
  assert.deepEqual(touched(inRepo(at, "printf 'two\\n' > a.md")), [files[0]]);
  assert.deepEqual(touched(inRepo(at, "cat a.md")), [], "and the same bytes, only mentioned, are not");
});

/* The narrowing this change declares: with no write shape in the text, a script that restores a
   file to HEAD's bytes cannot be told from a `git checkout --` of it, and neither is offered. */
test("a route with no write shape that restores HEAD's bytes is the case this gives up", () => {
  const { at } = repoWithBranches();
  writeFileSync(join(at, "a.md"), "what a run had changed it to\n");
  writeFileSync(join(at, "a.md"), "two\n");
  assert.deepEqual(touched(inRepo(at, "node tools/restore.mjs a.md")), []);
});

test("a candidate in no repository answers as it always did", () => {
  const file = stamped("outside-any-repo.md", NOW - 5_000);
  assert.deepEqual(touched(bash("cat outside-any-repo.md", asked(NOW - 20_000))), [file]);
});

/* One allowance per probe and a run of them unbounded is no clock at all: 85 s of post deadline, five per probe. */
test("a spent event budget stops the asking and drops nothing", () => {
  const { at, files } = repoWithBranches();
  assert.deepEqual([...agreedWithHead(files, () => 85_000)], files, "the three are clean, and the clock is not");
  assert.deepEqual([...agreedWithHead(files, () => 0)], [], `nothing in ${at} was asked about`);
});

test("a budget that runs out between probes stops the run rather than overrunning it", () => {
  const { at, files } = repoWithBranches();
  let opened = false;
  const draining = () => (opened ? LEAST_MS - 1 : ((opened = true), 85_000));
  assert.deepEqual([...agreedWithHead(files, draining)], [], `no probe in ${at} was bought below the floor`);
  assert.deepEqual([...agreedWithHead(files, () => LEAST_MS)], files, "the floor itself still buys one");
});

/* Doubt keeps a candidate: a wall that stands down where it cannot see is not a wall (ISS-200). */
test("where git will not answer for the tree, nothing is dropped", () => {
  const at = tempRoom("writes-broken-");
  writeFileSync(join(at, ".git"), "gitdir: nowhere at all\n");
  writeFileSync(join(at, "held.md"), "x\n");
  assert.deepEqual(touched(inRepo(at, "cat held.md")), [realpathSync(join(at, "held.md"))]);
});

test("a body that binds nothing and assembles nothing comes back as it went in", () => {
  const plain = 'print("hello")\nopen("docs/HOOKS.md", "w").write("x")';
  assert.equal(py(plain), plain);
});

/* Three ways the staged reading answered for a path the program would not have built, each found by
   the recheck of the landing head (ISS-242). */
test("a binding is read in code, and a composed assembly composes", () => {
  const composed = 'root = "a/b"\nleaf = "SKILL.md"\np = pathlib.Path(f"{root}/" + leaf)';
  assert.match(py(composed), /"a\/b\/SKILL\.md"/u, "an interpolation and a concatenation in one expression");
  assert.match(py('root = "a/b"\n# root = "/tmp"\np = root + "/SKILL.md"'), /"a\/b\/SKILL\.md"/u,
    "a rebinding inside a comment rebinds nothing");
  assert.match(py('root = "a/b"\ntext = "root = \'/tmp\'"\np = root + "/SKILL.md"'), /"a\/b\/SKILL\.md"/u,
    "nor one inside a string the body is writing");
  assert.match(js('const root = "a/b" /* where it goes */;\nconst p = root + "/SKILL.md";'), /"a\/b\/SKILL\.md"/u,
    "and a block comment still ends the right-hand side");
});

/* A constructor could not fold while its argument was still concatenated, and a resolved template
   literal reached no later stage, so both stages now run to a fixed point over one representation
   (ISS-242). */
test("an assembly whose parts arrive out of order still folds", () => {
  assert.match(py('root = "a/b"\np = (pathlib.Path(root + "/SKILL.md") / "/tmp/o.md")'), /"\/tmp\/o\.md"/u,
    "the constructor folds once its argument is one literal, and then the join resets");
  assert.match(js('const root = "a/b";\nconst leaf = "SKILL.md";\nconst p = `${root}/` + leaf;'), /"a\/b\/SKILL\.md"/u,
    "a resolved template literal is one literal the concatenation can reach");
});

/* A keyword argument is not an assignment and an escaped interpolation is not one either, so neither
   answers for a path the interpreter would not have built (ISS-242). */
test("what only looks like a binding or an interpolation binds and interpolates nothing", () => {
  const kw = 'root = "plugin/skills/issue-flow"\ndict(root="/tmp")\np = root + "/SKILL.md"';
  assert.match(py(kw), /"plugin\/skills\/issue-flow\/SKILL\.md"/u, "a keyword argument rebinds nothing");
  const escaped = 'const root = "plugin/skills/issue-flow";\nwriteFileSync(`/tmp/\\${root}/SKILL.md`, "x");';
  assert.match(js(escaped), /`\/tmp\/\\\$\{root\}\/SKILL\.md`/u, "an escaped interpolation is left as it stands");
});
