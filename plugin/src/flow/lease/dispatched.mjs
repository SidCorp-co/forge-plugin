/* The lease a dispatched run may take from the session that dispatched it, and the sentences that say
   which of the four conditions refused a claim that could not. docs/cli/the-dispatched-take.md. */
import { ASKED, INHERITED, INHERITED_MEANS, OWN_ID, WORKTREE, sessionOf, sessionSourced } from "../../resolve/config.mjs";
import { gitEntryAt } from "../../git/checkout-at.mjs";
import { RUN_ID, RUN_ID_VAR, besideGit, runIdAt, runNames, runsFor } from "../../resolve/session/run-id.mjs";
import { TAKEABLE } from "../../rank/weights.mjs";
import { UNKNOWN, pidOf, placeOf } from "./holder.mjs";
import { READ_THE_STATE, landingOf, landingTurn } from "../landing/checkpoint.mjs";
import { describe, leaseOf } from "../lease.mjs";

/* Said, not refused: `stateOf` reads an inherited holder as this run's own. docs/cli/claim.md. */
export const SHARED_HOLDER =
  `That holder id is ${INHERITED_MEANS}. A lease matching it is no proof another run is not on this `
  + `issue. ${OWN_ID}`;

export const sharedHolder = (lease, held = sessionSourced()) =>
  held.source === INHERITED && lease?.holder === held.id;

/* Whether the holder is provably the session that dispatched this call: written from this call's own host process on this call's own host, and under an id that names no run. Every agent a session dispatches runs inside that session's process, so the only holder there that is no run is the session that sent them — and it sent this one, an id naming the issue being minted only by a dispatch to it (ISS-2205). */
const hostedHere = (lease) => pidOf() !== UNKNOWN && lease?.pid === pidOf()
  && Boolean(placeOf()) && lease?.place === placeOf();

const dispatcherHere = (lease) => hostedHere(lease) && runsFor(lease?.holder).length === 0;

const atDispatch = (status) => TAKEABLE.includes(String(status));

/* The one live lease a claim may take, and the fact that licenses it is the caller's own id rather than any judgement about the holder: a run standing in the tree cut for this issue IS the run the issue was dispatched to, and the id ISS-467 gave that tree already names which issue. Until this, a dispatcher's own lease over a triage write was waited out by the runner it had just dispatched — fifteen minutes of a 25-minute lease when this was filed, forty-five of the hour a default one runs now (ISS-1091). Three conditions keep it to the dispatch, each one a case where a live lease is work rather than a hold: the checkpoint governs wherever its state names a turn, so a landing's turns stay `--take`'s alone; past the statuses a run is first dispatched at, the holder has to be this call's own dispatcher by `dispatcherHere`, since a resume is dispatched there too and any other holder there is a run at work; and a holder cut for this same issue is the run the dispatch already reached. */
export const handedOn = (key, context, status, holder = sessionOf()) => {
  if (!runNames(holder, key)) return false;
  if (!atDispatch(status) && !dispatcherHere(leaseOf(context))) return false;
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

/** The rung a verdict is written from and the rung it earns: where a claim meeting a live lease is
 *  likelier a judge's than a builder's. Spelled here rather than read off `ORDER` in earned.mjs,
 *  whose imports every hook loading the lease would pay for; a case holds the two to one order. */
export const JUDGING_AT = ["developed", "testing"];

const OWN_SOURCES = [ASKED, WORKTREE];

/* A judge takes no lease: its verdict is the one record written past another run's (judged.mjs), so
   the route that answers it is that write, read first through the owed rehearsal rather than sent
   blind. Its id has to be one it set, so an inherited or saved one is given the prefix. */
const judgeRoute = (ref, holder, held) => {
  const own = held.id === holder && OWN_SOURCES.includes(held.source);
  return ` Where this call is a judge's, it claims no lease: a verdict goes up past this one under an `
    + `id the caller set for itself, leaving the lease as it stands, and the owed read says first `
    + `whether it will be written:\n  ${own ? "" : `${RUN_ID_VAR}=<an id of its own> `}forge advance ${ref} --owed\n`;
};

const processSaid = (pid) => (pid === UNKNOWN ? "no process" : `pid ${pid}`);

/* Which half of `dispatcherHere` the holder fails, since each has its own reading: a process that is not this call's, and an id that is a run's. */
const notDispatcherSaid = (lease) => {
  if (!hostedHere(lease)) {
    return lease?.pid === pidOf() && pidOf() !== UNKNOWN
      ? `the lease records ${processSaid(lease.pid)} on another host than this call's`
      : `the lease records ${processSaid(lease?.pid ?? UNKNOWN)} and this call runs under ${processSaid(pidOf())}`;
  }
  return `its holder ${lease.holder} is the run dispatched to ${upper(runsFor(lease.holder))}`;
};

const pastSaid = (ref, status, lease) =>
  `${ref} is at \`${status}\`, past the statuses a run is dispatched at, so a live lease here is `
  + `handed over only by the session that dispatched this call — one writing from this call's own `
  + `host process and naming no run — and is otherwise a run at work. This one is not that `
  + `session: ${notDispatcherSaid(lease)}.`;

const giveBackRoute = (ref) => ` Where that holder did dispatch this run and is done with the issue, `
  + `it hands the lease over from its own session:\n  forge claim ${ref} --give-back\n`;

/* One sentence per condition above, because four of them refuse here and a single way out sends three of the four back to the refusal they have just read. Past the dispatch statuses the holder is asked before the id: where it is not this call's dispatcher no id takes the lease, so a sentence about the tree an id comes from would send the caller to a route that cannot work (ISS-2205), and at the judging rungs no sentence sends the caller to a tree, a judge being told not to hold one (ISS-1798). */
export const notHandedHere = (ref, key, context, status, holder = sessionOf(), at = process.cwd(), held = sessionSourced()) => {
  const named = String(key).trim().toLowerCase();
  const judging = JUDGING_AT.includes(String(status)) ? judgeRoute(ref, holder, held) : "";
  if (!atDispatch(status) && !dispatcherHere(leaseOf(context))) {
    return pastSaid(ref, status, leaseOf(context))
      + (runNames(holder, named) ? giveBackRoute(ref) : "") + judging;
  }
  if (!runNames(holder, named) && judging) return whoseId(ref, holder) + judging.trimStart();
  if (!runNames(holder, named)) {
    const asked = held.id === holder && held.source === ASKED
      ? ` ${RUN_ID_VAR} is what this call resolved and it outranks any tree, so unset it too.` : "";
    return whoseId(ref, holder) + whatTheTreeSays(ref, named, at, asked);
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
