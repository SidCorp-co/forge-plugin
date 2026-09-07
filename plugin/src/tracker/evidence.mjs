/* What a verdict cites and how it gets onto the issue: the upload, and the reading of an --evidence
   value that is a file on disk. Attach then re-send the record was a round of the agent's (ISS-65). */
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { basename, extname, resolve } from "node:path";

import { fail } from "../resolve/settings.mjs";
import { declaredFor, refuseCredential, write } from "./rpc.mjs";

export const urlBearing = (item) => Boolean(item) && typeof item === "object" && typeof item.url === "string";

export const uploaded = (answer) => {
  if (urlBearing(answer)) return answer.url;
  try {
    const parsed = JSON.parse(answer);
    return urlBearing(parsed) ? parsed.url : answer;
  } catch {
    return answer;
  }
};

/* A shell parses what a caller types, and `ln` refuses a destination `cp` would overwrite. */
const shellArg = (value) => `'${String(value).replaceAll("'", `'\\''`)}'`;

/** A target with no route this credential reaches, named rather than left to the tracker's 401. */
export const targetRefusal = (target) =>
  `${target} is not a target this CLI uploads to, and nothing was sent. It uploads to `
  + `${declaredFor("forge_uploads", "targets").join(" and ")}. A session's attachment route takes a `
  + `browser session or a device token, neither of which is the credential here.`;

/* No verdict precedes the bytes, so a refusal owes which of the write are up (ISS-55). */
const behindIt = (sent) =>
  (sent.length
    ? `\n  ${sent.length} file(s) of this write are up and cannot be deleted: ${sent.join(", ")}.`
      + `\n  Cite those by name rather than by path, which would collide:`
      + `\n  --evidence ${sent.join(" --evidence ")}`
    : `\n  It was the first of the write, so nothing else went up.`);

/** What the refusal leaves out: the file, the extension, the set — offered, never enforced. */
export const uploadRefusal = (path, said, sent = []) => {
  const name = basename(path);
  const head = `${name} is a name the tracker would not take.\n  it said: ${said}`;
  if (!said.includes("MIME_NOT_ALLOWED")) return `${head}${behindIt(sent)}`;
  const ext = extname(name);
  return `${head}\n  The type goes up off the name and never off the bytes, and this one was typed `
    + `off ${ext ? `the extension ${ext}` : "a name carrying no extension"}.`
    + `\n  This CLI types ${declaredFor("forge_uploads", "extensions").join(" ")} — its reading of `
    + `the tracker's set rather than the tracker's own answer, so one missing here may work too.`
    + `${behindIt(sent)}`
    + `\n\nDo this: send the same bytes under a name it can type, and cite that name:`
    + `\n  ln -- ${shellArg(path)} ${shellArg(`${path}.txt`)}`;
};

const digestOf = (body) => createHash("sha256").update(body).digest("hex");

/* The callback fires the line before the request: from there the file may be up, the answer lost. */
const sendFile = async (target, targetId, { path, name, digest }, sending) => {
  const body = readFileSync(path);
  if (digestOf(body) !== digest) {
    fail(`${name} changed on disk between the scan that cleared it and its upload, so nothing was `
      + `sent for it. What a write puts up is what it read and judged. Send the command again.`);
  }
  sending(name);
  const asked = { action: "request", data: { target, targetId, name }, bytes: body };
  return write("forge_uploads", asked, undefined, true);
};

/** Two passes: the credential scan whole and ahead, so a secret in the last of ten costs no
 *  attachment (ISS-577), then one authenticated request per file carrying its own bytes. A body is
 *  dropped once scanned, so the peak stays one file, its digest standing in for it. */
export const uploadAll = async (target, targetId, paths, { renewing, sending = () => {} } = {}) => {
  if (!declaredFor("forge_uploads", "targets").includes(target)) fail(targetRefusal(target));
  const files = [];
  for (const path of paths) {
    const name = basename(path);
    const body = readFileSync(path);
    await refuseCredential(body.toString("utf8"), name);
    files.push({ path, name, digest: digestOf(body) });
  }
  const sent = [];
  for (const file of files) {
    await renewing?.();
    const row = await sendFile(target, targetId, file, sending);
    if (row?.refused) fail(uploadRefusal(file.path, row.refused, sent));
    /* The tracker's name: it sanitises, and a verdict cites what a read of the issue holds. */
    const named = row?.name ?? file.name;
    if (named !== file.name) {
      console.error(`${file.name} is up as ${named}, which the tracker made of the name sent; cite `
        + `that one — ${file.name} is no document on this issue.`);
    }
    console.log(`${named}  ${uploaded(row)}`);
    sent.push(named);
  }
  return sent;
};

