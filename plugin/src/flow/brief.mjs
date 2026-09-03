/* One issue's whole context assembled out of the record and the worklog, and nothing formatted:
   the printer is resume.mjs and `--json` is this object, so the screen and a tool's reading cannot
   disagree. Under earned.mjs's rule about what it may touch, for the same reason (ISS-44). */
import { FIELD, leaseOf, sessionHeld, stateOf } from "./lease.mjs";
import { Refused, unwrap } from "./record.mjs";
import { PARK_STATUS, SIDE, atLeast, holdsBack, methodOf, parkRecord } from "./earned.mjs";
import { lookAhead, targetOf } from "./route.mjs";
import { worklogOf } from "./worklog.mjs";

const MARK = { pass: "✓ pass", fail: "✗ fail", skipped: "· skipped" };
const NONE = "– none";
const HEADLINE_CHARS = 200;

/* The field of each kind a reader wants on one line. The whole record is `forge record report`. */
const HEADLINE = {
  confirmation: "What it is",
  decision: "Decision",
  correction: "What moved",
  park: "Why",
  finding: "Seen",
  triage: "Outcome",
};
const LATEST = ["confirmation", "decision", "correction", "finding", "triage"];

const oneLine = (value) => {
  const line = String(value ?? "").replace(/\s+/gu, " ").trim();
  return line.length > HEADLINE_CHARS ? `${line.slice(0, HEADLINE_CHARS)}…` : line;
};

const headlineOf = (held, kind) => {
  if (!held) return null;
  const fields = held.record.fields;
  const said = fields[HEADLINE[kind]] ?? fields["None found"] ?? Object.values(fields)[0];
  return { at: String(held.at ?? "").slice(0, 16), said: oneLine(said) };
};

const markedCriteria = (view) =>
  view.criteria.map((one) => {
    const held = view.verdicts.get(one.number);
    return {
      number: one.number,
      text: one.text,
      mark: held ? MARK[held.record.fields.Verdict] ?? `? ${held.record.fields.Verdict ?? "unreadable"}` : NONE,
      ...(held ? { commit: held.record.fields.Commit } : {}),
    };
  });

/* Every edge, with the kind the tracker gave it and whether it holds this status back read by the
   entry check's own predicate, so the brief cannot say of an edge other than what that check did. */
const blockersOf = (view) =>
  (view.issue.relations?.blockedBy ?? []).map((one) => ({
    ref: one.otherDisplayId,
    status: one.otherStatus,
    kind: one.kind,
    gates: holdsBack(one),
    satisfied: atLeast(one.otherStatus, "developed"),
  }));

const leaseIn = (view) => {
  const held = leaseOf(view.issue?.[FIELD]);
  if (!held) return null;
  const { history, ...rest } = held;
  return { ...rest, state: stateOf(held, sessionHeld()), claims: history.length };
};

/* A side status with no park record makes `targetOf` refuse, and a brief that died on that would be
   useless exactly where it is needed most: the refusal becomes the owed line instead. */
const owedIn = (view, ref) => {
  try {
    const { next, missing, resumed } = targetOf(view, ref);
    return { next, missing, resumed };
  } catch (error) {
    if (error instanceof Refused) return { next: null, missing: [], refused: error.message };
    throw error;
  }
};

const commentsRead = (view) =>
  view.comments.map((one) => ({
    at: String(one.createdAt ?? "").slice(0, 16),
    kind: one.body && /forge-record: ([a-z]+)/u.exec(unwrap(one.body))?.[1],
  }));

export const briefOf = (view, ref) => {
  const status = view.issue.status;
  const method = methodOf(status);
  const held = leaseIn(view);
  return {
    ref,
    documentId: view.documentId,
    status,
    ...(method ?? {}),
    plan: unwrap(view.issue.plan) || null,
    criteria: markedCriteria(view),
    latest: Object.fromEntries(
      LATEST
        .map((kind) => [kind, headlineOf(view.latest[kind], kind)])
        .filter(([, one]) => one),
    ),
    next: held?.next ?? null,
    worklog: worklogOf(view.issue?.[FIELD]),
    lease: held,
    /* The park the route resumes from, chosen the way the route chooses it: the newest park may
       land in another side status, and a brief showing that one would disagree with its own owed. */
    park: SIDE.includes(status) ? headlineOf(parkRecord(view, (one) => PARK_STATUS[one] === status), "park") : null,
    blockers: blockersOf(view),
    /* The one fact that says this has happened before, and the tracker keeps it as a field rather
       than a record, so nothing on the record would show it. */
    reopens: view.issue.reopenCount ?? 0,
    owed: owedIn(view, ref),
    ahead: lookAhead(view, ref),
    comments: commentsRead(view),
    whole: view.whole,
  };
};
