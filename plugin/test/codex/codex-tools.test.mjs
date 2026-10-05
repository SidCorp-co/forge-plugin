import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { TOOLS, runTool, scopeFor, specFor, toolsFor } from "../../src/codex/codex-tools.mjs";
import { bundle, changedAgainst, divergedFrom, roleFor, withDiffs } from "../../src/codex/codex-api.mjs";
import { reviewSet } from "../../src/codex/codex-set.mjs";
import { tempRoom } from "../fixtures.mjs";

/* Whatever a case resolves about a project is the suite's, never the developer's own configuration home. */
process.env.XDG_CONFIG_HOME = tempRoom("codex-tools-home-");

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

test("the checkout's change against a moved base is the branch's own only where the base was named (ISS-228)", () => {
  const { root, base } = parted();
  const asks = { root, named: [], base, held: [], pattern: "^docs/" };
  assert.deepEqual(reviewSet({ ...asks, readFromParting: (ref) => ref === base }).rels, ["mine.txt"],
    "named, the base is read from where the branch parted");
  assert.deepEqual(reviewSet({ ...asks, readFromParting: () => false }).rels, ["kept.txt", "mine.txt"],
    "and not named, the other side's change reads as this branch's");
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

/* The landing gates every change, so a reviewer running the project's gate measures nothing the
   landing will not and spends the consult's clock on it: no check is offered, whatever a checkout names. */
test("a consult's tool list carries no run_check, whatever the checkout names", async () => {
  const root = repo();
  assert.deepEqual(toolsFor(scopeFor(root)), TOOLS);
  assert.equal(TOOLS.some((one) => one.name === "run_check"), false);
  const named = toolsFor(scopeFor(root, [], { issues: ["ISS-1"] })).map((one) => one.name);
  assert.equal(named.includes("run_check"), false, "nor beside the tools a scope adds");
  assert.equal((await runTool(scopeFor(root), "run_check", {})).text, "no tool named run_check",
    "and a reviewer asking for it is answered as for any tool that is not there");
  assert.doesNotMatch(roleFor(["tech"]), /run_check/u, "the prompt names no such tool");
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

  const anchored = scopeFor(root, [], { anchor: first, files: ["a.txt"] });
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

  const quiet = scopeFor(root, [], { anchor: "HEAD", files: ["a.txt"] });
  assert.match((await runTool(quiet, "git_diff", {})).text, /no change against HEAD in the file\(s\) this consult named/u);

  /* `git diff` never lists a file git has not been told about, and this CLI deliberately discovers
     one and sends its whole text as the change: "no change" there is the wrong answer. */
  writeFileSync(join(root, "new.txt"), "every line of it is the change\n");
  const withNew = scopeFor(root, [], { anchor: first, files: ["a.txt", "new.txt"] });
  const named = await runTool(withNew, "git_diff", {});
  assert.match(named.text, /new\.txt/u, "the untracked file is named rather than passed over");
  assert.match(named.text, /untracked, so git shows no diff for (?:it|them)/u, "and why it carries none");
  assert.match(named.text, /a\.txt/u, "beside the diff of the tracked one");

  /* A scoped diff that will not run is answered as that, never by widening to the whole checkout —
     which is the scope the anchor exists to hold. */
  const bad = scopeFor(root, [], { anchor: "HEAD", files: ["../outside.txt"] });
  const failed = await runTool(bad, "git_diff", {});
  assert.match(failed.text, /^git diff failed: /u, "the scoped command's own answer");
  assert.equal(/b\.txt/u.test(failed.text), false, "and not the tree it was asked not to hand over");
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
const specScope = async (root) => scopeFor(root, [], { spec: await specFor(root) });

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
  const broken = treed();
  symlinkSync(join(broken, "gone"), join(broken, "docs", "requirements", "srs", "gone.md"));
  symlinkSync(join(broken, "gone-dir"), join(broken, "docs", "requirements", "gone"));
  assert.equal((await runTool(await specScope(broken), "read_spec", { id: "FR-01" })).error, undefined,
    "a link that resolves nowhere is skipped rather than ending the read");
});
