/* ISS-26's shell died mid-review and its successor read the run's state out of a file written
   outside the repository, because nothing typed could hold it. Every rule below is one fact that
   file carried, and each fails without the check behind it (ISS-44). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

import { tempHome } from "../fixtures.mjs";

const HOME = tempHome("worklog");
process.env.XDG_CONFIG_HOME = HOME.path;
process.env.AI_AGENT = "a-test-agent";
process.env.CLAUDE_PID = "4242";
const {
  KEY, OPEN_KEPT, capturedLine, gitNow, merged, owedOn, patchFrom, worklogFor, worklogLines, worklogOf,
} = await import("../../src/flow/worklog.mjs");
const { claimed, leaseOf } = await import("../../src/flow/lease.mjs");

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const AT = "2026-09-03T02:00:00.000Z";
const field = (worklog, lease = null) => ({ ...(lease ? { lease } : {}), [KEY]: worklog });
const lines = (many) => Array.from({ length: many }, (one, at) => `line ${at + 1}`);

test("the block is read out of the field, and anything else in it is no worklog", () => {
  assert.deepEqual(worklogOf(field({ branch: "iss-44-resume", head: "abc1234", at: AT })), {
    branch: "iss-44-resume", head: "abc1234", at: AT,
  });
  assert.equal(worklogOf(null), null, "an issue nobody has written one for");
  assert.equal(worklogOf({ lease: { holder: "a-run" } }), null, "a field holding only a lease");
  assert.equal(worklogOf(field({})), null, "and an empty block is no block");
  assert.equal(worklogOf(field({ open: "not a list" })), null);
  assert.deepEqual(worklogOf(field({ open: ["one\ntwo", "  ", "three"] })).open, ["one two", "three"],
    "a line is one line, and nothing is not a line");
});

/* A patch spread over the block would replace the appended list with the one line being added, and
   every dead end already recorded would go with it. */
test("a patch merges field by field, and an open line is appended rather than replacing them", () => {
  const held = { branch: "iss-44-resume", head: "aaa1111", open: ["the first dead end"] };
  const one = merged(held, { head: "bbb2222", open: ["the second"] });
  assert.equal(one.worklog.head, "bbb2222", "a named field is replaced");
  assert.equal(one.worklog.branch, "iss-44-resume", "one the patch is silent about is kept");
  assert.deepEqual(one.worklog.open, ["the first dead end", "the second"], "and the lines grow");
  assert.deepEqual(merged(held, null).worklog, held, "no patch changes nothing");
  assert.deepEqual(merged(null, { head: "aaa1111" }).worklog, { head: "aaa1111" }, "and a first write needs no block");
});

/* One capture cannot leave another's fact standing beside it: a branch with no base resolvable and
   nothing diffed would otherwise keep the last capture's base and files and be stamped as fresh. */
test("a fresh capture clears a git fact that is no longer true, rather than keeping the old one", () => {
  const held = { branch: "old", head: "aaa1111", base: "ccc3333", touched: "src/one.mjs", at: AT };
  const one = merged(held, { branch: "new", head: "bbb2222", base: null, touched: null, at: "2026-09-03T03:00:00.000Z" });
  assert.equal(one.worklog.base, undefined, "a null in the patch clears the field");
  assert.equal(one.worklog.touched, undefined);
  assert.equal(one.worklog.branch, "new", "and the ones it does know are replaced");
  assert.deepEqual(Object.keys(gitNow()).sort(), ["at", "base", "branch", "files", "head", "touched"],
    "so a capture names every git field, absent ones included");
});

test("past the cap the oldest open line is dropped, and which one is handed back to be said", () => {
  const full = { open: lines(OPEN_KEPT) };
  const over = merged(full, { open: ["the newest"] });
  assert.equal(over.worklog.open.length, OPEN_KEPT, `${OPEN_KEPT} is the cap`);
  assert.deepEqual(over.dropped, ["line 1"], "the oldest goes, and the caller is told which");
  assert.equal(over.worklog.open.at(-1), "the newest", "and the newest is kept");
  assert.deepEqual(merged(full, { open: [] }).dropped, [], "nothing added drops nothing");
  const many = merged(full, { open: ["one more", "and another"] });
  assert.deepEqual(many.dropped, ["line 1", "line 2"], "two added drop two");
});

