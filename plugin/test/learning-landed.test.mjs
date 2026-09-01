/* The backstop, called the way Claude Code calls it: after the write, with the command that landed
   the file. Every route the shapes miss ends here, so what it says is the last thing an agent reads
   about a file that should not have been written. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { callHook, homeEnv } from "./fixtures.mjs";

const HOOK = new URL("../hooks/learning-landed.mjs", import.meta.url).pathname;
const HOME = homeEnv("learning-landed");
const room = join(mkdtempSync(join(tmpdir(), "landed-")), "memory");
mkdirSync(room);

const landed = (session, name, { dir = room, old, existing } = {}) => {
  const file = join(dir, name);
  /* Writing through a link would replace it, so a case about links writes what it points at. */
  writeFileSync(existing ? realpathSync(file) : file, "a line\n");
  if (old) utimesSync(file, new Date(Date.now() - old), new Date(Date.now() - old));
  const run = callHook(
    HOOK,
    { session_id: session, tool_name: "Bash", tool_input: { command: `printf x > ${file}` }, cwd: dir },
    HOME,
  );
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim() ? JSON.parse(run.stdout).reason : null;
};

test("a memory file that arrived by no route a check reads is caught after the fact", () => {
  const first = landed(randomUUID(), "arrived-somehow.md");
  assert.match(first, /arrived-somehow\.md/u);
  assert.match(first, /Record only what cost a cycle/u);
  assert.match(first, /which of the four conditions/u);
  assert.match(first, /forge hooks --how learning-landed/u);
});

test("it is asked once, and never for the index", () => {
  const session = randomUUID();
  assert.ok(landed(session, "asked-once.md"));
  assert.equal(landed(session, "asked-once.md"), null, "a second call in the session is silent");
  assert.equal(landed(randomUUID(), "MEMORY.md"), null, "the index is not a memory");
});

/* Only the index is the index: the gate compares the file's name and this half compared the end of
   the path, so a file the gate asks about was one the backstop never did. */
test("a name that merely ends in the index's is a memory like any other", () => {
  assert.match(landed(randomUUID(), "OLD-MEMORY.md"), /OLD-MEMORY\.md/u);
});

/* The disk answers with what a name points at, so a guarded file that is a link to somewhere else
   arrived here as somewhere else and was skipped. Writing through the link writes the memory. */
test("a guarded name that links out of the tree is still a guarded write", () => {
  const outside = join(mkdtempSync(join(tmpdir(), "landed-outside-")), "kept.md");
  writeFileSync(outside, "a line\n");
  symlinkSync(outside, join(room, "points-away.md"));
  const said = landed(randomUUID(), "points-away.md", { existing: true });
  assert.match(said, /points-away\.md/u, "named by the link the call used");
});

/* The route both halves miss: a script writes the file and the command names nothing to check. The
   session's memory directory is the transcript's neighbour, so it is read rather than guessed at. */
test("a memory file no call named at all is found by reading the directory", () => {
  const session = randomUUID();
  const project = mkdtempSync(join(tmpdir(), "landed-session-"));
  mkdirSync(join(project, "memory"));
  writeFileSync(join(project, "memory", "by-a-script.md"), "a line\n");
  const run = callHook(
    HOOK,
    {
      session_id: session,
      tool_name: "Bash",
      tool_input: { command: "node build-notes.mjs" },
      cwd: project,
      transcript_path: join(project, `${session}.jsonl`),
    },
    HOME,
  );
  assert.equal(run.status, 0, run.stderr);
  assert.match(JSON.parse(run.stdout).reason, /by-a-script\.md/u, "nothing in the command names it");
});

test("a file the directory has held for a day is not this call's", () => {
  const session = randomUUID();
  const project = mkdtempSync(join(tmpdir(), "landed-stale-"));
  mkdirSync(join(project, "memory"));
  const old = join(project, "memory", "from-yesterday.md");
  writeFileSync(old, "a line\n");
  utimesSync(old, new Date(Date.now() - 86_400_000), new Date(Date.now() - 86_400_000));
  const run = callHook(
    HOOK,
    {
      session_id: session,
      tool_name: "Bash",
      tool_input: { command: "node build-notes.mjs" },
      cwd: project,
      transcript_path: join(project, `${session}.jsonl`),
    },
    HOME,
  );
  assert.equal(run.stdout.trim(), "", "the sweep asks about what just landed");
});

/* Blocking on the first left the rest unmentioned: a script writing four was answered for one. */
test("every file that landed is named in one refusal", () => {
  const session = randomUUID();
  const project = mkdtempSync(join(tmpdir(), "landed-batch-"));
  mkdirSync(join(project, "memory"));
  for (const name of ["one.md", "two.md", "three.md"]) {
    writeFileSync(join(project, "memory", name), "a line\n");
  }
  const run = callHook(
    HOOK,
    {
      session_id: session,
      tool_name: "Bash",
      tool_input: { command: "node build-notes.mjs" },
      cwd: project,
      transcript_path: join(project, `${session}.jsonl`),
    },
    HOME,
  );
  const said = JSON.parse(run.stdout).reason;
  for (const name of ["one.md", "two.md", "three.md"]) assert.match(said, new RegExp(name.replace(".", "\\."), "u"));
  assert.match(said, /they should/u, "and asked of them together");
});

/* The swept paths are canonical and git's root is not, so a checkout reached through a linked parent
   compared as outside its own repository — and every file in it skipped the tree filter. */
