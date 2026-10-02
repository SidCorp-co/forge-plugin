/* The tracker holds a move to `closed` or `dropped` while a question a person was asked on the issue
   is open, and names the payload field that voids each one in the same write. This is the flag that
   sends that field and the line that turns the refusal into a command a run can type, because a
   route the tracker names that no verb sends is no route (ISS-3104). Whether a question should be
   voided is the caller's decision: the field goes only where the flag was typed. */
import { typed } from "../../hooks/shell-spans.mjs";
import { refuse } from "../../refusal.mjs";
import { PARK_STATUS, sameLanding } from "../earned.mjs";

export const VOID_FLAG = "--void-questions";
const VOIDS_AT = ["closed", "dropped"];
const OPEN_QUESTIONS = /^OPEN_QUESTIONS: /mu;
const WHY = "<why they died with the work>";
const CARRIED = `${VOID_FLAG} rides a move to ${VOIDS_AT.join(" or ")}: a plain advance whose next `
  + "status is one of them, --set with one of them, or --drop";

const voids = (status) => VOIDS_AT.some((one) => sameLanding(one, status));

/** The sentence the flag carries, read in the parse so a form that could never send it is refused
 *  before an endpoint is resolved. Null where the flag was not typed. */
export const voidsChecked = (given) => {
  const said = given[VOID_FLAG.slice(2)];
  if (said === undefined) return null;
  const beside = ["owed", "park", "reopen"].find((name) => given[name]);
  if (beside) refuse(`${CARRIED}, and --${beside} sends none. Nothing was sent.`);
  const text = said.trim();
  if (!text) {
    refuse(`${VOID_FLAG} is blank. It is the sentence each open question is voided with, so whoever `
      + "asked it can read that it died with the work rather than went unanswered. Say why, or leave "
      + "the flag out. Nothing was sent.");
  }
  if (given.set && !voids(given.set)) refuse(`${CARRIED}, and this set goes to ${given.set}. Nothing was sent.`);
  return text;
};

/** A plain advance learns its target only once the record is read: the next status, or the park a
 *  triage routes it to. */
export const voidsInto = (view, next, routed) => {
  if (!view.voids) return;
  const to = routed ? PARK_STATUS[routed.kind] : next;
  if (!voids(to)) refuse(`${CARRIED}, and this advance goes to ${to}. Nothing was sent.`);
};

/** The command as the caller typed it, which the refusal below repeats with the flag added where
 *  the call did not carry it. */
export const typedAgain = (argv) => `forge advance ${argv.map(typed).join(" ")}`;

/** The route a refused move is owed where the tracker refused it for open questions, and nothing
 *  where it refused it for anything else. `sent` is the sentence this call voided with: a move that
 *  already carried it is owed no command adding the flag, which would stand there twice. */
export const voidRoute = (refused, ref, again, sent = null) => {
  if (!OPEN_QUESTIONS.test(refused)) return "";
  const held = ` A question a person was asked on ${ref} is still open, which holds this move.`;
  if (sent) {
    return `${held} This move sent ${VOID_FLAG} "${sent}" and the tracker held it all the same, so `
      + "sending the voiding again changes nothing. The person it asked answers it on the tracker, and "
      + "this move then goes through as it stands.";
  }
  return `${held} The person it asked answers it on the tracker, and this move then goes through as `
    + "it stands; or, where the question died with the work, the same move voids each open one with "
    + `that sentence in the same write:\n  ${again ?? `forge advance ${ref}`} ${VOID_FLAG} "${WHY}"\n`;
};
