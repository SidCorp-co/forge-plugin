/* The count that says a status rather than a run is where the work dies, read off the claim history
   the lease carries, and the one line a park's evidence field has room for. docs/cli/claim.md. */
import { RECLAIM, stamp } from "../lease.mjs";

export const RECLAIMS_BEFORE_PARK = 2;

/* Counted since the park that answered them: a resumed issue does not walk straight back in. */
const since = (history, status) => {
  const parked = history.findLastIndex((one) => one?.how === "parked" && one?.status === status);
  return parked < 0 ? history : history.slice(parked + 1);
};

export const reclaimsOf = (lease, status) =>
  since(lease?.history ?? [], status).filter((one) => one?.how === RECLAIM && one?.status === status).length;

/* Crashed is not failed: the third reclaim of one status says the status is where runs die. Read
   from the history the claim wrote, so a park whose later writes never landed is still owed. */
export const parksAsCrashed = (lease, status) => reclaimsOf(lease, status) > RECLAIMS_BEFORE_PARK;

const lastReclaimAt = (lease, status) =>
  since(lease?.history ?? [], status)
    .filter((one) => one?.how === RECLAIM && one?.status === status)
    .reduce((newest, one) => (String(one.at) > newest ? String(one.at) : newest), "");

/* A crashed park answers the reclaims older than it; one written before the newest of them
   answered an earlier crash, and calling it this one's would swallow the park now owed. */
export const parkAnswers = (lease, status, parkedAt) =>
  parksAsCrashed(lease, status) && lastReclaimAt(lease, status) <= String(parkedAt ?? "");

/* One line: the park's reason carries it, because its evidence field takes no history. */
export const historyLine = (lease, status) =>
  (lease?.history ?? [])
    .filter((one) => !status || one?.status === status)
    /* The displaced run where the row names one: only a take made by a write carries it, and that is the row whose caller was shown no refusal naming whom it went over. */
    .map((one) => `${one.how} by ${one.holder}${one.from ? ` over ${one.from}, whose lease ran out at ${one.ranOut}` : ""}`
      + ` at ${stamp(Date.parse(one.at ?? ""))}`)
    .join(" | ");
