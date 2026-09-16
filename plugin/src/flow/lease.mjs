/* The issue's session field read as a lease. Every write it covers carries the value it read, and the tracker refuses one whose value moved. docs/cli/claim.md, docs/cli/the-precondition.md. */
import { INHERITED, INHERITED_MEANS, OWN_ID, WORKTREE, sessionOf, sessionSourced, sessionWriting } from "../resolve/config.mjs";
import { MINTED_FOR, RUN_ID, RUN_ID_VAR, besideGit, runIdAt, runNames } from "../resolve/session/run-id.mjs";
import { TAKEABLE } from "../rank/weights.mjs";
import { sharedNow, sharedStamp, slackNow, stampOf } from "../wire/shared-clock.mjs";
import { thisCall } from "../resolve/flags.mjs";
import { fail } from "../resolve/settings.mjs";
import { refuse } from "../refusal.mjs";
import { enforcementOf, writeField } from "../tracker/field-write.mjs";
import { scoped, tried } from "../tracker/rest.mjs";
import {
  LANDING, LANDING_BUILDER_OWED, LANDING_JUDGED, LANDING_STATES, READ_THE_STATE, SPENT_AT,
  landingNext, landingOf,
} from "./landing/checkpoint.mjs";
import { KEY as WORKLOG, worklogFor } from "./worklog.mjs";

export const FIELD = "sessionContext";
export const KEY = "lease";
/* 60 and not the 30 it was, off the corpus rather than named: a quarter of runs went longer than that between two payload writes, twelve of those gaps with the run working right through and the longest of them 58 minutes, and past 60 there is no such gap left. It buys a smaller window and never liveness, which no duration can be — the record says when a run last wrote and nothing about whether it is alive (ISS-1224). */
export const MINUTES = 60;
export const READING_MINUTES = 10;
export const RECLAIMS_BEFORE_PARK = 2;
const HISTORY_KEPT = 12;

/** What the mechanism is, claiming nothing of any far end, because `forge claim -h` has made no write and a run reading it is owed the shape rather than a guess. */
export const MECHANISM =
  "Every write the lease covers carries the value it read, and the tracker refuses one whose value "
  + "moved: two runs that both find no lease no longer both claim. Where the tracker does not "
  + "enforce it, the write is compared after the fact instead, which cannot stop another run's write "
  + "and only refuses to build on it.";

/** And what this endpoint answered, which only a write can have learned, so this is the claim's own line and never the usage's. */
export const heldBy = () => (enforcementOf() === true
  ? "This tracker refuses a stale write to the field, so the lease is this run's until it lapses."
  : "This tracker did not refuse a stale write to the field, so the lease is advisory: two runs that "
    + "both find no lease both claim, and the later write erases the earlier.");

export const NOTHING_WORKED = "nothing was worked under this lease";

/** The other lease a write can be owed, spent by `forge claim -h` and by the refusals a payload write with no lease still meets, so a run reaches it where it is stopped rather than in a document it may not open. It names no kind of write, because nothing here can tell a reading's output from a build's: the run knows whether work follows it and the CLI does not (ISS-840). What it asks a caller to type is also what a write that takes its own lease gives itself, `NOTHING_WORKED` being the one line both spend (ISS-1260). */
export const nothingWorked = (ref = "<ref>") =>
  "A write that is the whole of what a run will do to the issue — a reading posted and the issue "
  + "left — takes a short lease that says so on the record, so the run after it reads a reading "
  + "rather than a reclaim:\n"
  + `  forge claim ${ref} --minutes ${READING_MINUTES} --next "${NOTHING_WORKED}"`;

export const RENEWED_BY_WRITING =
  "A lease is renewed only by a write the CLI makes to the issue, so a gate, a consult and a read "
  + "renew nothing.";

export const MINUTES_ASKS =
  `${RENEWED_BY_WRITING} So what --minutes asks for is the gap to this run's next write: a step `
  + "that writes nothing is the whole of what a lease has to survive.";

/* Which of the two ids the tree standing here minted, said and never refused: a run that claimed
   under the wave's id and then stood in its own worktree is otherwise refused by an id it has no
   way to place, and one holding a tree's id is told nothing about where it got it (ISS-467). */
