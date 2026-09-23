import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { TOOLS, checkCommand, checkState, runTool, scopeFor, specFor, toolsFor } from "../../src/codex/codex-tools.mjs";
import { bundle, changedAgainst, divergedFrom, roleFor, withDiffs } from "../../src/codex/codex-api.mjs";
import { AROUND_CHECK_MS, CHECK_MS_SPARED } from "../../src/resolve/settings.mjs";
import { escaped, projectEntry, tempRoom } from "../fixtures.mjs";
import { tapOf } from "./check/tap-of.mjs";
import { patience } from "../patience.mjs";

/* The refusal below names where this machine keeps the project's record, and reading that path off
   the developer's own configuration home would make the case the machine's rather than the suite's. */
process.env.XDG_CONFIG_HOME = tempRoom("codex-tools-home-");
const ENTRY = projectEntry(process.cwd(), process.env.XDG_CONFIG_HOME);

const repo = () => {
  const dir = tempRoom("codex-check-");
  execFileSync("git", ["init", "-q", dir], { cwd: dirname(dir) });
  writeFileSync(join(dir, "a.txt"), "x\n");
  return dir;
};

/* A path that is not there and a path that was left out were 34 refusals in the log, and each
   answer is one the checkout could have given (ISS-65). */
test("a path that is not there is answered with the nearest directory that is", async () => {
  const root = repo();
  const scope = scopeFor(root);
  mkdirSync(join(root, "plugin", "test"), { recursive: true });
  writeFileSync(join(root, "plugin", "one.mjs"), "x\n");
  const deep = (await runTool(scope, "read_file", { path: "plugin/two.mjs" })).text;
  assert.match(deep, /plugin\/two\.mjs is not a readable path in /u);
  assert.match(deep, /plugin holds: one\.mjs, test$/u, "the siblings of where it would have been");
  assert.match((await runTool(scope, "grep", { path: "nope", pattern: "x" })).text, /the root holds: a\.txt, plugin/u);
  assert.match((await runTool(scope, "read_file", { path: "../outside" })).text, /is not a readable path in /u);
});

test("the tools whose path is the checkout take it when none was given", async () => {
  const root = repo();
  const scope = scopeFor(root);
  assert.match((await runTool(scope, "list_dir", {})).text, /^a\.txt$/mu, "the root, listed");
  assert.equal((await runTool(scope, "list_dir", {})).error, undefined);
  writeFileSync(join(root, "a.txt"), "y\n");
  execFileSync("git", ["-C", root, "add", "a.txt"], { cwd: root });
  execFileSync("git", ["-C", root, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "one"], { cwd: root });
  writeFileSync(join(root, "a.txt"), "z\n");
  const whole = await runTool(scope, "git_diff", {});
  assert.equal(whole.error, undefined);
  assert.match(whole.text, /a\.txt/u, "the checkout's own diff, with no path to narrow it");
  assert.match((await runTool(scope, "git_diff", { base: "-x" })).text, /is not a ref this will pass to git/u,
    "and a base in option position is still refused");
  const owed = await runTool(scope, "read_file", {});
  assert.equal(owed.error, true);
  assert.match(owed.text, /read_file needs a `path`; at its top: a\.txt/u, "the one tool with no default");
});

/* A grep past its caps lost the matches it hid with nothing to say how many or how to get them, and
   unlike a read it has no range to page on (ISS-326). */
test("a grep past its line cap says how many it matched, how many it shows, and how to narrow", async () => {
  const root = repo();
  writeFileSync(join(root, "many.txt"), Array.from({ length: 300 }, (_, at) => `needle ${at}`).join("\n"));
  const said = (await runTool(scopeFor(root), "grep", { pattern: "needle" })).text;
  assert.match(said, /^300 matches, the first 200 shown:\n/u);
  assert.equal(said.split("\n").filter((line) => line.startsWith("many.txt:")).length, 200);
  assert.match(said, /\n… 100 more not shown\. Narrow it with a tighter pattern, or with a `path` to one directory or file\.$/u);
});

