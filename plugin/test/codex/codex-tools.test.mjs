import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { TOOLS, runTool, scopeFor, toolsFor } from "../../src/codex/codex-tools.mjs";
import { bundle, changedAgainst, divergedFrom, roleFor, withDiffs } from "../../src/codex/codex-api.mjs";
import { tempRoom } from "../fixtures.mjs";

const repo = () => {
  const dir = tempRoom("codex-check-");
  execFileSync("git", ["init", "-q", dir]);
  writeFileSync(join(dir, "a.txt"), "x\n");
  return dir;
};

/* A path that is not there and a path that was left out were 34 refusals in the log, and each
   answer is one the checkout could have given (ISS-65). */
test("a path that is not there is answered with the nearest directory that is", () => {
  const root = repo();
  const scope = scopeFor(root);
  mkdirSync(join(root, "plugin", "test"), { recursive: true });
  writeFileSync(join(root, "plugin", "one.mjs"), "x\n");
  const deep = runTool(scope, "read_file", { path: "plugin/two.mjs" }).text;
  assert.match(deep, /plugin\/two\.mjs is not a readable path in /u);
  assert.match(deep, /plugin holds: one\.mjs, test$/u, "the siblings of where it would have been");
  assert.match(runTool(scope, "grep", { path: "nope", pattern: "x" }).text, /the root holds: a\.txt, plugin/u);
  assert.match(runTool(scope, "read_file", { path: "../outside" }).text, /is not a readable path in /u);
});

test("the tools whose path is the checkout take it when none was given", () => {
  const root = repo();
  const scope = scopeFor(root);
  assert.match(runTool(scope, "list_dir", {}).text, /^a\.txt$/mu, "the root, listed");
  assert.equal(runTool(scope, "list_dir", {}).error, undefined);
  writeFileSync(join(root, "a.txt"), "y\n");
  execFileSync("git", ["-C", root, "add", "a.txt"]);
  execFileSync("git", ["-C", root, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "one"]);
  writeFileSync(join(root, "a.txt"), "z\n");
  const whole = runTool(scope, "git_diff", {});
  assert.equal(whole.error, undefined);
  assert.match(whole.text, /a\.txt/u, "the checkout's own diff, with no path to narrow it");
  assert.match(runTool(scope, "git_diff", { base: "-x" }).text, /is not a ref this will pass to git/u,
    "and a base in option position is still refused");
  const owed = runTool(scope, "read_file", {});
  assert.equal(owed.error, true);
  assert.match(owed.text, /read_file needs a `path`; at its top: a\.txt/u, "the one tool with no default");
});

/* Asked for a diff and given no file, the consult read "nothing to consult on" and the author read
   `git diff --name-only` and typed the list back (ISS-65). */
test("what changed against a ref is what the tree says, a deletion included", () => {
  const root = repo();
  const git = (...argv) => execFileSync("git", ["-C", root, "-c", "user.email=t@t", "-c", "user.name=t", ...argv]);
  writeFileSync(join(root, "b.txt"), "y\n");
  git("add", ".");
  git("commit", "-qm", "one");
  writeFileSync(join(root, "a.txt"), "changed\n");
  writeFileSync(join(root, "c.txt"), "new\n");
  git("add", "c.txt");
  git("rm", "-q", "b.txt");
  writeFileSync(join(root, "d.txt"), "untracked\n");
  assert.deepEqual(changedAgainst(root, "HEAD"), ["a.txt", "b.txt", "c.txt", "d.txt"],
    "the deleted file among them, since its diff is what says it is gone, and the untracked one, "
    + "which `git diff` never lists and a turn's new file always is");
  assert.equal(changedAgainst(root, "no-such-ref"), null,
    "and a ref git cannot read is null, never the empty set a clean tree answers with");
});

/* A base moves under a run — the default branch takes another run's release mid-branch — and
   against the ref as it stands the other side's commits read as this branch's: ISS-117's review
   raised two findings on code the branch never touched, and its run rejected them by name. */
const parted = () => {
  const root = repo();
  const git = (...argv) => execFileSync("git", ["-C", root, "-c", "user.email=t@t", "-c", "user.name=t", ...argv]);
  writeFileSync(join(root, "kept.txt"), "kept\n");
  git("add", ".");
  git("commit", "-qm", "one");
  const base = String(git("branch", "--show-current")).trim();
  git("checkout", "-qb", "work");
  writeFileSync(join(root, "mine.txt"), "mine\n");
  git("add", "mine.txt");
  git("commit", "-qm", "the branch's own");
  git("checkout", "-q", base);
  writeFileSync(join(root, "kept.txt"), "the other side dropped the line\n");
  git("commit", "-qam", "the other side, after the branch was cut");
  git("checkout", "-q", "work");
  return { root, git, base };
};

test("a base that moved under the branch is read from where they parted (ISS-129)", () => {
  const { root, base } = parted();
  assert.deepEqual(changedAgainst(root, base, true), ["mine.txt"],
    "the branch's own file alone; what the other side did to kept.txt is not this branch's change");
  assert.deepEqual(changedAgainst(root, base, false), ["kept.txt", "mine.txt"],
    "and against the ref as it stands it is, which is the finding raised on code nobody touched");
  const [held] = withDiffs(root, bundle(root, ["kept.txt"]), base, true);
  assert.equal(held.diff.unchanged, true, "so the file the other side moved travels as context");
  const [asStands] = withDiffs(root, bundle(root, ["kept.txt"]), base, false);
  assert.match(asStands.diff.text, /\+kept/u, "where before it travelled as a hunk to review");
});

