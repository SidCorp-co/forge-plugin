import assert from "node:assert/strict";
import test from "node:test";

import { callHook } from "../fixtures.mjs";
import { committing } from "../../hooks/_hook.mjs";
import { commitAim } from "../../hooks/gates/codex-second.mjs";
import { stagedIn } from "../../src/codex/codex-state.mjs";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOOK = new URL("../../hooks/entries/codex-second.mjs", import.meta.url).pathname;
const room = mkdtempSync(join(tmpdir(), "codex-second-"));
const REPO = join(room, "repo");
mkdirSync(join(REPO, ".git"), { recursive: true });
mkdirSync(join(room, "forge"), { recursive: true });
spawnSync("git", ["init", "-q", REPO]);
test.after(() => rmSync(room, { recursive: true, force: true }));

/* Real clock, because the gate compares a consult's timestamp against a file's mtime. */
const now = Date.now();
const at = (msAgo) => new Date(now - msAgo).toISOString();
const userTurn = () => ({
  type: "user",
  promptSource: "typed",
  timestamp: at(600_000),
  message: { content: [{ type: "text", text: "go" }] },
});
const advised = (msAgo = 1000) => ({
  type: "assistant",
  timestamp: at(msAgo),
  message: { content: [{ type: "advisor_tool_result", content: {} }] },
});

let count = 0;
const gate = (records, { consultAt, clean, staleBy, session, env = {}, writes, command, log, pending, stage } = {}) => {
  count += 1;
  const path = join(room, `t${count}.jsonl`);
  writeFileSync(path, `${records.map((one) => JSON.stringify(one)).join("\n")}\n`);
  writeFileSync(
    join(room, "forge", "codex-log.jsonl"),
    log ?? (consultAt
      ? `${JSON.stringify({ kind: "consult", at: consultAt, root: REPO, ok: true, reply: "CODEX: 0 findings" })}\n`
      : ""),
  );
  /* The state file is keyed by the canonical root, as the hook resolves it. */
  writeFileSync(
    join(room, "forge", "codex.json"),
    JSON.stringify({ turns: pending ? { [realpathSync(REPO)]: { files: pending, at: now - 90_000 } } : {} }),
  );
  /* Dirt is what makes a review possible, so the fixture's tree is dirty unless a case says not. */
  if (clean) rmSync(join(REPO, "work.mjs"), { force: true });
  else writeFileSync(join(REPO, "work.mjs"), `// ${count}\n`);
  /* Work that predates the consult has been read already, whatever the tree still shows. */
  if (staleBy) utimesSync(join(REPO, "work.mjs"), new Date(now - staleBy), new Date(now - staleBy));
  /* A commit is asked for what it stages, so the index is the case's to set and never the last one's. */
  spawnSync("git", ["-C", REPO, "read-tree", "--empty"]);
  if (stage) spawnSync("git", ["-C", REPO, "add", ...stage]);
  const run = callHook(
    HOOK,
    {
      tool_name: command ? "Bash" : "Write",
      tool_input: command ? { command } : { file_path: writes ?? join(REPO, "next.mjs") },
      transcript_path: path,
      session_id: session ?? `s${count}`,
      cwd: REPO,
    },
    { ...process.env, XDG_CONFIG_HOME: room, ...env },
  );
  return run.stdout.trim() ? JSON.parse(run.stdout) : null;
};
const because = (out) => out?.hookSpecificOutput?.permissionDecisionReason ?? "";

/* It demanded a review of the sid-growth tree because a memory file under ~/.claude was written:
   the root comes from the session's cwd, and nothing asked where the write was going. */
test("a write outside the tree is not something codex could review", () => {
  const outside = join(room, "elsewhere", "a-fact.md");
  assert.equal(gate([userTurn(), advised()], { writes: outside }), null);
  assert.ok(gate([userTurn(), advised()]), "a write inside it still stops");
});

/* An assignment reaches the commands after its own, and the shell handed a `-c` body is one of them.
   Read without unwrapping that body first, `$M` stays a word and a write anywhere looks in-tree. */
test("a write outside the tree through a shell body is outside it too", () => {
  const outside = join(room, "elsewhere");
  const command = `env M=${outside} sh -c 'echo fact > $M/a-fact.md'`;
  assert.equal(gate([userTurn(), advised()], { command }), null);
  assert.ok(
    gate([userTurn(), advised()], { command: `env M=${REPO} sh -c 'echo fact > $M/a-fact.md'` }),
    "and the same shape inside it still stops",
  );
});

