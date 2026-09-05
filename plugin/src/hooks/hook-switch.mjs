/* Claude Code has no per-hook toggle, so this one is ours, and there is one of it: the account
   config, read by the hook process because hooks.json is read once at session start. A second
   switch for one decision is a precedence rule and a two-part undo. Names derive. docs/HOOKS.md. */
import { readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { once, readJson, saveConfig, userConfig } from "../resolve/config.mjs";

export const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "hooks");
export const ENTRIES_DIR = join(HOOKS_DIR, "entries");
export const GATES_DIR = join(HOOKS_DIR, "gates");

const RUNS_ALONE = (name) => name.endsWith(".mjs") && !name.startsWith("_") && name !== "gate.mjs";

/* Flat: the gates, how pages and vendored copies beside them are no hook a switch can name. */
const scriptsIn = (dir) => {
  try {
    return readdirSync(dir).filter(RUNS_ALONE);
  } catch {
    return [];
  }
};

/* Walked: gates split by what one judges — a call, or the turn — and a folder is not a second name. */
const filesUnder = (dir) => {
  let listed = [];
  try {
    listed = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const one of listed) {
    if (one.isDirectory()) out.push(...filesUnder(join(dir, one.name)));
    else if (RUNS_ALONE(one.name)) out.push(join(dir, one.name));
  }
  return out;
};

export const hookNames = () =>
  [...scriptsIn(HOOKS_DIR), ...filesUnder(ENTRIES_DIR).map((path) => basename(path))]
    .map((name) => name.replace(/\.mjs$/u, "")).sort();

/** The file a gate name runs, wherever the layout put it, null where none does; one name is one file,
 *  since a second is a precedence rule. A name already a path is one: that plants a gate that crashes. */
export const gateFile = (name) =>
  (name.includes("/")
    ? join(GATES_DIR, `${name}.mjs`)
    : filesUnder(GATES_DIR).find((path) => basename(path) === `${name}.mjs`) ?? null);

/* The gates a line runs: `gate.mjs a b c` names three, less the first word, which is the clock. */
const KIND = ["pre", "post", "stop"];
const namesOn = (command) => {
  const gate = /hooks\/gate\.mjs((?:\s+[\w-]+)*)/u.exec(command);
  if (gate) return gate[1].trim().split(/\s+/u).filter((one) => one && !KIND.includes(one));
  const own = /hooks\/([\w-]+)\.mjs/u.exec(command);
  return own ? [own[1]] : [];
};

/* Where a name becomes a type: one gate is on one event, or on the stop pair. Memoised — `offNow` asks per hook, and one run reads one hooks.json. */
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
