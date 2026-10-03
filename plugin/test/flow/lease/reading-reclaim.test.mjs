/* A reclaim's row keeps the line of the lease it went over, so a reclaim over a lease that declared
   nothing was worked is a reading that lapsed — the idiom `forge claim -h` teaches — and not a run
   that died there; and that declaration speaks for the lease that wrote it alone (ISS-1537). */
import assert from "node:assert/strict";
import test from "node:test";

import { standsInNoTree, tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("reading-reclaim").path;
standsInNoTree("reading-reclaim");

const { NOTHING_WORKED, claimed, leaseOf } = await import("../../../src/flow/lease.mjs");
const { historyLine, leftOutOf, reclaimsOf, tookWhy, uncountedWhy } = await import("../../../src/flow/lease/crash-park.mjs");

const READING = uncountedWhy({ how: "reclaim", next: NOTHING_WORKED }, null);
const readingsOf = (lease, status) => leftOutOf(lease, status).find((one) => one.why === READING)?.count ?? 0;
const tookReading = (lease) => tookWhy(lease)?.why === READING;

const AT = "2026-09-02T12:00:00.000Z";
const held = (holder, at = AT, minutes = 30, history = []) =>
  ({ holder, agent: "a-test-agent", pid: "4242", renewedAt: at, minutes, next: null, history });

test("a reclaim over a lease that declared nothing was worked is named and not counted", () => {
  const row = (next, status = "open") => ({ holder: "a", at: AT, how: "reclaim", status, next });
  const lease = held("a-run", AT, 30, [
    row(NOTHING_WORKED),
    row("a second pass-over was recorded; nothing was worked under this lease"),
    row(`${NOTHING_WORKED}.`),
    row(null),
    row("fold F1"),
    row(`${NOTHING_WORKED}, it said; then the migration ran`),
  ]);
  assert.equal(reclaimsOf(lease, "open"), 3, "the three that declared no work are left out, and the other three counted");
  assert.equal(readingsOf(lease, "open"), 3, "and the ones left out are counted apart, for the line that says so");
  const line = historyLine(lease, "open").split(" | ");
  assert.deepEqual(line.map((one) => one.endsWith(", over a lease that declared nothing was worked, so not counted")),
    [true, true, true, false, false, false], line.join("\n"));
  assert.equal(reclaimsOf(held("a-run", AT, 30, [row(null), row(NOTHING_WORKED, "developed")]), "open"), 1,
    "still counted per status");
  const claimRow = { holder: "a", at: AT, how: "claim", status: "open", next: NOTHING_WORKED };
  assert.equal(historyLine(held("a-run", AT, 30, [claimRow]), "open").includes("not counted"), false,
    "a first claim was never counted, so nothing is said of it");
  assert.equal(tookReading(lease), false, "the newest row decides whether the claim just made was over a reading");
  assert.equal(tookReading(held("a-run", AT, 30, [row(null), row(NOTHING_WORKED)])), true);
});

/* A declaration that nothing was worked speaks for the lease that wrote it, so a new holder's silence does not carry it onto a lease that may be worked and then die (ISS-1537). */
test("a new holder does not inherit the line that says nothing was worked", () => {
  const reading = { lease: { ...held("a-reader"), next: NOTHING_WORKED } };
  for (const how of ["reclaim", "handed", "claim"]) {
    const took = leaseOf(claimed(reading, { holder: "a-runner", at: AT, minutes: 60, how, status: "open" }));
    assert.equal(took.next, null, `a ${how} with no --next leaves the new lease with no line`);
    assert.equal(took.history.at(-1).next, NOTHING_WORKED, "while its row keeps the line of the lease it went over");
  }
  const renewed = leaseOf(claimed(reading, { holder: "a-reader", at: AT, minutes: 10 }));
  assert.equal(renewed.next, NOTHING_WORKED, "the holder that wrote it keeps it across its own renewal");
  const stepped = { lease: { ...held("a-dead-run"), next: "fold F1" } };
  assert.equal(leaseOf(claimed(stepped, { holder: "a-runner", at: AT, minutes: 60, how: "reclaim", status: "open" })).next,
    "fold F1", "any other line is a step, and is carried forward unchanged");
  assert.equal(leaseOf(claimed(reading, { holder: "a-runner", at: AT, minutes: 60, how: "reclaim", status: "open", next: "write the plan" })).next,
    "write the plan", "and a line the new holder names is its own");
});
