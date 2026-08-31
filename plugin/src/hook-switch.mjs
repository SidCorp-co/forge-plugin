/* Claude Code has no per-hook toggle, so this one is ours, and the hook process reads it: hooks.json
   is read at session start and hook code on every event, which makes config the only switch that
   takes effect without a restart. Names derive from the directory. docs/HOOKS.md. */
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { saveConfig, userConfig } from "./resolve/config.mjs";

const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "hooks");

export const hookNames = () => {
  try {
    return readdirSync(HOOKS_DIR)
      .filter((name) => name.endsWith(".mjs") && !name.startsWith("_"))
      .map((name) => name.replace(/\.mjs$/u, ""))
      .sort();
  } catch {
    return [];
  }
};

/* A config that will not parse runs every gate: a switch failing must fire one, not lose one. */
export const hooksOff = () => {
  const held = userConfig().hooksOff;
  return new Set(Array.isArray(held) ? held : []);
};

export const hookOff = (name) => hooksOff().has(name);

export const setHook = (name, off) => {
  const held = hooksOff();
  if (off) held.add(name);
  else held.delete(name);
  const list = [...held].sort();
  saveConfig({ hooksOff: list });
  return list;
};

export const strandedSwitches = () => {
  const real = new Set(hookNames());
  return [...hooksOff()].filter((name) => !real.has(name));
};
