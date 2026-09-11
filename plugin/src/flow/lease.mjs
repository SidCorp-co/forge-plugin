/* The issue's session field read as a lease, and what a build ready to land leaves beside it. Every write it covers carries the value it read, and the tracker refuses one whose value moved. docs/cli/claim.md, docs/cli/the-precondition.md. */
import { ASKED, INHERITED, INHERITED_MEANS, OWN_ID, WORKTREE, sessionOf, sessionSourced, sessionWriting } from "../resolve/config.mjs";
import { RUN_ID, RUN_ID_VAR, besideGit, runFor, runIdAt } from "../resolve/session/run-id.mjs";
import { TAKEABLE } from "../rank/weights.mjs";
import { fail } from "../resolve/settings.mjs";
import { shortSha } from "../tracker/evidence.mjs";
import { enforcementOf, writeField } from "../tracker/field-write.mjs";
import { scoped, tried } from "../tracker/rest.mjs";
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

/** The other lease a write can be owed, spent by `forge claim -h` and by the refusal a payload write with no lease meets, so a run reaches it where it is stopped rather than in a document it may not open. It names no kind of write, because nothing here can tell a reading's output from a build's: the run knows whether work follows it and the CLI does not (ISS-840). */
export const nothingWorked = (ref = "<ref>") =>
  "A write that is the whole of what a run will do to the issue — a reading posted and the issue "
  + "left — takes a short lease that says so on the record, so the run after it reads a reading "
  + "rather than a reclaim:\n"
  + `  forge claim ${ref} --minutes ${READING_MINUTES} --next "nothing was worked under this lease"`;

export const RENEWED_BY_WRITING =
  "A lease is renewed only by a write the CLI makes to the issue, so a gate, a consult and a read "
  + "renew nothing.";

export const MINUTES_ASKS =
  `${RENEWED_BY_WRITING} So what --minutes asks for is the gap to this run's next write: a step `
  + "that writes nothing is the whole of what a lease has to survive.";

/* Said, not refused: `stateOf` reads an inherited holder as this run's own. docs/cli/claim.md. */
export const SHARED_HOLDER =
  `That holder id is ${INHERITED_MEANS}. A lease matching it is no proof another run is not on this `
  + `issue. ${OWN_ID}`;

export const sharedHolder = (lease, held = sessionSourced()) =>
  held.source === INHERITED && lease?.holder === held.id;

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
    next: typeof held.next === "string" && held.next ? held.next : null,
    history: Array.isArray(held.history) ? held.history : [],
  };
};

export const expiryOf = (lease) => {
  const at = Date.parse(lease?.renewedAt ?? "");
  return Number.isFinite(at) ? at + lease.minutes * 60_000 : 0;
};

const stamp = (ms) => (ms ? new Date(ms).toISOString().slice(0, 16) : "an unreadable time");

/* A lease past its duration is another run's. The holder's own lapsed one is its own state because
   the field still naming this session proves nobody took the issue; a reclaim is a handoff. */
export const stateOf = (lease, holder, now = Date.now()) => {
  if (!lease) return "free";
  const live = expiryOf(lease) > now;
  if (lease.holder === holder) return live ? "mine" : "lapsed";
  return live ? "live" : "expired";
};

export const describe = (lease) =>
  `session ${lease.holder} (${lease.agent}, pid ${lease.pid}), renewed `
  + `${stamp(Date.parse(lease.renewedAt))} for ${lease.minutes} minute(s), expiring `
  + `${stamp(expiryOf(lease))}`;

export const STOPPED = "--stopped";

/* How far past expiry the record still cannot tell a working run from a stopped one: the holder's own estimate again, so a run that asked for ten minutes is covered for ten and one that asked for four hours for four. Strictly less, so exactly one duration past expiry is anybody's again. */
export const freshLapse = (lease, now = Date.now()) => {
  const expiry = expiryOf(lease);
  return expiry > 0 && now < expiry + lease.minutes * 60_000;
};

const agoIn = (ms) => {
  const minutes = Math.round(ms / 60_000);
  return minutes < 1 ? "less than a minute ago" : `${minutes} minute(s) ago`;
};