/* The three shapes a citation may take: an attachment's name, a URL, a commit, and nothing else. */
const COMMIT = /^[0-9a-f]{7,40}$/iu;
const URL_REF = /^https?:\/\//u;

export const isCommit = (value) => COMMIT.test(String(value ?? ""));

export const attachmentNames = (body, comments) => [
  ...(body.attachments ?? []).map((one) => one.name),
  ...comments.flatMap((one) => (one.attachments ?? []).map((two) => two.name)),
];

export const evidenceHeld = (ref, names) => URL_REF.test(ref) || COMMIT.test(ref) || names.includes(ref);

/** The first value that is none of the three, or null; the caller is the one that refuses. */
export const evidenceProblem = (refs, names) => {
  const bad = refs.find((ref) => !evidenceHeld(ref, names));
  if (!bad) return null;
  return `Evidence \`${bad}\` is no attachment on this issue, no URL and no commit. `
    + "Attach it first (forge attach issue <ref> <file>), or cite a URL or a commit."
    + (names.length ? `\n  Attached: ${names.join(", ")}` : "");
};

/** What a command sent before it stopped. There is no delete for an upload, so the way out is to
 *  cite what is there rather than to send the path again, whose name would collide (ISS-55). */
export const strandedLine = (sent, reference) =>
  `${sent.length} upload(s) to ${reference} were begun before this stopped: ${sent.join(", ")}. Each `
  + `one the tracker acknowledged printed its URL above; whether any of the rest reached it is not `
  + `knowable from here. Read ${reference}: what is there cannot be deleted, so cite it by name `
  + `rather than by path, which would collide:\n  --evidence ${sent.join(" --evidence ")}`;

export const localFile = (given) => {
  const path = resolve(String(given ?? ""));
  try {
    return statSync(path).isFile() ? { path, name: basename(path) } : null;
  } catch {
    return null;
  }
};

export const TWICE = "A name attached twice resolves to two documents.";

/** A name to cite as it stands, a file to put up under its base name, or a collision: a name
 *  attached twice resolves to two documents and every verdict citing it is ambiguous (ISS-55). */
export const attachPlan = (refs, names, held) => {
  const plan = { upload: [], cite: [], refusal: null };
  const taken = [...names];
  for (const ref of refs) {
    /* A readable file is a file whatever its name reads as: `deadbee` is seven hex digits too. */
    const here = localFile(ref);
    if (here && taken.includes(here.name)) {
      plan.refusal = `${ref} is a file on disk and ${here.name} is already on this issue, or named `
        + `twice in this command. ${TWICE} Cite the one that is there:\n  --evidence ${here.name}`
        + `\nor amend it under a name of its own and cite that.`;
      return { ...plan, upload: [], cite: [] };
    }
    /* Said, not refused: a refusal here would name the citation the author already made. */
    if (here && names.includes(ref)) {
      console.error(`${ref} is on this issue and is also a file here; cited as the attachment that `
        + `is already up, which is not sent again. Amend it under a name of its own to cite the file.`);
    }
    const file = here && !names.includes(ref) ? here : null;
    if (file && held(ref)) {
      console.error(`${ref} is a readable file here and goes up as one; a URL or a commit of that `
        + `name has to be cited from somewhere a file cannot be read.`);
    }
    if (file) {
      plan.upload.push(file);
      taken.push(file.name);
    }
    plan.cite.push(file ? file.name : ref);
  }
  return plan;
};

/** A bare upload's `refusal` where a base name is already a document on the issue, and its `said`
 *  where the comment page stopped short — said, never refused: `record` cites a URL or a commit
 *  instead, and a verb that only uploads, against a list capped with no cursor, cannot (ISS-137). */
export const uploadRead = (paths, names, { reference, cut }) => {
  const taken = [...names];
  for (const path of paths) {
    const name = basename(path);
    if (taken.includes(name)) {
      return {
        refusal: `${name} is already a document on ${reference}, or is named twice in this command. `
          + `${TWICE} Nothing was sent. What is up can be neither deleted nor replaced, so cite it `
          + `by that name, or send the file under a name of its own.`,
      };
    }
    taken.push(name);
  }
  if (!cut) return {};
  return {
    said: `The names already on ${reference} cannot be read whole. ${cut} ${names.length} were read `
      + `here and one behind the cut cannot be seen. ${TWICE} Sending anyway, this verb having no `
      + `citation to make instead: read ${reference} before a record cites the name.`,
  };
};
