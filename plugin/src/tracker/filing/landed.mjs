/* The last line of every reply that wrote: the id, read back rather than taken off the echo the
   write answered with. Why nothing here refuses, whatever it finds: docs/cli/filing.md. */
import { commentPage, cutIn } from "../comments.mjs";
import { tried } from "../rest.mjs";
import { carriesPrimary } from "../modules/definition.mjs";

const AGAIN = "Do not send this call again before reading that id: a write the tracker took and a "
  + "write it dropped answer alike, and a second send files the body twice.";

/* No route reads a comment by its own id, so the thread's list is the read this names (ISS-697). */
const READ_ISSUE = (documentId) => `Read it with \`forge issue ${documentId}\`.`;

const READ_THREAD = (documentId) => `Read it with \`forge comment ${documentId}\`, which prints the `
  + "whole thread, every page of it, with the id of each comment in its marker line.";

/* A read that raises would exit 1 on a write that landed, so a refusal is handed back instead. */
const asked = async (read) => {
  try {
    return await read();
  } catch (error) {
    return { refused: String(error?.message ?? error) };
  }
};

/* On one line: a refusal joined with newlines leaves the last line naming no id. */
const oneLine = (text) => String(text ?? "").replace(/\s+/gu, " ").trim();

const plain = (answer) =>
  Boolean(answer) && typeof answer === "object" && !Array.isArray(answer) && !answer.refused;

const verified = (line) => ({ line });
const unverified = (read = null) => (line) => ({ line: [line, AGAIN, read].filter(Boolean).join(" ") });

const idOf = (answer) => (plain(answer) ? (answer.documentId ?? null) : null);

const noId = (what, answer) => {
  const key = plain(answer) ? (answer.issueId ?? null) : null;
  return unverified()(`The tracker answered this ${what} with no id${key ? `, only the key ${key}` : ""}, `
    + "so nothing was read back and nothing here can say what it wrote.");
};

/* What the tracker stores in place of what a create asked for, one field of the payload at a time.
   The labels are the module's half and judged by `carriesPrimary`; an edge is looked for under every
   kind the row groups its edges in, since a bucket name is the tracker's and the edge's own kind is
   what was sent. Why a field is compared at all, and why the description's words never come back:
   docs/cli/filing.md. */
const INTAKE = "intake";
const SCALAR = new Set(["string", "number", "boolean"]);

const heldEdge = (relations, edge) => Object.values(relations ?? {})
  .some((list) => Array.isArray(list)
    && list.some((one) => one?.kind === edge.kind && one?.otherIssueId === edge.blocksId));

const sameValue = (asked, stored) => (asked === null || SCALAR.has(typeof asked)
  ? asked === stored
  : JSON.stringify(asked) === JSON.stringify(stored));

const trimmed = (text) => String(text ?? "").replace(/\s+$/u, "");

const storedOtherwise = (sent = {}, back = {}) => {
  const moved = [];
  const unread = [];
  let rewritten = false;
  for (const [field, asked] of Object.entries(sent ?? {})) {
    if (field === "labels" || asked === undefined) continue;
    if (!Object.hasOwn(back, field)) unread.push(field);
    else if (field === "description") rewritten = trimmed(back.description) !== trimmed(asked);
    else if (field !== "relations" && !sameValue(asked, back[field])) moved.push({ field, asked, stored: back[field] });
  }
  const lost = Object.hasOwn(back, "relations")
    ? (sent?.relations ?? []).filter((edge) => !heldEdge(back.relations, edge))
    : [];
  return { moved, unread, rewritten, lost };
};

/* A one-word value bare, as a status or a rank reads in a sentence, and anything else quoted so its edges show. */
const shown = (value) => (typeof value === "string" && /^\S+$/u.test(value) ? value : JSON.stringify(value));

const gated = (move, back) => move.asked === "open" && move.stored === "draft"
  && (back.labels ?? []).some((one) => one?.name === INTAKE);

