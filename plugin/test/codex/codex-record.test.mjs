/* The hook's half of `codex.mjs`: what a turn records, what it announces per repository, and what
   deciding that costs. Apart from the consult's own surface because neither has to be read for the
   other, and because one file holding both was at the max-lines limit (ISS-616). */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { callHook, tempRoom } from "../fixtures.mjs";

const HOOK = new URL("../../hooks/entries/codex-second.mjs", import.meta.url).pathname;

/* Imported after XDG_CONFIG_HOME moves, so nothing here can touch the caller's own state file. */
const sandbox = tempRoom("forge-codex-record-");
process.env.XDG_CONFIG_HOME = sandbox;
delete process.env.FORGE_CODEX_DISABLE;

const { afterTouch, hookRecord, pendingIn, statePath } = await import("../../src/codex/codex.mjs");
const { digest } = await import("../../src/codex/codex-api.mjs");

/* A `.git` that is a file is what a worktree has, and repoRoot only asks whether it exists. */
const REPO = join(sandbox, "repo");
mkdirSync(join(REPO, "docs"), { recursive: true });
mkdirSync(join(REPO, "src"), { recursive: true });
writeFileSync(join(REPO, ".git"), "gitdir: elsewhere\n");
for (const path of ["docs/PLAN.md", "docs/TWO.md", "src/codex.mjs"]) {
  writeFileSync(join(REPO, path), "x");
}
writeFileSync(join(sandbox, "outside.md"), "under no repository at all");

const state = () => JSON.parse(readFileSync(statePath(), "utf8"));
const clearState = () => rmSync(statePath(), { force: true });

/* `first` and `added` are different questions: the second new file of a turn is recorded but must
   not repeat the instruction the first one carried. */
const touched = (...argv) => {
  const held = afterTouch(...argv);
  assert.equal(typeof held.at, "number", "every answer carries the moment the record now stands at");
  return { files: held.files, added: held.added, first: held.first, cleared: held.cleared };
};

test("only the first file of a turn is announced, and a repeat is neither", () => {
  assert.deepEqual(touched({}, REPO, "docs/A.md"),
    { files: ["docs/A.md"], added: true, first: true, cleared: false });
  const held = { turns: { [REPO]: { files: ["docs/A.md"] } } };
  assert.deepEqual(touched(held, REPO, "docs/B.md"), {
    files: ["docs/A.md", "docs/B.md"],
    added: true,
    first: false,
    cleared: false,
  });
  assert.deepEqual(touched(held, REPO, "docs/A.md"), {
    files: ["docs/A.md"],
    added: false,
    first: false,
    cleared: false,
  });
  assert.deepEqual(touched(held, REPO, "docs/A.md", true), {
    files: [],
    added: false,
    first: false,
    cleared: true,
  }, "a write at the bytes a consult read clears the entry standing for it");
});

/* One state file, many checkouts: keyed by root, or two repositories trade files with each other. */
test("a turn is remembered per repository, not per machine", () => {
  const held = { turns: { "/a": { files: ["docs/A.md"] }, "/b": { files: ["docs/B.md"] } } };
  assert.deepEqual(pendingIn(held, "/a"), ["docs/A.md"]);
  assert.deepEqual(pendingIn(held, "/b"), ["docs/B.md"]);
  assert.deepEqual(pendingIn(held, "/c"), []);
  assert.deepEqual(afterTouch(held, "/a", "docs/B.md").files, ["docs/A.md", "docs/B.md"]);
});

/* The caller decides what a turn is, because only the hook can see one. Told once, a repository is
   not told again until the next turn — and an unanswered list no longer answers for the silence. */
const teller = () => {
  const said = new Set();
  return (turn) => (root) => {
    const key = `${root}\0${turn}`;
    if (said.has(key)) return true;
    said.add(key);
    return false;
  };
};

