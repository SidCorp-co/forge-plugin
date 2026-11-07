/* A tracker that holds no work step (forge-beta answers a whole issue with no workState column) never
   reads a bare in_progress past the plan, while a dev row and a list row keep the build (FB-71). */
import assert from "node:assert/strict";
import test from "node:test";

import { attributedOf, issueOf } from "../../../src/tracker/answers/projections.mjs";

test("a whole issue read with no workState column reads in_progress at the plan", () => {
  const read = issueOf({ issue: { id: "u", status: "in_progress" } });
  assert.equal(read.status, "in_progress:plan");
  assert.equal(read.trackerStatus, "in_progress", "core's own status rides beside it");
});

test("a whole issue read whose workState names no step keeps the build", () => {
  assert.equal(issueOf({ issue: { id: "u", status: "in_progress", workState: { step: null } } }).status, "in_progress:build");
  assert.equal(issueOf({ issue: { id: "u", status: "in_progress", workState: { step: "test" } } }).status, "in_progress:test");
});

test("a list row with no workState column keeps the build, the column being one a list may leave out", () => {
  assert.equal(attributedOf({ id: "u", status: "in_progress" }).status, "in_progress:build");
});
