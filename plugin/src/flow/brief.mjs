/* One issue's whole context assembled out of the record and the worklog, and nothing formatted:
   the printer is resume.mjs and `--json` is this object, so the screen and a tool's reading cannot
   disagree. Under earned.mjs's rule about what it may touch, for the same reason (ISS-44). */
import { FIELD, leaseOf, sessionHeld, stateOf } from "./lease.mjs";
import { Refused, unwrap } from "./record.mjs";
import { SIDE, methodOf, targetOf } from "./earned.mjs";
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
};
const LATEST = ["confirmation", "decision", "correction"];

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

/* Every edge, with the kind the tracker gave it: a *relates* edge gates nothing and is counted as a
   blocker by the entry check today (ISS-19), so a reader of the brief can see which it is. */
const blockersOf = (view) =>
  (view.issue.relations?.blockedBy ?? []).map((one) => ({
    ref: one.otherDisplayId,
    status: one.otherStatus,
    kind: one.kind,
    gates: Boolean(one.gatesDispatch),
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
    park: SIDE.includes(status) && view.latest.park ? headlineOf(view.latest.park, "park") : null,
    blockers: blockersOf(view),
    owed: owedIn(view, ref),
    comments: commentsRead(view),
    whole: view.whole,
  };
};
