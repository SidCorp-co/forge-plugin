/* What a verdict cites and how it gets onto the issue: the upload, and the reading of an --evidence
   value that is a file on disk. Attach then re-send the record was a round of the agent's (ISS-65). */
import { readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";

import { fail, settings } from "../resolve/settings.mjs";
import { refuseCredential, write } from "./rpc.mjs";

export const urlBearing = (item) => Boolean(item) && typeof item === "object" && typeof item.url === "string";

export const uploaded = (answer) => {
  try {
    const parsed = JSON.parse(answer);
    return urlBearing(parsed) ? parsed.url : answer;
  } catch {
    return answer;
  }
};

/* Bytes go to the presigned URL, never base64 through context, and the callback fires the line
   before the PUT: from there the file may be up, so the guard judges before the slot is minted. */
export const uploadTo = async (target, targetId, path, sending = () => {}) => {
  const name = basename(path);
  const body = readFileSync(path);
  await refuseCredential(body.toString("utf8"), name);
  const minted = await write("forge_uploads", { action: "request", data: { target, targetId, name } });
  const url = new URL(minted.uploadUrl ?? `${new URL(settings().url).origin}${minted.uploadPath}`);
  if (!["http:", "https:"].includes(url.protocol)) fail(`The upload URL for ${name} is ${url.protocol}, not http.`);
  sending(name);
  const put = await fetch(url, { method: "PUT", body });
  const answer = await put.text();
  if (!put.ok) fail(`Upload of ${name} answered ${put.status}: ${answer.slice(0, 300)}`);
  console.log(`${name}  ${uploaded(answer)}`);
  return name;
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

const TWICE = "A name attached twice resolves to two documents.";

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
