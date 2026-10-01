/* What an issue's record earns: the contract's flow table, one entry check per status, and the
   record read whole into one object. The verb that spends this is advance.mjs; nothing here
   writes, fetches or reads the repository. What it checks against is the contract's table for that
   status, printed by `forge guide contract`. */
import {
  ANSWERS_LOOK, CARRIES, CLOSES_FROM, DISPOSITIONS, TRIAGES, correctedKind, looksIn, looksTo, need, planFlags,
  somebodyLooked, unwrap, valuesOf, witnessedOn,
} from "./machine.mjs";
import { planShapeOwed } from "./earned/plan-owed.mjs";
import { ANSWERED_BY_COMMENT, PARK_STATUS, SIDE, answersByComment, sameLanding } from "./earned/park-status.mjs";
import { correctionForm, judgedHead, judgedStands, landingMoved, landingWrote, markedCommit, mergedForm, namesPath, reviewedHead, undoForm } from "./record/merged.mjs";
import { landsOutsideGit, markedLanding } from "./record/judged/landing.mjs";
import { askOne, carriedAsk, correctedForm, foldVerdicts, heldBlocks, idAsk, identityOf, identityOwed, landingOwed, unreadId, verificationForm } from "./earned/asks.mjs";

export { correctedForm };
import { FORMS } from "../spec/parse.mjs";
import { lightens } from "../ladder.mjs";
import { citedOwed, wholeOwed } from "./earned/baseline.mjs";
import { findingsOwed } from "./earned/findings.mjs";
import { rungReport } from "../ladder-report.mjs";
import { attachmentNames, isCommit, sameCommit } from "../tracker/evidence.mjs";
import { blockersOwed, holdsBack, holdsBackFrom, ordersSaid } from "./earned/blockers.mjs";
import { shapeGaps } from "./earned/shape-gaps.mjs";

export { shapeGaps };

import { Refused } from "../refusal.mjs";
import { FIELD as SESSION } from "./lease.mjs";
import { landingOf } from "./landing/checkpoint.mjs";
import { holdersOf } from "./landing/reconstruction.mjs";
import { worklogOf } from "./worklog.mjs";
import { judgeAsk, judgeProblems, numbered } from "./qa/verdicts.mjs";
import { criteriaLines } from "./record/fields.mjs";
import { assemble } from "./record/page.mjs";
import { SILENT, announcedAt, answered, parkRecord, parkThatSet, relayedSince } from "./park/read.mjs";

export { SILENT, announcedAt, answered, parkRecord, parkThatSet, relayedSince };
import { judgementOf, releaseOwedOf, waitsForPerson } from "../tracker/project-config.mjs";

/* The contract's flow table in its own order: the sequence is the rule, so listing it is the point. */
export const ORDER = [
  "open", "confirmed", "approved", "in_progress", "developed", "testing", "awaiting_release", "closed",
];

/** The rung the verdicts are owed at, read off the sequence rather than spelled a second time: `route.mjs` asks for it by name, and a literal there is a rung free to disagree with this order. */
export const JUDGED_AT = ORDER[ORDER.indexOf("developed") + 1];

/** The rung the baseline is owed at, and the rung the release policy is read at — the last one, which is entered on the project rather than on the record. Both off the sequence, for the reason above. */
export const BASELINE_AT = ORDER[ORDER.indexOf("developed") - 1];
export const CLOSES_AT = ORDER.at(-1);

/* A default nothing ever mutates, for a call that owes no number the exclusion after it. */
const EMPTY_SET = new Set();

export { ANSWERED_BY_COMMENT, PARK_STATUS, SIDE, answersByComment, sameLanding };
export { blockersOwed, holdsBack, holdsBackFrom, ordersSaid };

/** Five shortfalls a caller compares whole, named so a case holding an exact list names them rather
 *  than restating the wording the file that proves each one pins. */
export const NO_VERIFICATION = "no verification: where the change now runs, at which commit, and the evidence";
export const NO_NOTE = "no release note and no withholding either";
export const NO_DECISION = "no decision record: each reading decided with its assumption and undo, or an explicit none";
export const NO_CRITERIA = "the criteria field holds no numbered line `N. outcome`";
export const NO_BASELINE = "no baseline: the gate, what it already reports and the commit it ran at";

export const atLeast = (status, floor) =>
  ORDER.indexOf(status) >= 0 && ORDER.indexOf(status) >= ORDER.indexOf(floor);

/** Whether a claim taken at that status was taken while the change was still being built. Off the
 *  sequence rather than off a second list of names: a holder whose every claim came at or past the
 *  status a build hands over at judged the change or landed it, and nothing on the record proposes
 *  it as the builder (ISS-2045). A status the sequence does not hold reads as a build. */