export const idsHere = (lease, held = sessionSourced(), at = process.cwd()) => {
  const here = runIdAt(at);
  if (here && lease?.holder === here && held.id !== here) {
    return `That holder is the id ${besideGit(at, RUN_ID)} holds, so the lease is a run standing `
      + `where this call stands; this one resolved ${held.id} instead. Unset ${RUN_ID_VAR} and run `
      + "from this tree, and the two are one run again.";
  }
  return held.source === WORKTREE
    ? `This call's own id was read off ${besideGit(at, RUN_ID)}, the tree it stands in, so it is `
      + "this run's alone and names no wave."
    : "";
};

const alsoSay = (said) => (said ? `${said} ` : "");

const UNKNOWN = "unknown";

export const agentOf = () => process.env.AI_AGENT || UNKNOWN;
export const pidOf = () => process.env.CLAUDE_PID || UNKNOWN;

/* A shape's `written` field is filled from the session here and refused as a flag where the payload is gathered, for the reason `claimed` below states. Here, beside the other two the environment answers for. The marker names which half of the writing session the field takes, because an id says nothing about whether it is a run's own (ISS-705). */
export const writtenBy = (shape) => {
  const writing = sessionWriting();
  return Object.fromEntries(shape.fields.filter((one) => one.written).map((one) => [one.flag, writing[one.written]]));
};

export const nextLine = (given, flag = "--next") => {
  if (given === undefined) return undefined;
  if (given === null) return null;
  const line = String(given).trim();
  if (/[\r\n]/u.test(line)) {
    fail(`${flag} takes one line: the step whoever comes next starts on. This one holds a newline.`);
  }
  return line || null;
};

export const leaseOf = (context) => {
  const held = context?.[KEY];
  if (!held || typeof held !== "object" || typeof held.holder !== "string" || !held.holder) return null;
  const minutes = Number(held.minutes);
  return {
    holder: held.holder,
    agent: held.agent ? String(held.agent) : UNKNOWN,
    pid: held.pid === undefined || held.pid === null || held.pid === "" ? UNKNOWN : String(held.pid),
    renewedAt: String(held.renewedAt ?? ""),
    minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : MINUTES,
    slack: Number.isFinite(Number(held.clock)) && Number(held.clock) >= 0 ? Number(held.clock) : null,
    next: typeof held.next === "string" && held.next ? held.next : null,
    history: Array.isArray(held.history) ? held.history : [],
  };
};

export const expiryOf = (lease) => {
  const at = Date.parse(lease?.renewedAt ?? "");
  return Number.isFinite(at) ? at + lease.minutes * 60_000 : 0;
};

const stamp = (ms) => (ms ? stampOf(ms) : "an unreadable time");

/* A lease past its duration is another run's. The holder's own lapsed one is its own state because
   the field still naming this session proves nobody took the issue; a reclaim is a handoff. */
export const stateOf = (lease, holder, now = sharedNow()) => {
  if (!lease) return "free";
  const live = expiryOf(lease) > now;
  if (lease.holder === holder) return live ? "mine" : "lapsed";
  return live ? "live" : "expired";
};

export const describe = (lease) =>
  `session ${lease.holder} (${lease.agent}, pid ${lease.pid}), renewed `
  + `${stamp(Date.parse(lease.renewedAt))} for ${lease.minutes} minute(s), expiring `
  + `${stamp(expiryOf(lease))}`;

/* A live lease's own, minted holder: trusted as an alias because any write that could land already
   has to be made by it, the precondition refusing every other caller, so it credits no wider than a
   landing write already trusts where a hook's own directory cannot follow a shell's `cd` (ISS-1558). */
export const liveAlias = async (documentId, now = null) => {
  const held = await scoped("forge_issues", { action: "get", documentId }, true);
  if (held?.refused) return null;
  const lease = leaseOf(held?.sessionContext);
  if (!lease || !MINTED_FOR.test(lease.holder) || expiryOf(lease) <= (now ?? sharedNow())) return null;
  return lease.holder;
};

export const STOPPED = "--stopped";

/* How far past expiry the record still cannot tell a working run from a stopped one: the holder's own estimate again, so a run that asked for ten minutes is covered for ten and one that asked for four hours for four. Strictly less, so exactly one duration past expiry is anybody's again. */
export const freshLapse = (lease, now = sharedNow()) => {
  const expiry = expiryOf(lease);
  return expiry > 0 && now < expiry + lease.minutes * 60_000;
};

const agoIn = (ms) => {
  const minutes = Math.round(ms / 60_000);
  return minutes < 1 ? "less than a minute ago" : `${minutes} minute(s) ago`;
};

