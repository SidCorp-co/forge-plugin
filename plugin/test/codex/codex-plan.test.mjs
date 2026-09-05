import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tempRoom } from "../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves: the live config directory holds a working token. */
const sandbox = tempRoom("forge-codex-plan-");
process.env.XDG_CONFIG_HOME = sandbox;

const {
  budgetFor,
  effortFor,
  incompleteIn,
  isNewFinding,
  newFindingsIn,
  plannedFor,
} = await import("../../src/codex/codex-plan.mjs");
const {
  changedBetween,
  evalLines,
  evalWindows,
  printEval,
  rebuiltFrom,
  replayOf,
  statsOf,
  windowOf,
} = await import("../../src/codex/codex-stats.mjs");
const { LOG_PATH } = await import("../../src/codex/codex-log.mjs");
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

/* Two windows of a hundred, each one row per model-and-prompt, off the readers `stats` and
   `log --score` already spend. The verdicts are handed in whole: one is written after the consult
   it scores and lands outside the window as often as inside, and a window scored on its own rows
   reports every model 0 kept — which reads as a log nobody ruled on rather than as a defect. */
const WINDOWED = (n) => ROW({
  id: `w${n}`,
  at: new Date(Date.UTC(2026, 8, 1) + n * 60_000).toISOString(),
  slot: "codex",
  model: n < 150 ? "old-model" : "new-model",
  effort: "medium",
  ms: 20_000,
  usage: { input_tokens: 1000, cache_read_input_tokens: 500, cache_creation_input_tokens: 0, output_tokens: 200 },
  prompt: { v: 2, sha: n < 150 ? "aaa" : "bbb" },
  reply: "- **F1 — major:** `a.mjs:1` — a thing\nCODEX: 1 findings",
});
const SCORED = (n) => ({ kind: "verdict", of: `w${n}`, accepted: 1, rejected: 0, kept: ["F1"], dropped: {} });

test("the eval is the last hundred against the hundred before, scored on the whole log's verdicts", () => {
  const rows = Array.from({ length: 250 }, (one, n) => WINDOWED(n));
  const verdicts = rows.map((one, n) => SCORED(n));
  const { now, before } = evalWindows([...rows, ...verdicts]);
  assert.equal(now.length, 100);
  assert.equal(before.length, 100);
  assert.equal(now[0].id, "w150", "the recent window ends at the log's last answered consult");
  assert.equal(before.at(-1).id, "w149", "and the earlier one abuts it");
  const said = evalLines(now, before, verdicts).join("\n");
  assert.match(said, /new-model @medium {2}prompt v2 bbb/u, "one block per model and prompt version");
  assert.match(said, /100 consult\(s\) {2,}100 finding\(s\)/u);
  assert.match(said, /100% kept of 100 ruled/u, "the verdicts reach the scoring");
  assert.match(said, /20s median {2}0 could not check/u, "no coverage note where every row is timed");
  assert.match(said, /tokens\/consult {2}1000 in, 500 from cache, 0 written, 200 out/u);
});

/* Membership alone called a window that went 99 low-effort to one "unchanged", which is the mix the
   numbers are meant to be read against saying nothing (codex F1, this change). */
test("what separates the windows is counted per value, not merely listed", () => {
  const rows = Array.from({ length: 250 }, (one, n) => WINDOWED(n));
  const { now, before } = evalWindows(rows);
  const held = Object.fromEntries(changedBetween(now, before).map((one) => [one.name, one]));
  assert.deepEqual(held.model.values, [{ value: "new-model", now: 100, before: 0 }, { value: "old-model", now: 0, before: 100 }]);
  assert.deepEqual(held.slot.values, [{ value: "codex", now: 100, before: 100 }], "the slot is the name, and it did not move");
  const said = evalLines(now, before, []).join("\n");
  assert.match(said, /model {3}new-model — → 100, old-model 100 → —/u);
  assert.match(said, /slot {4}codex 100 → 100/u);
  assert.match(said, /none ruled on/u, "no verdict in the log is said, not shown as a share");

  const mixed = evalLines(
    Array.from({ length: 4 }, (one, n) => WINDOWED(n + 200, )).map((row) => ({ ...row, effort: "high" })),
    Array.from({ length: 4 }, (one, n) => WINDOWED(n + 100)),
    [],
  ).join("\n");
  assert.match(mixed, /effort {2}high — → 4, medium 4 → —/u, "the same dimension in different amounts still reads as a move");
});

/* A row that predates a field is not an observed zero: averaged in, the older window reads as the
   cheap one, which is the single comparison this verb exists to get right (codex F2, this change). */
test("a measurement nobody recorded is said rather than averaged as nothing", () => {
  const bare = Array.from({ length: 4 }, (one, n) => {
    const row = { ...WINDOWED(n) };
    delete row.usage;
    delete row.ms;
    return row;
  });
  const said = evalLines(bare, [], []).join("\n");
  assert.match(said, /no consult here recorded what it spent/u);
  assert.match(said, /none timed/u);
  const half = evalLines([...bare.slice(0, 3), WINDOWED(9)], [], []).join("\n");
  assert.match(half, /tokens\/consult over the 1 that recorded usage {2}1000 in/u, "divided by the rows that recorded, not by all four");
  assert.match(half, /20s median of the 1 timed/u, "the one timed consult's own median, not one dragged to nought by the three beside it");
});

/* A log this verb is run on early has no earlier window at all, and saying nothing would read as
   two windows that happened to match. */
test("a short window says its real size, and a log too young says it has no window before", () => {
  const young = Array.from({ length: 40 }, (one, n) => WINDOWED(n));
  const { now, before } = evalWindows(young);
  assert.equal(now.length, 40);
  assert.equal(before.length, 0);
  const said = evalLines(now, before, []).join("\n");
  assert.match(said, /the last 40 answered consult\(s\)/u);
  assert.match(said, /100 is a full window and the log holds no more/u);
  assert.match(said, /no window before them/u);
  assert.doesNotMatch(said, /what separates/u);

  const half = evalWindows(Array.from({ length: 150 }, (one, n) => WINDOWED(n)));
  assert.equal(half.before.length, 50);
  assert.match(evalLines(half.now, half.before, []).join("\n"), /the 50 before them.*does not reach a full 100 further back/u);
});

/* The log is the only record, and an eval that appended one would be measuring itself. */
test("the eval writes nothing and refuses a window nobody can act on", () => {
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  writeFileSync(LOG_PATH, `${Array.from({ length: 8 }, (one, n) => JSON.stringify(WINDOWED(n))).join("\n")}\n`);
  const before = readFileSync(LOG_PATH);
  const said = mock.method(console, "log", () => {});
  try {
    printEval([]);
    assert.match(String(said.mock.calls[0].arguments[0]), /the last 8 answered consult\(s\)/u);
  } finally {
    said.mock.restore();
  }
  assert.deepEqual(readFileSync(LOG_PATH), before, "byte for byte what it was");

  const stopped = mock.method(process, "exit", () => {
    throw new Error("exited");
  });
  const cried = mock.method(console, "error", () => {});
  try {
    assert.throws(() => printEval(["--last", "50"]), /exited/);
    assert.match(String(cried.mock.calls[0].arguments[0]), /eval takes no arguments/u);
  } finally {
    stopped.mock.restore();
    cried.mock.restore();
  }
});