test("the hook records a document once, and tells a repository once per turn", () => {
  clearState();
  const told = teller();
  const first = hookRecord({}, [join(REPO, "docs", "PLAN.md")], told("t1"));
  assert.match(first, /forge codex consult --diff --only blocker,major/, "the shape codex-second teaches");
  assert.match(first, /docs\/PLAN\.md/);
  assert.ok(first.split("\n").length <= 2 && first.length < 400, `a note, not a page: ${first.length} chars`);
  assert.deepEqual(pendingIn(state(), REPO), ["docs/PLAN.md"]);

  assert.equal(hookRecord({}, [join(REPO, "docs", "PLAN.md")], told("t1")), null, "recorded already");
  assert.equal(hookRecord({}, [join(REPO, "docs", "TWO.md")], told("t1")), null, "told already");
  assert.deepEqual(pendingIn(state(), REPO), ["docs/PLAN.md", "docs/TWO.md"]);

  writeFileSync(join(REPO, "docs", "THREE.md"), "x");
  const later = hookRecord({}, [join(REPO, "docs", "THREE.md")], told("t2"));
  assert.match(later, /docs\/THREE\.md/, "a new turn is told, with two files still pending");
  clearState();
});

/* This fixture's `.git` is a file naming a directory that is not there, so no probe of its index
   answers — and a write at the bytes read is recorded for that reason alone, an unanswered probe
   being no evidence a reviewer saw what a commit would land. What the probes say when they do answer
   is the real repository's case below. */
test("a write at the bytes read is recorded where git will not say what the index holds", () => {
  clearState();
  const file = join(REPO, "docs", "READ.md");
  writeFileSync(file, "read by codex");
  const consult = (ok) => ({
    kind: "consult",
    ok,
    reply: ok ? "CODEX: 0 findings" : null,
    root: REPO,
    files: ["docs/READ.md"],
    sent: [{ rel: "docs/READ.md", sha: digest("read by codex") }],
  });
  const told = teller();
  let opened = 0;
  const log = (entries) => () => {
    opened += 1;
    return entries;
  };

  assert.match(hookRecord({}, [file], told("t1"), log([consult(true)])), /docs\/READ\.md/,
    "the content is the content read, and nothing here can say the index holds no other copy");
  assert.ok(existsSync(statePath()) && pendingIn(state(), REPO).length === 1, "so the write stands as owed");
  assert.equal(opened, 1, "the log was read once, for the file that would be added");

  clearState();
  assert.match(hookRecord({}, [file], told("t2"), log([consult(false)])), /docs\/READ\.md/, "an unanswered consult read nothing");
  clearState();
  assert.match(hookRecord({}, [file], told("t3"), log([])), /docs\/READ\.md/, "never sent");
  clearState();
  writeFileSync(file, "changed since");
  assert.match(hookRecord({}, [file], told("t4"), log([consult(true)])), /docs\/READ\.md/, "changed since the consult");

  opened = 0;
  assert.equal(hookRecord({}, [file], told("t4"), log([consult(true)])), null, "already pending");
  assert.deepEqual(pendingIn(state(), REPO), ["docs/READ.md"], "and its bytes still differ, so still owed");
  writeFileSync(file, "read by codex");
  assert.equal(hookRecord({}, [file], told("t4"), log([consult(true)])), null, "put back to the bytes read");
  assert.deepEqual(pendingIn(state(), REPO), ["docs/READ.md"],
    "and git will not say what this fixture's index holds, so the obligation stands rather than lapses");
  assert.equal(hookRecord({}, [join(REPO, "src", "codex.mjs")], told("t4"), log([consult(true)])), null);
  assert.equal(opened, 2, "one read of the log per invocation carrying a recordable path, and none without");
  clearState();
});

/* One PostToolUse carrying three documents paid for three parses of the same whole log, which only
   grows. The memo is the invocation's, so no call here can be answered from a read made before it. */