/* Refused rather than said, alone among the lease's notices, because here the taking is the damage: the reclaim this was filed from took a live run's issue and cost it forty minutes of writes, and a line printed by the command that has already written the field warns nobody in time. It judges nothing and withholds one flag's worth — the record it describes is the one a stopped run leaves too, which is why the caller decides and this only says what is being decided (ISS-1224). */
export const reclaimRefusal = (ref, lease, now = sharedNow(), take = null) =>
  `the lease on ${ref} ran out ${agoIn(now - expiryOf(lease))}, and this reclaim would take the `
  + `issue off ${describe(lease)}. ${RENEWED_BY_WRITING} A run inside one of those leaves the `
  + `record a stopped run leaves, so a lapse this fresh proves neither.`
  + `${lease.next ? ` The step it left named: ${lease.next}.` : ""}`
  + (take
    ? ` The landing checkpoint names your turn, so the lease is yours to take and nothing about that `
      + `run has to be established:\n  ${take}`
    : ` Ask that run: where it answers, its own next write takes the lease back. Where you have `
      + `established it stopped, say so:\n  forge claim ${ref} ${STOPPED}`);

export const UNHELD = "--unheld";

/** The line a lease left, off a field `leaseOf` reads as no lease at all: whatever emptied it took the holder and may have left the rest, and that line is the last thing the record says about the run that is gone. */
export const nextLeft = (context) => {
  const held = context?.[KEY];
  return typeof held?.next === "string" && held.next ? held.next : null;
};

/* What the field keeps once the holder comes off, and the mark saying the holder came off on purpose. Without the mark a field a release emptied is the field a run that died leaves — three readings a person has to pick between rather than one write's own doing — so a take reaches a released field wherever the issue stands, while an unmarked empty one is refused past the dispatch statuses exactly as it was. A holder back on the row means a later take wrote over the mark, which is why the two are read together and never apart (ISS-1617). */
export const remnantOf = (context) => {
  const held = context?.[KEY];
  return held && typeof held === "object" ? held : null;
};

export const RELEASED = "released";

export const releasedIn = (context) => {
  const held = remnantOf(context);
  if (typeof held?.holder === "string" && held.holder) return "";
  return typeof held?.[RELEASED] === "string" ? held[RELEASED] : "";
};

export const takeableFree = (status, context) =>
  TAKEABLE.includes(String(status)) || Boolean(releasedIn(context));

const workBlock = (work) => {
  if (work === null) return "";
  return work.length
    ? `${work.map((one) => `  ${one}`).join("\n")}\n`
    : "  the worklog names no branch, so the record says nothing about where the work went.\n";
};

/* Refused for the reason the fresh lapse is, on the other shape the same loss takes: nobody is named here, so the caller cannot ask the holder and the flag says instead that no run is on the issue. The work lines are handed in rather than read, because the opening that prints them runs past this refusal and the branch is the whole of what a second arrival needs to take the work up rather than cut it again (ISS-1183, ISS-1184); `null` is the caller that read no worklog at all, which is the payload write that meets this state, and a block it could not fill is left out rather than filled with a silence it cannot vouch for (ISS-1260). */
export const unheldRefusal = (ref, status, { next = null, work = null } = {}) =>
  `${ref} is at \`${status}\`, past the statuses a run is dispatched at, and its lease field holds `
  + `no lease. Every write that carries an issue this far renews one, so the field is a run that `
  + `died, a write that erased it, or a filing sent straight to this status — and not an issue `
  + `waiting to be started, which is the one reading that would have the work built twice.`
  + `${next ? ` The step the last write named: ${next}.` : ""}\n`
  + workBlock(work)
  + `Where you have established no run is on it, say so and the claim history keeps that it was `
  + `taken this way:\n  forge claim ${ref} ${UNHELD}`;

/* Counted since the park that answered them: a resumed issue does not walk straight back in. */
const since = (history, status) => {
  const parked = history.findLastIndex((one) => one?.how === "parked" && one?.status === status);
  return parked < 0 ? history : history.slice(parked + 1);
};

export const reclaimsOf = (lease, status) =>
  since(lease?.history ?? [], status).filter((one) => one?.how === "reclaim" && one?.status === status).length;

/* Crashed is not failed: the third reclaim of one status says the status is where runs die. Read
   from the history the claim wrote, so a park whose later writes never landed is still owed. */
export const parksAsCrashed = (lease, status) => reclaimsOf(lease, status) > RECLAIMS_BEFORE_PARK;

