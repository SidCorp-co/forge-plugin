/* A reclaim over a lease whose holder wrote a payload record under it is progress the status and
   landing state need not show — a judging run's verdicts hand the issue back exactly where it took
   it — so the count leaves it out; a lease nothing was written under is still counted, and the mark
   is the lease's own, set by a payload write and never by a claim or carried to a new holder
   (ISS-2531). */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { projectRoom, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { OWN, trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("wrote-reclaim").path;
/* Away from this checkout, whose git directory names the run this suite is written under. */
const AWAY = projectRoom(tempRoom("wrote-reclaim-away-"), process.env.XDG_CONFIG_HOME, OWN);
process.chdir(AWAY);

const { claimed, leaseOf } = await import("../../../src/flow/lease.mjs");
const { RECLAIMS_BEFORE_PARK, historyLine, leftOutOf, reclaimsOf, tookWhy } =
  await import("../../../src/flow/lease/crash-park.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const AT = "2026-09-02T12:00:00.000Z";
const WROTE = "over a lease whose holder wrote a record under it";
const held = (history, extra = {}) =>
  ({ holder: "now", agent: "a", pid: "1", renewedAt: AT, minutes: 30, next: null, history, ...extra });
const row = (holder, how, extra = {}) =>
  ({ holder, at: AT, how, status: "developed", next: "judging", landing: "qa-owed", ...extra });

/* Three judging runs at one status and one landing state, each having written verdicts before it lapsed. */
const JUDGED = held([
  row("judge-1", "claim"),
  row("judge-2", "reclaim", { wrote: true }),
  row("judge-3", "reclaim", { wrote: true }),
  row("judge-4", "reclaim", { wrote: true }),
]);
const STANDING = held([row("one", "claim"), row("two", "reclaim"), row("three", "reclaim"), row("four", "reclaim")]);

test("three reclaims over leases that wrote a record are counted for none", () => {
  assert.equal(reclaimsOf(JUDGED, "developed"), 0, "the status and landing state stood still, and every lease went over had written");
  assert.deepEqual(leftOutOf(JUDGED, "developed"), [{ why: WROTE, verb: "went", count: 3 }],
    "each is counted apart under the one reason, for the line that says so");
  assert.deepEqual(tookWhy(JUDGED), { why: WROTE, verb: "went" }, "the claim just made is one of them");
  assert.ok(reclaimsOf(JUDGED, "developed") <= RECLAIMS_BEFORE_PARK, "so no park is named");
});

test("three reclaims over leases that wrote nothing, at one status and landing state, still count", () => {
  assert.equal(reclaimsOf(STANDING, "developed"), 3);
  assert.deepEqual(leftOutOf(STANDING, "developed"), []);
  assert.equal(tookWhy(STANDING), null);
  assert.ok(reclaimsOf(STANDING, "developed") > RECLAIMS_BEFORE_PARK, "which is past the threshold the park is named at");
});

test("the history line marks a reclaim over a lease that wrote as not counted, and says why", () => {
  const line = historyLine(held([row("one", "claim"), row("two", "reclaim", { wrote: true }), row("three", "reclaim")]), "developed")
    .split(" | ");
  assert.deepEqual(line.map((one) => one.endsWith(`, ${WROTE}, so not counted`)), [false, true, false], line.join("\n"));
});

test("a claim that only renews its own lease leaves it unmarked, and a payload write's mark survives it", () => {
  /* No landing state on any row, as `claimed` writes none here, so no reclaim below reads as a move. */
  const unmarked = { lease: held([row("now", "claim", { landing: undefined })]) };
  const renewed = leaseOf(claimed(unmarked, { holder: "now", at: AT, minutes: 30 }));
  assert.equal(claimed(unmarked, { holder: "now", at: AT, minutes: 30 }).lease.wrote, undefined, "a bare renewal marks nothing");
  const over = leaseOf(claimed({ lease: renewed }, { holder: "next", at: AT, minutes: 30, how: "reclaim", status: "developed" }));
  assert.equal(over.history.at(-1).wrote, undefined, "so a reclaim over it carries no mark");
  assert.equal(reclaimsOf(over, "developed"), 1, "and is counted");
  const written = { lease: { ...unmarked.lease, wrote: true } };
  assert.equal(claimed(written, { holder: "now", at: AT, minutes: 30 }).lease.wrote, true, "the holder's own renewal keeps a mark a payload left");
});

test("a new holder's lease does not carry the mark of the lease it went over", () => {
  const written = { lease: held([row("first", "claim", { landing: undefined })], { holder: "first", wrote: true }) };
  for (const how of ["reclaim", "handed", "take", "claim"]) {
    const took = claimed(written, { holder: "second", at: AT, minutes: 30, how, status: "developed" }).lease;
    assert.equal(took.wrote, undefined, `a ${how} starts the new holder's lease unmarked`);
    assert.equal(took.history.at(-1).wrote, true, "while its row keeps the mark of the lease it went over");
  }
  const second = claimed(written, { holder: "second", at: AT, minutes: 30, how: "reclaim", status: "developed" });
  const third = claimed(second, { holder: "third", at: AT, minutes: 30, how: "reclaim", status: "developed" }).lease;
  assert.equal(third.history.at(-1).wrote, undefined, "a reclaim over the holder that wrote nothing has no mark");
  assert.equal(reclaimsOf(third, "developed"), 1, "and is counted, though the holder before it wrote");
});

/* Through the CLI: a payload write marks the lease, a claim and a comment do not, and a claim over three
   writing leases names no park. */
const OURS = "iss-2531-the-judge";
const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();
const ISSUE = {
  documentId: "wrote-reclaim-uuid",
  issueId: "ISS-77",
  status: "developed",
  title: "a judged issue handed back at developed",
  description: "no mark here",
  complexity: "s",
};
const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: true } },
  issues: [ISSUE],
  comments: { [ISSUE.documentId]: [] },
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
      if (args.action === "update" && state.refuseNotes && args.data?.releaseNotes !== undefined) {
        return { refused: "the tracker refused the note" };
      }
      if (args.action === "update") Object.assign(ISSUE, args.data);
      if (args.action === "transition") ISSUE.status = args.data.status;
      return ISSUE;
    },
    forge_comments: (args) => {
      if (args.action !== "list") return { documentId: "a-comment" };
      return { comments: state.comments[ISSUE.documentId] ?? [], returned: 0, hasMore: false };
    },
  },
};
const { tracker, env: ENV } = await trackerFor(state, [AWAY]);
test.after(() => tracker.close());
const ran = (argv) => ranAsync(FORGE, argv, { ...ENV, FORGE_SESSION_ID: OURS });
const ours = (extra = {}) => {
  ISSUE.sessionContext = { lease: { holder: OURS, agent: "a", pid: "1", renewedAt: ago(1), minutes: 60, next: null,
    history: [{ holder: OURS, at: ago(1), how: "claim", status: "developed", next: null }], ...extra } };
};