export const buildsAt = (status) => !atLeast(status, ORDER[ORDER.indexOf(BASELINE_AT) + 1]);

/** `buildsAt` for a claim-history row, read against the page: a claim taken at a side status was
 *  taken where the park that set it left, which is the newest park landing there posted before the
 *  claim. A judge dispatched onto an issue parked from `developed` claims it at `on_hold`, and read as
 *  itself that claim made the judge a build holder and voided every verdict it wrote (ISS-2044). A
 *  row no such park precedes stays unplaced, which reads as a build, and so does every side-status
 *  row on a page cut short: the park that placed it may be among the comments the walk never reached. */
const buildsOn = (view) => (status, row) => {
  if (!SIDE.includes(status) || !row?.at || view.cut) return buildsAt(status);
  const left = parkRecord(view, (kind) => sameLanding(PARK_STATUS[kind], status), null, row.at)?.record.fields.left;
  return buildsAt(left ?? status);
};

export const criteriaOf = (issue) => {
  try {
    return criteriaLines(unwrap(issue.acceptanceCriteria));
  } catch (error) {
    if (error instanceof Refused) return [];
    throw error;
  }
};

/* Whole first: `dropped` has no checks of its own, so a confirmation carrying the finding and
   nothing else would drop an issue on one line. */
export const dispositionOf = (view) => {
  const held = view.latest?.confirmation;
  if (!held || shapeGaps("confirmation", held.record, view.names ?? []).length) return null;
  const finding = held.record.fields.finding;
  return DISPOSITIONS.includes(finding) ? finding : null;
};

export const stepAfter = (status) => {
  const at = ORDER.indexOf(status);
  return at < 0 || at === ORDER.length - 1 ? null : ORDER[at + 1];
};

export const nextOf = (status, view) =>
  (status === "confirmed" && dispositionOf(view) ? "dropped" : stepAfter(status));

/* The park is a look at the evidence either way, which the project's own policy may say it does
   not want: the declaration is the plan's and whether a person is waited for is the project's.
   `witnessed` is the plan's own answer to the question this park asks: a `none` is owed no park, and
   an absent section is no answer, the question never having been put (ISS-1607). */
export const personLooks = (flags, policy = null, witnessed = null) =>
  (witnessed?.none || (policy && !waitsForPerson(policy)) ? null : looksTo(flags));

export const lookAnswered = (view) => ANSWERS_LOOK.some((kind) => answered(view, kind));

/** Reported rather than reconciled, there being no precedence rule between the two sources to introduce: a flow requiring a look this project's release policy waives promises one nobody takes. */
export const flowPolicyConflict = (flow, requires, policy) => {
  const flags = Object.fromEntries(requires.map((one) => [one, "yes"]));
  const asks = looksTo(flags);
  if (!asks || personLooks(flags, policy)) return null;
  return `flow ${flow} requires ${asks} of every plan and this project's release policy waives a`
    + " person's look, so the declaration promises a look nobody takes: change the flow, or the"
    + " project's release policy";
};

/** The same shape for the other thing a flow may ask a project for: two answers to one question are reported over both sources, because a precedence rule between them is one nobody could read off either. */
export const flowJudgeConflict = (flow, judge, policy) => {
  if (!judge) return null;
  const held = judgementOf(policy);
  if (held === judge) return null;
  return `flow ${flow} asks for ${judge} judgement between developed and testing, and this project's`
    + ` configuration says ${held}, so the method dispatches a judge whose verdicts the rung does not`
    + " ask for: change the flow, or the project's qa configuration";
};

const correctionsIn = (view) => (view.repeated?.correction ?? [])
  .filter((one) => !shapeGaps("correction", one.record, view.names).length)
  .map((one) => one.record.fields);

/* What the corrections on a record say moved, for the rung and for `namedIn`, which are its only readers. `correction` repeats since ISS-11, so `assemble` has already filed every one of them off the parse it made, and the hand parse of `view.comments` this replaced was a second parse for one answer (ISS-161, ISS-847). Whole payloads only: a comment carrying `moved` and no `why` reaches the page through any client no gate sits before, and it is no correction — read as a climb it would un-lighten an issue on a payload nothing wrote, and read as a path named it would excuse a landing that wrote one. The report counts what is on the page rather than what is a correction, which is a different question and stays `record/thread/report.mjs`'s. */
const movedIn = (view, which = () => true) => correctionsIn(view).filter(which).map((one) => one.moved);

/* The corrections that extend the plan's list, for `namedIn`: those naming the plan as what they correct, and those written before `corrects` existed, which the read-back excuses the field. A correction of a review verdict, a criterion or a field of the issue says what moved in *that* record, and a path in its prose — one saying the file was left untouched as readily as one saying it was written — is no file the change was planned to write (ISS-415). The field and not the sentence, because the sentence cannot be read for what it asserts. */
const ofPlan = (one) => one.corrects === undefined || correctedKind(one.corrects) === "plan";

