/* A three-file commit was refused with a demand to consult 726 paths, 243 of them another session's
   uncommitted work in a shared checkout, and `pending --drop` reported a drop that changed nothing:
   the gate compared the tree and the commit carried the index (ISS-70). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { apartFrom, clearableOf, demandIn, demandOf, goneFrom, heldSaid, settledIn, stagedApart,
  stagedIn } from "../../src/codex/codex-state.mjs";
import { digest } from "../../src/codex/codex-api.mjs";
import { tempRoom } from "../fixtures.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "cli.mjs");
const ENV = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
const rooms = [];
test.after(() => {
  for (const one of rooms) rmSync(one, { recursive: true, force: true });
});

const git = (root, ...args) => {
  const run = spawnSync("git", ["-C", root, ...args], { encoding: "utf8", env: { ...process.env, ...ENV } });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout;
};

/* Three tracked documents, one staged, one modified and unstaged, one untouched. */
const tree = () => {
  const root = realpathSync(tempRoom("codex-demand-"));
  rooms.push(root);
  mkdirSync(join(root, "docs"), { recursive: true });
  for (const one of ["docs/A.md", "docs/B.md", "docs/C.md"]) writeFileSync(join(root, one), `${one}\n`);
  git(root, "init", "-q", ".");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "first");
  for (const one of ["docs/A.md", "docs/B.md"]) writeFileSync(join(root, one), `${one} again\n`);
  git(root, "add", "docs/A.md");
  return root;
};

test("what a commit carries is the index, and `-a` is what adds the rest", () => {
  const root = tree();
  assert.deepEqual(stagedIn(root), ["docs/A.md"], "the file nobody staged is not this commit's");
  assert.deepEqual(stagedIn(root, { all: true }).sort(), ["docs/A.md", "docs/B.md"]);
  assert.deepEqual(stagedIn(root, { paths: ["docs/B.md"] }).sort(), ["docs/A.md", "docs/B.md"], "a pathspec commits the worktree under it");
  assert.deepEqual(stagedIn(root, { paths: ["docs/C.md"] }), ["docs/A.md"], "and names nothing where nothing changed");
});

/* A commit that stages a rename carries one path, and it is where the file went. */
test("a staged rename is carried by its new name alone", () => {
  const root = tree();
  git(root, "mv", "docs/C.md", "docs/D.md");
  assert.ok(stagedIn(root).includes("docs/D.md"));
  assert.ok(!stagedIn(root).includes("docs/C.md"));
});

test("a root git cannot answer for is not an empty index", () => {
  const room = tempRoom("codex-demand-bare-");
  rooms.push(room);
  assert.equal(stagedIn(room), null, "no repository there");
  assert.deepEqual(demandOf(room, ["docs/A.md"], {}), ["docs/A.md"], "so the record stands whole");
});

/* Two probes and not one, because the second answers about a path a commit would carry nothing of:
   `docs/B.md` differs from the index and is staged nowhere, which is why a write at the bytes read
   cannot be judged on the working copy against the index alone (ISS-1005). */
test("what a commit would carry apart from the working copy needs the index asked twice", () => {
  const root = tree();
  assert.deepEqual(apartFrom(root, ["docs/B.md"]), ["docs/B.md"], "the working copy differs from the index");
  assert.equal(stagedApart(root, "docs/B.md"), false, "and a commit with no -a carries nothing of it");
  assert.equal(stagedApart(root, "docs/A.md"), false, "the staged copy here is the copy on disk");
  assert.equal(stagedApart(root, "docs/C.md"), false, "and nothing was written to this one at all");
  writeFileSync(join(root, "docs/A.md"), "staged, then written again\n");
  assert.equal(stagedApart(root, "docs/A.md"), true, "now the index holds a copy that is not the one on disk");

  const room = tempRoom("codex-apart-bare-");
  rooms.push(room);
  assert.equal(stagedApart(room, "docs/A.md"), true, "a root git will not read says nothing is proven read");
  writeFileSync(join(room, ".git"), "gitdir: nowhere\n");
  assert.equal(stagedApart(room, "docs/A.md", { staged: ["docs/A.md"] }), true,
    "and a caller's own staged list does not stand in for the probe it cannot make");
});

