/* `forge issue --set module=<name>`: an issue already filed put in one of its project's modules as its
   primary, on the override route the triage reading sets complexity and priority by. What is watched
   is the label set that goes up — every other label kept, the old primary dropped — the read-back
   that answers for it, and the reply and correction naming the module rather than the ids sent. */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempHome } from "../fixtures.mjs";
import { trackerFor } from "../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("override-module").path;
const { UNREAD } = await import("../../src/flow/override.mjs");

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const WHY = "the body names plugin/src/flow/lease.mjs and nothing outside it";

const MODULES = [
  { id: "m-flow", name: "flow", kind: "module", parentId: null, description: null },
  { id: "m-rank", name: "rank", kind: "module", parentId: null, description: null },
  { id: "m-hooks", name: "hooks", kind: "module", parentId: null, description: null },
];
const OTHER = { id: "l-regression", name: "regression", kind: "label", parentId: null, description: null };

const ISSUE = { documentId: "module-uuid", issueId: "ISS-97", status: "confirmed", complexity: "s", priority: "medium",
  title: "the issue a triage reading puts in a module", description: "`forge claim` renews twice." };

/* The tracker's update replaces the label set it is sent, bare ids as secondaries and the one object
   as the primary; `state.dropsPrimary` is a tracker that acknowledges the set and keeps it unmarked. */
const relabelled = (sent) => sent.map((one) => (typeof one === "string"
  ? { id: one, isPrimary: false }
  : { id: one.labelId, isPrimary: Boolean(one.isPrimary) && !state.dropsPrimary }));

let clock = 0;
const state = {
  calls: [],
  comments: {},
  labels: [...MODULES, OTHER],
  answer: {
    forge_issues: (args) => {
      if (args.action === "list") return { issues: [ISSUE], returned: 1, hasMore: false };
      if (args.action === "get") return ISSUE;
      if (args.action === "update") {
        const { labels, ...rest } = args.data ?? {};
        return Object.assign(ISSUE, rest, labels ? { labels: relabelled(labels) } : {});
      }
      return undefined;
    },
    forge_comments: (args) => {
      if (args.action !== "list") {
        clock += 1;
        const one = { documentId: `c-${clock}`, createdAt: `2026-09-27T01:${String(clock).padStart(2, "0")}:00.000Z`,
          authorId: "agent", body: args.data.body };
        (state.comments[args.data.issue] ??= []).push(one);
        return { documentId: one.documentId };
      }
      const held = state.comments[args.filters?.issue] ?? [];
      return { comments: held, returned: held.length, hasMore: false };
    },
  },
};
const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());
await ranAsync(FORGE, ["claim", "ISS-97", "--unheld"], ENV);
const MINE = structuredClone(ISSUE.sessionContext);

const before = (labels) => {
  ISSUE.labels = labels;
  ISSUE.complexity = "s";
  ISSUE.sessionContext = structuredClone(MINE);
  state.dropsPrimary = false;
  state.calls = [];
  state.comments[ISSUE.documentId] = [];
};
const setField = (...argv) => ranAsync(FORGE, ["issue", "ISS-97", ...argv], ENV);
/* The field updates, told from the lease renewals that go through the same action. */
const fieldUpdates = () => state.calls
  .filter((one) => one.name === "forge_issues" && one.args.action === "update" && !one.args.data?.sessionContext);
const corrections = () => state.calls
  .filter((one) => one.name === "forge_comments" && one.args.action === "create")
  .map((one) => one.args.data.body);

test("--set module writes the named module as the issue's primary, read back, and says no check read it", async () => {
  before([]);
  const run = await setField("--set", "module=flow", "--why", WHY);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(fieldUpdates().map((one) => one.args.data.labels), [[{ labelId: "m-flow", isPrimary: true }]]);
  assert.deepEqual(ISSUE.labels, [{ id: "m-flow", isPrimary: true }], "the tracker now holds flow as the primary");
  assert.match(run.stdout, /^ISS-97 {2}module is flow$/mu);
  assert.ok(run.stdout.includes(UNREAD), "the reply says no entry check read the write");
});

