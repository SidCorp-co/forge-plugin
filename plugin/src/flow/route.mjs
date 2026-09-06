/* Where an issue goes next, and what that costs: the park it resumes from, the reopen a person's
   word left it at, and the one target the verb may move it to. What each status is earned by, and
   the record it is read out of, is earned.mjs. The flow: `forge guide contract the-flow`. */
import { Refused, refuse } from "./record.mjs";
import { TRIAGES, criterionNumber, planFlags, unwrap } from "./machine.mjs";
import {
  CHECKS,
  ORDER,
  PARK_STATUS,
  SIDE,
  SILENT,
  announcedAt,
  answered,
  atLeast,
  atThisReopen,
  blockersOwed,
  holdsBack,
  need,
  nextOf,
  parkRecord,
  parkThatSet,
  personLooks,
  stepAfter,
  shapeGaps,
  transitionCall,
  viewFrom,
} from "./earned.mjs";
import { releasePolicy } from "../tracker/project-config.mjs";

/* A park is a checkpoint with a person at it: the reply that resumes it is a comment by somebody
   other than whoever parked the issue. A hold nobody was asked to answer resumes by hand. */
const resumeOwed = (view, held, ref) => {
  const kind = held.record.fields.kind;
  const left = held.record.fields.left;
  const since = held.comment.createdAt ?? "";
  const replied = view.comments.some(
    (one) => (one.createdAt ?? "") > since && one.authorId && one.authorId !== held.comment.authorId,
  );
  if (view.issue.status === "on_hold") {
    if (kind !== "blocked") {
      return [need(`the hold is kind ${kind}, which a person lifts, and lifting it writes a status no `
        + "entry check read", transitionCall(view.documentId, left))];
    }
    return blockersOwed(view);
  }
  return replied
    ? []
    : [need(
      `the park is kind ${kind} and nobody has answered it since ${since.slice(0, 16)}, and an answer `
        + "is a comment by somebody other than whoever parked it: the advance that reads one resumes "
        + `the issue to ${left}`,
      `forge comment ${ref} <file|->    (from whoever the park asks, and this run is not that reader)`,
    )];
};

/* The tracker's own status for a reopen, which is no step of the flow: it is where a person's word
   leaves an issue, and what follows is routed by the agent's triage of their finding. */
export const REOPEN = "reopen";
const FALLS_TO = { "wrong-test": "developed", "not-met": "in_progress" };

/* Where the reopen landed, read from the record: a merged mark means code landed, so this is the
   reopen of a close and the contract sends it to `released`. No mark means nothing landed, so it is
   the reopen of a drop and it goes back to the status the dropped park recorded. */
const landedOn = (view, ref) => {
  if (view.issue.mergedAt) return "released";
  const left = parkRecord(view, (one) => one === "dropped")?.record.fields.left;
  if (!ORDER.includes(left)) {
    refuse(`${ref} is ${REOPEN} and has no merged mark, so nothing landed and this is the reopen of a `
      + `drop — but no park record of kind dropped on the page names the status it left, so nothing `
      + `says where it goes back to. ${view.cut ? `${view.cut} The record that would say may be behind `
      + `the cut. ` : ""}Whoever knows where it belongs sets it, and this writes a status no entry `
      + `check read:\n  ${transitionCall(view.documentId, "<status>")}`);
  }
  return left;
};

const REOPEN_OWED = [
  [
    "finding",
    "no finding: what the person expected, what they saw, the evidence, and their own words",
    (ref) => `forge record finding ${ref} --expected "<what they expected>" --seen "<what they saw>" `
      + `--evidence <attachment|url|sha> --quoted "<their words>"`,
  ],
  [
    "triage",
    `no triage of the finding: one of ${TRIAGES.join(", ")}, and what would have caught it`,
    (ref) => `forge record triage ${ref} --outcome ${TRIAGES[1]} `
      + `--would-have-caught "<the criterion or review that would have caught it>"`,
  ],
];

const reopenOwed = (view, ref) =>
  REOPEN_OWED.flatMap(([kind, what, ask]) => {
    const held = atThisReopen(view, kind);
    if (!held) {
      const before = (view.repeated?.[kind] ?? []).length;
      return [need(
        before ? `${before} ${kind} record(s), and none of them this reopen's: each look is its own` : what,
        ask(ref),
      )];
    }
    const gaps = shapeGaps(kind, held.record, view.names);
    return gaps.length
      ? [need(`this reopen's ${kind} is not a whole payload: it lacks ${gaps.join(", ")}`, ask(ref))]
      : [];
  });

