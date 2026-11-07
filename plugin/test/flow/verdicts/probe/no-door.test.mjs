/* A tracker that serves no verdict door answers the criteria read with the same absence, and a probe
   verdict sent there uploaded its evidence before the door refused it (ISS-62). */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("verdict-no-door").path;
const { refusing } = await import("../../../../src/refusal.mjs");
const { verdictDoorPrepared } = await import("../../../../src/flow/record/verdict/door.mjs");

const SHA = "c8c35500000000000000000000000000000000ab";
const PROBE = JSON.stringify({ kind: "request", request: { method: "GET", path: "/health", as: "anonymous" }, expect: { status: 200 } });
const BETA = "ROUTE_ABSENT: GET /api/issues/:id/criteria is not served";
const DEV = "NOT_FOUND: Not Found: GET /api/issues/x/criteria. No route serves it.";
const block = (extra = {}) => ({ criterion: "1", verdict: "pass", commit: SHA, evidence: ["shot.webm"], ...extra });
const prepared = (blocks, refused) => refusing(async () =>
  verdictDoorPrepared(blocks, { reference: "ISS-62", classes: null, refused, run: null }));

test("a --probe verdict where the tracker serves no verdict door is refused before anything goes up, naming the command without --probe", async () => {
  for (const refused of [BETA, DEV]) {
    await assert.rejects(prepared([block({ probe: PROBE })], refused),
      (error) => /serves no verdict door/u.test(error.message) && /without --probe/u.test(error.message)
        && error.message.includes(refused));
  }
});

test("without --probe the same write goes to the comment, as before", async () => {
  const { drafts, commentBlocks } = await prepared([block()], BETA);
  assert.equal(drafts.length, 0);
  assert.equal(commentBlocks.length, 1);
});

test("a criteria read refused for another reason leaves a --probe verdict to the door, as before", async () => {
  const { drafts } = await prepared([block({ probe: PROBE })], "UNAUTHORIZED: the token has expired");
  assert.equal(drafts.length, 1);
});
