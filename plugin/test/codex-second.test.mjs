import assert from "node:assert/strict";
import test from "node:test";

import { callHook } from "./fixtures.mjs";
import { committing } from "../hooks/_hook.mjs";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOOK = new URL("../hooks/codex-second.mjs", import.meta.url).pathname;
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
const gate = (records, { consultAt, clean, staleBy, session, env = {}, writes, command } = {}) => {
  count += 1;
  const path = join(room, `t${count}.jsonl`);
  writeFileSync(path, `${records.map((one) => JSON.stringify(one)).join("\n")}\n`);
  writeFileSync(
    join(room, "forge", "codex-log.jsonl"),
    consultAt
      ? `${JSON.stringify({ kind: "consult", at: consultAt, root: REPO, ok: true, reply: "CODEX: 0 findings" })}\n`
      : "",
  );
  /* Dirt is what makes a review possible, so the fixture's tree is dirty unless a case says not. */
  if (clean) rmSync(join(REPO, "work.mjs"), { force: true });
  else writeFileSync(join(REPO, "work.mjs"), `// ${count}\n`);
  /* Work that predates the consult has been read already, whatever the tree still shows. */
  if (staleBy) utimesSync(join(REPO, "work.mjs"), new Date(now - staleBy), new Date(now - staleBy));
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
  const out = gate(spent, { consultAt: at(120_000), command: "git commit -m 'the work'" });
  assert.ok(out, "the commit is not");
  assert.match(because(out), /this commit is where the turn stops being a draft/u);
});

test("a commit the consult already covered lands, and so does one with nothing behind it", () => {
  const records = [userTurn(), advised()];
  const command = "git commit -m 'the work'";
  assert.equal(gate(records, { consultAt: at(120_000), staleBy: 300_000, command }), null, "read already");
  assert.equal(gate(records, { clean: true, command }), null, "and nothing to read");
});

/* Command position, and git's globals take arguments: `--git-dir /r/.git commit` is one. */
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
  const out = gate(records, { consultAt: at(120_000), command: "git commit -m work >/tmp/commit.log" });
  assert.ok(out, "the redirect is not where the work is");
});

/* Judged by the cwd, `git -C other commit` asked this tree's question about another one's draft:
   refusing for work the commit does not carry, and passing the work it does. */
const away = (dirty) => {
  const repo = mkdtempSync(join(tmpdir(), "codex-second-away-"));
  spawnSync("git", ["init", "-q", repo]);
  if (dirty) writeFileSync(join(repo, "work.mjs"), "// a line\n");
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