/* Refused rather than said, alone among the lease's notices, because here the taking is the damage: the reclaim this was filed from took a live run's issue and cost it forty minutes of writes, and a line printed by the command that has already written the field warns nobody in time. It judges nothing and withholds one flag's worth — the record it describes is the one a stopped run leaves too, which is why the caller decides and this only says what is being decided (ISS-1224). */
export const reclaimRefusal = (ref, lease, now = Date.now()) =>
  `the lease on ${ref} ran out ${agoIn(now - expiryOf(lease))}, and this reclaim would take the `
  + `issue off ${describe(lease)}. ${RENEWED_BY_WRITING} A run inside one of those leaves the `
  + `record a stopped run leaves, so a lapse this fresh proves neither.`
  + `${lease.next ? ` The step it left named: ${lease.next}.` : ""}`
  + ` Ask that run: where it answers, its own next write takes the lease back. Where you have `
  + `established it stopped, say so:\n  forge claim ${ref} ${STOPPED}`;

export const UNHELD = "--unheld";

/** The line a lease left, off a field `leaseOf` reads as no lease at all: whatever emptied it took the holder and may have left the rest, and that line is the last thing the record says about the run that is gone. */
export const nextLeft = (context) => {
  const held = context?.[KEY];
  return typeof held?.next === "string" && held.next ? held.next : null;
};

/* Refused for the reason the fresh lapse is, on the other shape the same loss takes: nobody is named here, so the caller cannot ask the holder and the flag says instead that no run is on the issue. The work lines are handed in rather than read, because the opening that prints them runs past this refusal and the branch is the whole of what a second arrival needs to take the work up rather than cut it again (ISS-1183, ISS-1184). */
export const unheldRefusal = (ref, status, { next = null, work = [] } = {}) =>
  `${ref} is at \`${status}\`, past the statuses a run is dispatched at, and its lease field holds `
  + `no lease. A status that far along was reached by writes a lease covered, so the field is a run `
  + `that died or a write that erased one, and never an issue nobody has started.`
  + `${next ? ` The step the last write named: ${next}.` : ""}\n`
  + (work.length
    ? `${work.map((one) => `  ${one}`).join("\n")}\n`
    : "  the worklog names no branch, so the record says nothing about where the work went.\n")
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

/* The other object in the field, beside the lease and the worklog: what a build ready to land leaves
   for whoever lands it. One turn per state, `done` is nobody's, and which of the two successors a
   state offers is the landing task's reading of the project. docs/cli/the-checkpoint.md. */
export const LANDING = "landing";
export const LANDING_READY = "ready";
export const LANDING_BUILDER_OWED = "builder-owed";
export const LANDING_RECONCILED = "reconciled";
export const LANDING_QA_OWED = "qa-owed";
export const LANDING_JUDGED = "judged";
export const LANDING_DONE = "done";

export const LANDING_STATES = {
  ready: { turn: "lander", next: ["candidate"] },
  candidate: { turn: "lander", next: ["reconciled", "builder-owed"] },
  "builder-owed": { turn: "builder", next: ["reconciled"] },
  reconciled: { turn: "lander", next: ["qa-owed", "promoting"] },
  "qa-owed": { turn: "qa", next: ["judged"] },
  judged: { turn: "lander", next: ["promoting", "done"] },
  promoting: { turn: "lander", next: ["promoted"] },
  promoted: { turn: "lander", next: ["installed"] },
  installed: { turn: "lander", next: ["marked"] },
  marked: { turn: "lander", next: ["qa-owed", "done"] },
  done: { turn: null, next: [] },
};

/* Declared, as the record's fields are: the landing writes its own shas and its install state into
   this same object, and a key nothing here names is dropped rather than read back as a fact. `files`
   is the paths the change touched, where the worklog's `files` beside it is how many there were. */
const CHECKPOINT = ["state", "builder", "branch", "head", "base", "at", "pinned", "intended",
  "candidate", "release", "install", "deployment", "moved", "reconciled", "judge"];

export const landingOf = (context) => {
  const held = context?.[LANDING];
  if (!held || typeof held !== "object" || typeof held.state !== "string" || !held.state) return null;
  const files = (Array.isArray(held.files) ? held.files : []).map((one) => String(one).trim());
  const out = { files: files.filter(Boolean) };
  for (const name of CHECKPOINT) if (held[name]) out[name] = String(held[name]);
  return out;
};

export const landingTurn = (landing) => LANDING_STATES[landing?.state]?.turn ?? null;

/* A base that moved under a pin is built again from a fresh one — the one move the table above
   cannot carry, being backwards. Never past the push: that would void evidence for a landed release. */
