import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  evalObject,
  evalLines,
  evalWindows,
  compared,
  printEval,
  rebuiltFrom,
  replayOf,
  statsOf,
  windowOf,
  windowObject,
} = await import("../../src/codex/codex-stats.mjs");
const { KEPT_CHARS, KEPT_TOTAL, logPath, scoreOf, sentFrom } = await import("../../src/codex/codex-log.mjs");
const { marksPath, writeMark } = await import("../../src/stats/marks.mjs");
const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
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
  assert.equal(promptMark(pass).v, 3);
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

/* A replay set is the rows whose payload can be proved — bytes that hash to the recorded digest,
   and a diff nothing about the row leaves ambiguous — and saying how much of a window that is not
   is the point. */
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

/* A worktree removed after its consult leaves the commit in the repository it was cut from, and the
   recorded commit with the recorded digest is the whole proof that a checkout holds the right bytes,
   so a wrong one cannot pass. */
test("a row whose checkout is gone is rebuilt from one holding the commit, and names it", () => {
  const row = ROW({
    root: join(sandbox, "no-such-checkout"),
    head: HEAD,
    send: "bodies",
    sent: [{ rel: "a.mjs", sha: digest("const one = 1;\n"), chars: 15 }],
  });
  const held = rebuiltFrom(row, [REPO]);
  assert.equal(held.root, REPO, "the checkout that answered is named");
  assert.equal(held.parts[0].text, "const one = 1;\n");
  assert.match(rebuiltFrom(row, [sandbox]).why, /no live checkout holds the commit/u, "a candidate without it is none");
});

/* `git diff` compares blobs, so a commit holding the bytes that were sent yields the diff that was
   sent against the working tree. That is what lets a file committed after its consult replay. */
test("bytes committed after the consult rebuild both the body and the diff that was sent", () => {
  writeFileSync(join(REPO, "b.mjs"), "one\n");
  git("add", "b.mjs");
  git("commit", "-qm", "b one");
  const base = git("rev-parse", "--short", "HEAD").stdout.trim();
  writeFileSync(join(REPO, "b.mjs"), "one\ntwo\n");
  const sent = spawnSync("git", ["diff", "--no-color", base, "--", "b.mjs"], { cwd: REPO, encoding: "utf8" }).stdout.trim();
  git("add", "b.mjs");
  git("commit", "-qm", "b two");
  const held = rebuiltFrom(ROW({
    root: REPO,
    head: base,
    anchoredTo: base,
    send: "diffs",
    sent: [{ rel: "b.mjs", sha: digest("one\ntwo\n"), chars: 8 }],
  }));
  assert.equal(held.parts[0].text, "one\ntwo\n", "the bytes come from the commit that holds them");
  assert.equal(held.parts[0].diff, sent, "and the diff is the text the reviewer was given");
  assert.notEqual(held.parts[0].from, base, "which is not the commit the row recorded");
});

/* Two things a digest cannot prove, each refusing the row rather than replaying approximately: what
   was shown for a path the anchor never had, and a mode no row records. */
test("a file the anchor never had is refused, because a new file and a changed one look alike", () => {
  const anchor = git("rev-parse", "--short", "HEAD").stdout.trim();
  writeFileSync(join(REPO, "c.mjs"), "new\n");
  git("add", "c.mjs");
  git("commit", "-qm", "c");
  const held = rebuiltFrom(ROW({
    root: REPO,
    head: anchor,
    anchoredTo: anchor,
    send: "diffs",
    sent: [{ rel: "c.mjs", sha: digest("new\n"), chars: 4 }],
  }));
  assert.match(held.why, /not in the base it was anchored to/u);
});

test("a mode that moved between the anchor and the bytes refuses the row", () => {
  writeFileSync(join(REPO, "d.mjs"), "same\n");
  git("add", "d.mjs");
  git("commit", "-qm", "d");
  const base = git("rev-parse", "--short", "HEAD").stdout.trim();
  writeFileSync(join(REPO, "d.mjs"), "changed\n");
  chmodSync(join(REPO, "d.mjs"), 0o755);
  git("add", "d.mjs");
  git("commit", "-qm", "d executable");
  const held = rebuiltFrom(ROW({
    root: REPO,
    head: base,
    anchoredTo: base,
    send: "diffs",
    sent: [{ rel: "d.mjs", sha: digest("changed\n"), chars: 8 }],
  }));
  assert.match(held.why, /mode changed/u);
});

/* A plan or criteria file is resolved outside the checkout, so no commit will ever hold it: the log
   keeps its text, git is never asked, and the reviewer was shown NEW FILE rather than a diff. */