export const rungFieldsOf = (view) => (view.rungFields ??= {
  plan: unwrap(view.issue.plan),
  moved: movedIn(view),
  whole: view.whole !== false,
  complexity: view.issue.complexity ?? null,
});

const lightPath = (view, status, kind) => lightens(status, kind, rungFieldsOf(view));
export const fixReport = (view, ref) => rungReport(rungFieldsOf(view), ref);

export const setForm = (ref, status) =>
  `forge advance ${ref} --set ${status} --why "<why this status is set with nothing earning it>"`;

/* One shape, four answers: absent, rewritten, present but not a whole payload, or there to be read.
   A rewritten record is named as itself rather than as the fields it appears to lack: the write
   supplied them, and a list of flags to re-supply sends the author back to a command that worked. */
export const payloadOwed = (view, kind, what, ask) => {
  const held = view.latest[kind];
  if (!held) return [need(what, ask)];
  if (held.record.rewritten) {
    return [need(
      `the ${kind} on the record was rewritten by the project's prose pipeline, so no key of this `
        + `shape reads back from it; write it again on this build, which sends the payload in a `
        + `fenced block the rewrite copies as written`,
      ask,
    )];
  }
  const gaps = shapeGaps(kind, held.record, view.names, undefined, view.issue);
  return gaps.length
    ? [need(`the ${kind} on the record is not a whole payload: it lacks ${gaps.join(", ")}`, ask)]
    : [];
};

const reviewOwed = (view, ref) => {
  const merged = markedCommit(view.comments);
  const reviewed = reviewedHead(view.comments);
  const ask = `forge record review ${ref} --reviewer codex ${idAsk(view)} `
    + `--outcome ${valuesOf("review", "outcome")} --finding "F1 accepted"`;
  const owed = payloadOwed(view, "review", "no code review of the head that landed", ask);
  if (owed.length) return owed;
  const held = view.latest.review.record.fields;
  const judged = held.commit ?? held.landing;
  if (held.outcome !== "approved") return [need(`the latest review of ${judged} says ${held.outcome}`, ask)];
  if (landsOutsideGit(view.issue)) return landingOwed(view, held, "the review judged", ask);
  const landed = merged && sameCommit(judged, merged);
  if (merged && !landed && !(reviewed && sameCommit(judged, reviewed))) {
    return [need(
      `the review judged ${judged}, and the mark names ${merged}` + (reviewed ? ` from head ${reviewed}` : ""),
      ask,
    )];
  }
  return [];
};

/* One item for the set: fourteen copies of one path list is what a run reads past. */
const equivalenceOwed = (view, ref, judged, moved, numbers) => {
  const at = `the verdict${numbers.length > 1 ? "s" : ""} on criterion ${numbers.join(", ")}`;
  if (moved === null) {
    return need(
      `${at} judged ${judged}, which the mark names as the judged head, and the mark says nothing `
        + `about what the landing moved, so nothing says those verdicts survived it`,
      mergedForm(ref),
    );
  }
  return need(
    `the landing moved ${moved.join(", ")}, which this change touched, so ${at} judged ${judged} `
      + `and the evidence was taken before those paths moved`,
    `forge record verdict ${ref} --criterion <n> --verdict ${valuesOf("verdict", "verdict")} `
      + `--commit ${markedCommit(view.comments)} --evidence <attachment|url|sha>`,
  );
};

/* Whether a number the criteria field no longer holds was corrected away on the record, rather than
   an edit nobody logged: a whole correction naming `--corrects criteria:<number>` is what a reader
   can point to (ISS-2430 review, F2/F3). An edit with no such record still holds — the field can
   change under an issue for reasons this file never reads — and a number a renumbering hands to a
   different criterion is read as the same key it always was: every verdict here is keyed by number
   alone, which is this file's existing property throughout and not a new one this predicate adds. */
const correctedAway = (view, number) => (view.repeated?.correction ?? []).some((one) =>
  correctedKind(one.record.fields.corrects) === "criteria"
  && Number(String(one.record.fields.corrects).split(":")[1]) === number
  && !shapeGaps("correction", one.record, view.names).length);

/* A failed verdict holds every rung from the judging one to the close, whenever it was written: the
   builder's records turn writes its verdicts after the landing has entered `testing`, and a fail read
   by that rung alone held nothing once it was passed (ISS-2511). One reading for the three rungs, so
   none of them can disagree with another about which criterion failed. Current criteria, or a number
   a correction names as dropped: a correction that removes the criterion this fail was judged
   against — the criterion itself proved wrong rather than the code, ISS-2362 — leaves no number here
   for a fresh verdict to answer, and holding a vanished number forever is no route anybody could take
   (ISS-2430). One filter for this and a skip, the two differing only in what each need says. */
