/* Three readings of relatedness and the caps around them: a batch of three, a fourth refused, and
   an issue too large to ride printed rather than dropped. */
import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULTS } from "../../src/rank/weights.mjs";
import { MODULE, RELATION, SEARCH, batchUnder, batchesOf, relatednessOf } from "../../src/rank/batch.mjs";

const candidate = (issueId, band = "xs") => ({
  issueId,
  row: { issueId, title: `${issueId} as it is filed` },
  score: { band },
});

/* `relates` is keyed by the head it was read off; `near` is one head's own answer, handed to
   `batchUnder` by the caller that asked the search about that head. */
const relatesOf = (keys) => new Map([["ISS-1", keys]]);
const context = (held = {}) => ({ relates: new Map(), near: new Map(), paths: new Map(), ...held });

test("relatedness is read three ways, and the line says which one made it", () => {
  const head = candidate("ISS-1");
  const other = candidate("ISS-2");
  const byRelation = relatednessOf(head, other, context({ relates: relatesOf(["ISS-2"]) }));
  assert.equal(byRelation.how, RELATION);
  assert.match(byRelation.said, /related to ISS-1 by relation/u);
  const bySearch = relatednessOf(head, other, context({ near: new Map([["ISS-2", 0.83]]) }));
  assert.equal(bySearch.how, SEARCH);
  assert.match(bySearch.said, /reads like ISS-1 at 0\.83/u);
  const paths = new Map([["ISS-1", ["plugin/src/rank/next.mjs"]], ["ISS-2", ["plugin/src/rank/"]]]);
  const byModule = relatednessOf(head, other, context({ paths }));
  assert.equal(byModule.how, MODULE);
  assert.match(byModule.said, /names plugin\/src\/rank\/next\.mjs, as ISS-1 does/u);
  assert.equal(relatednessOf(head, other, context()), null, "and none of the three is not a batch");
});

/* The order is the issue's: a pair related by relation says so even where the search also found it,
   because the strongest reading is the one worth printing. */
test("the strongest of the three is what the member's line says", () => {
  const held = relatednessOf(candidate("ISS-1"), candidate("ISS-2"),
    context({ relates: relatesOf(["ISS-2"]), near: new Map([["ISS-2", 0.9]]) }));
  assert.equal(held.how, RELATION);
});

test("a batch holds three and refuses the fourth, which prints as related rather than vanishing", () => {
  const head = candidate("ISS-1");
  const rest = ["ISS-2", "ISS-3", "ISS-4"].map((one) => candidate(one));
  const near = new Map(rest.map((one) => [one.issueId, 0.9]));
  const { members, aside } = batchUnder(head, rest, context({ near }), DEFAULTS);
  assert.deepEqual(members.map((one) => one.issueId), ["ISS-2", "ISS-3"], "the head is the third member");
  assert.deepEqual(aside.map((one) => one.issueId), ["ISS-4"]);
  assert.equal(aside[0].capped, true);
});

test("a related issue that is not fix-size rides with nothing and is printed as such", () => {
  const head = candidate("ISS-1");
  const large = candidate("ISS-2", "l");
  const near = new Map([["ISS-2", 0.9]]);
  const { members, aside } = batchUnder(head, [large], context({ near }), DEFAULTS);
  assert.deepEqual(members, []);
  assert.deepEqual(aside.map((one) => one.issueId), ["ISS-2"]);
  assert.equal(aside[0].capped, undefined, "not the cap: the size is what kept it out");
  const big = batchUnder(candidate("ISS-1", "m"), [candidate("ISS-2")], context({ near }), DEFAULTS);
  assert.deepEqual(big.members, [], "and a head that is not fix-size batches nothing either");
});

test("an issue is a member once, and one the cap turned away is a head of its own", async () => {
  const ranked = ["ISS-1", "ISS-2", "ISS-3", "ISS-4"].map((one) => candidate(one));
  const asked = [];
  const nearOf = (head) => {
    asked.push(head.issueId);
    return new Map(head.issueId === "ISS-1" ? [["ISS-2", 0.9], ["ISS-3", 0.9], ["ISS-4", 0.9]] : []);
  };
  const held = await batchesOf(ranked, { ...context(), nearOf }, DEFAULTS);
  assert.deepEqual(held[0].members.map((one) => one.issueId), ["ISS-2", "ISS-3"]);
  assert.deepEqual(held[0].aside.map((one) => one.issueId), ["ISS-4"]);
  assert.deepEqual(held.map((one) => one.head.issueId), ["ISS-1", "ISS-4"],
    "a member rides once; the one the cap turned away is still a candidate");
  assert.deepEqual(asked, ["ISS-1", "ISS-4"],
    "and every head that printed was searched, including the one an earlier batch promoted");
});

/* The head is settled before it is searched: choosing every head up front and searching them after
   left the issue an earlier batch promoted with no answer of its own. */
test("a head an earlier batch promoted is searched before its own batch is formed", async () => {
  const ranked = ["ISS-1", "ISS-2", "ISS-3"].map((one) => candidate(one));
  const nearOf = (head) => new Map(head.issueId === "ISS-2" ? [["ISS-3", 0.95]] : []);
  const held = await batchesOf(ranked, { ...context(), nearOf }, DEFAULTS);
  assert.deepEqual(held.map((one) => one.head.issueId), ["ISS-1", "ISS-2"]);
  assert.deepEqual(held[1].members.map((one) => one.issueId), ["ISS-3"],
    "ISS-2 became a head only after ISS-1 took none, and it was searched then");
});

test("the limit stops the batching rather than the printing, so no head is searched for nothing", async () => {
  const ranked = ["ISS-1", "ISS-2", "ISS-3"].map((one) => candidate(one));
  const asked = [];
  const held = await batchesOf(ranked, {
    ...context(),
    nearOf: (head) => {
      asked.push(head.issueId);
      return new Map();
    },
  }, DEFAULTS, 2);
  assert.equal(held.length, 2);
  assert.deepEqual(asked, ["ISS-1", "ISS-2"], "ISS-3 was never a head, so it cost no search");
});

test("a batch spans modules where a relation or a search put it there", () => {
  const head = candidate("ISS-1");
  const other = candidate("ISS-2");
  const paths = new Map([["ISS-1", ["plugin/src/rank/"]], ["ISS-2", ["docs/cli/"]]]);
  const { members } = batchUnder(head, [other], context({ paths, near: new Map([["ISS-2", 0.8]]) }), DEFAULTS);
  assert.deepEqual(members.map((one) => one.how), [SEARCH], "different trees, one run's saving");
});
