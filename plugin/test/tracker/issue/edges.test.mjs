/* The edge writes on the issue verb. Which end the tracker stores as `from` decides which end the
   edge reads back on, so the direction is asserted on the request itself and on the lease each end
   gets: the blocked end is the one whose order moves. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { fakeTracker, projectRecord, ranAsync } from "../../fixtures.mjs";

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

/* Every call here runs from this checkout, whose project is this machine's record of it now:
   the record goes under the one configuration home the children are handed. */
const ENV = { ...tracker.env, HOME: tracker.env.XDG_CONFIG_HOME };
projectRecord(new URL("../../../../", import.meta.url).pathname, tracker.env.XDG_CONFIG_HOME,
  JSON.parse(readFileSync(new URL("../../../../.forge.json", import.meta.url), "utf8")));
test.after(() => tracker.close());
const ran = (...argv) =>
  ranAsync(FORGE, argv, { ...ENV, FORGE_SESSION_ID: SESSION }, ROOT);

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
  assert.match(run.stdout, /^ISS-45 —\/— ISS-47: removed the relates edge to ISS-47\.$/mu);
  assert.equal(sentTo("/api/issues/u-ISS-45/dependencies/e-1", "DELETE").length, 1);
  delete rows[0].relations;
});

/* `Object.values(relations).flat().find(...)` took whichever edge the tracker's insertion order put
   first and then reported the kind it happened to take, so the pair that carries both lost the one
   nobody asked about and there was no way to name the other (ISS-769). */
const bothKinds = () => {
  rows[0].relations = {
    blocks: [
      { edgeId: "e-blocks", kind: "blocks", toIssueId: "u-ISS-47", otherDisplayId: "ISS-47", otherStatus: "open" },
      { edgeId: "e-relates", kind: "relates", toIssueId: "u-ISS-47", otherDisplayId: "ISS-47", otherStatus: "open" },
    ],
    blockedBy: [],
  };
};

test("a pair holding two edges is refused, both kinds named and nothing deleted", async () => {
  bothKinds();
  await read("ISS-45");
  state.calls = [];
  const run = await ran("issue", "ISS-45", "--unlink", "ISS-47");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /ISS-45 and ISS-47 have 2 edges between them, blocks, relates/u, run.stderr);
  assert.match(run.stderr, /forge issue ISS-45 --unlink ISS-47 --kind blocks/u,
    "a refusal a caller cannot act on is the defect this replaces");
  assert.equal((state.calls ?? []).filter((one) => one.method === "DELETE").length, 0);
  delete rows[0].relations;
});

test("--kind names which of the two goes, and the other is left standing", async () => {
  bothKinds();
  await read("ISS-45");
  state.calls = [];
  const run = await ran("issue", "ISS-45", "--unlink", "ISS-47", "--kind", "relates");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ISS-45 —\/— ISS-47: removed the relates edge to ISS-47\.$/mu);
  assert.equal(sentTo("/api/issues/u-ISS-45/dependencies/e-relates", "DELETE").length, 1);
  assert.equal(sentTo("/api/issues/u-ISS-45/dependencies/e-blocks", "DELETE").length, 0,
    "the ordering edge nobody named is still there");
  delete rows[0].relations;
});

test("a --kind the pair does not have is refused, and the refusal names what it does have", async () => {
  rows[0].relations = {
    blocks: [{ edgeId: "e-1", kind: "relates", toIssueId: "u-ISS-47", otherDisplayId: "ISS-47", otherStatus: "open" }],
    blockedBy: [],
  };
  await read("ISS-45");
  state.calls = [];
  const run = await ran("issue", "ISS-45", "--unlink", "ISS-47", "--kind", "blocks");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /have no blocks edge between them/u, run.stderr);
  assert.match(run.stderr, /what they do have is relates/u, "and what is there to remove");
  assert.match(run.stderr, /forge issue ISS-45 --unlink ISS-47 --kind relates/u);
  assert.equal((state.calls ?? []).filter((one) => one.method === "DELETE").length, 0);
  delete rows[0].relations;
});

/* The bound on `--kind`: it tells two edges apart only where their kinds differ, so a pair carrying
   two of one kind is sent to the read rather than to a flag that would answer it no better. */
test("two edges of one kind are sent to the read, not to a flag that cannot tell them apart", async () => {
  rows[0].relations = {
    blocks: [
      { edgeId: "e-a", kind: "relates", toIssueId: "u-ISS-47", otherDisplayId: "ISS-47", otherStatus: "open" },
      { edgeId: "e-b", kind: "relates", toIssueId: "u-ISS-47", otherDisplayId: "ISS-47", otherStatus: "open" },
    ],
    blockedBy: [],
  };
  await read("ISS-45");
  state.calls = [];
  const run = await ran("issue", "ISS-45", "--unlink", "ISS-47");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /have 2 edges between them, relates, and --unlink removes one/u, run.stderr);
  assert.match(run.stderr, /forge issue ISS-45 --fields relations/u,
    "a --kind line here would be a route that refuses the caller a second time");
  assert.doesNotMatch(run.stderr, /--kind relates/u);
  assert.equal((state.calls ?? []).filter((one) => one.method === "DELETE").length, 0);
  delete rows[0].relations;
});

/* A kind the pair carries twice selects nothing, so it is not offered: the route out of a refusal
   has to be a call that works, and the one kind still standing alone is what the line names. */
