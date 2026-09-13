/* The log is a file this writes to and reads back, so what lands on disk, what never does, and what
   the hundredth answered consult says of itself are decided here — on this machine's own sandbox. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { tempRoom } from "../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves, so anything reading the real log path reads a sandbox. */
const sandbox = tempRoom("forge-codex-log-");
process.env.XDG_CONFIG_HOME = sandbox;

const {
  answered,
  logConsult,
  logEntries,
  logPath,
  loggedWithMark,
  markOf,
  markedAt,
  pairedLog,
} = await import("../../src/codex/codex-log.mjs");
const {
  numbered,
} = await import("../../src/codex/log/replies.mjs");
const { crossingSaid } = await import("../../src/codex/codex-stats.mjs");
const { marksOf, marksPath } = await import("../../src/stats/marks/marks.mjs");

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

test("nothing consulted yet reads as an empty log, never a throw", () => {
  assert.deepEqual(logEntries(), []);
});

/* The log is a file on disk and `forge codex log` prints it back into a session, so a credential a
   reviewed file carried into the reply must not survive the write. A fake shape, at three depths:
   the last real leak of this kind got through a redaction that missed one level. */
const FAKE = "7|notarealtokennotarealtokennotarealtoken";

test("a credential in a consult record is masked before the line is written", () => {
  const long = `A paragraph of review prose. ${"x".repeat(400)}`;
  const record = {
    kind: "consult",
    id: "mask-1",
    at: "2026-09-04T00:00:00.000Z",
    root: "/a",
    ok: true,
    ms: 1200,
    files: ["a.mjs"],
    sent: [{ rel: "a.mjs", sha: "9f2c", chars: 812, clipped: false }],
    usage: { input_tokens: 5, cache_read_input_tokens: 7 },
    intent: `check the header we send with --token ${FAKE}`,
    risks: [`Your earlier finding F1 still stands — COOLIFY_TOKEN=${FAKE} is committed.`],
    reply: `CODEX: 1 findings\n- **F1 — major:** \`a.mjs:3\` — hardcodes COOLIFY_TOKEN=${FAKE}. ${long}`,
  };
  logConsult(record);
  assert.ok(!readFileSync(logPath(), "utf8").includes("notarealtoken"), "no part of the value is on disk");
  const entry = logEntries().at(-1);
  assert.equal(entry.intent, "check the header we send with --token ***");
  assert.deepEqual(entry.risks, ["Your earlier finding F1 still stands — COOLIFY_TOKEN=*** is committed."]);
  /* To the next space, punctuation included: masking less leaves most of a passphrase behind. */
  assert.match(entry.reply, /hardcodes COOLIFY_TOKEN=\*\*\* A paragraph/u);
  /* The refusal log clips at 220 characters; a reply is the eval set this log is kept for. */
  assert.ok(entry.reply.endsWith(long.slice(-40)), "the reply comes back whole, not clipped");
  assert.deepEqual(numbered(entry.reply).map((one) => one.id), ["F1"], "and it is still read for its findings");
  const blanked = { intent: null, risks: null, reply: null, run: null, runFrom: null };
  assert.deepEqual({ ...entry, ...blanked }, { ...record, ...blanked },
    "everything a reader is keyed on — the shas, the numbers, the nested usage — survives field for field");
});

test("a credential two levels into a record is masked, and the ids around it are not", () => {
  logConsult({
    kind: "verdict",
    at: "2026-09-04T00:01:00.000Z",
    of: "mask-1",
    files: ["a.mjs"],
    accepted: 1,
    rejected: 1,
    kept: ["F1"],
    dropped: { F2: `not ours: the fixture logs in with ${FAKE}` },
  });
  assert.ok(!readFileSync(logPath(), "utf8").includes("notarealtoken"), "a rejection reason is caller prose");
  const entry = logEntries().at(-1);
  assert.equal(entry.dropped.F2, "not ours: the fixture logs in with ***");
  assert.deepEqual([entry.of, entry.kept, entry.accepted], ["mask-1", ["F1"], 1], "the record is otherwise itself");
});

/* The counter's whole evidence: the live log is 78 consults short of its next mark, so a crossing is
   proven on a planted one. The fixture is answered consults and asserted to be, because a bare
   `{kind:"consult"}` counts zero and would let both halves of this pass without a mark existing. */
