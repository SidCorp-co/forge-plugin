/* What this project left ready is a claim about a whole backlog, so a page reporting rows behind it
   and then serving none is a read nothing is landed on. Its own file: one walk is shared per ask for
   a process's life, so a short one has to be the only walk there is (AC-02-2-1, ISS-1632). */
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { BASE, forgetGateRuns, gateRuns, landingRan, ready, seeded, sha, state, tracker, world } from "./fixture.mjs";

test.after(() => tracker.close());

const remote = (at) => sha(join(at, "origin.git"), `refs/heads/${BASE}`);

test("an empty call whose read of the backlog came back short lands nothing and says which read", async () => {
  const { at, work, head, base } = world({ base: "other" });
  const pinned = remote(at);
  seeded({ landing: ready(head, base) });
  forgetGateRuns();
  const whole = state.answer.forge_issues;
  state.answer.forge_issues = (args) => (args.action === "list"
    ? { issues: state.issues, returned: state.issues.length, hasMore: false, beyond: 4 }
    : whole(args));
  const said = await landingRan([], work);
  state.answer.forge_issues = whole;
  assert.match(said, /The set of issues a landing could take reached [^\n]*the reading is incomplete/u, said);
  assert.match(said, /no batch is built on a read that came back short/u, said);
  assert.match(said, /land-ready ISS-45/u, `and the way out is naming them:\n${said}`);
  assert.deepEqual(gateRuns(), [], `nothing is gated on it:\n${said}`);
  assert.equal(remote(at), pinned, `and nothing landed:\n${said}`);
});
