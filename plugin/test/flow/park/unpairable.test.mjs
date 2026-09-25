/* A park the park reader drops is one nothing pairs with the move it made, and the only way back it
   leaves is a status write no entry check reads. The landing's conflict park was one: it passed the
   conflicting paths as evidence through `parkAs`, which skips `parkChecked` (ISS-2449). So the shared
   composition holds every writer to the reader's rule, before either write. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("park-unpairable").path;
const { parkAs } = await import("../../../src/flow/advance.mjs");
const { parkPayload } = await import("../../../src/flow/park/compose.mjs");
const { Refused } = await import("../../../src/refusal.mjs");

const PATH = "plugin/src/stats/corpus/generations.mjs";
const HEAD = "9e24c2af0000000000000000000000000000abcd";
const issue = { documentId: "parked-uuid", issueId: "ISS-2435", status: "in_progress", title: "the change the landing stopped" };
const state = { calls: [], issues: [issue], comments: {} };
const { tracker, env } = await trackerFor(state);
Object.assign(process.env, env);
test.after(() => tracker.close());

const view = () => ({ documentId: issue.documentId, issue: { ...issue }, comments: [], names: [] });

test("a park citing a repository path is refused before the move and before the record, whoever calls it", async () => {
  await assert.rejects(parkAs(view(), "ISS-2435", "blocked", "the branch does not merge", [PATH]), (error) => {
    assert.ok(error instanceof Refused, String(error));
    assert.ok(error.message.includes(`\`${PATH}\``), `names the value the reader drops:\n${error.message}`);
    assert.match(error.message, /an attachment on the issue, a URL or a commit/u, `and what evidence has to be:\n${error.message}`);
    return true;
  });
  assert.deepEqual(state.calls, [], "nothing reached the tracker");
  assert.equal(issue.status, "in_progress", "the status did not move");
});

test("a park citing commits composes the record the reader keeps", () => {
  const { body } = parkPayload(view(), "ISS-2435", "blocked", "the branch does not merge", [HEAD]);
  assert.ok(body.includes(HEAD), body);
});
