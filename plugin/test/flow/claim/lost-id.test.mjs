/* A run's id is per-command: a context that compacts, or a call made from outside the tree that
   mints one, leaves the same run holding a different id — and its own live lease then reads as
   another run's. The refusal it met named `forge claim`, which is refused for the same reason, so
   the route out of the refusal was the refusal (ISS-1084). */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, standsInNoTree, tempHome, tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("lost-id").path;
standsInNoTree("lost-id");
process.env.AI_AGENT = "a-test-agent";
process.env.CLAUDE_PID = "3448870";
const { asItsHolder, leaseOf } = await import("../../../src/flow/lease.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const UUID = "lost-id-uuid";
const HOLDER = "iss-1084-5370ae10";
const WAVE = "the-whole-wave-of-them";
const RENEWED = "2026-09-10T10:46:00.000Z";

const ISSUE = {
  documentId: UUID,
  issueId: "ISS-1084",
  status: "in_progress",
  title: "a run that lost the id its lease is under",
  description: "no mark here",
  plan: "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.",
  acceptanceCriteria: "1. BR-05~1: the one outcome.",
  complexity: "s",
};

/* Live, so nothing here is about a lapse: the lease is renewed as this case starts and runs an hour. */
const heldBy = (holder, pid = "3448870") => {
  ISSUE.sessionContext = {
    lease: { holder, agent: "claude-code_2-1-258_agent", pid, renewedAt: new Date().toISOString(), minutes: 60, next: null, history: [] },
  };
};

const state = {
  calls: [],
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  issues: [ISSUE],
  comments: { [UUID]: [] },
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
      if (args.action === "update") Object.assign(ISSUE, args.data);
      return ISSUE;
    },
    forge_comments: (args) => {
      if (args.action !== "list") return { documentId: "a-comment" };
      return { comments: state.comments[UUID] ?? [], returned: 0, hasMore: false };
    },
  },
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const ran = (argv, who = WAVE) => ranAsync(FORGE, argv, { ...tracker.env, FORGE_SESSION_ID: who });
const updates = (from) => state.calls.slice(from)
  .filter((one) => one.name === "forge_issues" && one.args.action === "update");

test("a live lease whose pid is this call's own process hands the id back, in the command that was refused", async () => {
  heldBy(HOLDER);
  const before = state.calls.length;
  const refused = await ran(["record", "correction", "ISS-1084", "--moved", "a plan step", "--why", "the file moved"]);
  assert.equal(refused.status, 1, `the payload write should have been refused:\n${refused.stdout}${refused.stderr}`);
  assert.match(refused.stderr, new RegExp(`FORGE_SESSION_ID=${HOLDER} forge record correction ISS-1084 `
    + `--moved 'a plan step' --why 'the file moved'`, "u"),
  "the whole command that was refused, under the id the refusal had already printed");
  assert.match(refused.stderr, /the process and not the run inside it/u,
    "and what the pid does not establish, since every agent a session dispatched shares one");
  assert.deepEqual(updates(before), [], "nothing is taken on a pid: the field is left as the refusal read it");
});

test("the claim it sends a refused run to hands the same id back rather than naming itself again", async () => {
  heldBy(HOLDER);
  const refused = await ran(["claim", "ISS-1084"]);
  assert.equal(refused.status, 1, `the claim should have been refused:\n${refused.stdout}${refused.stderr}`);
  assert.match(refused.stderr, new RegExp(`FORGE_SESSION_ID=${HOLDER} forge claim ISS-1084`, "u"));
  assert.match(refused.stderr, /Where this call IS that run, under an id it has lost/u,
    "conditioned on the one thing only the caller can settle");
  assert.match(refused.stderr, /A caller that is not that run waits/u,
    "and the run that is not the holder keeps a route of its own");
});

test("a lease recording another process keeps the refusal it had, and the claim is the route it names", async () => {
  heldBy(HOLDER, "77");
  const refused = await ran(["claim", "ISS-1084"]);
  assert.equal(refused.status, 1, refused.stdout);
  assert.doesNotMatch(refused.stderr, /FORGE_SESSION_ID=/u, "no id is handed to a call the record cannot place");
  assert.ok(refused.stderr.trimEnd().endsWith("\n  forge claim ISS-1084"), "and the command it ends on is the ordinary one");
});

test("a second run dispatched to the same issue is refused as any second run is, and handed nothing", async () => {
  heldBy(HOLDER);
  const refused = await ran(["claim", "ISS-1084"], "iss-1084-99999999");
  assert.equal(refused.status, 1, refused.stdout);
  assert.doesNotMatch(refused.stderr, /FORGE_SESSION_ID=/u);
  assert.match(refused.stderr, /past the statuses a run is dispatched at/u, "which is the answer that case already had");
});

/* The other id ISS-467 gave a run: where the tree this call stands in minted the holder, the
   refusal already says to unset the variable and run from there, which proves what a pid cannot. */
test("a caller standing in the tree that minted the holder is handed no id, having a better route", () => {
  const at = tempRoom("lost-id-tree-");
  mkdirSync(join(at, ".git"));
  writeFileSync(join(at, ".git", "forge-run-id"), `${HOLDER}\n`);
  const lease = leaseOf({ lease: { holder: HOLDER, agent: "a", pid: "3448870", renewedAt: RENEWED, minutes: 60 } });
  const said = { held: { id: WAVE, source: "inherited" }, call: "forge claim ISS-1084" };
  assert.equal(asItsHolder("ISS-1084", lease, { ...said, at }), null);
  assert.match(asItsHolder("ISS-1084", lease, { ...said, at: tempRoom("lost-id-bare-") }) ?? "",
    /FORGE_SESSION_ID=/u, "where the same call stands anywhere else, the id is all it has");
});

test("the refusal names the moment the lease is anybody's, which is a duration past its expiry", () => {
  const lease = leaseOf({ lease: { holder: "another-run", agent: "a", pid: "77", renewedAt: RENEWED, minutes: 60 } });
  const at = tempRoom("lost-id-when-");
  const said = asItsHolder("ISS-1084", { ...lease, holder: HOLDER, pid: "3448870" },
    { held: { id: WAVE, source: "inherited" }, at, call: "forge claim ISS-1084" });
  assert.match(said, /anybody's from 2026-09-10T12:46/u,
    "two hours after a lease renewed at 10:46 for sixty minutes, and not the 11:46 it expires at");
  const late = asItsHolder("ISS-1084", { ...lease, holder: HOLDER, pid: "3448870", renewedAt: "2026-09-10T10:46:30.000Z" },
    { held: { id: WAVE, source: "inherited" }, at, call: "forge claim ISS-1084" });
  assert.match(late, /anybody's from 2026-09-10T12:47/u,
    "and the minute printed is one the lease is free at, where truncating it would name 12:46, at which it is not");
});