export const LANDING_CANDIDATE = "candidate";
const REBUILDS = new Set([LANDING_CANDIDATE, LANDING_RECONCILED, LANDING_QA_OWED, LANDING_JUDGED, "promoting"]);

/** Blank rather than absent: `landingOf` drops what is falsy, so this is how a field is cleared. */
export const landingVoided = (pinned) => ({
  state: LANDING_CANDIDATE, pinned, candidate: "", intended: "", moved: "", reconciled: "",
  deployment: "", judge: "", release: "",
});

export const landingNext = (held, to) => {
  if (!held) return `no landing checkpoint is on it, so there is no state for \`${to}\` to follow`;
  if (!LANDING_STATES[to]) return `\`${to}\` is no landing state this version knows`;
  const row = LANDING_STATES[held.state];
  if (!row) return `it reads \`${held.state}\`, which is no state this version knows`;
  if (to === LANDING_CANDIDATE && REBUILDS.has(held.state)) return null;
  if (!row.next.includes(to)) {
    return `it reads \`${held.state}\`, whose next is ${row.next.join(" or ") || "nothing at all"}`;
  }
  return null;
};

export const landingLine = (landing) =>
  `landing \`${landing.state}\`: ${landing.branch ?? "no branch"} at ${shortSha(landing.head)}, `
  + `base ${shortSha(landing.base)}, ${landing.files.length} file(s), built by ${landing.builder}`;

const READ_THE_STATE = (ref) =>
  `Read where the landing is, and take it when the state names your turn:\n  forge resume ${ref}`;

/* `--take` is the one route that may take a lease which is still live, so what licenses it is the
   state naming the taker's turn and nothing else. A lease no longer live is anybody's by the
   reclaim rules already, which is what makes a successor eligible where the run named has gone. */