test("a sent file the log kept the text of is rebuilt with git never asked", () => {
  const outside = join(sandbox, "plan.md");
  const sent = { rel: outside, sha: digest("# plan\n"), chars: 7, text: "# plan\n" };
  const held = rebuiltFrom(ROW({ root: REPO, head: HEAD, send: "bodies", sent: [sent] }));
  assert.equal(held.parts[0].text, "# plan\n");
  assert.equal(held.parts[0].from, "the log");
  assert.equal(held.parts[0].diff, null);
  assert.equal(held.parts[0].masked, false);
  const masked = rebuiltFrom(ROW({ root: REPO, head: HEAD, send: "bodies", sent: [{ ...sent, text: "# plan ***\n" }] }));
  assert.equal(masked.parts[0].masked, true, "a body the mask touched no longer hashes to the digest");
});

/* The log kept no text before this, and a cap dropped this one: two situations, and a row that only
   left the text out could not tell them apart, which is what `textOmitted` is written for. */
test("an outside file with no text is refused, and a capped one is refused for the cap", () => {
  const outside = join(sandbox, "plan.md");
  const before = rebuiltFrom(ROW({ root: REPO, head: HEAD, send: "bodies", sent: [{ rel: outside, sha: "x", chars: 7 }] }));
  const capped = rebuiltFrom(ROW({
    root: REPO,
    head: HEAD,
    send: "bodies",
    sent: [{ rel: outside, sha: "x", chars: 30_000, textOmitted: "the file cap" }],
  }));
  assert.match(before.why, /from before the log kept its text/u);
  assert.match(capped.why, /over the file cap/u);
  assert.notEqual(capped.why, before.why, "and the two are not one reason");
});

test("the record keeps the text of a file no commit can hold, and only within the caps", () => {
  const rows = sentFrom([
    { rel: "a.mjs", sha: "1", chars: 15, text: "const one = 1;\n" },
    { rel: "/tmp/plan.md", sha: "2", chars: 7, text: "# plan\n" },
    { rel: "/tmp/big.md", sha: "3", chars: KEPT_CHARS + 1, text: "x".repeat(KEPT_CHARS + 1) },
    { rel: "/tmp/fills.md", sha: "4", chars: KEPT_CHARS, text: "y".repeat(KEPT_CHARS) },
    { rel: "/tmp/rest.md", sha: "5", chars: KEPT_CHARS, text: "z".repeat(KEPT_CHARS) },
  ]);
  assert.equal(rows[0].text, undefined, "a path inside the checkout is git's to answer for");
  assert.equal(rows[1].text, "# plan\n");
  assert.equal(rows[2].textOmitted, "the file cap");
  assert.equal(rows[3].text.length, KEPT_CHARS, "a file at the cap is kept whole");
  assert.equal(rows[4].textOmitted, "the record cap", `and ${KEPT_TOTAL} is all one record keeps`);
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
  const said = evalLines(evalObject([...rows, ...verdicts])).join("\n");
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
  const object = evalObject(rows);
  const held = Object.fromEntries(object.shifts.map((one) => [one.name, one]));
  assert.deepEqual(held.model.values, [{ value: "new-model", now: 100, before: 0 }, { value: "old-model", now: 0, before: 100 }]);
  assert.deepEqual(held.slot.values, [{ value: "codex", now: 100, before: 100 }], "the slot is the name, and it did not move");
  assert.deepEqual(held.prompt.values, [{ value: "v2 bbb", now: 100, before: 0 }, { value: "v2 aaa", now: 0, before: 100 }],
    "the prompt version, the fourth dimension AC-06-6-2 names and the one nothing here was asserting");
  const said = evalLines(object).join("\n");
  assert.match(said, /model {3}new-model — → 100, old-model 100 → —/u);
  assert.match(said, /slot {4}codex 100 → 100/u);
  assert.match(said, /none ruled on/u, "no verdict in the log is said, not shown as a share");

  const mixed = evalLines(compared(
    Array.from({ length: 4 }, (one, n) => WINDOWED(n + 200, )).map((row) => ({ ...row, effort: "high" })),
    Array.from({ length: 4 }, (one, n) => WINDOWED(n + 100)),
    [], 8,
  )).join("\n");
  assert.match(mixed, /effort {2}high — → 4, medium 4 → —/u, "the same dimension in different amounts still reads as a move");

  /* Criterion 19: a group's key folds slots together, so the mix is what keeps them apart. */
  const twoSlots = [WINDOWED(200), { ...WINDOWED(201), slot: "other" }];
  const window = windowObject(twoSlots, []);
  assert.equal(window.groups.length, 1, "one model, prompt and effort is one group");
  assert.deepEqual(window.mix.slot, { codex: 1, other: 1 });
  assert.deepEqual(changedBetween(window, windowObject([WINDOWED(100)], [])).find((one) => one.name === "slot").values,
    [{ value: "codex", now: 1, before: 1 }, { value: "other", now: 1, before: 0 }], "one consult per slot, as the rows said");
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
  const said = evalLines(compared(bare, [], [], 4)).join("\n");
  assert.match(said, /no consult here recorded what it spent/u);
  assert.match(said, /none timed/u);
  const half = evalLines(compared([...bare.slice(0, 3), WINDOWED(9)], [], [], 4)).join("\n");
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
  const said = evalLines(evalObject(young)).join("\n");
  assert.match(said, /the last 40 answered consult\(s\)/u);
  assert.match(said, /100 is a full window and the log holds no more/u);
  assert.match(said, /no window before them/u);
  assert.doesNotMatch(said, /what separates/u);

  const rows = Array.from({ length: 150 }, (one, n) => WINDOWED(n));
  const half = evalWindows(rows);
  assert.equal(half.before.length, 50);
  assert.match(evalLines(evalObject(rows)).join("\n"), /the 50 before them.*does not reach a full 100 further back/u);
});

