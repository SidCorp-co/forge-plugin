/* `forge next` left an issue out behind a blocker that was dropped, and behind an edge the tracker
   reported expired, reading both through a predicate that did not see either (ISS-347). The verb end
   to end, so the case reads what a dispatcher reads. */
import assert from "node:assert/strict";
import test from "node:test";

import { issue, rankRoom } from "../room.mjs";

const { load, ran, close } = await rankRoom();
test.after(close);

const edge = (otherStatus, held = {}) => ({ otherDisplayId: "ISS-9", otherStatus, kind: "blocks", ...held });
const ranked = async (blocker, status) => {
  load([
    issue("ISS-1", { priority: "critical", relations: { blockedBy: [blocker], blocks: [] } }),
    issue("ISS-9", { priority: "low", status }),
  ]);
  const run = await ran(["next", "--json"]);
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
};

test("an issue whose blocker was dropped is ranked rather than left out", async () => {
  const held = await ranked(edge("dropped"), "dropped");
  assert.deepEqual(held.dropped.filter((one) => one.issueId === "ISS-1"), [], "nothing left ISS-1 out");
  assert.equal(held.candidates[0].issueId, "ISS-1");
});

test("an issue whose only blocking edge expired is ranked rather than left out", async () => {
  const held = await ranked(edge("open", { expired: true, validUntil: "2026-01-01T00:00:00.000Z" }), "open");
  assert.deepEqual(held.dropped.filter((one) => one.issueId === "ISS-1"), [], "nothing left ISS-1 out");
  assert.equal(held.candidates[0].issueId, "ISS-1");
  const live = await ranked(edge("open"), "open");
  assert.deepEqual(live.dropped.map((one) => one.reason), ["blocked by ISS-9 (open)"],
    "while the same edge unexpired still leaves it out");
});