test("a payload write under the holder's own lease marks it, and a claim or a comment does not", async () => {
  ours();
  const renewed = await ran(["claim", "ISS-77"]);
  assert.equal(renewed.status, 0, `${renewed.stdout}${renewed.stderr}`);
  assert.equal(ISSUE.sessionContext.lease.wrote, undefined, "a claim renewing its own lease marks nothing");
  const body = join(tempRoom("wrote-reclaim-body-"), "finding.md");
  writeFileSync(body, "A finding for whoever comes next.\n");
  const commented = await ran(["comment", "ISS-77", body]);
  assert.equal(commented.status, 0, `${commented.stdout}${commented.stderr}`);
  assert.equal(ISSUE.sessionContext.lease.wrote, undefined, "nor does a comment, which renews as a finder");
  const noted = await ran(["record", "note", "ISS-77", "--section", "Fixed", "--user", "The swipe gesture is gone."]);
  assert.equal(noted.status, 0, `${noted.stdout}${noted.stderr}`);
  assert.equal(ISSUE.sessionContext.lease.holder, OURS);
  assert.equal(ISSUE.sessionContext.lease.wrote, true, "a payload record does");
});

test("a payload write the tracker refuses leaves the lease unmarked, so a reclaim over it counts", async () => {
  ours();
  state.refuseNotes = true;
  try {
    const refused = await ran(["record", "note", "ISS-77", "--section", "Fixed", "--user", "The swipe gesture is gone."]);
    assert.notEqual(refused.status, 0, `the note should have been refused:\n${refused.stdout}${refused.stderr}`);
  } finally {
    state.refuseNotes = false;
  }
  assert.equal(ISSUE.sessionContext.lease.holder, OURS, "the renewal before it landed");
  assert.equal(ISSUE.sessionContext.lease.wrote, undefined, "and marked nothing, the record never having landed");
});

test("a claim over the third lease that wrote a record names no park, and says why", async () => {
  const reclaim = (holder, minutes) => ({ holder, at: ago(minutes), how: "reclaim", status: "developed", next: "judging", wrote: true });
  ISSUE.status = "developed";
  ISSUE.sessionContext = { lease: { holder: "judge-3", agent: "a", pid: "1", renewedAt: ago(90), minutes: 30, next: "judging",
    wrote: true, history: [reclaim("judge-2", 300), reclaim("judge-3", 200)] } };
  const run = await ran(["claim", "ISS-77"]);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, new RegExp(`This reclaim of developed went ${WROTE}, so it counts for none: 0 counted at developed\\. 3 reclaim\\(s\\) of developed went ${WROTE}, and are not counted\\.`, "u"));
  assert.doesNotMatch(run.stdout, /forge record park|Reclaim \d/u, "three runs that each wrote are not three deaths");
  assert.equal(ISSUE.sessionContext.lease.wrote, undefined, "and this run's own lease starts unmarked");
});
