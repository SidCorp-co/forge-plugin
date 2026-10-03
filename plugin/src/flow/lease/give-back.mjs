/* The run holding a lease hands it back by name. The write is the release a write that took its own
   lease, a park and a judge's hand-back already spend; what this adds is the typed route to it, and
   the refusal that stops `--stopped` from renewing in its place. docs/cli/the-short-lease.md. */
import { fail } from "../../resolve/settings.mjs";
import { KEY as WORKLOG, saidWritten, worklogFor } from "../worklog.mjs";
import { HOLDING, KEY, STOPPED, describe, releasedWrite, writeRefusal, writeRelease } from "../lease.mjs";

export const GIVE_BACK = "--give-back";

/* Every other flag asks for the lease to be held, taken or handed on by a route of its own, so a
   give-back beside one would drop it; the worklog captures and the line are what the next run reads,
   and ride the release. */
/** The flags each naming one turn's own move, of which a claim takes one at most. */
export const TURNS = ["ready", "take", "judged", "reconciled", "recorded", "landed", "rebuilt"];

const KEEPING = ["minutes", "unheld", "stopped", ...TURNS];

export const giveBackBeside = (ref, given) => {
  const beside = KEEPING
    .filter((key) => given[key] !== undefined && given[key] !== false)
    .map((key) => `--${key}`);
  if (!beside.length) return null;
  return `claim ${GIVE_BACK} hands this run's lease back, and ${beside.join(" and ")} asks for the `
    + "lease to be kept, taken or handed on by a route of its own, so the two are not typed together. "
    + `To give it back:\n  forge claim ${ref} ${GIVE_BACK}`;
};

/* A lease the caller does not hold is never given back by it: the release would free whatever run
   does hold it. Nothing held is said as such, the claim being the only thing left to type. */
const notHeldRefusal = (ref, state, lease) => (state === "free"
  ? `${ref} carries no lease, so this run has nothing to give back. Nothing holds the issue:\n`
    + `  forge claim ${ref}`
  : `${GIVE_BACK} hands back only the caller's own lease, and this one is not: ${writeRefusal(state, ref, lease)}`);

/* Refused where it would only renew: the flag says the run the lease names stopped, and from that
   run with no declared work under the lease there is nothing for it to settle. Where work stands it
   is the assertion `workingRefusal` asks for, and passes. */
export const stoppedHeldRefusal = (ref, lease) =>
  `${ref} is held by this run: ${describe(lease)}. ${STOPPED} says the run the lease names stopped, `
  + "and this call is that run with no declared work standing under the lease, so the flag settles "
  + `nothing and would only renew it. To hand the lease back:\n  forge claim ${ref} ${GIVE_BACK}\n`
  + `To keep it, claim with no flag:\n  forge claim ${ref}`;

/** The released field, with the capture and the line this call carries, written in one write
 *  conditional on the context it was built from. Returns the value written. */
export const giveBack = async (documentId, ref, context, { state, lease, line, patch }) => {
  if (!HOLDING.includes(state)) fail(notHeldRefusal(ref, state, lease));
  const value = releasedWrite(context);
  const worklog = worklogFor(context, patch);
  if (worklog) value[WORKLOG] = worklog;
  if (line !== undefined) value[KEY].next = line;
  await writeRelease(documentId, value, ref, () => context);
  saidWritten(patch);
  console.log(`${ref} is free again: this run gave back the lease it held, so nothing holds the `
    + "issue and the run after it claims with no wait.");
  if (value[KEY].next) console.log(`Next: ${value[KEY].next}`);
  return value;
};
