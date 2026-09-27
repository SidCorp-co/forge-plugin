/* The ISS-93 and ISS-415 runs armed a landing on an issue still at `approved`: the capture took it,
   resume went on naming Phase 4, and the landing merged and released a change whose status it could
   not then move (ISS-2604). The capture reads the status a build stands at off the flow's order. */
import assert from "node:assert/strict";
import test from "node:test";

import { BUILDER, CHANGED, checkpoint, field, ran, state } from "../fixture.mjs";

const said = (run) => `${run.stdout}${run.stderr}`;
const at = (status) => {
  field(null, null);
  state.issues[0] = { ...state.issues[0], status };
};

const CHAINS = {
  open: ["confirmed", "approved", "in_progress"],
  confirmed: ["approved", "in_progress"],
  approved: ["in_progress"],
};

test("a ready capture before the build is refused, writes nothing, and prints each advance then the capture", async () => {
  for (const [status, chain] of Object.entries(CHAINS)) {
    at(status);
    const run = await ran(["claim", "ISS-673", "--pushed", "--ready"], BUILDER, CHANGED);
    assert.equal(run.status, 1, `${status}: ${said(run)}`);
    assert.equal(checkpoint(), null, `${status}: no checkpoint was written`);
    assert.equal(state.issues[0].sessionContext?.worklog, undefined, `${status}: nor the capture beside it`);
    assert.ok(run.stderr.includes(`ISS-673 stands at \`${status}\`, before \`in_progress\``),
      `${status}: naming the status it read:\n${run.stderr}`);
    const lines = chain.map((to) => `  forge advance ISS-673 --to ${to}\n`).join("");
    assert.ok(run.stderr.includes(`again:\n${lines}  forge claim ISS-673 --pushed --ready`),
      `${status}: one advance per status owed, in order, then the capture:\n${run.stderr}`);
    assert.equal(state.issues[0].status, status, `${status}: and the capture moved no status`);
  }
});

test("a ready capture at in_progress writes the checkpoint", async () => {
  at("in_progress");
  const run = await ran(["claim", "ISS-673", "--pushed", "--ready"], BUILDER, CHANGED);
  assert.equal(run.status, 0, said(run));
  assert.equal(checkpoint().state, "ready", said(run));
});