test("one invocation reads the log at most once, and not at all where no path asks", () => {
  clearState();
  const told = teller();
  let opened = 0;
  const log = () => {
    opened += 1;
    return [];
  };
  const three = ["ONE.md", "TWO.md", "THREE.md"].map((one) => {
    const file = join(REPO, "docs", one);
    writeFileSync(file, one);
    return file;
  });

  assert.match(hookRecord({}, three, told("t1"), log), /docs\/ONE\.md/, "the first of the three is what is announced");
  assert.equal(opened, 1, "three documents, one read of the log");
  assert.deepEqual(pendingIn(state(), REPO).length, 3, "and all three recorded");

  clearState();
  opened = 0;
  assert.equal(hookRecord({}, [], told("t2"), log), null, "no paths, so nothing to compare");
  assert.equal(hookRecord({}, [join(sandbox, "outside.md")], told("t2"), log), null, "no repository, so no comparison");
  assert.equal(hookRecord({}, [join(REPO, "src", "codex.mjs")], told("t2"), log), null, "not a recordable name");
  assert.equal(opened, 0, "none of the three shapes gets as far as asking");

  process.env.FORGE_CODEX_DISABLE = "1";
  try {
    assert.equal(hookRecord({}, three, told("t3"), log), null, "disabled");
    assert.equal(opened, 0, "and the switch answers before any path is looked at");
  } finally {
    delete process.env.FORGE_CODEX_DISABLE;
  }
  clearState();
});

/* Two checkouts, one state file: a hook firing in each at the same moment must not write what it
   read, and each is told for itself. */
test("a second repository is told for itself, and neither loses the other's list", () => {
  clearState();
  const other = join(sandbox, "repo-two");
  mkdirSync(join(other, "docs"), { recursive: true });
  writeFileSync(join(other, ".git"), "gitdir: elsewhere\n");
  writeFileSync(join(other, "docs", "PLAN.md"), "x");
  const told = teller();
  assert.match(hookRecord({}, [join(REPO, "docs", "PLAN.md")], told("t1")), /docs\/PLAN\.md/);
  assert.match(hookRecord({}, [join(other, "docs", "PLAN.md")], told("t1")), /docs\/PLAN\.md/);
  assert.deepEqual(pendingIn(state(), REPO), ["docs/PLAN.md"]);
  assert.deepEqual(pendingIn(state(), other), ["docs/PLAN.md"]);
  clearState();
});

test("a path the filter does not cover, or no repository at all, is not recorded", () => {
  clearState();
  assert.equal(hookRecord({}, [join(REPO, "src", "codex.mjs")]), null);
  assert.equal(hookRecord({}, [join(sandbox, "outside.md")]), null);
  assert.equal(existsSync(statePath()), false);
});

test("the disable switch silences the record", (t) => {
  clearState();
  process.env.FORGE_CODEX_DISABLE = "1";
  t.after(() => {
    delete process.env.FORGE_CODEX_DISABLE;
    clearState();
  });
  assert.equal(hookRecord({}, [join(REPO, "docs", "PLAN.md")]), null);
});

/* The comparison was skipped for a path already recorded, so an exact revert — this repository's own
   way of proving a checker fires — owed a consult with nothing in it to read (ISS-952). What decides
   it is the copy a commit would land, asked of a path the record does not hold as of one it does; and
   the index against the working copy alone is not that question, `FRESH.md` being the case where the
   two answers differ (ISS-1005). */