const HELD_VERDICTS = {
  fail: {
    what: (number) => `criterion ${number} failed its verdict`,
    or: "where the criterion itself was wrong",
  },
  /* Held the same way a fail is: core's own release sweep counts them alike (`unearnedCriteriaReports`,
     ISS-2430). A skip earns the judging rung it was written at — VERDICTS, `somebodyLooked`, ISS-1875 —
     but not the rungs after, until somebody looks again; ISS-1192 reached `closed` on one nothing here
     had reread. The `--why` already on the skip is what a reader has of the look nobody took. */
  skipped: {
    what: (number, record) => `criterion ${number} was skipped ("${record.fields.why}"), and nothing on the record says it has been judged since`,
    or: "where no route ever reaches it",
  },
};

const heldOwed = (view, ref, verdict, exclude = EMPTY_SET) => {
  const { what, or } = HELD_VERDICTS[verdict];
  const current = new Set(view.criteria.map((one) => one.number));
  return numbered(view.verdicts)
    .filter(([number, { record }]) => record.fields.verdict === verdict
      && !exclude.has(number)
      && !shapeGaps("verdict", record, view.names).length
      && (current.has(number) || !correctedAway(view, number)))
    .map(([number, { record }]) => need(
      what(number, record),
      `${askOne(ref, number, idAsk(view))}\n  or, ${or}: ${correctedForm(ref, number)}`,
    ));
};

const failedOwed = (view, ref, exclude) => heldOwed(view, ref, "fail", exclude);

/* Every shortfall core's own release sweep counts unearned that a verdict already on the page can
   still carry past the judging rung — a fail, a skip, or one a reopen's triage already moved past
   (`judgedSince`) — in one call, so the two rungs cannot come to hold a different set (ISS-2430). A
   number `judgedSince` already names is left out of the fail's or the skip's own message: one
   criterion, one reason (codex review). A criterion with no verdict at all stays out, the boundary
   `test/flow/earned/the-rung.test.mjs` (ISS-1065) keeps; a criterion a correction removed is not
   that either, `heldOwed` above already stopping at a number that is gone. */
const pastJudgingOwed = (view, ref) => {
  const stale = staleCriteria(view);
  return [...failedOwed(view, ref, stale), ...heldOwed(view, ref, "skipped", stale), ...judgedSince(view, ref, stale)];
};

/* A landing brings other people's commits and leaves this change's own diff alone, so a verdict
   judged before it judged the code that landed; the review's recheck at the landed head guards the
   tree they sit on. The note carries the predicate because git is asked where it can answer (ISS-156).
   A verdict after it stands where its own write found the commit judged carrying the landing. */
/* The same reading outside git, where there is no head to carry and no landing to move: a verdict
   stands where it names the landing the mark does. */
const landingVerdictsOwed = (view, ref) => {
  const ask = (number) => askOne(ref, number, idAsk(view));
  const out = foldVerdicts(ref, view.owed, idAsk(view),
    (number) => `criterion ${number} has no verdict`,
    (listed) => `criteria ${listed} have no verdict`);
  for (const [number, { record }] of numbered(view.verdicts)) {
    const gaps = shapeGaps("verdict", record, view.names);
    if (gaps.length) out.push(need(`the verdict on criterion ${number} lacks ${gaps.join(", ")}`, ask(number)));
    else if (record.fields.verdict !== "fail") out.push(...landingOwed(view, record.fields, `the verdict on criterion ${number} judged`, ask(number)));
  }
  out.push(...failedOwed(view, ref));
  for (const one of view.unreadable ?? []) {
    out.push(need(`a verdict written ${one.at.slice(0, 16)} names no criterion this build can read`, ask("<n>")));
  }
  return out;
};