/* One command writing both places is work in the tree whatever else it does, so any target inside is
   enough. Every target having to be inside would stand the gate down on a stray log line. */
test("a body writing outside the tree as well as inside is still work in it", () => {
  const command = `sh -c 'echo fact > ${join(room, "elsewhere", "a-fact.md")}; echo done > ${join(REPO, "work.md")}'`;
  assert.ok(gate([userTurn(), advised()], { command }));
});

/* The failure this exists for: the advisor ran, the turn wrote and committed, and the consult that
   was supposed to follow never did — the end-of-turn reminder is context, and it was ignored. */
test("advice with work in the tree and no consult behind it stops the next write", () => {
  const out = gate([userTurn(), advised()]);
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(because(out), /forge codex consult/);
  assert.match(because(out), /FORGE_CODEX_DISABLE=1/);
});

test("one consult clears the rest of the turn", () => {
  assert.equal(gate([userTurn(), advised(60_000)], { consultAt: at(0) }), null);
  assert.ok(gate([userTurn(), advised()], { consultAt: at(300_000) }), "an older one does not");
});

/* Codex found the rule this changes: the gate now makes one decision per advisor call rather than
   one per write, deliberately — deciding again mid-build refuses the second write and reviews a
   fragment. So a stand-down is remembered and a refusal is not. */
test("work the last consult already covered is not asked for again", () => {
  assert.equal(
    gate([userTurn(), advised()], { consultAt: at(120_000), staleBy: 300_000 }),
    null,
    "dirt older than the consult was in it",
  );
});

/* The sid-erp session of 2026-09-01: the advisor spoke, the first write found a tree just checked out
   clean, and remembering that stand-down silenced the three writes after it. Advice comes first. */
test("a stand-down on a tree with nothing in it does not silence the writes after it", () => {
  const session = `stamp-${process.pid}-${now}`;
  const advice = advised();
  assert.equal(
    gate([userTurn(), advice], { consultAt: at(120_000), staleBy: 300_000, session }),
    null,
    "nothing newer than the consult, so nothing to read",
  );
  assert.ok(
    gate([userTurn(), advice], { consultAt: at(120_000), session }),
    "the write it allowed put work in the tree, and the question is put again",
  );
  assert.ok(
    gate([userTurn(), advice], { consultAt: at(120_000), session }),
    "and again, because a refusal leaves no stamp",
  );
});

/* A consult clears the turn's writes, and the work written after it is unread when the commit lands. */
test("a commit is asked about even after the advice is spent", () => {
  const spent = [userTurn(), advised(300_000)];
  assert.equal(gate(spent, { consultAt: at(120_000) }), null, "the write is cleared");
  const out = gate(spent, { consultAt: at(120_000), command: "git commit -m 'the work'", stage: ["work.mjs"] });
  assert.ok(out, "the commit is not");
  assert.match(because(out), /this commit is where the turn stops being a draft/u);
});

test("a commit the consult already covered lands, and so does one with nothing behind it", () => {
  const records = [userTurn(), advised()];
  const command = "git commit -m 'the work'";
  assert.equal(gate(records, { consultAt: at(120_000), staleBy: 300_000, command, stage: ["work.mjs"] }), null, "read already");
  assert.equal(gate(records, { clean: true, command }), null, "and nothing to read");
});

/* Command position, and git's globals take arguments: `--git-dir /r/.git commit` is one. */
const ev = (command) => ({ tool_name: "Bash", tool_input: { command } });
test("a commit behind a quoted global with a space is a commit in that tree", () => {
  assert.equal(committing(ev(`git -C "/tmp/a b" commit -m x`)), true);
  assert.equal(committing(ev(`git --no-pager -C '/tmp/a b' commit -m x`)), true);
  assert.equal(commitAim(ev(`git -C "/tmp/a b" commit -m x`)).tree, "/tmp/a b");
  assert.equal(commitAim(ev("git --work-tree /w --git-dir /m/repo.git commit -m x")).tree, "/w", "the work tree, not the last option");
  assert.equal(commitAim(ev("git --git-dir /w/.git commit -m x")).tree, "/w");
});

/* An agent whose shell resets its cwd commits into a worktree by moving there first, and a move the
   commit never inherited — a subshell's, or one made after it — is not the tree it closes in. */