/* The reader that quotes a figure exactly takes the object, and it is the screen's numbers under one
   spelling each: a second computation would answer differently the day either moved (ISS-484). */
test("--json is the comparison as one object, in stats eval's outer shape, and its figures are the screen's", () => {
  const rows = Array.from({ length: 250 }, (one, n) => WINDOWED(n));
  const verdicts = rows.map((one, n) => SCORED(n));
  const { now } = evalWindows([...rows, ...verdicts]);
  const held = evalObject([...rows, ...verdicts]);
  assert.deepEqual(Object.keys(held), ["size", "total", "now", "before", "shifts"]);
  assert.equal(held.size, 100);
  assert.equal(held.total, 250);
  for (const window of [held.now, held.before]) {
    /* Criterion 17: the bounds and the mix, written while the rows are there, and nothing else new. */
    assert.deepEqual(Object.keys(window), ["consults", "from", "to", "stats", "mix", "groups"]);
    assert.equal(window.consults, 100);
    assert.ok(window.from < window.to);
    assert.deepEqual(Object.keys(window.mix), ["slot", "model", "prompt", "effort"]);
    assert.equal(window.groups.reduce((sum, group) => sum + group.consults, 0), window.consults, "the groups partition the window");
    for (const group of window.groups) {
      assert.deepEqual(Object.keys(group), ["key", "slot", "model", "prompt", "effort", "consults", "timed", "metered", "score", "stats"]);
      assert.equal(group.timed, group.consults, "every fixture row is timed and metered, and the counts say so");
      assert.equal(group.metered, group.consults);
    }
  }
  const [group] = held.now.groups;
  assert.equal(group.model, "new-model");
  assert.equal(group.prompt, "v2 bbb");
  assert.equal(group.effort, "medium");
  assert.deepEqual(group.score, scoreOf([...verdicts, ...now])[0], "the score the screen's kept share is read off");
  assert.deepEqual(group.stats, statsOf(now), "the stats the screen's token line is read off");
  assert.equal(group.stats.spent.input_tokens, 100_000);
  assert.equal(held.shifts.find((one) => one.name === "model").values[0].value, "new-model");

  const young = evalObject([...rows.slice(0, 40), ...verdicts]);
  assert.equal(young.before, null, "a log too young has no earlier window, said as null");
  assert.deepEqual(young.shifts, []);

  /* An empty log is an empty object and not the screen's prose: the reader asked for JSON (codex F1). */
  mkdirSync(dirname(logPath()), { recursive: true });
  writeFileSync(logPath(), "");
  const said = mock.method(console, "log", () => {});
  try {
    printEval(["--json"]);
    const empty = JSON.parse(String(said.mock.calls[0].arguments[0]));
    assert.deepEqual(empty, {
      size: 100, total: 0, now: { consults: 0, from: null, to: null, stats: statsOf([]), mix: { slot: {}, model: {}, prompt: {}, effort: {} }, groups: [] }, before: null, shifts: [],
    });
  } finally {
    said.mock.restore();
  }
});

/* The log is the only record, and an eval that appended one would be measuring itself. */
test("the eval writes nothing and refuses a window nobody can act on", () => {
  mkdirSync(dirname(logPath()), { recursive: true });
  writeFileSync(logPath(), `${Array.from({ length: 8 }, (one, n) => JSON.stringify(WINDOWED(n))).join("\n")}\n`);
  const before = readFileSync(logPath());
  const said = mock.method(console, "log", () => {});
  try {
    printEval([]);
    assert.match(String(said.mock.calls[0].arguments[0]), /the last 8 answered consult\(s\)/u);
    const printed = said.mock.calls.length;
    printEval(["--json"]);
    assert.equal(said.mock.calls.length, printed + 1, "one object, one call");
    const parsed = JSON.parse(String(said.mock.calls[printed].arguments[0]));
    assert.equal(parsed.now.consults, 8, "the same window, as one object");
  } finally {
    said.mock.restore();
  }
  assert.deepEqual(readFileSync(logPath()), before, "byte for byte what it was, after both forms");

  const stopped = mock.method(process, "exit", () => {
    throw new Error("exited");
  });
  const cried = mock.method(console, "error", () => {});
  try {
    assert.throws(() => printEval(["--last", "50"]), /exited/);
    assert.match(String(cried.mock.calls[0].arguments[0]), /eval takes no window.*forge codex stats/u);
    assert.throws(() => printEval(["--jsn"]), /exited/);
    assert.match(String(cried.mock.calls[1].arguments[0]), /--json/u, "a misspelt flag is refused with the one it meant");
  } finally {
    stopped.mock.restore();
    cried.mock.restore();
  }
});