/* The report asked for literal `<base>...HEAD`, which makes HEAD the other side and drops the
   working tree: a reviewer told nothing changed in the file whose newest edit it was never shown
   is a worse failure than the one being fixed. The merge-base is one side; the tree is still the other. */
test("the working tree is still the other side of a base read from the parting point", () => {
  const { root, base } = parted();
  writeFileSync(join(root, "a.txt"), "edited this minute, committed by nobody\n");
  assert.deepEqual(changedAgainst(root, base, true), ["a.txt", "mine.txt"],
    "the uncommitted edit among them, which `git diff base...HEAD` would not have listed");
});

test("a ref that has gone nowhere HEAD has not resolves to nothing", () => {
  const { root, base } = parted();
  assert.equal(divergedFrom(root, "HEAD"), null,
    "the default base needs no resolving, and the ref is the more legible thing to record");
  assert.equal(divergedFrom(root, "HEAD~1"), null, "as does any ref still behind HEAD");
  assert.equal(divergedFrom(root, base).length, 40, "a base that moved answers with the commit they parted at");
  assert.equal(divergedFrom(root, "no-such-ref"), null,
    "and a ref this checkout cannot read answers with nothing, so the diff against it reports the failure");
  assert.equal(changedAgainst(root, "no-such-ref", true), null,
    "which is null from the caller, never the empty set a clean tree answers with");
});

/* The consult resolves the base for the path list, for each file's diff and for the row's anchor,
   and waits on an open stdin in between: three resolutions of a ref that moved would send diffs from
   one base and record another, which is a replay of what was never sent. */
test("a checkout's base is resolved once, whatever the ref does after", () => {
  const { root, git, base } = parted();
  const first = divergedFrom(root, base);
  git("checkout", "-q", base);
  git("merge", "-q", "-m", "the other side takes the branch", "work");
  git("checkout", "-q", "work");
  assert.notEqual(String(git("merge-base", base, "HEAD")).trim(), first,
    "the ref has moved somewhere that would part from this branch elsewhere");
  assert.equal(divergedFrom(root, base), first, "and the base this consult diffs from is the one it started with");
});

test("run_check is offered only where the checkout named a command", () => {
  const root = repo();
  assert.deepEqual(toolsFor(scopeFor(root)), TOOLS);
  const scope = scopeFor(root, [], { command: "true" });
  assert.equal(toolsFor(scope).at(-1).name, "run_check");
  assert.equal(toolsFor(scope).length, TOOLS.length + 1);
  assert.match(runTool(scopeFor(root), "run_check", {}).text, /configures no `codex.check`/u);
  assert.match(roleFor(["tech"], { check: true }), /`run_check` runs this checkout's own check command, once/u);
  assert.doesNotMatch(roleFor(["tech"]), /run_check/u);
});

test("run_check runs the named command once, from the checkout, and reports exit and tail", () => {
  const root = repo();
  const scope = scopeFor(root, [], { command: "echo start; ls a.txt; echo oops >&2; exit 3" });
  const first = runTool(scope, "run_check", {});
  assert.equal(first.error, undefined);
  assert.match(first.text, /^`echo start; .*` exited 3\n/u);
  assert.match(first.text, /start\na\.txt\noops/u, "stdout then stderr, run from the checkout");
  const again = runTool(scope, "run_check", {});
  assert.equal(again.error, true);
  assert.match(again.text, /runs once per consult, and it has run/u);
});

test("run_check keeps only the tail of a long output and stops a run past its clock", () => {
  const root = repo();
  const long = runTool(scopeFor(root, [], { command: "seq 1 5000" }), "run_check", {});
  assert.match(long.text, /^`seq 1 5000` exited 0\n…\n/u);
  assert.ok(long.text.length < 6_200, "the tail is bounded");
  assert.match(long.text, /\n5000$/u, "the end survives");
  const pidfile = join(root, "child.pid");
  const slow = runTool(scopeFor(root, [], { command: `sleep 30 & echo $! > child.pid; wait`, ms: 300 }), "run_check", {});
  assert.equal(slow.error, true);
  assert.match(slow.text, /ran past 0\.3s and was stopped/u);
  const child = Number(readFileSync(pidfile, "utf8").trim());
  const alive = (pid) => { try { return execFileSync("ps", ["-o", "stat=", "-p", String(pid)]).toString().trim(); } catch { return ""; } };
  const t0 = Date.now();
  while (alive(child) && !alive(child).startsWith("Z") && Date.now() - t0 < 2000) execFileSync("sleep", ["0.05"]);
  assert.ok(!alive(child) || alive(child).startsWith("Z"), `the runner the shell started (${child}) went with it`);
});

test("a run the buffer ends takes its process group with it too", () => {
  const root = repo();
  const scope = scopeFor(root, [], { command: "sleep 30 & echo $! > child.pid; yes | head -c 20000000; wait" });
  const out = runTool(scope, "run_check", {});
  assert.equal(out.error, true);
  assert.match(out.text, /could not finish: .*ENOBUFS/u);
  const child = Number(readFileSync(join(root, "child.pid"), "utf8").trim());
  const alive = (pid) => { try { return execFileSync("ps", ["-o", "stat=", "-p", String(pid)]).toString().trim(); } catch { return ""; } };
  const t0 = Date.now();
  while (alive(child) && !alive(child).startsWith("Z") && Date.now() - t0 < 2000) execFileSync("sleep", ["0.05"]);
  assert.ok(!alive(child) || alive(child).startsWith("Z"), `the runner (${child}) went with the shell`);
});
