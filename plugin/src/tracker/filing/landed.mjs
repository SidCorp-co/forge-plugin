/* The last line of every reply that wrote: the id, read back rather than taken off the echo the
   write answered with. Why nothing here refuses, whatever it finds: docs/cli/filing.md. */
import { commentPage, cutIn } from "../comments.mjs";
import { tried } from "../rest.mjs";

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

export const idOf = (answer) => (plain(answer) ? (answer.documentId ?? null) : null);

const noId = (what, answer) => {
  const key = plain(answer) ? (answer.issueId ?? null) : null;
  return unverified()(`The tracker answered this ${what} with no id${key ? `, only the key ${key}` : ""}, `
    + "so nothing was read back and nothing here can say what it wrote.");
};

/** A row carrying no id is the tracker denying it, and still no evidence the write was dropped. */
export const issueLanded = async (answer) => {
  const documentId = idOf(answer);
  if (!documentId) return noId("filing", answer);
  const back = await asked(() => tried("forge_issues", { action: "get", documentId }));
  const said = `The create was answered with ${documentId}`;
  const unread = unverified(READ_ISSUE(documentId));
  if (back?.refused) return unread(`${said} and the read-back could not run: ${oneLine(back.refused)}.`);
  if (!plain(back)) return unread(`${said} and the read-back answered with no record to read.`);
  if (back.documentId === documentId) {
    return verified(`${back.issueId ?? documentId} is filed at ${documentId}, read back from the tracker.`);
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
