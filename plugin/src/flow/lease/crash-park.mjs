/* The count of reclaims at one status, read off the claim history the lease carries, and the one line that history takes when a claim prints it. docs/cli/claim.md. */
import { RECLAIM, stamp } from "../lease.mjs";

/* Past this many, a claim names the park to its caller. It never writes one: the caller is the one process that knows whether it is alive, and a count cannot tell a retried dispatch, a reading lease or a job that never started from a run that died (ISS-693). */
export const RECLAIMS_BEFORE_PARK = 2;

export const reclaimsOf = (lease, status) =>
  (lease?.history ?? []).filter((one) => one?.how === RECLAIM && one?.status === status).length;

/* One line, so the park command a claim prints can carry it as the reason, a field that takes no history; the run a row displaced is named where the row holds one, which is the take a write made and no other, that being the one pickup whose caller was shown no refusal naming whom it went over. */
export const historyLine = (lease, status) =>
  (lease?.history ?? [])
    .filter((one) => !status || one?.status === status)
    .map((one) => `${one.how} by ${one.holder}${one.from ? ` over ${one.from}, whose lease ran out at ${one.ranOut}` : ""}`
      + ` at ${stamp(Date.parse(one.at ?? ""))}`)
    .join(" | ");
