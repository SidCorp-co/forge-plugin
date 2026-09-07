/* What a session has been shown, by surface and by the text itself, so a repeat costs a line and
   never a paragraph. What each surface owes, and why a credit follows the printing rather than
   leading it: docs/cli/the-shown-ledger.md. */
import { createHash } from "node:crypto";

import { sessionSourced } from "../resolve/config.mjs";
import { credit, creditedTo } from "./journal.mjs";

export const sessionKey = (ev = null) => sessionSourced(ev).id || "";

export const digestOf = (text) => createHash("sha1").update(String(text)).digest("hex").slice(0, 16);

const segmentsOf = (text) => String(text).split("\n").map((one) => one.trim()).filter(Boolean);

/* The whole text last, so `lastShown` names a text and never one of its lines. */
const itemsOf = (text) => [...segmentsOf(text).map(digestOf), digestOf(text)];

export const owedOf = (session, surface, text) => {
  const whole = digestOf(text);
  const seen = creditedTo(session, surface);
  if (seen.has(whole)) return { owed: false, whole, delta: null };
  const segments = segmentsOf(text);
  const fresh = segments.filter((one) => !seen.has(digestOf(one)));
  return { owed: true, whole, delta: fresh.length === segments.length ? null : fresh };
};

export const noteShown = (session, surface, text) => credit(session, surface, itemsOf(text));

export const held = (route) =>
  `Refused again, for the reason this session was already shown in full: \`forge hooks --how ${route}\``;

export const lastShown = (session, surface) =>
  [...creditedTo(session, surface)].at(-1) ?? null;

export const sayIfChanged = (session, surface, text) => {
  if (!session || !surface || !String(text).trim()) return String(text ?? "");
  const whole = digestOf(text);
  if (lastShown(session, surface) === whole) return "";
  credit(session, surface, [whole]);
  return String(text);
};

export const sayOnce = (session, surface, text, { route = null } = {}) => {
  if (!session || !surface || !String(text).trim()) return String(text ?? "");
  const { owed, delta } = owedOf(session, surface, text);
  if (!owed) return route ? held(route) : "";
  noteShown(session, surface, text);
  return delta?.length ? delta.join("\n") : String(text);
};
