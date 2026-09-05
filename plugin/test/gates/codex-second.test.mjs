import assert from "node:assert/strict";
import test from "node:test";

import { callHook, tempRoom } from "../fixtures.mjs";
import { commitAim } from "../../hooks/gates/codex-second.mjs";
import { stagedIn } from "../../src/codex/codex-state.mjs";
import { spawnSync } from "node:child_process";
import { mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const HOOK = new URL("../../hooks/entries/codex-second.mjs", import.meta.url).pathname;
const room = tempRoom("codex-second-");
const REPO = join(room, "repo");
mkdirSync(join(REPO, ".git"), { recursive: true });
mkdirSync(join(room, "forge"), { recursive: true });
spawnSync("git", ["init", "-q", REPO]);
test.after(() => rmSync(room, { recursive: true, force: true }));

/* Real clock, because a record's age is printed and a consult's timestamp is read against it. */
const now = Date.now();
const at = (msAgo) => new Date(now - msAgo).toISOString();

let count = 0;
/* No transcript is passed at all: this gate reads none, and a fixture carrying one would hide that. */
const gate = ({ session, env = {}, command, log, pending, pendingIn, stage } = {}) => {
  count += 1;
  writeFileSync(join(room, "forge", "codex-log.jsonl"), log ?? "");
  /* The state file is keyed by the canonical root, as the hook resolves it. */
  writeFileSync(
    join(room, "forge", "codex.json"),
    JSON.stringify({ turns: pending ? { [pendingIn ?? realpathSync(REPO)]: { files: pending, at: now - 90_000 } } : {} }),
  );
  writeFileSync(join(REPO, "work.mjs"), `// ${count}\n`);
  /* A commit is asked for what it stages, so the index is the case's to set and never the last one's. */
  spawnSync("git", ["-C", REPO, "read-tree", "--empty"]);
  if (stage) spawnSync("git", ["-C", REPO, "add", ...stage]);
  const run = callHook(
    HOOK,
    {
      tool_name: command ? "Bash" : "Write",
      tool_input: command ? { command } : { file_path: join(REPO, "next.mjs") },
      session_id: session ?? `s${count}`,
      cwd: REPO,
    },
    { ...process.env, XDG_CONFIG_HOME: room, ...env },
  );
  stderrSaid = run.stderr;
  return run.stdout.trim() ? JSON.parse(run.stdout) : null;
};
const because = (out) => out?.hookSpecificOutput?.permissionDecisionReason ?? "";
let stderrSaid = "";
const ev = (command) => ({ tool_name: "Bash", tool_input: { command } });

/* A commit is in the repository whatever it redirects: judged by the redirect, one to /tmp read as
   work outside the tree and the commit went through. */
test("a commit that redirects its output is still a commit in the tree", () => {
  const out = gate({ command: "git commit -m work >/tmp/commit.log", pending: ["work.mjs"], stage: ["work.mjs"] });
  assert.ok(out, "the redirect is not where the work is");
});

/* The recheck's own findings: one shape is read, so a call making two commits is not one shape, and
   a pathspec list held in a file is not a list this can read. Either asks for the record whole. */
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
  /* Naming nothing is not asking for nothing: with no index to read, the record stands whole. */
  const out = because(gate({ command: "git commit -p", pending: ["work.mjs"] }));
  assert.match(out, /has not read what this commit stages/u, out);
  assert.match(out, /work\.mjs/u, "and what it recorded is what it names");
});

/* Judged by the cwd, `git -C other commit` asked this tree's question about another one's draft:
   refusing for work the commit does not carry, and passing the work it does. */
const away = (dirty) => {
  const repo = tempRoom("codex-second-away-");
  spawnSync("git", ["init", "-q", repo]);
  if (dirty) {
    writeFileSync(join(repo, "work.mjs"), "// a line\n");
    spawnSync("git", ["-C", repo, "add", "work.mjs"]);
  }
  return repo;
};

