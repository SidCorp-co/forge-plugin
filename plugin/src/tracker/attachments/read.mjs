import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { fail } from "../../resolve/settings.mjs";
import { commentPage, cutIn } from "../comments.mjs";
import { TWICE } from "../evidence.mjs";
import { scoped } from "../rest.mjs";

const DOWNLOAD = /\/attachments\/([^/]+)\/download$/u;

const idOf = (one) => one?.id ?? one?.documentId ?? DOWNLOAD.exec(String(one?.url ?? ""))?.[1] ?? null;

// cm:why a record cites a comment's attachment by the same name as the issue's (attachmentNames), so a read by name covers both
export const attachmentsOn = async (documentId) => {
  const [page, body] = await Promise.all([
    commentPage(documentId),
    scoped("forge_issues", { action: "get", documentId, fields: ["attachments"] }),
  ]);
  const held = [...(body.attachments ?? []), ...page.comments.flatMap((one) => one.attachments ?? [])];
  return { held: held.map((one) => ({ name: one.name ?? null, url: one.url ?? null, id: idOf(one) })), cut: cutIn(page) };
};

const listed = (held) => held.map((one) => `  ${one.name ?? "(no name)"}  ${one.url}`).join("\n");

export const showAttachments = ({ held, cut }, reference) => {
  if (!held.length) console.log(`${reference} carries no attachment.`);
  else console.log(held.map((one) => `${one.name ?? "(no name)"}  ${one.url}`).join("\n"));
  if (cut) console.error(`The comment thread on ${reference} cannot be read whole: ${cut} An attachment behind the cut is not listed.`);
};

// cm:why a name two documents carry resolves two ways (TWICE), so the url a listing prints is the one handle that is always one document
const chosen = ({ held, cut }, asked, reference) => {
  const byUrl = held.find((one) => one.url === asked || one.id === asked);
  if (byUrl) return byUrl;
  const named = held.filter((one) => one.name === asked);
  if (named.length === 1) return named[0];
  if (named.length > 1) {
    fail(`attach: ${asked} names ${named.length} documents on ${reference}. ${TWICE} Nothing was read. `
      + `Ask for one by its url:\n${listed(named)}`);
  }
  const unread = cut ? ` The comment thread cannot be read whole (${cut}), so one behind the cut may carry it.` : "";
  fail(`attach: no attachment on ${reference} is named ${asked}.${unread} `
    + (held.length ? `The ones it carries:\n${listed(held)}` : `${reference} carries none.`));
  return null;
};

/** One attachment's bytes into a file: `output`, or the attachment's own name in the working directory, never over a file already there. */
export const downloadAttachment = async (read, asked, output, reference) => {
  const one = chosen(read, asked, reference);
  const path = resolve(output ?? one.name ?? one.id);
  if (existsSync(path)) fail(`attach: ${path} already exists, and nothing was read. Name another with --output <file>, or move that one first.`);
  const bytes = await scoped("forge_uploads", { action: "download", data: { id: one.id } });
  writeFileSync(path, bytes);
  console.log(`${one.name ?? one.id}  ${bytes.length} bytes  -> ${path}`);
};