/* Codex's F3: the supplementary read for `-a` or a pathspec failed into "no more files", so a
   partial answer read as a whole one and the record it should have stood on was filtered away. */
test("a supplementary read git refuses leaves no partial answer", () => {
  const root = tree();
  assert.equal(stagedIn(root, { paths: ["/etc/hosts"] }), null, "a pathspec outside the repository");
  assert.deepEqual(demandOf(root, ["docs/A.md", "docs/B.md"], { paths: ["/etc/hosts"] }), ["docs/A.md", "docs/B.md"]);
});

test("the demand is the record intersected with what the commit carries", () => {
  const root = tree();
  const record = ["docs/A.md", "docs/B.md"];
  assert.deepEqual(demandOf(root, record, {}), ["docs/A.md"]);
  assert.deepEqual(demandOf(root, record, { all: true }), record, "`-a` carries both");
  assert.deepEqual(demandOf(root, [], {}), [], "an empty record asks for nothing");
  assert.deepEqual(demandIn(record, null), record, "and an unanswerable index asks for all of it");
  assert.deepEqual(demandIn(record, []), [], "a commit with nothing staged asks for none of it");
});

const forge = (root, home, ...argv) =>
  spawnSync(process.execPath, [CLI, "codex", ...argv], {
    encoding: "utf8",
    cwd: root,
    env: { ...process.env, ...ENV, XDG_CONFIG_HOME: home },
  });

const stateOf = (entries) => {
  const home = tempRoom("codex-demand-home-");
  rooms.push(home);
  mkdirSync(join(home, "forge"), { recursive: true });
  const turns = Object.fromEntries(Object.entries(entries)
    .map(([root, files]) => [root, { files, at: Date.now() - 120_000 }]));
  writeFileSync(join(home, "forge", "codex.json"), JSON.stringify({ turns }));
  return home;
};

const state = (root, files) => stateOf({ [root]: files });

/* `pending` reported one file, dropping it changed nothing, and the refusal named 726 others. */
test("`codex pending` prints the set a commit made now is asked for", () => {
  const root = tree();
  const home = state(root, ["docs/A.md", "docs/B.md"]);
  const out = forge(root, home, "pending");
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^docs\/A\.md$/mu, "the staged one");
  assert.doesNotMatch(out.stdout.split("what a commit made now")[0], /docs\/B\.md/u, "not the unstaged one");
  assert.match(out.stdout, /recorded and not staged, which a commit takes only with -a or a pathspec: docs\/B\.md/u);
});

/* `nothing pending` here and a commit refused for the same file are two answers about two records,
   and a run reading either alone cannot tell: the record sits under XDG_CONFIG_HOME and the gate
   reads the session's (ISS-189). */
test("the listing names the configuration directory it read, with files to list and with none", () => {
  const root = tree();
  const home = state(root, ["docs/A.md"]);
  const listed = forge(root, home, "pending");
  assert.equal(listed.status, 0, listed.stderr);
  assert.ok(listed.stdout.includes(`read from ${join(home, "forge")}`), listed.stdout);
  const other = tempRoom("codex-demand-other-home-");
  rooms.push(other);
  const empty = forge(root, other, "pending");
  assert.equal(empty.status, 0, empty.stderr);
  assert.match(empty.stdout, /^nothing pending$/mu, "that record holds nothing for this tree");
  assert.ok(empty.stdout.includes(`read from ${join(other, "forge")}`),
    `an empty answer says which record it is about: ${empty.stdout}`);
});

/* The mailpilot session's `dropped 1 unconsulted file(s)` changed nothing the gate compared: the drop
   cleared the index while the gate read the tree. The record's own set is what goes now, which is
   that complaint's own answer and was unreachable while the commit was the only door asking. */
test("`codex pending --drop` clears the record's own set, staged and unstaged alike", () => {
  const root = tree();
  const home = state(root, ["docs/A.md", "docs/B.md"]);
  const out = forge(root, home, "pending", "--drop");
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /dropped 2 recorded file\(s\), 2 of which no consult had read/u);
  assert.match(forge(root, home, "pending").stdout, /^nothing pending$/mu, "and the next call is offered none of it");
});

/* The listing named `--drop` and `--drop` declined, so the one command all three surfaces offer left
   the state they described exactly as it was, however many times it was run (ISS-392). */
