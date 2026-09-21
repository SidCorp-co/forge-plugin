/* The verb spawned against a tracker that answers the memory search per query, which is what lets
   one case hold a family and another hold nothing. The reading the verb is built on is the create
   path's, so what is asserted here is the sweep's own half: which rows reach a family, which never
   do, and what the answer says about what it could not reach. */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, shortPage } from "../fixtures.mjs";
import { trackerFor } from "../fixtures/own-project.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
/* The sweep says where it is every fiftieth measurement, which is where it says the rest too. */
const SAID_EVERY = 50;

const titleOf = (at) => `the ${at}th thing this backlog says about itself`;
const row = (at, status = "open") =>
  ({ issueId: `ISS-${at}`, documentId: `uuid-${at}`, status, title: titleOf(at) });

const state = { issues: [], comments: {}, calls: [], answer: {} };
/* This checkout's own record, written into the home the child reads: the project a call
   resolves is no longer a file the checkout carries. */
const { tracker, env } = await trackerFor(state);
test.after(() => tracker.close());

const uuidOf = (key) => state.issues.find((one) => one.issueId === key)?.documentId ?? key;

/** The tracker's own answer shape, keyed on the query so each issue's search is its own. */
const searching = (hits) => ({ query }) => ({
  hits: (hits[query] ?? []).map(([key, score]) => ({
    source: "issue", sourceRef: uuidOf(key), text: `${key} as it was embedded`, score, stale: false,
  })),
});

const backlog = (issues, hits, answer = {}) => {
  state.issues = issues;
  state.calls = [];
  state.answer = { "forge_memory.search": searching(hits), ...answer };
};

const swept = () => ranAsync(FORGE, ["alike"], env);

const wrote = () => state.calls.filter((one) => one.args?.action && one.args.action !== "list");

const asked = () => state.calls.filter((one) => one.name === "forge_memory.search")
  .map((one) => one.args.query).sort();

test("two open issues above the floor come back as one family, with both keys and the score", async () => {
  backlog([row(1), row(2), row(3)], {
    [titleOf(1)]: [["ISS-1", 0.82], ["ISS-2", 0.74], ["ISS-3", 0.51]],
    [titleOf(2)]: [["ISS-2", 0.8], ["ISS-1", 0.72]],
    [titleOf(3)]: [["ISS-3", 0.9]],
  });
  const run = await swept();
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /family 1 — 2 issue\(s\) over 1 link\(s\), 0\.74 to 0\.74/u);
  assert.match(run.stdout, /ISS-1 {5}the 1th thing/u, "the member's key and its title");
  assert.match(run.stdout, /ISS-2 {5}the 2th thing/u);
  assert.match(run.stdout, /ISS-1 ~ ISS-2 {2}0\.74 {2}off ISS-1's own title/u,
    "the better of the two readings, and the end whose query measured it");
});

/* The shape this verb exists to replace is one issue measured and the rest taken on trust, and a
   case whose family is in the first query cannot tell the two apart: here the first issue has no
   neighbour at all, so only a later query finds anything. */
test("a family only a later issue's query reveals is still reported", async () => {
  backlog([row(1), row(2), row(3), row(4)], {
    [titleOf(1)]: [["ISS-1", 0.88]],
    [titleOf(2)]: [["ISS-2", 0.85], ["ISS-1", 0.52]],
    [titleOf(3)]: [["ISS-3", 0.83], ["ISS-4", 0.75]],
    [titleOf(4)]: [["ISS-4", 0.81], ["ISS-3", 0.73]],
  });
  const run = await swept();
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /ISS-3 ~ ISS-4 {2}0\.75/u);
  assert.deepEqual(asked(), [titleOf(1), titleOf(2), titleOf(3), titleOf(4)].sort(),
    "every open issue is a query of its own, and each is asked once");
});

test("an issue's own hit joins no family, whatever it scored against itself", async () => {
  backlog([row(1), row(2), row(3)], {
    [titleOf(1)]: [["ISS-1", 0.82], ["ISS-2", 0.74]],
    [titleOf(2)]: [["ISS-2", 0.8], ["ISS-1", 0.72]],
    [titleOf(3)]: [["ISS-3", 0.9]],
  });
  const run = await swept();
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const said = run.stdout;
  assert.doesNotMatch(said, /ISS-3/u, "an issue alone with itself at 0.90 is in no family");
  assert.doesNotMatch(said, /ISS-1 ~ ISS-1|ISS-2 ~ ISS-2/u);
});

test("a settled issue scoring high against an open one is in no family", async () => {
  backlog([row(1), row(2), row(4, "closed")], {
    [titleOf(1)]: [["ISS-1", 0.82], ["ISS-4", 0.95], ["ISS-2", 0.74]],
    [titleOf(2)]: [["ISS-2", 0.8], ["ISS-1", 0.72]],
  });
  const said = (await swept()).stdout;
  assert.doesNotMatch(said, /ISS-4/u, "a closed issue is precedent, not a duplicate");
  assert.match(said, /2 of the 2 open issue\(s\) measured/u, "and it is not measured either");
});

test("a backlog with nothing at the floor answers with the count it measured and no family", async () => {
  backlog([row(1), row(2), row(3)], {
    [titleOf(1)]: [["ISS-1", 0.82], ["ISS-2", 0.66]],
    [titleOf(2)]: [["ISS-2", 0.8], ["ISS-1", 0.64]],
    [titleOf(3)]: [],
  });
  const said = (await swept()).stdout;
  assert.match(said, /No two of the 3 open issue\(s\) measured read alike at 0\.70/u);
  assert.doesNotMatch(said, /family 1/u);
});

