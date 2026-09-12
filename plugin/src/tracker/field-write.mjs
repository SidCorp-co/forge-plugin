/* Every verb setting a field of the issue writes it here: one home for the cap, the renewal, the
   comment delivery, the read-back and the precondition, which is why it imports upward (ISS-346,
   ISS-451). Whether the far end honours a precondition, and why only a refusal answers that: below,
   and docs/cli/the-precondition.md. */
import { randomUUID } from "node:crypto";

import { declaredFor, scoped, write } from "./rest.mjs";
import { mustBeShown } from "./comments.mjs";
import { askedInSource, shortOfAsk } from "../resolve/flags.mjs";
import { leaseLandedAs, leaseMismatch, renew } from "../flow/lease.mjs";

const NOTE_HALVES = ["section", "userFacing", "technical"];
export const MOVED = "SESSION_CONTEXT_MISMATCH";
const REFUSED_BODY = "BAD_REQUEST";
const PROBE = "forge.cas-probe";

const codeOf = (refusal) => String(refusal ?? "").split(":")[0].trim();

export const moved = (refusal) => codeOf(refusal) === MOVED;

const cannotHold = () => ({ sessionContext: { [PROBE]: randomUUID() } });

const expecting = (context) => ({ sessionContext: context ?? null });

/* One variable and not a map keyed by endpoint: a process talks to the endpoint its configuration names and to no other, and reading that name here would make the sentence `forge claim` prints depend on a configuration a run printing it may not have. */
let enforced = null;

export const enforcementOf = () => enforced;

const settle = (answer) => (enforced = answer);

export const forgetEnforcement = () => (enforced = null);

const establish = async (send) => {
  const asked = await send(cannotHold());
  if (!asked?.refused) {
    settle(false);
    return asked;
  }
  if (moved(asked.refused)) {
    settle(true);
    return null;
  }
  if (codeOf(asked.refused) !== REFUSED_BODY) return asked;
  const again = await send(null);
  if (!again?.refused) settle(false);
  return again;
};

export const landedAs = (held, sent) => String(held ?? "").trim() === String(sent).trim();

export const noteLandedAs = (held, sent) =>
  NOTE_HALVES.every((key) => (held?.[key] ?? null) === (sent?.[key] ?? null));

export const storedNotEmpty = (held) => Boolean(String(held ?? "").trim());

/* Comparator, cap, gate and renewal are the field's, never a caller's argument, and renewal is what a write here means, so only a row that does not renew says so. Built on first use: `lease.mjs` imports back. A recorded override writes under a row of its own, the tracker judging a field this CLI declares no cap and no comparator of, so what came back is compared with what was sent and nothing else. */
let rows = null;
const fields = () => (rows ??= {
  plan: {
    same: storedNotEmpty,
    said: (ref) => `The update answered success but ${ref} still has no plan. Nothing was stored.`,
  },
  acceptanceCriteria: { same: landedAs },
  releaseNotes: { same: noteLandedAs, halves: NOTE_HALVES },
  sessionContext: { same: leaseLandedAs, said: leaseMismatch, shows: true, renews: false, expects: true },
});

const mismatch = (row, field, ref, back) =>
  row.said?.(ref, back)
  ?? `The update answered success but ${field} did not read back as written. Nothing to rely on.`;

/* Code points, and never above the code-unit count: it can only miss a refusal. */
export const lengthOf = (value) => [...String(value)].length;

/* The routes refuse a bad length without naming the number, so the number is declared beside them. */
export const capsOf = () => declaredFor("forge_issues", "caps");

/* Both lengths where a rewrite moved it, the tracker measuring what it was sent (ISS-430). */
const NOTHING_SENT = " Nothing was sent.";

const capClause = (where, cap, sent, given) => {
  const posted = lengthOf(sent);
  const wrote = lengthOf(given);
  const over = posted - cap;
  return `${where} is capped at ${cap} code points and this one is ${posted}. `
    + (wrote === posted
      ? `Shorten it by ${over}.`
      : `You wrote ${wrote}; this project rewrites ${where} on the way out and the tracker measures `
        + `the rewrite, so ${over} has to come off what was posted, not off what you typed.`);
};

export const capRefusal = (where, cap, sent, given) => capClause(where, cap, sent, given) + NOTHING_SENT;

/* Synchronous on purpose: `write` does not await this, so a promise would let the send go ahead.
   Every over-cap half at once, too — refusing inside the loop cost a round per half (ISS-325). */
export const capChecked = (field, caps, sent, given, refuse, row) => {
  const held = caps[field] ?? { self: null, halves: {} };
  if (!row.halves) {
    if (held.self !== null && lengthOf(sent) > held.self) refuse(capRefusal(field, held.self, sent, given));
    return;
  }
  const over = row.halves
    .map((half) => ({ half, cap: held.halves?.[half] ?? null, value: sent?.[half] }))
    .filter(({ cap, value }) => cap !== null && typeof value === "string" && lengthOf(value) > cap)
    .map(({ half, cap, value }) => capClause(`${field}.${half}`, cap, value, given?.[half] ?? value));
  if (over.length) refuse(over.join(" ") + NOTHING_SENT);
};

/* Which names the update route takes is the tracker's and is declared nowhere here, so a name it has
   no column for is judged on the way back, where its answer is two reasons and neither is ours (ISS-931). */
