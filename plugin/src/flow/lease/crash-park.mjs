/* The count of reclaims at one status, read off the claim history the lease carries, and the one line that history takes when a claim prints it. docs/cli/claim.md. */
import { RECLAIM, declaresNothingWorked, stamp } from "../lease.mjs";

/* Past this many, a claim names the park to its caller. It never writes one: the caller is the one process that knows whether it is alive, and a count cannot tell a retried dispatch, a reading lease or a job that never started from a run that died (ISS-693). */
export const RECLAIMS_BEFORE_PARK = 2;

/* A reclaim's row keeps the line of the lease it went over, so one whose line declared nothing was worked is a reading that lapsed rather than a run that died, and is left out (ISS-1537). */
const reading = (one) => one?.how === RECLAIM && declaresNothingWorked(one?.next);

const reclaimsAt = (lease, status) =>
  (lease?.history ?? []).filter((one) => one?.how === RECLAIM && one?.status === status);

export const reclaimsOf = (lease, status) => reclaimsAt(lease, status).filter((one) => !reading(one)).length;

/** The reclaims the count left out, so the line that names the count can say how many it did not. */
export const readingsOf = (lease, status) => reclaimsAt(lease, status).filter(reading).length;

/** Whether the newest row is such a reclaim, which is the claim just made where one was. */
export const tookReading = (lease) => reading((lease?.history ?? []).at(-1));

/* One line, so the park command a claim prints can carry it as the reason, a field that takes no history; the run a row displaced is named where the row holds one, which is the take a write made and no other, that being the one pickup whose caller was shown no refusal naming whom it went over. */
export const historyLine = (lease, status) =>
  (lease?.history ?? [])
    .filter((one) => !status || one?.status === status)
    .map((one) => `${one.how} by ${one.holder}${one.from ? ` over ${one.from}, whose lease ran out at ${one.ranOut}` : ""}`
      + ` at ${stamp(Date.parse(one.at ?? ""))}`
      + (reading(one) ? ", over a lease that declared nothing was worked, so not counted" : ""))
    .join(" | ");