test("the kind offered is one that selects a single edge, never one the pair carries twice", async () => {
  rows[0].relations = {
    blocks: [
      { edgeId: "e-a", kind: "blocks", toIssueId: "u-ISS-47", otherDisplayId: "ISS-47", otherStatus: "open" },
      { edgeId: "e-b", kind: "blocks", toIssueId: "u-ISS-47", otherDisplayId: "ISS-47", otherStatus: "open" },
      { edgeId: "e-c", kind: "relates", toIssueId: "u-ISS-47", otherDisplayId: "ISS-47", otherStatus: "open" },
    ],
    blockedBy: [],
  };
  await read("ISS-45");
  state.calls = [];
  const run = await ran("issue", "ISS-45", "--unlink", "ISS-47");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /forge issue ISS-45 --unlink ISS-47 --kind relates/u, run.stderr);
  assert.doesNotMatch(run.stderr, /--kind blocks/u, "the kind it carries twice would refuse a second time");
  assert.equal((state.calls ?? []).filter((one) => one.method === "DELETE").length, 0);
  delete rows[0].relations;
});

/* Every input a call is given is used or refused: `--kind` names one of a pair's edges, so a call
   that removes none of them has typed a flag that could only have been read and dropped. */
test("--kind on any call but a removal is refused, and nothing is sent", async () => {
  await read("ISS-45", "ISS-46");
  state.calls = [];
  const read_ = await ran("issue", "ISS-45", "--kind", "blocks");
  assert.equal(read_.status, 1, read_.stdout);
  assert.match(read_.stderr, /--kind names which edge --unlink removes, and this call removes none/u, read_.stderr);
  const written = await ran("issue", "ISS-45", "--blocks", "ISS-46", "--kind", "relates");
  assert.equal(written.status, 1, written.stdout);
  assert.match(written.stderr, /asks for --blocks, which names its own/u, written.stderr);
  assert.equal((state.calls ?? []).filter((one) => one.method !== "GET").length, 0);
});

test("a --kind naming no kind this CLI serves is refused against the set it takes", async () => {
  await read("ISS-45");
  state.calls = [];
  const run = await ran("issue", "ISS-45", "--unlink", "ISS-47", "--kind", "duplicates");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--kind takes blocks or relates, and `duplicates` is neither/u, run.stderr);
  assert.equal((state.calls ?? []).filter((one) => one.method !== "GET").length, 0);
});

test("both help texts name the flag, so a caller meeting the refusal can find it", async () => {
  for (const argv of [["issue", "-h"], ["-h"]]) {
    const run = await ran(...argv);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /--unlink ISS-46 --kind k/u, `forge ${argv.join(" ")} names no --kind`);
  }
});

/* ISS-1423: the renewal and the route both take one end, and the line between them asked after
   both — so a lease on the end this call never writes to refused the write, in words naming a
   payload nothing was going to touch. The check follows the write. */
const LIVE = () => ({ lease: { holder: "another-run", agent: "an agent", pid: "9",
  renewedAt: new Date().toISOString(), minutes: 60, history: [] } });

const holding = async (key, run) => {
  const row = rows.find((one) => one.issueId === key);
  row.sessionContext = LIVE();
  try {
    return await run();
  } finally {
    delete row.sessionContext;
  }
};

test("--blocks lands though the subject is held, the row it writes to being the other end", async () => {
  await read("ISS-45", "ISS-46");
  state.calls = [];
  const run = await holding("ISS-45", () => ran("issue", "ISS-45", "--blocks", "ISS-46"));
  assert.equal(run.status, 0, run.stderr);
  assert.equal(sentTo("/api/issues/u-ISS-46/dependencies", "POST").length, 1,
    "a lease on the end the edge is not written to refused the write");
});

test("--blocks is refused where the end it writes to is held, and the refusal names that run", async () => {
  await read("ISS-45", "ISS-46");
  state.calls = [];
  const run = await holding("ISS-46", () => ran("issue", "ISS-45", "--blocks", "ISS-46"));
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /another-run/u, run.stderr);
  assert.equal(sentTo("/api/issues/u-ISS-46/dependencies", "POST").length, 0);
});

test("--relates is refused on a held subject and lands on a held other end, the subject being its row", async () => {
  await read("ISS-45", "ISS-47");
  state.calls = [];
  const refused = await holding("ISS-45", () => ran("issue", "ISS-45", "--relates", "ISS-47"));
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(refused.stderr, /another-run/u, refused.stderr);
  assert.equal(sentTo("/api/issues/u-ISS-45/dependencies", "POST").length, 0);
  state.calls = [];
  const wrote = await holding("ISS-47", () => ran("issue", "ISS-45", "--relates", "ISS-47"));
  assert.equal(wrote.status, 0, wrote.stderr);
  assert.equal(sentTo("/api/issues/u-ISS-45/dependencies", "POST").length, 1);
});

test("--unlink keeps its check on the subject, which is the row the removal is written to", async () => {
  rows[0].relations = {
    blocks: [{ edgeId: "e-1", kind: "relates", toIssueId: "u-ISS-47", otherDisplayId: "ISS-47", otherStatus: "open" }],
    blockedBy: [],
  };
  await read("ISS-45");
  state.calls = [];
  const refused = await holding("ISS-45", () => ran("issue", "ISS-45", "--unlink", "ISS-47"));
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(refused.stderr, /another-run/u, refused.stderr);
  assert.equal(sentTo("/api/issues/u-ISS-45/dependencies/e-1", "DELETE").length, 0);
  state.calls = [];
  const gone = await holding("ISS-47", () => ran("issue", "ISS-45", "--unlink", "ISS-47"));
  assert.equal(gone.status, 0, gone.stderr);
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
