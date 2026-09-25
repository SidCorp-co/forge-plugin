/* The summary's opportunity sentence, over entries the opportunities list itself made, so the kinds
   asserted are the ones that list names rather than ones this case typed. */
import assert from "node:assert/strict";
import test from "node:test";

import { summaryOf } from "../../../src/stats/daily/summary.mjs";
import { opportunitiesOf } from "../../../src/stats/daily/opportunities.mjs";

const content = (listed) => ({
  day: "2026-09-24", projects: [],
  runs: { headline: { day: { runs: 0 }, before: { runs: 0 }, week: { runs: 0 } } },
  moved: { phases: { rose: null, fell: null }, rungs: { rose: null, fell: null } }, followed: null,
  opportunities: { listed, unlisted: 0, evaluator: "forge stats eval" },
  consults: { headline: { answered: 0, atBudget: 0 } },
});

const sentenceOf = (listed) => summaryOf(content(listed))[2];

/* One entry in each friction list the ranking reads, each paying a different call count so each can
   be set on top alone. */
const every = {
  refusals: [{ key: "Hold — a rule", runs: 1, calls: 5 }],
  errors: [{ key: "poll", runs: 1, calls: 4 }],
  repeats: [{ key: "git status", runs: 1, calls: 4 }],
  guideParts: [{ key: "issue-flow verification", runs: 1, again: 1, calls: 3 }],
  waits: [{ what: "a gate run", runs: 1, waits: 1, minutes: 12 }],
};

test("the opportunity sentence reads 'an' before an error and 'a' before every other kind the list names", async () => {
  const { listed } = await opportunitiesOf(every);
  const byKind = new Map(listed.map((one) => [one.kind, one]));
  assert.deepEqual([...byKind.keys()].sort(), ["error", "guide part", "refusal", "repeat", "wait"]);
  assert.ok(sentenceOf([byKind.get("error")]).startsWith("The largest opportunity was an error — a non-zero exit no rule refused"),
    sentenceOf([byKind.get("error")]));
  for (const kind of ["refusal", "repeat", "guide part", "wait"]) {
    const said = sentenceOf([byKind.get(kind)]);
    assert.ok(said.startsWith(`The largest opportunity was a ${kind} — `), said);
  }
});

test("a kind with no article is refused by name rather than given a guessed one", () => {
  assert.throws(() => sentenceOf([{ kind: "idle hour", met: "x", runs: 1, calls: 1, minutes: null, match: null, unmatched: null }]),
    /no article for the opportunity kind "idle hour"/);
});