const movedSaid = (key, back) => (move) => {
  const said = `${move.field} ${shown(move.stored)} where this filing asked for ${shown(move.asked)}`;
  if (move.field !== "status" || !gated(move, back)) return said;
  return `${said}, which is the project's intake gate: it stores a would-be open filing at draft and marks `
    + `it with the \`${INTAKE}\` label this row carries, so nothing dispatches it until it leaves draft, `
    + `with \`forge advance ${key} --set open --why <w>\` or by whoever triages that project's intake`;
};

/* One clause, or none: what the row stores otherwise, then what it could not be compared on. */
const otherwiseSaid = (key, found, back) => {
  const stored = [
    ...found.moved.map(movedSaid(key, back)),
    found.rewritten ? "the description as the tracker rewrote it on the way in, not as it was sent" : null,
    ...found.lost.map((edge) => `no ${edge.kind} edge to ${edge.blocksId}`),
  ].filter(Boolean);
  const unread = found.unread.length
    ? `the read-back carries no ${found.unread.join(", ")} to compare with what was sent`
    : null;
  return [stored.length ? `it stores ${stored.join("; ")}` : null, unread].filter(Boolean).join(", and ");
};

/* Whether the rank the filed line names is the one stored, so that line claims no more than the row does. */
const rankOf = (found) => {
  const moved = found.moved.find((one) => one.field === "priority");
  if (moved) return { rank: "moved", stored: moved.stored };
  return { rank: found.unread.includes("priority") ? "unread" : "held" };
};

const UNREAD_RANK = { rank: "unread" };

/** A row carrying no id is the tracker denying it, and still no evidence the write was dropped.
 *  `sent` is the create's payload whole, compared field by field with the row read back. */
export const issueLanded = async (answer, { module = null, sent = {} } = {}) => {
  const documentId = idOf(answer);
  if (!documentId) return { ...noId("filing", answer), ...UNREAD_RANK };
  const back = await asked(() => tried("forge_issues", { action: "get", documentId }));
  const said = `The create was answered with ${documentId}`;
  const unread = (line) => ({ ...unverified(READ_ISSUE(documentId))(line), ...UNREAD_RANK });
  if (back?.refused) return unread(`${said} and the read-back could not run: ${oneLine(back.refused)}.`);
  if (!plain(back)) return unread(`${said} and the read-back answered with no record to read.`);
  if (back.documentId === documentId) {
    const key = back.issueId ?? documentId;
    const found = storedOtherwise(sent, back);
    const otherwise = otherwiseSaid(key, found, back);
    const stored = otherwise ? `, and ${otherwise}.` : ".";
    if (module && !carriesPrimary(back.labels, module)) {
      return { ...unverified(READ_ISSUE(documentId))(`${key} is filed at ${documentId}, and the read-back does `
        + `not carry ${module.name} as its primary module, so that half of the filing is unverified${stored}`),
      ...rankOf(found) };
    }
    return { ...verified(`${key} is filed at ${documentId}${module ? ` under ${module.name}, its primary module,` : ","}`
      + ` read back from the tracker${stored}`), ...rankOf(found) };
  }
  if (back.documentId) {
    return unread(`${said} and the read-back answered about something else, so the filing is unverified.`);
  }
  return unread(`${said} and a read of that id came back with no issue.`);
};

/** Whole means `hasMore` false and nothing weaker, a page asserting nothing being no assertion. */
export const commentLanded = async (documentId, answer, ref) => {
  const posted = idOf(answer);
  if (!posted) return noId("comment", answer);
  const back = await asked(() => commentPage(documentId, true));
  const said = `Comment ${posted} was answered for ${ref}`;
  const unread = unverified(READ_THREAD(documentId));
  if (back?.refused) return unread(`${said} and the read-back could not run: ${oneLine(back.refused)}.`);
  if ((back?.comments ?? []).some((one) => one?.documentId === posted)) {
    return verified(`Comment ${posted} is posted on ${ref}, read back from the tracker.`);
  }
  if (cutIn(back)) {
    return unread(`${said} and the thread could not be read to its end, so the write is unverified.`);
  }
  return unread(`${said} and the thread of ${ref}, which the tracker called whole, does not hold it.`);
};

/** On stdout on every outcome, so the last line names the id even where the read-back failed. */
export const sayLanded = ({ line }) => console.log(line);