/* A triage that puts the expectation outside the specification says another issue owes it, and only
   an edge says which: prose gates nothing, so the park is refused until one gates this issue. */
const blockingOwed = (view) =>
  (view.issue.relations?.blockedBy ?? []).some(holdsBack)
    ? []
    : [need(
      "the triage puts the expectation outside the specification, and no edge that gates dispatch "
        + "blocks this issue: the spec change or the new issue that owes it is the blocker",
      `forge call forge_issues '{"action":"update","documentId":"${view.documentId}",`
        + `"data":{"relations":[{"kind":"blocks","dependsOnId":"<the issue that owes it>"}]}}'`,
    )];

/* The outcome says how far back the work goes and never how far forward, so the status the reopen
   landed on is the ceiling: a reopened drop that landed at `clarified` is not sent to `developed`. */
const lowerOf = (one, two) => (ORDER.indexOf(one) <= ORDER.indexOf(two) ? one : two);

const QUOTED = /^\d+\s*—\s*/u;

/* Each outcome names one write of its own, owed before the fall rather than after it: a triage is a
   ruling about the record as it stands, and the record has to change to match it. Presence, recency
   and the criterion named are what is checked, as everywhere here — whether a correction really
   moved the right line is the reviewer's, and a check attempting it would pass a dishonest one. */
const OUTCOME_OWED = {
  /* Which criterion was the wrong test is the finding's to name, and its record quotes that line as
     it stood: so whether the field moved is on the record too, and needs no repository. */
  "wrong-test": (view, ref, since, found) => {
    const cited = String(found?.record.fields.criterion ?? "");
    const number = criterionNumber(cited);
    if (!number) {
      return [need(
        "the triage rules a criterion the wrong test, and the finding names none, so nothing says which",
        `forge record finding ${ref} --criterion <n> --expected "<what they expected>" `
          + `--seen "<what they saw>" --evidence <attachment|url|sha> --quoted "<their words>"`,
      )];
    }
    const fixed = view.latest.correction;
    if (!(fixed?.at > since) || shapeGaps("correction", fixed.record, view.names).length) {
      return [need(
        "the triage rules the criterion the wrong test, and no whole correction since it says what moved in the criteria",
        `forge record correction ${ref} --moved "<the criterion as corrected>" --why "<the finding that showed it>"`,
      )];
    }
    return view.criteria.find((one) => one.number === number)?.text === cited.replace(QUOTED, "")
      ? [need(
        `criterion ${number} still reads as the finding quoted it, so nothing was corrected`,
        `forge record criteria ${ref} <criteria.md>`,
      )]
      : [];
  },
  "not-met": (view, ref, since, found) => {
    const named = criterionNumber(found?.record.fields.criterion);
    /* Whole, because a comment carrying the tag and little else reaches this the same way the
       finding and the triage do, and a verdict with no commit or no evidence supersedes nothing. */
    const failed = [...view.verdicts].some(([number, one]) =>
      one.at > since && one.record.fields.verdict === "fail" && (!named || number === named)
      && !shapeGaps("verdict", one.record, view.names).length);
    if (failed) return [];
    return [need(
      "the triage rules the criterion not met, and no failing verdict since it"
        + `${named ? ` on criterion ${named}, which the finding names,` : ""} supersedes the passing one`,
      `forge record verdict ${ref} --criterion ${named || "<n>"} --verdict fail --commit <sha> --evidence <attachment|url|sha>`,
    )];
  },
};

const reopenTarget = (view, ref) => {
  const landed = landedOn(view, ref);
  const missing = reopenOwed(view, ref);
  if (missing.length) return { next: landed, missing, resumed: false };
  const ruling = atThisReopen(view, "triage");
  const held = ruling.record.fields;
  if (held.outcome !== TRIAGES[2]) {
    return {
      next: lowerOf(landed, FALLS_TO[held.outcome]),
      missing: OUTCOME_OWED[held.outcome](view, ref, ruling.at, atThisReopen(view, "finding")),
      resumed: false,
    };
  }
  return {
    next: PARK_STATUS.blocked,
    missing: blockingOwed(view),
    resumed: false,
    park: { kind: "blocked", left: landed, why: `the triage rules the expectation not in the specification: ${held["would-have-caught"]}` },
  };
};

/* What `released` will want, said at the rehearsal rather than at the refusal three statuses later:
   the fourth dry run's lesson is that an obligation nobody is told about early is one that slips. */
