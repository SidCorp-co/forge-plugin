/* Whether a run's scratch holds a copy of one of this machine's credentials. A run home that borrows
   needs none, so one found here is a copy some run made and nothing else records: `finish` names each
   file and will not call the workspace clean while any stands (ISS-2612). */
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { userConfig } from "../../../plugin/src/resolve/config.mjs";
import { BORROWED, valueAt } from "../../../plugin/src/resolve/machine/borrowed.mjs";
import { machineValue, STORES } from "../../../plugin/src/resolve/machine/stores.mjs";

/* Shorter than any credential this machine holds, and long enough that a word of a log is never one. */
const SHORTEST = 12;

const leaves = (value) => {
  if (typeof value === "string") return value.length >= SHORTEST ? [value] : [];
  if (value && typeof value === "object") return Object.values(value).flatMap(leaves);
  return [];
};

const storeKey = (key) => {
  const [store, field] = key.split(".");
  return STORES.some((row) => row.store === store && row.keys.some((one) => one.key === field))
    ? [store, field] : null;
};

const narrowed = (value, within) => (within && Array.isArray(value) ? value.map((one) => one?.[within]) : value);

/* Each secret the way a reader of this machine resolves it: a store key through its fallback file too,
   the codex gateway key living in the profile on a box that never saved it here. */

export const machineSecrets = () => [...new Set(BORROWED.filter((row) => row.secret).flatMap((row) => {
  const store = storeKey(row.key);
  return leaves(narrowed(store ? machineValue(...store).value : valueAt(userConfig(), row.key), row.within));
}))];

/* A path that vanished while this read is nobody's copy; one that is there and cannot be read is a
   path nothing here can clear, so it is kept apart and refused on rather than read as clean. */
const GONE = "ENOENT";

const walked = (dir, into) => {
  let names;
  try {
    names = readdirSync(dir);
  } catch (error) {
    if (error.code !== GONE) into.unread.push(dir);
    return into;
  }
  for (const name of names) {
    const path = join(dir, name);
    const held = lstatSync(path, { throwIfNoEntry: false });
    if (held?.isDirectory()) walked(path, into);
    else if (held?.isFile()) into.files.push(path);
  }
  return into;
};

/** What the scratch under `dir` holds of `secrets`: every regular file whose bytes hold one, and every
 *  path that could not be read to say. A link is not followed, the file it names being somewhere
 *  else's; a directory that is not there holds nothing. */
export const copiesIn = (dir, secrets) => {
  const found = { copies: [], unread: [] };
  if (!secrets.length) return found;
  const { files, unread } = walked(dir, { files: [], unread: [] });
  found.unread.push(...unread);
  for (const path of files) {
    try {
      const text = readFileSync(path);
      if (secrets.some((one) => text.includes(one))) found.copies.push(path);
    } catch (error) {
      if (error.code !== GONE) found.unread.push(path);
    }
  }
  return found;
};
