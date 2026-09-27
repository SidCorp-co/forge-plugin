/* The one term the rank reads off the review mark rather than off an issue's own fields: a reading
   filed as a review, at xl, with no priority, scored last whatever its range owed (ISS-2719). */
import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULTS, foldWeights } from "../../../src/rank/weights.mjs";
import { multipleOf, readingTermFrom } from "../../../src/rank/terms/reading.mjs";
import { ordered, scoreOf } from "../../../src/rank/score.mjs";

const MARK = "290b5c5d2bc5c475d9a518d05a44d401d7cd7f28";
const NOW = Date.parse("2026-09-27T00:00:00.000Z");

const standing = (changed, lines = 4400) =>
  ({ lines: { value: lines }, mark: MARK, changed, owed: changed >= lines, uncountable: null });

const holder = { issueId: "ISS-2222", title: "The batch 290b5c5..2f7f7e9 is read once as a whole by a run" };
const previous = { issueId: "ISS-1931", title: "The batch 1a2b3c4..290b5c5 is read once as a whole by a run" };

test("the holder's part is the weight times the range's multiple of the threshold, and grows with it", () => {
  const small = readingTermFrom(standing(4400), DEFAULTS).termOf(holder);
  const large = readingTermFrom(standing(67764), DEFAULTS).termOf(holder);
  assert.deepEqual(small, { said: "290b5c5..HEAD 1x 4400", points: 60 }, "at the threshold, one multiple");
  assert.equal(large.points, Math.round(60 * (67764 / 4400)), "the part is linear in the multiple, rounded");
  assert.equal(large.said, "290b5c5..HEAD 15.4x 4400", "and says the range, the multiple and the threshold");
  assert.ok(large.points > small.points, "so an untaken reading rises as its range grows");
});

test("a project's own rank.reading is the points per multiple", () => {
  const { value } = foldWeights({ reading: 25 });
  assert.equal(readingTermFrom(standing(8800), value).termOf(holder).points, 50);
});

test("only the issue whose title opens the batch at the mark holds the term", () => {
  const { termOf } = readingTermFrom(standing(9000), DEFAULTS);
  assert.equal(termOf(previous), null, "the batch that ends at the mark was read already");
  assert.equal(termOf({ issueId: "ISS-1", title: "an unrelated bug" }), null);
});

test("a project that declared no volume, or a range short of it, weighs nobody", () => {
  assert.equal(readingTermFrom(null, DEFAULTS).termOf(holder), null, "no review key: reviewStanding is null");
  assert.equal(readingTermFrom(standing(4399), DEFAULTS).termOf(holder), null, "one line short owes nothing");
  assert.equal(readingTermFrom({ ...standing(9000), mark: null }, DEFAULTS).termOf(holder), null,
    "no mark planted counts nothing");
  const refused = readingTermFrom({ refusal: "`review.lines` is wrong" }, DEFAULTS);
  assert.equal(refused.termOf(holder), null);
  assert.equal(refused.refusal, "`review.lines` is wrong", "and a refusal is handed back to be said");
});

test("the reading lifts a batch filed at every field's bottom above a low-priority backlog", () => {
  const row = (issueId, held) => ({ issueId, status: "open", reopenCount: 0, createdAt: "2026-09-05T00:00:00.000Z", ...held });
  const reading = row("ISS-2222", { ...holder, priority: null, category: "review", complexity: "xl" });
  const bugs = ["ISS-1", "ISS-2"].map((key) => row(key, { title: key, priority: "low", category: "bug", complexity: "xs" }));
  const { termOf } = readingTermFrom(standing(4400), DEFAULTS);
  const scored = [...bugs, reading].map((one) => ({ issueId: one.issueId, row: one,
    score: scoreOf(one, { weights: DEFAULTS, now: NOW, reading: termOf(one) }) }));
  assert.equal(ordered(scored)[0].issueId, "ISS-2222");
  assert.deepEqual(scored[2].score.parts.at(-1), ["reading", "290b5c5..HEAD 1x 4400", 60]);
  assert.ok(scored[0].score.parts.every(([name]) => name !== "reading"), "a row holding no reading carries no such part");
});

test("the multiple is printed to one decimal", () => {
  assert.equal(multipleOf(67764, 4400), 15.4);
  assert.equal(multipleOf(4400, 4400), 1);
});