const verdictsOwed = (view, ref) => {
  if (landsOutsideGit(view.issue)) return landingVerdictsOwed(view, ref);
  const merged = markedCommit(view.comments);
  const judged = judgedHead(view.comments);
  const moved = judged ? landingMoved(view.comments) : null;
  const stands = judgedStands(view.comments);
  const ask = (number) => askOne(ref, number, `--commit ${merged ?? "<sha>"}`);
  const out = foldVerdicts(ref, view.owed, `--commit ${merged ?? "<sha>"}`,
    (number) => `criterion ${number} has no verdict`,
    (listed) => `criteria ${listed} have no verdict`);
  const atJudged = [];
  for (const [number, { record }] of numbered(view.verdicts)) {
    const held = record.fields;
    const gaps = shapeGaps("verdict", record, view.names);
    if (gaps.length) out.push(need(`the verdict on criterion ${number} lacks ${gaps.join(", ")}`, ask(number)));
    else if (held.verdict === "fail") continue;
    else if (!merged || sameCommit(held.commit, merged) || sameCommit(held[CARRIES], merged)) continue;
    else if (judged && sameCommit(held.commit, judged)) {
      if (!stands) atJudged.push(number);
    } else {
      out.push(need(`the verdict on criterion ${number} judged ${held.commit}, and the merged commit is ${merged}: `
        + `nothing on the record says ${held.commit} carries it`, carriedAsk(ref, number, merged)));
    }
  }
  if (atJudged.length) out.push(equivalenceOwed(view, ref, judged, moved, atJudged));
  out.push(...failedOwed(view, ref));
  /* A verdict the reader could key by nothing is named as itself: an item naming the criterion it
     does not carry is the shortfall a rewrite invented, and no command supplies it. */
  for (const one of view.unreadable ?? []) {
    out.push(need(
      `a verdict written ${one.at.slice(0, 16)} names no criterion this build can read`
        + `${one.record.rewritten ? ", because the prose pipeline rewrote its keys" : ""}`,
      ask("<n>"),
    ));
  }
  return out;
};

/* One reopen, one finding, one triage, matched by the reopen each was written at: routed on the latest instead, a second look would be ruled on by the ruling on the first.
   The count is the tracker's, so a tracker that never raises it leaves every record at reopen zero and the pair is whichever was written — which is what a first reopen owes anyway. */
export const atThisReopen = (view, kind) => heldAtThisReopen(view, kind).at(-1) ?? null;

const heldAtThisReopen = (view, kind) => {
  const count = String(view.issue.reopenCount ?? 0);
  return (view.repeated?.[kind] ?? []).filter((one) => one.record.fields.reopen === count);
};

/* The ruling is the newest triage and the moment it unearned is the oldest of the unbroken run of
   like rulings ending at it: a second triage repeating the one before it rules on nothing the first
   did not, so a demand measured from it asks again for a record already written to answer the
   first — and where a project puts the judgement above `developed` in another run's hands, the one
   command that demand names is the one command the run standing there may not issue (ISS-2030). An
   outcome the triage before it did not rule is a reading that moved, and opens a run of its own. */
export const rulingAtThisReopen = (view) => {
  const held = heldAtThisReopen(view, "triage");
  if (!held.length) return null;
  const ruled = held.at(-1);
  let from = held.length - 1;
  while (from > 0 && held[from - 1].record.fields.outcome === ruled.record.fields.outcome) from -= 1;
  return { at: held[from].at, record: ruled.record };
};

/* A reopen sends the judging back to its start: a wrong-test triage moves the criteria and no commit
   with them, so every verdict on the record still names the merged commit and would pass again. */
/* The numbers `judgedSince` folds into one message, on their own: `pastJudgingOwed` reads this
   set too, to leave the same number out of a fail's or a skip's own message (codex review). Only
   the criteria the issue still has: a wrong-test correction may drop or renumber the one that was
   wrong, and a verdict asked for on a number the field no longer holds is refused at the write,
   which would leave the issue unable to reach the rung at all. */
const staleCriteria = (view) => {
  const held = rulingAtThisReopen(view);
  const outcome = held?.record.fields.outcome;
  if (!outcome || outcome === TRIAGES[2]) return EMPTY_SET;
  const current = new Set(view.criteria.map((one) => one.number));
  return new Set(numbered(view.verdicts)
    .filter(([number, one]) => current.has(number) && one.at < held.at)
    .map(([number]) => number));
};

/* `stale` is `staleCriteria(view)`, handed in by a caller that already read it. */
const judgedSince = (view, ref, stale = staleCriteria(view)) => {
  /* No commit to read: whatever answers the finding has no sha on the record yet. */
  return foldVerdicts(
    ref,
    [...stale],
    unreadId(view),
    (number) => `the verdict on criterion ${number} was written before this reopen's triage, and a reopen judges again`,
    (listed) => `the verdicts on criteria ${listed} were written before this reopen's triage, and a reopen judges again`,
  );
};

/* A URL and a sha are citations; an attachment is the thing itself, and a screen is the one change
   whose proof is that somebody looked. Which verdicts that reaches is the write's own question,
   asked here through the same predicate: a value exempt from citing evidence at the write and owing
   an attachment here would be a record whose two readers disagree about whether anybody looked. */
