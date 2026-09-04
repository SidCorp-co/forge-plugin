import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* Imported after XDG_CONFIG_HOME moves: the live config directory holds a working token. */
const sandbox = mkdtempSync(join(tmpdir(), "forge-codex-plan-"));
process.env.XDG_CONFIG_HOME = sandbox;

const {
  budgetFor,
  effortFor,
  incompleteIn,
  isNewFinding,
  newFindingsIn,
  plannedFor,
} = await import("../../src/codex/codex-plan.mjs");
const { rebuiltFrom, replayOf, statsOf, windowOf } = await import("../../src/codex/codex-stats.mjs");
const { digest, promptMark, roleFor } = await import("../../src/codex/codex-api.mjs");

const LIMITS = { base: 3, ceiling: 5, small: 40, large: 400 };

/* A whole-file pass holds what it was asked about, so the call it would have spent fetching is not
   owed; a clipped part is the one thing that reliably costs a retrieval round. */
test("the budget comes off the payload, not off a constant", () => {
  assert.equal(budgetFor({ ...LIMITS }), 3, "a diff pass gets the base");
  assert.equal(budgetFor({ ...LIMITS, bodies: true }), 2, "a bodies pass has nothing to fetch");
  assert.equal(budgetFor({ ...LIMITS, bodies: true, clipped: 1 }), 4, "clipped is not whole, so it fetches");
  assert.equal(budgetFor({ ...LIMITS, clipped: 2 }), 5);
  assert.equal(budgetFor({ ...LIMITS, clipped: 9 }), 5, "the ceiling is the ceiling");
  assert.equal(budgetFor({ base: 2, ceiling: 5, bodies: true }), 2, "two is the floor: one to look, one to answer");
});

/* A ceiling below the base would silently cap every consult under what the caller configured. */
test("a ceiling under the base does not lower the base", () => {
  assert.equal(budgetFor({ base: 4, ceiling: 2 }), 4);
});

test("effort steps one level, and the round outranks the size", () => {
  assert.equal(effortFor({ base: "medium", lines: 100, small: 40, large: 400 }), "medium");
  assert.equal(effortFor({ base: "medium", lines: 12, small: 40, large: 400 }), "low");
  assert.equal(effortFor({ base: "medium", lines: 900, small: 40, large: 400 }), "high");
  assert.equal(effortFor({ base: "medium", recheck: true, lines: 900, small: 40, large: 400 }), "low",
    "a recheck is a narrower question whatever the diff's size");
  assert.equal(effortFor({ base: "high", lines: 900, small: 40, large: 400 }), "high", "clamped at the top");
  assert.equal(effortFor({ base: "minimal", recheck: true }), "minimal", "and at the bottom");
});

/* The predicate is the field on the row, the retry's trigger and a stats line at once, so the one
   thing it must never match is the ruling the verify grammar asks for on an undecidable risk —
   a retry there buys the same answer at twice the price. */
test("an unfinished review is told from a CANNOT TELL ruling", () => {
  assert.equal(incompleteIn("I could not verify the caller within the calls I had."), true);
  assert.equal(incompleteIn("No further tool calls were served, so the test is unread."), true);
  assert.equal(incompleteIn("my tool budget was exhausted"), true);
  assert.equal(incompleteIn("1. **CANNOT TELL** — nothing in the diff decides it."), false);
  assert.equal(incompleteIn("2. **CANNOT TELL** — the risk needs the caller, which I was not given."), false);
  assert.equal(incompleteIn("CODEX: 0 findings"), false);
  assert.equal(incompleteIn("I could not run the repository check or inspect the tests after "
    + "further repository access was withdrawn."), true, "the phrasing a real reply used");
  assert.equal(incompleteIn("A new guard cannot read a stale value."), false,
    "a finding about code is not the reviewer saying it ran short");
  assert.equal(incompleteIn("The caller cannot verify the token, which is the defect."), false);
});

test("a New finding is counted off its bullet head and not off its prose", () => {
  assert.equal(isNewFinding("New — major: `a.mjs:3` — the guard is gone"), true);
  assert.equal(isNewFinding("Still open — major: `a.mjs:3` — a new guard would fix it"), false);
  assert.equal(newFindingsIn([{ text: "New — blocker: x" }, { text: "Still open — minor: y" }]), 1);
});

const partsOf = (given) => given.map((one) => ({ rel: one.rel, text: one.text ?? "", ...one }));

