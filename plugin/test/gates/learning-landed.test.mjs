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

import { callHook, homeEnv } from "../fixtures.mjs";

const HOOK = new URL("../../hooks/entries/learning-landed.mjs", import.meta.url).pathname;
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

const committed = (repo, what) => {
  for (const args of [["init", "-q"], ["add", what], ["commit", "-qm", "first"]]) {
    const run = spawnSync("git", ["-C", repo, ...args], {
      encoding: "utf8",
      env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
    });
    assert.equal(run.status, 0, run.stderr);
  }
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

/* The other direction, and the only case where no name the call used is guarded: the file is not there
   yet, so the disk cannot follow it, and only its directory settling inside the tree says what it is. */
test("a new file named through a directory link into the tree is a guarded write", () => {
  const project = mkdtempSync(join(tmpdir(), "landed-linked-dir-"));
  mkdirSync(join(project, "real", "memory"), { recursive: true });
  symlinkSync(join(project, "real", "memory"), join(project, "notes"));
  const run = callHook(
    HOOK,
    {
      session_id: randomUUID(),
      tool_name: "Write",
      tool_input: { file_path: join(project, "notes", "through-a-link.md") },
      cwd: project,
    },
    HOME,
  );
  assert.equal(run.status, 0, run.stderr);
  assert.match(JSON.parse(run.stdout).reason, /through-a-link\.md/u);
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
  committed(repo, "-A");
  const link = join(mkdtempSync(join(tmpdir(), "landed-link-parent-")), "seen-as");
  symlinkSync(repo, link);
  const run = callHook(
    HOOK,
    { session_id: session, tool_name: "Bash", tool_input: { command: "git checkout master" }, cwd: link },
    HOME,
  );
  assert.equal(run.stdout.trim(), "", "the tree says unchanged, and the link is not another repository");
});

/* A link is not a file to a directory listing, so a guarded name pointing out of the tree was swept
   past — the last spelling of the route where nothing names the file. */
test("a guarded name that links out of the tree is swept as itself", () => {
  const session = randomUUID();
  const project = mkdtempSync(join(tmpdir(), "landed-swept-link-"));
  mkdirSync(join(project, "memory"));
  const outside = join(mkdtempSync(join(tmpdir(), "landed-swept-target-")), "kept.md");
  writeFileSync(outside, "a line\n");
  symlinkSync(outside, join(project, "memory", "points-out.md"));
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
  assert.match(JSON.parse(run.stdout).reason, /points-out\.md/u, "named by the guarded name");
});

/* The gate stamps what the name resolves to, and the sweep answers with the name: keyed apart, a file
   the gate asked about before the write is asked about again after it. */
test("a swept link the gate already asked about is not asked again", () => {
  const session = randomUUID();
  const gate = new URL("../../hooks/entries/learning-gate.mjs", import.meta.url).pathname;
  const project = mkdtempSync(join(tmpdir(), "landed-swept-asked-"));
  mkdirSync(join(project, "memory"));
  const outside = join(mkdtempSync(join(tmpdir(), "landed-swept-real-")), "kept.md");
  writeFileSync(outside, "a line\n");
  const link = join(project, "memory", "asked-then-swept.md");
  symlinkSync(outside, link);
  const asking = callHook(gate, { session_id: session, tool_name: "Write", tool_input: { file_path: link, content: "a fact" } }, HOME);
  assert.equal(JSON.parse(asking.stdout).hookSpecificOutput.permissionDecision, "deny", "asked first");
  writeFileSync(outside, "the fact, written\n");
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
  assert.equal(run.stdout.trim(), "", "and not asked again by the half that sweeps");
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

/* A skill directory git has never seen is where a new skill lands, so the tracked list alone cannot
   find it: the whole point is the file nobody committed yet. */
test("a skill directory the tree has never tracked is swept too", () => {
  const session = randomUUID();
  const repo = mkdtempSync(join(tmpdir(), "landed-untracked-"));
  mkdirSync(join(repo, "skills", "brand-new"), { recursive: true });
  writeFileSync(join(repo, "README.md"), "a tree\n");
  committed(repo, "README.md");
  writeFileSync(join(repo, "skills", "brand-new", "SKILL.md"), "the method\n");
  const run = callHook(
    HOOK,
    { session_id: session, tool_name: "Bash", tool_input: { command: "node make-skill.mjs" }, cwd: repo },
    HOME,
  );
  assert.match(JSON.parse(run.stdout).reason, /SKILL\.md/u, "nothing named it and nothing tracked it");
});

/* A fresh mtime is not authorship: `git pull` restamps every skill file it carries, and asking the
   agent to justify those is a refusal about somebody else's commit. The tree is asked instead. */
test("a tracked skill file the tree agrees with was not written here", () => {
  const session = randomUUID();
  const repo = mkdtempSync(join(tmpdir(), "landed-repo-"));
  const skill = join(repo, "skills", "deploy");
  mkdirSync(skill, { recursive: true });
  writeFileSync(join(skill, "SKILL.md"), "the method\n");
  committed(repo, "-A");
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
  const gate = new URL("../../hooks/entries/learning-gate.mjs", import.meta.url).pathname;
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
  const gate = new URL("../../hooks/entries/learning-gate.mjs", import.meta.url).pathname;
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

/* Git answers about the file, never about the name: a tracked link is unchanged whatever its target
   does, so a guarded file written through one was swept up and then dropped as somebody else's. */
test("a tracked link is judged by what it points at, not by its own name", () => {
  const repo = mkdtempSync(join(tmpdir(), "landed-linked-"));
  const skill = join(repo, "skills", "deploy");
  mkdirSync(skill, { recursive: true });
  const target = join(mkdtempSync(join(tmpdir(), "landed-target-")), "kept.md");
  writeFileSync(target, "the method\n");
  symlinkSync(target, join(skill, "SKILL.md"));
  committed(repo, "-A");
  writeFileSync(target, "the method, rewritten\n");
  const run = callHook(
    HOOK,
    { session_id: randomUUID(), tool_name: "Bash", tool_input: { command: "node make-skill.mjs" }, cwd: repo },
    HOME,
  );
  assert.match(JSON.parse(run.stdout).reason, /SKILL\.md/u, "the link is clean; the write is not");
});
