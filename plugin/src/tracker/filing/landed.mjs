/* The last line of every reply that wrote: the id, read back rather than taken off the echo the
   write answered with. Why nothing here refuses, whatever it finds: docs/cli/filing.md. */
import { commentPage, cutIn } from "../comments.mjs";
import { tried } from "../rpc.mjs";

const AGAIN = "Do not send this call again before reading that id: a write the tracker took and a "
  + "write it dropped answer alike, and a second send files the body twice.";

/* No route reads a comment by its own id, so the thread's list is the read this names (ISS-697). */
const READ_ISSUE = (documentId) => `Read it with \`forge issue ${documentId}\`.`;

const READ_THREAD = (documentId) => "Read it with \`forge call forge_comments.list "
  + `'{"filters":{"issue":"${documentId}"}}'\`, which lists a page of the thread with the id of `
  + "every comment on it; pass the `nextCursor` it names back in `filters.cursor` until `hasMore` "
  + "is false.";

/* Anything `tried` is not soft on would exit 1 on a write that landed, so nothing raises past here. */
const asked = async (name, args) => {
  try {
    return await tried(name, args);
  } catch (error) {
    return { refused: String(error?.message ?? error) };
  }
};

/* On one line: a refusal joined with newlines leaves the last line naming no id. */
const oneLine = (text) => String(text ?? "").replace(/\s+/gu, " ").trim();

const plain = (answer) =>
  Boolean(answer) && typeof answer === "object" && !Array.isArray(answer) && !answer.refused;

const verified = (line) => ({ line });
const unverified = (line, read = null) => ({ line: [line, AGAIN, read].filter(Boolean).join(" ") });

export const idOf = (answer) => (plain(answer) ? (answer.documentId ?? null) : null);

const noId = (what, answer) => {
  const key = plain(answer) ? (answer.issueId ?? null) : null;
  return unverified(`The tracker answered this ${what} with no id${key ? `, only the key ${key}` : ""}, `
    + "so nothing was read back and nothing here can say what it wrote.");
};

/** A row carrying no id is the tracker denying it, and still no evidence the write was dropped. */
export const issueLanded = async (answer) => {
  const documentId = idOf(answer);
  if (!documentId) return noId("filing", answer);
  const back = await asked("forge_issues", { action: "get", documentId });
  const said = `The create was answered with ${documentId}`;
  const read = READ_ISSUE(documentId);
  if (back?.refused) return unverified(`${said} and the read-back could not run: ${oneLine(back.refused)}.`, read);
  if (!plain(back)) return unverified(`${said} and the read-back answered with no record to read.`, read);
  if (back.documentId === documentId) {
    return verified(`${back.issueId ?? documentId} is filed at ${documentId}, read back from the tracker.`);
  }
  if (back.documentId) {
    return unverified(`${said} and the read-back answered about something else, so the filing is unverified.`, read);
  }
  return unverified(`${said} and a read of that id came back with no issue.`, read);
};

/* Whole rather than a first page, and refusals handed back rather than exiting as all of this does. */
const threadBack = async (documentId) => {
  try {
    return await commentPage(documentId, true);
  } catch (error) {
    return { refused: String(error?.message ?? error) };
  }
};

/** Whole means `hasMore` false and nothing weaker, a page asserting nothing being no assertion. */
export const commentLanded = async (documentId, answer, ref) => {
  const posted = idOf(answer);
  if (!posted) return noId("comment", answer);
  const back = await threadBack(documentId);
  const said = `Comment ${posted} was answered for ${ref}`;
  const read = READ_THREAD(documentId);
  if (back?.refused) return unverified(`${said} and the read-back could not run: ${oneLine(back.refused)}.`, read);
  if ((back?.comments ?? []).some((one) => one?.documentId === posted)) {
    return verified(`Comment ${posted} is posted on ${ref}, read back from the tracker.`);
  }
  if (cutIn(back)) {
    return unverified(`${said} and the thread could not be read to its end, so the write is unverified.`, read);
  }
  return unverified(`${said} and the thread of ${ref}, which the tracker called whole, does not hold it.`, read);
};

/** On stdout on every outcome, so the last line names the id even where the read-back failed. */
export const sayLanded = ({ line }) => console.log(line);
