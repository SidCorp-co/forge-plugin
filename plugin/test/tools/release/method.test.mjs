/* Agenfold's ISS-28 release: `forge coolify deploy --run` was refused RELEASE_NOTHING_RECORDED until the
   run announced its method, and no verb of this CLI made that call. `forge release-batch method` makes
   it, with the body core's route takes (`skill`, `loaded`, `detail`), and refuses locally what that
   route would refuse. */
import assert from "node:assert/strict";
import test, { after } from "node:test";

import { fakeTracker, projectRoom, ranAsync, tempRoom } from "../../fixtures.mjs";
import { OWN } from "../../fixtures/own-project.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const RUN_ID = "11111111-2222-4333-8444-555555555555";

const state = {
  answer: {
    forge_release_batch: (args) => {
      if (args.action === "method") return { ...args.data, detail: args.data.detail ?? null, announcedAt: "2026-10-31T12:00:00.000Z" };
      throw new Error(`release-batch method double asked for ${args.action}`);
    },
  },
};
const tracker = await fakeTracker(state);
after(() => tracker.close());
const room = projectRoom(tempRoom("release-method-"), tracker.env.XDG_CONFIG_HOME, { slug: OWN.slug });

const ran = async (...argv) => {
  state.calls = [];
  const answer = await ranAsync(FORGE, ["release-batch", "method", ...argv], tracker.env, room);
  const sent = (state.calls ?? []).filter((one) => one.path.endsWith("/method"));
  return { ...answer, sent };
};

test("method posts the run's skill, loaded, to the run's method route and names the deploy it unblocks", async () => {
  const run = await ran(RUN_ID, "--skill", "release-flow");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.sent.length, 1, "one call");
  assert.equal(run.sent[0].method, "POST");
  assert.match(run.sent[0].path, new RegExp(`/release-batches/${RUN_ID}/method$`, "u"));
  assert.deepEqual(run.sent[0].sent, { skill: "release-flow", loaded: true });
  assert.match(run.stdout, new RegExp(`--run ${RUN_ID}\` on the tracker route's \`forge coolify deploy\``, "u"));
});

test("--not-loaded with a detail is the answer core takes for a method that would not load", async () => {
  const run = await ran(RUN_ID, "--skill", "release-flow", "--not-loaded", "--detail", "the plugin copy is stale");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(run.sent[0].sent, { skill: "release-flow", loaded: false, detail: "the plugin copy is stale" });
  assert.match(run.stdout, /not loaded/u);
});

test("no runId, no skill, an empty detail or one over core's bound is refused before any call", async () => {
  for (const [argv, why] of [
    [["--skill", "release-flow"], /runId is owed/u],
    [[RUN_ID], /--skill is owed/u],
    [[RUN_ID, "--skill", "x".repeat(201)], /201 characters and core takes 200/u],
    [[RUN_ID, "--skill", "release-flow", "--detail", " "], /--detail was given empty/u],
    [[RUN_ID, "--skill", "release-flow", "--detail", "d".repeat(4001)], /4001 characters and core takes 4000/u],
  ]) {
    const run = await ran(...argv);
    assert.equal(run.status, 1, `${argv}: ${run.stdout}`);
    assert.match(run.stderr, /^release-batch method: nothing written\./u, run.stderr);
    assert.match(run.stderr, why, run.stderr);
    assert.deepEqual(run.sent, [], `${argv}: nothing was sent`);
  }
});
