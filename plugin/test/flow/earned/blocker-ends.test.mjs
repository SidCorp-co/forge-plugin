/* A blocker that was dropped held its dependant forever, a status off the ladder reading as below
   `developed`, and an edge the tracker reported expired held it too, the predicate never reading
   the edge's own expiry (ISS-347). Every reader goes through that one predicate, so each case below
   is asked of the reader a verb prints from. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("blocker-ends").path;
const { render } = await import("../../../src/flow/record/page.mjs");
const { CHECKS, holdsBack, viewFrom } = await import("../../../src/flow/earned.mjs");
const { eligibilityOf } = await import("../../../src/rank/eligible.mjs");
const { holdingKeys } = await import("../../../src/rank/score.mjs");

const BASELINE = {
  createdAt: "2026-09-27T09:00:00.000Z",
  authorId: "agent",
  body: render("baseline", { gate: "npm run check", result: "354 pass", commit: "43b811e" }),
};
const BUILT = { sessionContext: { worklog: { branch: "iss-3-the-work" } } };
const edge = (otherStatus, held = {}) => ({ otherDisplayId: "ISS-4", otherStatus, kind: "blocks", ...held });
const owed = (...blockedBy) =>
  CHECKS.in_progress(viewFrom("the-uuid", { ...BUILT, relations: { blockedBy } }, [BASELINE]), "ISS-3")
    .map((one) => one.what);
const PAST = "2026-01-01T00:00:00.000Z";
const FUTURE = "2999-01-01T00:00:00.000Z";

test("forge advance holds nothing back for a blocker at either terminal status", () => {
  assert.deepEqual(owed(edge("closed")), [], "a closed blocker landed");
  assert.deepEqual(owed(edge("dropped")), [], "and a dropped one never will, so it orders nothing either");
});

test("forge advance still refuses on an open blocker, and the refusal names it", () => {
  assert.deepEqual(owed(edge("open")), ["ISS-4 gates this by a blocks edge and is open, which is not yet developed"]);
});

test("a blocker that got past developed off the ladder holds nothing", () => {
  assert.deepEqual(owed(edge("releasing")), [], "releasing is reached only past awaiting_release");
  assert.deepEqual(owed(edge("tested")), [], "and the retired name reads at the rung that took it over");
});

test("an edge the tracker reports expired holds nothing, whatever its blocker", () => {
  assert.deepEqual(owed(edge("open", { expired: true, validUntil: PAST })), []);
  assert.deepEqual(owed(edge("needs_info", { expired: true })), [], "the tracker's own answer is enough");
});

test("an edge with no expired field is judged on its validUntil, and one carrying neither holds", () => {
  assert.deepEqual(owed(edge("open", { validUntil: PAST })), [], "a validUntil in the past retracted it");
  assert.equal(owed(edge("open", { validUntil: FUTURE })).length, 1, "one still ahead has not");
  assert.deepEqual(owed(edge("open")),
    ["ISS-4 gates this by a blocks edge and is open, which is not yet developed"],
    "and absent evidence is no retraction");
  assert.equal(owed(edge("open", { expired: false, validUntil: PAST })).length, 1,
    "the tracker's own field, where it sent one, is the answer rather than a second reading of the date");
});

test("a blocker parked or waiting holds its dependant back", () => {
  for (const status of ["waiting", "on_hold", "needs_info", "reopen", "draft"]) {
    assert.equal(owed(edge(status)).length, 1, `${status} released its dependant`);
  }
  assert.equal(owed(edge("nothing-the-table-declares")).length, 1, "and a name nobody declared holds too");
});

test("forge next does not leave an issue out for a dropped blocker or an expired edge", () => {
  const row = { issueId: "ISS-3", status: "open" };
  const judged = (blocker) => eligibilityOf(row, { blockers: [blocker] });
  assert.deepEqual(judged(edge("dropped")), { eligible: true, soft: false, reason: null });
  assert.deepEqual(judged(edge("open", { expired: true })), { eligible: true, soft: false, reason: null });
  assert.equal(judged(edge("open")).reason, "blocked by ISS-4 (open)", "while a live ordering still leaves it out");
});

test("forge next's holding set does not count a dropped issue as holding anything", () => {
  const rows = ["open", "dropped", "closed", "releasing", "on_hold"]
    .map((status, index) => ({ issueId: `ISS-${index + 1}`, status }));
  assert.deepEqual([...holdingKeys(rows)], ["ISS-1", "ISS-5"]);
  assert.equal(holdsBack(edge("dropped")), false);
});
