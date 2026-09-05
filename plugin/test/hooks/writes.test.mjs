/* The freshness reading had a ceiling and no floor, so for two minutes after a checkout was cut every
   path a read command named answered as written — met in the first minute of every worktree per
   session run (ISS-200). The floor is the call, so the cases are a young file nobody wrote, a young
   file this call wrote, and a transcript that cannot say. */
import assert from "node:assert/strict";
import test from "node:test";
import { realpathSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { FRESH_MS, callAt, glued, touched } from "../../hooks/_hook.mjs";
import { tempRoom } from "../fixtures.mjs";

const room = tempRoom("writes-");
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