test("a write at the bytes read is recorded where the index holds another copy, and cleared where it does not", () => {
  clearState();
  const root = realpathSync(tempRoom("forge-codex-restore-"));
  const git = (...argv) => spawnSync("git", ["-C", root, "-c", "user.email=t@t", "-c", "user.name=t", ...argv], { encoding: "utf8" });
  spawnSync("git", ["init", "-q", root]);
  mkdirSync(join(root, "docs"), { recursive: true });
  const READ = "read by codex\n";
  const UNREAD = "no reviewer has seen this\n";
  const one = join(root, "docs", "READ.md");
  const two = join(root, "docs", "FRESH.md");
  writeFileSync(one, READ);
  writeFileSync(two, "what HEAD holds and no consult read\n");
  git("add", "-A");
  git("commit", "-qm", "the base");
  const sent = (rel) => ({ kind: "consult", ok: true, reply: "CODEX: 0 findings", root, files: [rel],
    sent: [{ rel, sha: digest(READ) }] });
  const log = () => [sent("docs/FRESH.md"), sent("docs/READ.md")];
  const told = teller();
  const record = () => (existsSync(statePath()) ? pendingIn(state(), root) : []);

  writeFileSync(one, UNREAD);
  git("add", "docs/READ.md");
  writeFileSync(one, READ);
  assert.match(hookRecord({}, [one], told("t1"), log) ?? "", /docs\/READ\.md/u,
    "the record never held this path, and the index holds bytes no consult was shown");
  assert.deepEqual(record(), ["docs/READ.md"]);
  assert.equal(hookRecord({}, [one], told("t1"), log), null);
  assert.deepEqual(record(), ["docs/READ.md"], "and a path it does hold stays, by the same reading (ISS-952)");

  git("reset", "-q");
  clearState();
  writeFileSync(two, READ);
  assert.equal(hookRecord({}, [two], told("t2"), log), null,
    "nothing of it is staged, so a commit carries none of it, whatever HEAD holds");
  assert.deepEqual(record(), []);
  git("add", "docs/FRESH.md");
  assert.equal(hookRecord({}, [two], told("t2"), log), null, "and the staged copy here is the copy that was read");
  assert.deepEqual(record(), []);

  git("reset", "-q");
  writeFileSync(two, UNREAD);
  assert.match(hookRecord({}, [two], told("t3"), log) ?? "", /docs\/FRESH\.md/u);
  writeFileSync(two, READ);
  assert.equal(hookRecord({}, [two], told("t3"), log), null);
  assert.deepEqual(record(), [], "the revert clears a standing entry: these bytes are in no commit and nothing stages them");
  clearState();
  rmSync(root, { recursive: true, force: true });
});

/* End to end, because the gate reads the record this hook writes and neither half refuses alone:
   the record was empty for the path, so the commit was asked nothing and the staged copy landed. */
test("a commit is refused for a path the record took only because the index held the write", () => {
  clearState();
  const root = realpathSync(tempRoom("forge-codex-gate-"));
  const git = (...argv) => spawnSync("git", ["-C", root, "-c", "user.email=t@t", "-c", "user.name=t", ...argv], { encoding: "utf8" });
  spawnSync("git", ["init", "-q", root]);
  mkdirSync(join(root, "docs"), { recursive: true });
  const file = join(root, "docs", "READ.md");
  const READ = "read by codex\n";
  writeFileSync(file, READ);
  git("add", "-A");
  git("commit", "-qm", "the base");
  writeFileSync(join(sandbox, "forge", "codex-log.jsonl"), `${JSON.stringify({ kind: "consult", ok: true,
    reply: "CODEX: 0 findings", root, files: ["docs/READ.md"], sent: [{ rel: "docs/READ.md", sha: digest(READ) }] })}\n`);

  writeFileSync(file, "no reviewer has seen this\n");
  git("add", "docs/READ.md");
  writeFileSync(file, READ);
  assert.match(hookRecord({}, [file], teller()("t1")) ?? "", /docs\/READ\.md/u, "recorded off the index");
  const run = callHook(HOOK, { tool_name: "Bash", cwd: root, tool_input: { command: `git -C ${root} commit -m work` } },
    { ...process.env, XDG_CONFIG_HOME: sandbox });
  const out = run.stdout.trim() ? JSON.parse(run.stdout) : null;
  assert.match(out?.hookSpecificOutput?.permissionDecisionReason ?? "", /has not read what this commit stages/u);
  assert.match(out?.hookSpecificOutput?.permissionDecisionReason ?? "", /docs\/READ\.md/u, "and it names the file");
  assert.equal(git("show", ":docs/READ.md").stdout, "no reviewer has seen this\n", "which is what the index still holds");
  clearState();
  rmSync(root, { recursive: true, force: true });
});
