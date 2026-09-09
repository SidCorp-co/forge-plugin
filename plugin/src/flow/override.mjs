/* The two recorded overrides: a field set and a status set that no entry check read. Both say so in the reply and leave a correction, because the point of them is that the record shows a person went round the ladder rather than that the ladder let them. Why a route round the checks exists at all, and what it costs: docs/cli/the-entry-checks.md. */
import { refuse } from "../refusal.mjs";
import { pairOf } from "../resolve/flags.mjs";
import { keepOnFailure } from "../resolve/settings.mjs";
import { ownsField, writeFields } from "../tracker/field-write.mjs";
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

/* The tracker moves a status on a route of its own and refuses one sent to `update`. Refused by name here rather than by the tracker after the send, because the fields of one call go up together: one name the tracker will not take costs every name beside it. */
const MOVED_ELSEWHERE = { status: (ref, value) => `forge advance ${ref} --set ${value} --why <w>` };

const setForm = (pairs) => pairs.map(({ field, value }) => `--set ${field}=${value}`).join(" ");

const pairsOf = (given, ref) => {
  const pairs = given.map((one) => setPair(one));
  const twice = pairs.find(({ field }, at) => pairs.findIndex((one) => one.field === field) !== at);
  if (twice) {
    const values = pairs.filter(({ field }) => field === twice.field).map(({ value }) => `\`${value}\``);
    refuse(`--set names ${twice.field} ${values.length} times, as ${values.join(" and ")}, and one call `
      + `writes each field once. Ask for the one you meant: --set ${twice.field}=<value>. Nothing was sent.`);
  }
  const moved = pairs.find(({ field }) => MOVED_ELSEWHERE[field]);
  if (moved) {
    refuse(`${moved.field} is not a field an update writes: the tracker moves it on a route of its `
      + "own and refuses it here, and the fields of one call go up together, so nothing of this one "
      + `was sent. Move it with:\n  ${MOVED_ELSEWHERE[moved.field](ref, moved.value)}`);
  }
  return pairs;
};

/* One record for the call and not one per field: a correction naming a subset of what was asked is true about what happened and misleading about what was asked, and no later reader can tell those apart (ISS-930). */
const movedSaid = (pairs) =>
  `${pairs.map(({ field, value }) => `${field} set to \`${value}\``).join(", ")} by \`forge issue --set\``;

/** `forge issue --set <field>=<value>... --why <w>`: the update route, said to be unread and corrected. */
export const overrideFields = async (reference, given, why, { next, patch } = {}) => {
  const said = whyChecked("issue --set", why);
  const pairs = pairsOf(given, reference);
  const { documentId, body } = await issueOf(reference);
  /* A record whose write moves a status is the one thing an override is for the opposite of, so the field set is refused here rather than followed by a move nobody asked for. */
  if (body?.status === ANSWERED_BY_COMMENT) {
    refuse(`${reference} waits for an answer, and the correction an override leaves is a comment: the `
      + "tracker reads one on this status as that answer and puts the issue back to `open`, leaving a "
      + "field set by hand and a status moved by nobody. Move the status yourself first, and the "
      + `fields after it:\n  forge advance ${reference} --set <status> --why <w>\n`
      + `  forge issue ${reference} ${setForm(pairs)} --why <w>`);
  }
  const told = async (moved, read) => {
    for (const { field, value } of moved) console.log(`${reference}  ${field} is ${read?.[field] ?? value}`);
    console.log(UNREAD);
    await correctionFor(documentId, reference, movedSaid(moved), said);
  };
  const back = await writeFields(documentId, pairs, {
    ref: reference, next, patch, refuse, override: true, partly: (moved) => told(moved, null),
  });
  await told(pairs, back);
};
