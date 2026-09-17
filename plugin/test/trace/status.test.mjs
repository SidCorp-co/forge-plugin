/* The rung a clause earns, over a record built by hand: what proves a clause, what merely cites it,
   and what a cut citing set earns. Nothing here fetches — AC-14-4-3's derivation is pure, and the
   reads it is spent on are citing.test.mjs's. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("spec-status").path;
const { render } = await import("../../src/flow/record/page.mjs");
const { viewFrom } = await import("../../src/flow/earned.mjs");
const { RUNGS, clauseStatus, couldProve, lowestOf, opensOn } = await import("../../src/trace/status.mjs");

const ID = "AC-01-1-1";
const LANDED = "c8c3550";
const JUDGED = "43b811e";

let clock = 0;
const at = () => `2026-09-02T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body, extra = {}) => ({ createdAt: at(), authorId: "agent", body, ...extra });
const mark = (note) => comment(`mark_merged target=base — ${note}`);
const LANDING = mark(`merged to master at ${LANDED}; reviewed head ${JUDGED}; judged head ${JUDGED}; `
  + "landing moved nothing");
/* The other landing: one that moved paths this change touched, so the judged head no longer stands. */
const LANDING_MOVED = mark(`merged to master at ${LANDED}; judged head ${JUDGED}; `
  + "landing moved plugin/src/trace/status.mjs");

const verdict = (number, fields) => comment(render("verdict", {
  criterion: String(number), verdict: "pass", commit: JUDGED, evidence: ["run.txt"], ...fields,
}));

const PLAN_NO_SCREEN = "## Declarations\n\nscreen change: no\nuser-facing outcome: no\n";

/* A park a person answered: the park record, then a comment from a token that is no device's. */
const answeredPark = (kind = "screen-review") => [
  comment(render("park", { kind, why: "a person looks", evidence: ["run.txt"] }, "developed")),
  { createdAt: at(), authorId: "a-person", body: "looked, and it is right." },
];
const PLAN_SCREEN = "## Declarations\n\nscreen change: yes\nuser-facing outcome: no\n";

const row = (over = {}) => ({
  documentId: "the-uuid",
  issueId: "ISS-9",
  status: "closed",
  mergedAt: "2026-09-02T09:00:00.000Z",
  plan: PLAN_NO_SCREEN,
  acceptanceCriteria: `1. ${ID}~1: the first outcome.\n2. Something else entirely.`,
  cited: [{ id: ID, rev: 1, field: "acceptanceCriteria" }],
  ...over,
});

const seen = (one, comments) => new Map([[one.documentId, viewFrom(one.documentId, one, comments)]]);
const read = (rows, over = {}) => ({ id: ID, rows, whole: true, pages: 1, cut: null, ...over });
const rungFor = (one, comments) => clauseStatus(ID, read([one]), seen(one, comments.flat())).rung;

test("a criterion opening on the clause claims it, and the same identifier as prose does not", () => {
  assert.deepEqual(opensOn(row(), ID), [1]);
  assert.deepEqual(opensOn(row({ acceptanceCriteria: `1. The reader answers for ${ID}~1 and nothing else.` }), ID), [],
    "an identifier after the criterion's first word is prose, backwards as well as forwards");
});

test("a row that could prove nothing is filtered before any comment of it is read", () => {
  assert.ok(couldProve(row(), ID));
  assert.ok(!couldProve(row({ status: "open" }), ID), "an issue still open has landed nothing");
  assert.ok(!couldProve(row({ mergedAt: null }), ID), "and one with no merged mark landed nothing either");
  assert.ok(!couldProve(row({ acceptanceCriteria: "1. Unrelated." }), ID),
    "a body citing the clause and no criterion opening on it makes no claim a verdict could settle");
});

test("a clause no issue cites is unclaimed, and one cited with nothing proved is partial", () => {
  assert.equal(clauseStatus(ID, read([])).rung, "unclaimed");
  assert.equal(rungFor(row({ status: "open", mergedAt: null }), []), "partial");
});

test("a passing verdict at the head the mark says the verdicts judged is what implements a clause", () => {
  assert.equal(rungFor(row({ plan: PLAN_SCREEN }), [LANDING, verdict(1)]), "implemented");
  assert.equal(rungFor(row({ plan: PLAN_SCREEN }), [LANDING, verdict(1, { commit: "9999999" })]), "partial",
    "a verdict at a head the mark does not name judged some other tree");
  assert.equal(rungFor(row({ plan: PLAN_SCREEN }), [LANDING, verdict(1, { verdict: "fail" })]), "partial");
  assert.equal(rungFor(row({ plan: PLAN_SCREEN }), [verdict(1)]), "partial",
    "and with no mark there is no head for the verdict to be at");
});

test("a landing that moved this change's own paths leaves the verdict at the judged head standing for nothing", () => {
  assert.equal(rungFor(row({ plan: PLAN_SCREEN }), [LANDING_MOVED, verdict(1)]), "partial",
    "the evidence was taken before those paths moved, which is the rule the merged mark already states");
  assert.equal(rungFor(row({ plan: PLAN_SCREEN }), [LANDING_MOVED, verdict(1, { commit: LANDED })]), "implemented",
    "and a verdict at the sha the change landed at stands whatever the landing moved");
  assert.equal(rungFor(row({ plan: PLAN_SCREEN }),
    [mark(`merged to master at ${LANDED}; judged head ${JUDGED}`), verdict(1)]), "partial",
    "a mark saying nothing about moved paths has not said none moved");
});

