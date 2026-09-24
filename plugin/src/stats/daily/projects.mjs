/* Which projects this device has registered, and which checkout each one's runs were worked in. The
   registry holds a name per repository root folder and no path, and a transcript root is derived
   from a path, so the path is read off the record the host keeps of every session it ran: its
   working directory — docs/cli/stats.md. */
import { closeSync, openSync, readSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

import { configDir, readJson } from "../../resolve/config.mjs";
import { checkoutAt } from "../../git/checkout-at.mjs";
import { durableBase } from "../corpus/corpus.mjs";

/* A session's working directory is on its first records, and a transcript runs to megabytes: the
   head is read and never the file. */
const HEAD = 64 * 1024;
const CWD = /"cwd":"((?:[^"\\]|\\.)*)"/u;

const entries = (directory) => {
  try {
    return readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
};

const headOf = (path) => {
  let handle = null;
  try {
    handle = openSync(path, "r");
    const buffer = Buffer.alloc(HEAD);
    return buffer.subarray(0, readSync(handle, buffer, 0, HEAD, 0)).toString("utf8");
  } catch {
    return "";
  } finally {
    if (handle !== null) closeSync(handle);
  }
};

const cwdIn = (store) => {
  for (const one of entries(store)) {
    if (!one.isFile() || !one.name.endsWith(".jsonl")) continue;
    const found = CWD.exec(headOf(join(store, one.name)))?.[1];
    if (found) return JSON.parse(`"${found}"`);
  }
  return null;
};

/** Every project this device has a record of, by the folder its record sits under and the tracker
 *  slug that record names. */
export const registered = () => {
  const room = join(configDir("forge"), "projects");
  return entries(room)
    .filter((one) => one.isDirectory())
    .map((one) => ({ name: one.name, record: readJson(join(room, one.name, "config.json")) }))
    .filter((one) => one.record !== null)
    .map((one) => ({ name: one.name, slug: one.record.slug ?? null }))
    .sort((left, right) => left.name.localeCompare(right.name));
};

/** The registered projects each paired with the repository a session store names for it, and the
 *  registered ones no store names. A repository is keyed on its own root folder, exactly as the
 *  registry is, so a worktree's session and the checkout's answer as one project. */
export const projectsOn = () => {
  const projects = registered();
  const wanted = new Set(projects.map((one) => one.name));
  const found = new Map();
  for (const store of entries(durableBase())) {
    if (!store.isDirectory()) continue;
    const cwd = cwdIn(join(durableBase(), store.name));
    const repository = cwd ? checkoutAt(cwd)?.repository ?? null : null;
    if (repository && wanted.has(basename(repository))) {
      found.set(repository, basename(repository));
    }
  }
  const read = [...found].map(([checkout, name]) => ({ ...projects.find((one) => one.name === name), checkout }))
    .sort((left, right) => left.name.localeCompare(right.name) || left.checkout.localeCompare(right.checkout));
  const reached = new Set(read.map((one) => one.name));
  return { read, unread: projects.filter((one) => !reached.has(one.name)) };
};