const PLANTED = (n) => ({
  kind: "consult",
  ok: true,
  id: `p${n}`,
  at: new Date(Date.UTC(2026, 8, 5) + n * 60_000).toISOString(),
  root: "/planted",
  reply: "CODEX: 0 findings",
});

test("the consult that takes the log onto a hundred-mark names the eval; the one before it says nothing", () => {
  const kept = readFileSync(logPath(), "utf8");
  const plant = (many) => writeFileSync(logPath(), `${Array.from({ length: many }, (one, n) => JSON.stringify(PLANTED(n))).join("\n")}\n`);
  try {
    plant(199);
    assert.equal(answered(logEntries()).length, 199, "planted as answered consults, which is what the counter counts");
    const crossing = loggedWithMark(PLANTED(199));
    assert.equal(answered(logEntries()).length, 200, "and the consult's own write is what crossed it");
    assert.deepEqual([crossing.mark, crossing.at], [200, 199], "the count and the record's place, for the reading the caller writes");
    assert.match(crossing.said, /200 answered consults in the log — `forge codex eval`/u);

    /* Criteria 4 and 5: the consult end writes the reading once, of the log as it stood at the
       crossing, so a consult that landed just behind it is not in mark 200's window (codex F2). */
    logConsult(PLANTED(200));
    assert.match(crossingSaid(crossing), /^codex: 200 answered consults in the log — `forge codex eval`\. The reading is held as mark 200 \(`forge codex eval --against 200`\)\.$/u);
    const [record] = marksOf("consults");
    assert.deepEqual(Object.keys(record), ["kind", "mark", "at", "size", "total", "now", "before", "shifts"], "the object `codex eval --json` prints");
    assert.deepEqual([record.mark, record.root, record.total, record.now.consults, record.now.to], [200, undefined, 200, 100, PLANTED(199).at],
      "the device's, with no root; the log as it stood at the crossing, not the 201 it holds now");
    assert.ok(Date.parse(record.at) > 0);
    const written = readFileSync(marksPath(), "utf8");
    assert.match(crossingSaid(crossing), /Mark 200 was already held, so nothing was written\.$/u);
    assert.equal(readFileSync(marksPath(), "utf8"), written, "the same crossing met again appends nothing");

    plant(198);
    assert.equal(loggedWithMark(PLANTED(198)), null, "199 is short of the mark");
    assert.equal(marksOf("consults").length, 1, "and short of the mark nothing is written");

    plant(199);
    assert.equal(loggedWithMark({ ...PLANTED(199), ok: false, reply: undefined, error: "gateway" }), null,
      "a failed consult is not in the population the eval compares, so it crosses nothing");
  } finally {
    writeFileSync(logPath(), kept);
  }
});

/* Counted around the write, two consults finishing together both read 199 before and 201 after, and
   both announced 200 (codex F1, this change). The mark belongs to the record that landed on it. */
test("two consults finishing together, only the one that landed on the mark says so", () => {
  const kept = readFileSync(logPath(), "utf8");
  try {
    writeFileSync(logPath(), `${Array.from({ length: 199 }, (one, n) => JSON.stringify(PLANTED(n))).join("\n")}\n`);
    assert.match(loggedWithMark(PLANTED(199)).said, /200 answered consults/u, "the 200th");
    assert.equal(loggedWithMark(PLANTED(200)), null, "and the one right behind it announces nothing");
  } finally {
    writeFileSync(logPath(), kept);
  }
});

test("a mark is an ordinal in the log, so nothing has to remember the last crossing", () => {
  assert.equal(markedAt(100), 100);
  assert.equal(markedAt(101), null, "the same mark is never announced twice");
  assert.equal(markedAt(1), null);
  assert.equal(markedAt(0), null, "a record the log would not take is no crossing at all");
});

/* Three random bytes is what an id is, so two consults can share one; found by the id alone, the
   199th would read the 200th's place as its own and announce a mark it never landed on (codex F3). */
test("a co-tenant sharing this record's id does not lend it their ordinal", () => {
  const mine = { ...PLANTED(198), id: "abc" };
  const theirs = { ...PLANTED(199), id: "abc", root: "/another-checkout" };
  const log = [...Array.from({ length: 198 }, (one, n) => PLANTED(n)), mine, theirs];
  assert.equal(markOf(log, mine), null, "mine is the 199th, whatever id the 200th shares with it");
  assert.match(markOf(log, theirs).said, /200 answered consults/u, "and theirs is the one that landed on it");
});

