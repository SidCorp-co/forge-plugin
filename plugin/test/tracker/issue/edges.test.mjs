/* The edge writes on the issue verb. Which end the tracker stores as `from` decides which end the
   edge reads back on, so the direction is asserted on the request itself and on the lease each end
   gets: the blocked end is the one whose order moves. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../../..", import.meta.url).pathname;
const SESSION = "iss-edges";

const row = (issueId, held = {}) => ({
  documentId: `u-${issueId}`,
  issueId,
  status: "open",
  title: `${issueId} as it was filed`,
  description: "## Why\n\nSomething.\n\n## Outcome\n\nSomething else.\n\n## Out of scope\n\nNothing.\n",
  ...held,
});

const rows = [row("ISS-45"), row("ISS-46"), row("ISS-47")];

const state = {
  issues: rows,
  comments: { "u-ISS-45": [], "u-ISS-46": [], "u-ISS-47": [] },
  answer: {
    forge_issues: (args) => {
      if (args.action === "list") return { issues: rows, returned: rows.length, hasMore: false };
      if (args.action === "get") return rows.find((one) => one.documentId === args.documentId) ?? {};
      if (args.action === "update") {
        return Object.assign(rows.find((one) => one.documentId === args.documentId) ?? {}, args.data);
      }
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
  },
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());
const ran = (...argv) =>
  ranAsync(FORGE, argv, { ...tracker.env, FORGE_SESSION_ID: SESSION }, ROOT);

const sentTo = (path, method) =>
  (state.calls ?? []).filter((one) => one.path === path && one.method === method);

/* Read first, or the write is refused: every case here writes to an issue, and the gate is the
   session's own reading of it. */
const read = async (...keys) => {
  for (const key of keys) await ran("issue", key);
};

test("--blocks writes on the blocked end's route, which is where it reads back", async () => {
  await read("ISS-45", "ISS-46");
  state.calls = [];
  const run = await ran("issue", "ISS-45", "--blocks", "ISS-46");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ISS-45 blocks ISS-46: written on the ISS-46 dependency route/mu);
  assert.match(run.stdout, /reads back under blockedBy there/u);
  const [wrote] = sentTo("/api/issues/u-ISS-46/dependencies", "POST");
  assert.ok(wrote, `the write went somewhere else: ${JSON.stringify(state.calls.map((one) => one.path))}`);
  assert.deepEqual(wrote.sent, { dependsOnId: "u-ISS-45", kind: "blocks" },
    "the issue that DEPENDS carries the route and the one it depends on is the body's");
});

test("--relates writes on the subject's own route, an edge ordering nothing having no blocked end", async () => {
  await read("ISS-45", "ISS-47");
  state.calls = [];
  const run = await ran("issue", "ISS-45", "--relates", "ISS-47");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ISS-45 relates ISS-47: written on the ISS-45 dependency route/mu);
  assert.match(run.stdout, /reads back under relates there/u);
  const [wrote] = sentTo("/api/issues/u-ISS-45/dependencies", "POST");
  assert.deepEqual(wrote.sent, { dependsOnId: "u-ISS-47", kind: "relates" });
});

test("an issue neither blocks nor relates to itself, and nothing is sent for one that tries", async () => {
  await read("ISS-45");
  state.calls = [];
  const run = await ran("issue", "ISS-45", "--blocks", "ISS-45");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /ISS-45 and ISS-45 are one issue, and an issue neither blocks nor relates to itself/u);
  assert.equal(sentTo("/api/issues/u-ISS-45/dependencies", "POST").length, 0);
});

test("two edge flags in one call are refused rather than one of them written", async () => {
  await read("ISS-45");
  state.calls = [];
  const run = await ran("issue", "ISS-45", "--blocks", "ISS-46", "--relates", "ISS-47");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--blocks and --relates are separate writes and a call makes one/u, run.stderr);
  assert.equal((state.calls ?? []).filter((one) => one.method === "POST").length, 0);
});

/* An edge and a field are two writes of this one verb, so they are judged in the same set: taken
   together, one of them would land and the other would be dropped without a word. */
test("an edge flag and --set in one call are refused, and neither of them is written", async () => {
  await read("ISS-45");
  state.calls = [];
  const run = await ran("issue", "ISS-45", "--blocks", "ISS-46", "--set", "complexity=s", "--why", "the rung was wrong");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--blocks and --set are separate writes and a call makes one/u, run.stderr);
  assert.match(run.stderr, /Nothing was sent\./u);
  assert.equal((state.calls ?? []).filter((one) => one.method !== "GET").length, 0);
});

/* The window the caller's own check cannot close: free when the two ends were checked, taken by the
   time the renewal reads. A finder's write is for an issue nobody holds, so the `false` the option
   hands back is not an answer to a live lease, whichever read found it. */
test("a lease taken between the two reads refuses the edge rather than writing it as a finder's", async () => {
  await read("ISS-45", "ISS-47");
  const live = { lease: { holder: "another-run", agent: "an agent", pid: "9",
    renewedAt: new Date().toISOString(), minutes: 60, history: [] } };
  const held = state.answer.forge_issues;
  let reads = 0;
  state.answer.forge_issues = (args) => {
    /* The route serves the row whole and the caller projects it, so the reads are told apart by
       their order and not by a field list: the first is the check, the second the renewal. */
    const asked = args.action === "get" && args.documentId === "u-ISS-47";
    if (asked && (reads += 1) > 1) return { ...row("ISS-47"), sessionContext: live };
    return held(args);
  };
  state.calls = [];
  const run = await ran("issue", "ISS-45", "--blocks", "ISS-47");
  state.answer.forge_issues = held;
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /another-run/u, run.stderr);
  assert.equal(sentTo("/api/issues/u-ISS-47/dependencies", "POST").length, 0,
    "and the edge was not written on the way past the refusal");
});

/* The id is the tracker's and no caller holds one, so the removal reads the pair's edges first and
   says which edge went. A pair with none is a refusal naming the read that prints what they have. */
test("--unlink reads the pair's edges, removes the one it found, and says which", async () => {
  /* One list with the kind inside it, which is the shape the route serves: what tells a `relates`
     edge from a `blocks` one is the kind and never the list it arrived in. */
  rows[0].relations = {
    blocks: [{ edgeId: "e-1", kind: "relates", toIssueId: "u-ISS-47", otherDisplayId: "ISS-47", otherStatus: "open" }],
    blockedBy: [],
  };
  await read("ISS-45");
  state.calls = [];
  const run = await ran("issue", "ISS-45", "--unlink", "ISS-47");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ISS-45 —\/— ISS-47: removed the edge to ISS-47 by relates\.$/mu);
  assert.equal(sentTo("/api/issues/u-ISS-45/dependencies/e-1", "DELETE").length, 1);
  delete rows[0].relations;
});

test("a pair with no edge between them is refused with the read that prints what they have", async () => {
  await read("ISS-45");
  state.calls = [];
  const run = await ran("issue", "ISS-45", "--unlink", "ISS-46");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /ISS-45 and ISS-46 have no edge between them/u);
  assert.match(run.stderr, /forge issue ISS-45 --fields relations/u);
  assert.equal((state.calls ?? []).filter((one) => one.method === "DELETE").length, 0);
});