/* Criteria 9, 11, 13 and 21, 23: a reading held on the device is the before window whichever checkout
   asks, its figures are the ones scored at the mark, and the list subject shows what is held. */
test("a stored consult reading is the before window, scored as it was at the mark, on every checkout", () => {
  const rows = Array.from({ length: 250 }, (one, n) => WINDOWED(n));
  const verdicts = rows.map((one, n) => SCORED(n));
  mkdirSync(dirname(logPath()), { recursive: true });
  writeFileSync(logPath(), `${[...rows, ...verdicts].map((one) => JSON.stringify(one)).join("\n")}\n`);
  const env = { ...process.env };
  const ask = (...argv) => spawnSync(FORGE, ["codex", ...argv], { encoding: "utf8", env });

  const empty = ask("marks");
  assert.match(`${empty.status} ${empty.stdout}`, /^0 No reading is held on this device yet; the consult that brings the log to a multiple of a hundred answered consults writes one/u);
  const none = ask("eval", "--against");
  assert.match(`${none.status} ${none.stderr}`, /^1 codex eval: --against names no reading — none is held on this device yet/u);

  /* The reading, as the crossing writes it: the log as it stood, with the rows' own verdicts. */
  const stored = { kind: "consults", mark: 200, at: "2026-09-05T00:00:00.000Z", ...evalObject([...rows.slice(0, 200), ...verdicts.slice(0, 200)]) };
  assert.equal(writeMark(stored), "written");
  assert.equal(writeMark(stored), "held", "criterion 5: the same mark again is not a second record");
  assert.equal(readFileSync(marksPath(), "utf8").trim().split("\n").length, 1);

  const pinned = JSON.parse(ask("eval", "--against", "200", "--json").stdout);
  assert.deepEqual([pinned.against, pinned.now.consults, pinned.before], [200, 100, JSON.parse(JSON.stringify(stored.now))], "the stored recent window, as the file holds it");
  assert.equal(JSON.parse(ask("eval", "--against", "--json").stdout).against, 200, "criterion 9: bare --against is the newest held, and no root narrows it");
  const screen = ask("eval", "--against", "200");
  assert.match(screen.stdout, /^the 100 held at mark 200 {2}.* — overlapping the recent window, which begins before this one ends$/mu, screen.stderr);
  assert.match(screen.stdout, /what separates the two windows/u);
  const missing = ask("eval", "--against", "999");
  assert.match(`${missing.status} ${missing.stderr}`, /^1 codex eval: no consults reading at mark 999 on this device\. `forge codex marks` lists what is held\./u);
  const listed = ask("marks");
  assert.match(listed.stdout, /^mark {3}200 {2}2026-09-05 00:00 {2}100 consult\(s\) {2}2026-09-01T01:40:00\.000Z to 2026-09-01T03:19:00\.000Z$/mu, listed.stderr);

  /* Criterion 13: the rows are gone and later verdicts reject everything, and the stored side still
     reads as it was scored at the mark. */
  const rejecting = rows.map((one, n) => ({ ...SCORED(n), accepted: 0, rejected: 1, kept: [], dropped: { F1: "no" } }));
  const later = compared(rows.slice(200), [], rejecting, 250, stored);
  const said = evalLines(later).join("\n");
  /* The stored window is rows 100 to 199: fifty of each model, so two groups of fifty. */
  assert.match(said, /before {3}50 consult\(s\) {4}50 finding\(s\) \(0 found none\) {2}100% kept of 50 ruled/u, "the stored window's score");
  assert.match(said, /now {6}50 consult\(s\) {4}50 finding\(s\) \(0 found none\) {2}0% kept of 50 ruled/u, "the live one's");
  assert.match(said, /old-model @medium {2}prompt v2 aaa\n {2}now {5}not in this window\n {2}before {3}50 consult/u, "a group the live window lacks still prints its stored side");
  assert.match(said, /tokens\/consult {2}1000 in, 500 from cache, 0 written, 200 out/u);
});
