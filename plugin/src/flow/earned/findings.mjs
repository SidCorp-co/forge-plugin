/* What a finding the fold landed on an issue is owed before the rungs that judge the issue: a
   criterion carrying it, or a record declining it. The rule is the contract's `testing` part; why a
   folded finding is typed at all is docs/cli/the-fold.md's. Nothing here fetches or writes. */
import { HANDLE_LENGTH, blockOf, handleOf, need, tagFor } from "../machine.mjs";
import { parseAll } from "../record/page.mjs";
import { CONTRACT } from "../../guides/contract.mjs";
import { escaped } from "../../markdown.mjs";

const FOLDED = "folded";
export const DECLINED = "declined";

const idOf = (comment) => comment?.documentId ?? comment?.id ?? null;
const HEADING = /^##[ \t]+(.+?)[ \t]*$/mu;

/** The comment the fold posts: the filing as its filer wrote it, then the record that makes it a finding a reader finds by kind. */
export const foldedBody = (title, body) => [
  `## ${title}`, "", String(body ?? "").replace(/\s*$/u, ""), "", blockOf([["title", title]]), "", tagFor(FOLDED, CONTRACT),
].join("\n");

const HEX_HANDLE = new RegExp(`^[0-9a-f]{${HANDLE_LENGTH}}$`, "u");

/** The handle of the comment a write posted, or null where the answer named no id a handle heads. */
export const handleIn = (answer) => {
  const handle = handleOf(idOf(answer) ?? idOf(answer?.comment));
  return HEX_HANDLE.test(handle) ? handle : null;
};

/* The title off the record, and off the heading the fold writes above the body where a body that
   quotes a record of its own left the record's keys unread. */
const titleOf = (comment, record) => record.fields.title ?? HEADING.exec(comment.body ?? "")?.[1] ?? "untitled";

/** Every folded finding on the page, oldest first. A comment whose id heads no handle is a row nobody can name, and is left out rather than owed an answer no write could give. */
export const foldedIn = (comments) => comments
  .map((one) => ({ one, record: parseAll(one.body ?? "").find((held) => held.kind === FOLDED), handle: handleIn(one) }))
  .filter(({ record, handle }) => record && handle)
  .map(({ one, record, handle }) => ({ handle, title: titleOf(one, record) }));

const naming = (handle) => new RegExp(`(?<![0-9a-f])${escaped(handle)}(?![0-9a-f])`, "iu");

/** The criterion carrying a finding: the first whose line names its handle. */
const carrierOf = (criteria, handle) => criteria.find((one) => naming(handle).test(one.text)) ?? null;

const answerForm = (ref, handle) => `forge record criteria ${ref} <criteria.md>, with a line naming \`finding ${handle}\` — `
  + `or forge record declined ${ref} --finding ${handle} --why "<why it is not fixed here>"`;

/* Past the judging rung a carrier's verdict is read here too, because nothing above `testing` reads
   verdicts and a finding may land after the judging. `whole` is the caller's shape test. */
const verdictOwed = (view, ref, { handle, carrier }, whole) => {
  const held = view.verdicts?.get(carrier.number);
  const said = !held ? "has no verdict"
    : !whole("verdict", held.record) ? "has a verdict that is not a whole payload"
      : held.record.fields.verdict === "fail" ? "failed its verdict" : null;
  if (!said) return [];
  return [need(
    `criterion ${carrier.number} carries finding ${handle} and ${said}, so the finding it carries stands unjudged`,
    `forge record verdict ${ref} --criterion ${carrier.number} --verdict pass --commit <sha> --evidence <attachment|url|sha>`,
  )];
};

/** What the folded findings on an issue owe: each one carried by a criterion or declined, and, where `judged` says the rung is past the judging, each carrier judged without failing. */
export const findingsOwed = (view, ref, { whole, judged = false }) => {
  const declined = new Set((view.repeated?.[DECLINED] ?? [])
    .filter((one) => whole(DECLINED, one.record))
    .map((one) => handleOf(one.record.fields.finding)));
  return foldedIn(view.comments ?? []).flatMap(({ handle, title }) => {
    if (declined.has(handle)) return [];
    const carrier = carrierOf(view.criteria ?? [], handle);
    if (carrier) return judged ? verdictOwed(view, ref, { handle, carrier }, whole) : [];
    return [need(
      `finding ${handle} ("${title}") is carried by no criterion and declined by no record, so nothing judges it before the close`,
      answerForm(ref, handle),
    )];
  });
};

/** Why a `declined` write may not name this handle, or null: it has to be a finding on this issue, and one the page could be read whole for. */
export const declinedProblem = (reference, handle, { comments, cut }) => {
  const held = foldedIn(comments).map((one) => one.handle);
  if (held.includes(handleOf(handle))) return null;
  const carries = held.length ? `the finding(s) it carries: ${held.join(", ")}` : "no folded finding at all";
  const behind = cut ? ` ${cut} The finding may be on a comment behind the cut.` : "";
  return `record declined: ${reference} carries no folded finding with the handle \`${handleOf(handle)}\`, and `
    + `${carries}.${behind} Nothing was sent. A handle is the first ${HANDLE_LENGTH} hex characters of the `
    + `finding's comment id, as \`forge advance ${reference} --owed\` names it.`;
};
