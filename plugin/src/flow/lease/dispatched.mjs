/* The lease a dispatched run may take from the session that dispatched it, and the sentences that say
   which of the four conditions refused a claim that could not. docs/cli/the-dispatched-take.md. */
import { ASKED, INHERITED, INHERITED_MEANS, OWN_ID, WORKTREE, sessionOf, sessionSourced } from "../../resolve/config.mjs";
import { gitEntryAt } from "../../git/checkout-at.mjs";
import { RUN_ID, RUN_ID_VAR, besideGit, runIdAt, runNames, runsFor } from "../../resolve/session/run-id.mjs";
import { TAKEABLE } from "../../rank/weights.mjs";
import { UNKNOWN, pidOf, treeFate, workIn, workUnder, writtenHere } from "./holder.mjs";
import { rowLines } from "./working.mjs";
import { READ_THE_STATE, landingOf, landingTurn } from "../landing/checkpoint.mjs";
import { STOPPED, describe, leaseOf } from "../lease.mjs";

/* Said, not refused: `stateOf` reads an inherited holder as this run's own. docs/cli/claim.md. */
export const SHARED_HOLDER =
  `That holder id is ${INHERITED_MEANS}. A lease matching it is no proof another run is not on this `
  + `issue. ${OWN_ID}`;

export const sharedHolder = (lease, held = sessionSourced()) =>
  held.source === INHERITED && lease?.holder === held.id;

/* Whether the holder is provably the session that dispatched this call: written from this call's own host process on this call's own host, and under an id that names no run. Every agent a session dispatches runs inside that session's process, so the only holder there that is no run is the session that sent them — and it sent this one, an id naming the issue being minted only by a dispatch to it (ISS-2205). */
const dispatcherHere = (lease) => writtenHere(lease) && runsFor(lease?.holder).length === 0;

const atDispatch = (status) => TAKEABLE.includes(String(status));

/* Past the statuses a run is first dispatched at, with a holder that is not this call's own dispatcher: the one condition both the take and its refusal read. */
const pastDispatch = (context, status) => !atDispatch(status) && !dispatcherHere(leaseOf(context));

/* What a holder cut for this same issue left behind, read only where `writtenHere` holds: that process is every agent of one session, so it says nothing about the run and the tree has to (ISS-3254). Asked only of a caller whose id is the one its own tree mints, since a caller standing in the holder's tree is the second agent of one tree ISS-1872 reads and not a later dispatch. A tree re-minted for this caller is the dispatcher's own act ending the run before, and is still read for declared work, as an idle tree is; work found or no reading leaves the take to the caller's assertion. */
const TREE_FATES = {
  gone: "whose tree is no longer a checkout",
  reminted: "whose tree has since been minted for this run, with no declared work standing in it",
  held: "whose tree holds nothing this project calls a run's own work",
};

const fateOf = (lease, holder, at) => {
  const fate = treeFate(lease, holder);
  if (fate === "gone") return { fate };
  if (fate === "reminted") return { fate, work: workIn(lease.tree) };
  if (fate === "held") return { fate, work: workUnder(lease, at) };
  return { fate: null };
};

/* Why a holder that is an earlier run dispatched to this issue is read as finished, or null where the holder is no such run or nothing here says so. */
const earlierFinished = (key, lease, holder, { asserted, at }) => {
  if (!runNames(lease?.holder, key) || !writtenHere(lease)) return null;
  if (lease.holder === holder || runIdAt(at) !== holder) return null;
  if (asserted) return "which you have established finished";
  const { fate, work } = fateOf(lease, holder, at);
  if (fate === "gone") return TREE_FATES.gone;
  return fate && Array.isArray(work) && work.length === 0 ? TREE_FATES[fate] : null;
};