test("a checkout reached through a link is still inside its own repository", () => {
  const session = randomUUID();
  const held = mkdtempSync(join(tmpdir(), "landed-real-"));
  const repo = join(held, "checkout");
  mkdirSync(join(repo, "skills", "deploy"), { recursive: true });
  writeFileSync(join(repo, "skills", "deploy", "SKILL.md"), "the method\n");
  for (const args of [["init", "-q"], ["add", "-A"], ["commit", "-qm", "first"]]) {
    const run = spawnSync("git", ["-C", repo, ...args], {
      encoding: "utf8",
      env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
    });
    assert.equal(run.status, 0, run.stderr);
  }
  const link = join(mkdtempSync(join(tmpdir(), "landed-link-parent-")), "seen-as");
  symlinkSync(repo, link);
  const run = callHook(
    HOOK,
    { session_id: session, tool_name: "Bash", tool_input: { command: "git checkout master" }, cwd: link },
    HOME,
  );
  assert.equal(run.stdout.trim(), "", "the tree says unchanged, and the link is not another repository");
});

/* A guarded directory is the project's, not one session's: two sessions swept the same memory
   directory and both stopped on a file one of them had already been asked about. */
test("a file one session was asked about is not asked again in another", () => {
  const project = mkdtempSync(join(tmpdir(), "landed-two-"));
  mkdirSync(join(project, "memory"));
  const asking = (session) =>
    callHook(
      HOOK,
      {
        session_id: session,
        tool_name: "Bash",
        tool_input: { command: "node build-notes.mjs" },
        cwd: project,
        transcript_path: join(project, `${session}.jsonl`),
      },
      HOME,
    ).stdout.trim();
  writeFileSync(join(project, "memory", "shared.md"), "a line\n");
  assert.ok(asking(randomUUID()), "the first session asks");
  assert.equal(asking(randomUUID()), "", "and the second does not ask again");
});

/* A fresh mtime is not authorship: `git pull` restamps every skill file it carries, and asking the
   agent to justify those is a refusal about somebody else's commit. The tree is asked instead. */
test("a tracked skill file the tree agrees with was not written here", () => {
  const session = randomUUID();
  const repo = mkdtempSync(join(tmpdir(), "landed-repo-"));
  const skill = join(repo, "skills", "deploy");
  mkdirSync(skill, { recursive: true });
  writeFileSync(join(skill, "SKILL.md"), "the method\n");
  for (const args of [["init", "-q"], ["add", "-A"], ["commit", "-qm", "first"]]) {
    const run = spawnSync("git", ["-C", repo, ...args], {
      encoding: "utf8",
      env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
    });
    assert.equal(run.status, 0, run.stderr);
  }
  const pulled = () =>
    callHook(
      HOOK,
      { session_id: session, tool_name: "Bash", tool_input: { command: "git checkout master" }, cwd: repo },
      HOME,
    );
  assert.equal(pulled().stdout.trim(), "", "restamped, and the tree says it is unchanged");
  writeFileSync(join(skill, "SKILL.md"), "the method, rewritten\n");
  assert.match(JSON.parse(pulled().stdout).reason, /SKILL\.md/u, "changed, and nothing asked");
});

test("a file nobody just wrote is somebody else's business", () => {
  assert.equal(landed(randomUUID(), "written-yesterday.md", { old: 86_400_000 }), null);
});

test("a document outside the two guarded kinds is not this gate's", () => {
  const docs = mkdtempSync(join(tmpdir(), "landed-docs-"));
  assert.equal(landed(randomUUID(), "HOOKS.md", { dir: docs }), null);
});

/* The gate stamps the file it asked about, and the two halves are handed two spellings of it: one
   from a tool's `file_path`, one realpathed off the disk. Keyed apart, every write is stopped twice. */
test("a write the gate asked about before it landed is not asked about after", () => {
  const session = randomUUID();
  const gate = new URL("../hooks/learning-gate.mjs", import.meta.url).pathname;
  const via = join(mkdtempSync(join(tmpdir(), "landed-link-")), "memory");
  symlinkSync(room, via);
  const asking = callHook(
    gate,
    { session_id: session, tool_name: "Write", tool_input: { file_path: join(via, "asked-first.md"), content: "a fact" } },
    HOME,
  );
  assert.equal(JSON.parse(asking.stdout).hookSpecificOutput.permissionDecision, "deny", "asked first");
  assert.equal(landed(session, "asked-first.md"), null);
});

/* A link to the file counts as much as a link to its directory: one resolves and the other did not. */
test("a link to the file itself is the same file to both halves", () => {
  const session = randomUUID();
  const gate = new URL("../hooks/learning-gate.mjs", import.meta.url).pathname;
  const elsewhere = join(mkdtempSync(join(tmpdir(), "landed-file-")), "memory");
  mkdirSync(elsewhere);
  writeFileSync(join(room, "by-a-link.md"), "a line\n");
  symlinkSync(join(room, "by-a-link.md"), join(elsewhere, "by-a-link.md"));
  const asking = callHook(
    gate,
    {
      session_id: session,
      tool_name: "Write",
      tool_input: { file_path: join(elsewhere, "by-a-link.md"), content: "a fact" },
    },
    HOME,
  );
  assert.equal(JSON.parse(asking.stdout).hookSpecificOutput.permissionDecision, "deny", "asked first");
  assert.equal(landed(session, "by-a-link.md"), null, "and not asked again through the link");
});
