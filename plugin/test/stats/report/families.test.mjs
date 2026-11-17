/* The tracker as the current report asks it: every status walked once, a cause matched by the search
   `forge next` reads, by the find door's own judgement, over open and closed issues alike, and each matched issue read for
   its `relates` edges. The walk, the search and the edge read are stood in for. */
import assert from "node:assert/strict";
import test from "node:test";

import { matchesOf, NONE_NEAR, trackerOf } from "../../../src/stats/report/families.mjs";

const PLUGIN = [{ name: "forge-plugin", slug: "forge-plugin" }];

const ROWS = [
  { issueId: "ISS-1", documentId: "d1", title: "open one", status: "open" },
  { issueId: "ISS-2", documentId: "d2", title: "being fixed", status: "in_progress" },
  { issueId: "ISS-3", documentId: "d3", title: "closed one", status: "closed" },
  { issueId: "ISS-4", documentId: "d4", title: "dropped one", status: "dropped" },
];

const readAll = async () => ({ rows: ROWS, whole: true, pages: 1 });

const nearWith = (answer) => {
  const asked = [];
  return { asked, near: async (seed, live, settled) => {
    asked.push({ seed, live: live.map((one) => one.issueId), settled: settled.map((one) => one.issueId) });
    return answer(seed.seed);
  } };
};

const trackerWith = (answer, extra = {}) => {
  const held = nearWith(answer);
  return { held, tracker: trackerOf(PLUGIN, { read: readAll, near: held.near, held: () => true, edges: async (id) => (id === "d1" ? ["ISS-2"] : []), ...extra }) };
};

/* `rank` is the find door's place for an issue in the cause's reading, null for a row only a place
   query reached; every ranked row is one the door judged a match (forge ISS-1256). */
test("a match is the nearest of open and closed issues the door ranked, and never a row it did not", async () => {
  const { held, tracker } = trackerWith((text) => (text === "closer closed" ? {
    suggestions: [{ issueId: "ISS-1", rank: 2 }], closed: [{ issueId: "ISS-3", rank: 1 }], notes: [],
  } : { suggestions: [{ issueId: "ISS-2", rank: null }], closed: [], notes: [] }));
  const got = await tracker;
  assert.equal(await got.match("closer closed"), "ISS-3");
  assert.equal(await got.match("nothing ranked"), null);
  /* Open means every status not settled, and the settled set the search reads is the closed one. */
  assert.deepEqual(held.asked[0].live, ["ISS-1", "ISS-2"]);
  assert.deepEqual(held.asked[0].settled, ["ISS-3"]);
});

test("an issue is read for its status, its title and the keys its relates edges name", async () => {
  const got = await trackerWith(() => ({ suggestions: [], closed: [], notes: [] })).tracker;
  assert.deepEqual(await got.issue("ISS-1"), { key: "ISS-1", title: "open one", status: "open", relates: ["ISS-2"] });
  assert.match((await got.issue("ISS-99")).unread, /ISS-99 is not among the plugin's issues/u);
});

test("a search that could not run is a reason on the cause, never a cause matching nothing", async () => {
  const got = await trackerWith(() => ({ suggestions: [], closed: [], notes: ["the meaning query could not run: 503"] })).tracker;
  const ranked = [{ key: "a", kind: "refusal", met: "one" }, { key: "b", kind: "refusal", met: "two" }];
  const found = await matchesOf(ranked, got);
  assert.equal(found.why.get("a"), "the meaning query could not run: 503");
  const quiet = await trackerWith(() => ({ suggestions: [], closed: [], notes: [] })).tracker;
  assert.equal((await matchesOf(ranked, quiet)).why.get("a"), NONE_NEAR);
});

test("the tracker is not asked where the plugin's backlog is not registered or no endpoint is saved", async () => {
  assert.match((await trackerOf([], { read: readAll, held: () => true })).refused, /is not a project registered on this device/u);
  assert.match((await trackerOf(PLUGIN, { read: readAll, held: () => false })).refused, /no Forge endpoint is saved/u);
  assert.match((await trackerOf(PLUGIN, { read: async () => ({ rows: ROWS, whole: false, pages: 3 }), held: () => true })).refused,
    /the reading is incomplete/u);
});