/* The one live lease a claim may take, and the fact that licenses it is the caller's own id rather than any judgement about the holder: a run standing in the tree cut for this issue IS the run the issue was dispatched to, and the id ISS-467 gave that tree already names which issue. Until this, a dispatcher's own lease over a triage write was waited out by the runner it had just dispatched — fifteen minutes of a 25-minute lease when this was filed, forty-five of the hour a default one runs now (ISS-1091). Three conditions keep it to the dispatch, each one a case where a live lease is work rather than a hold: the checkpoint governs wherever its state names a turn, so a landing's turns stay `--take`'s alone; a holder cut for this same issue is taken only where `earlierFinished` reads it as a run before this one, whatever the status; and past the statuses a run is first dispatched at, any other holder has to be this call's own dispatcher by `dispatcherHere`, since a resume is dispatched there too and any other holder there is a run at work. */
/** Whether the claim is handed the lease: `false`, `true`, or — where the holder was an earlier run on
 *  this issue — the reason it was read as finished, so the sentence printed after the write is the
 *  reading that licensed it and not a second one. */
export const handedOn = (key, context, status, holder = sessionOf(), { asserted = false, at = process.cwd() } = {}) => {
  if (!runNames(holder, key)) return false;
  if (landingTurn(landingOf(context))) return false;
  const lease = leaseOf(context);
  if (runNames(lease?.holder, key)) return earlierFinished(key, lease, holder, { asserted, at }) ?? false;
  return !pastDispatch(context, status);
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
  if (!writtenHere(lease)) {
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
  const lease = leaseOf(context);
  if (runNames(holder, named) && runNames(lease?.holder, named) && !landingTurn(landingOf(context))) {
    return earlierSaid(ref, lease, holder, at) + judging;
  }
  if (pastDispatch(context, status)) {
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
  return anotherRun(ref);
};

const anotherRun = (ref) => `That holder is another run dispatched to ${ref}, so the issue is already `
  + `with a run it was handed to and the lease is doing work.`;

/* Which reading of the tree left the run before this one unproven, since each names its own state. */
const treeSaid = (lease, holder, at) => {
  const { fate, work } = fateOf(lease, holder, at);
  if (!lease.tree) return "the lease records no tree for it";
  if (!fate) {
    return `${lease.tree}, the tree it records, now mints ${runIdAt(lease.tree) ?? "no id"}, which is neither `
      + "that run's nor this one's";
  }
  if (!work) return `${lease.tree}, the tree it records, could not be read for work standing in it`;
  return [`${work.length} process(es) running what this project declares a run's own work stand in `
    + `${lease.tree}, the tree it records:`, ...rowLines(work)].join("\n");
};

/* A holder cut for this same issue that `earlierFinished` could not read as finished, said by the condition that failed: another process is a run at work, an id its own tree does not mint is no later dispatch, and a tree that reads neither way is the caller's to settle (ISS-3254). */
const earlierSaid = (ref, lease, holder, at) => {
  if (!writtenHere(lease)) return anotherRun(ref);
  if (runIdAt(at) !== holder) {
    return `That holder is a run dispatched to ${ref} from this call's own host process, and this call `
      + `holds ${holder} while the tree it stands in mints ${runIdAt(at) ?? "no id"}, so nothing here `
      + `tells a later dispatch from a second run beside that one. Make the call from the tree minted `
      + `for this run, with ${RUN_ID_VAR} unset or naming the same id.`;
  }
  return `That holder is an earlier run dispatched to ${ref}, written from this call's own host process `
    + `— the process every agent of one session shares, so it says nothing about whether that run is `
    + `still working — and ${treeSaid(lease, holder, at)}.\nWhere the session that dispatched this run `
    + `has seen that one finish, say so:\n  forge claim ${ref} ${STOPPED}\n`;
};

export const handedSaid = (ref, lease, earlier = null) => (earlier
  ? `The lease on ${ref} was live and ${describe(lease)} held it. That holder was an earlier run `
    + `dispatched to ${ref}, ${earlier}, so the claim took it rather than waiting the lease out.`
  : `The lease on ${ref} was live and ${describe(lease)} held it. This run is the one ${ref} was `
    + `dispatched to, so the claim took it rather than waiting the lease out.`);