test("`--drop` clears a record with nothing of it staged rather than declining", () => {
  const root = tree();
  git(root, "reset", "-q");
  const home = state(root, ["docs/A.md", "docs/B.md"]);
  const out = forge(root, home, "pending", "--drop");
  assert.equal(out.status, 0, out.stderr);
  assert.doesNotMatch(out.stdout, /nothing to drop/u, "the escape the refusals name is one this record can take");
  assert.match(out.stdout, /dropped 2 recorded file\(s\)/u);
  assert.match(forge(root, home, "pending").stdout, /^nothing pending$/mu, "and the record it described is gone");
});

/* Checkout isolation and not run isolation: two sessions standing in one checkout share the entry a
   drop takes, and the usage row is where that is said rather than here. */
test("a drop reaches this checkout's entry and no other checkout's", () => {
  const root = tree();
  const other = tree();
  const home = stateOf({ [root]: ["docs/A.md", "docs/B.md"], [other]: ["docs/A.md"] });
  assert.equal(forge(root, home, "pending", "--drop").status, 0);
  assert.match(forge(other, home, "pending").stdout, /1 file\(s\) recorded/u, "the other checkout's entry stands");
  assert.match(forge(root, home, "pending").stdout, /^nothing pending$/mu, "and this one's is gone");
});

test("the listing offers the drop at the count it takes, and `-h` says the scope before it is spent", () => {
  const root = tree();
  const home = state(root, ["docs/A.md", "docs/B.md"]);
  assert.match(forge(root, home, "pending").stdout, /`forge codex pending --drop` discards all 2 unread\./u,
    "the count offered is the count the drop takes, so the line and the verb cannot disagree");
  const help = forge(root, home, "pending", "-h");
  assert.match(`${help.stdout}${help.stderr}`, /--drop +discard every path this checkout's record still holds/u,
    "and a caller reading -h before discarding is told that scope, not the commit's subset");
});

/* A path a rename took out of the tree was reported by every later consult as work owed, and the
   only verb against it declined for not being staged (ISS-952). */
const logging = (home, root, sent) => writeFileSync(join(home, "forge", "codex-log.jsonl"), `${JSON.stringify({
  kind: "consult", id: "c1", ok: true, root, at: new Date(Date.now() - 300_000).toISOString(),
  reply: "no blocker found", files: sent.map((one) => one.rel), sent,
})}\n`);

/* Two different facts about one record: what a reader let go, and how much of it nobody had looked
   at. A reader told only the first cannot tell a tidy-up from a review skipped. */
test("the drop names how many files went and how many of those no consult had read", () => {
  const root = tree();
  const home = state(root, ["docs/A.md", "docs/C.md"]);
  logging(home, root, [{ rel: "docs/C.md", sha: digest(readFileSync(join(root, "docs/C.md"), "utf8")), clipped: false }]);
  const out = forge(root, home, "pending", "--drop");
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /dropped 2 recorded file\(s\), 1 of which no consult had read/u);
  assert.match(forge(root, home, "pending").stdout, /^nothing pending$/mu,
    "and the already-read one left the record with the rest, rather than being counted and kept");
});

test("a recorded path the tree no longer holds leaves the record when the listing reads it", () => {
  const root = tree();
  const home = state(root, ["docs/A.md", "docs/GONE.md"]);
  const out = forge(root, home, "pending");
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^docs\/A\.md$/mu, "the staged write is still asked for");
  assert.match(out.stdout, /no longer in the tree, so out of the record now: docs\/GONE\.md/u);
  assert.doesNotMatch(forge(root, home, "pending").stdout, /GONE/u, "and the next call is not offered it");
});

test("the record's own listing keeps a file written back to the read bytes apart from what a commit is asked for", () => {
  const root = tree();
  const home = state(root, ["docs/A.md", "docs/C.md"]);
  logging(home, root, [{ rel: "docs/C.md", sha: digest(readFileSync(join(root, "docs/C.md"), "utf8")), clipped: false }]);
  const out = forge(root, home, "pending");
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^docs\/A\.md$/mu, "the write nobody read is asked for");
  assert.match(out.stdout, /^recorded and read at the bytes a commit would carry, so none is held for them: docs\/C\.md$/mu);
  assert.doesNotMatch(out.stdout.split("what a commit made now")[0], /docs\/C\.md/u, "and it is not in the demand");
});