test("every criterion the issue opened on the clause is owed a pass, not one of them", () => {
  const three = row({
    plan: PLAN_SCREEN,
    acceptanceCriteria: `1. ${ID}~1: the first.\n2. ${ID}~1: the second.`,
  });
  assert.equal(rungFor(three, [LANDING, verdict(1), verdict(2)]), "implemented");
  assert.equal(rungFor(three, [LANDING, verdict(1), verdict(2, { verdict: "fail" })]), "partial",
    "two claims about one clause with one failed is not a proof of it");
});

test("verified needs an affirmative answer about the person's look, never an absent one", () => {
  assert.equal(rungFor(row(), [LANDING, verdict(1)]), "verified",
    "a plan declaring no screen and no user-facing outcome answers that nobody was owed a look");
  assert.equal(rungFor(row({ plan: PLAN_SCREEN }), [LANDING, verdict(1)]), "implemented",
    "a declared screen whose park nobody answered is a look not taken, which is not a look passed");
  assert.equal(rungFor(row({ plan: "" }), [LANDING, verdict(1)]), "implemented",
    "a plan that answered neither question has not said a look was not owed: that is an absence");
  assert.equal(rungFor(row({ plan: PLAN_SCREEN, attachments: [{ name: "run.txt" }] }),
    [LANDING, verdict(1), answeredPark()]), "verified",
    "and a park a person answered is the other affirmative");
});

/* The kind says where a person looked and not whether they did, so a project with no screen earns the
   rung on the review kind it can answer, and one whose issue was parked under the older kind keeps
   what it earned (ISS-1694). */
const PLAN_OUTPUT = "## Declarations\n\nscreen change: no\nuser-facing outcome: yes\n";
test("either review kind answers the look, so a change with no screen can reach verified", () => {
  const looked = (kind) => rungFor(row({ plan: PLAN_OUTPUT, attachments: [{ name: "run.txt" }] }),
    [LANDING, verdict(1), answeredPark(kind)]);
  assert.equal(rungFor(row({ plan: PLAN_OUTPUT }), [LANDING, verdict(1)]), "implemented",
    "a declared user-facing outcome nobody answered for is a look not taken");
  assert.equal(looked("code-review"), "verified",
    "and the kind a project with no screen is asked for is one it can answer");
  assert.equal(looked("screen-review"), "verified",
    "as is the other, which issues already on the tracker carry");
  const answered = `${PLAN_OUTPUT}\n## Witnessed on screen\n\nnone — nothing here is a thing a person could look at.\n`;
  assert.equal(rungFor(row({ plan: answered }), [LANDING, verdict(1)]), "verified",
    "and a plan that answered `none` is owed no park, so waiting on one holds the clause short of what it proved");
});

test("a clause one issue proved is not demoted by another that only mentions it", () => {
  const prover = row();
  const mentions = row({ documentId: "other-uuid", issueId: "ISS-10", status: "open", mergedAt: null,
    acceptanceCriteria: "1. Unrelated.", cited: [{ id: ID, rev: 1, field: "description" }] });
  const held = clauseStatus(ID, read([mentions, prover]), seen(prover, [LANDING, verdict(1)]));
  assert.equal(held.rung, "verified");
  assert.deepEqual(held.provers, ["ISS-9"]);
  assert.deepEqual(held.citedBy.map((one) => one.issueId), ["ISS-10", "ISS-9"],
    "and the issue that only mentioned it is still named as citing it");
});

test("a citing set the tracker cut earns no rung, and no rung is what its requirement earns too", () => {
  const cut = clauseStatus(ID, read([row()], { whole: false, cut: "reached 1 issue(s) …" }), new Map());
  assert.equal(cut.rung, null);
  assert.match(cut.cut, /reached 1 issue/u);
  assert.equal(lowestOf([cut, { rung: "verified" }]), null,
    "one clause nobody could read is a requirement nobody can rank");
});

test("a requirement stands at the lowest rung any clause under it took", () => {
  assert.deepEqual(RUNGS, ["unclaimed", "partial", "implemented", "verified"]);
  assert.equal(lowestOf([{ rung: "verified" }, { rung: "implemented" }]), "implemented");
  assert.equal(lowestOf([{ rung: "verified" }, { rung: "unclaimed" }]), "unclaimed");
  assert.equal(lowestOf([]), null, "a clause with no criteria under it ranks nothing");
});

test("a record this reading could not finish costs the clause its rung, as a cut citing set does", () => {
  const one = row();
  const held = clauseStatus(ID, read([one]), seen(one, [LANDING, verdict(1)]),
    ["ISS-9: the thread was walked and stopped after 2 comment(s)"]);
  assert.equal(held.rung, null, "a verdict this did not reach and one nobody wrote read alike");
  assert.match(held.cut, /ISS-9: the thread was walked/u);
  assert.deepEqual(held.citedBy.map((row_) => row_.issueId), ["ISS-9"], "and the citing set is still named");
});
