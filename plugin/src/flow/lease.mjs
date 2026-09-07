/* The issue's session field, read as a lease: who holds it, until when, the one line naming the
   step they are on, and the claims before this one. The tracker has no conditional write (ISS-7),
   so a write here is a read-back compare and the claim says so out loud. docs/cli/claim.md. */
import { INHERITED, INHERITED_MEANS, OWN_ID, sessionOf, sessionSourced } from "../resolve/config.mjs";
import { fail } from "../resolve/settings.mjs";
import { shortSha } from "../tracker/evidence.mjs";
import { writeField } from "../tracker/field-write.mjs";
import { scoped } from "../tracker/rpc.mjs";
import { KEY as WORKLOG, worklogFor } from "./worklog.mjs";

export const FIELD = "sessionContext";
export const KEY = "lease";
export const MINUTES = 30;
export const RECLAIMS_BEFORE_PARK = 2;
const HISTORY_KEPT = 12;

export const ADVISORY =
  "The lease is advisory: the tracker refuses no stale write yet (ISS-7), so two runs that both "
  + "find no lease both claim, and the later write erases the earlier. A project running more than "
  + "one agent at a time needs the tracker's refusal before it can trust this.";

/* Said, not refused: `stateOf` reads an inherited holder as this run's own. docs/cli/claim.md. */
export const SHARED_HOLDER =
  `That holder id is ${INHERITED_MEANS}. A lease matching it is no proof another run is not on this `
  + `issue. ${OWN_ID}`;

export const sharedHolder = (lease, held = sessionSourced()) =>
  held.source === INHERITED && lease?.holder === held.id;

const UNKNOWN = "unknown";

export const agentOf = () => process.env.AI_AGENT || UNKNOWN;
export const pidOf = () => process.env.CLAUDE_PID || UNKNOWN;

/* A shape's `written` field is filled from the session here and refused as a flag where the payload is gathered, for the reason `claimed` below states. Here, beside the other two the environment answers for. */
export const writtenBy = (shape) =>
  Object.fromEntries(shape.fields.filter((one) => one.written).map((one) => [one.flag, sessionOf()]));

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

/* A lease past its duration is another run's to take. The holder's own lapsed lease is a state of
   its own because the field still naming this session is the proof no other run took the issue: a
   reclaim would read as live or expired. A reclaim is a handoff, so retaking one's own appends none. */
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

/* The other object in the field, beside the lease and the worklog: what a build ready to land
   leaves for whoever lands it. One turn per state, and `done` is nobody's; three states offer two
   successors because a project judges its deployment before the merge or after it, and the route
   walked is the landing task's reading rather than this table's. docs/cli/claim.md. */
export const LANDING = "landing";
export const LANDING_READY = "ready";

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
  "candidate", "release", "install", "deployment", "moved", "reconciled"];

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
const REBUILDS = new Set([LANDING_CANDIDATE, "reconciled", "qa-owed", "judged", "promoting"]);

