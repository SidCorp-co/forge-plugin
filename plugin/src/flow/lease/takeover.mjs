/* Who may take a turn its holder left, and the sentences that name the state refusing one. The lease itself is `../lease.mjs`; what a state may not do is `landing/checkpoint.mjs`. docs/cli/the-takeover.md. */
import { INHERITED, INHERITED_MEANS, OWN_ID } from "../../resolve/config.mjs";
import {
  LANDING_BUILDER_OWED, LANDING_HEAD_OWED, LANDING_JUDGED, LANDING_STATES, READ_THE_STATE, SPENT_AT, landingOf, takeRoute,
} from "../landing/checkpoint.mjs";
import { MINUTES, claimed, describe, expiryOf, leaseOf, setLease } from "../lease.mjs";
import { sessionSourced } from "../../resolve/config.mjs";
import { sharedNow } from "../../wire/shared-clock.mjs";
import { fail } from "../../resolve/settings.mjs";
import { worklogFor } from "../worklog.mjs";

/** Whether this session's own last claim was a take at this state, which a lease held from before that handoff is not. The holder's latest row and no earlier one, because the history outlives both the holder and the state: a run that took this turn and lost the lease is any other run again, and one that has since taken another turn is at that one. */
export const tookAt = (lease, holder, state) => {
  const last = (lease?.history ?? []).findLast((one) => one?.holder === holder);
  return last?.how === "take" && last?.landing === state;
};

/* When a take is open: the expiry, and not the later moment a reclaim waits for that `freeFrom` names. */
const takeableAfter = (ref) =>
  `Unless a write renews it, the turn is takeable once that lease expires:\n  ${takeRoute(ref)}`;

/* A builder's turn asked for by a run that is not the builder it names. What says the builder has gone is the builder's own lease: after a hand-back the record carries the lander's, whose liveness stood in for the builder's and refused the one run left (ISS-1639). A live lease that is neither run's is nobody's to take over here, the take licenses the write after it, and the records turn keeps its reading (ISS-1649). */
const successionRefusal = (ref, landing, holder, lease, said, taking) => {
  const whose = `${said}, whose turn is the builder ${landing.builder}'s and this session is ${holder}`;
  if (lease.holder === landing.builder) {
    return `${whose}: that builder is on the issue under a lease of its own, ${describe(lease)}, and `
      + `a successor is eligible only once the builder's own lease is dead by the reclaim rules. `
      + `${takeableAfter(ref)}`;
  }
  if (lease.holder !== holder) {
    return `${whose}, which succeeds that builder where it has gone — but ${describe(lease)} is `
      + `already on it, and a lease that is neither the builder's nor this session's own is not taken `
      + `over from here. ${takeableAfter(ref)}`;
  }
  if (tookAt(lease, holder, landing.state)) return null;
  /* A new head answers for itself, reviewed and judged where it is captured, so a successor may build
     it as it may read a candidate; a record signs the judgement of work already done. */
  if (landing.state !== LANDING_BUILDER_OWED && landing.state !== LANDING_HEAD_OWED) {
    return `${whose}: the records that turn is owed answer for a judgement the run that built the `
      + `change made, so a successor takes it only once nothing live is on the issue — and what is `
      + `on it is this session's own lease, ${describe(lease)}. ${takeableAfter(ref)}`;
  }
  if (taking) return null;
  return `${whose}, which holds the lease and has taken no turn: the take is what puts a successor `
    + `on the record, and a write signed without one leaves the run that answered for the builder `
    + `named nowhere. Take the turn first:\n  ${takeRoute(ref)}`;
};

