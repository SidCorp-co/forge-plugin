/* The mark a lease takes once a payload landed under it, written as the call that wrote the payload
   ends, so a reclaim over that lease is not counted as a run that died at its status (ISS-2531).
   docs/cli/the-dead-holder.md. */
import { HOLDING, KEY, leaseOf, readContext, setLease, stateOf } from "../../lease.mjs";
import { sessionOf } from "../../../resolve/config.mjs";
import { refuse } from "../../../refusal.mjs";
import { WROTE, marksOwed } from "./written-under.mjs";

/** Spent where the call has completed and before the lease is given back, read back first: a lease
 *  another run now holds, or one already marked, is left alone, and a mark that cannot be written is
 *  said and costs the call nothing, its payload having landed. A write that took its lease for itself
 *  owes none, that lease being given back as the call ends. */
export const markOwed = async (say = console.error) => {
  for (const [documentId, ref] of marksOwed()) {
    try {
      const context = await readContext(documentId, true);
      if (context?.refused) {
        say(`${ref}'s lease was not marked as written under: the field did not read back. ${context.refused}`);
        continue;
      }
      const held = context?.[KEY];
      if (!HOLDING.includes(stateOf(leaseOf(context), sessionOf())) || held?.[WROTE] === true) continue;
      await setLease(documentId, { ...context, [KEY]: { ...held, [WROTE]: true } }, ref, () => context,
        { refuse, settling: true });
    } catch (error) {
      say(`${ref}'s lease was not marked as written under, so a reclaim over it counts: ${error?.message ?? error}`);
    }
  }
};
