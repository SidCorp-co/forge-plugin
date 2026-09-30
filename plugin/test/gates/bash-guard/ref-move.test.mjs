/* A ref moved under a tree that has it checked out, through the hook as Claude Code calls it, in a
   repository with a linked worktree: the main tree stands on `master`, the linked one on `side`. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { callHook, git, homeEnv, tempRoom } from "../../fixtures.mjs";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "hooks", "entries", "bash-guard.mjs");
const HOME = homeEnv("bash-guard-ref-move");
const MANY = 45;

const shared = () => {
  const room = tempRoom("ref-move-");
  const main = join(room, "main");
  const side = join(room, "side");
  mkdirSync(main);
  git(main, "init", "-q", "-b", "master");
  writeFileSync(join(main, "kept.txt"), "one\n");
  git(main, "add", "kept.txt");
  git(main, "commit", "-qm", "base");
  git(main, "worktree", "add", "-q", side, "-b", "side");
  const many = Array.from({ length: MANY }, (_, at) => `landed-${String(at).padStart(2, "0")}.txt`);
  for (const name of many) writeFileSync(join(side, name), `${name}\n`);
  git(side, "add", ...many);
  git(side, "commit", "-qm", "landing");
  git(main, "branch", "idle");
  git(main, "tag", "v1");
  return { room, main, side, many, head: (tree) => git(tree, "rev-parse", "HEAD").stdout.trim() };
};

const decide = (command, cwd, env = HOME) => {
  const run = callHook(HOOK, { session_id: randomUUID(), tool_name: "Bash", tool_input: { command }, cwd }, env);
  assert.equal(run.status, 0, run.stderr);
  if (!run.stdout.trim()) return { allowed: true, reason: "" };
  const answer = JSON.parse(run.stdout).hookSpecificOutput;
  return { allowed: answer.permissionDecision !== "deny", reason: answer.permissionDecisionReason };
};

test("moving a branch another worktree has checked out is refused, naming that tree and every stale path", () => {
  const repo = shared();
  const said = decide(`git update-ref refs/heads/master ${repo.head(repo.side)}`, repo.side);
  assert.equal(said.allowed, false, "the ref would move and leave the main tree's files behind");
  assert.ok(said.reason.includes(`checked out at ${repo.main}`), said.reason);
  for (const name of repo.many) assert.ok(said.reason.includes(`\n  ${name}`), `${name} is named`);
  assert.ok(said.reason.includes(`these ${MANY} path(s)`), "and counted, past any cap");
  assert.match(said.reason, /^Refused — hand the landing over with `forge claim <ISS-nn> --pushed --ready`/u);
  assert.match(said.reason, /is for the session working there/u);
});

test("a compare-and-swap move with a reason and a tree named by -C is read the same way", () => {
  const repo = shared();
  const old = repo.head(repo.main);
  const said = decide(`git -C ${repo.side} update-ref -m "land it" refs/heads/master HEAD ${old} && echo done`, repo.room);
  assert.equal(said.allowed, false);
  assert.ok(said.reason.includes(`checked out at ${repo.main}`), said.reason);
});

test("a branch spelt in joined quoted fragments, or reached through a symbolic ref, is the branch it names", () => {
  const repo = shared();
  const to = repo.head(repo.side);
  const joined = decide(`git update-ref 'refs/heads/'"mas"ter ${to}`, repo.side);
  assert.equal(joined.allowed, false, joined.reason);
  git(repo.main, "symbolic-ref", "refs/heads/alias", "refs/heads/master");
  git(repo.main, "symbolic-ref", "refs/aliased", "refs/heads/master");
  for (const ref of ["refs/heads/alias", "refs/aliased"]) {
    const said = decide(`git update-ref ${ref} ${to}`, repo.side);
    assert.equal(said.allowed, false, ref);
    assert.ok(said.reason.includes(`checked out at ${repo.main}`), said.reason);
    assert.ok(said.reason.includes("\n  landed-00.txt"), said.reason);
  }
  assert.equal(decide(`git update-ref --no-deref refs/heads/alias ${to}`, repo.side).allowed, true,
    "--no-deref rewrites the alias itself, which no tree stands on");
  const unplaced = decide(`cd "$SOMEWHERE" && git update-ref refs/aliased ${to}`, repo.side);
  assert.equal(unplaced.allowed, false, "a tree nobody can name may hold an alias of a checked-out branch");
  assert.match(unplaced.reason, /^Refused — spell the directory out/u);
  assert.equal(decide(`cd "$SOMEWHERE" && git update-ref --no-deref refs/aliased ${to}`, repo.side).allowed, true,
    "and a literal ref outside refs/heads moves no tree wherever it runs");
});

test("a ref or commit the shell builds is refused until spelt out, and a redirect is no operand", () => {
  const repo = shared();
  const to = repo.head(repo.side);
  const built = decide(`BRANCH=master; SHA=${to}; git update-ref refs/heads/$BRANCH $SHA`, repo.side);
  assert.equal(built.allowed, false);
  assert.match(built.reason, /^Refused — spell `refs\/heads\/\$BRANCH` out/u);
  const sha = decide("git update-ref refs/heads/master $(git rev-parse side)", repo.side);
  assert.equal(sha.allowed, false);
  assert.match(sha.reason, /^Refused — spell `\$\(git rev-parse side\)` out/u);
  assert.equal(decide("git update-ref refs/heads/idle $SHA", repo.side).allowed, true, "no tree stands on idle");
  const escaped = decide(`git update-ref -m land\\ it refs/heads/master ${to}`, repo.side);
  assert.equal(escaped.allowed, false, "an escaped space keeps the reason one word");
  assert.ok(escaped.reason.includes(`checked out at ${repo.main}`), escaped.reason);
  const traced = decide(`git update-ref 2>/tmp/trace refs/heads/master ${to}`, repo.side);
  assert.equal(traced.allowed, false);
  assert.ok(traced.reason.includes(`checked out at ${repo.main}`), traced.reason);
});

test("moving HEAD moves the tree the call runs in, with or without --no-deref", () => {
  const repo = shared();
  for (const form of ["", "--no-deref "]) {
    const said = decide(`git update-ref ${form}HEAD master`, repo.side);
    assert.equal(said.allowed, false, `update-ref ${form}HEAD`);
    assert.ok(said.reason.includes(`checked out at ${repo.side}`), said.reason);
    assert.match(said.reason, /^Refused — move this tree's branch with its files: `git reset --keep <new>`/u);
  }
});

/* A bare repository has no tree, so its HEAD is a branch name a linked tree may be standing on. */
test("moving a bare repository's HEAD moves the branch a linked tree has checked out", () => {
  const room = tempRoom("ref-move-bare-");
  const seed = join(room, "seed");
  mkdirSync(seed);
  git(seed, "init", "-q", "-b", "main");
  git(seed, "commit", "-q", "--allow-empty", "-m", "base");
  git(seed, "checkout", "-q", "-b", "next");
  writeFileSync(join(seed, "later.txt"), "later\n");
  git(seed, "add", "later.txt");
  git(seed, "commit", "-qm", "later");
  git(seed, "checkout", "-q", "main");
  git(room, "clone", "-q", "--bare", seed, join(room, "bare.git"));
  git(join(room, "bare.git"), "worktree", "add", "-q", join(room, "linked"), "main");
  const said = decide("git update-ref HEAD next", join(room, "bare.git"));
  assert.equal(said.allowed, false);
  assert.ok(said.reason.includes(`checked out at ${join(room, "linked")}`), said.reason);
  assert.ok(said.reason.includes("\n  later.txt"), said.reason);
});

