/* Claude Code has no per-hook toggle, so these two are ours, in the shape codex already uses: a
   variable for one session, a config list for every session. Read by the hook process, because
   hooks.json is read once at session start. Names and events derive. docs/HOOKS.md. */
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { readJson, saveConfig, userConfig } from "./resolve/config.mjs";

const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "hooks");
const OFF = new Set(["0", "off", "false", "no"]);
const ON = new Set(["1", "on", "true", "yes"]);

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

/* Where a name becomes a type: each script is registered on one event, so switching the name
   switches that event. A test holds it to one — a script on two would need a key naming the pair. */
export const hookEvents = () => {
  const found = {};
  for (const [event, blocks] of Object.entries(readJson(join(HOOKS_DIR, "hooks.json"))?.hooks ?? {})) {
    for (const block of blocks ?? []) {
      for (const one of block.hooks ?? []) {
        const named = /hooks\/([\w-]+)\.mjs/u.exec(one.command ?? "");
        if (named) (found[named[1]] ??= []).push(event);
      }
    }
  }
  return found;
};

export const hookEvent = (name) => (hookEvents()[name] ?? []).join(", ") || "registered on nothing";

export const hookEnv = (name) => `FORGE_HOOK_${name.replace(/-/gu, "_").toUpperCase()}`;

/* A value neither set spells runs the gate, as does a config that will not parse: a failing switch
   must cost a gate firing, never a gate silently gone. */
const envSays = (name) => {
  const raw = (process.env[hookEnv(name)] ?? "").trim().toLowerCase();
  if (OFF.has(raw)) return true;
  if (ON.has(raw)) return false;
  return null;
};

export const hooksOff = () => {
  const held = userConfig().hooksOff;
  return new Set(Array.isArray(held) ? held : []);
};

/* The variable wins — one session, no write — and leaves no trace, so offNow asks both. */
export const hookOff = (name) => envSays(name) ?? hooksOff().has(name);

export const setHook = (name, off) => {
  const held = hooksOff();
  if (off) held.add(name);
  else held.delete(name);
  const list = [...held].sort();
  saveConfig({ hooksOff: list });
  return list;
};

export const offNow = () =>
  hookNames()
    .filter((name) => hookOff(name))
    .map((name) => ({
      name,
      event: hookEvent(name),
      env: envSays(name) === true,
      config: envSays(name) !== false && hooksOff().has(name),
    }));

export const strandedSwitches = () => {
  const real = new Set(hookNames());
  return [...hooksOff()].filter((name) => !real.has(name));
};