/* Raised by codex against ISS-70's change: one value kept per option dropped every `-C` hop but the
   last. Each expectation below was probed against git rather than read off its manual, the rank
   ISS-82's chaining lost among them (ISS-100). */

/* Also raised against ISS-70: only the first commit is judged, and the refusal did not admit it. */
test("a call that commits in two trees says which one it judged", () => {
  const other = realpathSync(away(true));
  const record = ["docs/PLAN.md"];
  mkdirSync(join(REPO, "docs"), { recursive: true });
  writeFileSync(join(REPO, "docs", "PLAN.md"), "# PLAN\n");
  const out = because(gate({ command: `git commit -m a && git -C ${other} commit -m b`, pending: record }));
  assert.match(out, new RegExp(`stages in ${realpathSync(REPO)}`, "u"), "the tree it judged");
  assert.match(out, new RegExp(`also commits in ${other}, which went unchecked`, "u"), "and the one it did not");
  const one = because(gate({ command: "git commit -m a && git commit -m b", pending: record }));
  rmSync(join(REPO, "docs"), { recursive: true, force: true });
  assert.doesNotMatch(one, /went unchecked/u, "two commits in one tree leave nothing unjudged");
});

test("a commit is judged by the tree it names, not the shell's", () => {
  const elsewhere = realpathSync(away(true));
  assert.equal(gate({ command: `git -C ${elsewhere} commit -m x`, pending: ["work.mjs"] }), null,
    "the shell's own record is not the commit's to answer for");
  assert.equal(gate({ command: `git -C ${realpathSync(away(false))} commit -m x`, pending: ["work.mjs"] }), null,
    "and a tree staging nothing owes nothing wherever the record is");
  const out = because(gate({ command: `git -C ${elsewhere} commit -m x`, pending: ["work.mjs"], pendingIn: elsewhere }));
  assert.match(out, new RegExp(`stages in ${elsewhere}`, "u"), "the tree the command names is the one judged");
  /* Judged there, it has to be consulted there: the paths listed are that tree's, and so is the log. */
  assert.match(out, new RegExp(`Do this: \`cd ${elsewhere} && echo`, "u"), "the command runs where the commit lands");
  const held = realpathSync(away(true));
  assert.ok(
    gate({ command: `git --git-dir=${join(held, ".git")} commit -m x`, pending: ["work.mjs"], pendingIn: held }),
    "and the tree holding a git directory is that directory's",
  );
});

/* `repoRoot` of a bare git directory is `null`, and a null root ends the run before any judgement. */
test("a --git-dir naming no tree does not carry the commit out of this gate", () => {
  const meta = tempRoom("codex-second-meta-");
  const elsewhere = realpathSync(away(true));
  const out = because(gate({
    command: `git -C ${elsewhere} --git-dir ${join(meta, "repo.git")} commit -m x`,
    pending: ["work.mjs"],
    pendingIn: elsewhere,
  }));
  assert.match(out, /has not read what this commit stages/u, out);
  assert.match(out, new RegExp(`cd ${elsewhere} && echo`, "u"), "and it is consulted in the tree -C named");
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
  const out = because(gate({ command, pending: record, stage: staged }));
  assert.match(out, /has not read what this commit stages in .*docs\/PLAN\.md 'docs\/a b\.md', recorded 2 minute\(s\) ago/u);
  assert.doesNotMatch(out, /LATER/u, "an uncommitted file nobody staged is not this commit's to review");
  assert.match(out, new RegExp(`stages in ${realpathSync(REPO)}`, "u"), "the tree whose record is being asked about");
  assert.match(out, /forge codex consult --diff --only blocker,major docs\/PLAN\.md 'docs\/a b\.md'/u);
  assert.match(out, /pending --drop/u);
  assert.equal(gate({ pending: record, stage: staged }), null, "a write is asked nothing at all");
  assert.equal(gate({ command, pending: record }), null, "and a commit staging none of them is held for none");
  /* A pathspec commits tracked worktree content, which this fixture's tree has none of: the demand
     for one is `stagedIn`'s case, and the parse is `commitAim`'s. */
  assert.equal(gate({ command, pending: record, stage: staged, env: { FORGE_CODEX_DISABLE: "1" } }), null);
});