/* Reviewed bytes on disk with the unread write still in the index: `pending` and the gate have to
   answer alike, or a caller is told no commit is held for a file the next commit is refused for. */
test("a file whose unread write is staged is asked for however the working copy reads", () => {
  const root = tree();
  const home = state(root, ["docs/A.md"]);
  const staged = readFileSync(join(root, "docs/A.md"), "utf8");
  logging(home, root, [{ rel: "docs/A.md", sha: digest("docs/A.md\n"), clipped: false }]);
  writeFileSync(join(root, "docs/A.md"), "docs/A.md\n");
  assert.deepEqual(apartFrom(root, ["docs/A.md"]), ["docs/A.md"], `the index still holds ${staged.trim()}`);
  const out = forge(root, home, "pending");
  assert.match(out.stdout, /^docs\/A\.md$/mu, "so the commit is still asked for it");
  assert.doesNotMatch(out.stdout, /no commit is held/u, "and it is not called read");
});

/* A base that moved under the branch parts from it, and a deletion both sides made is no change
   against the ref while being real work against the point they parted at. */
test("what no write stands behind is asked of the base the review was taken from", () => {
  const root = realpathSync(tempRoom("codex-parted-"));
  rooms.push(root);
  mkdirSync(join(root, "docs"), { recursive: true });
  for (const one of ["docs/A.md", "docs/C.md"]) writeFileSync(join(root, one), `${one}\n`);
  git(root, "init", "-q", ".");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "both");
  const here = git(root, "rev-parse", "--abbrev-ref", "HEAD").trim();
  git(root, "checkout", "-qb", "side");
  git(root, "rm", "-q", "docs/C.md");
  git(root, "commit", "-qm", "gone on side");
  git(root, "checkout", "-q", here);
  git(root, "rm", "-q", "docs/C.md");
  git(root, "commit", "-qm", "gone here too");
  assert.deepEqual(goneFrom(root, ["docs/C.md"], "side"), ["docs/C.md"], "against the ref it is no change");
  assert.deepEqual(goneFrom(root, ["docs/C.md"], "side", true), [], "against the parting the deletion is work");
  assert.deepEqual(goneFrom(root, ["docs/C.md"], "no-such-ref"), [], "and a git that cannot answer drops none");
});

/* A staged addition whose working copy was removed is in no diff against HEAD and in no untracked
   list, so absence alone read it as a path no write stands behind (consult c39aa9 F1). */
test("a staged addition is work nobody read, whatever became of its working copy", () => {
  const root = tree();
  writeFileSync(join(root, "docs/NEW.md"), "brand new\n");
  git(root, "add", "docs/NEW.md");
  rmSync(join(root, "docs/NEW.md"));
  assert.deepEqual(goneFrom(root, ["docs/NEW.md"]), [], "the index still holds the addition");
  const home = state(root, ["docs/NEW.md"]);
  const out = forge(root, home, "pending");
  assert.match(out.stdout, /^docs\/NEW\.md$/mu, "so a commit made now is asked for it");
  assert.doesNotMatch(out.stdout, /out of the record now/u, "and nothing dropped it");
});

/* The clear after an answer was the last reader still deciding on the working copy: it dropped a
   path whose index held bytes nobody had been shown, so the consult the commit gate asks for is
   what took that gate's own refusal away (ISS-1011). */
const sentOf = (rel, text) => ({ rel, sha: digest(text), chars: text.length, clipped: false });

test("a consult holds a path whose staged copy is not the copy it was sent", () => {
  const root = tree();
  writeFileSync(join(root, "docs/A.md"), "docs/A.md\n");
  const sent = [sentOf("docs/A.md", "docs/A.md\n"), sentOf("docs/B.md", "docs/B.md again\n"), sentOf("docs/C.md", "docs/C.md\n")];
  const { clear, held } = clearableOf(root, sent);
  assert.deepEqual(held, ["docs/A.md"], "the index holds a copy this consult was never shown");
  assert.deepEqual(clear, ["docs/B.md", "docs/C.md"], "nothing stages these two, and both are still the bytes that went up");
});