export const takeRefusal = (ref, landing, holder, lease, { now = Date.now(), source = null } = {}) => {
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
    if (landing.state === LANDING_RECONCILED && tookAt(lease, lease.holder, LANDING_BUILDER_OWED)) return null;
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
export const claimed = (context, { holder, at, minutes, next, worklog, landing, how = null, status = null }) => {
  const held = leaseOf(context);
  const history = [...(held?.history ?? [])];
  const state = landing?.state ?? landingOf(context)?.state ?? null;
  /* The outgoing line, not the incoming one: what a crash loop is asked is where each attempt died. */
  if (how) history.push({ holder, at, how, status, next: held?.next ?? null, ...(state ? { landing: state } : {}) });
  return {
    ...(context && typeof context === "object" ? context : {}),
    ...(worklog ? { [WORKLOG]: worklog } : {}),
    ...(landing ? { [LANDING]: landing } : {}),
    [KEY]: {
      holder,
      agent: agentOf(),
      pid: pidOf(),
      renewedAt: at,
      minutes,
      next: next === undefined ? held?.next ?? null : nextLine(next),
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

/* The one live lease a claim may take, and the fact that licenses it is the caller's own id rather than any judgement about the holder: a run standing in the tree cut for this issue IS the run the issue was dispatched to, and the id ISS-467 gave that tree already names which issue. Until this, a dispatcher's own lease over a triage write was waited out by the runner it had just dispatched — fifteen minutes of a 25-minute lease when this was filed, forty-five of the hour a default one runs now (ISS-1091). Three conditions keep it to the dispatch, each one a case where a live lease is work rather than a hold: the checkpoint governs wherever its state names a turn, so a landing's turns stay `--take`'s alone; the take reaches only the statuses a run is dispatched at, so a lease past them is a run at work; and a holder cut for this same issue is the run the dispatch already reached. */
export const handedOn = (key, context, status, holder = sessionOf()) => {
  const mine = runFor(holder);
  if (!mine || mine !== String(key).trim().toLowerCase()) return false;
  if (!TAKEABLE.includes(String(status))) return false;
  if (landingTurn(landingOf(context))) return false;
  return runFor(leaseOf(context)?.holder) !== mine;
};

/* One sentence per condition above, because four of them refuse here and a single way out sends three of the four back to the refusal they have just read. */
export const notHandedHere = (ref, key, context, status, holder = sessionOf(), at = process.cwd(), held = sessionSourced()) => {
  const named = String(key).trim().toLowerCase();
  if (runFor(holder) !== named) {
    /* A tree is outranked by the variable, so a route naming only the tree sends this caller back to the refusal it has just read — whether it is standing in that tree already or has still to move to it. */
    const asked = held.id === holder && held.source === ASKED
      ? ` ${RUN_ID_VAR} is what this call resolved and it outranks any tree, so unset it too.` : "";
    return `This call holds ${holder}, which names no run dispatched to ${ref}. `
      + (runFor(runIdAt(at)) === named
        ? `The tree it stands in does name one, in ${besideGit(at, RUN_ID)}, and ${RUN_ID_VAR} is `
          + `outranking it. Unset that variable and send this again.`
        : `Where this is the run ${ref} was dispatched to, make the call from the worktree cut for `
          + `it: the ${RUN_ID} beside that tree's git directory names the issue, and a lease its `
          + `dispatcher is only holding is the dispatched run's to take.${asked}`);
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

export const claimRefusal = (ref, lease, said = "") =>
  `${ref} is claimed: ${describe(lease)}. A live lease is that run's, and this claim is refused. `
  + `${alsoSay(idsHere(lease))}${lease.next ? `The step it left named: ${lease.next}. ` : ""}`
  + `${alsoSay(said)}Wait for it, or take it once it expires:\n  forge claim ${ref}`;

const WRITE_REFUSAL = {
  free: (ref) =>
    `${ref} carries no lease, and a payload write is the holder's. Take it first:\n  forge claim ${ref}\n`
    + nothingWorked(ref),
  live: (ref, lease) =>
    `${ref} is held by another run: ${describe(lease)}. Its payload writes are that run's, so this `
    + `one is refused. ${alsoSay(idsHere(lease))}Take the lease once it expires:\n  forge claim ${ref}`,
  expired: (ref, lease) =>
    `the lease on ${ref} is another run's and has expired: ${describe(lease)}. A write of yours `
    + `beside it is stale. ${alsoSay(idsHere(lease))}Reclaim it first:\n  forge claim ${ref}`,
};

export const writeRefusal = (state, ref, lease) => WRITE_REFUSAL[state](ref, lease);

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
  const answer = await (soft ? tried : scoped)("forge_issues", { action: "get", documentId, fields: [FIELD] });
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
export const setLease = async (documentId, value, ref, on) =>
  writeField(documentId, FIELD, value, { ref, refuse: fail, expect: on });

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

/* Every payload write renews the lease; another run's is refused, a read needs none, and `finder` is the one conditional renewal, answered by the return, which is the `sessionContext` this call SENT — the object the write after it is conditional on, and the one the tracker certainly holds, a reply having passed the transport's fence strip (ISS-1219): asked for by the two writes a finder may make, a comment and an edge, and inherited by nobody, because the field writer awaits this and reads none of it, and a `false` handed back unasked would license a write on another run's issue. What it answers nothing about is whether a LIVE lease may be written past: a comment is additive and is posted anyway, an edge moves what a dispatch may take and is not, so the caller that cares reads `notAnothers` or `anothersHold` for itself — after this call, so that nothing is written having read another run's lease. The lapsed reread below is outside the option — a handoff mid-write is a handoff whoever is writing. */
export const renew = async (documentId, ref, next = undefined, patch = null, { finder = false } = {}) => {
  const holder = sessionOf();
  const context = await readContext(documentId);
  const lease = leaseOf(context);
  const state = stateOf(lease, holder);
  if (state !== "mine" && state !== "lapsed") {
    if (finder) return false;
    fail(writeRefusal(state, ref, lease));
  }
  let sent = null;
  const value = (from, held) => (sent = claimed(from, {
    holder,
    at: new Date().toISOString(),
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
    holder, at: new Date().toISOString(), minutes, next: line, worklog: worklogFor(context, patch),
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
    if (state !== "mine" && state !== "lapsed") fail(writeRefusal(state, ref, lease));
    const held = landingOf(context);
    const refused = landingNext(held, patch.state);
    if (refused) {
      fail(`the landing on ${ref} cannot move to \`${patch.state}\`: ${refused}. ${READ_THE_STATE(ref)}`);
    }
    saved = { ...held, ...patch };
    return claimed(context, {
      holder, at: new Date().toISOString(), minutes: lease.minutes, landing: saved,
    });
  }, ref, () => read);
  return landingOf({ [LANDING]: saved });
};