const lastReclaimAt = (lease, status) =>
  since(lease?.history ?? [], status)
    .filter((one) => one?.how === "reclaim" && one?.status === status)
    .reduce((newest, one) => (String(one.at) > newest ? String(one.at) : newest), "");

/* A crashed park answers the reclaims older than it; one written before the newest of them
   answered an earlier crash, and calling it this one's would swallow the park now owed. */
export const parkAnswers = (lease, status, parkedAt) =>
  parksAsCrashed(lease, status) && lastReclaimAt(lease, status) <= String(parkedAt ?? "");

/** Whether this session's own last claim was a take at this state, which a lease held from before that handoff is not. The holder's latest row and no earlier one, because the history outlives both the holder and the state: a run that took this turn and lost the lease is any other run again, and one that has since taken another turn is at that one. */
export const tookAt = (lease, holder, state) => {
  const last = (lease?.history ?? []).findLast((one) => one?.holder === holder);
  return last?.how === "take" && last?.landing === state;
};

/* `--take` is the one route that may take a lease which is still live, so what licenses it is the
   state naming the taker's turn and nothing else. A lease no longer live is anybody's by the
   reclaim rules already, which is what makes a successor eligible where the run named has gone. */
export const takeRefusal = (ref, landing, holder, lease, { now = sharedNow(), source = null } = {}) => {
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
    if (holder !== landing.builder) {
      if (!live || (lease.holder === holder && tookAt(lease, holder, landing.state))) return null;
      return `${said}, whose turn is the builder ${landing.builder}'s, and this session is ${holder}: `
        + `neither it nor a successor, since a successor is eligible only once that lease is dead by `
        + `the reclaim rules and ${describe(lease)} is on it. ${READ_THE_STATE(ref)}`;
    }
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
        + `comes back at \`${LANDING_BUILDER_OWED}\` and nowhere else. ${READ_THE_STATE(ref)}`;
    }
    /* At `judged` alone and spent by the take: a judge that went on to land under that same lease
       holds an ordinary lander's, which a third run may not take. docs/cli/the-checkpoint.md. */
    if (!live || lease.holder === holder || lease.holder === landing.builder) return null;
    if (landing.state === LANDING_JUDGED && landing.judge && lease.holder === landing.judge) return null;
    /* And one state over, a successor's own lease after the write its turn ended with: spent by the take, and with no marker to clear, the row saying nothing once the lease moves. */
    const spent = SPENT_AT[landing.state];
    if (spent && tookAt(lease, lease.holder, spent)) return null;
    return `${said}, whose turn is the lander's, and ${describe(lease)} is already on it. `
      + `${READ_THE_STATE(ref)}`;
  }
  if (row.turn === "qa") {
    /* No lander is named here to spare its live lease, and a take at a state naming the judge is
       what `--take` is for, so being other than the builder is the whole of the independence. */
    if (holder !== landing.builder) return null;
    return `${said}, whose turn is an independent judge's, and this session is the builder `
      + `${landing.builder} it names: no run may judge its own work, and an id a run inherited is the `
      + `builder's however it arrived. Give the judging run an id of its own and take the turn `
      + `under it. ${OWN_ID}`;
  }
  return `${said}, whose turn is one this version cannot read, so nothing here may take it. `
    + `${READ_THE_STATE(ref)}`;
};

/* Read, not passed: a caller that could supply the writer's own identity could supply a false one.
   Silence about `next` means unchanged, or a claim would drop the note the dead run left. */
export const claimed = (context, { holder, at = sharedStamp(), minutes, next, worklog, landing, how = null, status = null }) => {
  /* The remnant and not the lease: a field a release emptied answers `null` to `leaseOf`, so reading through it would drop every earlier row at the next take and the line the release left with them. What the remnant holds is unjudged, hence the two guards below — a history that is not a list spreads into a throw. The row this builds carries no release mark, the field being held again. */
  const held = remnantOf(context);
  const history = Array.isArray(held?.history) ? [...held.history] : [];
  const line = typeof held?.next === "string" && held.next ? held.next : null;
  const state = landing?.state ?? landingOf(context)?.state ?? null;
  /* The outgoing line, not the incoming one: what a crash loop is asked is where each attempt died. */
  if (how) history.push({ holder, at, how, status, next: line, ...(state ? { landing: state } : {}) });
  return {
    ...(context && typeof context === "object" ? context : {}),
    ...(worklog ? { [WORKLOG]: worklog } : {}),
    ...(landing ? { [LANDING]: landing } : {}),
    [KEY]: {
      holder,
      agent: agentOf(),
      pid: pidOf(),
      renewedAt: at,
      ...(slackNow() === null ? {} : { clock: slackNow() }),
      minutes,
      next: next === undefined ? line : nextLine(next),
      history: history.slice(-HISTORY_KEPT),
    },
  };
};

