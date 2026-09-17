/* The count that says a status rather than a run is where the work dies, read off the claim history the lease carries, and the one line a park's evidence field has room for. docs/cli/claim.md. */
import { RECLAIM, stamp } from "../lease.mjs";

export const RECLAIMS_BEFORE_PARK = 2;

/* Crashed is not failed: the third reclaim of one status says the status is where runs die, and it is read from the history the claim wrote, so a park whose later writes never landed is still owed. Counted since the park that answered them, because a resumed issue does not walk straight back in — and a park written before the newest of those reclaims answered an earlier crash, so calling it this one's would swallow the park now owed. */
const since = (history, status) => {
  const parked = history.findLastIndex((one) => one?.how === "parked" && one?.status === status);
  return parked < 0 ? history : history.slice(parked + 1);
};

export const reclaimsOf = (lease, status) =>
  since(lease?.history ?? [], status).filter((one) => one?.how === RECLAIM && one?.status === status).length;

export const parksAsCrashed = (lease, status) => reclaimsOf(lease, status) > RECLAIMS_BEFORE_PARK;

const lastReclaimAt = (lease, status) =>
  since(lease?.history ?? [], status)
    .filter((one) => one?.how === RECLAIM && one?.status === status)
    .reduce((newest, one) => (String(one.at) > newest ? String(one.at) : newest), "");

export const parkAnswers = (lease, status, parkedAt) =>
  parksAsCrashed(lease, status) && lastReclaimAt(lease, status) <= String(parkedAt ?? "");

/* One line, because the park's reason carries it and that field takes no history; the run a row displaced is named where the row holds one, which is the take a write made and no other, that being the one pickup whose caller was shown no refusal naming whom it went over. */
export const historyLine = (lease, status) =>
  (lease?.history ?? [])
    .filter((one) => !status || one?.status === status)
    .map((one) => `${one.how} by ${one.holder}${one.from ? ` over ${one.from}, whose lease ran out at ${one.ranOut}` : ""}`
      + ` at ${stamp(Date.parse(one.at ?? ""))}`)
    .join(" | ");