test("--set module leaves one correction naming the module and the reason, not the ids sent", async () => {
  before([]);
  const run = await setField("--set", "module=flow", "--why", WHY);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const posted = corrections();
  assert.equal(posted.length, 1, "one correction for the call");
  assert.match(posted[0], /module set to `flow` by `forge issue --set`/u);
  assert.ok(posted[0].includes(WHY), "the reason given is on it");
  assert.doesNotMatch(posted[0], /m-flow/u, "the correction names the module, not its id");
});

test("--set module keeps every other label and drops the primary the issue held before", async () => {
  before([{ id: "m-rank", isPrimary: true }, { id: "m-hooks", isPrimary: false }, { id: "l-regression", isPrimary: false }]);
  const run = await setField("--set", "module=flow", "--why", WHY);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(fieldUpdates()[0].args.data.labels, ["m-hooks", "l-regression", { labelId: "m-flow", isPrimary: true }]);
  assert.deepEqual(ISSUE.labels, [
    { id: "m-hooks", isPrimary: false }, { id: "l-regression", isPrimary: false }, { id: "m-flow", isPrimary: true },
  ]);
});

test("--set module promotes a module the issue carried as a secondary, and sends it once", async () => {
  before([{ id: "m-rank", isPrimary: true }, { id: "m-flow", isPrimary: false }]);
  const run = await setField("--set", "module=flow", "--why", WHY);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const sent = fieldUpdates()[0].args.data.labels;
  assert.equal(sent.filter((one) => one === "m-flow" || one?.labelId === "m-flow").length, 1, "flow is in the set once");
  assert.deepEqual(ISSUE.labels, [{ id: "m-flow", isPrimary: true }], "and reads back as the primary");
});

test("a module the project does not define is refused before any update, listing the defined ones", async () => {
  before([]);
  const run = await setField("--set", "module=flwo", "--why", WHY);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /--set module names `flwo`, which is no module of this project\. Did you mean: flow\?/u);
  assert.match(run.stderr, /This project defines: flow, rank, hooks\./u);
  assert.match(run.stderr, /Nothing was sent: `forge doctor modules --add flwo` defines it/u);
  assert.equal(state.calls.filter((one) => one.name === "forge_issues" && one.args.action === "update").length, 0,
    "not even the lease was renewed");
});

test("--set module beside --set complexity goes up in one field update and one correction", async () => {
  before([]);
  const run = await setField("--set", "complexity=m", "--set", "module=flow", "--why", WHY);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const updates = fieldUpdates();
  assert.equal(updates.length, 1, "one field update");
  assert.deepEqual(updates[0].args.data, { complexity: "m", labels: [{ labelId: "m-flow", isPrimary: true }] });
  const posted = corrections();
  assert.equal(posted.length, 1, "one correction");
  assert.match(posted[0], /complexity set to `m`, module set to `flow` by `forge issue --set`/u);
});

test("a set the tracker acknowledges without keeping the primary is refused as not read back", async () => {
  before([]);
  state.dropsPrimary = true;
  const run = await setField("--set", "module=flow", "--why", WHY);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /The update answered success but module did not read back as written/u);
});

test("where the module does not read back and complexity does, the correction names complexity alone", async () => {
  before([]);
  state.dropsPrimary = true;
  const run = await setField("--set", "complexity=m", "--set", "module=flow", "--why", WHY);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /module did not read back as written.* complexity did read back as written and stands\./su);
  const posted = corrections();
  assert.equal(posted.length, 1);
  assert.match(posted[0], /complexity set to `m` by `forge issue --set`/u);
  assert.doesNotMatch(posted[0], /module set to|labels/u, "nothing claims the module moved");
});

test("--set labels is refused, naming --set module as the route for an issue already filed", async () => {
  before([]);
  const run = await setField("--set", "labels=m-flow", "--why", WHY);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /labels is written by .*`forge issue <ref> --set module=<name> --why <w>` on an issue already filed/u);
  assert.equal(fieldUpdates().length, 0);
});

test("the dispatch method has the triage reader write the module, or say the body decided none", async () => {
  const run = await ranAsync(FORGE, ["guide", "dispatch"], ENV);
  assert.equal(run.status, 0, run.stderr);
  const text = run.stdout.replace(/\s+/gu, " ");
  assert.match(text, /Where this project defines modules, the same reader puts the candidate in one\./u);
  assert.match(text, /`forge issue ISS-nn --set module=<name> --why <w>`/u);
  assert.match(text, /A body that does not decide one is left without one, and the reading says so in its confirmation/u);
});