test("what the caller asked for is used as asked, and only the rest is derived", () => {
  const parts = partsOf([{ rel: "a.mjs", text: "x\n".repeat(10), clipped: true, chars: 90_000 }]);
  const derived = plannedFor({ parts, bodies: false, recheck: false });
  assert.equal(derived.budget, 4, "one clipped part earns a call");
  assert.deepEqual(derived.clipped, ["a.mjs"]);
  const asked = plannedFor({ parts, bodies: false, recheck: false, asked: 1, effort: "high" });
  assert.equal(asked.budget, 1, "--rounds is used as given");
  assert.equal(asked.effort, "high", "--effort is used as given");
  assert.equal(asked.ceiling, 1, "and no retry spends calls past what was asked for");
});

/* The size an effort is priced on: a diff's own moved lines where there is one, the body otherwise. */
test("the change's size is the diff where there is one and the body where there is not", () => {
  const withDiff = plannedFor({
    parts: [{ rel: "a.mjs", text: "x\n".repeat(500), diff: { text: "@@\n+one\n+two\n-three\n context\n" } }],
    bodies: false,
    recheck: false,
  });
  assert.equal(withDiff.lines, 3, "context and the hunk header are not the change");
  const whole = plannedFor({ parts: [{ rel: "a.mjs", text: "x\n".repeat(499) }], bodies: true, recheck: false });
  assert.equal(whole.lines, 500);
  assert.equal(whole.effort, "high", "a whole-file pass over the large mark is worth more thinking");
});

test("an unchanged file is no part of the change's size", () => {
  const held = plannedFor({
    parts: [{ rel: "a.mjs", text: "x\n".repeat(900), diff: { unchanged: true } }],
    bodies: false,
    recheck: false,
  });
  assert.equal(held.lines, 0);
  assert.equal(held.effort, "medium", "with nothing to price, the base stands");
});

test("the system prompt carries a version and a digest, and the recheck clause is only a recheck's", () => {
  const pass = roleFor(["tech"], {});
  const again = roleFor(["tech"], { recheck: true });
  assert.equal(pass.includes("THIS IS A RECHECK"), false);
  assert.match(again, /THIS IS A RECHECK/u);
  assert.match(again, /naming why it was not visible to you before/u);
  assert.equal(promptMark(pass).v, 2);
  assert.equal(promptMark(pass).sha, digest(pass));
  assert.notEqual(promptMark(pass).sha, promptMark(again).sha, "a clause that changes is a digest that changes");
});

const ROW = (held = {}) => ({ kind: "consult", ok: true, at: "2026-09-04T00:00:00.000Z", reply: "CODEX: 0 findings", root: "/r", usage: {}, ...held });

/* A window before a change and a window after it, read the same way: a row that predates a field is
   counted from its reply, or the before window would look like a harness with no problems. A budget
   is the one thing that cannot be recovered that way — `--rounds` was always settable — so it is
   left unknown, and the calls histogram is what carries the cap's signature instead. */
test("stats read a row that predates the fields from its own reply", () => {
  const rows = [
    ROW({ calls: 3, reply: "I could not check the caller." }),
    ROW({ calls: 3, recheck: true, files: ["a.mjs"], reply: "- **F1 — New — major:** `a.mjs:1` — gone" }),
    ROW({ calls: 1, budget: 3, incomplete: false, attempt: 1, prompt: { v: 2, sha: "abc" } }),
  ];
  const held = statsOf(rows);
  assert.equal(held.consults, 3);
  assert.equal(held.budgeted, 1, "only the row that recorded a budget has one");
  assert.equal(held.atBudget, 0, "and it did not reach it");
  assert.deepEqual(held.calls, [[1, 1], [3, 2]], "the calls histogram needs no budget at all");
  assert.equal(held.incomplete, 1);
  assert.equal(held.rechecks, 1);
  assert.equal(held.raisedNew, 1);
  assert.deepEqual(held.versions, [["unversioned", 2], ["v2 abc", 1]]);
});

test("a recorded field is believed over the reply it was read from", () => {
  const held = statsOf([ROW({ calls: 3, budget: 3, incomplete: false, reply: "I could not check the caller." })]);
  assert.equal(held.incomplete, 0);
  assert.equal(held.atBudget, 1, "and a recorded budget is counted against");
});

/* A three-call exhaustion answered by a one-call retry is a consult that DID end at a budget, and a
   row that reported only the answering attempt read as one that never came near it. */
test("stats count a retry and the tokens both attempts spent", () => {
  const held = statsOf([
    ROW({ calls: 5, budget: 5, attempt: 2, usage: { input_tokens: 800, cache_read_input_tokens: 200 } }),
  ]);
  assert.equal(held.retried, 1);
  const short = statsOf([ROW({ calls: 1, budget: 5, attempt: 2, retriedFrom: 3 })]);
  assert.equal(short.atBudget, 1, "the attempt it left behind ended at its own budget");
  assert.equal(held.sent, 1000);
  assert.equal(Math.round(held.cached * 100), 20);
});