test("the tree a commit closes in is the last move it inherited", () => {
  assert.equal(commitAim(ev("cd /w && git commit -m x")).tree, "/w");
  assert.equal(commitAim(ev("cd /w; git commit -m x")).tree, "/w");
  assert.equal(commitAim(ev("cd /a && cd b && git commit -m x")).tree, "/a/b", "two relative moves compose");
  assert.equal(commitAim(ev("(cd /a && true); git commit -m x")).tree, null, "a subshell's move dies with it");
  /* The walk stops before the commit's own span, so a commit inside the subshell keeps the move. */
  assert.equal(commitAim(ev("(cd /a && git commit -m x)")).tree, "/a", "a commit inside it does not");
  assert.equal(commitAim(ev("(cd /a; git commit -m x)")).tree, "/a");
  assert.equal(commitAim(ev("(cd /a && git commit -m x) && echo done")).tree, "/a");
  assert.equal(commitAim(ev("cd /a && (git commit -m x)")).tree, "/a");
  assert.equal(commitAim(ev("git commit -m x && cd /a")).tree, null, "and one after it moves nothing");
  assert.equal(commitAim(ev("cd /a && git -C /b commit -m x")).tree, "/b", "the tree it names wins over the move");
});

/* Codex's F1 and F2: a pathspec needs no `--`, a pipeline's flags are not the commit's, and a value
   a short flag ate is neither — `-ma` is a message, `-uall` is untracked-files, and `-am` is both. */
test("what a commit closes over is read from its own flags", () => {
  const aim = (command) => commitAim(ev(command));
  assert.equal(aim("git commit -am x").all, true);
  assert.equal(aim("git commit --all").all, true);
  assert.equal(aim("git commit -ma").all, false, "a message whose text is `a`");
  assert.equal(aim("git commit -uall -m x").all, false, "untracked-files, not all");
  assert.equal(aim("git commit -m x | tee -a log").all, false, "the pipeline's flag is not the commit's");
  assert.deepEqual(aim("git commit -m x docs/A.md").paths, ["docs/A.md"], "a pathspec without --");
  assert.deepEqual(aim("git commit -m x -- docs/A.md 'docs/a b.md'").paths, ["docs/A.md", "docs/a b.md"]);
  assert.deepEqual(aim("git commit -o docs/A.md -m x").paths, ["docs/A.md"], "-o takes no value");
  assert.deepEqual(aim("git commit -am x").paths, [], "the message is not a path");
  assert.deepEqual(aim("git commit -m work >/tmp/commit.log").paths, [], "and neither is a redirect's target");
  assert.deepEqual(aim("git commit --author='a b' -m x").paths, [], "a long flag's attached value");
  assert.deepEqual(aim("git commit --author 'a b' -m x").paths, [], "and its detached one");
  assert.deepEqual(aim(String.raw`git commit -m x docs/a\ b.md`).paths, ["docs/a b.md"], "an escaped space is inside a word");
  assert.equal(commitAim(ev(String.raw`cd /tmp/a\ b && git commit -m x`)).tree, "/tmp/a b", "and inside a moved-to path");
});

/* The recheck's own findings: one shape is read, so a call making two commits is not one shape, and
   a pathspec list inside a file is not a list this can read. Either asks for the record whole. */
test("a commit shape this cannot enumerate asks for the record whole", () => {
  assert.equal(commitAim(ev("git commit -m first && git commit -am second")).unknown, true);
  assert.equal(commitAim(ev("git commit --pathspec-from-file=list -m x")).unknown, true);
  assert.equal(commitAim(ev("git commit --patch -m x")).unknown, true, "what --patch picks is picked after this answers");
  assert.equal(commitAim(ev("git commit -p -m x")).unknown, true);
  assert.equal(commitAim(ev("git commit -i docs/A.md -m x")).unknown, false, "-i is --include, and the index is read anyway");
  assert.equal(commitAim(ev("git commit -m x")).unknown, false);
  assert.equal(stagedIn("/nowhere", { unknown: true }), null);
  assert.equal(commitAim(ev("cd /a && git -C child commit -m x")).tree, "/a/child", "a relative -C is from where the shell stands");
  assert.equal(commitAim(ev("cd /a && git -C /b commit -m x")).tree, "/b", "and an absolute one is not");
  /* Naming nothing is not asking for nothing: what `--patch` picks is judged as the whole tree was. */
  const out = because(gate([userTurn(), advised()], { command: "git commit -p", stage: ["work.mjs"] }));
  assert.match(out, /codex has not read what this commit stages/u, out);
  assert.match(out, /work\.mjs/u, "and the tree's own files are what it names");
});

