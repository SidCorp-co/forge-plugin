/* What a verdict cites and how it gets onto the issue: the upload, and the reading of an --evidence
   value that is a file on disk. Attach then re-send the record was a round of the agent's (ISS-65). */
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, resolve, sep } from "node:path";

import { fail } from "../resolve/settings.mjs";
import { decodesAsUtf8 } from "../wire/upload-mimes.mjs";
import { declaredFor, refuseCredential, write } from "./rest.mjs";

export const urlBearing = (item) => Boolean(item) && typeof item === "object" && typeof item.url === "string";

/** The URL of what went up, or the answer whole where it carries none — the row `routes.mjs` builds every upload's answer as, never a string it once was (ISS-614). */
export const uploaded = (answer) => (urlBearing(answer) ? answer.url : answer);

/* A shell parses what a caller types, and `ln` refuses a destination `cp` would overwrite. */
const shellArg = (value) => `'${String(value).replaceAll("'", `'\\''`)}'`;

/** A target with no route this credential reaches, named rather than left to the tracker's 401. */
const targetRefusal = (target) =>
  `${target} is not a target this CLI uploads to, and nothing was sent. It uploads to `
  + `${declaredFor("forge_uploads", "targets").join(" and ")}. A session's attachment route takes a `
  + `browser session or a device token, neither of which is the credential here.`;

/* Where the batch stopped, only a refusal the tracker made about this one request lets the rest go:
   a credential refused, a limit spent or no answer at all would meet every file after it alike. */
const aboutTheFile = ({ status }) => status >= 400 && status < 500 && ![401, 403, 408, 429].includes(status);

const typeRefused = (one) => one.said.includes("MIME_NOT_ALLOWED");

/* No answer, or a failure on the tracker's side of it: the file may be up with the answer lost. */
const unanswered = (one) => !one.status || one.status >= 500;

/* The tracker's own set, off its refusal body: a copy kept here is one that goes stale unseen. */
const acceptedSet = (refused) => {
  const allowed = refused.find((one) => one.details?.allowed)?.details.allowed;
  if (!allowed?.mimes?.length) return "The tracker's refusal named no set of types it takes.";
  return `The tracker takes ${allowed.mimes.join(" ")}`
    + `${allowed.anyExtensionIfText ? ", and text under any name" : ""}.`;
};

/* A control byte a terminal capture carries, tab, line feed and carriage return kept: what the
   tracker reads as binary in bytes that are otherwise text. */
const CONTROL = String.raw`\000-\010\013\014\016-\037\177`;

const plainBeside = (path) => {
  const ext = extname(path);
  return join(dirname(path), `${basename(path, ext)}-plain${ext}`);
};

/* The way out reads the bytes and never the name, since the tracker judges the bytes and a new name
   sends the same ones: a capture that is text loses its control bytes, and anything else is read. */
const bytesSaid = (one) => (one.utf8
  ? "The bytes decode as text, so it is their control bytes the tracker read as binary."
  : "The bytes do not decode as text, and the tracker judged the bytes, so no name sends them as text.");

/* `set -C` in a subshell of its own: a destination already there is refused rather than overwritten,
   and the caller's shell keeps the options it had. */
const wayOut = (one) => (one.utf8
  ? `  (set -C; LC_ALL=C tr -d '${CONTROL}' < ${shellArg(one.path)} > ${shellArg(plainBeside(one.path))})`
    + `\n    then send ${basename(plainBeside(one.path))} in place of ${one.name}.`
  : `  file --mime-type -- ${shellArg(one.path)}`
    + `\n    then send ${one.name}'s bytes converted to one of the types above: under a new name alone `
    + `they are refused the same way.`);

/** The whole of a write that did not all go up: what went, what the tracker refused and in its
 *  words, what was never sent, the set it takes, the citation for what is up, and one way out per
 *  file refused for its type. */