test("a path staged at the bytes that went up leaves the record", () => {
  const root = tree();
  const { clear, held } = clearableOf(root, [sentOf("docs/A.md", "docs/A.md again\n")]);
  assert.deepEqual(clear, ["docs/A.md"], "what a commit would carry is what the reviewer read");
  assert.deepEqual(held, []);
});

/* Staged-versus-disk alone would approve this one: both hold bytes that went nowhere near the reviewer. */
test("a path written and staged while the consult was in flight is held", () => {
  const root = tree();
  const sent = [sentOf("docs/A.md", "docs/A.md again\n")];
  writeFileSync(join(root, "docs/A.md"), "// what nobody sent\n");
  git(root, "add", "docs/A.md");
  const { clear, held } = clearableOf(root, sent);
  assert.deepEqual(held, ["docs/A.md"], "the index and the disk agree with each other and not with what went up");
  assert.deepEqual(clear, []);
});

test("a repository whose index git will not read holds every path a consult sent", () => {
  const room = tempRoom("codex-clearable-bare-");
  rooms.push(room);
  const sent = [sentOf("docs/A.md", "one\n"), sentOf("docs/B.md", "two\n")];
  assert.deepEqual(clearableOf(room, sent).held, ["docs/A.md", "docs/B.md"], "no answer is no evidence a reviewer saw what would land");
  assert.deepEqual(clearableOf(room, sent).clear, []);
});

test("the line a consult prints names every path it held and the commands that clear one", () => {
  const said = heldSaid(["docs/A.md", "docs/B.md"]);
  assert.match(said, /docs\/A\.md, docs\/B\.md/u, "a count alone leaves a reader nothing to act on");
  assert.match(said, /`git add`/u, "staging what was read is the route no consult can take for you");
  assert.match(said, /`forge codex pending --drop`/u);
});

/* A deletion is what went up for a path with nothing on disk, and holding it on an unreadable copy
   kept a staged removal and a rename's source in the record forever. */
test("a path the tree no longer holds is not held on a copy nobody can read", () => {
  const root = tree();
  git(root, "rm", "-q", "docs/C.md");
  const { clear, held } = clearableOf(root, [{ rel: "docs/C.md", chars: 0, clipped: false }]);
  assert.deepEqual(clear, ["docs/C.md"], "what a commit would carry for it is the deletion the reviewer was shown");
  assert.deepEqual(held, []);
});

/* The other way round: a path deleted under the call went up as content and comes back as absence,
   which is a change nobody was shown rather than the deletion the reviewer read (consult 7bee0a F1). */
test("a path deleted while the consult was in flight is held", () => {
  const root = tree();
  const sent = [sentOf("docs/C.md", "docs/C.md\n")];
  git(root, "rm", "-q", "docs/C.md");
  const { clear, held } = clearableOf(root, sent);
  assert.deepEqual(held, ["docs/C.md"], "it went up as content and the tree no longer holds it");
  assert.deepEqual(clear, []);
});

/* The route a refusal names is `consult --diff`, which is handed nothing for a path carrying no diff,
   so a record over one could never be cleared by the command the refusal printed (ISS-1642). */
test("a recorded path carrying no diff and nothing staged is settled, and one that differs is not", () => {
  const root = tree();
  writeFileSync(join(root, "docs/B.md"), "docs/B.md changed\n");
  assert.deepEqual(settledIn(root, ["docs/C.md"]), ["docs/C.md"], "untouched against HEAD");
  assert.deepEqual(settledIn(root, ["docs/B.md"]), [], "a working-copy change is work a consult reads");
});

test("a staged path is never settled, so the commit door is unmoved", () => {
  const root = tree();
  writeFileSync(join(root, "docs/C.md"), "docs/C.md staged\n");
  git(root, "add", "docs/C.md");
  assert.deepEqual(settledIn(root, ["docs/C.md"]), [], "staged work is owed however the tree reads");
});

test("an untracked file is never settled, whatever the untracked enumeration managed to say", () => {
  const root = tree();
  writeFileSync(join(root, "docs/new.md"), "never committed\n");
  assert.deepEqual(settledIn(root, ["docs/new.md"]), [], "content no commit holds is content a consult reads");
});

test("a git that cannot answer settles nothing, so doubt never retires a record", () => {
  const root = tree();
  assert.deepEqual(settledIn(root, ["docs/C.md"], "no-such-ref"), []);
});