test("a grep past the character cap is cut at a whole match and counts what it hid", async () => {
  const root = repo();
  const wide = "w".repeat(400);
  writeFileSync(join(root, "wide.txt"), Array.from({ length: 150 }, (_, at) => `needle ${at} ${wide}`).join("\n"));
  const said = (await runTool(scopeFor(root), "grep", { pattern: "needle" })).text;
  const [, total, shown] = said.match(/^(\d+) matches, the first (\d+) shown:\n/u) ?? [];
  assert.equal(Number(total), 150);
  assert.ok(Number(shown) > 0 && Number(shown) < 150, `a part shown, not ${shown}`);
  assert.equal(said.split("\n").filter((line) => line.startsWith("wide.txt:")).length, Number(shown));
  assert.equal(said.includes("clipped at"), false, "cut at a match, not mid-line");
  assert.ok(said.length <= 20_000, `under the result cap, at ${said.length}`);
  assert.match(said, new RegExp(`\\n… ${150 - Number(shown)} more not shown\\. Narrow it with a tighter pattern, or with a \`path\``, "u"));
});

test("a grep that fits is its matches and nothing else", async () => {
  const root = repo();
  writeFileSync(join(root, "few.txt"), "needle one\nneedle two\n");
  assert.equal((await runTool(scopeFor(root), "grep", { pattern: "needle" })).text, "few.txt:1:needle one\nfew.txt:2:needle two");
});

/* Asked for a diff and given no file, the consult read "nothing to consult on" and the author read
   `git diff --name-only` and typed the list back (ISS-65). */
