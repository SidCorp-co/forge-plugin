/* The issue's session field, read as a lease: a holder, a renew time, a duration and the claims
   before this one. The tracker has no conditional write (ISS-7), so a write here is a read-back
   compare and the claim says so out loud. docs/FORGE-CLI.md. */
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { configDir, readJson, writeJsonPrivate } from "./resolve/config.mjs";
import { fail } from "./resolve/settings.mjs";
import { scoped, write } from "./rpc.mjs";

export const FIELD = "sessionContext";
export const KEY = "lease";
export const MINUTES = 30;
export const RECLAIMS_BEFORE_PARK = 2;
const HISTORY_KEPT = 12;

export const ADVISORY =
  "The lease is advisory: the tracker refuses no stale write yet (ISS-7), so two runs that both "
  + "find no lease both claim, and the later write erases the earlier. A project running more than "
  + "one agent at a time needs the tracker's refusal before it can trust this.";

const sessionPath = () => join(configDir("forge"), "session.json");

/* The file names a machine, where two runs look like one holder and neither is refused. */
export const sessionOf = () => {
  const given = process.env.FORGE_SESSION_ID || process.env.CLAUDE_CODE_SESSION_ID;
  if (given) return given;
  const held = readJson(sessionPath())?.session;
  if (held) return held;
  const minted = `machine-${randomUUID()}`;
  try {
    mkdirSync(configDir("forge"), { recursive: true });
    writeJsonPrivate(sessionPath(), { session: minted });
  } catch {
    /* A session id that cannot be saved is a holder for this process alone, never a failed call. */
  }
  return minted;
};

export const leaseOf = (context) => {
  const held = context?.[KEY];
  if (!held || typeof held !== "object" || typeof held.holder !== "string" || !held.holder) return null;
  const minutes = Number(held.minutes);
  return {
    holder: held.holder,
    renewedAt: String(held.renewedAt ?? ""),
    minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : MINUTES,
    history: Array.isArray(held.history) ? held.history : [],
  };
};

export const expiryOf = (lease) => {
  const at = Date.parse(lease?.renewedAt ?? "");
  return Number.isFinite(at) ? at + lease.minutes * 60_000 : 0;
};

const stamp = (ms) => (ms ? new Date(ms).toISOString().slice(0, 16) : "an unreadable time");

/* A lease past its duration is stale for its holder too: a run that took over meanwhile is what
   the tracker cannot yet refuse. A reclaim is a handoff, so a holder taking its own lapsed lease
   appends none and counts toward no park. */
export const stateOf = (lease, holder, now = Date.now()) => {
  if (!lease) return "free";
  const live = expiryOf(lease) > now;
  if (lease.holder === holder) return live ? "mine" : "lapsed";
  return live ? "live" : "expired";
};

export const describe = (lease) =>
  `session ${lease.holder}, renewed ${stamp(Date.parse(lease.renewedAt))} for ${lease.minutes} `
  + `minute(s), expiring ${stamp(expiryOf(lease))}`;

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

export const claimed = (context, { holder, at, minutes, how = null, status = null }) => {
  const held = leaseOf(context);
  const history = [...(held?.history ?? [])];
  if (how) history.push({ holder, at, how, status });
  return {
    ...(context && typeof context === "object" ? context : {}),
    [KEY]: { holder, renewedAt: at, minutes, history: history.slice(-HISTORY_KEPT) },
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
  lapsed: (ref, lease) =>
    `your own lease on ${ref} has expired: ${describe(lease)}. Past its duration another run may `
    + `have taken the issue, and nothing here would have refused it. Take it again:\n  forge claim ${ref}`,
};

export const writeRefusal = (state, ref, lease) => WRITE_REFUSAL[state](ref, lease);

/* Key-order-blind: the tracker returns the object it stored in its own order, so a plain
   serialisation of the two differs where nothing changed. */
export const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
};

export const readContext = async (documentId) =>
  (await scoped("forge_issues", { action: "get", documentId, fields: [FIELD] }))?.[FIELD] ?? null;

/* The compare-and-set the tracker owes (ISS-7): it cannot stop another run's write, only refuse. */
export const setLease = async (documentId, next, ref) => {
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

/* Every payload write renews the lease; a write by anyone else is refused, and a read needs none. */
export const renew = async (documentId, ref) => {
  const holder = sessionOf();
  const context = await readContext(documentId);
  const lease = leaseOf(context);
  const state = stateOf(lease, holder);
  if (state !== "mine") fail(writeRefusal(state, ref, lease));
  return setLease(
    documentId,
    claimed(context, { holder, at: new Date().toISOString(), minutes: lease.minutes }),
    ref,
  );
};
