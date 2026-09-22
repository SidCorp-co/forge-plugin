/* The act that ends an owing is the act that reports what was owed to it. `transitionTo` calls this
   with the status the tracker answered and the issue's own key, so what is proven here is the
   reading it does off the checkout: which criteria cited that key, and that a tree it was handed
   none of is told nothing. */
import assert from "node:assert/strict";
import test from "node:test";

import { escapesOrphaned } from "../../src/checks/docs/owing-escapes.mjs";
import { NO_LONGER_OWES } from "../../src/flow/earned/park-status.mjs";
import { owedTo } from "../../src/spec/claims/proof.mjs";

const clause = (id, proof) =>
  `- **${id}** · Rev: 1 · Proof: ${proof}\n  WHEN a case is named THEN the checker SHALL read it.\n`;

const HELD = {
  documents: [
    { file: "docs/requirements/srs/fr-05-z.md",
      text: `## UC-05-1 — A use case\n\nRev: 1\n\n${clause("AC-05-1-1", "none yet — ISS-7")}`
        + `${clause("AC-05-1-2", "none yet — ISS-9")}${clause("AC-05-1-3", "none yet — ISS-7")}` },
  ],
};

test("a move to closed names every criterion whose escape cites the key, with its file and line", () => {
  const said = escapesOrphaned("closed", "ISS-7", HELD);
  assert.equal(said[0], "", "a blank line, so the report is not run onto the move's own line");
  assert.equal(said[1], "2 criteria under docs/requirements/ stand unproved and owed to ISS-7, "
    + "which owes nothing now:");
  assert.deepEqual(said.slice(2, 4), [
    "  docs/requirements/srs/fr-05-z.md:5 AC-05-1-1",
    "  docs/requirements/srs/fr-05-z.md:9 AC-05-1-3",
  ], "each criterion carries the line it is written on, not the line its document opens at");
  assert.ok(said[4].startsWith("Point each at the case that proves its clause"), said[4]);
  assert.equal(said.length, 5);
});

test("only the statuses that owe nothing say anything, and a key nothing cited says nothing", () => {
  assert.deepEqual(NO_LONGER_OWES, ["closed", "dropped"]);
  for (const status of NO_LONGER_OWES) {
    assert.ok(escapesOrphaned(status, "ISS-7", HELD).length, `${status} reports what it orphaned`);
  }
  for (const status of ["open", "confirmed", "approved", "in_progress", "developed", "testing",
    "awaiting_release", "needs_info", "waiting", "on_hold"]) {
    assert.deepEqual(escapesOrphaned(status, "ISS-7", HELD), [],
      `${status} still owes, so nothing was orphaned`);
  }
  assert.deepEqual(escapesOrphaned("closed", "ISS-4444", HELD), [],
    "and a key no criterion cited leaves the move's output as it was");
  /* One spelling and not two: the shape checker already refuses a lower-cased escape as naming no
     issue, so reading one here would report against a line the gate is red about anyway. */
  assert.equal(owedTo("none yet — iss-7"), null);
  assert.equal(owedTo("none yet — ISS-7"), "ISS-7");
});

test("a project that keeps no requirements tree is told nothing at all", () => {
  assert.deepEqual(escapesOrphaned("closed", "ISS-7", null), []);
  assert.deepEqual(escapesOrphaned("dropped", "ISS-7", { documents: [] }), []);
  /* Synchronous, which is the whole of the claim that it spends no call: there is no point in it at
     which a request could have been awaited. */
  assert.ok(Array.isArray(escapesOrphaned("closed", "ISS-7", HELD)));
});
