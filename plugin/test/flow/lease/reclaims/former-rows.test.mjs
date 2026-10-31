/* A lease's claim history written before 3.36.647 names a bare `in_progress` where the build stood and
   the CLI's own rung names elsewhere; a row written after names the place. The count reads both as the
   same place, so the upgrade itself is no move and does not reset the count a park is named from. */
import assert from "node:assert/strict";
import test from "node:test";

import { standsInNoTree, tempHome } from "../../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("former-rows").path;
standsInNoTree("former-rows");

const { historyLine, reclaimsOf, tookWhy } = await import("../../../../src/flow/lease/reclaims/crash-park.mjs");

const AT = "2026-10-30T12:00:00.000Z";
const held = (history) => ({ holder: "now", agent: "a", pid: "1", renewedAt: AT, minutes: 30, next: null, history });
const row = (holder, how, status) => ({ holder, at: AT, how, status, next: "building" });

test("a bare in_progress row before the upgrade and an in_progress:build row after it are one place to the count", () => {
  const lease = held([
    row("one", "claim", "in_progress"),
    row("two", "reclaim", "in_progress"),
    row("three", "reclaim", "in_progress:build"),
  ]);
  assert.equal(reclaimsOf(lease, "in_progress:build"), 2, "both reclaims count: the row the newest is measured against stood at the build");
  assert.equal(tookWhy(lease), null, "the reclaim just made is not left out as a move");
  assert.equal(historyLine(lease, "in_progress:build").split(" | ").length, 3, "the history line at the build names all three rows");
});

test("a former rung name reads as the place that took it over", () => {
  const lease = held([row("one", "claim", "developed"), row("two", "reclaim", "in_progress:test")]);
  assert.equal(reclaimsOf(lease, "in_progress:test"), 1);
  assert.equal(reclaimsOf(lease, "in_progress:build"), 0, "and not as any other place");
});