const UNRECOGNISED = /Unrecognized key: "([^"]+)"/u;

export const unrecognisedRefusal = (refused, ref) => {
  const name = UNRECOGNISED.exec(String(refused ?? ""))?.[1];
  if (!name) return null;
  return `${name} is not a field the tracker's update route takes, so it refused the call and `
    + `nothing of it was written. Which names it does take is the tracker's and is declared nowhere `
    + `here; \`forge issue ${ref} --full\` prints the fields this issue carries, and each one this `
    + "flag will not write is refused by name with the call that does write it.";
};

/** The one reader of the table, so a caller that has to hand a row on holds the same one the writer would. */
export const rowOf = (field) => fields()[field];

export const ownsField = (field) => Boolean(rowOf(field));

/** Every field of one write, in one update, so a caller naming several either writes all of them or names none as written. The gate and the renewal are the write's rather than each field's, and the read-back reports per field because a `PATCH` the tracker refuses for one key documents nothing about the others. */
export const writeFields = async (documentId, given, { ref, next, patch, refuse, partly, ask, expect, override = false }) => {
  const rows = given.map(({ field, value }) => {
    const row = override ? { same: landedAs } : rowOf(field);
    if (!row) {
      refuse(`${field} is not a field this writer sets. It takes ${Object.keys(fields()).join(", ")}.`);
    }
    return { field, value, row };
  });
  /* What the call asked for, before the renewal, which writes the lease's own field through this same writer: a comparison beside the send would refuse a short call only after an update had gone out (ISS-945). Being the one place a field is written says where a write goes and nothing about where its instruction came from, so a call reaching here with no ask at all is refused too. */
  const short = shortOfAsk(ask, rows);
  if (short) refuse(short);
  const caps = capsOf();
  if (rows.some((one) => one.row.shows)) await mustBeShown([{ ref, documentId }]);
  const renews = rows.some((one) => one.row.renews !== false);
  /* The renewal's own answer is the payload write's precondition — the lease as this process left it a moment ago, so a reclaim landing between the two refuses the payload rather than overwriting it. The object the renewal SENT and never a reply read back: the transport strips the tracker's fence out of every string of every answer and the tracker stores what it was sent, so only the sent copy is certainly the stored one (ISS-1219). A row declaring a precondition of its own is the lease's, which brings the value it read; and where nothing has established whether this far end honours one, the establishing write is this write, whose answer either settles it and stands as the write, or is nothing at all and the write is still owed. docs/cli/the-precondition.md. */
  const renewed = renews ? await renew(documentId, ref, next, patch) : null;
  const data = {};
  for (const one of rows) {
    one.given = typeof one.value === "function" ? await one.value() : one.value;
    one.sent = one.given;
    data[one.field] = one.given;
  }
  const asks = rows.some((one) => one.row.expects) && Boolean(expect);
  const held = asks ? await expect() : renewed;
  const send = (given, soft) => write(
    "forge_issues",
    { action: "update", documentId, data, ...(given ? { expect: given } : {}) },
    (posted) => {
      for (const one of rows) {
        one.sent = posted?.[one.field] ?? one.given;
        capChecked(one.field, caps, one.sent, one.given, refuse, one.row);
      }
    },
    soft,
  );
  const asked = asks && enforcementOf() === null ? await establish((one) => send(one, true)) : null;
  if (asked?.refused) refuse(asked.refused);
  const covered = enforcementOf() === true && (asks || Boolean(held));
  /* Soft on the override arm alone, the one caller sending a name no row above declares. */
  if (!asked) {
    const answer = await send(covered ? expecting(held ?? null) : null, override);
    if (answer?.refused) refuse(unrecognisedRefusal(answer.refused, ref) ?? answer.refused);
  }
  /* The lease's own read-back was the compare-and-set this CLI made in the tracker's stead, so where the tracker made it that read is not spent; every other field's answers whether the text landed, which is a different question no precondition replaces. Nothing reads a lease write's return, which is why dropping the read leaves it null rather than owing a call for it. */
  const owed = rows.filter((one) => !(covered && one.row.expects));
  if (!owed.length) return null;
  const back = await scoped("forge_issues", { action: "get", documentId, fields: owed.map((one) => one.field) });
  const wrong = owed.filter((one) => !one.row.same(back?.[one.field], one.sent));
  if (!wrong.length) return back;
  /* A field that read back as written has moved, and the caller's record of why is owed before this exits: refusing on its neighbour would leave the tracker holding a value with nothing on the page saying who set it. */
  const landed = owed.filter((one) => !wrong.includes(one)).map(({ field, value }) => ({ field, value }));
  if (landed.length) await partly?.(landed);
  refuse([
    ...wrong.map((one) => mismatch(one.row, one.field, ref, back?.[one.field])),
    ...(landed.length ? [`${landed.map((one) => one.field).join(", ")} did read back as written and stands.`] : []),
  ].join(" "));
  return back;
};

/** One field, which is what every caller but the recorded override wants, and the value it read back rather than the row whole. Its ask is the field name its caller already passed, named here on that caller's behalf: a source's own word for one thing, which is why no record writer and not the lease states one of its own. */
export const writeField = async (documentId, field, value, options) =>
  (await writeFields(documentId, [{ field, value }],
    { ...options, ask: askedInSource(options?.ref ?? "this write", field) }))?.[field];
