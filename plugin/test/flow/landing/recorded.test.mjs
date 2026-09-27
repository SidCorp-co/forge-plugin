/* The records turn's hand-back walks the statuses its records earn, since the landing's turn it hands
   back to held nothing but that walk and nothing ran it (ISS-2690). The case that ends at `done` is
   the landing's own suite's, which holds a record that earns every rung; these are the two that do
   not end there. */
import assert from "node:assert/strict";
import test from "node:test";

import { BUILDER, BUILT, checkpoint, field, lease, ran, state } from "./fixture.mjs";

const RELEASE = "1a2b3c40000000000000000000000000000fade";
const RECORDS = { ...BUILT, state: "records-owed", owed: "marked", intended: RELEASE };

test("a records turn whose record earns no rung leaves the checkpoint where it returned, naming the landing's take", async () => {
  for (const owed of ["marked", "judged"]) {
    field({ ...RECORDS, owed }, lease(BUILDER));
    const back = await ran(["claim", "ISS-673", "--recorded"], BUILDER);
    const said = `${back.stdout}${back.stderr}`;
    assert.equal(back.status, 0, `${owed}: the hand-back is never refused on its records:\n${said}`);
    assert.equal(checkpoint().state, owed, `${owed}: the checkpoint stays where the hand-back returned it`);
    assert.equal(state.issues[0].status, "developed", `${owed}: and no rung moved:\n${said}`);
    assert.match(said, /The record does not earn `testing`/u, `${owed}: naming the rung it is short of:\n${said}`);
    assert.match(said, /forge claim ISS-673 --take$/mu, `${owed}: and the landing's take:\n${said}`);
  }
});

test("a records turn on an after-merge landing with an independent judge hands the release to the judge", async () => {
  const was = state.config;
  state.config = { ...was, pipelineConfig: { ...was.pipelineConfig, qa: "independent" } };
  try {
    field(RECORDS, lease(BUILDER));
    const back = await ran(["claim", "ISS-673", "--recorded"], BUILDER);
    const said = `${back.stdout}${back.stderr}`;
    assert.equal(back.status, 0, said);
    assert.equal(checkpoint().state, "qa-owed", `the judge's turn:\n${said}`);
    assert.equal(checkpoint().deployment, RELEASE, "over the release the landing pushed");
    assert.match(said, /forge claim ISS-673 --take\n {4}\.\.\. the verdicts, then: forge claim ISS-673 --judged/u,
      `naming the take and the hand-back the judge runs:\n${said}`);
  } finally {
    state.config = was;
  }
});