const shownOwed = (view, ref) => {
  if (view.flags.screen !== "yes") return [];
  /* Current criteria only, as `judgedSince` reads: asked for again on a dropped number, the write refuses. */
  const current = new Set(view.criteria.map((one) => one.number));
  const numbers = [...view.verdicts]
    .filter(([number]) => current.has(number))
    .filter(([, one]) => somebodyLooked(one.record.fields.verdict))
    .filter(([, one]) => !(one.record.fields.evidence ?? []).some((cited) => view.names.includes(cited)))
    .map(([number]) => number)
    .sort((one, two) => one - two);
  if (!numbers.length) return [];
  const at = numbers.length > 1 ? `criteria ${numbers.join(", ")}` : `criterion ${numbers[0]}`;
  return [need(
    `the plan declares a screen change, and the verdict on ${at} cites no attachment this issue `
      + `carries, so nothing on the record is a thing a person looked at`,
    `forge attach issue ${ref} <the rendered state>, then forge record verdict ${ref} `
      + `${idAsk(view)} --evidence <that attachment>`
      + heldBlocks(numbers.map((number) => [number, view.verdicts.get(number).record.fields])),
  )];
};

/* Grouped by the item and not by the verdict: one missing checkpoint printed once per criterion was
   37 identical lines on the issue that reported this, and the one fact to act on was in all of them
   and visible in none (ISS-1784). `shownOwed` above names its criteria the same way. */
const judgeOwed = (view, ref) => {
  const each = new Map();
  for (const one of judgeProblems(view)) each.set(one.why, [...each.get(one.why) ?? [], one]);
  return [...each].map(([why, held]) => {
    const numbers = held.map((one) => one.number);
    const at = numbers.length > 1 ? `criteria ${numbers.join(", ")}` : `criterion ${numbers[0]}`;
    const blocks = held[0].recite ? heldBlocks(held.map((one) => [one.number, one.held])) : null;
    return need(`the verdict on ${at} ${why}`,
      judgeAsk(ref, numbers, view.landing, held[0].held, markedCommit(view.comments), identityOf(view), view.holders ?? [], blocks));
  });
};

/* Nothing here can run a deploy — the machine that advances need not be the one that shipped — so where the config says production deploys on its own, the verification is asked to prove one happened, out of two values the record already holds. docs/cli/the-judge-and-the-deploy.md.
   The test is `autoProd` alone — `pipelineConfig.autoProdDeploy`, as `releaseFrom` reads it — and deliberately not `waitsForPerson`, which answers a different question off the branch pair. Neither branch is consulted here, so a project with either shape of branches owes the proof when that flag is true (ISS-428).
   `verificationForm` above is the one spelling of the sentence and not of its flags, which are literals in it and are spelled again on `SHAPES.verification` and in `record.mjs`'s usage row; each caller keeps its own placeholders, because what a missing record is asked for and what a deploy is asked to prove are not one sentence. */
const deployOwed = (view, ref) => {
  if (!view.release?.autoProd) return [];
  const held = view.latest.verification.record.fields;
  const merged = markedCommit(view.comments);
  const asks = (commit, tail = "") => verificationForm(ref, `--commit ${commit}`, "<the deployment's build log>", tail);
  const out = [];
  if (merged && !sameCommit(held.commit, merged) && !sameCommit(held.contains, merged)) {
    out.push(need(
      `the verification says ${held.commit} is running and the merged mark says this change landed `
        + `at ${merged}, and nothing says the two are the same code. The sha is read from the `
        + `deployment's own build log and never from the branch head: verify the build that reports `
        + `${merged}, or where the host built a later head, say that ${merged} is in it`,
      asks("<the sha that build reports>", ` --contains ${merged}`),
    ));
  }
  if ((held.evidence ?? []).every((one) => isCommit(one))) {
    out.push(need(
      `every evidence item on the verification is a bare commit sha, and a sha names no deployment, `
        + `so nothing on the record says one ran for ${merged ?? "this change"}`,
      asks(merged ?? "<the sha the deployment built>"),
    ));
  }
  return out;
};

/** The plan's own text and the corrections of the plan extending it, and not a path list, a plan being prose; `wrote` is not `moved`. Blank where the plan field holds no text, whatever the corrections name: a correction is what a plan's list is extended by and never what stands in for one, so the climb the ladder prints to every run that outgrows its rung leaves this blank rather than turning it into a list that names no path (ISS-402, ISS-1018). The test is the field and not the rung, a rung climbed by a correction past `approved` having no plan to be held to either. The composer of the note is the second reader — `namedFor` in `record/merged.mjs` — so the carve-out is here and not in either reader, which would otherwise each keep a copy of the same question. */
export const namedIn = (view) => {
  const plan = unwrap(view.issue.plan);
  return plan ? [plan, ...movedIn(view, ofPlan)].join("\n") : "";
};

/* A rung below `feature` writes no plan, and refusing against a list the ladder excused would take
   that rung back: `namedIn` is blank there, which is no list rather than an empty one. A plan that
   exists and names no path does have a list, and every landed path is outside it. */
const unplannedIn = (view) => {
  const wrote = landingWrote(view.comments);
  if (!wrote) return [];
  const named = namedIn(view);
  if (!named) return [];
  return wrote.filter((path) => !namesPath(named, path));
};

