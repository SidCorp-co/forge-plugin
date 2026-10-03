/* A `--stopped` or `--unheld` a lease refusal did not read, said by name at the head of that refusal.
   Each flag settles one reading of the record, and a refusal printed exactly as the unflagged one
   reads to the caller as a flag that never arrived, which is what cost ISS-2533's run its diagnosis. */
import { STOPPED, UNHELD } from "../lease.mjs";
import { placeOf } from "./holder.mjs";

/* The half of `holderGone` the assertion cannot settle: it says no run is working, never that a
   process the lease records is not running here. */
const stillThere = (lease) => {
  if (!lease?.place || !Number.isInteger(Number(lease.pid)) || Number(lease.pid) < 1) {
    return "the lease records no process on a host this call can look at";
  }
  if (lease.place !== placeOf()) return "the lease was written on another host than this call's";
  return `pid ${lease.pid}, which the lease records as its holder's, is still running on this host`;
};

/** The sentences naming each flag `given` carries that the refusal about to be printed at `state`
 *  did not read, or the empty string. */
export const unreadSaid = (given, state, lease) => {
  const said = [];
  if (given.stopped && state === "live") {
    said.push(`${STOPPED} settles a holder this call can look for, and ${stillThere(lease)}, so `
      + "the flag was read and settles nothing here.");
  }
  if (given.unheld && state !== "free") {
    said.push(`${UNHELD} takes only an issue whose lease field holds no lease, and this one holds `
      + "one, so the flag was read and settles nothing here.");
  }
  return said.length ? `${said.join(" ")} ` : "";
};
