/* A gate's refusal opens with what to do, and the shape and the reason follow it (AC-07-3-4). The
   case pins the order and not the sentence, so each gate keeps its own wording. */
import assert from "node:assert/strict";

/* Enumerating is the point here: an action is said in English by an imperative verb, and this is the
   set the gates' routes open with. A route opening with a verb not in it is added here, once. */
const ROUTE_VERBS = new Set([
  "change", "clear", "copy", "correct", "cut", "derive", "find", "fix", "keep", "name", "post", "read",
  "re-send", "replace", "reset", "run", "say", "set", "spell", "stage", "type", "use", "wait", "write",
]);

/* The stop word a refusal may open with, and the dash that keeps it from being a sentence alone. */
const MARKER = /^(?:Hold|Refused) — /u;

/** Holds that `text` opens, after its stop word, with an action, and that a paragraph after the one
 *  that action opens carries the rest — the pointer to the gate's page is not that paragraph. */
export const assertRouteFirst = (text, label = "") => {
  const said = String(text ?? "");
  assert.doesNotMatch(said, /^(?:Hold|Refused)(?:\.|\s*$)/u, `${label}: the stop word stands alone`);
  const body = said.replace(MARKER, "");
  const verb = (/^[A-Za-z-]+/u.exec(body)?.[0] ?? "").toLowerCase();
  assert.ok(ROUTE_VERBS.has(verb), `${label}: opens with "${verb}" rather than an action — ${said.slice(0, 160)}`);
  const after = body.split(/\n\n/u).slice(1).filter((one) => one.trim() && !one.trim().startsWith("How: "));
  assert.ok(after.length > 0, `${label}: nothing follows the route to say what was refused — ${said.slice(0, 160)}`);
};