/* One line: the park's reason carries it, because its evidence field takes no history. */
export const historyLine = (lease, status) =>
  (lease?.history ?? [])
    .filter((one) => !status || one?.status === status)
    .map((one) => `${one.how} by ${one.holder} at ${stamp(Date.parse(one.at ?? ""))}`)
    .join(" | ");

/* A duration past the expiry and not the expiry, which is where a reclaim stops being refused
   rather than where it starts (ISS-1224); rounded up, a truncated minute still being held. */
const anybodysFrom = (lease) => {
  const expiry = expiryOf(lease);
  return expiry ? Math.ceil((expiry + lease.minutes * 60_000) / 60_000) * 60_000 : 0;
};

const freeFrom = (lease) =>
  `unless a write renews it, the lease is anybody's from ${stamp(anybodysFrom(lease))}`;

const waitItOut = (ref, lease) => `Wait for it: ${freeFrom(lease)}:\n  forge claim ${ref}`;

/* The one refusal whose route out was the refusal: a run whose id changed under it reads its own
   lease as another run's, and the `forge claim` it is sent to is refused for the same reason. Two
   conditions keep the sentence off the callers with a better route — the holder is the run this
   issue was dispatched to, and this call is not a second one, whom `notHandedHere` answers. */
export const asItsHolder = (ref, lease, { held = sessionSourced(), at = process.cwd(), call = thisCall() } = {}) => {
  const key = String(ref).trim().toLowerCase();
  if (!call || !runNames(lease?.holder, key) || runNames(held.id, key)) return null;
  if (lease.pid === UNKNOWN || lease.pid !== pidOf() || runIdAt(at) === lease.holder) return null;
  return `That holder is a run dispatched to ${ref}, and the lease records pid ${lease.pid}, which `
    + `is this call's own process — the process and not the run inside it, every agent a session `
    + `dispatched sharing one, so nothing here is taken on it. A caller that is not that run waits: `
    + `${freeFrom(lease)}, and \`forge claim ${ref}\` takes it then. Where this call IS that run, `
    + `under an id it has lost, carry the id it named back:\n  ${RUN_ID_VAR}=${lease.holder} ${call}`;
};

export const claimRefusal = (ref, lease, said = "", take = null) =>
  `${ref} is claimed: ${describe(lease)}. A live lease is that run's, and this claim is refused. `
  + `${alsoSay(idsHere(lease))}${lease.next ? `The step it left named: ${lease.next}. ` : ""}`
  + `${alsoSay(said)}${take
    ? `The landing checkpoint names your turn, so this lease is yours to take:\n  ${take}`
    : asItsHolder(ref, lease) ?? waitItOut(ref, lease)}`;

const WRITE_REFUSAL = {
  free: (ref) =>
    `${ref} carries no lease, and a payload write is the holder's. Take it first:\n  forge claim ${ref}\n`
    + nothingWorked(ref),
  live: (ref, lease) =>
    `${ref} is held by another run: ${describe(lease)}. Its payload writes are that run's, so this `
    + `one is refused. ${alsoSay(idsHere(lease))}${asItsHolder(ref, lease) ?? waitItOut(ref, lease)}`,
  expired: (ref, lease) =>
    `the lease on ${ref} is another run's and has expired: ${describe(lease)}. A write of yours `
    + `beside it is stale. ${alsoSay(idsHere(lease))}Reclaim it first:\n  forge claim ${ref}`,
};

export const writeRefusal = (state, ref, lease) => WRITE_REFUSAL[state](ref, lease);

/** The word a take made by a payload write keeps in the claim history, which no other claim writes: a first claim typed by hand is `claim` and an anomaly taken past the dispatch statuses is `unheld`, so a reader counting how an issue was picked up can tell a run that took it from a write that did. */
export const TAKEN_BY_WRITING = "write";