/* `--take` is the one route that may take a live lease, so the state naming the taker's turn is the whole of what licenses it, a lease no longer live being anybody's already. */
export const takeRefusal = (ref, landing, holder, lease, { now = sharedNow(), source = null, taking = false } = {}) => {
  if (!landing) {
    return `${ref} carries no landing checkpoint, so no turn is handed off and --take is refused. `
      + `A build writes one where it ends:\n  forge claim ${ref} --pushed --ready`;
  }
  const said = `the landing checkpoint on ${ref} reads \`${landing.state}\``;
  const row = LANDING_STATES[landing.state];
  const live = Boolean(lease) && expiryOf(lease) > now;
  if (!row) {
    return `${said}, which is no state this version knows, so whose turn it is cannot be read. `
      + `${READ_THE_STATE(ref)}`;
  }
  if (!row.turn) {
    return `${said}, so the landing is over and no turn is left to take. An issue with work still `
      + `on it takes its lease as any other does:\n  forge claim ${ref}`;
  }
  if (row.turn === "builder") {
    if (holder !== landing.builder) return live ? successionRefusal(ref, landing, holder, lease, said, taking) : null;
    /* Refused rather than told, alone among the writes a shared id makes: this one takes a live lease. */
    if (!live || lease.holder === holder || source !== INHERITED) return null;
    return `${said}, and the builder it names is ${landing.builder}, which is ${INHERITED_MEANS}: `
      + `nothing here can tell this session from the run that built it, and the take would replace `
      + `a live lease — ${describe(lease)} is on it. Give the run that reconciles an id of its own `
      + `and write the checkpoint under it. ${OWN_ID}`;
  }
  if (row.turn === "lander") {
    if (holder === landing.builder) {
      return `${said}, whose turn is the lander's, and this session built it: the builder's turn `
        + `comes back at \`${LANDING_BUILDER_OWED}\` or \`${LANDING_HEAD_OWED}\` and nowhere else. ${READ_THE_STATE(ref)}`;
    }
    /* At `judged` alone and spent by the take: a judge that went on to land under that same lease holds an ordinary lander's, which a third run may not take. docs/cli/the-checkpoint.md. */
    if (!live || lease.holder === holder || lease.holder === landing.builder) return null;
    if (landing.state === LANDING_JUDGED && landing.judge && lease.holder === landing.judge) return null;
    /* And one state over, a successor's own lease after the write its turn ended with: spent by the take, and with no marker to clear, the row saying nothing once the lease moves. */
    const spent = SPENT_AT[landing.state];
    if (spent && tookAt(lease, lease.holder, spent)) return null;
    return `${said}, whose turn is the lander's, and ${describe(lease)} is already on it. `
      + `${READ_THE_STATE(ref)}`;
  }
  if (row.turn === "qa") {
    /* No lander is named here to spare its live lease, and a take at a state naming the judge is what `--take` is for, so being other than the builder is the whole of the independence. */
    if (holder !== landing.builder) return null;
    return `${said}, whose turn is an independent judge's, and this session is the builder `
      + `${landing.builder} it names: no run may judge its own work, and an id a run inherited is the `
      + `builder's however it arrived. Give the judging run an id of its own and take the turn `
      + `under it. ${OWN_ID}`;
  }
  return `${said}, whose turn is one this version cannot read, so nothing here may take it. `
    + `${READ_THE_STATE(ref)}`;
};

/** The take itself, apart from the verb that prints it, so the landing task and `forge claim --take` cannot come to disagree about what licenses one. */
export const takeLease = async (documentId, ref, context,
  { holder, minutes = MINUTES, line = undefined, patch = null, status = null }) => {
  /* Where the id came from is this session's to say only where the holder is this session. */
  const mine = sessionSourced();
  const source = mine.id === holder ? mine.source : null;
  const held = landingOf(context);
  const refused = takeRefusal(ref, held, holder, leaseOf(context), { source, taking: true });
  if (refused) fail(refused);
  /* Spent by every take at that state, the judge's own included: a marker the judge's own take left behind would make the lander lease it goes on to hold a third run's to take. */
  const landing = held?.state === LANDING_JUDGED && held.judge ? { ...held, judge: "" } : undefined;
  const next = claimed(context, {
    holder, minutes, next: line, worklog: worklogFor(context, patch),
    how: "take", status, landing,
  });
  await setLease(documentId, next, ref, () => context);
  return leaseOf(next);
};
