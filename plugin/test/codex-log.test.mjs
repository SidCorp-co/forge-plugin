/* The log is codex's memory and its eval set, so what it replays, what it counts and what a follow-up
   round is asked to verify are decided here — on entries handed in, never on this machine's file. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* Imported after XDG_CONFIG_HOME moves, so the two tests that read the real log path read a sandbox. */
const sandbox = mkdtempSync(join(tmpdir(), "forge-codex-log-"));
process.env.XDG_CONFIG_HOME = sandbox;

const {
  answered,
  countedIn,
  findingsIn,
  historyFor,
  logEntries,
  pairedLog,
  recheckRisks,
  scoreOf,
  startedState,
  verdictsBy,
} = await import("../src/codex-log.mjs");

/* A verdict is a separate record; replaying advice without what was done with it made resolved /
   still open a guess. */
test("a verdict is joined back to the consult it scored", () => {
  const entries = [
    { kind: "consult", id: "aa", ok: true, root: "/a", at: "1", files: ["x"], intent: "i", reply: "r" },
    { kind: "verdict", of: "aa", accepted: 2, rejected: 1, note: "kept the blocker" },
  ];
  assert.equal(verdictsBy(entries).get("aa").accepted, 2);
  assert.match(historyFor(entries, "/a")[0].verdict, /2 accepted, 1 rejected — kept the blocker/);
});

test("prior exchanges replay this repository's answered consults, with the intent judged", () => {
  const entries = [
    { kind: "consult", ok: true, root: "/a", at: "1", files: ["x"], intent: "first go", reply: "first" },
    { kind: "consult", ok: false, root: "/a", at: "2", files: ["y"], error: "boom" },
    { kind: "consult", ok: true, root: "/b", at: "3", files: ["z"], reply: "elsewhere" },
    { kind: "consult", ok: true, root: "/a", at: "4", files: ["w"], reply: "second" },
  ];
  const held = historyFor(entries, "/a");
  assert.deepEqual(held.map((one) => one.reply), ["first", "second"]);
  assert.equal(held[0].intent, "first go");
  assert.equal(held[1].intent, "(none given)");
  assert.deepEqual(historyFor(entries, "/a", 1).map((one) => one.reply), ["second"]);
  assert.deepEqual(historyFor(entries, "/c"), []);
});

/* Recency was the only order, so a consult on one file carried three about another. */
test("a consult sharing a file is replayed before a newer one that does not", () => {
  const entries = [
    { kind: "consult", ok: true, root: "/a", at: "1", files: ["x"], reply: "on x" },
    { kind: "consult", ok: true, root: "/a", at: "2", files: ["y"], reply: "on y, older" },
    { kind: "consult", ok: true, root: "/a", at: "3", files: ["z"], reply: "on z" },
    { kind: "consult", ok: true, root: "/a", at: "4", files: ["w"], reply: "on w" },
  ];
  assert.deepEqual(historyFor(entries, "/a", 2, ["y"]).map((one) => one.reply), ["on y, older", "on w"]);
  assert.deepEqual(historyFor(entries, "/a", 3, ["nothing"]).map((one) => one.reply), ["on y, older", "on z", "on w"]);
});

/* Six open rounds on one patch each found a narrower hole; a round asked to confirm or refute what it
   already said is the shape a reviewer is reliable in. */
