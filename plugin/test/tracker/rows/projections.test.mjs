/* What a projection keeps of each row it shapes, over a captured body: the envelope verdicts of
   plugin/test/tracker/routes.test.mjs say a page came through, and these say the row a caller
   reads is in it. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";

import { ROUTES } from "../../../src/tracker/routes.mjs";

const captures = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures", "rest");

const held = (name) => JSON.parse(readFileSync(join(captures, `${name}.json`), "utf8"));

/* The envelope verdict says the page came through; what the reverse read is for is the row,
   and a projection that dropped a citation field would leave the narrowing with nothing to resolve
   and every candidate kept. */
describe("the citing projection carries what a citation is resolved out of", () => {
  it("each row keeps the three fields a citation may sit in and the field the search matched", () => {
    const { issues } = ROUTES["forge_issues.citing"]
      .answers({ page: held("issues-citing").rest.answer }, {});
    assert.ok(issues.length > 1, "one row cannot show a projection that varies by row");
    for (const row of issues) {
      assert.match(row.issueId, /^ISS-\d+$/u);
      for (const field of ["description", "plan", "acceptanceCriteria"]) {
        assert.ok(Object.hasOwn(row, field), `${row.issueId} lost ${field}, which is where a citation sits`);
      }
      assert.ok(Array.isArray(row.matchedFields), `${row.issueId} carries no matchedFields`);
      assert.ok(Object.hasOwn(row, "status") && Object.hasOwn(row, "mergedAt"),
        `${row.issueId} carries neither the status nor the merged mark a verdict is judged against`);
    }
    assert.ok(issues.some((row) => (row.matchedFields ?? []).includes("plan")),
      "no row matched on the plan, so this capture cannot show the field the browse route never had");
  });
});

describe("an activity event carries the transition and none of the field an update wrote", () => {
  for (const [name, key] of [["issues-activity", "forge_issues.activity"], ["issues-issue-activity", "forge_issues.issue_activity"]]) {
    it(`${name}: a status change keeps where it went from and to, and the cursor is the answer's own`, () => {
      const answer = held(name).rest.answer;
      const { events, nextBefore } = ROUTES[key].answers({ page: answer }, {});
      const moved = events.find((one) => one.action === "issue.statusChanged");
      assert.deepEqual(events.map((one) => one.id), answer.items.map((one) => one.id), "a walk keeps events apart by their id");
      assert.deepEqual(moved, { id: "1656299e-e844-4395-a7da-fed677691cea", issueId: "40744dde-f44c-4c7e-a707-3757a1a3c857", action: "issue.statusChanged",
        from: "awaiting_release", to: "closed", reopenCount: 0, at: "2026-09-26T14:59:24.141Z" });
      assert.equal(nextBefore, answer.nextBefore);
      assert.ok(events.every((one) => !Object.hasOwn(one, "payload")), "an update's body travels nowhere");
    });
  }
});