/* Which of the two a payload write owes a field holding no lease, and the only place the question is answered: take it where a bare `forge claim` would have granted it, refuse in that claim's own words where the claim is itself refused (ISS-1260, ISS-1252). Past the dispatch statuses the empty field names three readings — a run that died, a write that erased one, a filing sent straight there — and a silent take would pick one of them; that judgement is what the flag exists to ask a person for. */
export const freeRefusal = (ref, status, context = null) => {
  if (TAKEABLE.includes(String(status))) return WRITE_REFUSAL.free(ref);
  const at = releasedIn(context);
  if (!at) return unheldRefusal(ref, status, { next: nextLeft(context) });
  return `${ref} is at \`${status}\` and the write before it gave the lease back at ${stamp(Date.parse(at))}, `
    + `so nothing is on the issue and nothing died holding it. Take it:\n  forge claim ${ref}`
    + `${nextLeft(context) ? `\nThe step that write named: ${nextLeft(context)}.` : ""}`;
};

/* Said rather than refused, on ISS-65's shape and for the emptier state (ISS-1260): there a lease existed and lapsed, here no run ever held the issue, and what separates two callers is the tracker's compare either way rather than the order two commands were sent in. What it names is the duration, because a lease nobody asked for is one nobody would otherwise know the length of. */
export const tookByWriting = (ref, lease, left = null) =>
  `${ref} carried no lease and this write took one: ${describe(lease)}. Nobody held the issue, so the `
  + `claim the refusal here used to name is one this write could make, and it made it. The lease `
  + `covers the write and not this run: it goes back when the write lands, because a call that had to `
  + `take its own lease is the whole of what it does to the issue, and the duration above is only what `
  + `stands if the call does not finish.`
  + `${left ? ` The step the field still named: ${left}.` : ""}`
  + ` Work that follows this says so by claiming, which is the lease that is kept:\n  forge claim ${ref}`;

/* The one read a free field costs, made here and on no other path: the status is what separates the take from the refusal, and reading it for every payload write would be a round trip per write (ISS-1252). */
const statusFor = async (documentId) => {
  const answer = await scoped("forge_issues", { action: "get", documentId, fields: [] });
  return String(answer?.status ?? "");
};

/* Said rather than refused (ISS-65): the command the old refusal named is one this write can make. */
export const renewedLapsed = (ref, lease) =>
  `your lease on ${ref} had expired at ${stamp(expiryOf(lease))} and this write renewed it: the read `
  + `before it still named ${lease.holder}, so no other run had taken the issue by then. A reclaim is `
  + `a handoff and this was none, so the claim history is unchanged.`;

/** What a finder's write says about the lease it did not take, here rather than at either of its call sites because every other lease sentence is here; `renew`'s `{ finder: true }` answer is the argument. */
export const finderSaid = (ref, renewed) => (renewed
  ? `The lease on ${ref} is yours and this post renewed it.`
  : `No lease on ${ref} is yours, so this post is a finder's and renewed none.`);

/* Key-order-blind: the tracker returns what it stored in its own order, so a plain compare differs. */
export const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
};

/* Where the lease is read from, in one place. Softly, the transport's own refusal comes back in place of the context: a caller that asks for it has a record up already, and every failure it meets owes a message naming that record. */
export const readContext = async (documentId, soft = false) => {
  const answer = await (soft ? tried : scoped)("forge_issues", { action: "get", documentId, fields: [] });
  return answer?.refused ? answer : answer?.[FIELD] ?? null;
};

/* What a far end with no precondition still gets: the compare-and-set made here, which cannot stop another run's write and only refuses to build on it. `sessionContext`'s row in the field writer is where these three are spent, and where the tracker's own refusal replaces them. */
export const leaseLandedAs = (held, sent) => canonical(held) === canonical(sent);

export const leaseMismatch = (ref, back) => {
  const held = leaseOf(back);
  return `The lease on ${ref} did not read back as written${held ? `: ${describe(held)} holds it` : ""}. `
    + `Another run wrote the field between the read and the write, and nothing here is yours to `
    + `build on. Read the record, then claim again:\n  forge claim ${ref}`;
};

/* `on` answers with the context the value was built from, which is what the write is conditional on: a function rather than the value itself because the two writes whose value is built inside the write's own callback read that context there, after this call was made. A caller naming none conditions nothing — the safe way for a call site to be missed, where an expectation of `null` would read as *the field is empty* and refuse every write to an issue that has a lease. */
export const setLease = async (documentId, value, ref, on, said = {}) =>
  writeField(documentId, FIELD, value, { ref, refuse: fail, expect: on, ...said });

/* An edge touches two issues and one of them is being worked: the other is only checked, so a blocker just filed, holding no lease at all, can still be named. */
export const notAnothers = async (documentId, ref) => {
  const lease = leaseOf(await readContext(documentId));
  if (stateOf(lease, sessionOf()) === "live") fail(writeRefusal("live", ref, lease));
};

