/* The two recorded overrides: a field set and a status set that no entry check read. Both say so in the reply and leave a correction, because the point of them is that the record shows a person went round the ladder rather than that the ladder let them. Why a route round the checks exists at all, and what it costs: docs/cli/the-entry-checks.md. */
import { refuse } from "../refusal.mjs";
import { pairOf } from "../resolve/flags.mjs";
import { keepOnFailure } from "../resolve/settings.mjs";
import { ownsField, writeField } from "../tracker/field-write.mjs";
import { AMBIGUOUS } from "../tracker/rest.mjs";
import { ANSWERED_BY_COMMENT } from "./earned.mjs";
import { issueOf, post } from "./record/record.mjs";
import { render } from "./record/page.mjs";

export const UNREAD = "No entry check read this: the record does not say it was earned, and the "
  + "correction below is what says a run set it by hand.";

/** A `--why` before any write: the reason is the whole difference between an override and a lie about what the record earned. */
export const whyChecked = (verb, why) => {
  if (!String(why ?? "").trim()) {
    refuse(`${verb} needs --why: an override is refused by no check, so the reason is the only thing `
      + "on the record that says why the ladder was gone round. Nothing was sent.");
  }
  return String(why).trim();
};

/* Posted once the write it describes has happened, except on the one route that has to go first, and the two failures read differently. Where the write landed, a record that did not go up leaves a page with no reason on it, and the body is worth posting by hand. Where it has not, there is nothing to correct, and that same body would claim a change nobody made. */
/** A soft refusal read for what it left behind: a dropped write may have landed, so neither route may say the record is not there — told it is, a run posts the body again or overrides again, and the page carries the same claim twice. */
export const afterRefused = (refused) => {
  const unknown = refused.includes(AMBIGUOUS);
  return { unknown, said: unknown ? "may or may not have gone up" : "did not go up" };
};

export const correctionFor = async (documentId, ref, moved, why, { done = true } = {}) => {
  const body = render("correction", { moved, why });
  /* `done` is the write this describes having happened, whose own renewal of the lease stands. */
  const answer = await post(documentId, body, { ref, soft: true, renewed: done });
  if (!answer?.refused) return;
  const { unknown, said } = afterRefused(answer.refused);
  const opened = done
    ? `${moved}, and the correction that would say so ${said}: ${answer.refused}`
    : `nothing was sent to ${ref}'s status, and the record this route writes first ${said}: ${answer.refused}`;
  if (unknown) {
    refuse(`${opened}\nRead the page before writing anything else — a record this route could not `
      + `see is one a second write would post twice:\n  forge resume ${ref} --report`);
  }
  if (done) keepOnFailure(`The correction, so that nothing here loses it:\n\n${body}`);
  refuse(done
    ? `${opened}\nNothing on the page now says a run set it by hand. Put the body below up as it `
      + `stands, on stdin:\n  forge comment ${documentId} -`
    : `${opened}\nSo there is no move to correct and no record claiming one. Run the same override again.`);
};

const setPair = (given) => {
  const { key: field, value } = pairOf(String(given ?? ""), "--set");
  if (!value.trim()) refuse(`--set ${field}= names no value, and an override that clears a field is not one this verb writes.`);
  if (ownsField(field)) {
    refuse(`${field} is written by a record and not by an override: \`forge record -h\` names the `
      + "kind that writes it, and a payload the entry checks read is what that status is earned by.");
  }
  return { field, value };
};

/** `forge issue --set <field>=<value> --why <w>`: the update route, said to be unread and corrected. */
export const overrideField = async (reference, given, why, { next, patch } = {}) => {
  const said = whyChecked("issue --set", why);
  const { field, value } = setPair(given);
  const { documentId, body } = await issueOf(reference);
  /* A record whose write moves a status is the one thing an override is for the opposite of, so the field set is refused here rather than followed by a move nobody asked for. */
  if (body?.status === ANSWERED_BY_COMMENT) {
    refuse(`${reference} waits for an answer, and the correction an override leaves is a comment: the `
      + "tracker reads one on this status as that answer and puts the issue back to `open`, leaving a "
      + "field set by hand and a status moved by nobody. Move the status yourself first, and the "
      + `field after it:\n  forge advance ${reference} --set <status> --why <w>\n`
      + `  forge issue ${reference} --set ${field}=${value} --why <w>`);
  }
  const back = await writeField(documentId, field, value, { ref: reference, next, patch, refuse, override: true });
  console.log(`${reference}  ${field} is ${back ?? value}`);
  console.log(UNREAD);
  await correctionFor(documentId, reference, `${field} set to \`${value}\` by \`forge issue --set\``, said);
};