/* claimed() rebuilds the lease from the keys it names and spreads the rest of the field, so the
   block rides the same whole-field compare-and-set with no second write path. */
test("the block rides beside the lease under one field, and a lease write keeps it", () => {
  const context = field({ head: "aaa1111" }, { holder: "one", renewedAt: AT, minutes: 30, history: [] });
  const next = claimed(context, { holder: "one", at: AT, minutes: 30 });
  assert.deepEqual(worklogOf(next), { head: "aaa1111" }, "a renew that says nothing about it keeps it");
  assert.equal(leaseOf(next).holder, "one");
  const written = claimed(context, { holder: "one", at: AT, minutes: 30, worklog: { head: "bbb2222" } });
  assert.deepEqual(worklogOf(written), { head: "bbb2222" });
  assert.ok(Object.hasOwn(written, KEY) && Object.hasOwn(written, "lease"), "both keys, one field");
});

test("the merge that a write makes is the one the caller is told about", () => {
  const context = field({ open: lines(OPEN_KEPT) });
  const block = worklogFor(context, { open: ["the newest"] });
  assert.equal(block.open.length, OPEN_KEPT);
  assert.equal(worklogFor(null, null), undefined, "and nothing to write is nothing, not an empty block");
});

/* Read from git at the moment it is written and from nowhere at read time: a check that read the
   tree would answer differently on every machine that ran it. */
test("the git block is what git said when it was asked, with the time it was asked", () => {
  const now = gitNow();
  assert.ok(now, "this suite runs inside a checkout");
  assert.match(now.head, /^[0-9a-f]{40}$/u, "the head, whole");
  assert.ok(now.branch, "and the branch it is on");
  assert.match(now.at, /^\d{4}-\d\d-\d\dT/u, "stamped, so a reader can tell a stale block");
  assert.equal(gitNow.length, 0, "it takes nothing: there is no reading it from anywhere else");
});

test("a patch is built only from what was asked for, and nothing else is invented", () => {
  assert.equal(patchFrom({}), null, "a write that captures nothing writes no block");
  assert.deepEqual(patchFrom({ open: ["a dead end"] }), { open: ["a dead end"] });
  /* A branch ahead of its base is captured whole; a head that is its own base writes no block. */
  const now = gitNow();
  const block = patchFrom({ pushed: true });
  if (now.touched && now.base && now.base !== now.head) {
    assert.ok(block.head, "--pushed is the git block");
    assert.equal(block.review, undefined, "and says nothing about the review");
  } else {
    assert.equal(block, null, "a capture that captures nothing writes no block");
  }
});

/* The log records rulings and verdicts, not rounds; what it can answer is whether anything is
   undecided and whether the last word was a recheck. */
test("what the review owes is read from the log, and a clean word is only a recheck's", () => {
  const entry = (extra) => ({ root: "/nowhere", id: "abc123", ok: true, reply: "CODEX: 0 findings", ...extra });
  assert.equal(owedOn([], entry({ recheck: true })), "clean");
  assert.match(owedOn([], entry({ recheck: false })), /recheck owed/u,
    "a diff-limited round that found nothing has not judged the whole set");
  const found = entry({ recheck: true, reply: "CODEX: 1 findings\n- **F1 — major:** x" });
  assert.equal(owedOn([], found), "verdict owed", "a finding nobody decided is a verdict owed");
  const decided = [found, { kind: "verdict", of: "abc123", kept: ["F1"], dropped: {}, accepted: 1, rejected: 0 }];
  assert.equal(owedOn(decided, found), "recheck owed",
    "and one folded still owes the round that finds none");
});

