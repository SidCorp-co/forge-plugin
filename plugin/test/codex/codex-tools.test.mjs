import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { TOOLS, runTool, scopeFor, toolsFor } from "../../src/codex/codex-tools.mjs";
import { changedAgainst, roleFor } from "../../src/codex/codex-api.mjs";

const repo = () => {
  const dir = mkdtempSync(join(tmpdir(), "codex-check-"));
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
  assert.deepEqual(changedAgainst(root, "no-such-ref"), [], "and a ref git cannot read answers nothing");
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
