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

/* Each secret the way a reader of this machine resolves it: a store key through its fallback file too,
   the codex gateway key living in the profile on a box that never saved it here. */
export const machineSecrets = () => [...new Set(BORROWED.filter((row) => row.secret).flatMap((row) => {
  const store = storeKey(row.key);
  return leaves(store ? machineValue(...store).value : valueAt(userConfig(), row.key));
}))];

const filesUnder = (dir) => {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.flatMap((name) => {
    const path = join(dir, name);
    const held = lstatSync(path, { throwIfNoEntry: false });
    if (held?.isDirectory()) return filesUnder(path);
    return held?.isFile() ? [path] : [];
  });
};

const holds = (path, secrets) => {
  try {
    const text = readFileSync(path);
    return secrets.some((one) => text.includes(one));
  } catch {
    return false;
  }
};

/** Every regular file under `dir` whose bytes hold one of `secrets`; a link is not followed, the file
 *  it names being somewhere else's. */
export const copiesIn = (dir, secrets) => (secrets.length ? filesUnder(dir).filter((path) => holds(path, secrets)) : []);
