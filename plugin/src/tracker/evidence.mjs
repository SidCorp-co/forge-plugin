/* What a verdict cites and how it gets onto the issue: the upload, and the reading of an --evidence
   value that is a file on disk. Attach then re-send the record was a round of the agent's (ISS-65). */
import { readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";

import { fail, settings } from "../resolve/settings.mjs";
import { write } from "./rpc.mjs";

export const urlBearing = (item) => Boolean(item) && typeof item === "object" && typeof item.url === "string";

export const uploaded = (answer) => {
  try {
    const parsed = JSON.parse(answer);
    return urlBearing(parsed) ? parsed.url : answer;
  } catch {
    return answer;
  }
};

/* Bytes go to the presigned URL, never base64 through context. The URL is the credential. */
export const uploadTo = async (target, targetId, path) => {
  const name = basename(path);
  const minted = await write("forge_uploads", { action: "request", data: { target, targetId, name } });
  const url = minted.uploadUrl ?? `${new URL(settings().url).origin}${minted.uploadPath}`;
  const put = await fetch(url, { method: "PUT", body: readFileSync(path) });
  const answer = await put.text();
  if (!put.ok) fail(`Upload of ${name} answered ${put.status}: ${answer.slice(0, 300)}`);
  console.log(`${name}  ${uploaded(answer)}`);
  return name;
};

export const localFile = (given) => {
  const path = resolve(String(given ?? ""));
  try {
    return statSync(path).isFile() ? { path, name: basename(path) } : null;
  } catch {
    return null;
  }
};

/** A name to cite as it stands, a file to put up under its base name, or a collision: a name
 *  attached twice resolves to two documents and every verdict citing it is ambiguous (ISS-55). */
export const attachPlan = (refs, names, held) => {
  const plan = { upload: [], cite: [], refusal: null };
  const taken = [...names];
  for (const ref of refs) {
    const file = held(ref) ? null : localFile(ref);
    if (file && taken.includes(file.name)) {
      plan.refusal = `${ref} is a file on disk and ${file.name} is already on this issue, or named `
        + `twice in this command. A name attached twice resolves to two documents. Cite the one that `
        + `is there:\n  --evidence ${file.name}\nor amend it under a name of its own and cite that.`;
      return { ...plan, upload: [], cite: [] };
    }
    if (file) {
      plan.upload.push(file);
      taken.push(file.name);
    }
    plan.cite.push(file ? file.name : ref);
  }
  return plan;
};

