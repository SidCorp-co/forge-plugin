/* Step 4 of land-ready, the gate over the candidate, and the question the steps around it share: whether a member's
   state may still be handed back to its builder. Its own file because the landing's is at its line limit, and because
   this is the step whose wait for a gate place is ISS-2461's and whose red set is searched (ISS-2480). */
import { stop, Stop } from "../../checkout.mjs";
import { DECLINED } from "../../gates/machine.mjs";
import { shortly } from "../install.mjs";
import { dropRoom, movedBy, roomFor } from "./candidate.mjs";
import { gateOver } from "./gated.mjs";
import { keysOf, reconciledAt, saveOn } from "./member.mjs";
import { searched } from "./search.mjs";
import { LANDING_HEAD_OWED, RECAPTURE, landingNext } from "../../../plugin/src/flow/landing/checkpoint.mjs";
import { RED_BATCHES, redBatchScope } from "../../../plugin/src/resolve/settings.mjs";

/** Whether the table leads this member's state to the builder's new head: past a judgement it does
    not, and a stop there says what it met without writing a move the save would refuse. */
export const handsBack = (member) => landingNext(member.landing, LANDING_HEAD_OWED) === null;

const [SEARCHED, ONE_BY_ONE] = RED_BATCHES;

/** A value of `redBatch` the key does not take, refused before anything is taken: read as the default,
 *  it would search a set the project meant to land one at a time. */
export const strategyRefused = () => {
  const one = redBatchScope();
  if (!one.unknown) return;
  stop(`this project's \`redBatch\` is \`${one.unknown}\`, which is no value of that key: it takes `
    + `${RED_BATCHES.join(" or ")}. Nothing was taken. Set one of them:\n    forge doctor --set redBatch=${SEARCHED}`);
};

/** The gate runs a set may spend, said before the first of them: one where the candidate is green,
 *  and the configured strategy's where it is red. */
export const boundSaid = (members, base) => (redBatchScope().value === ONE_BY_ONE
  ? `  ${members + 1} gate run(s) at most: one for the candidate, and one for each branch where it is red `
    + `and they are landed alone — and one more of any of them where ${base} moves under a pin`
  : `  one gate run for the candidate, which is all a green set costs; where it is red, the members are `
    + `searched: none spent finding a member every failing case's paths name alone and one over the rest, `
    + `two for each halving of the suspects otherwise, and one over the members left where no gate of the `
    + `search read their tree — and one more of any of them where ${base} moves under a pin`);

/* A gate that answered nothing about any branch: no set is split and no branch handed back over it. */
const unread = (read, { at, ctx: { self, ms } }) => {
  const minutes = ms / 60_000;
  if (read.error) stop(`npm could not be run: ${read.error.message}. Nothing of any branch was judged.`);
  const declined = new Stop(`npm run check waited ${minutes} minute(s) for a gate place for the candidate `
    + `${shortly(read.candidate)}, ahead of every builder's gate, and none freed, so it ran no step: no branch of `
    + `${keysOf(at)} was judged and nothing was handed back, and each checkpoint is still the landing's turn. `
    + `Land again with a longer wait:\n    ${self} land-ready ${keysOf(at)} `
    + `--wait ${minutes * 2}`);
  declined.exitCode = DECLINED;
  throw declined;
};

const oneByOne = (at, said, why) => {
  at.split = true;
  stop(`${said} ${keysOf(at)} ${why}: every reading taken at this candidate is void and each branch is `
    + `landed alone, against the base as it moves, so the one that fails there fails on its own account and `
    + `the failing step goes back to whoever built it.`);
};

/* What each hand-back names, so the run that gets the branch back reads why without this landing's log. */
const reasonOf = ({ members, reading, cases, combination }, member, pin) => {
  const step = reading.verdict?.step ? `the step ${reading.verdict.step}` : "a step no verdict of it names";
  if (combination) {
    const others = members.filter((one) => one !== member).map((one) => one.key).join(", ");
    return `red at ${step} together with ${others} and green without them, each gated as its own `
      + `candidate on ${shortly(pin)}: the combination is the fault, and each of its builders is told of the others`;
  }
  if (cases) {
    return `${step} failed on ${cases.map((one) => one.what).join("; ")}, and of this set only this `
      + `change's own paths are in ${[...new Set(cases.map((one) => one.read))].join(" or ")}`;
  }
  return `gated alone as a candidate on ${shortly(pin)}, it is red at ${step}`;
};

