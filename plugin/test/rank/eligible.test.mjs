/* One case per filter, and each reads back the sentence the filter left: a row dropped in silence
   is a backlog that shrank for no stated reason. */
import assert from "node:assert/strict";
import test from "node:test";

import { eligibilityOf, heldPaths, meets, pathsNamed } from "../../src/rank/eligible.mjs";

const row = (held = {}) => ({ issueId: "ISS-1", status: "open", ...held });

const leaseFor = (holder, minutes = 30, at = new Date().toISOString()) =>
  ({ lease: { holder, agent: "an agent", pid: "1", renewedAt: at, minutes, history: [] } });

test("a status no run takes is dropped, and the sentence names the status", () => {
  for (const status of ["in_progress", "developed", "released", "closed", "dropped", "waiting"]) {
    const held = eligibilityOf(row({ status }));
    assert.equal(held.eligible, false, status);
    assert.match(held.reason, new RegExp(`status ${status}`, "u"));
  }
  for (const status of ["open", "confirmed", "clarified", "approved", "reopen"]) {
    assert.equal(eligibilityOf(row({ status })).eligible, true, status);
  }
});

test("a live lease drops the issue and the sentence names the session and its expiry", () => {
  const held = eligibilityOf(row(), { lease: leaseFor("another-session") });
  assert.equal(held.eligible, false);
  assert.match(held.reason, /lease held by session another-session/u);
  assert.match(held.reason, /expiring \d{4}-\d{2}-\d{2}/u);
});

/* An expired lease is another run's to take, so it is no reason to leave the issue out. */
test("a lease past its minutes is not a filter", () => {
  const stale = leaseFor("a-dead-run", 30, "2020-01-01T00:00:00.000Z");
  assert.equal(eligibilityOf(row(), { lease: stale }).eligible, true);
});

test("a blocker outside a terminal status drops the issue, and the sentence names it", () => {
  const held = eligibilityOf(row(), { blockers: [{ issueId: "ISS-9", status: "open" }] });
  assert.equal(held.eligible, false);
  assert.equal(held.reason, "blocked by ISS-9 (open)");
  for (const status of ["closed", "dropped"]) {
    assert.equal(eligibilityOf(row(), { blockers: [{ issueId: "ISS-9", status }] }).eligible, true, status);
  }
  assert.equal(eligibilityOf(row(), { blockers: [{ issueId: "ISS-9", status: "released" }] }).eligible, false,
    "released is on the way to closed and releases nothing yet");
});

test("a file another run's plan names is a soft exclusion, and the line says which file and whose", () => {
  const held = heldPaths([{ issueId: "ISS-9", plan: "It edits `plugin/src/flow/record.mjs` and nothing else." }]);
  const verdict = eligibilityOf(row(), { body: "This one rewrites `plugin/src/flow/`.", held });
  assert.equal(verdict.eligible, false);
  assert.equal(verdict.soft, true, "soft: it is a collision, not a rule");
  assert.equal(verdict.reason, "holds plugin/src/flow/record.mjs with ISS-9",
    "the holder's own path, which is the narrower of the two and the one a reader acts on");
  assert.equal(eligibilityOf(row(), { body: "This one rewrites `plugin/src/codex/`.", held }).eligible, true);
});

/* The window is what reads a body; a candidate outside it has none, and a filter with nothing to
   read has to say nothing rather than pass the issue as clean. */
test("a body the window never read leaves the file filter with nothing to say", () => {
  const held = heldPaths([{ issueId: "ISS-9", plan: "`plugin/src/flow/record.mjs`" }]);
  assert.equal(eligibilityOf(row(), { body: null, held }).eligible, true);
});

test("a path is read out of a code span and matched by tree", () => {
  assert.deepEqual(pathsNamed("both `plugin/src/rank/next.mjs` and `docs/cli/next.md` change"),
    ["plugin/src/rank/next.mjs", "docs/cli/next.md"]);
  assert.deepEqual(pathsNamed("`forge next` names no path, nor does `rank`"), []);
  assert.ok(meets("plugin/src/flow/record.mjs", "plugin/src/flow/"));
  assert.ok(meets("plugin/src/flow", "plugin/src/flow/record.mjs"));
  assert.equal(meets("plugin/src/flowers", "plugin/src/flow"), false, "a prefix is not a tree");
});
