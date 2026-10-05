/* ISS-3181's landing spent a 457s gate and then stopped at `records-owed`, because the review named
   acc16683 and the head handed over was acfebdaf. The capture now refuses before it writes the
   checkpoint wherever the latest review is not an approved one of the head it names. */
import assert from "node:assert/strict";
import test from "node:test";

import { BUILDER, CHANGED, checkpoint, field, git, ran, state } from "./fixture.mjs";

const { render } = await import("../../../src/flow/record/page.mjs");
const { viewFrom } = await import("../../../src/flow/earned.mjs");
const { reviewReadyRefusal } = await import("../../../src/flow/landing/review-ready.mjs");

const HEAD = git(CHANGED, "rev-parse", "HEAD").stdout.trim();
const OTHER = "acc16683acc16683acc16683acc16683acc16683";
const said = (run) => `${run.stdout}${run.stderr}`;

const reviewing = (fields) => {
  field(null, null);
  state.issues[0] = { ...state.issues[0], status: "in_progress" };
  if (fields) {
    state.comments["landing-uuid"] = [{ documentId: "c-1", createdAt: "2026-09-07T11:00:00.000Z", authorId: "agent",
      body: render("review", { reviewer: "codex", finding: [], ...fields }) }];
  }
};
const capture = () => ran(["claim", "ISS-673", "--pushed", "--ready"], BUILDER, CHANGED, undefined, { reviewed: false });

const refusedFor = async (why) => {
  const run = await capture();
  assert.equal(run.status, 1, said(run));
  assert.equal(checkpoint(), null, "no checkpoint was written");
  assert.match(run.stderr, new RegExp(`claim --ready captures ${HEAD.slice(0, 7)}, and ${why}`, "u"), run.stderr);
  assert.ok(run.stderr.includes(`forge record review ISS-673 --reviewer codex --commit ${HEAD.slice(0, 7)} `
    + '--outcome approved --finding "F1 accepted"\n  forge claim ISS-673 --pushed --ready'),
  `the record that clears it, then the same capture again:\n${run.stderr}`);
  return run;
};

test("a ready capture with no review on the record is refused before the checkpoint", async () => {
  reviewing(null);
  await refusedFor("ISS-673 carries no review");
});

test("a ready capture whose review judged another head is refused, naming both", async () => {
  reviewing({ commit: OTHER, outcome: "approved" });
  await refusedFor(`the latest review on ISS-673 judged acc1668, not ${HEAD.slice(0, 7)}`);
});

test("a ready capture whose review of that head asked for changes is refused", async () => {
  reviewing({ commit: HEAD, outcome: "changes-requested" });
  await refusedFor(`the latest review on ISS-673 judged ${HEAD.slice(0, 7)} and says changes-requested`);
});

test("a ready capture with an approved review of the head it captures writes the checkpoint", async () => {
  reviewing({ commit: HEAD, outcome: "approved" });
  const run = await capture();
  assert.equal(run.status, 0, said(run));
  assert.equal(checkpoint().state, "ready");
  assert.equal(checkpoint().head, HEAD);
});

/* A consult that cannot run is no route: the refusal names where the reviewer is configured instead. */
test("the route names the consult where a reviewer is configured, and forge doctor where none is", () => {
  const view = viewFrom("landing-uuid", { issueId: "ISS-673", status: "in_progress" }, []);
  const configured = reviewReadyRefusal("ISS-673", HEAD, view, { unconfigured: false });
  assert.match(configured, /\n {2}echo "<what this change does>" \| forge codex consult --diff --only blocker,major\n/u, configured);
  const bare = reviewReadyRefusal("ISS-673", HEAD, view, { unconfigured: true });
  assert.match(bare, /\n {2}forge doctor {3}# no reviewer is configured on this machine/u, bare);
  assert.doesNotMatch(bare, /forge codex consult/u, "and no consult it cannot take");
  assert.equal(reviewReadyRefusal("ISS-673", HEAD, { ...view, issue: { landingShape: "outside_git" } }), null,
    "an issue landing outside git hands over no head to compare");
});
