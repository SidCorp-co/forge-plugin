/* The other wrong call a body slot takes: the body itself standing where its path goes (ISS-842).
   The flag-shaped path is ISS-240's and its cases are beside the did-you-mean ones. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { bodyFrom, bodyItself } from "../../src/resolve/payload.mjs";
import { Refusal, refusing } from "../../src/resolve/settings.mjs";
import { fakeTracker, ranAsync, tempHome, tempRoom } from "../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("body-slot").path;
const room = tempRoom("body-slot-");
const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../..", import.meta.url).pathname;

const state = {
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  issues: [{
    documentId: "uuid-842",
    issueId: "ISS-842",
    status: "in_progress",
    title: "a body positional that is prose",
    description: "x",
  }],
  comments: { "uuid-842": [] },
  calls: [],
  answer: {
    forge_comments: (args) => {
      const rows = state.comments["uuid-842"];
      if (args.action === "list") {
        return { comments: rows, returned: rows.length, limit: rows.length, hasMore: false };
      }
      const row = { documentId: `c-${rows.length + 1}`, ...args.data };
      state.comments["uuid-842"] = [...rows, row];
      return row;
    },
  },
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());

/* `forge` on PATH is this checkout's own entry, so a command the refusal printed runs as printed;
   the room is where a relative body path resolves, so it needs the project file the scope reads. */
const bin = join(room, "bin");
mkdirSync(bin, { recursive: true });
symlinkSync(FORGE, join(bin, "forge"));
writeFileSync(join(room, ".forge.json"), readFileSync(join(ROOT, ".forge.json"), "utf8"));

const env = {
  ...tracker.env,
  AI_AGENT: "a-test-agent",
  CLAUDE_PID: "4242",
  FORGE_SESSION_ID: "body-slot-run",
  PATH: `${bin}:${process.env.PATH}`,
};

/* The read-first gate delivers what this session has not been shown; the re-send is the write. */
const HELD = /Hold —/u;
const twice = async (command, argv, stdin) => {
  const run = await ranAsync(command, argv, env, room, stdin);
  return run.status === 0 || !HELD.test(run.stderr) ? run : ranAsync(command, argv, env, room, stdin);
};
const ran = (argv, stdin = null) => twice(FORGE, argv, stdin);
const shell = (line, stdin = null) => twice("bash", ["-c", line], stdin);

const creates = () =>
  (state.calls ?? []).filter((one) => one.name === "forge_comments" && one.args.action !== "list");
const lastBody = () => (state.comments["uuid-842"].at(-1)?.body ?? "").trim();
const printed = (said) => said.split("\n").filter((one) => one.startsWith("  ")).map((one) => one.trim());

test("the body itself where a path goes is refused by the verb, and no fs error reaches the caller", async () => {
  state.calls = [];
  const run = await ran(["comment", "ISS-842", "some prose"]);
  assert.equal(run.status, 1, run.stderr);
  assert.doesNotMatch(run.stderr, /ENOENT/u, "the filesystem names a file nobody typed");
  assert.match(run.stderr, /`some prose` is the body itself, not a path to one/u);
  assert.match(run.stderr, /this slot takes a file, `@file`, or `-` for stdin/u);
  assert.deepEqual(creates(), [], "and nothing is written for a call that was refused");
});

test("the refusal carries the caller's own call in both the forms the slot takes", async () => {
  const run = await ran(["comment", "ISS-842", "some prose", "--title", "A test"]);
  assert.deepEqual(printed(run.stderr), [
    "forge comment ISS-842 body.md --title 'A test'",
    `echo "<the body>" | forge comment ISS-842 - --title 'A test'`,
  ], "the reference and the flags the caller typed, and a value a shell would split still quoted");
});

test("both printed forms run as printed, flags and all", async () => {
  const run = await ran(["comment", "ISS-842", "some prose", "--title", "A test"]);
  const [file, piped] = printed(run.stderr);
  writeFileSync(join(room, "body.md"), "the body from the file\n");
  const first = await shell(file);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(lastBody(), "## A test\n\nthe body from the file", "the two-word title arrived whole");
  const second = await shell(piped.replace("<the body>", "the body from stdin"));
  assert.equal(second.status, 0, second.stderr);
  assert.equal(lastBody(), "## A test\n\nthe body from stdin");
});

