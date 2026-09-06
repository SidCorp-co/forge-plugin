/* Every verb setting a field of the issue writes it here: one home for the cap, the renewal, the
   comment delivery and the read-back, which is why it imports upward (ISS-346, ISS-451). */
import { scoped, toolNamed, write } from "./rpc.mjs";
import { mustBeShown } from "./comments.mjs";
import { leaseLandedAs, leaseMismatch, renew } from "../flow/lease.mjs";

const NOTE_HALVES = ["section", "userFacing", "technical"];

export const landedAs = (held, sent) => String(held ?? "").trim() === String(sent).trim();

export const noteLandedAs = (held, sent) =>
  NOTE_HALVES.every((key) => (held?.[key] ?? null) === (sent?.[key] ?? null));

/* Presence: a prose pipeline rewrites a plan at length, and equality would refuse writes that landed. */
export const storedNotEmpty = (held) => Boolean(String(held ?? "").trim());

/* Comparator, cap, gate and renewal are the field's, never a caller's argument. Built on first use
   because `flow/lease.mjs` imports back; the lease renews nothing, since `renew` writes through here. */
let rows = null;
const fields = () => (rows ??= {
  plan: {
    same: storedNotEmpty,
    renews: true,
    said: (ref) => `The update answered success but ${ref} still has no plan. Nothing was stored.`,
  },
  acceptanceCriteria: { same: landedAs, renews: true },
  releaseNotes: { same: noteLandedAs, halves: NOTE_HALVES, renews: true },
  sessionContext: { same: leaseLandedAs, said: leaseMismatch, shows: true, renews: false },
});

const mismatch = (field, ref, back) =>
  fields()[field].said?.(ref, back)
  ?? `The update answered success but ${field} did not read back as written. Nothing to rely on.`;

/* Code points, what `maxLength` counts and never above the code-unit count: it can only miss a refusal. */
export const lengthOf = (value) => [...String(value)].length;

/* A nullable field is a union, so the cap sits in a branch: reading the node caps nothing, and a check
   that never fires looks like a clean tree. */
const branches = (node) => (Array.isArray(node?.anyOf) ? node.anyOf : Array.isArray(node?.oneOf) ? node.oneOf : [node]);
/* A union takes what any branch takes: the widest cap binds, and an uncapped text branch proves none. */
const takesText = (one) => {
  const type = one?.type;
  return type === undefined || type === "string" || (Array.isArray(type) && type.includes("string"));
};
const capped = (node) => {
  const able = branches(node).filter(takesText);
  if (!able.length || able.some((one) => !Number.isFinite(one?.maxLength))) return null;
  return Math.max(...able.map((one) => one.maxLength));
};
const halvesOf = (node) => branches(node).find((one) => one?.properties)?.properties ?? {};

export const capsIn = (data) => Object.fromEntries(Object.entries(data ?? {}).map(([field, node]) => [field, {
  self: capped(node),
  halves: Object.fromEntries(Object.entries(halvesOf(node)).map(([half, child]) => [half, capped(child)])),
}]));

let declared = null;
export const capsOf = async () => {
  declared ??= capsIn((await toolNamed("forge_issues"))?.inputSchema?.properties?.data?.properties);
  return declared;
};

/* Both lengths where a rewrite moved it: the tracker measures what it was sent (ISS-430). */
export const capRefusal = (where, cap, sent, given) => {
  const posted = lengthOf(sent);
  const wrote = lengthOf(given);
  const over = posted - cap;
  return `${where} is capped at ${cap} code points and this one is ${posted}. `
    + (wrote === posted
      ? `Shorten it by ${over}.`
      : `You wrote ${wrote}; this project rewrites ${where} on the way out and the tracker measures `
        + `the rewrite, so ${over} has to come off what was posted, not off what you typed.`)
    + " Nothing was sent.";
};

/* Synchronous on purpose: `write` does not await this, so a check returning a promise would let the
   send go ahead. Everything it reads is resolved before `write` is entered. */
export const capChecked = (field, caps, sent, given, refuse) => {
  const row = fields()[field];
  const held = caps[field] ?? { self: null, halves: {} };
  if (!row.halves) {
    if (held.self !== null && lengthOf(sent) > held.self) refuse(capRefusal(field, held.self, sent, given));
    return;
  }
  for (const half of row.halves) {
    const cap = held.halves?.[half] ?? null;
    const value = sent?.[half];
    if (cap === null || typeof value !== "string") continue;
    if (lengthOf(value) > cap) refuse(capRefusal(`${field}.${half}`, cap, value, given?.[half] ?? value));
  }
};

export const writeField = async (documentId, field, value, { ref, next, patch, refuse }) => {
  const row = fields()[field];
  if (!row) {
    refuse(`${field} is not a field this writer sets. It takes ${Object.keys(fields()).join(", ")}.`);
  }
  const caps = await capsOf();
  if (row.shows) await mustBeShown([{ ref, documentId }]);
  if (row.renews) await renew(documentId, ref, next, patch);
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