test("a recheck turns the last consult's findings on these files into the verification list", () => {
  const reply = [
    "CODEX: 3 findings (1 blocker, 2 major, 0 minor)",
    "## Tech Lead",
    "- **New — blocker:** `a.mjs:12` — the lock is released by path.",
    "- **Still open — major:** `a.mjs:40` — the cap is not the loop's.",
    "- **Resolved — major:** `a.mjs:9` — fixed since.",
    "## End User",
    "Nothing material.",
    "Verification:",
    "- **Risk 1 — CONFIRMED:** `a.mjs:12` — it does.",
    "- **Earlier major finding — REFUTED:** `a.mjs:40` — it does not.",
    "- **New — minor:** `other.mjs:3` — about a file this round is not on.",
  ].join("\n");
  assert.deepEqual(findingsIn(reply, ["a.mjs"]), [
    "New — blocker: `a.mjs:12` — the lock is released by path.",
    "Still open — major: `a.mjs:40` — the cap is not the loop's.",
  ]);
  assert.equal(findingsIn(reply).length, 3, "unfiltered, the other file's finding is one too");
  assert.equal(findingsIn("- **New — major:** no anchor here", ["a.mjs"]).length, 1, "unanchored, it stays");
  assert.equal(findingsIn("- **New — major:** calling `saveConfig()` loses data", ["a.mjs"]).length, 1, "a code span is not a path");
  const entries = [
    { kind: "consult", id: "c1", ok: true, root: "/a", at: "1", files: ["a.mjs"], reply },
    { kind: "consult", id: "c2", ok: true, root: "/a", at: "2", files: ["b.mjs"], reply: "CODEX: 1 findings\n- **New — minor:** `b.mjs:1` — b." },
    { kind: "verdict", of: "c1", accepted: 1, rejected: 1, note: "took the lock, kept the cap" },
  ];
  const risks = recheckRisks(entries, "/a", ["a.mjs"]);
  assert.equal(risks.length, 2, "the consult sharing the file, not the newest");
  assert.match(risks[0], /re-verify.*released by path.*What I then did: took the lock/u);
  assert.deepEqual(recheckRisks(entries, "/a", ["c.mjs"]), [], "none sharing these files: nothing to re-verify");
  assert.deepEqual(recheckRisks(entries, "/z", ["a.mjs"]), []);
});

test("the log scores itself per model", () => {
  const entries = [
    { kind: "consult", id: "1", ok: true, root: "/a", at: "1", model: "m", ms: 60000, reply: "CODEX: 2 findings", usage: { input_tokens: 100, cache_read_input_tokens: 50 } },
    { kind: "consult", id: "2", ok: true, root: "/a", at: "2", model: "m", ms: 20000, reply: "CODEX: 0 findings" },
    { kind: "consult", id: "3", ok: false, root: "/a", at: "3", model: "m", error: "x" },
    { kind: "verdict", of: "1", accepted: 1, rejected: 1 },
  ];
  const [row] = scoreOf(entries);
  assert.equal(row.consults, 2);
  assert.equal(row.findings, 2);
  assert.equal(row.zero, 1);
  assert.equal(row.accepted, 1);
  assert.equal(row.rejected, 1);
  assert.equal(row.median, 60);
  assert.equal(row.cached, 50);
  assert.equal(row.input, 150, "every input token, cached ones included");
});

/* A verdict against an error entry would read as "3 accepted" on a gateway timeout. */
test("only an answered consult can carry a verdict", () => {
  const entries = [
    { kind: "consult", ok: true, reply: "said something" },
    { kind: "consult", ok: false, error: "timed out" },
    { kind: "consult", ok: true, reply: "" },
  ];
  assert.deepEqual(answered(entries).map((one) => one.reply), ["said something"]);
});

/* An unpaired start is a consult that died; a paired one is replaced by what it answered. */
test("the log pairs a start with its result on the id", () => {
  const entries = [
    { kind: "started", id: "aa", at: "A", files: ["docs/A.md"] },
    { kind: "consult", id: "aa", at: "A", ok: true, reply: "x" },
    { kind: "started", id: "bb", at: "B", files: ["docs/B.md"] },
  ];
  assert.deepEqual(pairedLog(entries).map((one) => `${one.kind}:${one.id}`), ["consult:aa", "started:bb"]);
});

test("a start inside the budget reads as running, past it as lost", () => {
  const at = "2026-08-31T08:00:00.000Z";
  const base = Date.parse(at);
  assert.match(startedState({ at }, base + 30_000), /running for 30s/);
  assert.match(startedState({ at }, base + 1_000_000), /never reported back/);
});

test("nothing consulted yet reads as an empty log, never a throw", () => {
  assert.deepEqual(logEntries(), []);
});

/* A verdict typed by hand against a review nobody counted is accounting by vibes. */
test("a review counts itself, and a malformed header counts as nothing", () => {
  const held = countedIn("CODEX: 5 findings (1 blocker, 3 major, 1 minor)\n\n## Tech Lead");
  assert.deepEqual(held, { total: 5, blocker: 1, major: 3, minor: 1 });
  assert.deepEqual(countedIn("CODEX: 0 findings"), { total: 0 });
  assert.deepEqual(countedIn("CODEX: 2 findings (2 major)"), { total: 2, major: 2 });
  assert.equal(countedIn("## Tech Lead\n- blocker: something"), null);
  assert.equal(countedIn(undefined), null);
});
