/* The last line of every reply that wrote: the id, read back rather than taken off the echo the
   write answered with. Why nothing here refuses, whatever it finds: docs/cli/filing.md. */
import { tried } from "../rpc.mjs";

const AGAIN = "Do not send this call again before reading that id: a write the tracker took and a "
  + "write it dropped answer alike, and a second send files the body twice.";

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
const unverified = (line) => ({ line: `${line} ${AGAIN}` });

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
  if (back?.refused) return unverified(`${said} and the read-back could not run: ${oneLine(back.refused)}.`);
  if (!plain(back)) return unverified(`${said} and the read-back answered with no record to read.`);
  if (back.documentId === documentId) {
    return verified(`${back.issueId ?? documentId} is filed at ${documentId}, read back from the tracker.`);
  }
  if (back.documentId) {
    return unverified(`${said} and the read-back answered about something else, so the filing is unverified.`);
  }
  return unverified(`${said} and a read of that id came back with no issue.`);
};

/** Whole means `hasMore` false and nothing weaker, a page asserting nothing being no assertion. */
export const commentLanded = async (documentId, answer, ref) => {
  const posted = idOf(answer);
  if (!posted) return noId("comment", answer);
  const back = await asked("forge_comments", { action: "list", filters: { issue: documentId } });
  const said = `Comment ${posted} was answered for ${ref}`;
  if (back?.refused) return unverified(`${said} and the read-back could not run: ${oneLine(back.refused)}.`);
  if ((back?.comments ?? []).some((one) => one?.documentId === posted)) {
    return verified(`Comment ${posted} is posted on ${ref}, read back from the tracker.`);
  }
  if (back.hasMore !== false) {
    return unverified(`${said} and the page read back was cut before it, so the write is unverified.`);
  }
  return unverified(`${said} and the page of ${ref}, which the tracker called whole, does not hold it.`);
};

/** On stdout on every outcome, so the last line names the id even where the read-back failed. */
export const sayLanded = ({ line }) => console.log(line);