/* Reported: `FORGE_CODEX_DISABLE=1 git commit` was refused identically, because a hook is its own
   process and reads the session's environment. The switch that works from inside a turn was in no
   refusal, so for that reader the message named no way out at all. */
test("every refusal names the switch a session can reach, and what an inline prefix does not do", () => {
  const record = ["docs/PLAN.md"];
  writeFileSync(join(REPO, "docs", "PLAN.md"), "# PLAN\n");
  const found = { kind: "consult", id: "c9", at: at(300_000), root: realpathSync(REPO), ok: true, files: ["a.mjs"], reply: "- **F1 — New — major:** `a.mjs:1` — x." };
  const said = [
    because(gate({ command: "git commit -m x", pending: record, stage: record })),
    because(gate({ command: "git commit -m x", log: `${JSON.stringify(found)}\n` })),
    because(gate({ command: "cd - && git commit -m x" })),
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
  const main = realpathSync(tempRoom("codex-second-main-"));
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
  const home = tempRoom("codex-second-main-home-");
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "codex-log.jsonl"), "");
  const asked = (root) => {
    writeFileSync(join(home, "forge", "codex.json"), JSON.stringify({ turns: { [root]: { files: ["docs/A.md"], at: now - 120_000 } } }));
    const out = callHook(
      HOOK,
      { tool_name: "Bash", tool_input: { command: `cd ${worktree} && git commit -m x` }, session_id: `wt-${root}-${now}`, cwd: main },
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
  const out = because(gate({ command, log: lines(found, quiet) }));
  assert.match(out, /Consult c9 made F1, F2 on a\.mjs; nothing says what became of F1, F2/u);
  const half = because(gate({ command, log: lines(found, quiet, { kind: "verdict", of: "c9", accepted: 1, rejected: 0, kept: ["F1"], dropped: {}, from: "r1" }) }));
  assert.match(half, /what became of F2\./u, "a recheck that closed F1 leaves F2 to decide");
  assert.match(out, /forge codex verdict --of c9 --accepted/u);
  assert.equal(gate({ command, log: lines(found, quiet, { kind: "verdict", of: "c9", accepted: 1, rejected: 1, kept: ["F1"], dropped: { F2: "no" } }) }), null, "ruled on, it lands");
  assert.equal(gate({ command, log: lines({ ...found, root: "/elsewhere" }) }), null, "another tree's consult is not this one's");
  assert.equal(gate({ log: lines(found) }), null, "a write is not asked");
});

test("a commit in a tree the command does not name is refused, and the refusal says the reading failed", () => {
  const out = because(gate({ command: "cd - && git commit -m x" }));
  assert.match(out, /cannot be read from the command/u, "the event's cwd owes nothing, and it is not what was asked");
  assert.match(out, /cd <path> && git commit/u, "one form that spells the tree out");
  assert.match(out, /git -C <path> commit/u, "and the other");
  assert.match(out, /forge hooks --off codex-second/u, "with the switch a refused session can reach");
  const owed = because(gate({ command: "cd - && git commit -m x", pending: ["work.mjs"], stage: ["work.mjs"] }));
  assert.match(owed, /cannot be read from the command/u);
  assert.doesNotMatch(owed, /work\.mjs/u, "a list recorded in the event's cwd is not this commit's to demand");
});

test("a second commit whose tree cannot be named went unchecked, and the sentinel reached no resolve", () => {
  const out = because(gate({
    command: "git commit -m a && cd - && git commit -m b",
    pending: ["work.mjs"],
    stage: ["work.mjs"],
  }));
  assert.match(out, new RegExp(`stages in ${realpathSync(REPO)}`, "u"), "the first commit names its tree and is judged there");
  assert.match(out, /also commits in a tree it does not name, which went unchecked/u);
  assert.equal(stderrSaid.trim(), "", "a symbol in a path argument throws, and a thrown gate is a skipped gate");
});