const handedBack = async (found, at) => {
  for (const back of found.back) {
    for (const member of back.members) {
      const why = reasonOf(back, member, at.pin);
      if (!handsBack(member)) {
        console.error(`  ${member.key}: ${why}. Its checkpoint reads \`${member.landing.state}\`, past the states a `
          + `branch is handed back from, so nothing of it moved:\n    forge resume ${member.key}`);
        continue;
      }
      await saveOn(member, { state: LANDING_HEAD_OWED });
      console.error(`  ${member.key} goes back to the run that built it: ${why}. The checkpoint is at `
        + `\`${LANDING_HEAD_OWED}\`, and nothing of it is pushed or installed:\n${RECAPTURE(member.key, "    ")}`);
    }
  }
};

/* The members left, landed on the candidate their search read green: where no member was dropped the
   tree is the one gated, and a new room is made only where the gate that read it was over another
   commit of that same tree. */
const carriedOn = async (found, one) => {
  const { at, ctx: { root } } = one;
  const { candidate, kept } = found;
  const moved = found.green.flatMap((member) => movedBy(root, member.landing.head, candidate, member.landing.files));
  if (moved.length || found.green.some((member) => member.landing.moved)) {
    dropRoom(root, kept.room);
    return oneByOne(at, `The members left green make ${shortly(candidate)}, which`, `moves ${moved.join(", ")
      || "a path a builder reconciled"} or holds a reconciliation of another candidate`);
  }
  await handedBack(found, at);
  at.members = found.green;
  at.candidate = candidate;
  at.room = kept.candidate === candidate ? kept.room : (dropRoom(root, kept.room), roomFor(root, candidate));
  for (const member of at.members) await reconciledAt(member, candidate, at.pin);
  return console.log(`  ${keysOf(at)} land as the candidate ${shortly(candidate)}, whose tree a green gate of `
    + `this search read`);
};

const searchedRed = async (one, first, said) => {
  const { at, ctx } = one;
  const found = await searched({ at, ctx, first });
  if (found.unread) return unread(found.unread, one);
  if (found.unbuildable) {
    return oneByOne(at, said, `were searched and ${found.unbuildable} does not merge on ${shortly(at.pin)}`);
  }
  console.log(`\nred batch: ${found.rounds ? `split, ${found.rounds} round(s)` : "attributed by paths"}, `
    + `${found.gates} gate(s) spent, the candidate's among them`);
  if (found.green.length === 0) {
    await handedBack(found, at);
    return stop(`${said} Every member of ${keysOf(at)} went back to the run that built it, so nothing of this set lands.`);
  }
  return carriedOn(found, one);
};

/* Spent on the combination first, a green set costing one gate. What a red set is landed as, and the runs that bounds,
   is the-candidate.md's. The minutes are the landing's `--wait`, the one number both of its waits take: a landing
   stopped for a place it was never asked to wait for is the person in the loop G-11 rules out (ISS-2461). */
export const gateStep = async (one) => {
  const { at, ctx: { root, ms } } = one;
  const read = await gateOver({ root, candidate: at.candidate, keys: keysOf(at), minutes: ms / 60_000 });
  if (read.green) {
    at.room = read.room;
    return undefined;
  }
  dropRoom(root, read.room);
  if (read.error || read.declined) return unread(read, one);
  const said = `npm run check exited ${read.status} over the candidate ${shortly(at.candidate)}.`;
  if (at.members.length > 1) {
    if (redBatchScope().value === ONE_BY_ONE) {
      return oneByOne(at, said, `are green apart and red together, and this project's \`redBatch\` is `
        + `\`${ONE_BY_ONE}\` rather than \`${SEARCHED}\`, so no subset is searched for`);
    }
    return searchedRed(one, read, said);
  }
  /* The branch's own fault against what landed since, answered by a new head: the one the gate
     refused stays where it is, the landing writing no ref of a branch it did not build. */
  const [member] = at.members;
  if (!handsBack(member)) {
    stop(`${said} The checkpoint on ${member.key} reads \`${member.landing.state}\`, past the states a `
      + `branch is handed back from, so nothing of it moved. Read where it is:\n    forge resume ${member.key}`);
  }
  await saveOn(member, { state: LANDING_HEAD_OWED });
  return stop(`${said} The candidate is ${member.landing.branch} merged onto what landed since, so the `
    + `failure is that branch's own and it goes back to the run that built it: the checkpoint is at `
    + `\`${LANDING_HEAD_OWED}\`, and nothing of ${member.key} is pushed or installed. That run commits `
    + `the answer on top of ${shortly(member.landing.head)} and captures the head it makes:\n`
    + RECAPTURE(member.key, "    "));
};