test("a flag whose value is the body's own string keeps it, and the slot is what the forms replace", async () => {
  const run = await ran(["comment", "ISS-842", "--title", "some prose", "some prose"]);
  assert.deepEqual(printed(run.stderr), [
    "forge comment ISS-842 --title 'some prose' body.md",
    `echo "<the body>" | forge comment ISS-842 --title 'some prose' -`,
  ]);
});

/* A flag's value is whatever the shell bound to it, so `--a sentence` is a title and not a flag
   word, and the body after it is still the body (consult 35f05b F1). */
test("a flag whose value opens with two dashes owns it, and the slot after it is still the slot", async () => {
  const run = await ran(["comment", "ISS-842", "--title", "--a sentence", "some prose"]);
  assert.deepEqual(printed(run.stderr), [
    "forge comment ISS-842 --title '--a sentence' body.md",
    `echo "<the body>" | forge comment ISS-842 --title '--a sentence' -`,
  ]);
});

test("a body of many lines is quoted back by its first line alone, cut", async () => {
  const first = "x".repeat(80);
  const run = await ran(["comment", "ISS-842", `${first}\nand a second line`]);
  assert.match(run.stderr, new RegExp(`\`${"x".repeat(60)}…\` is the body itself`, "u"));
  assert.doesNotMatch(run.stderr, /and a second line/u, "a refusal nobody can read is the defect");
});

test("the cut is by code point, so a character astride it survives whole", async () => {
  const run = await ran(["comment", "ISS-842", `${"x".repeat(59)}😀 and more\nand a second line`]);
  assert.match(run.stderr, new RegExp(`\`${"x".repeat(59)}😀…\` is the body itself`, "u"));
  assert.doesNotMatch(run.stderr, /�/u, "half a surrogate pair is not what the caller typed");
});

test("a body slot reached through a form name prints a command that runs as printed", async () => {
  const run = await ran(["comments", "ISS-842", "some prose"]);
  const [file] = printed(run.stderr);
  assert.equal(file, "forge comments ISS-842 body.md");
  writeFileSync(join(room, "body.md"), "the body through the form\n");
  const again = await shell(file);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(lastBody(), "the body through the form");
});

test("a path genuinely meant and genuinely missing still says the file is not there", async () => {
  const bare = await ran(["comment", "ISS-842", "done"]);
  assert.match(bare.stderr, /ENOENT: no such file or directory, open 'done'/u);
  assert.doesNotMatch(bare.stderr, /stdin/u, "and is not rewritten into advice about stdin");
  const held = await ran(["comment", "ISS-842", "dir/some prose.md"]);
  assert.match(held.stderr, /ENOENT: no such file or directory, open 'dir\/some prose\.md'/u);
});

test("a readable file whose own name holds whitespace is read, and its text posted", async () => {
  writeFileSync(join(room, "held body"), "the file with a spacious name\n");
  const run = await ran(["comment", "ISS-842", "held body"]);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(lastBody(), "the file with a spacious name");
});

test("a value holding a newline is the body itself whatever separators it carries", async () => {
  const run = await ran(["comment", "ISS-842", "docs/cli/did-you-mean.md\nand a second line"]);
  assert.equal(run.status, 1, run.stderr);
  assert.match(run.stderr, /is the body itself, not a path to one/u);
});

/* The embedding script's own argv carries the value here, which is the collision an absent-value
   test would miss: what withholds the command is the embedding and not the search (consult ad5de4). */
test("where no call of this CLI's own ran, the refusal names the shapes and prints no command", async () => {
  const held = process.argv;
  process.argv = [process.execPath, "/elsewhere/run.mjs", "ship", "some prose"];
  try {
    const raised = await refusing(() => bodyFrom("some prose")).then(() => null, (error) => error);
    assert.ok(raised instanceof Refusal, "a read with no process of its own throws rather than exits");
    assert.match(raised.message, /this slot takes a file, `@file`, or `-` for stdin/u);
    assert.match(raised.message, /Write it to a file and name it, or pipe it in\./u, "the route, in prose");
    assert.doesNotMatch(raised.message, /Do this/u, "a command built from another script's argv is fiction");
    assert.doesNotMatch(raised.message, /forge ship/u, "least of all one naming that script's own verb");
  } finally {
    process.argv = held;
  }
});