export const batchRefusal = (reference, { sent, refused, unsent }) => {
  const total = sent.length + refused.length + unsent.length;
  const lost = refused.filter(unanswered);
  const judged = refused.length - lost.length;
  const lines = [`${sent.length} of ${total} file(s) went up to ${reference}, and ${judged} `
    + `${judged === 1 ? "was" : "were"} refused${lost.length ? `; ${lost.length} had no answer` : ""}`
    + `${unsent.length ? `; ${unsent.length} not sent` : ""}:`];
  for (const one of refused) {
    const why = typeRefused(one) ? `\n    ${bytesSaid(one)}` : "";
    const maybe = unanswered(one)
      ? `\n    It may be up with the answer lost: read ${reference} before sending it again, and cite `
        + `${one.name} by name if it is there.`
      : "";
    lines.push(`  ${one.name} — ${one.said}${why}${maybe}`);
  }
  const typed = refused.filter(typeRefused);
  if (typed.length) lines.push(acceptedSet(typed));
  if (unsent.length) {
    lines.push(`Not sent, the write stopping at ${refused.at(-1).name}, which the tracker did not judge: `
      + `${unsent.join(", ")}.`);
  }
  if (sent.length) {
    lines.push(`Up already: ${sent.join(", ")}. Cite them by name rather than by path, which would collide:`
      + `\n  --evidence ${sent.join(" --evidence ")}`);
  }
  if (typed.length) {
    lines.push(`\nDo this:\n${typed.map(wayOut).join("\n")}`);
  }
  return lines.join("\n");
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

/** Two passes: the credential scan whole and ahead, so a secret in the last of ten costs no attachment (ISS-577), then one authenticated request per file carrying its own bytes. A body is dropped once scanned, so the peak stays one file, its digest standing in for it.
 *  Per file: a file the tracker refuses is set aside with its words and the rest still go, so what
 *  comes back is `{ sent, refused, unsent }` and the caller decides what a refusal costs. A refusal that
 *  is not the tracker's verdict on the file stops the write, the files behind it left unsent.
 *  `said` is spoken on the line before the first request, past the renewal and the digest check that can each still refuse, so a line saying the file is being sent is never printed on a call that sent none. */
export const uploadAll = async (target, targetId, paths, { renewing, sending = () => {}, said = null } = {}) => {
  if (!declaredFor("forge_uploads", "targets").includes(target)) fail(targetRefusal(target));
  const files = [];
  for (const path of paths) {
    const name = basename(path);
    const body = readFileSync(path);
    await refuseCredential(body.toString("utf8"), name);
    files.push({ path, name, digest: digestOf(body), utf8: decodesAsUtf8(body) });
  }
  const [sent, refused] = [[], []];
  for (const [at, file] of files.entries()) {
    await renewing?.();
    const row = await sendFile(target, targetId, file, (name) => {
      if (said && at === 0) console.error(said);
      sending(name);
    });
    if (row?.refused) {
      refused.push({ ...file, said: row.refused, status: row.status ?? null, details: row.details ?? null });
      if (aboutTheFile(row)) continue;
      return { sent, refused, unsent: files.slice(at + 1).map((one) => one.name) };
    }
    /* The tracker's name: it sanitises, and a verdict cites what a read of the issue holds. */
    const named = row?.name ?? file.name;
    if (named !== file.name) {
      console.error(`${file.name} is up as ${named}, which the tracker made of the name sent; cite `
        + `that one — ${file.name} is no document on this issue.`);
    }
    console.log(`${named}  ${uploaded(row)}`);
    sent.push(named);
  }
  return { sent, refused, unsent: [] };
};

/* The three shapes a citation may take: an attachment's name, a URL, a commit, and nothing else. */
const COMMIT = /^[0-9a-f]{7,40}$/iu;
const URL_REF = /^https?:\/\//u;

export const isCommit = (value) => COMMIT.test(String(value ?? ""));

export const shortSha = (sha) => String(sha ?? "").slice(0, 7);

/* A verdict may name seven digits where a mark's note names forty, so the shorter one decides. */
export const sameCommit = (one, two) => {
  const [left, right] = [one, two].map((held) => String(held ?? "").trim().toLowerCase());
  if (left.length < 7 || right.length < 7) return false;
  const width = Math.min(left.length, right.length);
  return left.slice(0, width) === right.slice(0, width);
};

export const attachmentNames = (body, comments) => [
  ...(body.attachments ?? []).map((one) => one.name),
  ...comments.flatMap((one) => (one.attachments ?? []).map((two) => two.name)),
];

export const evidenceHeld = (ref, names) => URL_REF.test(ref) || COMMIT.test(ref) || names.includes(ref);

/* An attachment goes up under its base name, so a value carrying a separator names a place on disk
   and never a document on the issue: sending it to `forge attach` only fails there instead (ISS-2506). */
const pathShaped = (ref) => ref.includes("/") || ref.includes(sep) || isAbsolute(ref);

const isDirectory = (path) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/* The nearest directory that exists is where the real name can be read off, whichever level the typo is at. */
const missingFile = (ref) => {
  const path = resolve(ref);
  let listed = dirname(path);
  while (!isDirectory(listed) && dirname(listed) !== listed) listed = dirname(listed);
  const where = path === ref ? "" : ` (${path})`;
  const gap = listed === dirname(path) ? "" : ` ${dirname(path)} is no directory here, so nothing under it exists.`;
  return `Evidence \`${ref}\`${where} names no readable file, so there is nothing to put up.${gap} `
    + `Read the name off what is there, and send the command again with the path it gives:`
    + `\n  ls -- ${shellArg(listed)}`;
};

/** The first value that is none of the three, or null; the caller is the one that refuses. */
export const evidenceProblem = (refs, names) => {
  const bad = refs.find((ref) => !evidenceHeld(ref, names));
  if (bad === undefined) return null;
  if (pathShaped(bad) && !localFile(bad)) return missingFile(bad);
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

/** What either route that puts a file up says where the comment walk stopped short, and the one place
 *  that decides it: said and sent, never refused. No name a caller could choose clears a list that
 *  cannot be read, so a refusal only sent the caller to `forge attach` and the same risk (ISS-447).
 *  A prefix alone: a thread the tracker called whole has handed over every name it is going to. */
export const unreadNames = (reference, count, cut) => (cut
  ? `The names already on ${reference} cannot be read whole. ${cut} ${count} were read here and one `
    + `behind the cut cannot be seen. ${TWICE} Sending anyway, no name a caller could choose clearing `
    + `a list that cannot be read: where ${reference} turns out to carry the name twice, attach the `
    + `file again under a name of its own and cite that.`
  : null);

/** A bare upload's `refusal` where a base name is already a document on the issue, and its `said`
 *  where the comment page stopped short (ISS-137). */
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
  const said = unreadNames(reference, names.length, cut);
  return said ? { said } : {};
};
