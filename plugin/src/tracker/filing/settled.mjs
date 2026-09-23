/* What a filing's neighbours hold that is no longer owed: the issues the project dropped, each with
   the reason its own record gives, and the ones it closed. Why they are shown and never folded onto:
   docs/cli/beside.md. */
import { commentPage } from "../comments.mjs";
import { FINDINGS } from "../../flow/machine.mjs";
import { parseAll } from "../../flow/record/page.mjs";
import { firstLine } from "../../resolve/flags.mjs";
import { NO_LONGER_OWES } from "../../flow/earned/park-status.mjs";

const DROPPED = "dropped";
const HOLDS = FINDINGS[0];
const KEY = 8;
/** A family of drops printed whole costs every filing thousands of characters, and the thread command gives the rest. */
export const REASON_MAX = 280;

/** The rows off the walk the duplicate check already made that owe nothing further, in the shape `openTitles` gives the open ones. */
export const settledOf = (rows) => (rows ?? [])
  .filter((one) => one?.documentId && NO_LONGER_OWES.includes(one.status))
  .map((one) => ({
    issueId: one.issueId ?? "",
    documentId: one.documentId,
    title: String(one.title ?? "").trim(),
    status: one.status,
  }));

/* The three writes a drop goes through, each read for the sentence it says the drop with. */
const dropSaid = ({ kind, fields }) => {
  if (kind === "park" && fields.kind === DROPPED) return fields.why ?? null;
  if (kind === "correction" && /`dropped`/u.test(String(fields.moved ?? ""))) return fields.why ?? null;
  if (kind === "confirmation" && fields.finding && fields.finding !== HOLDS) {
    return `${fields.finding}: ${fields.is ?? ""}`.trim();
  }
  return null;
};

const cut = (text) => {
  const line = firstLine(String(text).trim());
  if ([...line].length <= REASON_MAX) return line;
  const head = [...line].slice(0, REASON_MAX).join("");
  const room = head.lastIndexOf(" ");
  return `${(room > REASON_MAX / 2 ? head.slice(0, room) : head).replace(/[\s,;:]+$/u, "")}…`;
};

/** The latest reason a thread's records give for the drop, or null where none of the three says one. */
export const reasonOf = (comments) => {
  const said = (comments ?? [])
    .map((one, at) => ({ at: String(one?.createdAt ?? ""), order: at, body: one?.body ?? "" }))
    .sort((one, other) => one.at.localeCompare(other.at) || one.order - other.order)
    .flatMap((one) => parseAll(one.body).map(dropSaid))
    .filter(Boolean);
  return said.length ? cut(said.at(-1)) : null;
};

/* A prefix can hide the latest record as easily as it hides the only one, so neither a reason nor its absence is read off part of a thread. */
const readReason = async (one) => {
  const page = await commentPage(one.documentId, true);
  if (page?.refused) return { ...one, reason: null, unread: `its thread could not be read: ${firstLine(page.refused)}` };
  if (page?.hasMore !== false) return { ...one, reason: null, unread: "its thread did not come back whole" };
  return { ...one, reason: reasonOf(page.comments), unread: null };
};

/** Every dropped neighbour with its reason, the threads read together and none of them able to stop the filing. */
export const withReasons = (dropped) => Promise.all(dropped.map(readReason));

const row = (one, noScore) =>
  `  ${one.issueId.padEnd(KEY)} ${one.score === null ? noScore : one.score.toFixed(2)}  `
  + `${one.samePlace ? "same place  " : "            "}${one.title}`;

const why = (one) => {
  if (one.unread) return `    why: unread — ${one.unread}`;
  return `    why: ${one.reason ?? "its record gives no reason"}`;
};

const DROPPED_HEAD = "Filed before and dropped, by the same memory — each with the reason its own record gives:";
const DROPPED_TAIL = "No dropped neighbour takes a finding, and nothing folded onto one. Where this filing is that"
  + " subject, the reason is what to answer before filing it again: a key it names is where the subject"
  + " went, and one more drop of the same subject is evidence the reason was wrong. `forge comment <key>`"
  + " prints a thread whole.";
const CLOSED_HEAD = "Filed before and closed, which means fixed and landed — so this filing is a regression of"
  + " that fix or a different defect, and saying which is this filing's work:";

/** The two blocks under the open one: nothing where there is nothing settled. */
export const settledLines = ({ dropped = [], closed = [] }, noScore) => [
  ...(dropped.length ? [DROPPED_HEAD, ...dropped.flatMap((one) => [row(one, noScore), why(one)]), DROPPED_TAIL] : []),
  ...(closed.length ? [CLOSED_HEAD, ...closed.map((one) => row(one, noScore))] : []),
];
