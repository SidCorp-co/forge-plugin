/* Every verb setting a field of the issue writes it here: one home for the cap, the renewal, the
   comment delivery and the read-back, which is why it imports upward (ISS-346, ISS-451). */
import { declaredFor, scoped, write } from "./rest.mjs";
import { mustBeShown } from "./comments.mjs";
import { leaseLandedAs, leaseMismatch, renew } from "../flow/lease.mjs";

const NOTE_HALVES = ["section", "userFacing", "technical"];

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
  sessionContext: { same: leaseLandedAs, said: leaseMismatch, shows: true, renews: false },
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

/** The one reader of the table, so a caller that has to hand a row on holds the same one the writer would. */
export const rowOf = (field) => fields()[field];

export const ownsField = (field) => Boolean(rowOf(field));

/** Every field of one write, in one update, so a caller naming several either writes all of them or names none as written. The gate and the renewal are the write's rather than each field's, and the read-back reports per field because a `PATCH` the tracker refuses for one key documents nothing about the others. */
export const writeFields = async (documentId, given, { ref, next, patch, refuse, partly, override = false }) => {
  const rows = given.map(({ field, value }) => {
    const row = override ? { same: landedAs } : rowOf(field);
    if (!row) {
      refuse(`${field} is not a field this writer sets. It takes ${Object.keys(fields()).join(", ")}.`);
    }
    return { field, value, row };
  });
  const caps = capsOf();
  if (rows.some((one) => one.row.shows)) await mustBeShown([{ ref, documentId }]);
  if (rows.some((one) => one.row.renews !== false)) await renew(documentId, ref, next, patch);
  const data = {};
  for (const one of rows) {
    one.given = typeof one.value === "function" ? await one.value() : one.value;
    one.sent = one.given;
    data[one.field] = one.given;
  }
  await write("forge_issues", { action: "update", documentId, data }, (posted) => {
    for (const one of rows) {
      one.sent = posted?.[one.field] ?? one.given;
      capChecked(one.field, caps, one.sent, one.given, refuse, one.row);
    }
  });
  const back = await scoped("forge_issues", { action: "get", documentId, fields: rows.map((one) => one.field) });
  const wrong = rows.filter((one) => !one.row.same(back?.[one.field], one.sent));
  if (!wrong.length) return back;
  /* A field that read back as written has moved, and the caller's record of why is owed before this exits: refusing on its neighbour would leave the tracker holding a value with nothing on the page saying who set it. */
  const landed = rows.filter((one) => !wrong.includes(one)).map(({ field, value }) => ({ field, value }));
  if (landed.length) await partly?.(landed);
  refuse([
    ...wrong.map((one) => mismatch(one.row, one.field, ref, back?.[one.field])),
    ...(landed.length ? [`${landed.map((one) => one.field).join(", ")} did read back as written and stands.`] : []),
  ].join(" "));
  return back;
};

/** One field, which is what every caller but the recorded override wants, and the value it read back rather than the row whole. */
export const writeField = async (documentId, field, value, options) =>
  (await writeFields(documentId, [{ field, value }], options))?.[field];
