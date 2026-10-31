/* A merge core's own route stamped writes no note of ours, so the thread's mark is an earlier
   landing's: the rungs read the commit, and the head it landed, off core's issue record (adminhub-api
   ISS-78). Red on the thread-only read, which refused a review of the head the route merged. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("route-mark").path;
const { render } = await import("../../../../src/flow/record/page.mjs");
const { CHECKS, viewFrom } = await import("../../../../src/flow/earned.mjs");
const { judgedHead, markReadLines, markedCommit, reviewedHead } = await import("../../../../src/flow/record/judged/mark-read.mjs");

const OLD_AT = "e59c1d2a7b3f4e5d6c7b8a9f0e1d2c3b4a5f6e7d";
const OLD_HEAD = "d67b74c1a2b3c4d5e6f708192a3b4c5d6e7f8091";
const ROUTE_AT = "2fd8ce0e9a1b2c3d4e5f60718293a4b5c6d7e8f9";
const ROUTE_HEAD = "eb9b362d7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c";

let clock = 0;
const at = () => `2026-10-31T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body) => ({ createdAt: at(), authorId: "agent", body });
const oldMark = comment(`mark_merged target=base — merged to master at ${OLD_AT.slice(0, 9)}; reviewed head ${OLD_HEAD.slice(0, 7)}`);
const review = (commit) => comment(render("review", { reviewer: "codex", commit, outcome: "approved", finding: ["F1 accepted"] }));

/* What core's issue read carries after the route stamped the newer merge. */
const routed = (treeIdentical = true) => ({
  mergedAt: "2026-10-31T09:00:00.000Z",
  mergedCommitSha: ROUTE_AT,
  markedCommit: { sha: ROUTE_AT, provenance: "observed" },
  mergedHead: { sha: ROUTE_HEAD, treeIdentical, why: null, readAt: "2026-10-31T09:00:00.000Z" },
});
const owed = (issue, comments) => CHECKS["in_progress:test"](viewFrom("the-uuid", issue, comments), "ISS-78").map((one) => one.what);

test("a review of the head the route merged is the review of the landing, whatever the thread's older mark says", () => {
  assert.deepEqual(owed(routed(), [oldMark, review(ROUTE_HEAD.slice(0, 9))]), []);
});

test("and a review of the older landing's head is owed again, naming core's commit and head", () => {
  assert.deepEqual(owed(routed(), [oldMark, review(OLD_HEAD.slice(0, 7))]),
    [`the review judged ${OLD_HEAD.slice(0, 7)}, and the mark names ${ROUTE_AT} from head ${ROUTE_HEAD}`]);
});

test("the head core read as the landing's tree is the judged head; one whose tree differs is none", () => {
  const held = { issue: routed(), comments: [oldMark] };
  assert.equal(markedCommit(held), ROUTE_AT);
  assert.equal(reviewedHead(held), ROUTE_HEAD);
  assert.equal(judgedHead(held), ROUTE_HEAD);
  assert.equal(judgedHead({ issue: routed(false), comments: [oldMark] }), null);
  assert.deepEqual(markReadLines(held), [], "core answered, so nothing is said about the thread");
});

test("a thread mark naming core's own commit keeps its clauses", () => {
  const same = comment(`mark_merged target=base — merged to master at ${ROUTE_AT}; reviewed head ${OLD_HEAD}; judged head ${OLD_HEAD}; landing moved nothing`);
  const held = { issue: routed(), comments: [oldMark, same] };
  assert.equal(reviewedHead(held), OLD_HEAD, "the note's own head, which the marker wrote of this landing");
  assert.equal(judgedHead(held), OLD_HEAD);
});

test("an unmarked issue's old thread note is no mark", () => {
  assert.equal(markedCommit({ issue: { mergedAt: null, markedCommit: null, mergedCommitSha: null }, comments: [oldMark] }), null);
});

test("where core's record carries no mark field, the thread answers and the owed list says so", () => {
  const held = { issue: { mergedAt: "2026-10-31T09:00:00.000Z" }, comments: [oldMark] };
  assert.equal(markedCommit(held), OLD_AT.slice(0, 9));
  assert.match(markReadLines(held)[0], /read off the thread's note \(e59c1d2a7\), since core's issue record carries no markedCommit/u);
  const unclaimed = { issue: { mergedAt: "2026-10-31T09:00:00.000Z", markedCommit: null, mergedCommitSha: null }, comments: [oldMark] };
  assert.match(markReadLines(unclaimed)[0], /since core's mark names no commit/u);
});