test("a band that fills the search is reported short, naming the issue it was asked for", async () => {
  const rows = Array.from({ length: 11 }, (unused, at) => row(at + 1));
  backlog(rows, {
    [titleOf(1)]: rows.slice(0, 10).map((one, at) => [one.issueId, 0.9 - at / 100]),
    [titleOf(2)]: [["ISS-2", 0.9], ["ISS-1", 0.71]],
  });
  const said = (await swept()).stdout;
  assert.match(said, /1 query\(ies\) came back with every hit of the reading at or above the floor/u);
  assert.match(said, /10 of them, and the reading was cut there/u);
  assert.match(said, /short by an unknown amount: ISS-1\./u);
  assert.doesNotMatch(said, /ISS-11/u, "and the ten it did return are all it claims");
});

/* This tracker answers a `topK` of ten with about twenty — measured 2026-09-13 — so the reading the
   sweep works from is only the size it asked for because the sweep cuts it. Every hit past the cut
   here is in band and open, and would have joined ISS-1's family on the reading that took them all. */
test("an answer longer than the ask is read to the ask, and what it served past it joins nothing", async () => {
  const rows = Array.from({ length: 15 }, (unused, at) => row(at + 1));
  backlog(rows, {
    [titleOf(1)]: rows.slice(0, 14).map((one, at) => [one.issueId, 0.95 - at / 100]),
  });
  const said = (await swept()).stdout;
  assert.match(said, /9 family\(ies\) over 10 of the 15 open issue\(s\) measured/u,
    `the ten the ask bought, joined to ISS-1 and to nothing else:\n${said}`);
  for (const at of [11, 12, 13, 14]) {
    assert.doesNotMatch(said, new RegExp(`ISS-${at}\\b`, "u"),
      `ISS-${at} was served past the ask and reached the report anyway:\n${said}`);
  }
  assert.match(said, /10 of them, and the reading was cut there/u,
    "and the width said is the reading's, not the fourteen the tracker served");
});

/* A hit under the floor inside the reading is the search reaching past the band on its own, which is
   the one reading that proves nothing was cut off in band. */
test("a reading carrying a hit below the floor is not reported short", async () => {
  const rows = Array.from({ length: 12 }, (unused, at) => row(at + 1));
  backlog(rows, {
    [titleOf(1)]: [...rows.slice(0, 9).map((one, at) => [one.issueId, 0.9 - at / 100]),
      ["ISS-10", 0.6], ["ISS-11", 0.55]],
  });
  const said = (await swept()).stdout;
  assert.match(said, /8 family\(ies\) over 9 of the 12 open issue\(s\) measured/u,
    `the nine in band:\n${said}`);
  assert.doesNotMatch(said, /short by an unknown amount/u,
    `the search went past the band and the reading is whole:\n${said}`);
});

test("the sweep sends no write and takes no lease", async () => {
  backlog([row(1), row(2)], {
    [titleOf(1)]: [["ISS-1", 0.82], ["ISS-2", 0.74]],
    [titleOf(2)]: [["ISS-2", 0.8], ["ISS-1", 0.72]],
  });
  const run = await swept();
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(wrote(), [], "every call it made is a read");
  assert.deepEqual(state.calls.filter((one) => one.name === "forge_comments"), []);
  assert.deepEqual(state.calls.filter((one) => JSON.stringify(one.args).includes("sessionContext")), [],
    "and nothing it sent carries a lease");
});

test("a walk that came back short is reported as incomplete, though every query ran", async () => {
  const rows = [row(1), row(2)];
  backlog(rows, {
    [titleOf(1)]: [["ISS-1", 0.82], ["ISS-2", 0.74]],
    [titleOf(2)]: [["ISS-2", 0.8], ["ISS-1", 0.72]],
    /* A page reporting rows behind it that the next offset does not serve: the walk stops without
       reaching the end, which is the reading the answer has to disown rather than report on. */
  }, { forge_issues: shortPage(rows, 5) });
  const said = (await swept()).stdout;
  assert.match(said, /family 1/u, "what it did reach is still reported");
  assert.match(said, /The walk over the open issues reached .* and the reading is incomplete/u);
});

/* A sweep of the real backlog is a quarter of an hour, and a session that cannot tell puts a
   ceiling on it and gets 550 of 943 (ISS-1849). What it needed was the two things here: the rate it
   is running at, and the budget the tracker is pacing it by, read off that tracker's own answers. */
test("the progress line says how long the rest will take and which budget is pacing it", async () => {
  const rows = Array.from({ length: SAID_EVERY + 1 }, (one, at) => row(at + 1));
  backlog(rows, {});
  state.budget = {
    "x-ratelimit-scope": "write",
    "x-ratelimit-limit": 60,
    "x-ratelimit-remaining": 59,
    "x-ratelimit-reset": Math.ceil(Date.now() / 1000) + 3600,
  };
  try {
    const said = (await swept()).stderr;
    assert.match(said, new RegExp(`alike: ${SAID_EVERY} of ${rows.length} measured, \\d+ more minute\\(s\\) at this rate`, "u"),
      `the rate it has run at, priced in minutes:\n${said}`);
    assert.match(said, /paced by the write budget of 60 a window/u,
      `and the bucket it is spending, in the server's own word for it:\n${said}`);
    assert.doesNotMatch(said, new RegExp(`${rows.length} of ${rows.length} measured, \\d+ more minute`, "u"),
      "and the last line forecasts nothing, there being nothing ahead of it");
  } finally {
    state.budget = null;
  }
});
