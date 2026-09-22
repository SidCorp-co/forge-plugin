/* The act that ends an owing is the act that reports what was owed to it. `transitionTo` calls this
   with the status the tracker answered and the issue's own key, so what is proven here is the
   reading it does off the checkout: which criteria cited that key, and that a tree it was handed
   none of is told nothing. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, projectRecord, projectRoom, ranAsync, tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("gone-escapes").path;
const { escapesOrphaned } = await import("../../../src/checks/docs/owing-escapes.mjs");
const { NO_LONGER_OWES } = await import("../../../src/flow/earned/park-status.mjs");
const { escapesIn, owedTo } = await import("../../../src/spec/claims/proof.mjs");
const { specTreeRead } = await import("../../../src/spec/tree.mjs");

const clause = (id, proof) =>
  `- **${id}** · Rev: 1 · Proof: ${proof}\n  WHEN a case is named THEN the checker SHALL read it.\n`;

const HELD = {
  documents: [
    { file: "docs/requirements/srs/fr-05-z.md",
      text: `## UC-05-1 — A use case\n\nRev: 1\n\n${clause("AC-05-1-1", "none yet — ISS-7")}`
        + `${clause("AC-05-1-2", "none yet — ISS-9")}${clause("AC-05-1-3", "none yet — ISS-7")}` },
  ],
};

test("a move to closed names every criterion whose escape cites the key, with its file and line", () => {
  const said = escapesOrphaned("closed", "ISS-7", HELD);
  assert.equal(said[0], "", "a blank line, so the report is not run onto the move's own line");
  assert.equal(said[1], "2 criteria under docs/requirements/ stand unproved and owed to ISS-7, "
    + "which owes nothing now:");
  assert.deepEqual(said.slice(2, 4), [
    "  docs/requirements/srs/fr-05-z.md:5 AC-05-1-1",
    "  docs/requirements/srs/fr-05-z.md:9 AC-05-1-3",
  ], "each criterion carries the line it is written on, not the line its document opens at");
  assert.ok(said[4].startsWith("Point each at the case that proves its clause"), said[4]);
  assert.equal(said.length, 5);
});

test("only the statuses that owe nothing say anything, and a key nothing cited says nothing", () => {
  assert.deepEqual(NO_LONGER_OWES, ["closed", "dropped"]);
  for (const status of NO_LONGER_OWES) {
    assert.ok(escapesOrphaned(status, "ISS-7", HELD).length, `${status} reports what it orphaned`);
  }
  for (const status of ["open", "confirmed", "approved", "in_progress", "developed", "testing",
    "awaiting_release", "needs_info", "waiting", "on_hold"]) {
    assert.deepEqual(escapesOrphaned(status, "ISS-7", HELD), [],
      `${status} still owes, so nothing was orphaned`);
  }
  assert.deepEqual(escapesOrphaned("closed", "ISS-4444", HELD), [],
    "and a key no criterion cited leaves the move's output as it was");
  /* One spelling and not two: the shape checker already refuses a lower-cased escape as naming no
     issue, so reading one here would report against a line the gate is red about anyway. */
  assert.equal(owedTo("none yet — iss-7"), null);
  assert.equal(owedTo("none yet — ISS-7"), "ISS-7");
});

test("a project that keeps no requirements tree is told nothing at all", () => {
  assert.deepEqual(escapesOrphaned("closed", "ISS-7", null), []);
  assert.deepEqual(escapesOrphaned("dropped", "ISS-7", { documents: [] }), []);
  /* Synchronous, which is the whole of the claim that it spends no call: there is no point in it at
     which a request could have been awaited. */
  assert.ok(Array.isArray(escapesOrphaned("closed", "ISS-7", HELD)));
});

/* Spawned, because what is under test is the one line `transitionTo` gained: a direct call to the
   helper passes with that line gone (codex F2). The key is read off this checkout's own tree, so the
   case follows the tree rather than pinning a criterion that may be reproved tomorrow. */
const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../../..", import.meta.url).pathname;

const CITED = escapesIn(specTreeRead().documents);
const KEY = [...CITED.reduce((held, one) =>
  held.set(one.key, (held.get(one.key) ?? 0) + 1), new Map())]
  .sort((one, two) => two[1] - one[1])[0][0];
const OWED = CITED.filter((one) => one.key === KEY);

const HOLDER = "gone-escapes-run";
const LEASE = { holder: HOLDER, agent: "claude-code_2-1-258_agent", pid: String(process.pid),
  renewedAt: new Date().toISOString(), minutes: 30 };
const READY = {
  documentId: "11111111-2222-4222-8222-222222222222",
  issueId: KEY,
  status: "awaiting_release",
  title: "the issue the tree's escapes are owed to",
  description: "no mark here",
  releaseNotes: { section: "Skip", userFacing: "-" },
  sessionContext: { lease: LEASE },
};
const state = {
  issues: [READY],
  comments: { [READY.documentId]: [] },
  answer: {
    forge_config: () => ({ config: { baseBranch: "master", releaseModel: "publish",
      pipelineConfig: { autoProdDeploy: true } } }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: [READY], returned: 1, hasMore: false };
      if (args.action === "get") return READY;
      if (args.action === "transition") {
        READY.status = args.data.status;
        return { ...READY };
      }
      return Object.assign(READY, args.data ?? {});
    },
  },
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());
const ENV = { ...tracker.env, FORGE_SESSION_ID: HOLDER };
projectRecord(ROOT, tracker.env.XDG_CONFIG_HOME, { slug: "forge-plugin" });
const closing = (at) => {
  READY.status = "awaiting_release";
  return ranAsync(FORGE, ["advance", KEY], ENV, at);
};

test("forge advance closing an issue names the criteria whose escape cited it", async () => {
  const run = await closing(ROOT);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, new RegExp(`^${KEY} {2}awaiting_release -> closed`, "mu"), run.stdout);
  assert.ok(run.stdout.includes(`${OWED.length} criteria under docs/requirements/ stand unproved `
    + `and owed to ${KEY}, which owes nothing now:`), run.stdout);
  for (const one of OWED.slice(0, 3)) {
    assert.ok(run.stdout.includes(`  ${one.file}:${one.line} ${one.id}`),
      `${one.id} is owed to ${KEY} and the move did not name it: ${run.stdout}`);
  }
});

test("a move from a checkout that keeps no requirements tree says nothing about escapes", async () => {
  const room = tempHome("gone-escapes-treeless");
  projectRoom(room.path, tracker.env.XDG_CONFIG_HOME, { slug: "forge-plugin" });
  const run = await closing(room.path);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, new RegExp(`^${KEY} {2}awaiting_release -> closed`, "mu"), run.stdout);
  assert.doesNotMatch(run.stdout, /stand unproved and owed to/u,
    "a directory with no tree under it is told nothing, rather than told none");
  room.remove();
});
