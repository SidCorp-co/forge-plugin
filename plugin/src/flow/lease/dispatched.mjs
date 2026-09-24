/* The lease a dispatched run may take from the session that dispatched it, and the sentences that say
   which of the four conditions refused a claim that could not. docs/cli/the-short-lease.md. */
import { ASKED, INHERITED, INHERITED_MEANS, OWN_ID, sessionOf, sessionSourced } from "../../resolve/config.mjs";
import { gitEntryAt } from "../../git/checkout-at.mjs";
import { RUN_ID, RUN_ID_VAR, besideGit, runIdAt, runNames, runsFor } from "../../resolve/session/run-id.mjs";
import { TAKEABLE } from "../../rank/weights.mjs";
import { READ_THE_STATE, landingOf, landingTurn } from "../landing/checkpoint.mjs";
import { describe, leaseOf } from "../lease.mjs";

/* Said, not refused: `stateOf` reads an inherited holder as this run's own. docs/cli/claim.md. */
export const SHARED_HOLDER =
  `That holder id is ${INHERITED_MEANS}. A lease matching it is no proof another run is not on this `
  + `issue. ${OWN_ID}`;

export const sharedHolder = (lease, held = sessionSourced()) =>
  held.source === INHERITED && lease?.holder === held.id;

/* The one live lease a claim may take, and the fact that licenses it is the caller's own id rather than any judgement about the holder: a run standing in the tree cut for this issue IS the run the issue was dispatched to, and the id ISS-467 gave that tree already names which issue. Until this, a dispatcher's own lease over a triage write was waited out by the runner it had just dispatched — fifteen minutes of a 25-minute lease when this was filed, forty-five of the hour a default one runs now (ISS-1091). Three conditions keep it to the dispatch, each one a case where a live lease is work rather than a hold: the checkpoint governs wherever its state names a turn, so a landing's turns stay `--take`'s alone; the take reaches only the statuses a run is dispatched at, so a lease past them is a run at work; and a holder cut for this same issue is the run the dispatch already reached. */
export const handedOn = (key, context, status, holder = sessionOf()) => {
  if (!runNames(holder, key)) return false;
  if (!TAKEABLE.includes(String(status))) return false;
  if (landingTurn(landingOf(context))) return false;
  return !runNames(leaseOf(context)?.holder, key);
};

/* What is wrong with the caller's id, said apart from what the tree carries, because the two have different ways out: an id that names no issue at all, and one minted for other issues, read as a dispatcher that declared wrongly when a single sentence answered both (ISS-1682). */
const MINTED_FORM = "`iss-<n>[+<n>...]-<8 hex>`";

const upper = (keys) => keys.map((one) => one.toUpperCase()).join(", ");

const whoseId = (ref, holder) => {
  const named = runsFor(holder);
  return named.length
    ? `This call holds ${holder}, the id of the run dispatched to ${upper(named)}, and not to ${ref}. `
    : `This call holds ${holder}, which names no issue at all: only an id minted as ${MINTED_FORM} names the `
      + `issues its run was dispatched to. `;
};

/* A tree is outranked by the variable, so a route naming only the tree sends this caller back to the refusal it has just read — whether it is standing in that tree already or has still to move to it. The tree named is the one cut for the run and not one cut for the issue, a batch being one tree under one id: a member past the head has no tree of its own, and a sentence naming one would name a path nothing will ever cut (ISS-1295). A tree carrying no id at all is given one by the brief its dispatch sends, which is the route an outside dispatcher has (ISS-1682). */
const whatTheTreeSays = (ref, key, at, asked) => {
  const inTree = runIdAt(at);
  if (runNames(inTree, key)) {
    return `The tree it stands in does name one, in ${besideGit(at, RUN_ID)}, and ${RUN_ID_VAR} is `
      + `outranking it. Unset that variable and send this again.`;
  }
  const root = gitEntryAt(at)?.tree;
  if (!inTree && root) {
    return `The tree it stands in carries no ${RUN_ID} beside its git directory. Where this is the run ${ref} `
      + `was dispatched to, the dispatch's brief writes one naming it, and every call made from that tree `
      + `then holds it: \`forge brief ${key.toUpperCase()} --tree ${root}\`.${asked}`;
  }
  const there = inTree
    ? ` The tree it stands in holds ${inTree}, which names ${upper(runsFor(inTree)) || "no issue"}.`
    : ` A tree carrying no ${RUN_ID} is given one by the dispatch's brief: \`forge brief ${key.toUpperCase()} --tree <that tree>\`.`;
  return `Where this is the run ${ref} was dispatched to, make the call from the tree cut for that `
    + `run: the ${RUN_ID} beside its git directory names every issue the run was dispatched `
    + `to, and a lease its dispatcher is only holding is the dispatched run's to take.${there}${asked}`;
};

/* One sentence per condition above, because four of them refuse here and a single way out sends three of the four back to the refusal they have just read. */
export const notHandedHere = (ref, key, context, status, holder = sessionOf(), at = process.cwd(), held = sessionSourced()) => {
  const named = String(key).trim().toLowerCase();
  if (!runNames(holder, named)) {
    const asked = held.id === holder && held.source === ASKED
      ? ` ${RUN_ID_VAR} is what this call resolved and it outranks any tree, so unset it too.` : "";
    return whoseId(ref, holder) + whatTheTreeSays(ref, named, at, asked);
  }
  if (!TAKEABLE.includes(String(status))) {
    return `This call's id names ${ref} and the issue is at \`${status}\`, past the statuses a run `
      + `is dispatched at, so a live lease here is a run at work and not a dispatcher holding one.`;
  }
  const turn = landingTurn(landingOf(context));
  if (turn) {
    return `A landing checkpoint on ${ref} names the ${turn}'s turn, and a turn changes hands `
      + `through the checkpoint and not through a claim. ${READ_THE_STATE(ref)}`;
  }
  return `That holder is another run dispatched to ${ref}, so the issue is already with a run it `
    + `was handed to and the lease is doing work.`;
};

export const handedSaid = (ref, lease) =>
  `The lease on ${ref} was live and ${describe(lease)} held it. This run is the one ${ref} was `
  + `dispatched to, so the claim took it rather than waiting the lease out.`;
