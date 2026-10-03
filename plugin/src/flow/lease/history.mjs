/* A lease's claim history, read by every reader the same way. A leaf on purpose: the landing's
   reconstruction reaches neither git nor the tracker, and `../lease.mjs` reaches both. */

/** The claim history as a list, off a lease `leaseOf` read or off the raw field, which a release
 *  leaves `leaseOf` answering `null` for while its rows still stand. */
export const historyOf = (lease) => (Array.isArray(lease?.history) ? lease.history : []);
