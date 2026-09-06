/* Which installed copy a run began under, read off the plugin cache's directory creation times
   rather than off a field no transcript carries: docs/cli/stats-the-eval.md. */
import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { readJson } from "../resolve/config.mjs";

export const UNRECORDED = "unrecorded";

const RECORD = join(homedir(), ".claude", "plugins", "installed_plugins.json");
const OWN = new URL("../../.claude-plugin/plugin.json", import.meta.url);

/* The record plugin-copy.mjs reads, read again: that module is frozen, and an export there costs a restart. */
const installPathOf = (name, record) => {
  const held = readJson(record)?.plugins;
  if (!held || typeof held !== "object") return null;
  return Object.entries(held)
    .filter(([key]) => key.split("@")[0] === name)
    .flatMap(([, list]) => (Array.isArray(list) ? list : []))
    .map((one) => one?.installPath)
    .filter((one) => typeof one === "string")
    .at(-1) ?? null;
};

export const cacheRoot = (record = RECORD) => {
  const name = readJson(OWN)?.name;
  const path = name ? installPathOf(name, record) : null;
  return path ? dirname(path) : null;
};

/* A filesystem reporting no birth time gives a zero; the modification time stands in, `born` false. */
export const installedCopies = (root) => {
  if (!root) return [];
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((one) => one.isDirectory())
    .map((one) => {
      const held = statSync(join(root, one.name));
      const born = held.birthtimeMs > 0;
      return { version: one.name, at: born ? held.birthtimeMs : held.mtimeMs, born };
    })
    .sort((a, b) => a.at - b.at);
};

/* Older than every copy present is said, never filed under the oldest. */
export const versionAt = (copies, when) => copies.filter((one) => one.at <= when).at(-1)?.version ?? UNRECORDED;

export const spansInstall = (copies, run) => copies.some((one) => one.at > run.startedAt && one.at <= run.endedAt);