test("a commit is a commit where a command starts, git's globals in between", () => {
  const ask = (command) => committing({ tool_name: "Bash", tool_input: { command } });
  for (const one of ["git commit -m x", "git -C /r commit", "git -c k=v commit", "git --no-pager commit",
    "git --git-dir /r/.git commit", "git --work-tree /r commit", "git --git-dir=/r/.git commit",
    'sh -c "git commit -m x"']) assert.ok(ask(one), one);
  for (const one of ["git commit-tree x", "git log --grep commit", 'echo "run git commit" > notes.md']) {
    assert.ok(!ask(one), one);
  }
});

/* A deletion has no mtime of its own, so dropping tracked work and committing it went unasked. What
   held the file changed when it went — and a directory removed whole takes its own mtime with it. */
const dropped = (what, { consultAt } = {}) => {
  const repo = mkdtempSync(join(tmpdir(), "codex-second-deleted-"));
  mkdirSync(join(repo, "nested"), { recursive: true });
  writeFileSync(join(repo, "gone.mjs"), "// a line\n");
  writeFileSync(join(repo, "nested", "gone.mjs"), "// a line\n");
  for (const args of [["init", "-q"], ["add", "-A"], ["commit", "-qm", "first"]]) {
    const run = spawnSync("git", ["-C", repo, ...args], {
      encoding: "utf8",
      env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
    });
    assert.equal(run.status, 0, run.stderr);
  }
  rmSync(join(repo, what), { recursive: true, force: true });
  const home = mkdtempSync(join(tmpdir(), "codex-second-deleted-home-"));
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(
    join(home, "forge", "codex-log.jsonl"),
    consultAt
      ? `${JSON.stringify({ kind: "consult", at: consultAt, root: repo, ok: true, reply: "CODEX: 0 findings" })}\n`
      : "",
  );
  const path = join(home, "deleted.jsonl");
  writeFileSync(path, `${[userTurn(), advised()].map((one) => JSON.stringify(one)).join("\n")}\n`);
  const run = callHook(
    HOOK,
    {
      tool_name: "Bash",
      tool_input: { command: "git commit -am 'drop it'" },
      transcript_path: path,
      session_id: `deleted-${what}-${now}`,
      cwd: repo,
    },
    { ...process.env, XDG_CONFIG_HOME: home },
  );
  return run.stdout.trim() ? JSON.parse(run.stdout) : null;
};

test("deleting tracked work is work in the tree, a whole directory included", () => {
  assert.match(because(dropped("gone.mjs")), /codex has not read/u, "a file");
  assert.match(because(dropped("nested")), /codex has not read/u, "and the directory that held one");
});

/* The fixture codex asked for: with a consult of this repository's own, the deletion's time is read
   against it rather than against nothing. */
test("a deletion the consult already read is not asked about again", () => {
  assert.equal(dropped("gone.mjs", { consultAt: new Date(now + 60_000).toISOString() }), null, "read after it went");
  assert.match(
    because(dropped("gone.mjs", { consultAt: new Date(now - 600_000).toISOString() })),
    /codex has not read/u,
    "and a consult from before it does not cover it",
  );
});

/* A commit is in the repository whatever it redirects: judged by the redirect, one to /tmp read as
   work outside the tree and the commit went through. */
test("a commit that redirects its output is still a commit in the tree", () => {
  const records = [userTurn(), advised(300_000)];
  const out = gate(records, { consultAt: at(120_000), command: "git commit -m work >/tmp/commit.log", stage: ["work.mjs"] });
  assert.ok(out, "the redirect is not where the work is");
});

/* Judged by the cwd, `git -C other commit` asked this tree's question about another one's draft:
   refusing for work the commit does not carry, and passing the work it does. */
const away = (dirty) => {
  const repo = mkdtempSync(join(tmpdir(), "codex-second-away-"));
  spawnSync("git", ["init", "-q", repo]);
  if (dirty) {
    writeFileSync(join(repo, "work.mjs"), "// a line\n");
    spawnSync("git", ["-C", repo, "add", "work.mjs"]);
  }
  return repo;
};

/* Reported: told only to consult, the agent guessed at the files and sent codex the wrong command
   twice before the right one. The refusal carries what it already knows from `git status`. */