const scopeOwed = (view, ref) => {
  const outside = unplannedIn(view);
  if (!outside.length) return [];
  return [need(
    `the landing wrote ${outside.join(", ")}, which the plan does not name and no correction names `
      + `either, so the change grew and the record does not say where`,
    correctionForm(ref, outside),
  )];
};

/* The whole of what `testing` is entered on: the judge's half of the end of a run, and the rung a project asking for an independent judgement hands its turn over at. Kept a function of its own beside the other half, so a case holds each to its own refusals rather than to the union two rungs would make (ISS-1022, consult 8736c3 F2; ISS-1065). */
export const judgedOwed = (view, ref) => {
  if (!view.criteria.length) {
    return [need("the criteria field holds no numbered line, so there is nothing to judge", `forge record criteria ${ref} <criteria.md>`)];
  }
  const out = [...verdictsOwed(view, ref), ...judgedSince(view, ref), ...shownOwed(view, ref), ...judgeOwed(view, ref)];
  if (view.flags.schema === "yes" && !view.names.length) {
    out.push(need(
      "the plan declares schema coupling, and no attachment carries the migration risk classification",
      `forge attach issue ${ref} <classification>`,
    ));
  }
  return out;
};

/* The verification half alone, asked again at `closed` and not only at the rung it names: whatever
   put an issue on `awaiting_release` — the entry check below, or a set this record never earned —
   is not this check's to trust, so a verification absent or naming no deployment refuses the close
   the same way it would have refused the entry (ISS-1480). */
const verificationOwed = (view, ref) => {
  const verification = payloadOwed(
    view,
    "verification",
    NO_VERIFICATION,
    verificationForm(ref, idAsk(view), "<attachment|url|sha>"),
  );
  /* One or the other: a payload with gaps has no fields to compare against anything. Outside git
     there is no build to name a sha, so what is compared is the place the verification read. */
  if (verification.length) return verification;
  const wrong = identityOwed(view, view.latest.verification.record.fields, "the verification read",
    verificationForm(ref, idAsk(view), "<what you read there>"));
  return wrong.length || landsOutsideGit(view.issue) ? wrong : deployOwed(view, ref);
};

/* The whole of what `awaiting_release` is entered on: the deploying actor's half, of a change already running. The two halves answer to different actors, which is why each has a rung — a rung demanding both could not say which one it was waiting for. */
export const deployedOwed = (view, ref) => {
  const out = verificationOwed(view, ref);
  /* Both forms, the sentence above offering two: a line naming one sends a change with no user-facing half hunting for the other, and the tracker refuses the close without the field at every rung (ISS-1485). */
  if (!view.issue.releaseNotes?.section && !lightPath(view, CLOSES_FROM, "note")) {
    out.push(need(NO_NOTE,
      `forge record note ${ref} --section Added --user "<what the reporter sees>", `
      + `or --skip --why "<why the change has no user-facing half>"`));
  }
  const declared = personLooks(view.flags, view.release, view.witnessed);
  if (declared && !lookAnswered(view)) {
    out.push(need(
      `the plan declares ${declared}, and no person has answered since it was parked for review`,
      `forge advance ${ref} --park ${looksIn(view.flags)} --why "<why>" --evidence <attachment|url|sha>`,
    ));
  }
  return out;
};

/* The rung whose whole phase happens between two records, so it is the one that owes a branch: read off the worklog, which is what the run said of itself. docs/cli/the-work.md. */
const branchOwed = (view, ref) => (view.work?.branch ? [] : [need(
  "the worklog names no branch, so nothing on the record says which tree the code is being written "
    + "against, and a run resuming this issue cannot tell work already done from none",
  `forge claim ${ref} --pushed, from the checkout the branch is cut in`,
)]);

/* The one rung entered on the project rather than on the record, and so the one check no payload can answer: where the release policy leaves a person an act, a run moving this has taken the keystroke the report already told it was theirs (ISS-1918). The sentence is the report's own derivation, not a second one, and what would end the rung is said beside it because the two states — a project that has declared nothing, and one whose release nobody automates — end it differently. The command is the set, which is what the person who made the release types and the only route past an entry check. */
const releaseOwed = (view, ref) => {
  const held = releaseOwedOf(view.release);
  return held ? [need(
    `the release is a person's and nothing here says they have made it: ${held.owed} — ${held.clears}`,
    setForm(ref, CLOSES_AT),
  )] : [];
};

/* Every folded finding answered, at the rung the criteria are written and at each from the one they
   are judged at to the close: a finding can land on an issue at any of them (ISS-167). */
const foldedOwed = (view, ref, judged = false) => findingsOwed(view, ref, { whole: (kind, record) => !shapeGaps(kind, record, view.names).length, judged, id: unreadId(view) });

