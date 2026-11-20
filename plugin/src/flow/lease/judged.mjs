/* The one record written past another run's lease: a verdict, sent by a run under an id it set for
   itself. The lease guards the writes that replace something — a field, a status, the lease itself —
   and a verdict replaces nothing, so a judge dispatched while its dispatcher holds the issue writes
   it without taking, renewing or waiting out that lease (ISS-1494). docs/cli/record.md. */
import { NO_LONGER_OWES } from "../earned/park-status.mjs";
import { ASKED, WORKTREE, sessionSourced } from "../../resolve/config.mjs";
import { thisCall } from "../../resolve/flags.mjs";
import { RUN_ID_VAR } from "../../resolve/session/run-id.mjs";
import { describe, leaseOf, stateOf, takeableFree } from "../lease.mjs";

const VERDICT = "verdict";

/* An id the caller named, in the variable or in the tree it stands in. The inherited one is the
   dispatching session's and the saved one the machine's, so a verdict under either says nothing
   about which run judged. */
const OWN = [ASKED, WORKTREE];

/* Another run's lease standing in the field: inside its duration, or past it with nothing proving
   the holder gone. A lease the record proves dead is taken by the write as any write takes one. */
const ANOTHERS = ["live", "expired"];

const standing = (context, held) => {
  const lease = leaseOf(context);
  return ANOTHERS.includes(stateOf(lease, held.id)) ? lease : null;
};

// cm:why a judge reading an issue after its landing meets an empty field past the dispatch statuses, where every other write meets `unheldRefusal` and the claim it names is one a judge may not make; a verdict replaces nothing there either, so it goes up taking no lease (ISS-118)
// cm:guard the empty field counts only where `freeRefusal` would refuse a write: where a write may take a lease for itself, a verdict still takes one and the status move it earns is made
const unheldPast = (body) => !leaseOf(body?.sessionContext)
  && !takeableFree(String(body?.status ?? ""), body?.sessionContext);

const past = (body, held) => {
  const lease = standing(body?.sessionContext, held);
  if (lease) return { lease, status: String(body?.status ?? "") };
  return unheldPast(body) ? { lease: null, status: String(body?.status ?? "") } : null;
};

const whose = (held, what = "") => `${held.id ?? "no id"}${what}${held.said ? `, read from ${held.said}` : ""}`;

/* A source's own words may end a sentence of their own (the inherited one names the fix), so the
   sentence they close takes its stop only where they did not already put one. */
const stopped = (text) => (/[.!?]$/u.test(text) ? text : `${text}.`);

const again = () => `${RUN_ID_VAR}=<an id of its own> ${thisCall() ?? "forge record verdict <ref> ..."}`;

/** What a judge's write goes past, another run's lease or an empty field (`lease` null), or null
 *  where the write is an ordinary one. Only a write of verdicts alone is a judge's: a verdict beside
 *  another kind rides that kind's lease, and meets its refusal. A verdict under an id the caller
 *  did not set is refused here rather than written under a name that proves nothing, and so is a
 *  run flag, which writes onto a lease this takes none of. The id is asked first, being the one
 *  refusal whose way out is the caller's own. */
export const judgedPast = (ref, kinds, body, { flags = [], held = sessionSourced() } = {}) => {
  if (!kinds.length || kinds.some((kind) => kind !== VERDICT)) return null;
  const at = past(body, held);
  if (!at) return null;
  const { lease, status } = at;
  if (!OWN.includes(held.source)) {
    const where = lease
      ? `${ref} is held by another run: ${describe(lease)}. A verdict is the one record written past `
        + `another run's lease`
      : `${ref} is at \`${status}\` and its lease field holds no lease. A verdict is the one record `
        + `written there without taking one`;
    return {
      refused: `${where}, and only under an id the caller set for itself, so the verdict says which run `
        + `judged. This call holds ${stopped(whose(held))} Nothing was sent. Give it an id of its own `
        + `and send this again:\n  ${again()}`,
    };
  }
  if (flags.length) {
    const why = lease ? `${ref}'s lease is another run's` : `${ref}'s lease field holds no lease at \`${status}\``;
    return {
      refused: `record verdict: ${why}, so this verdict is a judge's write and takes no lease, and `
        + `${flags.join(", ")} writes onto the lease: nothing here would act on it. Nothing was sent. `
        + `Send the verdict without it.`,
    };
  }
  return { lease, held };
};

/** Said once the verdict is up: whose lease stood, and under which id the verdict went. */
export const judgedSaid = (ref, { lease, held }) => (lease
  ? `The lease on ${ref} stands as it was, ${describe(lease)}: a verdict is the one record written `
    + `past another run's lease, and this one went up under ${whose(held)}, taking and renewing none.`
  : `${ref}'s lease field holds no lease, and still holds none: a verdict is a judge's write, and this `
    + `one went up under ${whose(held)}, taking none.`);

/** Said in place of the move a judge's record earns: the status is a write the lease covers. */
export const moveHeld = (ref, next, { lease }) => (lease
  ? `${ref}'s record now earns ${next}, and the move is the holder's, ${lease.holder}: a judge's write `
    + `moves no status. The holder takes it with:\n  forge advance ${ref}`
  : `${ref}'s record now earns ${next}, and the move is a write the lease covers, which no run holds: `
    + `a judge's write moves no status. Whoever takes the issue moves it:\n  forge claim ${ref} --unheld `
    + `&& forge advance ${ref}`);

/** What `advance --owed` tells a caller that does not hold the lease standing on the issue, before
 *  it judges anything rather than at the write that would refuse it. */
export const judgeOwed = (ref, { sessionContext, status } = {}, held = sessionSourced()) => {
  /* Nothing advances from a closed or dropped issue, so no verdict is in play and the owed read
     leads with what the issue is. */
  if (NO_LONGER_OWES.includes(status)) return null;
  const at = past({ sessionContext, status }, held);
  if (!at) return null;
  const { lease } = at;
  const owner = lease ? `${ref}'s lease is ${lease.holder}'s` : `${ref}'s lease field holds no lease`;
  if (OWN.includes(held.source)) {
    return lease
      ? `A verdict from this call is a judge's write: ${owner}, and \`forge record verdict\` posts past `
        + `it under ${held.id} without taking it. No other record from this call is written while that `
        + `lease stands.`
      : `A verdict from this call is a judge's write: ${owner}, and \`forge record verdict\` posts under `
        + `${held.id} without taking one. No other record from this call is written until the issue is claimed.`;
  }
  return `A verdict from this call would be refused: ${owner}, and this `
    + `call holds ${stopped(whose(held, ", an id it did not set for itself"))} Set one before judging:\n  `
    + `${RUN_ID_VAR}=<an id of its own> forge advance ${ref} --owed`;
};