test("the block prints one line per fact, and a fact nobody wrote is left out", () => {
  const said = worklogLines({ branch: "b", head: "h", review: { consult: "abc123", recheck: true, findings: 0, owed: "clean" } }, "the step");
  assert.deepEqual(said.map((one) => one.split(/\s{2,}/u)[0]), ["next", "branch", "head", "review"]);
  assert.match(said.at(-1), /consult abc123, recheck, 0 finding\(s\), clean/u);
  assert.deepEqual(worklogLines(null, null), [], "an issue with no worklog and no line prints no section");
  assert.deepEqual(worklogLines(null, "the step"), ["next        the step"], "the line alone is a worklog of one fact");
  assert.ok(!worklogLines({ branch: "b" }, null).some((one) => /touched|captured|review/u.test(one)),
    "and absence is absence rather than an empty label");
});

/* An input read and silently dropped is the family ISS-2 found six of: a capture asked for is made,
   refused, or said aloud, and never quietly skipped. */
test("--pushed outside a checkout is refused, naming the directory it was asked in", () => {
  const outside = spawnSync(FORGE, ["claim", "ISS-1", "--pushed"], { encoding: "utf8", env: process.env, cwd: tmpdir() });
  assert.equal(outside.status, 1, outside.stdout);
  assert.match(outside.stderr, /--pushed reads the branch and head from git/u);
  assert.match(outside.stderr, new RegExp(tmpdir(), "u"), "and says where it looked");
});

/* The refusal said report carries no capture flag, and then let one through whenever the log had
   nothing to give: what an input was is not what it produced. */
test("record report refuses a capture flag it was given, whatever the log had to say", () => {
  const run = spawnSync(FORGE, ["record", "report", "ISS-1", "--review"], { encoding: "utf8", env: process.env });
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /record report writes nothing/u);
  assert.match(run.stderr, /--review/u, "and names the flag it will not take");
});

/* Three captures after a fast-forward wrote base equal to head and no touched set, in silence, over
   two dry runs; two complete ones printed nothing either, so the flag's own author ran `forge
   resume` to see whether it had worked (ISS-65, ISS-66). */
test("a capture says in one line what it holds", () => {
  const held = { branch: "iss-65-rounds", head: "a9288a6fd11", base: "4e41dfd881e", touched: "one.mjs, two.mjs", files: 2, at: "2026-09-03T15:00:00.000Z" };
  assert.equal(capturedLine(held), "--pushed: iss-65-rounds at a9288a6, base 4e41dfd, 2 file(s) touched.");
  /* Counted from the list, never off the joined line: one name with ", " in it reads as two. */
  assert.match(capturedLine({ ...held, files: undefined }), /nothing to capture/u);
});

test("a capture that captured nothing says so, and its worklog is not written", () => {
  const empty = { branch: "master", head: "4e41dfd881e", base: "4e41dfd881e", touched: null, at: "2026-09-03T15:00:00.000Z" };
  const why = [[empty, /the base is the head/u], [{ ...empty, base: null }, /no base/u],
    [{ ...empty, base: "0000000" }, /no file does/u], [null, /git answered nothing/u],
    [{ ...empty, base: "0000000", files: null }, /would not read the diff/u]];
  for (const [one, said] of why) {
    assert.match(capturedLine(one), /nothing to capture/u, JSON.stringify(one));
    assert.match(capturedLine(one), said, "and the cause it states is the one that holds");
    assert.match(capturedLine(one), /The worklog is unchanged/u);
    assert.match(capturedLine(one), /before the merge/u, "and the command that would have captured it");
  }
  assert.equal(merged({ branch: "iss-65-rounds" }, null).worklog.branch, "iss-65-rounds",
    "a patch nobody made leaves the last capture alone");
});

test("the two captures and the open line are on the flag list of both verbs that write", () => {
  for (const argv of [["claim", "-h"], ["record", "-h"]]) {
    const run = spawnSync(FORGE, argv, { encoding: "utf8", env: process.env });
    assert.equal(run.status, 0, run.stderr);
    for (const flag of ["--pushed", "--review", "--open"]) {
      assert.ok(run.stdout.includes(flag), `${argv[0]} -h does not name ${flag}`);
    }
  }
});
