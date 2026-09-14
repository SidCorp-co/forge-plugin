/* How wide the net is that decides which open issues name a filing's place, and what that width is
   not: the block's own length. Called rather than spawned, because what is asserted is which refs
   came back marked and which one the fold would take, and a process would only print them. The two
   thresholds and the act are fold.test.mjs's; the reasoning docs/cli/beside.md's. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker } from "../../fixtures.mjs";

const rows = (count) => Array.from({ length: count }, (unused, at) => ({
  issueId: `ISS-${at + 1}`,
  documentId: `uuid-${at + 1}`,
  status: "open",
  title: `the ${at + 1}th thing this backlog says about itself`,
}));

const LIVE = rows(80);
const state = { issues: LIVE, comments: {}, calls: [], memory: {} };
const tracker = await fakeTracker(state);
test.after(() => tracker.close());
process.env.XDG_CONFIG_HOME = tracker.env.XDG_CONFIG_HOME;
const { PLACE_K, TOP_K, foldOnto, neighboursOf } =
  await import("../../../src/tracker/filing/neighbours.mjs");

/** A keyword answer of `count` rows, descending as this tracker's own is, with `key` at `rank`. */
const placeAnswer = (count, { key = null, rank = 1, score = 0.5 } = {}) =>
  Array.from({ length: count }, (unused, at) => (at + 1 === rank && key
    ? [key, score]
    : [`ISS-${at + 40}`, Number((1 - (at / (count * 2))).toFixed(4))]));

const measured = async (memory) => {
  state.memory = memory;
  state.calls = [];
  return neighboursOf({ seed: "a filing about the thing", place: "forge record" }, LIVE);
};

const marked = (beside, key) => beside.suggestions.find((one) => one.issueId === key)?.samePlace ?? null;
const askedAt = (strategy) => state.calls
  .filter((one) => one.sent?.strategy === strategy).map((one) => one.sent.topK);

test("the place net is wider than the block, and neither number is the other's", () => {
  assert.ok(PLACE_K > TOP_K, `a net of ${PLACE_K} decides nothing a block of ${TOP_K} does not`);
});

/* The population this issue is about: a candidate the semantic query ranked well above the fold's
   own threshold, whose place match the tracker returned past where the block would have stopped. */
test("a place match ranked past the block's width and inside the net takes the finding", async () => {
  const beside = await measured({
    semantic: [["ISS-7", 0.83], ["ISS-8", 0.71]],
    keyword: placeAnswer(20, { key: "ISS-7", rank: 15, score: 0.42 }),
  });
  assert.equal(marked(beside, "ISS-7"), true, "the net reaches rank 15, so the place match holds");
  assert.equal(foldOnto(beside.suggestions)?.issueId, "ISS-7",
    "and the nearest of the neighbours naming the place is the one the search ranked fifteenth");
});

test("a place match ranked past the net takes none, and the net's own number is what cut it", async () => {
  const beside = await measured({
    semantic: [["ISS-7", 0.83]],
    keyword: placeAnswer(PLACE_K + 6, { key: "ISS-7", rank: PLACE_K + 1, score: 0.42 }),
  });
  assert.equal(marked(beside, "ISS-7"), false, `rank ${PLACE_K + 1} is past a net of ${PLACE_K}`);
  assert.equal(foldOnto(beside.suggestions), null,
    "so the nearest neighbour of all is left where it is, the filing naming a place it never reached");
});

test("a place hit the search scored nothing names no place and takes no finding", async () => {
  const beside = await measured({
    semantic: [["ISS-7", 0.83]],
    keyword: [["ISS-41", 0.9], ["ISS-7", 0], ["ISS-42", 0]],
  });
  assert.equal(marked(beside, "ISS-7"), false, "a row scored zero matched nothing of the term");
  assert.equal(foldOnto(beside.suggestions), null);
  assert.equal(beside.suggestions.filter((one) => one.samePlace).length, 1,
    "and the one row the search did score is the whole of what names the place");
});

test("the rows the place query alone found stay at the block's width, however wide the net is", async () => {
  const beside = await measured({ semantic: [], keyword: placeAnswer(PLACE_K) });
  assert.equal(beside.suggestions.length, TOP_K,
    `a net of ${PLACE_K} printed ${beside.suggestions.length} row(s) for a block of ${TOP_K}`);
  assert.ok(beside.suggestions.every((one) => one.samePlace),
    "every one of them being a row the place query found");
});

test("each reading is asked for the width it wants, and read to the width it asked", async () => {
  const beside = await measured({
    semantic: [["ISS-7", 0.83]],
    keyword: placeAnswer(PLACE_K + 12, { key: "ISS-7", rank: 15, score: 0.42 }),
  });
  assert.deepEqual(askedAt("semantic"), [TOP_K], "the semantic query asks for the block's width");
  assert.deepEqual(askedAt("keyword"), [PLACE_K], "and the place query asks for the net's");
  assert.equal(beside.suggestions.filter((one) => one.samePlace).length, TOP_K + 1,
    "what the tracker served past the net joins nothing, so the block holds its ten and the candidate");
});