/** The same question asked rather than asserted, for the caller that has already written: the answer comes back instead of exiting — as another run's hold or as an `unknown` the transport would not say — because whoever stops here owes a message about the record it left standing. */
export const anothersHold = async (documentId, ref) => {
  const context = await readContext(documentId, true);
  if (context?.refused) return { unknown: true, said: context.refused };
  const lease = leaseOf(context);
  const state = stateOf(lease, sessionOf());
  if (state === "mine" || state === "lapsed") return null;
  return { unknown: false, said: writeRefusal(state, ref, lease) };
};

/* The take a payload write makes for itself, which is a claim in everything but the typing: the caller asked for the write, the field is empty, and the tracker's compare is what separates two callers who both read it empty — the refusal this replaces separated nobody (ISS-1260). The lease is the short one and carries the line that says so, derived rather than asked for, because a call that had to take its own lease is by construction the whole of what it does to the issue; the notice waits for the write, as the lapsed one does, a claim printed before the update being one a failed update would leave standing. It sits before the refusal below and after the finder, which claims nothing anywhere; and a `null` line reaching it is the transition clearing a line the issue was carrying, which a field holding no lease never had, so silence resolves to the derived line and a caller with a line of its own still writes it — unless a release emptied the field, whose line is one write's own doing and is carried forward where the caller names none (codex F2). */
const takenByWriting = async (documentId, ref, context, next, patch) => {
  const status = await statusFor(documentId);
  if (!takeableFree(status, context)) fail(freeRefusal(ref, status, context));
  const left = nextLeft(context);
  const sent = claimed(context, {
    holder: sessionOf(),
    minutes: READING_MINUTES,
    next: next ?? (releasedIn(context) && left ? left : NOTHING_WORKED),
    worklog: worklogFor(context, patch),
    how: TAKEN_BY_WRITING,
    status,
  });
  await setLease(documentId, sent, ref, () => context);
  console.error(tookByWriting(ref, leaseOf(sent), left));
  OWED.set(documentId, ref);
  return sent;
};

/* Registered here and spent by `plugin/src/cli.mjs`, the only place a verb's success is known: `renew` runs before the payload write on every route that calls it, so none of them can tell the write landed. Process state because that is the fact it carries — one call, one lease it did not ask for — and a call exiting through `fail` never reaches the spend, which is how a call that did not complete keeps what it took (ISS-1617). */
const OWED = new Map();

/* What a release says and what it writes. The sentence is for whoever reads the terminal the run ran in; the value takes the holder off so `leaseOf` reads no lease and records the moment so the field is not the one a run that died leaves, touching nothing else — the line the write left and every row of the claim history are the record of what happened here, and a release is not a reclaim and adds no row of its own. */
export const releasedSaid = (ref) =>
  `${ref} is free again: the lease this write took covered the write, and the write has landed. `
  + `Nothing holds the issue, so the run after it claims with no wait.`;

export const releasedWrite = (context, at = sharedStamp()) => ({
  ...(context && typeof context === "object" ? context : {}),
  [KEY]: { ...(remnantOf(context) ?? {}), holder: "", [RELEASED]: at },
});

/** Every lease a write took for itself in this process, given back. Read back first and judged on what came back: a take that landed between the write and here is a run this must not write over, and a lease already gone is nothing to give back. Its write is the writer's soft one, which no other lease write is: everything the call was asked for is already on the tracker by the time this runs, and `writeFields` carries what that buys. */
export const releaseOwed = async (say = console.error) => {
  const owed = [...OWED.entries()];
  OWED.clear();
  for (const [documentId, ref] of owed) {
    try {
      const context = await readContext(documentId, true);
      if (context?.refused) {
        say(`${ref}'s lease was not given back: the field did not read back. ${context.refused}`);
        continue;
      }
      const state = stateOf(leaseOf(context), sessionOf());
      if (state !== "mine" && state !== "lapsed") continue;
      await setLease(documentId, releasedWrite(context), ref, () => context, { refuse, soft: true });
      say(releasedSaid(ref));
    } catch (error) {
      say(`${ref}'s lease was not given back and stands until it lapses: ${error?.message ?? error}`);
    }
  }
};

