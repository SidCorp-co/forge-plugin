/* The issue's session field, read as a lease: who holds it, until when, the one line naming the
   step they are on, and the claims before this one. The tracker has no conditional write (ISS-7),
   so a write here is a read-back compare and the claim says so out loud. docs/cli/claim.md. */
import { sessionOf } from "../resolve/config.mjs";
import { fail } from "../resolve/settings.mjs";
import { mustBeShown } from "../tracker/comments.mjs";
import { scoped, write } from "../tracker/rpc.mjs";
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

const UNKNOWN = "unknown";

export const agentOf = () => process.env.AI_AGENT || UNKNOWN;
export const pidOf = () => process.env.CLAUDE_PID || UNKNOWN;

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

/* Read, not passed: a caller that could supply the writer's own identity could supply a false one.
   Silence about `next` means unchanged, or a claim would drop the note the dead run left. */
export const claimed = (context, { holder, at, minutes, next, worklog, how = null, status = null }) => {
  const held = leaseOf(context);
  const history = [...(held?.history ?? [])];
  /* The outgoing line, not the incoming one: what a crash loop is asked is where each attempt died. */
  if (how) history.push({ holder, at, how, status, next: held?.next ?? null });
  return {
    ...(context && typeof context === "object" ? context : {}),
    ...(worklog ? { [WORKLOG]: worklog } : {}),
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

/* The compare-and-set the tracker owes (ISS-7): it cannot stop another run's write, only refuse —
   and the one place every payload write reaches, so the unshown comments are delivered here. */
export const setLease = async (documentId, value, ref) => {
  await mustBeShown([{ ref, documentId }]);
  /* A thunk runs here, after the gate: it is a round trip, and a write is built on the last read. */
  const next = typeof value === "function" ? await value() : value;
  await write("forge_issues", { action: "update", documentId, data: { [FIELD]: next } });
  const back = await readContext(documentId);
  if (canonical(back) !== canonical(next)) {
    const held = leaseOf(back);
    fail(
      `The lease on ${ref} did not read back as written${held ? `: ${describe(held)} holds it` : ""}. `
      + `Another run wrote the field between the read and the write, and nothing here is yours to `
      + `build on. Read the record, then claim again:\n  forge claim ${ref}`,
    );
  }
  return next;
};

/* An edge touches two issues and one of them is being worked: the other is only checked, so a
   blocker just filed, holding no lease at all, can still be named. */
export const notAnothers = async (documentId, ref) => {
  const lease = leaseOf(await readContext(documentId));
  if (stateOf(lease, sessionOf()) === "live") fail(writeRefusal("live", ref, lease));
};

/* Every payload write renews the lease; another run's is refused, and a read needs none. */
export const renew = async (documentId, ref, next = undefined, patch = null) => {
  const holder = sessionOf();
  const context = await readContext(documentId);
  const lease = leaseOf(context);
  const state = stateOf(lease, holder);
  if (state !== "mine" && state !== "lapsed") fail(writeRefusal(state, ref, lease));
  const value = (from, held) => claimed(from, {
    holder,
    at: new Date().toISOString(),
    minutes: held.minutes,
    next,
    worklog: worklogFor(from, patch),
  });
  if (state === "mine") return setLease(documentId, value(context, lease), ref);
  /* Lapsed is the one another run may take: the last read decides, and the notice waits for the write. */
  let renewed = null;
  const written = await setLease(documentId, async () => {
    const again = await readContext(documentId);
    const now = leaseOf(again);
    const state = stateOf(now, holder);
    if (state !== "mine" && state !== "lapsed") fail(writeRefusal(state, ref, now));
    if (state === "lapsed") renewed = now;
    return value(again, now);
  }, ref);
  if (renewed) console.error(renewedLapsed(ref, renewed));
  return written;
};
