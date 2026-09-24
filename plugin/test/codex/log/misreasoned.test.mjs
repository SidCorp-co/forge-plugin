/* The third ruling (ISS-1823): a finding whose conclusion held and whose stated mechanism did not. It is
   an acceptance to every door the flow guards and a figure of its own to the eval, so both halves are
   proved here, on entries handed in and on the verb over a sandbox log. */
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { jsonlOf, standsInNoTree, tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves: the verb cases write the log, and the developer's own is live. */
const sandbox = tempRoom("forge-codex-misreasoned-");
process.env.XDG_CONFIG_HOME = sandbox;
const room = standsInNoTree("forge-codex-misreasoned");

const { logEntries, logPath } = await import("../../../src/codex/codex-log.mjs");
const {
  digestOf, outcomeOf, ruledOn, scoreOf, undecidedIn, unverdicted, verdictFromRulings, verdictRecord,
} = await import("../../../src/codex/log/replies.mjs");
const { logLine, printLog, verdict, VERDICT_USAGE } = await import("../../../src/codex/log/verbs.mjs");
const { evalLines, evalObject } = await import("../../../src/codex/codex-stats.mjs");
const { refusing } = await import("../../../src/resolve/settings.mjs");
const { repoRoot } = await import("../../../src/git/repo-root.mjs");

/* The case ISS-1823 was filed from: consult c5c8b6's F1 said a glob traverses a link, which it does not, and was right that the read went wider than the claim, by brace expansion. Ruled accepted, it read exactly like a finding right about both. */
const THREE = { kind: "consult", id: "c1", ok: true, root: "/a", at: "1", model: "m", files: ["a.mjs"],
  reply: "- **F1 — New — major:** `a.mjs:1` — x.\n- **F2 — New — minor:** `a.mjs:2` — y.\n- **F3 — New — minor:** `a.mjs:3` — z." };
const LINK = "a link matched by * is not traversed; brace expansion reaches across it";

test("a finding right in conclusion and wrong in mechanism is kept, marked apart and scored apart", () => {
  const ruled = verdictRecord(THREE, { accepted: "F2", misreasoned: `F1=${LINK}`, rejected: "F3=by design" });
  assert.deepEqual([ruled.record.kept, ruled.record.accepted, ruled.undecided], [["F2", "F1"], 2, 0], "it is an acceptance, and nothing is left undecided");
  assert.deepEqual(ruled.record.misreasoned, { F1: LINK }, "stored against its id with what the mechanism got wrong");
  assert.deepEqual(ruled.record.sound, ["F2"], "a plain acceptance is right about both, and says so apart");
  assert.deepEqual(ruledOn(ruled.record, THREE), { accepted: 2, rejected: 1, sound: 1, misreasoned: 1 });
  const [row] = scoreOf([THREE, ruled.record]);
  assert.deepEqual([row.accepted, row.sound, row.misreasoned], [2, 1, 1], "the score per model counts the two apart");
  assert.equal(outcomeOf(ruled.record, "F1"), `accepted — right in conclusion, wrong in mechanism: ${LINK}`);
  assert.match(digestOf(THREE.reply, ruled.record), /- F1 — .* — x\. → accepted — right in conclusion, wrong in mechanism: a link/u, "and that is what the next consult is told");
});

test("the third ruling is refused without its reason, and beside another ruling on the same id", () => {
  assert.match(verdictRecord(THREE, { misreasoned: "F1" }).problem, /--misreasoned F1 names no mechanism: --misreasoned F1=<what the finding got wrong about why>/u);
  assert.match(verdictRecord(THREE, { misreasoned: "F1=" }).problem, /names no mechanism/u, "an empty reason is no reason");
  assert.match(verdictRecord(THREE, { accepted: "F1", misreasoned: "F1=x" }).problem, /^F1 cannot be both accepted and misreasoned\.$/u);
  assert.match(verdictRecord(THREE, { rejected: "F2=no", misreasoned: "F2=x" }).problem, /^F2 cannot be both rejected and misreasoned\.$/u);
  assert.match(verdictRecord(THREE, { misreasoned: "F7=x" }).problem, /made no finding F7/u);
  assert.match(verdictRecord(THREE, { misreasoned: "2" }).problem, /not counts/u);
});

test("a finding ruled misreasoned opens the commit gate as an acceptance does", () => {
  const ruled = verdictRecord(THREE, { misreasoned: `F1=${LINK},F2=wrong line,F3=wrong cause` }).record;
  assert.deepEqual(undecidedIn(["F1", "F2", "F3"], ruled), []);
  assert.equal(unverdicted(jsonlOf([THREE, ruled]), "/a"), null, "nothing is open for the gate");
  const some = verdictRecord(THREE, { misreasoned: `F1=${LINK}` }).record;
  assert.deepEqual(unverdicted(jsonlOf([THREE, some]), "/a").open, ["F2", "F3"], "and what it did not rule stays open");
});

test("the newer word on an id takes its mechanism mark with it, and a recheck adds none", () => {
  const first = verdictRecord(THREE, { accepted: "F2", misreasoned: `F1=${LINK}`, rejected: "F3=by design" }).record;
  const plain = verdictRecord(THREE, { accepted: "F1" }, first).record;
  assert.equal(plain.misreasoned, undefined, "a later plain acceptance removes the mark");
  assert.deepEqual(plain.sound, ["F2", "F1"]);
  const dropped = verdictRecord(THREE, { rejected: "F1=not real after all" }, first).record;
  assert.deepEqual([dropped.misreasoned, dropped.sound, dropped.kept], [undefined, ["F2"], ["F2"]], "a later rejection removes it too");
  const marked = verdictRecord(THREE, { misreasoned: "F2=wrong line" }, first).record;
  assert.deepEqual([marked.sound, marked.misreasoned], [undefined, { F1: LINK, F2: "wrong line" }], "and a later third ruling moves a sound one across");
  const plan = { judged: THREE, ids: ["F1", "F2", "F3"], risks: [] };
  const auto = verdictFromRulings(plan, 0, "1. **REFUTED** — fixed", "r1", verdictRecord(THREE, { accepted: "F2" }).record).record;
  assert.deepEqual([auto.kept, auto.sound, auto.misreasoned], [["F2", "F1"], ["F2"], undefined], "a recheck's own acceptance is ruled on no mechanism");
  assert.deepEqual(ruledOn(auto, THREE), { accepted: 2, rejected: 0, sound: 1, misreasoned: 0 });
  const older = { kind: "verdict", of: "c1", accepted: 2, rejected: 0, kept: ["F1", "F2"], dropped: {} };
  assert.deepEqual(ruledOn(older, THREE), { accepted: 2, rejected: 0, sound: 0, misreasoned: 0 }, "a row from before adds to the kept side and to no mechanism figure");
  const carried = verdictFromRulings(plan, 0, "1. **CANNOT TELL** — a\n2. **CONFIRMED** — b", "r2", first).record;
  assert.deepEqual([carried.sound, carried.misreasoned], [["F2"], { F1: LINK }], "a recheck carries the author's marks through");
});

/* Two windows of a hundred: the recent one ruled under the third ruling, three sound to one misreasoned,
   and the earlier one in the shape every row before this change has. The verdicts come after every
   consult, so a window scored on its own rows would read none of them. */
const WINDOWED = (n) => ({
  kind: "consult", ok: true, id: `w${n}`, root: "/r", at: new Date(Date.UTC(2026, 8, 1) + n * 60_000).toISOString(),
  model: "m", effort: "medium", ms: 20_000, usage: {}, prompt: { v: 2, sha: n < 150 ? "aaa" : "bbb" },
  reply: "- **F1 — major:** `a.mjs:1` — a thing\nCODEX: 1 findings",
});
const RULED = (n) => {
  const base = { kind: "verdict", of: `w${n}`, accepted: 1, rejected: 0, kept: ["F1"], dropped: {} };
  if (n < 150) return base;
  return n % 4 === 0 ? { ...base, misreasoned: { F1: LINK } } : { ...base, sound: ["F1"] };
};
const WINDOWS = [...Array.from({ length: 250 }, (one, n) => WINDOWED(n)), ...Array.from({ length: 250 }, (one, n) => RULED(n))];

test("the eval puts the share right about how beside the kept share, over the findings ruled on how alone", () => {
  const object = evalObject(WINDOWS);
  const said = evalLines(object).join("\n");
  assert.match(said, /prompt v2 bbb\n {2}now .*100% kept of 100 ruled {2}75% right about how of 100 {2}/u, "the recent window's two figures, apart");
  assert.match(said, /prompt v2 aaa\n {2}now {5}not in this window\n {2}before .*100% kept of 100 ruled {2}none ruled on how {2}/u,
    "a window of rows from before counts to the kept share and to no mechanism figure");
  const [recent] = object.now.groups;
  assert.deepEqual([recent.score.sound, recent.score.misreasoned], [75, 25], "--json carries both counts in the group's score");
  const [older] = object.before.groups;
  assert.deepEqual([older.score.accepted, older.score.sound, older.score.misreasoned], [100, 0, 0]);
});

test("a stored reading from before the counts reads as none ruled on how", () => {
  const object = evalObject(WINDOWS);
  const stored = { ...object, now: { ...object.now, groups: object.now.groups.map((one) => {
    const score = { ...one.score };
    delete score.sound;
    delete score.misreasoned;
    return { ...one, score };
  }) } };
  assert.match(evalLines(stored).join("\n"), /prompt v2 bbb\n {2}now .*100% kept of 100 ruled {2}none ruled on how {2}/u);
});

const logged = (rows) => {
  mkdirSync(dirname(logPath()), { recursive: true });
  writeFileSync(logPath(), rows.map((one) => `${JSON.stringify(one)}\n`).join(""));
};

/* The call as a shell makes it, with whatever the verb prints and whatever it refuses. */
const asVerb = async (then) => {
  const said = mock.method(console, "log", () => {});
  const warned = mock.method(console, "error", () => {});
  try {
    const refused = await refusing(async () => {
      try {
        await then();
        return null;
      } catch (error) {
        return error.message;
      }
    });
    return { refused, said: said.mock.calls.map((call) => String(call.arguments[0])).join("\n") };
  } finally {
    said.mock.restore();
    warned.mock.restore();
  }
};

const ROOT = repoRoot(room);
const MINE = { ...THREE, id: "v1", root: ROOT, repo: ROOT, run: "iss-9-a", runFrom: "asked" };

test("the verb records the third ruling, and refuses one with no reason or beside another ruling, writing nothing", async () => {
  logged([MINE]);
  const bare = await asVerb(() => verdict(["--of", "v1", "--misreasoned", "F1"], ROOT));
  assert.match(bare.refused, /--misreasoned F1 names no mechanism/u);
  const both = await asVerb(() => verdict(["--of", "v1", "--accepted", "F1", "--misreasoned", "F1=x"], ROOT));
  assert.match(both.refused, /F1 cannot be both accepted and misreasoned/u);
  assert.equal(logEntries().filter((one) => one.kind === "verdict").length, 0, "neither refusal wrote a row");
  const done = await asVerb(() => verdict(["--of", "v1", "--misreasoned", `F1=${LINK}`, "--accepted", "F2", "--rejected", "F3=by design"], ROOT));
  assert.equal(done.refused, null);
  const [row] = logEntries().filter((one) => one.kind === "verdict");
  assert.deepEqual([row.kept, row.sound, row.misreasoned], [["F2", "F1"], ["F2"], { F1: LINK }]);
  assert.match(VERDICT_USAGE, /--misreasoned F4=why {2}the findings taken whose conclusion held and whose stated mechanism did/u);
});

test("the log line and the per-model score name the findings ruled on a false mechanism", async () => {
  const row = verdictRecord(MINE, { accepted: "F2", misreasoned: `F1=${LINK}`, rejected: "F3=by design" }).record;
  assert.match(logLine(row, false), /verdict on v1: 2 accepted, 1 of them on a false mechanism \(F1: a link matched by \* is not traversed; brace expansion reaches across it\), 1 rejected/u);
  assert.doesNotMatch(logLine({ ...row, misreasoned: undefined }, false), /false mechanism/u, "and says nothing where none was");
  logged([MINE, row]);
  const { said } = await asVerb(() => printLog(["--score"]));
  assert.match(said, /2 accepted +1 rejected +1 right about how +1 right in conclusion only/u);
});