export const lookAhead = (view, ref) => {
  const said = personLooks(planFlags(unwrap(view.issue.plan)), view.release);
  if (!said || atLeast(view.issue.status, "released") || answered(view, "screen-review")) return null;
  return `Ahead: released owes a person's look, because the plan declares ${said}. Ask for it with
`
    + `  forge advance ${ref} --park screen-review --why "<why>" --evidence <attachment|url|sha>`;
};

/* Said only where a park of the right kind is on the page and nothing pairs it with the move. */
const unpaired = (view, status) => {
  const stale = status !== SILENT && parkRecord(view, (one) => PARK_STATUS[one] === status);
  if (!stale) return "";
  const carries = `The page carries a park of kind \`${stale.record.fields.kind}\`, and `;
  return announcedAt(view)
    ? `${carries}the tracker's announcement of this entry into ${status} does not sit beside it, so `
      + `nothing pairs the two: that park may already have caused a move of its own, and reading it `
      + `twice would send the issue to a status this entry does not earn. `
    : `${carries}the page carries no announcement at all, though the tracker announces every entry `
      + `into ${status}, so nothing says that park is what moved it. `;
};

export const targetOf = (view, ref) => {
  const status = view.issue.status;
  const held = SIDE.includes(status) ? parkThatSet(view, status) : null;
  if (SIDE.includes(status)) {
    if (!held) {
      /* No write earns the way back: a park now would stamp the side status as the one it left. */
      refuse(`${ref} is ${status} and no park record on the page is paired with the entry into it, `
        + `so nothing says where it came from. ${unpaired(view, status)}`
        + `${view.cut ? `${view.cut} The record that would say may be behind the cut. ` : ""}`
        + `A park written now would name ${status} as the status it left, which is no step of the `
        + `flow, so nothing here earns the way back. Whoever knows where it belongs sets it, and `
        + `this writes a status no entry check read:\n  ${transitionCall(view.documentId, "<status>")}`);
    }
    const left = held.record.fields.left;
    if (!ORDER.includes(left)) {
      refuse(`the park record on ${ref} names \`${left}\` as the status it left, which is no step of the flow. `
        + `Whoever knows where it belongs sets it, and this writes a status no entry check read:\n  ${transitionCall(view.documentId, "<status>")}`);
    }
    return { next: left, missing: resumeOwed(view, held, ref), resumed: true };
  }
  if (status === REOPEN) return reopenTarget(view, ref);
  const next = nextOf(status, view);
  if (!next) {
    refuse(`${ref} is ${status}; nothing advances from it. A reopen is a person's word, and this verb `
      + `routes what follows it — a finding, then a triage:\n  ${transitionCall(view.documentId, REOPEN)}`);
  }
  return { next, missing: CHECKS[next](view, ref), resumed: false };
};

/* A reading that died where `targetOf` refuses would be useless exactly where it is needed most. */
export const owedIn = (view, ref) => {
  try {
    const { next, missing, resumed } = targetOf(view, ref);
    return { next, missing, resumed };
  } catch (error) {
    if (error instanceof Refused) return { next: null, missing: [], refused: error.message };
    throw error;
  }
};

/* Where the issue stands, in one line and one place — `advance` heads its answer with it, `resume`
   prints it, a record write ends with it (ISS-285); a refusal gives its first line, not the command. */
export const owedLine = (view, ref, held) => {
  if (held.refused) return held.refused.split("\n")[0].replace(/:$/u, ".");
  const at = `${ref} is ${view.issue.status}`;
  if (!held.next) return `${at}; nothing advances from it.`;
  return held.missing.length
    ? `${at}; ${held.next} is next and the record does not earn it: ${held.missing.length} item(s) owed.`
    : `${at}; ${held.next} is next and the record earns it. \`forge advance ${ref}\` moves it.`;
};

/* A call made only where its answer is read: a plan declaring neither line owes no person, and the
   deploy `released` asks after is asked after only where `released` is the status being entered.
   The step is `stepAfter`'s and not index arithmetic of this file's: a status the flow does not hold
   answers null there and `ORDER[-1 + 1]` here, which is the first status rather than no status. */
const RELEASED = "released";
export const policyFor = async (plan, status = null) =>
  (personLooks(planFlags(unwrap(plan))) || stepAfter(status) === RELEASED ? releasePolicy() : null);

export const owedSaid = async (documentId, issue, comments, ref, cut = null) => {
  const view = viewFrom(documentId, issue, comments, cut, await policyFor(issue.plan, issue.status));
  return owedLine(view, ref, owedIn(view, ref));
};
