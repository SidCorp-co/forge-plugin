/* What a session has been shown, by surface and by the text itself, so a repeat costs a line and
   never a paragraph. What each surface owes, and why a credit follows the printing rather than
   leading it: docs/cli/the-shown-ledger.md. */
import { createHash } from "node:crypto";

import { sessionSourced } from "../resolve/config.mjs";
import { credit, creditedTo, lastCredited } from "./journal.mjs";

export const sessionKey = (ev = null) => sessionSourced(ev).id || "";

/* Who a hook's text reaches is the transcript its event names, never the id the hook process
   resolves: inside a subagent that is the wave's or the tree's, which a sibling and a predecessor
   share, while the event names the dispatcher in `session_id` and the run alone in `agent_id`. */
export const readerKey = (ev = null) => {
  const session = ev?.session_id || sessionKey(ev);
  return session && ev?.agent_id ? `${session}/${ev.agent_id}` : session;
};

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

/* The words every repeat opens on, whichever form follows: the corpus reader keys on them. */
export const HELD_OPENS = "Refused again";

/* One line, which carries what this call needs — the shape refused, what to do instead, the rule's
   name — and leaves the paragraph's cause to the page it names. */
export const held = (route, { shape = null, cause = null } = {}) => {
  const page = `\`forge hooks --how ${route}\`${cause ? ` (cause: ${cause})` : ""}`;
  return shape
    ? `${HELD_OPENS} — ${shape} The reason was shown in full earlier in this conversation: ${page}`
    : `${HELD_OPENS}, for the reason shown in full earlier in this conversation: ${page}`;
};

export { lastCredited as lastShown } from "./journal.mjs";

export const sayIfChanged = (session, surface, text) => {
  if (!session || !surface || !String(text).trim()) return String(text ?? "");
  const whole = digestOf(text);
  if (lastCredited(session, surface) === whole) return "";
  credit(session, surface, [whole]);
  return String(text);
};

export const sayOnce = (session, surface, text, { route = null, shape = null, cause = null } = {}) => {
  if (!session || !surface || !String(text).trim()) return String(text ?? "");
  const { owed, delta } = owedOf(session, surface, text);
  if (!owed) return route ? held(route, { shape, cause }) : "";
  noteShown(session, surface, text);
  return delta?.length ? delta.join("\n") : String(text);
};
