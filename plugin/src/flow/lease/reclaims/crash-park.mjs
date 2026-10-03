/* The count of reclaims at one status, read off the claim history the lease carries, and the one line that history takes when a claim prints it. docs/cli/claim.md. */
import { RECLAIM, declaresNothingWorked, stamp } from "../../lease.mjs";
import { historyOf } from "../history.mjs";

/* Past this many, a claim names the park to its caller. It never writes one: the caller is the one process that knows whether it is alive, and a count cannot tell a retried dispatch, a reading lease or a job that never started from a run that died (ISS-693). */
export const RECLAIMS_BEFORE_PARK = 2;

/* Each reason a reclaim is left out of the count, one row each, tried in this order so a reclaim is said once under the first that holds: `why` is the phrase the history line takes, `one` and `many` the verb the claim's sentences put before it. */
const LEFT_OUT = [
  /* A reclaim's row keeps the line of the lease it went over, so one whose line declared nothing was worked is a reading that lapsed rather than a run that died (ISS-1537). */
  {
    is: (one) => declaresNothingWorked(one?.next),
    why: "over a lease that declared nothing was worked", one: "went", many: "went",
  },
  /* The row before a reclaim is the take of the run that reclaim went over, a holder retaking its own lapsed lease appending none. Where the status or the landing state differ between the two, the issue moved on in between — every hand-over the independent-judgement route makes moves one of them — and the reclaim is left out. It reads progress and claims nothing about survival: a run that moved the issue and then died lost the issue and not the work, and what the count names is a status where runs stop without moving anything (ISS-2267). */
  {
    is: (one, prior) => Boolean(prior)
      && (String(prior?.status ?? "") !== String(one?.status ?? "") || String(prior?.landing ?? "") !== String(one?.landing ?? "")),
    why: "after the issue moved on from where the run before took it", one: "was taken", many: "were taken",
  },
  /* The row keeps whether the lease it went over had a payload written under it, which is progress the issue's status and landing state need not show: a judging run's verdicts hand the issue back exactly where it took it. Not whether that run then died — the same reading as a move, and the count is still where runs stop having written nothing (ISS-2531). */
  {
    is: (one) => one?.wrote === true,
    why: "over a lease whose holder wrote a record under it", one: "went", many: "went",
  },
];

const reasonOf = (one, prior) => (one?.how === RECLAIM ? LEFT_OUT.find(({ is }) => is(one, prior)) ?? null : null);

/** Why a reclaim is left out of the count, as the history line says it, or null where it is counted or is no reclaim. */
export const uncountedWhy = (one, prior) => reasonOf(one, prior)?.why ?? null;

/* Each row beside the one before it, read off the whole history before any status filter, since the row a reclaim is measured against may stand at another status. */
const rowsOf = (lease) => {
  const history = historyOf(lease);
  return history.map((one, at) => ({ one, prior: at ? history[at - 1] : null }));
};

const reclaimsAt = (lease, status) =>
  rowsOf(lease).filter(({ one }) => one?.how === RECLAIM && one?.status === status);

const counted = ({ one, prior }) => !reasonOf(one, prior);

export const reclaimsOf = (lease, status) => reclaimsAt(lease, status).filter(counted).length;

/** The reclaims at a status the count left out, by reason in the order said, a reason that left none out not listed: so the line that names the count can say how many it did not, and why. */
export const leftOutOf = (lease, status) => {
  const reasons = reclaimsAt(lease, status).map(({ one, prior }) => reasonOf(one, prior));
  return LEFT_OUT.map((reason) => ({ ...reason, count: reasons.filter((one) => one === reason).length }))
    .filter(({ count }) => count)
    .map(({ why, many, count }) => ({ why, verb: many, count }));
};

/** The reason the newest row, the claim just made where one was, is left out of the count, or null where it counts. */
export const tookWhy = (lease) => {
  const { one, prior } = rowsOf(lease).at(-1) ?? { one: null, prior: null };
  const reason = reasonOf(one, prior);
  return reason ? { why: reason.why, verb: reason.one } : null;
};

/** The run the latest counted reclaim at a status went over and the line it left, both off that one row, so a pickup newer than it that the count left out is never the run named. */
export const overWhom = (lease, status) => {
  const last = reclaimsAt(lease, status).filter(counted).at(-1);
  if (!last) return null;
  const holder = last.one.from ?? last.prior?.holder ?? null;
  return holder ? { holder: String(holder), next: typeof last.one.next === "string" && last.one.next ? last.one.next : null } : null;
};

const leftOut = (one, prior) => {
  const why = uncountedWhy(one, prior);
  return why ? `, ${why}, so not counted` : "";
};

/* One line, printed under the reclaim count once the threshold is passed; the run a row displaced is named where the row holds one, which is the take a write made and no other, that being the one pickup whose caller was shown no refusal naming whom it went over. */
export const historyLine = (lease, status) =>
  rowsOf(lease)
    .filter(({ one }) => !status || one?.status === status)
    .map(({ one, prior }) => `${one.how} by ${one.holder}${one.from ? ` over ${one.from}, whose lease ran out at ${one.ranOut}` : ""}`
      + ` at ${stamp(Date.parse(one.at ?? ""))}`
      + leftOut(one, prior))
    .join(" | ");