test("the routes the slot does take are untouched", async () => {
  const piped = await ran(["comment", "ISS-842", "-"], "the body from a pipe\n");
  assert.equal(piped.status, 0, piped.stderr);
  assert.equal(lastBody(), "the body from a pipe");
  writeFileSync(join(room, "named.md"), "the body from an at-name\n");
  const named = await ran(["comment", "ISS-842", `@${join(room, "named.md")}`]);
  assert.equal(named.status, 0, named.stderr);
  assert.equal(lastBody(), "the body from an at-name");
  const flagged = await ran(["new", "--read", "--title", "T"]);
  assert.match(flagged.stderr, /No new flag named --read/u, "ISS-240's sentence, unchanged");
});

test("every verb whose body comes through the one reader gets the same refusal, with its own call", async () => {
  const run = await ran(["knowledge", "write", "module-x", "some prose", "--kind", "reference", "--title", "T"]);
  assert.equal(run.status, 1, run.stderr);
  assert.match(run.stderr, /`some prose` is the body itself, not a path to one/u);
  assert.deepEqual(printed(run.stderr), [
    "forge knowledge write module-x body.md --kind reference --title T",
    `echo "<the body>" | forge knowledge write module-x - --kind reference --title T`,
  ]);
});

/* The two record verbs read through the consult's reader first, which stats the path and raises, so
   the same account has to answer there before `stat` does — and that reader refuses a pipe, so the
   stdin form is withheld rather than printed for the next call to turn away (consult d29ef7 F2). */
test("the verbs whose body is read for a consult first answer the same way, minus the pipe", async () => {
  state.calls = [];
  for (const kind of ["criteria", "plan"]) {
    const run = await ran(["record", kind, "ISS-842", "some prose"]);
    assert.equal(run.status, 1, run.stderr);
    assert.doesNotMatch(run.stderr, /ENOENT/u, "and not `stat` on a file nobody named");
    assert.match(run.stderr, /never an `@file` and never a pipe/u);
    assert.doesNotMatch(run.stderr, /takes a file, `@file`/u, "the shapes named are the ones it takes");
    assert.deepEqual(printed(run.stderr), [`forge record ${kind} ISS-842 body.md`]);
  }
  assert.deepEqual(state.calls.filter((one) => one.args.action === "update"), [], "and nothing is set");
});

test("two positionals holding the value are two slots, so the shapes answer and no command does", async () => {
  const run = await ran(["knowledge", "write", "some prose", "some prose", "--kind", "reference", "--title", "T"]);
  assert.equal(run.status, 1, run.stderr);
  assert.match(run.stderr, /is the body itself, not a path to one/u);
  assert.match(run.stderr, /Write it to a file and name it, or pipe it in\./u);
  assert.deepEqual(printed(run.stderr), [], "a command replacing the slug is worse than no command");
});

test("the reading is against the directory the reader names, not the one this process stands in", () => {
  const elsewhere = tempRoom("body-slot-elsewhere-");
  writeFileSync(join(elsewhere, "held body.md"), "the body under another root\n");
  assert.equal(bodyItself("held body.md", elsewhere), false, "a file the reader can see is a path");
  assert.equal(bodyItself("held body.md", room), true, "and the same name where there is none is not");
});

test("a body a flag takes is the slot the forms replace, since that flag owns its only occurrence", async () => {
  const run = await ran(["doctor", "--refresh", "some prose"]);
  assert.equal(run.status, 1, run.stderr);
  assert.deepEqual(printed(run.stderr), [
    "forge doctor --refresh body.md",
    `echo "<the body>" | forge doctor --refresh -`,
  ]);
});

test("the account of what counts as a body rather than a path has one home", () => {
  const found = spawnSync("git", ["grep", "-l", "is the body itself, not a path to one", "--", "plugin/src"],
    { cwd: ROOT, encoding: "utf8" });
  assert.equal(found.status, 0, found.stderr);
  assert.deepEqual(found.stdout.trim().split("\n"), ["plugin/src/resolve/payload.mjs"],
    "one reader refuses it, and no verb carries a copy of the reading");
});
