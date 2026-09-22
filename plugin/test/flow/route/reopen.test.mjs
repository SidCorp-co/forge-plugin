/* Where an issue goes next when a person disagrees with the answer. A reopen is the tracker's own
   status and nothing here knew it: the verb refused at `closed`, named the raw transition, and a
   person's word then left the issue where no entry check answered for it (ISS-43). */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("route").path;
const { render } = await import("../../../src/flow/record/page.mjs");
const { viewFrom } = await import("../../../src/flow/earned.mjs");
const { targetOf } = await import("../../../src/flow/route.mjs");

let clock = 0;
const at = () => `2026-09-03T11:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body, extra = {}) => ({ createdAt: at(), authorId: "agent", body, ...extra });
const recorded = (kind, fields, status = null) => comment(render(kind, fields, status));
const view = (issue, comments = []) => viewFrom("the-uuid", issue, comments);

const CRITERIA = "1. The first outcome.\n2. The second outcome.";
const ATTACHED = [{ name: "run.txt" }];
const PLAN = "Screen change: no. Schema coupling: no.\n\nThe plan itself.";

/* The two writes a reopen is made of: what the person found, and the agent's ruling on it. */
const FOUND = {
  expected: "the list sorted by name", seen: "sorted by id",
  evidence: ["run.txt"], quoted: "I cannot find anything in it",
};
const MARKED = "2026-09-02T16:00:00.000Z";
/* Each record carries the reopen it was written at, stamped from the tracker's own count at the
   write, so the pair that routes a reopen is the pair that belongs to it. `after` is a function
   rather than a list because the clock stamps a record when it is made, and what these rules turn
   on is whether a write came after the triage or before it. */
const reopened = (triage, extra = {}, after = () => [], stamp = "0") => {
  const pair = [recorded("finding", FOUND, stamp), ...(triage ? [recorded("triage", triage, stamp)] : [])];
  return view(
    {
      status: "reopen", mergedAt: MARKED, plan: PLAN,
      acceptanceCriteria: CRITERIA, attachments: ATTACHED, ...extra,
    },
    [...pair, ...after()],
  );
};
const CAUGHT = "a criterion naming the order";
const WRONG = { outcome: "wrong-test", "would-have-caught": CAUGHT };
const NOT_MET = { outcome: "not-met", "would-have-caught": CAUGHT };
const corrected = () => recorded("correction", { moved: "criterion 2 now names the order", why: "the finding showed it" });
/* A wrong-test triage says one criterion asked the wrong thing, and the finding is what names it. */
const ABOUT_TWO = { ...FOUND, criterion: "2 — The second outcome." };
const MOVED = "1. The first outcome.\n2. The second outcome, in the order it names.";
/* A fail carries what the criterion did instead, that being what the run after it acts on. */
const judged = (verdict) => recorded("verdict", { criterion: "1 — The first outcome.", verdict, commit: "43b811e",
  evidence: ["run.txt"], ...(verdict === "fail" ? { why: "the column came back in the order it was filed" } : {}) });

/* Each outcome owes one write of its own before the fall, because a triage is a ruling about the
   record as it stands and the record has to change to match it. */
test("a reopen falls where its triage says, once the write that outcome owes is there", () => {
  const wrong = targetOf(reopened(WRONG, { acceptanceCriteria: MOVED }, () => [recorded("finding", ABOUT_TWO, "0")]), "ISS-3");
  assert.match(wrong.missing[0].what, /rules the criterion the wrong test, and no whole correction since it/u);
  assert.match(wrong.missing[0].command, /^forge record correction ISS-3 --moved/u);
  const moved = targetOf(reopened(WRONG, { acceptanceCriteria: MOVED }, () => [recorded("finding", ABOUT_TWO, "0"), corrected()]), "ISS-3");
  assert.deepEqual(moved.missing, []);
  assert.equal(moved.next, "developed", "the criterion was the wrong test, so it and its verdicts go");
  const notMet = targetOf(reopened(NOT_MET), "ISS-3");
  assert.match(notMet.missing[0].what, /rules the criterion not met, and no failing verdict since it/u);
  assert.match(notMet.missing[0].command, /--verdict fail/u);
  const supersedes = targetOf(reopened(NOT_MET, {}, () => [judged("fail")]), "ISS-3");
  assert.deepEqual(supersedes.missing, []);
  assert.equal(supersedes.next, "in_progress", "the criterion was right and the code is not");
  assert.equal(supersedes.park, undefined, "neither of the two parks anything");
  assert.equal(supersedes.resumed, false, "and neither is a park being resumed");
  assert.equal(targetOf(reopened(NOT_MET, {}, () => [judged("pass")]), "ISS-3").missing.length, 1,
    "and a verdict that passes again supersedes nothing");
  /* The finding names what it is about, so a failing verdict on some other criterion is not the
     one this triage owes. */
  const named = { ...FOUND, criterion: "2 — The second outcome." };
  const cited = (comments) => targetOf(view(
    { status: "reopen", mergedAt: MARKED, plan: PLAN, acceptanceCriteria: CRITERIA, attachments: ATTACHED },
    comments(),
  ), "ISS-3");
  const elsewhere = cited(() => [recorded("finding", named, "0"), recorded("triage", NOT_MET, "0"), judged("fail")]);
  assert.match(elsewhere.missing[0].what, /on criterion 2, which the finding names,/u);
  const onIt = cited(() => [
    recorded("finding", named, "0"), recorded("triage", NOT_MET, "0"),
    recorded("verdict", { criterion: "2 — The second outcome.", verdict: "fail", commit: "43b811e",
      evidence: ["run.txt"], why: "the order is the one it was filed in" }),
  ]);
  assert.deepEqual(onIt.missing, [], "and the one on the criterion it names earns the fall");
});

/* Which criterion asked the wrong thing is the finding's to name, and its record quotes that line
   as it stood, so whether the field moved is on the record too. Nothing here reads the repository,
   and nothing infers movement from a verdict left over from an edit made long before this reopen. */
test("a wrong-test triage names its criterion, and is refused while that line still reads the same", () => {
  const ruled = (criteria, comments) => targetOf(view(
    { status: "reopen", mergedAt: MARKED, plan: PLAN, acceptanceCriteria: criteria, attachments: ATTACHED },
    comments(),
  ), "ISS-3");
  const written = (found) => () => [recorded("finding", found, "0"), recorded("triage", WRONG, "0"), corrected()];
  const anonymous = ruled(CRITERIA, written(FOUND));
  assert.match(anonymous.missing[0].what, /rules a criterion the wrong test, and the finding names none/u);
  assert.match(anonymous.missing[0].command, /^forge record finding ISS-3 --criterion <n>/u);
  const unmoved = ruled(CRITERIA, written(ABOUT_TWO));
  assert.deepEqual(unmoved.missing.map((one) => one.what), [
    "criterion 2 still reads as the finding quoted it, so nothing was corrected",
  ]);
  assert.match(unmoved.missing[0].command, /^forge record criteria ISS-3/u);
  const moved = ruled(MOVED, written(ABOUT_TWO));
  assert.deepEqual(moved.missing, [], "a line the finding quoted differently is a line that moved");
  assert.equal(moved.next, "developed");
  const dropped = ruled("1. The first outcome.", written(ABOUT_TWO));
  assert.deepEqual(dropped.missing, [], "and so is the criterion the correction took out altogether");
  /* A comment carrying the tag and little else reaches this the way the finding does, so it is
     measured against its shape here too. */
  const bare = ruled(MOVED, () => [
    recorded("finding", ABOUT_TWO, "0"), recorded("triage", WRONG, "0"),
    comment("## Correction\n\n- **What moved:** criterion 2\n\n`forge-record: correction · contract 1`"),
  ]);
  assert.match(bare.missing[0].what, /no whole correction since it/u, "a correction with no reason on it is not one");
  const thin = targetOf(view(
    { status: "reopen", mergedAt: MARKED, plan: PLAN, acceptanceCriteria: CRITERIA, attachments: ATTACHED },
    [
      recorded("finding", FOUND, "0"), recorded("triage", NOT_MET, "0"),
      comment("## Verdict\n\n- **Criterion:** 1 — The first outcome.\n- **Verdict:** fail\n\n`forge-record: verdict · contract 1`"),
    ],
  ), "ISS-3");
  assert.match(thin.missing[0].what, /no failing verdict since it/u, "and a verdict with no commit and no evidence supersedes nothing");
});

test("a reopen with no finding or no triage names both writes", () => {
  const bare = targetOf(view({ status: "reopen", mergedAt: MARKED }, []), "ISS-3");
  assert.deepEqual(bare.missing.map((one) => one.what), [
    "no finding: what was expected, what was seen, and either the words of whoever reported it or "
      + "the evidence this run captured when it saw the defect itself",
    "no triage of the finding: one of wrong-test, not-met, not-in-spec, and what would have caught it",
  ]);
  assert.match(bare.missing[0].command, /^forge record finding ISS-3 --expected/u);
  assert.match(bare.missing[1].command, /^forge record triage ISS-3 --outcome not-met --would-have-caught/u);
  assert.equal(bare.next, "awaiting_release", "and it says where the issue is bound while it waits");
  const found = targetOf(reopened(null), "ISS-3");
  assert.equal(found.missing.length, 1, "the finding on its own routes nothing");
  assert.match(found.missing[0].what, /^no triage/u);
});

/* Both kinds repeat, and the latest of a kind is current only for a kind that cannot: routed on the
   latest alone, a second reopen would be ruled on by the ruling on the first. */
test("each reopen owes the finding and the triage written at it, and not the ones before", () => {
  const twice = targetOf(reopened(NOT_MET, { reopenCount: 2 }, () => [], "1"), "ISS-3");
  assert.deepEqual(twice.missing.map((one) => one.what), [
    "1 finding record(s), and none of them this reopen's: each look is its own",
    "1 triage record(s), and none of them this reopen's: each look is its own",
  ]);
  const pair = () => [recorded("finding", FOUND, "2"), recorded("triage", NOT_MET, "2"), judged("fail")];
  const again = targetOf(reopened(NOT_MET, { reopenCount: 2 }, pair, "1"), "ISS-3");
  assert.deepEqual(again.missing, [], "the pair written at this reopen earns it");
  assert.equal(again.next, "in_progress");
  const ruled = () => [recorded("finding", FOUND, "2"), recorded("triage", WRONG, "2"), corrected()];
  const routed = targetOf(reopened(NOT_MET, { reopenCount: 2 }, ruled, "1"), "ISS-3");
  assert.equal(routed.next, "developed", "and it is this reopen's triage that routes, not the latest of the kind");
});

/* A second triage at one reopen said nothing the first had not, and the demand it re-armed named
   the one command a builder on a project judged by another run may not issue (ISS-2030). So the
   ruling is read off the newest triage and the moment it unearned off the oldest of the run of like
   rulings ending at it, and a record already written to answer the first still answers it. */
test("a second triage repeating the first asks for nothing it already answered", () => {
  const again = (outcome) => recorded("triage", { outcome, "would-have-caught": CAUGHT }, "0");
  const repeated = targetOf(reopened(NOT_MET, {}, () => [judged("fail"), again("not-met")]), "ISS-3");
  assert.deepEqual(repeated.missing, [], "the verdict that answered the first ruling answers the repeat");
  assert.equal(repeated.next, "in_progress", "and the fall is the one that outcome names");
  const written = () => [recorded("finding", ABOUT_TWO, "0"), corrected(), again("wrong-test")];
  const twice = targetOf(reopened(WRONG, { acceptanceCriteria: MOVED }, written), "ISS-3");
  assert.deepEqual(twice.missing, [], "and the correction answers a repeated wrong-test the same way");
  const turned = targetOf(reopened(WRONG, { acceptanceCriteria: MOVED },
    () => [recorded("finding", ABOUT_TWO, "0"), corrected(), again("not-met")]), "ISS-3");
  assert.match(turned.missing[0].what, /no failing verdict since it/u,
    "while a ruling that moved is measured from itself, so the correction before it earns nothing");
  assert.deepEqual(targetOf(reopened(NOT_MET), "ISS-3").missing.map((one) => one.what), [
    "the triage rules the criterion not met, and no failing verdict since it supersedes the passing one",
  ], "and one triage on its own asks for the verdict in the words it always asked");
});

/* Two comments the tracker stamped alike are neither before nor after each other, and the record
   that answers a ruling is owed no earlier than the ruling: read strictly, the answer written in
   the ruling's own moment reads as the one written before it. */
test("a record the tracker stamped with the triage that unearned is not older than it", () => {
  const SAME = "2026-09-03T12:00:00.000Z";
  const stamped = (kind, fields, when) => ({ createdAt: when, authorId: "agent", body: render(kind, fields, "0") });
  const together = (triage, answer) => targetOf(view(
    { status: "reopen", mergedAt: MARKED, plan: PLAN, acceptanceCriteria: MOVED, attachments: ATTACHED },
    [stamped("finding", ABOUT_TWO, "2026-09-03T11:59:00.000Z"), stamped("triage", triage, SAME), answer],
  ), "ISS-3");
  const failed = together(NOT_MET, stamped("verdict", { criterion: "2 — The second outcome.", verdict: "fail",
    commit: "43b811e", evidence: ["run.txt"], why: "the order is the one it was filed in" }, SAME));
  assert.deepEqual(failed.missing, [], "the failing verdict in the triage's own moment supersedes the passing one");
  const fixed = together(WRONG, stamped("correction", { moved: "criterion 2 now names the order", why: "the finding showed it" }, SAME));
  assert.deepEqual(fixed.missing, [], "and so does the correction a wrong-test ruling asks for");
});

/* A judging run is the actor the flow dispatches to find the defect, and it has nobody to quote.
   What it has instead is what it captured, and the pair is grounds rather than fields (ISS-1815). */
const looked = (found, comments = () => []) => targetOf(view(
  { status: "reopen", mergedAt: MARKED, plan: PLAN, acceptanceCriteria: CRITERIA, attachments: ATTACHED },
  [recorded("finding", found, "0"), recorded("triage", NOT_MET, "0"), ...comments()],
), "ISS-3");
const SAW = { expected: FOUND.expected, seen: FOUND.seen, evidence: ["run.txt"] };

test("a finding the run made itself is whole on the evidence it captured", () => {
  const held = looked(SAW, () => [judged("fail")]);
  assert.deepEqual(held.missing, [], "no quote is owed where the record carries what the run saw");
  assert.equal(held.next, "in_progress", "and the triage routes it as it routes a person's");
});

test("a finding that quotes nobody and captured nothing is no finding", () => {
  const held = looked({ expected: FOUND.expected, seen: FOUND.seen, evidence: [] }, () => [judged("fail")]);
  assert.equal(held.missing.length, 1);
  assert.match(held.missing[0].what, /finding is not a whole payload: it lacks/u);
  assert.match(held.missing[0].what, /--quoted .+ or --evidence /u, "and it names both grounds");
});

/* The command an owed finding is asked for by is one a run with nobody to quote can send. */
test("the write a reopen asks for offers the quote as the case where a person reported it", () => {
  const bare = targetOf(view({ status: "reopen", mergedAt: MARKED }, []), "ISS-3");
  assert.match(bare.missing[0].command, /^forge record finding ISS-3 --expected .+--evidence <attachment\|url\|sha>/u);
  assert.match(bare.missing[0].command, /\(--quoted "<their words>" where a person reported it/u);
});

/* The one refusal that tells a caller how to reach the status named `--set` until ISS-1815 gave the
   status a write of its own, so the route out of a dead end was the escape hatch by instruction. */
test("the dead end sends a caller to the reopen write and not to the unearned set", () => {
  assert.throws(() => targetOf(view({ status: "closed", mergedAt: MARKED }, []), "ISS-3"), (error) => {
    assert.match(error.message, /^ISS-3 is closed; nothing advances from it\./u);
    assert.match(error.message, /forge advance ISS-3 --reopen --why /u, "the write the status has now");
    assert.doesNotMatch(error.message, /--set/u, "and not the one that writes a correction for it");
    assert.match(error.message, /a person's, or that of a run sent to judge the change/u,
      "named as both actors' finding, the row of the flow table saying the same");
    return true;
  });
});

test("not-in-spec parks the issue behind the edge that gates it", () => {
  const triage = { outcome: "not-in-spec", "would-have-caught": "a clause that never promised it" };
  const edged = (edge) => reopened(triage, { relations: { blockedBy: [edge] } });
  const alone = targetOf(reopened(triage), "ISS-3");
  assert.equal(alone.next, "on_hold");
  assert.match(alone.missing[0].what, /no edge that gates dispatch blocks this issue/u);
  assert.match(alone.missing[0].command, /^forge issue <the issue that owes it> --blocks ISS-3$/u,
    "the verb that writes the edge, the blocked end being the issue in hand");
  const blocked = targetOf(edged({ otherDisplayId: "ISS-9", otherStatus: "open", kind: "blocks", gatesDispatch: true }), "ISS-3");
  assert.deepEqual(blocked.missing, [], "and nothing else is owed: this issue's own judging was not at fault");
  assert.deepEqual(blocked.park, {
    kind: "blocked", left: "awaiting_release",
    why: "the triage rules the expectation not in the specification: a clause that never promised it",
  });
  const satisfied = targetOf(edged({ otherDisplayId: "ISS-9", otherStatus: "closed", kind: "blocks", gatesDispatch: false }), "ISS-3");
  assert.equal(satisfied.missing.length, 1, "an edge that gates nothing is no blocker here either");
});

test("where a reopen lands is read from the mark", () => {
  assert.equal(targetOf(reopened(WRONG, {}, () => [corrected()]), "ISS-3").next, "developed",
    "a mark says code landed, so a close was reopened");
  const drop = targetOf(reopened(WRONG, { mergedAt: null }, () => [
    recorded("park", { kind: "dropped", why: "the premise was false", evidence: [] }, "approved"),
    corrected(),
  ]), "ISS-3");
  assert.equal(drop.next, "approved", "nothing landed, so it goes back where the drop left it and no further on");
  assert.throws(() => targetOf(reopened(WRONG, { mergedAt: null }), "ISS-3"), /no park record of kind dropped/u);
});

/* The tracker announces a move into `waiting` or `needs_info` with a comment of its own, and that
   announcement is what pairs a park record with the transition it caused. Without the pairing the
   newest park of a matching kind answers, so a park already resumed sends the issue on a second
   time — to a `left` nobody decided this time round (ISS-142). */
const ANNOUNCED = "⏸ **Waiting on a human decision** — moved from `in_progress`\n\nsomebody has to look";
const PARKED = { kind: "screen-review", why: "somebody has to look", evidence: ["run.txt"] };
const answering = () => comment("looked, and it is right", { authorId: "a-person" });
const waiting = (comments) =>
  view({ status: "waiting", plan: PLAN, acceptanceCriteria: CRITERIA, attachments: ATTACHED }, comments);

test("the park a resume reads is the one written after the tracker announced the move", () => {
  const parked = waiting([comment(ANNOUNCED), recorded("park", PARKED, "in_progress"), answering()]);
  const held = targetOf(parked, "ISS-3");
  assert.equal(held.next, "in_progress", "the park that set this status says where it goes back to");
  assert.equal(held.resumed, true);
  assert.deepEqual(held.missing, [], "and a reply by somebody else clears it");
});

test("a park an earlier announcement already spent does not transition the issue a second time", () => {
  const again = waiting([
    comment(ANNOUNCED), recorded("park", PARKED, "in_progress"), answering(), comment(ANNOUNCED),
  ]);
  assert.throws(() => targetOf(again, "ISS-3"), (error) => {
    assert.match(error.message, /no park record on the page is paired with the entry into it/u);
    assert.match(error.message, /park of kind `screen-review`.*may already have caused a move/su,
      "and the refusal names the park it will not read again");
    assert.match(error.message, /forge advance ISS-3 --set <status> --why /u,
      "with the verb a person sets a status by hand with, and the reason it asks for");
    return true;
  });
});

/* `on_hold` is entered with no announcement of any kind, so there is nothing to pair a park with
   and the newest of a matching kind is all the page says — as it was before (ISS-142). */
test("an on_hold issue is read as it was, the tracker announcing no move into it", () => {
  const paused = view(
    { status: "on_hold", plan: PLAN, acceptanceCriteria: CRITERIA, attachments: ATTACHED },
    [recorded("park", { kind: "blocked", why: "waiting on ISS-9", evidence: [] }, "in_progress")],
  );
  const held = targetOf(paused, "ISS-3");
  assert.equal(held.next, "in_progress", "no announcement is needed where the tracker writes none");
  assert.equal(held.resumed, true);
});

/* The tracker announces every entry into `waiting`, so a page in it carrying none is a page that
   cannot say which park moved it — and the newest of a matching kind is a guess (ISS-142). */
test("a park with no announcement anywhere on the page pairs with nothing and moves nothing", () => {
  const unpaired = waiting([recorded("park", PARKED, "in_progress"), answering()]);
  assert.throws(() => targetOf(unpaired, "ISS-3"), (error) => {
    assert.match(error.message, /no park record on the page is paired with the entry into it/u);
    assert.match(error.message, /the page carries no announcement at all/u,
      "and the refusal says the page carries a park it will not read");
    return true;
  });
});

/* A `needs_info` park is filed before the move it causes, so the pairing is the other way round: the
   park that set the status is one of the comments between the last two announcements. An old park,
   the reply that answered it, and a later entry into the status pair with nothing (ISS-429). */
const ASKED = "❓ **Needs info** — moved from `confirmed`";
test("a needs_info park that an earlier entry already used is not read by a later one", () => {
  const asking = { kind: "question", why: "which of the two readings", evidence: [] };
  const page = (comments) => view(
    { status: "needs_info", plan: PLAN, acceptanceCriteria: CRITERIA, attachments: ATTACHED },
    comments,
  );
  const first = [recorded("park", asking, "confirmed"), comment(ASKED)];
  const held = targetOf(page(first), "ISS-3");
  assert.equal(held.next, "confirmed", "the park filed under the announcement is the one that set it");
  const again = page([...first, comment("the answer", { authorId: "the-reporter" }), comment(ASKED)]);
  assert.throws(() => targetOf(again, "ISS-3"), (error) => {
    assert.match(error.message, /no park record on the page is paired with the entry into it/u);
    assert.match(error.message, /does not sit beside it/u, "and the refusal will not spend the old park");
    return true;
  });
});