test("what changed against a ref is what the tree says, a deletion included", () => {
  const root = repo();
  const git = (...argv) => execFileSync("git", ["-C", root, "-c", "user.email=t@t", "-c", "user.name=t", ...argv], { cwd: root });
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
  const git = (...argv) => execFileSync("git", ["-C", root, "-c", "user.email=t@t", "-c", "user.name=t", ...argv], { cwd: root });
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

test("run_check is offered only where the checkout named a command", async () => {
  const root = repo();
  assert.deepEqual(toolsFor(scopeFor(root)), TOOLS);
  const scope = scopeFor(root, [], { command: "true" });
  assert.equal(toolsFor(scope).at(-1).name, "run_check");
  assert.equal(toolsFor(scope).length, TOOLS.length + 1);
  assert.match((await runTool(scopeFor(root), "run_check", {})).text, /configures no `codex.check`/u);
  assert.match(roleFor(["tech"], { check: true }), /`run_check` runs this checkout's own check command, once/u);
  assert.doesNotMatch(roleFor(["tech"]), /run_check/u);
});

test("run_check runs the named command once, from the checkout, and reports exit and tail", async () => {
  const root = repo();
  const scope = scopeFor(root, [], { command: "echo start; ls a.txt; echo oops >&2; exit 3" });
  const first = await runTool(scope, "run_check", {});
  assert.equal(first.error, undefined);
  assert.match(first.text, /^`echo start; .*` exited 3\n/u);
  assert.match(first.text, /start\na\.txt\noops/u, "stdout then stderr, run from the checkout");
  assert.doesNotMatch(first.text, /failing case\(s\)/u, "a red naming no case reads as it always did");
  const again = await runTool(scope, "run_check", {});
  assert.equal(again.error, true);
  assert.match(again.text, /runs once per consult, and it has run/u);
});

/* The window is the end of the stream and a suite's `not ok` is thousands of lines above it: of the
   1,047,557 characters this repository's own check prints over 4,195 top-level subtests, 23 start
   inside the last 6,000, so one red in 182 could name its case and the rest arrived as a count
   (ISS-1901). The tail stays; what goes above it is selected. */
test("a red check names the cases its own output named, above the tail", async () => {
  const root = repo();
  const { out } = tapOf(`test("the case that went red", () => { throw new Error("the assertion that failed"); });
`, "run-check-red-");
  const filler = `seq 1 4000; cat ${JSON.stringify(join(root, "s.tap"))}`;
  writeFileSync(join(root, "s.tap"), out);
  const red = await runTool(scopeFor(root, [], { command: `${filler}; exit 1` }), "run_check", {});
  assert.equal(red.error, undefined);
  const [said, count, name, ...rest] = red.text.split("\n");
  assert.match(said, /` exited 1$/u);
  assert.equal(count, "1 failing case(s) its output named:");
  assert.equal(name, "  the case that went red");
  assert.match(rest.join("\n"), /^ {4}location: .*s\.test\.mjs:2:1\n {4}failureType: testCodeFailure\n {4}error: the assertion that failed\n\n…\n/u,
    "the case, then the tail it would have been buried in");
  assert.match(red.text.split("\n").at(-1), /^# duration_ms /u, "and the tail is still the end of the stream");
});

test("the check runs under an environment this CLI composed, without the run that consulted it", async () => {
  const root = repo();
  const room = tempRoom("run-check-env-");
  const was = { session: process.env.FORGE_SESSION_ID, tmp: process.env.TMPDIR };
  process.env.FORGE_SESSION_ID = "the-run-that-consulted";
  process.env.TMPDIR = room;
  try {
    const said = (await runTool(scopeFor(root, [], {
      command: `echo "session=[\${FORGE_SESSION_ID-absent}] tmpdir=[$TMPDIR]"`,
    }), "run_check", {})).text;
    assert.match(said, /session=\[absent\]/u, "a check is the project's command, not the run that consulted");
    assert.ok(said.includes(`tmpdir=[${room}]`), "and the caller's own scratch root is where its leftovers go");
  } finally {
    if (was.session === undefined) delete process.env.FORGE_SESSION_ID; else process.env.FORGE_SESSION_ID = was.session;
    if (was.tmp === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = was.tmp;
  }
});

test("run_check keeps only the tail of a long output and stops a run past its clock", async () => {
  const root = repo();
  const long = await runTool(scopeFor(root, [], { command: "seq 1 5000" }), "run_check", {});
  assert.match(long.text, /^`seq 1 5000` exited 0\n…\n/u);
  assert.ok(long.text.length < 6_200, "the tail is bounded");
  assert.match(long.text, /\n5000$/u, "the end survives");
  const pidfile = join(root, "child.pid");
  const slow = await runTool(scopeFor(root, [], { command: `sleep 30 & echo $! > child.pid; wait`, ms: 300 }), "run_check", {});
  assert.equal(slow.error, true);
  assert.match(slow.text, /ran past 0\.3s and was stopped/u);
  const child = Number(readFileSync(pidfile, "utf8").trim());
  const alive = (pid) => { try { return execFileSync("ps", ["-o", "stat=", "-p", String(pid)]).toString().trim(); } catch { return ""; } };
  const t0 = Date.now();
  while (alive(child) && !alive(child).startsWith("Z") && Date.now() - t0 < patience(2000)) execFileSync("sleep", ["0.05"]);
  assert.ok(!alive(child) || alive(child).startsWith("Z"), `the runner the shell started (${child}) went with it`);
});

/* The five words a round can end on, each read off the scope the tool ran against. `declined` and
   `none` are the pair the log could not tell apart at all, and `failed` is the one an ordinary
   non-zero exit must not reach: a check that answered is `ran` whatever it answered (ISS-1898). */
test("the scope carries which state the declared check left the round in", async () => {
  const root = repo();
  assert.equal(checkState(scopeFor(root)), "none", "a checkout that declared no command");
  assert.equal(checkCommand(scopeFor(root)), null);
  const offered = scopeFor(root, [], { command: "true" });
  assert.equal(checkState(offered), "declined", "offered and never called is not the same as never offered");
  assert.equal(checkCommand(offered), "true", "and which command was declined is on the scope either way");

  const red = scopeFor(root, [], { command: "exit 3" });
  await runTool(red, "run_check", {});
  assert.equal(checkState(red), "ran", "a check that answered is `ran` whatever it exited");

  const stopped = scopeFor(root, [], { command: "sleep 30", ms: 300 });
  await runTool(stopped, "run_check", {});
  assert.equal(checkState(stopped), "cut");

  const burst = scopeFor(root, [], { command: "yes | head -c 20000000" });
  await runTool(burst, "run_check", {});
  assert.equal(checkState(burst), "failed", "a command that gave no answer at all is not a clock and not a run");

  /* The second call is refused before it spawns, so what the first reached stands. */
  await runTool(red, "run_check", {});
  assert.equal(checkState(red), "ran");
});

test("a run the buffer ends takes its process group with it too", async () => {
  const root = repo();
  const scope = scopeFor(root, [], { command: "sleep 30 & echo $! > child.pid; yes | head -c 20000000; wait" });
  const out = await runTool(scope, "run_check", {});
  assert.equal(out.error, true);
  assert.match(out.text, /could not finish: .*ENOBUFS/u);
  const child = Number(readFileSync(join(root, "child.pid"), "utf8").trim());
  const alive = (pid) => { try { return execFileSync("ps", ["-o", "stat=", "-p", String(pid)]).toString().trim(); } catch { return ""; } };
  const t0 = Date.now();
  while (alive(child) && !alive(child).startsWith("Z") && Date.now() - t0 < patience(2000)) execFileSync("sleep", ["0.05"]);
  assert.ok(!alive(child) || alive(child).startsWith("Z"), `the runner (${child}) went with the shell`);
});

/* A reviewer shown a diff from a merge-base and handed the whole checkout at HEAD when it asked for
   "the diff" is reading one side of the change while being told it is the other (ISS-51). */
test("git_diff with neither path nor base answers the diff this consult was given", async () => {
  const root = repo();
  const git = (...argv) => execFileSync("git", ["-C", root, "-c", "user.email=t@t", "-c", "user.name=t", ...argv], { cwd: root });
  writeFileSync(join(root, "b.txt"), "kept\n");
  git("add", ".");
  git("commit", "-qm", "one");
  const first = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  writeFileSync(join(root, "a.txt"), "moved\n");
  git("add", "a.txt");
  git("commit", "-qm", "two");
  writeFileSync(join(root, "b.txt"), "also moved\n");

  const anchored = scopeFor(root, [], null, { anchor: first, files: ["a.txt"] });
  const own = await runTool(anchored, "git_diff", {});
  assert.equal(own.error, undefined);
  assert.match(own.text, new RegExp(`from ${first.slice(0, 7)}`, "u"), "and it names the commit it diffed from");
  assert.match(own.text, /a\.txt/u, "the file the consult named, since the anchor");
  assert.equal(/b\.txt/u.test(own.text), false, "not a file the consult was never about");

  const narrowed = await runTool(anchored, "git_diff", { path: "b.txt" });
  assert.match(narrowed.text, /b\.txt/u, "a path it named is still its own question");
  assert.equal(/from /u.test(narrowed.text), false);
  assert.match((await runTool(anchored, "git_diff", { base: "HEAD" })).text, /b\.txt/u, "and so is a base it named");

  const loose = await runTool(scopeFor(root), "git_diff", {});
  assert.match(loose.text, /b\.txt/u, "anchored to nothing, the whole checkout against HEAD as before");
  assert.equal(/from /u.test(loose.text), false);

  const quiet = scopeFor(root, [], null, { anchor: "HEAD", files: ["a.txt"] });
  assert.match((await runTool(quiet, "git_diff", {})).text, /no change against HEAD in the file\(s\) this consult named/u);

  /* `git diff` never lists a file git has not been told about, and this CLI deliberately discovers
     one and sends its whole text as the change: "no change" there is the wrong answer. */
  writeFileSync(join(root, "new.txt"), "every line of it is the change\n");
  const withNew = scopeFor(root, [], null, { anchor: first, files: ["a.txt", "new.txt"] });
  const named = await runTool(withNew, "git_diff", {});
  assert.match(named.text, /new\.txt/u, "the untracked file is named rather than passed over");
  assert.match(named.text, /untracked, so git shows no diff for (?:it|them)/u, "and why it carries none");
  assert.match(named.text, /a\.txt/u, "beside the diff of the tracked one");

  /* A scoped diff that will not run is answered as that, never by widening to the whole checkout —
     which is the scope the anchor exists to hold. */
  const bad = scopeFor(root, [], null, { anchor: "HEAD", files: ["../outside.txt"] });
  const failed = await runTool(bad, "git_diff", {});
  assert.match(failed.text, /^git diff failed: /u, "the scoped command's own answer");
  assert.equal(/b\.txt/u.test(failed.text), false, "and not the tree it was asked not to hand over");
});

/* The refusal is the whole of what the run that paid for the stopped call is handed, so it carries
   the clock, where the clock came from and a key that can move it: the two sources read differently
   because a project's own declaration is raised by its own key and a room a budget spared is not
   (ISS-1882, ISS-2108). Naming the key that cannot move it is the advice that costs a run its next
   consult as well, which is why a key that cannot is what this asserts against. */
test("a check stopped at its clock names the clock, where it was read, and a key that can move it", async () => {
  const root = repo();
  const slow = { command: "sleep 30", ms: 200 };
  const set = await runTool(scopeFor(root, [], { ...slow, msFrom: ENTRY }), "run_check", {});
  assert.equal(set.error, true);
  assert.match(set.text, new RegExp(
    `ran past 0\\.2s and was stopped\\. That clock is \`codex\\.checkMs\` in ${escaped(ENTRY)}\\. `
    + "Raise it, or narrow `codex\\.check` to what fits 0\\.2s$", "u"), set.text);
  const fell = await runTool(scopeFor(root, [], { ...slow, msFrom: CHECK_MS_SPARED() }), "run_check", {});
  assert.match(fell.text, new RegExp(
    `That clock is ${escaped(CHECK_MS_SPARED())}, which \`codex\\.checkMs\` cannot raise past\\. `
    + "Narrow `codex\\.check` to what fits 0\\.2s, or raise `codex\\.budgetMs` where the caller can "
    + "wait longer than one call$", "u"), fell.text);
  assert.equal(/Raise it/u.test(fell.text), false,
    "and it does not offer the project's own clock, which cannot reach past the room a budget spared");
});

/* `spawnSync` reads a timeout of 0 as no timeout at all, so the one arithmetic that must not floor
   to a number is this one: a consult with nothing left to spend would otherwise start the single
   check no clock can stop, on a budget that has already run out (ISS-2108). */
test("a consult with nothing left to spare refuses the check rather than starting one no clock can stop", async () => {
  const root = repo();
  const spent = scopeFor(root, [], { command: "sleep 30", ms: 200_000, msFrom: ENTRY },
    { by: Date.now() + AROUND_CHECK_MS - 1 });
  const none = await runTool(spent, "run_check", {});
  assert.equal(none.error, true);
  assert.match(none.text, /^`sleep 30` was not started: this consult's 600s budget has nothing left/u, none.text);
  assert.match(none.text, /Raise `codex\.budgetMs` where the caller can wait longer than one call$/u,
    "and the refusal names what clears it, a clock in the project reaching none of this");
  assert.equal(checkState(spent), "failed", "the state a check that could not start leaves the round in");
  assert.equal(/ran past/u.test(none.text), false, "and it is not reported as a command that was stopped");
});

/* A citation names a clause by identifier and never by path, so a reviewer holding only a file
   reader answered Unverified on every citation it was asked about (ISS-1061). */
const CLAUSES = `# SRS §3 — FR-01 — The first capability

Rev: 2 · Actors: agent

## Use cases

*What has to exist?*

### UC-01-1 — A clause read by its identifier

Rev: 1 · Actors: agent

The identifier is the whole surface.

- **AC-01-1-1** · Rev: 1 · Proof: none yet — ISS-1
  WHEN a clause is asked for THEN the CLI SHALL print it.
`;

const treed = () => {
  const root = repo();
  mkdirSync(join(root, "docs", "requirements", "srs"), { recursive: true });
  writeFileSync(join(root, "docs", "requirements", "srs", "fr-01.md"), CLAUSES);
  return root;
};

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const verb = (root, id) => spawnSync(FORGE, ["spec", id], { cwd: root, encoding: "utf8", env: process.env });
// The consult builds its scope this way: whether a tree is kept is asked before the scope is made.
const specScope = async (root) => scopeFor(root, [], null, { spec: await specFor(root) });

test("read_spec is offered only where the checkout under review keeps a requirements tree", async () => {
  assert.equal(toolsFor(await specScope(repo())).some((one) => one.name === "read_spec"), false);
  assert.equal(toolsFor(await specScope(treed())).at(-1).name, "read_spec");
  assert.match(roleFor(["tech"], { spec: true }), /`read_spec` reads a clause of this checkout's requirements tree/u);
  assert.doesNotMatch(roleFor(["tech"]), /read_spec/u);
});

test("read_spec answers with what forge spec prints, a stale citation and an unknown identifier alike", async () => {
  const root = treed();
  const scope = await specScope(root);
  for (const id of ["FR-01", "UC-01-1~1", "AC-01-1-1"]) {
    const held = await runTool(scope, "read_spec", { id });
    assert.equal(held.error, undefined, held.text);
    assert.equal(held.text, verb(root, id).stdout.trimEnd(), `${id} reads as the verb prints it`);
  }
  const stale = await runTool(scope, "read_spec", { id: "FR-01~1" });
  assert.match(stale.text, /^The citation FR-01~1 is stale: FR-01 is at revision 2, not 1\.\n\nFR-01 — /u, stale.text);
  assert.equal(stale.text, verb(root, "FR-01~1").stdout.trimEnd());
  const unknown = await runTool(scope, "read_spec", { id: "UC-01-2" });
  assert.equal(unknown.error, true);
  assert.match(unknown.text, /Did you mean: UC-01-1/u, unknown.text);
  assert.ok(verb(root, "UC-01-2").stderr.includes(unknown.text.replace(/^read_spec: /u, "")),
    "the refusal is the one the verb ends on");
});

test("read_spec reads the tree of the checkout under review and sends nothing off the machine", async () => {
  const fetched = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("read_spec reached the network"); };
  try {
    const held = await runTool(await specScope(treed()), "read_spec", { id: "FR-06" });
    assert.equal(held.error, true, "this repository's own FR-06 is not the reviewed checkout's");
    assert.match(held.text, /^read_spec: No clause named FR-06/u, held.text);
    assert.match((await runTool(await specScope(repo()), "read_spec", { id: "FR-01" })).text, /keeps no requirements tree/u);
  } finally {
    globalThis.fetch = fetched;
  }
});

test("a requirement past the cap is cut with the narrower identifiers that read the rest", async () => {
  const root = treed();
  const long = CLAUSES.replace("The identifier is the whole surface.", "A long line of the use case. ".repeat(900));
  writeFileSync(join(root, "docs", "requirements", "srs", "fr-01.md"), long);
  const held = await runTool(await specScope(root), "read_spec", { id: "FR-01" });
  assert.match(held.text, /clipped at \d+ characters; ask for a clause under FR-01 by its own identifier, as UC-01-1, for the rest\.$/u);
  assert.ok(held.text.length < 20_000, "under the cap every tool answer holds to");
});

/* The scope is physical for every tool: a symlinked tree, or a document linked in from outside,
   would otherwise hand the reviewer words from a directory it was never given. */
test("read_spec reads no clause whose file lies outside the checkout, however it is linked in", async () => {
  const away = treed();
  const linked = repo();
  mkdirSync(join(linked, "docs"), { recursive: true });
  symlinkSync(join(away, "docs", "requirements"), join(linked, "docs", "requirements"));
  assert.equal(toolsFor(await specScope(linked)).some((one) => one.name === "read_spec"), false);
  const mixed = treed();
  const other = tempRoom("codex-spec-away-");
  writeFileSync(join(other, "fr-02.md"), CLAUSES.replaceAll("01", "02"));
  symlinkSync(join(other, "fr-02.md"), join(mixed, "docs", "requirements", "srs", "fr-02.md"));
  const scope = await specScope(mixed);
  assert.equal((await runTool(scope, "read_spec", { id: "FR-01" })).error, undefined);
  assert.match((await runTool(scope, "read_spec", { id: "FR-02" })).text, /^read_spec: No clause named FR-02/u);
  const walked = treed();
  const outside = tempRoom("codex-spec-dir-");
  writeFileSync(join(outside, "fr-03.md"), CLAUSES.replaceAll("01", "03"));
  symlinkSync(outside, join(walked, "docs", "requirements", "vendor"));
  symlinkSync(join(walked, "docs", "requirements"), join(walked, "docs", "requirements", "srs", "again"));
  const deep = await specScope(walked);
  assert.match((await runTool(deep, "read_spec", { id: "FR-03" })).text, /^read_spec: No clause named FR-03/u,
    "a linked-in directory outside is not entered");
  assert.equal((await runTool(deep, "read_spec", { id: "FR-01" })).error, undefined, "and a link back in ends");
});
