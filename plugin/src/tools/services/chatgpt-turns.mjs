/* Where a detached ChatGPT turn lives while nobody is listening. One record file has one writer at a
   time and in one order — the parent at the spawn, the child until it settles, a collect only once no
   writer is left. No turn is sent here, so `EI-09` keeps naming chatgpt.mjs. docs/cli/chatgpt-detached.md. */
import { existsSync, mkdirSync, openSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { configDir, readJson, writeJsonPrivate } from "../../resolve/config.mjs";

/** Plumbing between two copies of this CLI: an action for it would be a second spelling of one switch. */
const TURN_VAR = "FORGE_CHATGPT_TURN";
export const turnAsked = () => process.env.FORGE_CHATGPT_TURN || null;

/* The child writes its timeout as the clock fires, so a record still `running` this far past its own deadline was killed rather than slow. */
const ABANDONED_AFTER_MS = 60_000;

export const WATCH_MS = 2000;
const ACKNOWLEDGED_MS = 15_000;
const KEEP_SETTLED_MS = 7 * 24 * 60 * 60 * 1000;
const PROMPT_CHARS = 60;

export const turnsDir = () => join(configDir("forge"), "chatgpt-turns");

const recordAt = (id) => join(turnsDir(), `${id}.json`);
const dropAt = (id) => join(turnsDir(), `${id}.drop`);
const logAt = (id) => join(turnsDir(), `${id}.log`);

export const newTurnId = () => randomBytes(4).toString("hex");

export const writeTurn = (record) => {
  mkdirSync(turnsDir(), { recursive: true });
  writeJsonPrivate(recordAt(record.id), record);
  return record;
};

export const readTurn = (id) => readJson(recordAt(id));

export const markDropped = (id) => {
  mkdirSync(turnsDir(), { recursive: true });
  writeFileSync(dropAt(id), `${new Date().toISOString()}\n`, { mode: 0o600 });
};

export const wasDropped = (id) => existsSync(dropAt(id));

/** The marker outranks the record because it is the one file the record's writer never touches: a
 *  child settling after the drop writes a real answer, and this is where that answer stops counting. */
export const stateOf = (record, id, now = Date.now()) => {
  if (wasDropped(id)) return "dropped";
  if (record.state !== "running") return record.state;
  return now > record.deadlineAt + ABANDONED_AFTER_MS ? "abandoned" : "running";
};

export const isSettled = (state) => state !== "running";

export const isWaiting = (record, id) => !record.collectedAt && stateOf(record, id) !== "dropped";

const idsHeld = () => {
  try {
    return readdirSync(turnsDir()).filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -5));
  } catch {
    return [];
  }
};

export const turnsWaiting = () => {
  const out = [];
  for (const id of idsHeld()) {
    const record = readTurn(id);
    if (record?.id && isWaiting(record, id)) out.push({ ...record, state: stateOf(record, id) });
  }
  return out.sort((one, other) => one.submittedAt - other.submittedAt);
};

/** Only what a caller has finished with, and only once it is old: an uncollected answer is what
 *  detaching promised to keep, so no age alone makes a record eligible for this. */
export const sweepTurns = (now = Date.now()) => {
  for (const id of idsHeld()) {
    const record = readTurn(id);
    const done = record?.collectedAt ?? (wasDropped(id) ? record?.submittedAt : null);
    if (!done || now - done < KEEP_SETTLED_MS) continue;
    for (const path of [recordAt(id), dropAt(id), logAt(id)]) rmSync(path, { force: true });
  }
};

const slept = (ms) => new Promise((wake) => setTimeout(wake, ms));

/** Chained rather than an interval, so one `clearTimeout` lets the process exit as the turn settles. */
export const watchForDrop = (id, giveUp) => {
  let timer = null;
  const tick = () => {
    if (wasDropped(id)) return giveUp();
    timer = setTimeout(tick, WATCH_MS);
    return undefined;
  };
  timer = setTimeout(tick, WATCH_MS);
  return () => clearTimeout(timer);
};

export const waitedFor = async (id, seconds, every = WATCH_MS) => {
  const until = Date.now() + seconds * 1000;
  for (;;) {
    const record = readTurn(id);
    if (!record) return null;
    if (isSettled(stateOf(record, id))) return record;
    if (Date.now() >= until) return record;
    await slept(Math.min(every, Math.max(1, until - Date.now())));
  }
};

/* Off this module, never `process.argv`: the child has to be this source tree and not the copy on
   PATH. Converted rather than read off `pathname`, which keeps a checkout with a space in it escaped. */
const cliPath = () => fileURLToPath(new URL("../../cli.mjs", import.meta.url));

/** Its own process group and no pipe back, or the shell that submitted the turn goes on waiting for
 *  the very process it just detached. */
export const detachedTurn = (rest, id) => {
  mkdirSync(turnsDir(), { recursive: true });
  const log = openSync(logAt(id), "a", 0o600);
  const child = spawn(process.execPath, [cliPath(), "chatgpt", "ask", ...rest], {
    detached: true,
    stdio: ["ignore", log, log],
    env: { ...process.env, [TURN_VAR]: id },
  });
  child.unref();
  return child.pid;
};

export const agedFor = (ms) => {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 360) / 10}h`;
};

export const promptShown = (prompt) =>
  (prompt.length > PROMPT_CHARS ? `${prompt.slice(0, PROMPT_CHARS - 1)}…` : prompt);

/** The child's own word that it stopped, which is the only acknowledgement there is: nothing here
 *  signals a process, so nothing here may report that a signal landed. */
export const acknowledged = async (id) => {
  const until = Date.now() + ACKNOWLEDGED_MS;
  for (;;) {
    if (readTurn(id)?.state === "dropped") return true;
    if (Date.now() >= until) return false;
    await slept(Math.min(WATCH_MS, Math.max(1, until - Date.now())));
  }
};