test("the refusal names the files it wants read", () => {
  writeFileSync(join(REPO, "my note.mjs"), "// a line\n");
  const out = because(gate([userTurn(), advised()]));
  rmSync(join(REPO, "my note.mjs"), { force: true });
  assert.match(out, /--only blocker,major [^`]*work\.mjs/u, "the changed file, in the command to send");
  assert.match(out, /'my note\.mjs'/u, "and a path with a space survives being copied");
});

/* `-z` gives a rename two fields, and reading the second as a record put a truncated old name in
   the command to send. Staged is `R ` in the first column, unstaged `?R` in the second. */
test("a renamed file is named once, by where it went", () => {
  const repo = mkdtempSync(join(tmpdir(), "codex-second-moved-"));
  const git = (...args) => {
    const run = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
    assert.equal(run.status, 0, run.stderr);
  };
  writeFileSync(join(repo, "was.mjs"), "// a line worth detecting as a rename\n");
  git("init", "-q", ".");
  git("add", "-A");
  git("commit", "-qm", "first");
  git("mv", "was.mjs", "now.mjs");
  const home = mkdtempSync(join(tmpdir(), "codex-second-moved-home-"));
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "codex-log.jsonl"), "");
  const path = join(home, "moved.jsonl");
  writeFileSync(path, `${[userTurn(), advised()].map((one) => JSON.stringify(one)).join("\n")}\n`);
  const run = callHook(
    HOOK,
    { tool_name: "Bash", tool_input: { command: "git commit -m moved" }, transcript_path: path, session_id: `moved-${now}`, cwd: repo },
    { ...process.env, XDG_CONFIG_HOME: home },
  );
  const out = because(run.stdout.trim() ? JSON.parse(run.stdout) : null);
  /* Exactly the one file: read as a record, the old name's field arrives as the tail of itself. */
  assert.equal(/blocker,major ([^`]*)`/u.exec(out)?.[1]?.trim(), "now.mjs", out);
});

/* `?? dir/` is one entry, and the consult dies on a directory exactly as it did on `-h` — the
   suggested command failed, which is the guessing the file list exists to stop. */
test("an untracked directory is named by its files", () => {
  const repo = mkdtempSync(join(tmpdir(), "codex-second-fresh-"));
  spawnSync("git", ["init", "-q", repo]);
  mkdirSync(join(repo, "fresh"), { recursive: true });
  writeFileSync(join(repo, "fresh", "one.mjs"), "// a line\n");
  const home = mkdtempSync(join(tmpdir(), "codex-second-fresh-home-"));
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "codex-log.jsonl"), "");
  const path = join(home, "fresh.jsonl");
  writeFileSync(path, `${[userTurn(), advised()].map((one) => JSON.stringify(one)).join("\n")}\n`);
  const run = callHook(
    HOOK,
    { tool_name: "Write", tool_input: { file_path: join(repo, "next.mjs") }, transcript_path: path, session_id: `fresh-${now}`, cwd: repo },
    { ...process.env, XDG_CONFIG_HOME: home },
  );
  /* Codex's case: `-uall` does not walk into an embedded repository, so one still arrives as `held/`. */
  spawnSync("git", ["init", "-q", join(repo, "held")]);
  writeFileSync(join(repo, "held", "own.mjs"), "// a line\n");
  const out = because(run.stdout.trim() ? JSON.parse(run.stdout) : null);
  assert.equal(/blocker,major ([^`]*)`/u.exec(out)?.[1]?.trim(), "fresh/one.mjs", out);
  const second = callHook(
    HOOK,
    { tool_name: "Write", tool_input: { file_path: join(repo, "after.mjs") }, transcript_path: path, session_id: `held-${now}`, cwd: repo },
    { ...process.env, XDG_CONFIG_HOME: home },
  );
  const held = because(second.stdout.trim() ? JSON.parse(second.stdout) : null);
  assert.equal(/blocker,major ([^`]*)`/u.exec(held)?.[1]?.trim(), "fresh/one.mjs", held);
  /* A diff of this tree covers none of it, so the ordinary files are not the whole instruction. */
  assert.match(held, /held\/ holds changes of its own/u, "and the held tree is named alongside them");
  /* With nothing else in the tree there is no file to name, and an empty command is not an action. */
  rmSync(join(repo, "fresh"), { recursive: true, force: true });
  const alone = callHook(
    HOOK,
    { tool_name: "Write", tool_input: { file_path: join(repo, "last.mjs") }, transcript_path: path, session_id: `alone-${now}`, cwd: repo },
    { ...process.env, XDG_CONFIG_HOME: home },
  );
  assert.match(
    because(alone.stdout.trim() ? JSON.parse(alone.stdout) : null),
    /work is inside held\/, a repository of its own/u,
    "it still refuses, and says where the work is",
  );
});

/* Raised by codex against ISS-70's change: one value kept per option dropped every `-C` hop but the
   last. Each expectation below was probed against git rather than read off its manual. */
test("a repeated -C composes, and the other two options are read from where it left", () => {
  assert.equal(commitAim(ev("git -C /a -C b commit -m x")).tree, "/a/b");
  assert.equal(commitAim(ev("git -C /a -C /b commit -m x")).tree, "/b", "an absolute hop replaces what preceded it");
  assert.equal(commitAim(ev("cd /p && git -C a -C b commit -m x")).tree, "/p/a/b", "a relative chain is still the shell's to place");
  assert.equal(commitAim(ev("git -C /a --work-tree=w commit -m x")).tree, "/a/w");
  assert.equal(commitAim(ev("git -C /a --git-dir=.git commit -m x")).tree, "/a");
  assert.equal(commitAim(ev("git --work-tree /w --git-dir /m/repo.git commit -m x")).tree, "/w", "and the ranking survives");
});

/* Also raised against ISS-70: only the first commit is judged, and the refusal did not admit it. */
test("a call that commits in two trees says which one it judged", () => {
  const other = realpathSync(away(true));
  const record = ["docs/PLAN.md"];
  mkdirSync(join(REPO, "docs"), { recursive: true });
  writeFileSync(join(REPO, "docs", "PLAN.md"), "# PLAN\n");
  const out = because(gate([userTurn()], { command: `git commit -m a && git -C ${other} commit -m b`, pending: record }));
  assert.match(out, new RegExp(`stages in ${realpathSync(REPO)}`, "u"), "the tree it judged");
  assert.match(out, new RegExp(`also commits in ${other}, which went unchecked`, "u"), "and the one it did not");
  const one = because(gate([userTurn()], { command: "git commit -m a && git commit -m b", pending: record }));
  rmSync(join(REPO, "docs"), { recursive: true, force: true });
  assert.doesNotMatch(one, /went unchecked/u, "two commits in one tree leave nothing unjudged");
});

test("a commit is judged by the tree it names, not the shell's", () => {
  const records = [userTurn(), advised()];
  assert.equal(gate(records, { command: `git -C ${away(false)} commit -m x` }), null, "clean elsewhere");
  assert.ok(gate(records, { command: `git -C ${away(true)} commit -m x` }), "a dirty tree there is asked about");
  assert.ok(
    gate(records, { command: `git --git-dir=${join(away(true), ".git")} commit -m x` }),
    "and the tree holding a git directory is that directory's",
  );
  /* Judged there, it has to be consulted there: the paths listed are that tree's, and so is the log. */
  const elsewhere = away(true);
  assert.match(
    because(gate(records, { command: `git -C ${elsewhere} commit -m x` })),
    new RegExp(`Do this: \`cd ${elsewhere} && echo`, "u"),
    "the command runs where the commit lands",
  );
});

