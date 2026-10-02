/* A reclaim taken after the issue moved on from where the run it went over took it — its status or
   its landing state changed between the two rows — is a pickup the route hands round and not a
   status where runs stop, so the count leaves it out; and the park the count names says whom the
   latest counted reclaim went over (ISS-2267). */
import assert from "node:assert/strict";
import test from "node:test";

import { standsInNoTree, tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("moved-reclaim").path;
standsInNoTree("moved-reclaim");

const { NOTHING_WORKED } = await import("../../../src/flow/lease.mjs");
const { historyLine, movedOf, overWhom, readingsOf, reclaimsOf, tookMoved } =
  await import("../../../src/flow/lease/crash-park.mjs");

const AT = "2026-09-02T12:00:00.000Z";
const held = (history) => ({ holder: "now", agent: "a", pid: "1", renewedAt: AT, minutes: 30, next: null, history });
const row = (holder, how, status, landing = null, next = null) =>
  ({ holder, at: AT, how, status, next, ...(landing ? { landing } : {}) });

/* The independent-judgement route on one repaired issue: the builder lands and hands the turn to the
   judge, the judge hands back a failure, the repair run lands again, a second judge picks it up. */
const ROUTE = held([
  row("builder", "claim", "in_progress"),
  row("judge-1", "reclaim", "developed", "qa-owed", "landed; the judge's turn"),
  row("repair", "reclaim", "developed", "records-owed", "three fails written"),
  row("judge-2", "reclaim", "developed", "qa-owed", "repair landed"),
]);

test("three reclaims each taken after the issue moved on are counted for none", () => {
  assert.equal(reclaimsOf(ROUTE, "developed"), 0, "every pickup followed a status or a landing state that moved");
  assert.equal(movedOf(ROUTE, "developed"), 3, "and each is counted apart, for the line that says so");
  assert.equal(tookMoved(ROUTE), true, "the claim just made is one of them");
  assert.equal(overWhom(ROUTE, "developed"), null, "with nothing counted, no run is named");
});

test("three reclaims over runs that left the status and landing state as they found them still count", () => {
  const standing = held([
    row("one", "claim", "developed", "qa-owed"),
    row("two", "reclaim", "developed", "qa-owed", "judging"),
    row("three", "reclaim", "developed", "qa-owed", "judging"),
    row("four", "reclaim", "developed", "qa-owed", "judging"),
  ]);
  assert.equal(reclaimsOf(standing, "developed"), 3);
  assert.equal(movedOf(standing, "developed"), 0);
  assert.equal(tookMoved(standing), false);
  const bare = held([row("a", "reclaim", "open"), row("b", "reclaim", "open"), row("c", "reclaim", "open")]);
  assert.equal(reclaimsOf(bare, "open"), 3, "a reclaim with no row before it in the window is counted as before");
});

test("the history line marks a reclaim left out for a move, beside the readings it already marks", () => {
  const mixed = held([
    row("one", "claim", "in_progress"),
    row("two", "reclaim", "developed", null, "landed"),
    row("three", "reclaim", "developed", null, NOTHING_WORKED),
    row("four", "reclaim", "developed", null, "judging"),
  ]);
  assert.equal(reclaimsOf(mixed, "developed"), 1);
  assert.equal(readingsOf(mixed, "developed"), 1);
  assert.equal(movedOf(mixed, "developed"), 1, "a reading is said once, as a reading, and never also as a move");
  const line = historyLine(mixed, "developed").split(" | ");
  assert.deepEqual(line.map((one) => one.endsWith(", after the issue moved on from where the run before took it, so not counted")),
    [true, false, false], line.join("\n"));
  assert.deepEqual(line.map((one) => one.includes(", over a lease")),
    [false, true, false], line.join("\n"));
});

test("the run named is the one the latest counted reclaim went over, never a newer pickup left out", () => {
  const lease = held([
    row("one", "claim", "developed"),
    row("two", "reclaim", "developed", null, "first step"),
    row("three", "reclaim", "developed", null, "second step"),
    { ...row("four", "reclaim", "developed", null, "third step"), from: "the-displaced" },
    row("five", "reclaim", "developed", "ready", "landed"),
  ]);
  assert.equal(reclaimsOf(lease, "developed"), 3);
  assert.deepEqual(overWhom(lease, "developed"), { holder: "the-displaced", next: "third step" },
    "the row's own `from` where it holds one, and that row's line");
  const noFrom = held(lease.history.slice(0, 3));
  assert.deepEqual(overWhom(noFrom, "developed"), { holder: "two", next: "second step" },
    "otherwise the holder of the row before it");
  assert.deepEqual(overWhom(held([row("a", "claim", "open"), row("b", "reclaim", "open")]), "open"),
    { holder: "a", next: null }, "a run that left no line is named with none");
});