/* One entry check per status, each answering with what the record lacks and the write that supplies
   it. Nothing here reads the repository: what git knows was written on at the step that knew it. */
export const CHECKS = {
  confirmed: (view, ref) =>
    payloadOwed(
      view,
      "confirmation",
      "no confirmation: what the issue is in the code's own terms, where you looked, and the finding",
      `forge record confirmation ${ref} --is "<what it is>" --where <where> `
        + `--finding ${valuesOf("confirmation", "finding")}`,
    ),
  /* Three payloads and two phases behind them: the reading is decided and the plan written while the issue stands at `confirmed`, and this is the one rung that refuses without all three. Each is waived by its own row, so a rung dropping the plan still owes the decision if no row says otherwise (ISS-1066). */
  approved: (view, ref) => {
    const out = lightPath(view, "approved", "decision") ? [] : payloadOwed(
      view,
      "decision",
      NO_DECISION,
      `forge record decision ${ref} --decision "reading | assumption | undo"`,
    );
    const plan = unwrap(view.issue.plan);
    const { flags } = view;
    /* Absent, the declarations read `no` in every reader downstream, so a fix defaults nothing here. */
    const asks = !lightPath(view, "approved", "plan");
    if (asks && !plan) out.push(need("the plan field is empty", `forge record plan ${ref} <plan.md>`));
    out.push(...planShapeOwed(asks, plan, flags, view.criteria, ref));
    if (!view.criteria.length) {
      out.push(need(NO_CRITERIA, `forge record criteria ${ref} <criteria.md>`));
    }
    /* Called here and nowhere else, so a transition with no citation to weigh reads no tree. A list and empty, never falsy — an empty array is truthy. Which absence is which: `citedClauses`. */
    const cited = view.cited?.();
    if (cited && !cited.length) {
      out.push(need(
        "no clause of this project's requirements tree is named by the description, the plan or the "
          + `criteria, and a citation is \`<id>~<rev>\` — ${FORMS}`,
        `forge record criteria ${ref} <criteria.md>, with a criterion opening \`<id>~<rev>:\``,
      ));
    }
    return [...out, ...foldedOwed(view, ref)];
  },
  in_progress: (view, ref) => {
    const baseline = payloadOwed(
      view,
      "baseline",
      NO_BASELINE,
      `forge record baseline ${ref} --gate "<command>" --result "<what already fails>" --commit <sha> --scope whole`,
    );
    return [...blockersOwed(view), ...baseline, ...branchOwed(view, ref), ...wholeOwed(view, ref),
      ...citedOwed(view, ref)];
  },
  developed: (view, ref) => {
    const out = [];
    if (!view.issue.mergedAt) out.push(need("no merged mark, so nothing says the change landed", mergedForm(ref, view.issue)));
    else if (landsOutsideGit(view.issue)) {
      if (!markedLanding(view.issue)) {
        out.push(need("the merged mark names no landing: the tracker holds no `mergedLanding` for it, so nothing "
          + "says where the change landed outside git", `${undoForm(ref)}, then ${mergedForm(ref, view.issue)}`));
      }
    } else if (!markedCommit(view.comments)) {
      out.push(need("the merged mark names no commit; its note carries it as `at <sha>`", mergedForm(ref)));
    }
    return [...out, ...scopeOwed(view, ref), ...reviewOwed(view, ref)];
  },
  testing: (view, ref) => [...judgedOwed(view, ref), ...foldedOwed(view, ref)],
  awaiting_release: (view, ref) => [...pastJudgingOwed(view, ref), ...deployedOwed(view, ref),
    ...foldedOwed(view, ref, true)],
  closed: (view, ref) => [...pastJudgingOwed(view, ref), ...releaseOwed(view, ref),
    ...verificationOwed(view, ref), ...foldedOwed(view, ref, true)],
  dropped: () => [],
};
/* The whole record in one object, so every check reads fields rather than fetching. `cited` is the one argument passed unevaluated: resolving an issue's clauses walks the checkout, which only the `approved` check has a reason to do, and a caller handing over the answer would make every other transition pay for it and fail where the checkout is unreadable. */
export const viewFrom = (documentId, issue, comments, cut = null, release = null, cited = null, deploy = null) => {
  const criteria = criteriaOf(issue);
  const names = attachmentNames(issue, comments);
  /* Parsed once: six readers here and in route.mjs each ran it over the same plan for the same answer. */
  const flags = planFlags(unwrap(issue.plan));
  return { documentId, issue, comments, criteria, names, cut, whole: !cut, release, cited, deploy, flags, witnessed: witnessedOn(unwrap(issue.plan)), landing: landingOf(issue?.[SESSION]), holders: holdersOf(issue?.[SESSION], buildsOn({ comments, names, cut })), work: worklogOf(issue?.[SESSION]), ...assemble(comments, criteria) };
};