/* A shell call is only this gate's business if it writes, and a descriptor sent to `/dev/null` is
   not a file — nothing else in the suite could tell the two apart. */
test("a command that stores nothing is not a write", () => {
  assert.equal(gate([userTurn(), advised()], { command: "npm run check 2>/dev/null | tail -3" }), null);
  assert.ok(gate([userTurn(), advised()], { command: `printf x > ${join(REPO, "out.txt")}` }), "a file is");
  /* Measured in the log: a health check and a second screen armed this gate, because the `/dev/`
     exclusion read redirects and not the verbs that take a target of their own. */
  assert.equal(gate([userTurn(), advised()], { command: "curl -s -o /dev/null -w '%{http_code}' http://x" }), null);
  assert.equal(gate([userTurn(), advised()], { command: "npm test 2>&1 | tee /dev/stderr" }), null);
  assert.ok(gate([userTurn(), advised()], { command: "curl -s -o out.json http://x" }), "aimed at a file, it stores");
  assert.ok(gate([userTurn(), advised()], { command: "curl -o /dev/null http://x; touch a.txt" }), "the verb after it");
});

test("a clean tree has nothing for codex to read", () => {
  assert.equal(gate([userTurn(), advised()], { clean: true }), null);
});

/* With no first opinion there is nothing to be second to, and the system prompt is what asks for
   the advisor call — a hook repeating that ask was removed for charging a refusal to enforce it. */
test("a turn with no advisor call is not this gate's business", () => {
  assert.equal(gate([userTurn()]), null);
});

