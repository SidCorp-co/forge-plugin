/* What a session has been shown, by surface and by the text itself, so a repeat costs a line and
   never a paragraph. What each surface owes, and why a credit follows the printing rather than
   leading it: docs/cli/the-shown-ledger.md. */
import { digestOf } from "../keys/digest.mjs";
import { sessionSourced } from "../resolve/config.mjs";
import { credit, creditedTo, lastCredited } from "./journal.mjs";
import { howPage } from "../refusal.mjs";

export const sessionKey = (ev = null) => sessionSourced(ev).id || "";

/* Who a hook's text reaches is the transcript its event names, never the id the hook process
   resolves: inside a subagent that is the wave's or the tree's, which a sibling and a predecessor
   share, while the event names the dispatcher in `session_id` and the run alone in `agent_id`. */
export const readerKey = (ev = null) => {
  const session = ev?.session_id || sessionKey(ev);
  return session && ev?.agent_id ? `${session}/${ev.agent_id}` : session;
};

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
  const page = howPage(route, cause);
  return shape
    ? `${HELD_OPENS} — ${shape} The reason was shown in full earlier in this conversation: ${page}`
    : `${HELD_OPENS}, for the reason shown in full earlier in this conversation: ${page}`;
};

export { lastCredited as lastShown } from "./journal.mjs";

/* Whether the owed line changed rides beside the line, never in its absence: an empty answer would
   read the same whether nothing was owed or nothing had moved, and every caller would have to know
   which. */
export const sayIfChanged = (session, surface, text) => {
  const said = String(text ?? "");
  if (!session || !surface || !said.trim()) return { said, changed: Boolean(said.trim()) };
  const whole = digestOf(said);
  if (lastCredited(session, surface) === whole) return { said, changed: false };
  credit(session, surface, [whole]);
  return { said, changed: true };
};

/* A refusal is handed in its parts, so the part that says what to do and the part that names the
   route are never a candidate for the delta: only the body is cut to what this session has not read. */
const partsOf = (said) => (said && typeof said === "object" ? said : null);

const joinedOf = (parts) => [parts.lead, parts.body, parts.how]
  .map((one) => String(one ?? "").trim()).filter(Boolean).join("\n\n");

const deltaOf = (parts, delta) => {
  if (!parts) return delta.length ? delta.join("\n") : null;
  const fresh = segmentsOf(parts.body ?? "").filter((one) => delta.includes(one));
  return joinedOf({ ...parts, body: fresh.join("\n") });
};

/** `said` is a string, whose delta is per line, or a refusal's `{ lead, body }`, whose lead and How line
 *  print on every firing that is not a whole repeat. The How line is built from `route` and `cause`,
 *  the same two the repeat line names, so a caller states the cause once. */
export const sayOnce = (session, surface, said, { route = null, shape = null, cause = null } = {}) => {
  const given = partsOf(said);
  const parts = given && route ? { ...given, how: `How: ${howPage(route, cause)}` } : given;
  const text = parts ? joinedOf(parts) : String(said ?? "");
  if (!session || !surface || !text.trim()) return text;
  const { owed, delta } = owedOf(session, surface, text);
  if (!owed) return route ? held(route, { shape, cause }) : "";
  noteShown(session, surface, text);
  return (delta && deltaOf(parts, delta)) || text;
};