test("a window is the last n consults, or the days asked for, and never another root's", () => {
  const old = ROW({ at: new Date(Date.now() - 5 * 86_400_000).toISOString() });
  const recent = ROW({ at: new Date().toISOString(), root: "/other" });
  assert.equal(windowOf([old, recent], { last: 1 }).length, 1);
  assert.equal(windowOf([old, recent], { days: 1 }).length, 1);
  assert.equal(windowOf([old, recent], { root: "/other" }).length, 1);
});

/* The log keeps each sent file's digest and not its bytes, so a replay set is only what git can
   still produce byte for byte — and saying how much of the window that is not is the point. */
const REPO = join(sandbox, "repo");
mkdirSync(REPO, { recursive: true });
const git = (...argv) => spawnSync("git", argv, { cwd: REPO, encoding: "utf8" });
git("init", "-q");
git("config", "user.email", "t@example.com");
git("config", "user.name", "t");
writeFileSync(join(REPO, "a.mjs"), "const one = 1;\n");
git("add", "a.mjs");
git("commit", "-qm", "one");
const HEAD = git("rev-parse", "--short", "HEAD").stdout.trim();

test("a replay keeps only the consults whose bytes still hash to what was sent", () => {
  const clean = ROW({ id: "aaa", root: REPO, head: HEAD, send: "diffs", sent: [{ rel: "a.mjs", sha: digest("const one = 1;\n"), chars: 15 }] });
  const dirty = ROW({ id: "bbb", root: REPO, head: HEAD, send: "diffs", sent: [{ rel: "a.mjs", sha: "0000deadbeef", chars: 15 }] });
  const gone = ROW({ id: "ccc", root: join(sandbox, "no-such-checkout"), head: HEAD, send: "diffs", sent: [{ rel: "a.mjs", sha: "x" }] });
  assert.ok(rebuiltFrom(clean).parts, "the bytes are still there");
  assert.match(rebuiltFrom(dirty).why, /dirty/u);
  assert.match(rebuiltFrom(gone).why, /checkout gone/u);
  const held = replayOf([clean, dirty, gone]);
  assert.equal(held.kept.length, 1);
  assert.equal(held.lost.reduce((many, [, one]) => many + one.many, 0), 2, "and the window says what it lost");
});

/* A replay that returned the body for a consult that was sent a diff would compare a prompt against
   a payload nobody was given. Where the row names a base, the diff is rebuilt from it. */
test("an anchored consult is rebuilt with its diff and not only its body", () => {
  writeFileSync(join(REPO, "a.mjs"), "const one = 1;\nconst two = 2;\n");
  git("add", "a.mjs");
  git("commit", "-qm", "two");
  const head = git("rev-parse", "--short", "HEAD").stdout.trim();
  const row = ROW({
    root: REPO,
    head,
    anchoredTo: HEAD,
    send: "diffs",
    sent: [{ rel: "a.mjs", sha: digest("const one = 1;\nconst two = 2;\n"), chars: 30 }],
  });
  const held = rebuiltFrom(row);
  assert.ok(held.parts, "the bytes still hash to what was sent");
  assert.match(held.parts[0].diff, /\+const two = 2;/u, "and the change is what was under review");
  assert.equal(held.sends, "diffs");
  assert.equal(rebuiltFrom({ ...row, anchoredTo: undefined }).parts[0].diff, null, "an unanchored row has none");
});

test("a consult with no commit recorded cannot be replayed at all", () => {
  assert.match(rebuiltFrom(ROW({ root: REPO, sent: [{ rel: "a.mjs", sha: "x" }] })).why, /no commit/u);
});

/* A row from before `send` existed took the diffs default, which is the same unfaithful comparison
   the shape check was added for: a bodies consult scored as a diff one. */
test("a row that never recorded what shape it was sent in is not replayable", () => {
  const held = rebuiltFrom(ROW({ root: REPO, head: HEAD, sent: [{ rel: "a.mjs", sha: digest("const one = 1;\n"), chars: 15 }] }));
  assert.match(held.why, /shape it was sent in was not recorded/u);
});

/* An anchor git cannot resolve answers with an empty stdout and a nonzero status; reading the text
   alone would call it a file that did not change. */
test("a base git cannot resolve is a lost row, not an empty diff", () => {
  const held = rebuiltFrom(ROW({
    root: REPO,
    head: HEAD,
    anchoredTo: "0000000",
    send: "diffs",
    sent: [{ rel: "a.mjs", sha: digest("const one = 1;\n"), chars: 15 }],
  }));
  assert.match(held.why, /anchored to is gone/u);
});
