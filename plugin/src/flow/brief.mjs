/* One issue's whole context assembled out of the record and the worklog, and nothing formatted:
   the printer is resume.mjs and `--json` is this object, so the screen and a tool's reading cannot
   disagree. Under earned.mjs's rule about what it may touch, for the same reason (ISS-44). */
import { sessionSourced } from "../resolve/config.mjs";
import { FIELD, leaseOf, stateOf } from "./lease.mjs";
import { sharedHolder } from "./lease/dispatched.mjs";
import { workUnder } from "./lease/holder.mjs";
import { atMinute, unwrap } from "./machine.mjs";
import { rebuiltSaid } from "./landing/reconstruction.mjs";
import { PARK_STATUS, SIDE, atLeast, holdsBack, parkRecord, rungFieldsOf, sameLanding } from "./earned.mjs";
import { methodOf } from "../guides/phases.mjs";
import { rungOf } from "../ladder.mjs";
import { lookAhead, owedIn } from "./route.mjs";

const MARK = { pass: "✓ pass", fail: "✗ fail", skipped: "· skipped", short: "≈ short" };
const NONE = "– none";
const HEADLINE_CHARS = 200;

/* The fields of each kind a reader wants on one line, in the order they are read. The whole record
   is `forge resume <ref> --report`. A correction carries two of them because what moved and why are
   one claim split over two fields, and a line carrying only the first sends a reader who wants the
   reason to the thread to look for something the record already holds (ISS-2079). */
const HEADLINE = {
  confirmation: ["is"],
  decision: ["decision"],
  correction: ["moved", "why"],
  park: ["why"],
  finding: ["seen"],
  triage: ["outcome"],
};
const LATEST = ["confirmation", "decision", "correction", "finding", "triage"];
const JOIN = " — ";

const flat = (one) => String(Array.isArray(one) ? one.join("; ") : one ?? "").replace(/\s+/gu, " ").trim();

/* An equal share of the line each, and what a short field leaves goes to the fields after it, so a
   long field cannot truncate away every field behind it. One field takes the whole share. */
const oneLine = (parts) => {
  let left = HEADLINE_CHARS - JOIN.length * (parts.length - 1);
  return parts.map((one, index) => {
    const share = Math.max(Math.floor(left / (parts.length - index)), 0);
    left -= Math.min(one.length, share);
    return one.length > share ? `${one.slice(0, share)}…` : one;
  }).join(JOIN);
};

const headlineOf = (held, kind) => {
  if (!held) return null;
  const fields = held.record.fields;
  const named = (HEADLINE[kind] ?? []).map((name) => flat(fields[name])).filter((one) => one !== "");
  const parts = named.length ? named : [flat(fields.none ?? Object.values(fields)[0])];
  return { at: atMinute(held.at), said: oneLine(parts) };
};

/* On the verdict's own row and not only on the checkpoint's line, which `rebuiltSaid` is for: a
   reader who asks for the criteria asks for verdicts and need never have read the checkpoint one
   was judged against (ISS-2045). */
const markedCriteria = (view) => {
  const rebuilt = rebuiltSaid(view.landing).replace(/^ — /u, "");
  return view.criteria.map((one) => {
    const held = view.verdicts.get(one.number);
    return {
      number: one.number,
      text: one.text,
      mark: held ? MARK[held.record.fields.verdict] ?? `? ${held.record.fields.verdict ?? "unreadable"}` : NONE,
      ...(held ? { commit: held.record.fields.commit } : {}),
      ...(held && rebuilt ? { judgedAgainst: `a checkpoint ${rebuilt}` } : {}),
    };
  });
};

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
  const mine = sessionSourced();
  const state = stateOf(held, mine.id);
  const working = workUnder(held) ?? [];
  return {
    ...rest,
    state,
    claims: history.length,
    ...(sharedHolder(held, mine) ? { holderShared: true } : {}),
    ...(working.length ? { holderWorking: working } : {}),
  };
};

const commentsRead = (view) =>
  view.comments.map((one) => ({
    at: atMinute(one.createdAt),
    kind: one.body && /forge-record: ([a-z]+)/u.exec(unwrap(one.body))?.[1],
  }));

/* Counts and not headlines: the one line above says the latest correction, and this says how many
   more there are, so a brief admits what only `--report` can show. */
const repeatedIn = (view) => Object.fromEntries(
  Object.entries(view.repeated ?? {})
    .map(([kind, held]) => [kind, held.length])
    .filter(([, held]) => held > 1),
);

export const briefOf = (view, ref) => {
  const status = view.issue.status;
  const method = methodOf(status);
  const held = leaseIn(view);
  return {
    ref,
    documentId: view.documentId,
    status,
    ...(method ?? {}),
    /* The answer and never the fields it came off, so a tool measuring against a rung reads the one the lane prints instead of a climb out of a page: the ship's ceiling took one from a verdict quoting the form (ISS-1012). */
    rung: rungOf(rungFieldsOf(view)),
    plan: unwrap(view.issue.plan) || null,
    criteria: markedCriteria(view),
    latest: Object.fromEntries(
      LATEST
        .map((kind) => [kind, headlineOf(view.latest[kind], kind)])
        .filter(([, one]) => one),
    ),
    repeated: repeatedIn(view),
    next: held?.next ?? null,
    worklog: view.work,
    lease: held,
    /* Printed here because nothing else printed it: a checkpoint naming whose turn it is was written
       by one run and readable by none. */
    landing: view.landing,
    /* The park the route resumes from, chosen the way the route chooses it: the newest park may
       land in another side status, and a brief showing that one would disagree with its own owed. */
    park: SIDE.includes(status) ? headlineOf(parkRecord(view, (one) => sameLanding(PARK_STATUS[one], status)), "park") : null,
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
