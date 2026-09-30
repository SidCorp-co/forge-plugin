/* An issue the tracker says lands outside git has no commit for any record to name, so every rung above
   `in_progress` reads the landing its mark names instead (ISS-2402). One file for the three rungs, the
   commands their shortfalls print, and the readers beside them that ask the same question. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("earned-landing").path;
const { render } = await import("../../../../src/flow/record/page.mjs");
const { CHECKS, viewFrom } = await import("../../../../src/flow/earned.mjs");
const { clauseStatus } = await import("../../../../src/trace/status.mjs");
const { judgeProblems } = await import("../../../../src/flow/qa/verdicts.mjs");

let clock = 0;
const at = () => `2026-09-30T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body, extra = {}) => ({ createdAt: at(), authorId: "agent", authorDeviceId: "d", body, ...extra });
const recorded = (kind, fields) => comment(render(kind, fields));

const PLACE = "https://mowmentbrand.com/products/{classic-baseball-button-jersey,pro-match-soccer-jersey}";
const ELSEWHERE = "https://mowmentbrand.com/products/elite-basketball-jersey";
const CRITERIA = "1. FR-05~1: The first outcome.\n2. The second outcome.";
const ISSUE = {
  landingShape: "outside_git",
  mergedAt: "2026-09-30T09:00:00.000Z",
  mergedLanding: PLACE,
  acceptanceCriteria: CRITERIA,
  attachments: [{ name: "live.txt" }],
  releaseNotes: { section: "Fixed", userFacing: "The jerseys are on the storefront." },
};
const MARK = comment(`mark_merged target=base — landed outside git, at the place this mark's landing names\n`
  + `this mark names where the work landed outside git: \`merged_landing\` holds ${PLACE}.`);

const view = (issue, comments = []) => viewFrom("the-uuid", issue, [MARK, ...comments]);
const owed = (status, one) => CHECKS[status](one, "ISS-38");
const said = (status, one) => owed(status, one).map((item) => item.what);
const asks = (status, one) => owed(status, one).map((item) => item.command).join("\n");

const review = (fields) => recorded("review", { reviewer: "codex", outcome: "approved", finding: ["F1 accepted"], ...fields });
const verdict = (number, fields) => recorded("verdict", {
  criterion: `${number} — outcome ${number}`, verdict: "pass", evidence: ["live.txt"], ...fields,
});
const verification = (fields) => recorded("verification", { where: "mowmentbrand.com", evidence: ["live.txt"], ...fields });

test("developed is earned by the landed mark and an approving review of the landing it names", () => {
  assert.deepEqual(said("developed", view(ISSUE, [review({ landing: PLACE })])), []);
});

test("testing is earned by a passing verdict on every criterion that names the mark's landing", () => {
  assert.deepEqual(said("testing", view(ISSUE, [verdict(1, { landing: PLACE }), verdict(2, { landing: PLACE })])), []);
});

test("awaiting_release is earned by a verification of the mark's landing beside the note", () => {
  const judged = [verdict(1, { landing: PLACE }), verdict(2, { landing: PLACE })];
  assert.deepEqual(said("awaiting_release", view(ISSUE, [...judged, verification({ landing: PLACE })])), []);
});

test("a record naming another place, or a commit, is a shortfall at the rung that reads it", () => {
  assert.deepEqual(said("developed", view(ISSUE, [review({ landing: ELSEWHERE })])),
    [`the review judged the landing ${ELSEWHERE}, and the merged mark says this change landed at ${PLACE}`]);
  assert.deepEqual(said("testing", view(ISSUE, [verdict(1, { landing: PLACE }), verdict(2, { commit: "c8c3550" })])),
    [`the verdict on criterion 2 judged the commit c8c3550, and the merged mark says this change landed at ${PLACE}`]);
  const judged = [verdict(1, { landing: PLACE }), verdict(2, { landing: PLACE })];
  assert.deepEqual(said("awaiting_release", view(ISSUE, [...judged, verification({ landing: ELSEWHERE })])),
    [`the verification read the landing ${ELSEWHERE}, and the merged mark says this change landed at ${PLACE}`]);
});

test("every command the rungs print for such an issue asks for the landing and never a commit", () => {
  const unmarked = { ...ISSUE, mergedAt: null, mergedLanding: null };
  const printed = [
    asks("developed", viewFrom("the-uuid", unmarked, [])),
    asks("developed", view(ISSUE)),
    asks("testing", view(ISSUE)),
    asks("testing", view(ISSUE, [verdict(1, { landing: PLACE, verdict: "fail", why: "absent" })])),
    asks("awaiting_release", view(ISSUE, [verdict(1, { landing: PLACE }), verdict(2, { landing: PLACE })])),
    asks("closed", view(ISSUE, [verdict(1, { landing: PLACE, verdict: "skipped", why: "no route" })])),
  ].join("\n");
  assert.match(printed, /forge record merged ISS-38 --landing '<where the change now is/u, "the mark this issue takes");
  assert.match(printed, /forge record review ISS-38 --reviewer codex --landing 'https:\/\/mowmentbrand\.com/u);
  assert.match(printed, /forge record verdict ISS-38 --landing 'https:\/\/mowmentbrand\.com/u);
  assert.match(printed, /forge record verification ISS-38 --where "<where it runs>" --landing 'https:/u);
  assert.doesNotMatch(printed, /--commit|--at /u, "and no command in them names a commit or a git clause");
});

test("a record holding both identities, or neither, is no whole payload and earns nothing", () => {
  const both = said("testing", view(ISSUE, [verdict(1, { landing: PLACE, commit: "c8c3550" }), verdict(2, { landing: PLACE })]));
  assert.equal(both.length, 1);
  assert.match(both[0], /^the verdict on criterion 1 lacks one of --commit and --landing, not both/u);
  const neither = said("developed", view(ISSUE, [review({})]));
  assert.equal(neither.length, 1);
  assert.match(neither[0], /the review on the record is not a whole payload: it lacks --commit, or --landing where the issue lands outside git/u);
  const badPlace = said("awaiting_release", view(ISSUE, [verdict(1, { landing: PLACE }), verdict(2, { landing: PLACE }),
    verification({ landing: "c8c3550" })]));
  assert.match(badPlace.join("\n"), /the verification on the record is not a whole payload: it lacks --landing `c8c3550`, which takes where the change now is/u);
});

test("an issue landing in git is still judged by its commit, whatever a record's landing says", () => {
  const git = { acceptanceCriteria: CRITERIA, mergedAt: "2026-09-30T09:00:00.000Z", landingShape: "git" };
  const note = comment("mark_merged target=base — merged to master at c8c3550; reviewed head c8c3550");
  const one = viewFrom("the-uuid", git, [note, review({ landing: PLACE })]);
  assert.match(said("developed", one).join("\n"), /the review judged https:\/\/mowmentbrand\.com.*, and the mark names c8c3550/u,
    "a landing is no commit, so the approving read did not judge what the mark says landed");
});

const SPEC_ROW = { documentId: "the-uuid", issueId: "ISS-38", status: "closed", mergedAt: ISSUE.mergedAt,
  mergedLanding: PLACE, landingShape: null, acceptanceCriteria: CRITERIA, cited: [] };
const NO_SCREEN = "## Declarations\n\n- screen change: no\n- look: no\n";

test("a passing verdict naming the mark's landing proves its clause, off the row a listing carries", () => {
  const rows = { rows: [SPEC_ROW], cut: null };
  const views = (landing) => new Map([["the-uuid", viewFrom("the-uuid", { ...SPEC_ROW, plan: NO_SCREEN },
    [MARK, verdict(1, { landing })])]]);
  assert.deepEqual(clauseStatus("FR-05", rows, views(PLACE)).provers, ["ISS-38"],
    "a listed row omits the shape and keeps the landing, which only an outside-git mark carries");
  assert.deepEqual(clauseStatus("FR-05", rows, views(ELSEWHERE)).provers, [], "and another place proves nothing");
});

const INDEPENDENT = { qa: "independent" };
const holding = (holders) => ({
  ...viewFrom("the-uuid", ISSUE, [MARK, verdict(1, { landing: PLACE, judge: "judge-run" }), verdict(2, { landing: PLACE, judge: "judge-run" })],
    null, INDEPENDENT),
  holders,
});

test("under an independent judgement the builders are the runs the claim history names", () => {
  assert.deepEqual(judgeProblems(holding(["builder-run"])), [], "a judge apart from that run earns the rung");
  assert.deepEqual(said("testing", holding(["builder-run"])), [], "with no landing checkpoint on the issue");
  assert.deepEqual(said("testing", holding(["first-builder", "successor-builder"])), [],
    "and a build a second run finished is judged apart from both");
  assert.match(said("testing", holding([])).join("\n"), /names no run that held the issue while it was being built/u,
    "while a history naming nobody shows the judge apart from nobody");
});

test("under an independent judgement a verdict carrying the builder's own id is a shortfall", () => {
  const shortfalls = said("testing", holding(["first-builder", "judge-run"]));
  assert.equal(shortfalls.length, 1);
  assert.match(shortfalls[0], /^the verdict on criteria 1, 2 carries the builder's own id `judge-run`/u);
  assert.match(asks("testing", holding(["first-builder", "judge-run"])), /forge record verdict ISS-38 --landing 'https:/u);
});