/* Every payload write renews the lease; another run's is refused, a read needs none, and `finder` is the one conditional renewal, answered by the return, which is the `sessionContext` this call SENT — the object the write after it is conditional on, and the one the tracker certainly holds, a reply having passed the transport's fence strip (ISS-1219): asked for by the two writes a finder may make, a comment and an edge, and inherited by nobody, because the field writer awaits this and reads none of it, and a `false` handed back unasked would license a write on another run's issue. What it answers nothing about is whether a LIVE lease may be written past: a comment is additive and is posted anyway, an edge moves what a dispatch may take and is not, so the caller that cares reads `notAnothers` or `anothersHold` for itself — after this call, so that nothing is written having read another run's lease. The lapsed reread below is outside the option — a handoff mid-write is a handoff whoever is writing. */
export const renew = async (documentId, ref, next = undefined, patch = null, { finder = false } = {}) => {
  const holder = sessionOf();
  const context = await readContext(documentId);
  const lease = leaseOf(context);
  const state = stateOf(lease, holder);
  if (state === "free" && !finder) return takenByWriting(documentId, ref, context, next, patch);
  if (state !== "mine" && state !== "lapsed") {
    if (finder) return false;
    fail(writeRefusal(state, ref, lease));
  }
  let sent = null;
  const value = (from, held) => (sent = claimed(from, {
    holder,
    minutes: held.minutes,
    next,
    worklog: worklogFor(from, patch),
  }));
  if (state === "mine") {
    await setLease(documentId, value(context, lease), ref, () => context);
    return sent;
  }
  /* Lapsed is the one another run may take: the last read decides, and the notice waits for the write. */
  let renewed = null;
  let read = null;
  await setLease(documentId, async () => {
    const again = await readContext(documentId);
    const now = leaseOf(again);
    const state = stateOf(now, holder);
    if (state !== "mine" && state !== "lapsed") fail(writeRefusal(state, ref, now));
    if (state === "lapsed") renewed = now;
    read = again;
    return value(again, now);
  }, ref, () => read);
  if (renewed) console.error(renewedLapsed(ref, renewed));
  return sent;
};

/** The take itself, apart from the verb that prints it, so the landing task and `forge claim --take` cannot come to disagree about what licenses one. */
export const takeLease = async (documentId, ref, context,
  { holder, minutes = MINUTES, line = undefined, patch = null, status = null }) => {
  /* Where the id came from is this session's to say only where the holder is this session. */
  const mine = sessionSourced();
  const source = mine.id === holder ? mine.source : null;
  const held = landingOf(context);
  const refused = takeRefusal(ref, held, holder, leaseOf(context), { source });
  if (refused) fail(refused);
  /* Spent by every take at that state, the judge's own included: a marker the judge's own take left
     behind would make the lander lease it goes on to hold a third run's to take. */
  const landing = held?.state === LANDING_JUDGED && held.judge ? { ...held, judge: "" } : undefined;
  const next = claimed(context, {
    holder, minutes, next: line, worklog: worklogFor(context, patch),
    how: "take", status, landing,
  });
  await setLease(documentId, next, ref, () => context);
  return leaseOf(next);
};

/* Every landing state is written here and nowhere else, which is what makes the landing's own writes one function's business to hold to (ISS-673): the state it moves from is the one the field holds at the moment of the write, not the one the caller last read, and a move the table refuses is refused before the field is touched. The lease is checked and renewed here rather than by the field writer, whose `sessionContext` row renews nothing — that row is how a claim writes a lease without recursing, and a landing step is a payload write like any other: a gate outlasting the lease must not push under another run's. */
export const landingSaved = async (documentId, ref, patch) => {
  const holder = sessionOf();
  let saved = null;
  let read = null;
  await setLease(documentId, async () => {
    const context = await readContext(documentId);
    read = context;
    const lease = leaseOf(context);
    const state = stateOf(lease, holder);
    /* Refused where `renew` takes, this being no first write on untouched work: a landing state exists only where a build already carried the issue past the statuses a run is dispatched at, so an empty field here is the anomaly and not the opening. What it owed and did not have was the right claim to name (ISS-1252). */
    if (state === "free") fail(freeRefusal(ref, await statusFor(documentId), context));
    if (state !== "mine" && state !== "lapsed") fail(writeRefusal(state, ref, lease));
    const held = landingOf(context);
    const refused = landingNext(held, patch.state);
    if (refused) {
      fail(`the landing on ${ref} cannot move to \`${patch.state}\`: ${refused}. ${READ_THE_STATE(ref)}`);
    }
    saved = { ...held, ...patch };
    return claimed(context, {
      holder, minutes: lease.minutes, landing: saved,
    });
  }, ref, () => read);
  return landingOf({ [LANDING]: saved });
};