/** Blank rather than absent: `landingOf` drops what is falsy, so this is how a field is cleared. */
export const landingVoided = (pinned) => ({
  state: LANDING_CANDIDATE, pinned, candidate: "", intended: "", moved: "", reconciled: "", deployment: "",
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
      if (!live) return null;
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
        + `comes back at \`builder-owed\` and nowhere else. ${READ_THE_STATE(ref)}`;
    }
    if (!live || lease.holder === holder || lease.holder === landing.builder) return null;
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

export const claimRefusal = (ref, lease) =>
  `${ref} is claimed: ${describe(lease)}. A live lease is that run's, and this claim is refused. `
  + `Wait for it, or take it once it expires:\n  forge claim ${ref}`;

const WRITE_REFUSAL = {
  free: (ref) =>
    `${ref} carries no lease, and a payload write is the holder's. Take it first:\n  forge claim ${ref}`,
  live: (ref, lease) =>
    `${ref} is held by another run: ${describe(lease)}. Its payload writes are that run's, so this `
    + `one is refused. Take the lease once it expires:\n  forge claim ${ref}`,
  expired: (ref, lease) =>
    `the lease on ${ref} is another run's and has expired: ${describe(lease)}. A write of yours `
    + `beside it is stale. Reclaim it first:\n  forge claim ${ref}`,
};

export const writeRefusal = (state, ref, lease) => WRITE_REFUSAL[state](ref, lease);

/* Said rather than refused (ISS-65): the command the old refusal named is one this write can make. */
export const renewedLapsed = (ref, lease) =>
  `your lease on ${ref} had expired at ${stamp(expiryOf(lease))} and this write renewed it: the read `
  + `before it still named ${lease.holder}, so no other run had taken the issue by then. A reclaim is `
  + `a handoff and this was none, so the claim history is unchanged.`;

/** What a finder's write says about the lease it did not take, here rather than at its one call site because every other lease sentence is here; `renew`'s `{ finder: true }` answer is the argument. */
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

export const readContext = async (documentId) =>
  (await scoped("forge_issues", { action: "get", documentId, fields: [FIELD] }))?.[FIELD] ?? null;

/* The compare-and-set the tracker owes (ISS-7): it cannot stop another run's write, only refuse. The
   write itself is the field writer's, and `sessionContext`'s row there is where these three are spent. */
export const leaseLandedAs = (held, sent) => canonical(held) === canonical(sent);

export const leaseMismatch = (ref, back) => {
  const held = leaseOf(back);
  return `The lease on ${ref} did not read back as written${held ? `: ${describe(held)} holds it` : ""}. `
    + `Another run wrote the field between the read and the write, and nothing here is yours to `
    + `build on. Read the record, then claim again:\n  forge claim ${ref}`;
};

export const setLease = async (documentId, value, ref) =>
  writeField(documentId, FIELD, value, { ref, refuse: fail });

/* An edge touches two issues and one of them is being worked: the other is only checked, so a
   blocker just filed, holding no lease at all, can still be named. */
export const notAnothers = async (documentId, ref) => {
  const lease = leaseOf(await readContext(documentId));
  if (stateOf(lease, sessionOf()) === "live") fail(writeRefusal("live", ref, lease));
};

/* Every payload write renews the lease; another run's is refused, a read needs none, and `finder` is the one conditional renewal, answered by the return: asked for by `forge comment` alone and inherited by nobody, because the field writer awaits this and reads none of it, and a `false` handed back unasked would license a write on another run's issue. The lapsed reread below is outside the option — a handoff mid-write is a handoff whoever is writing. */
export const renew = async (documentId, ref, next = undefined, patch = null, { finder = false } = {}) => {
  const holder = sessionOf();
  const context = await readContext(documentId);
  const lease = leaseOf(context);
  const state = stateOf(lease, holder);
  if (state !== "mine" && state !== "lapsed") {
    if (finder) return false;
    fail(writeRefusal(state, ref, lease));
  }
  const value = (from, held) => claimed(from, {
    holder,
    at: new Date().toISOString(),
    minutes: held.minutes,
    next,
    worklog: worklogFor(from, patch),
  });
  if (state === "mine") {
    await setLease(documentId, value(context, lease), ref);
    return true;
  }
  /* Lapsed is the one another run may take: the last read decides, and the notice waits for the write. */
  let renewed = null;
  await setLease(documentId, async () => {
    const again = await readContext(documentId);
    const now = leaseOf(again);
    const state = stateOf(now, holder);
    if (state !== "mine" && state !== "lapsed") fail(writeRefusal(state, ref, now));
    if (state === "lapsed") renewed = now;
    return value(again, now);
  }, ref);
  if (renewed) console.error(renewedLapsed(ref, renewed));
  return true;
};

/** The take itself, apart from the verb that prints it, so the landing task and `forge claim --take` cannot come to disagree about what licenses one. */
export const takeLease = async (documentId, ref, context,
  { holder, minutes = MINUTES, line = undefined, patch = null, status = null }) => {
  /* Where the id came from is this session's to say only where the holder is this session. */
  const mine = sessionSourced();
  const source = mine.id === holder ? mine.source : null;
  const refused = takeRefusal(ref, landingOf(context), holder, leaseOf(context), { source });
  if (refused) fail(refused);
  const next = claimed(context, {
    holder, at: new Date().toISOString(), minutes, next: line, worklog: worklogFor(context, patch),
    how: "take", status,
  });
  await setLease(documentId, next, ref);
  return leaseOf(next);
};

/* Every landing state is written here and nowhere else, which is what makes the landing's own writes one function's business to hold to (ISS-673): the state it moves from is the one the field holds at the moment of the write, not the one the caller last read, and a move the table refuses is refused before the field is touched. The lease is checked and renewed here rather than by the field writer, whose `sessionContext` row renews nothing — that row is how a claim writes a lease without recursing, and a landing step is a payload write like any other: a gate outlasting the lease must not push under another run's. */
export const landingSaved = async (documentId, ref, patch) => {
  const holder = sessionOf();
  let saved = null;
  await setLease(documentId, async () => {
    const context = await readContext(documentId);
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
  }, ref);
  return landingOf({ [LANDING]: saved });
};
