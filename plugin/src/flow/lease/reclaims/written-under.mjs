/* Whether a payload landed under a lease: the mark a lease carries once one did, and the leases this
   process owes it. A leaf, so `../../lease.mjs` can owe a mark and `./mark.mjs` can write one without
   either importing the other's caller (ISS-2531). */

/** The mark on a lease, and on the row a reclaim over that lease keeps: `crash-park.mjs` reads the row's. */
export const WROTE = "wrote";

/** A lease a payload write renewed and found unmarked, by document id with its ref, owed its mark once
 *  the call completes: `renew` runs before the payload write, so only the call's end knows the record
 *  landed. */
export const OWED = new Map();

/** The leases owed a mark, handed over once and forgotten here. */
export const marksOwed = () => {
  const owed = [...OWED.entries()];
  OWED.clear();
  return owed;
};
