/* Which document each key a holder claimed resolved to, and in which project, so a key resolving
   elsewhere once the saved slug has moved under the run is refused rather than followed:
   docs/cli/one-call-elsewhere.md. One file per holder, so no other holder's write ever touches it. */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { configDir, readJson, sessionHeld, writeJsonPrivate } from "../config.mjs";
import { underLock } from "../machine/file-lock.mjs";
import { aimSaid, aimedHere, slugIfAny } from "../settings.mjs";
import { tried } from "../../tracker/rest.mjs";

const KEYED = /^ISS-\d+$/iu;

const pinsDir = () => join(configDir("forge"), "claims");

const pinsOf = (holder) => join(pinsDir(), `${encodeURIComponent(holder)}.json`);

const heldPins = (holder) => readJson(pinsOf(holder)) ?? {};

/** Records the document a lease write landed on under `ref`, where that lease names this process's
 *  holder and the call read its project off the saved record. A call aimed elsewhere pins nothing:
 *  it chose its project, and a pin from it would refuse the run's own key afterwards. */
export const pinClaim = async (ref, documentId, context) => {
  const holder = sessionHeld();
  if (!holder || context?.lease?.holder !== holder || !documentId || aimedHere()) return;
  const project = slugIfAny();
  if (!project) return;
  /* A claim typed by document id writes under that id, and it is the route a run that meant the move
     takes the key on the new project by, so the key is read off the issue rather than skipped. */
  const key = String(KEYED.test(String(ref ?? "")) ? ref
    : (await tried("forge_issues", { action: "get", documentId, fields: [] }))?.issueId ?? "").toUpperCase();
  if (!KEYED.test(key)) return;
  const path = pinsOf(holder);
  mkdirSync(pinsDir(), { recursive: true });
  underLock(`${path}.lock`, () => {
    const held = heldPins(holder);
    if (held[key]?.documentId === documentId && held[key]?.project === project) return;
    writeJsonPrivate(path, { ...held, [key]: { documentId, project } });
  });
};

/** The refusal owed where `reference` resolved to `documentId` and this holder's claim under that key
 *  was taken on another document, or null. An aimed call is never compared. */
export const movedUnderClaim = (reference, documentId) => {
  const holder = sessionHeld();
  const key = String(reference ?? "").toUpperCase();
  if (!holder || !KEYED.test(key) || aimedHere()) return null;
  const pin = heldPins(holder)[key];
  if (!pin?.documentId || pin.documentId === documentId) return null;
  return `${key} resolves in ${aimSaid()} to document ${documentId}, but this run claimed ${key} on `
    + `project ${pin.project}, document ${pin.documentId}. The saved slug was moved after that claim, `
    + "which moves every run standing in this checkout, and this call would have reached another "
    + "project's issue as this run's own. Nothing was sent.\n"
    + `Put the saved slug back on the project the claim was taken in: forge doctor --set slug=${pin.project}\n`
    + `Where the move was meant and this run is to work the issue the key names now, claim it by its `
    + `id, which moves this run's claim there: forge claim ${documentId}`;
};
