/* The count of reclaims at one status, read off the claim history the lease carries, and the one line that history takes when a claim prints it. docs/cli/claim.md. */
import { RECLAIM, declaresNothingWorked, stamp } from "../lease.mjs";

/* Past this many, a claim names the park to its caller. It never writes one: the caller is the one process that knows whether it is alive, and a count cannot tell a retried dispatch, a reading lease or a job that never started from a run that died (ISS-693). */
export const RECLAIMS_BEFORE_PARK = 2;

/* A reclaim's row keeps the line of the lease it went over, so one whose line declared nothing was worked is a reading that lapsed rather than a run that died, and is left out (ISS-1537). */
const reading = (one) => one?.how === RECLAIM && declaresNothingWorked(one?.next);

/* The row before a reclaim is the take of the run that reclaim went over, a holder retaking its own lapsed lease appending none. Where the status or the landing state differ between the two, the issue moved on in between — every hand-over the independent-judgement route makes moves one of them — and the reclaim is left out. It reads progress and claims nothing about survival: a run that moved the issue and then died lost the issue and not the work, and what the count names is a status where runs stop without moving anything (ISS-2267). */
const movedOn = (one, prior) => one?.how === RECLAIM && !reading(one) && Boolean(prior)
  && (String(prior?.status ?? "") !== String(one?.status ?? "") || String(prior?.landing ?? "") !== String(one?.landing ?? ""));

/* Each row beside the one before it, read off the whole history before any status filter, since the row a reclaim is measured against may stand at another status. */
const rowsOf = (lease) => {
  const history = Array.isArray(lease?.history) ? lease.history : [];
  return history.map((one, at) => ({ one, prior: at ? history[at - 1] : null }));
};

const reclaimsAt = (lease, status) =>
  rowsOf(lease).filter(({ one }) => one?.how === RECLAIM && one?.status === status);

const counted = ({ one, prior }) => !reading(one) && !movedOn(one, prior);

export const reclaimsOf = (lease, status) => reclaimsAt(lease, status).filter(counted).length;

/** The reclaims the count left out as readings, so the line that names the count can say how many it did not. */
export const readingsOf = (lease, status) => reclaimsAt(lease, status).filter(({ one }) => reading(one)).length;

/** The reclaims the count left out as taken after the issue moved on, said beside the readings. */
export const movedOf = (lease, status) => reclaimsAt(lease, status).filter(({ one, prior }) => movedOn(one, prior)).length;

const newest = (lease) => rowsOf(lease).at(-1) ?? { one: null, prior: null };

/** The newest row is the claim just made where one was, so these two say which kind of uncounted reclaim it was. */
export const tookReading = (lease) => reading(newest(lease).one);

export const tookMoved = (lease) => {
  const { one, prior } = newest(lease);
  return movedOn(one, prior);
};

/** The run the latest counted reclaim at a status went over and the line it left, both off that one row, so a pickup newer than it that the count left out is never the run named. */
export const overWhom = (lease, status) => {
  const last = reclaimsAt(lease, status).filter(counted).at(-1);
  if (!last) return null;
  const holder = last.one.from ?? last.prior?.holder ?? null;
  return holder ? { holder: String(holder), next: typeof last.one.next === "string" && last.one.next ? last.one.next : null } : null;
};

const leftOut = (one, prior) => {
  if (reading(one)) return ", over a lease that declared nothing was worked, so not counted";
  return movedOn(one, prior) ? ", after the issue moved on from where the run before took it, so not counted" : "";
};

/* One line, printed under the reclaim count once the threshold is passed; the run a row displaced is named where the row holds one, which is the take a write made and no other, that being the one pickup whose caller was shown no refusal naming whom it went over. */
export const historyLine = (lease, status) =>
  rowsOf(lease)
    .filter(({ one }) => !status || one?.status === status)
    .map(({ one, prior }) => `${one.how} by ${one.holder}${one.from ? ` over ${one.from}, whose lease ran out at ${one.ranOut}` : ""}`
      + ` at ${stamp(Date.parse(one.at ?? ""))}`
      + leftOut(one, prior))
    .join(" | ");
