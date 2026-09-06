/* Every verb setting a field of the issue writes it here: one home for the cap, the renewal, the
   comment delivery and the read-back, which is why it imports upward (ISS-346, ISS-451). */
import { declaredFor, scoped, write } from "./rpc.mjs";
import { mustBeShown } from "./comments.mjs";
import { leaseLandedAs, leaseMismatch, renew } from "../flow/lease.mjs";

const NOTE_HALVES = ["section", "userFacing", "technical"];

export const landedAs = (held, sent) => String(held ?? "").trim() === String(sent).trim();

export const noteLandedAs = (held, sent) =>
  NOTE_HALVES.every((key) => (held?.[key] ?? null) === (sent?.[key] ?? null));

export const storedNotEmpty = (held) => Boolean(String(held ?? "").trim());

/* Comparator, cap, gate and renewal are the field's, never a caller's argument, and renewal is what a
   write here means, so only a row that does not renew says so. Built on first use: `lease.mjs` imports back. */
let rows = null;
const fields = () => (rows ??= {
  plan: {
    same: storedNotEmpty,
    said: (ref) => `The update answered success but ${ref} still has no plan. Nothing was stored.`,
  },
  acceptanceCriteria: { same: landedAs },
  releaseNotes: { same: noteLandedAs, halves: NOTE_HALVES },
  sessionContext: { same: leaseLandedAs, said: leaseMismatch, shows: true, renews: false },
});

const mismatch = (field, ref, back) =>
  fields()[field].said?.(ref, back)
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
export const capChecked = (field, caps, sent, given, refuse) => {
  const row = fields()[field];
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

export const writeField = async (documentId, field, value, { ref, next, patch, refuse }) => {
  const row = fields()[field];
  if (!row) {
    refuse(`${field} is not a field this writer sets. It takes ${Object.keys(fields()).join(", ")}.`);
  }
  const caps = capsOf();
  if (row.shows) await mustBeShown([{ ref, documentId }]);
  if (row.renews !== false) await renew(documentId, ref, next, patch);
  const given = typeof value === "function" ? await value() : value;
  let sent = given;
  await write("forge_issues", { action: "update", documentId, data: { [field]: given } }, (data) => {
    sent = data?.[field] ?? given;
    capChecked(field, caps, sent, given, refuse);
  });
  const back = await scoped("forge_issues", { action: "get", documentId, fields: [field] });
  if (!row.same(back?.[field], sent)) refuse(mismatch(field, ref, back?.[field]));
  return back?.[field];
};