test("either disable switch stands it down", () => {
  assert.equal(gate([userTurn(), advised()], { env: { FORGE_CODEX_DISABLE: "1" } }), null);
  assert.equal(gate([userTurn(), advised()], { env: { CLAUDE_CODE_DISABLE_ADVISOR_TOOL: "1" } }), null);
});

/* The mailpilot report: 727 dirty paths, so five consults and every finding ruled on did not clear
   the next write, and the paths listed were another session's. A stat each is still what the cap
   exists to avoid, so the walk stays one spawn and only the record is measured. */
test("past the walk's cap the tree is asked about what it recorded, and nothing else", () => {
  mkdirSync(join(REPO, "many"), { recursive: true });
  for (let at = 0; at < 520; at += 1) writeFileSync(join(REPO, "many", `f${at}.txt`), "x\n");
  try {
    for (let at = 0; at < 520; at += 1) utimesSync(join(REPO, "many", `f${at}.txt`), new Date(now - 900_000), new Date(now - 900_000));
    const started = Date.now();
    /* A write, because a commit is judged by what it stages and the walk is the tree's branch. */
    assert.equal(
      gate([userTurn(), advised(60_000)], { consultAt: at(120_000), staleBy: 900_000 }),
      null,
      "nothing recorded here, so there is nothing this session could consult",
    );
    assert.ok(Date.now() - started < 5000, "and it answered well inside the hook's clock");
    const held = because(gate([userTurn(), advised(60_000)], { consultAt: at(120_000), pending: ["work.mjs"] }));
    assert.match(held, /--only blocker,major work\.mjs`/u, "a recorded file newer than the consult is asked for");
    assert.doesNotMatch(held, /many\//u, "and the 519 beside it are not offered as work to read");
    assert.equal(
      gate([userTurn(), advised(60_000)], { consultAt: at(120_000), staleBy: 900_000, pending: ["work.mjs"] }),
      null,
      "one consult of what it named lets the next write through",
    );
  } finally {
    rmSync(join(REPO, "many"), { recursive: true, force: true });
  }
});

/* 7 of 30 commits landed with the turn's documents recorded and unread, in turns the advisor never
   spoke in; then a three-file commit was refused for 726 paths in a shared checkout, 243 of them
   another session's. The commit is where the list is read, and the list is what the commit stages. */
test("a commit waits for the documents it stages, and not for one left dirty beside them", () => {
  const command = "git commit -m 'the work'";
  const record = ["docs/PLAN.md", "docs/a b.md", "docs/LATER.md"];
  mkdirSync(join(REPO, "docs"), { recursive: true });
  for (const one of record) writeFileSync(join(REPO, one), `# ${one}\n`);
  const staged = ["docs/PLAN.md", "docs/a b.md"];
  const out = because(gate([userTurn()], { command, pending: record, stage: staged }));
  assert.match(out, /has not read what this commit stages in .*docs\/PLAN\.md 'docs\/a b\.md', recorded 2 minute\(s\) ago/u);
  assert.doesNotMatch(out, /LATER/u, "an uncommitted file nobody staged is not this commit's to review");
  assert.match(out, new RegExp(`stages in ${realpathSync(REPO)}`, "u"), "the tree whose record is being asked about");
  assert.match(out, /forge codex consult --diff --only blocker,major docs\/PLAN\.md 'docs\/a b\.md'/u);
  assert.match(out, /pending --drop/u);
  assert.equal(gate([userTurn()], { pending: record, stage: staged }), null, "a write is not where the list is read");
  assert.equal(gate([userTurn()], { command, pending: record }), null, "and a commit staging none of them is held for none");
  /* A pathspec commits tracked worktree content, which this fixture's tree has none of: the demand
     for one is `stagedIn`'s case, and the parse is `commitAim`'s. */
  assert.equal(gate([userTurn()], { command, pending: record, stage: staged, env: { FORGE_CODEX_DISABLE: "1" } }), null);
});

/* Reported: `FORGE_CODEX_DISABLE=1 git commit` was refused identically, because a hook is its own
   process and reads the session's environment. The switch that works from inside a turn was in no
   refusal, so for that reader the message named no way out at all. */
test("every refusal names the switch a session can reach, and what an inline prefix does not do", () => {
  const record = ["docs/PLAN.md"];
  writeFileSync(join(REPO, "docs", "PLAN.md"), "# PLAN\n");
  const found = { kind: "consult", id: "c9", at: at(300_000), root: realpathSync(REPO), ok: true, files: ["a.mjs"], reply: "- **F1 — New — major:** `a.mjs:1` — x." };
  const said = [
    because(gate([userTurn(), advised()])),
    because(gate([userTurn()], { command: "git commit -m x", pending: record, stage: record })),
    because(gate([userTurn()], { command: "git commit -m x", log: `${JSON.stringify(found)}\n` })),
  ];
  for (const one of said) {
    assert.match(one, /forge hooks --off codex-second/u, one);
    assert.match(one, /inline `FORGE_CODEX_DISABLE=1` prefix never reaches a hook/u, one);
  }
});

/* Reported while several agents worked one repository from worktrees of it: a commit carrying only
   feedback files was held for documents another agent had recorded elsewhere. A record belongs to a
   tree, and which tree is the commit's to answer. */
test("a document recorded in one tree does not hold a commit in another", () => {
  const main = realpathSync(mkdtempSync(join(tmpdir(), "codex-second-main-")));
  const run = (...args) => {
    const out = spawnSync("git", args, { encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
    assert.equal(out.status, 0, out.stderr);
  };
  mkdirSync(join(main, "docs"), { recursive: true });
  writeFileSync(join(main, "docs", "A.md"), "one\n");
  run("init", "-q", main);
  run("-C", main, "add", "-A");
  run("-C", main, "commit", "-qm", "first");
  const worktree = `${main}-wt`;
  run("-C", main, "worktree", "add", "-q", worktree, "-b", "b1");
  writeFileSync(join(main, "docs", "A.md"), "two\n");
  run("-C", main, "add", "docs/A.md");
  writeFileSync(join(worktree, "docs", "A.md"), "three\n");
  run("-C", worktree, "add", "docs/A.md");
  const home = mkdtempSync(join(tmpdir(), "codex-second-main-home-"));
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "codex-log.jsonl"), "");
  const path = join(home, "worktree.jsonl");
  writeFileSync(path, `${JSON.stringify(userTurn())}\n`);
  const asked = (root) => {
    writeFileSync(join(home, "forge", "codex.json"), JSON.stringify({ turns: { [root]: { files: ["docs/A.md"], at: now - 120_000 } } }));
    const out = callHook(
      HOOK,
      { tool_name: "Bash", tool_input: { command: `cd ${worktree} && git commit -m x` }, transcript_path: path, session_id: `wt-${root}-${now}`, cwd: main },
      { ...process.env, XDG_CONFIG_HOME: home },
    );
    return because(out.stdout.trim() ? JSON.parse(out.stdout) : null);
  };
  assert.equal(asked(main), "", "the main checkout's record is not the worktree commit's to answer for");
  assert.match(asked(worktree), new RegExp(`stages in ${worktree}`, "u"), "and the worktree's own record still holds it");
  rmSync(worktree, { recursive: true, force: true });
  rmSync(main, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

/* 37 consults made findings nobody ruled on. The one the gate asks about is the last that made any. */
test("a commit waits for a verdict on the last consult that made findings", () => {
  const command = "git commit -m 'the work'";
  const root = realpathSync(REPO);
  const found = { kind: "consult", id: "c9", at: at(300_000), root, ok: true, files: ["a.mjs"], reply: "- **F1 — New — major:** `a.mjs:1` — x.\n- **F2 — New — minor:** `a.mjs:2` — y." };
  const quiet = { kind: "consult", id: "c10", at: at(100_000), root, ok: true, files: ["b.mjs"], reply: "CODEX: 0 findings" };
  const lines = (...rows) => `${rows.map((one) => JSON.stringify(one)).join("\n")}\n`;
  const out = because(gate([userTurn()], { command, log: lines(found, quiet) }));
  assert.match(out, /Consult c9 made F1, F2 on a\.mjs; nothing says what became of F1, F2/u);
  const half = because(gate([userTurn()], { command, log: lines(found, quiet, { kind: "verdict", of: "c9", accepted: 1, rejected: 0, kept: ["F1"], dropped: {}, from: "r1" }) }));
  assert.match(half, /what became of F2\./u, "a recheck that closed F1 leaves F2 to decide");
  assert.match(out, /forge codex verdict --of c9 --accepted/u);
  assert.equal(gate([userTurn()], { command, log: lines(found, quiet, { kind: "verdict", of: "c9", accepted: 1, rejected: 1, kept: ["F1"], dropped: { F2: "no" } }) }), null, "ruled on, it lands");
  assert.equal(gate([userTurn()], { command, log: lines({ ...found, root: "/elsewhere" }) }), null, "another tree's consult is not this one's");
  assert.equal(gate([userTurn()], { log: lines(found) }), null, "a write is not asked");
});
