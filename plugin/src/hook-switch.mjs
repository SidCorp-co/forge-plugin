/* Claude Code has no per-hook toggle, so this one is ours, and there is one of it: the account
   config, read by the hook process because hooks.json is read once at session start. A second
   switch for one decision is a precedence rule and a two-part undo. Names derive. docs/HOOKS.md. */
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { once, readJson, saveConfig, userConfig } from "./resolve/config.mjs";

export const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "hooks");

export const hookNames = () => {
  try {
    return readdirSync(HOOKS_DIR)
      .filter((name) => name.endsWith(".mjs") && !name.startsWith("_") && name !== "gate.mjs")
      .map((name) => name.replace(/\.mjs$/u, ""))
      .sort();
  } catch {
    return [];
  }
};

/* The gates a line runs: `gate.mjs a b c` names three; any other script names itself. */
const namesOn = (command) => {
  const gate = /hooks\/gate\.mjs((?:\s+[\w-]+)*)/u.exec(command);
  if (gate) return gate[1].trim().split(/\s+/u).filter((one) => one && one !== "pre" && one !== "post");
  const own = /hooks\/([\w-]+)\.mjs/u.exec(command);
  return own ? [own[1]] : [];
};

/* Where a name becomes a type: each gate is registered on one event, so switching the name
   switches that event. Memoised — `offNow` asks per hook, and one run reads one hooks.json. */
export const hookEvents = once(() => {
  const found = {};
  for (const [event, blocks] of Object.entries(readJson(join(HOOKS_DIR, "hooks.json"))?.hooks ?? {})) {
    for (const block of blocks ?? []) {
      for (const one of block.hooks ?? []) {
        for (const name of namesOn(one.command ?? "")) (found[name] ??= []).push(event);
      }
    }
  }
  return found;
});

export const hookEvent = (name) => (hookEvents()[name] ?? []).join(", ") || "registered on nothing";

/* A config that will not parse runs every gate: a failing switch must cost a gate firing, never a
   gate silently gone. */
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

export const offNow = () =>
  hookNames()
    .filter((name) => hookOff(name))
    .map((name) => ({ name, event: hookEvent(name) }));

export const strandedSwitches = () => {
  const real = new Set(hookNames());
  return [...hooksOff()].filter((name) => !real.has(name));
};