test("a ref no worktree stands on, and a move to the commit already named, are allowed", () => {
  const repo = shared();
  const to = repo.head(repo.side);
  for (const ref of ["refs/heads/idle", "refs/remotes/origin/master", "refs/tags/v1", "refs/forge/reviewed", "master"]) {
    assert.equal(decide(`git update-ref ${ref} ${to}`, repo.main).allowed, true, ref);
  }
  assert.equal(decide(`git update-ref refs/heads/master ${repo.head(repo.main)}`, repo.side).allowed, true, "no move");
  assert.equal(decide("git update-ref -d refs/heads/idle", repo.main).allowed, true, "a deletion is not judged");
  assert.equal(decide("git update-ref refs/heads/master no-such-commit", repo.side).allowed, true, "git refuses it itself");
});

test("a transaction on stdin is refused, routed to one call per ref", () => {
  const repo = shared();
  const said = decide(`git update-ref --stdin <<< "update refs/heads/master ${repo.head(repo.side)}"`, repo.side);
  assert.equal(said.allowed, false);
  assert.match(said.reason, /^Refused — move each ref with its own `git update-ref <ref> <new> \[<old>\]` call/u);
  assert.equal(decide("git update-ref --stdin < moves.txt", tempRoom("not-a-repo-")).allowed, true, "outside a repository");
});

/* A `git` on PATH that fails the one reading named, answering as git would or never answering, and runs every other. */
const failing = (subcommand, does = 'echo "fatal: failed" >&2; exit 128') => {
  const bin = tempRoom("failing-git-");
  const real = process.env.PATH;
  const script = join(bin, "git");
  writeFileSync(script, `#!/bin/sh\nfor a in "$@"; do [ "$a" = "${subcommand}" ] && { ${does}; }; done\n`
    + `PATH="${real}" exec git "$@"\n`);
  chmodSync(script, 0o755);
  return { ...HOME, PATH: `${bin}:${real}` };
};

test("a worktree listing or a stale-path reading that fails refuses, saying which reading failed", () => {
  const repo = shared();
  const move = `git update-ref refs/heads/master ${repo.head(repo.side)}`;
  const unlisted = decide(move, repo.side, failing("worktree"));
  assert.equal(unlisted.allowed, false);
  assert.match(unlisted.reason, /could not be read: `git worktree list --porcelain` gave no listing/u);
  const silent = decide(move, repo.side, failing("worktree", "exec sleep 30"));
  assert.equal(silent.allowed, false, "a listing that never answers is no listing");
  assert.match(silent.reason, /could not be read: `git worktree list --porcelain` gave no listing/u);
  const untopped = decide("git update-ref --no-deref HEAD master", repo.side, failing("--show-toplevel"));
  assert.equal(untopped.allowed, false, "a HEAD move whose tree git will not name");
  assert.match(untopped.reason, /could not be read: git did not say which work tree/u);
  for (const does of [undefined, "exec sleep 30"]) {
    const undiffed = decide(move, repo.side, failing("diff", does));
    assert.equal(undiffed.allowed, false, does ?? "a diff git refused");
    assert.match(undiffed.reason, /could not be read: the paths that differ between [0-9a-f]{7} and [0-9a-f]{7}/u);
  }
});
