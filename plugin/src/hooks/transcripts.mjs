// Which transcript an event means and what it says, once for both sides of the hook boundary,
// since a check under src/ cannot import the harness. Memory is one project's, so memoryDir is
// never transcriptOf.
import { closeSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { jsonLines as parsed } from "./log/hook-log-file.mjs";

const SUBAGENTS = "subagents";

export const isSubagent = (ev) => ev.hook_event_name === "SubagentStop";
export const transcriptOf = (ev) => (isSubagent(ev) && ev.agent_transcript_path) || ev.transcript_path || "";

export const ownTranscript = (ev) => {
  const held = ev.transcript_path || "";
  if (!ev.agent_id || !held) return held;
  return join(held.replace(/\.jsonl$/u, ""), SUBAGENTS, `agent-${ev.agent_id}.jsonl`);
};

const projectDir = (path) => {
  const held = dirname(path);
  return basename(held) === SUBAGENTS ? dirname(dirname(held)) : held;
};

export const memoryDir = (ev) => {
  const held = ev.transcript_path || ev.agent_transcript_path || "";
  return held ? join(projectDir(held), "memory") : "";
};

/* One get/compute/set for both maps below. `has` and never a falsy answer: a computed `-1` and an index nobody has computed read the same otherwise. And the caller hands it the very array it will spend, since that is the key. */
export const memo = (held, key, make) => {
  if (!held.has(key)) held.set(key, make());
  return held.get(key);
};

/* Kept per array: one stop event asks three times over a tail that reaches hundreds of thousands of records, and `turnRecords` hands every caller the same array. `NONE` is the key a caller with nothing gets, since the answer for it is the same -1 every time. */
const begunAt = new WeakMap();
const NONE = [];

/** Where this turn begins: only a user record carrying `promptSource` is a prompt somebody typed. */
export const promptIndex = (given) => {
  const records = given ?? NONE;
  return memo(begunAt, records, () => {
    let from = -1;
    for (let at = 0; at < records.length; at += 1) {
      if (records[at]?.type === "user" && typeof records[at].promptSource === "string") from = at;
    }
    return from;
  });
};

export const turnAt = (records) => records[promptIndex(records)]?.timestamp ?? "";

/** From this turn's prompt on: `turnRecords` hands back the whole tail it read. */
const turnTail = new WeakMap();

export const sinceTurn = (records) => {
  const held = records ?? NONE;
  return memo(turnTail, held, () => held.slice(Math.max(0, promptIndex(held))));
};

/** When this call began, in epoch ms, and 0 where the transcript cannot say: the last assistant record asks for this tool and lands before the tool runs, so a stamp older than it is the checkout's and not the call's. `forge hooks --how writes`. */
export const callAt = (records) => {
  for (let at = (records ?? []).length - 1; at >= 0; at -= 1) {
    if (records[at]?.type === "assistant") return Date.parse(records[at].timestamp) || 0;
  }
  return 0;
};

const TAIL = 1 << 20;
const TAIL_CAP = 64 << 20;

/** When a call was asked for, read from the transcript of the agent that asked: `callAt` wants the
 *  one record at the end, so a tail answers, grown where a tool result larger than the window stands
 *  between that record and the end of the file. 0 where nothing can be read, as `callAt` is. */
export const calledAt = (path, { tail = TAIL, cap = TAIL_CAP } = {}) => {
  let size = 0;
  try {
    size = statSync(path).size;
  } catch {
    return 0;
  }
  for (let span = tail; ; span *= 2) {
    const at = callAt(lastRecords(path, span));
    if (at || span >= size || span >= cap) return at;
  }
};

const PROMPT_KEY = Buffer.from('"promptSource"');
const NEWLINE = 0x0a;

const spanOf = (handle, from, to) => {
  const held = Buffer.alloc(to - from);
  readSync(handle, held, 0, held.length, from);
  return held;
};

/* The key is in quoted content too — a record about a record, this session's own transcript included —
   so a hit is read as a line and has to parse as the prompt. Bounded: past the cap it is one read. */
const isPrompt = (handle, start, size) => {
  const room = Math.min(TAIL, size - start);
  const line = spanOf(handle, start, start + room);
  const end = line.indexOf(NEWLINE);
  try {
    return typeof JSON.parse(line.subarray(0, end < 0 ? room : end).toString("utf8")).promptSource === "string";
  } catch {
    return false;
  }
};

/* Where the last prompt is, searched as bytes rather than parsed as records: past the window this is
   what a turn costs, and the alternative was answering "no turn" — once a session, not once a turn. */
const promptAt = (handle, size) => {
  for (let end = size; end > 0; ) {
    const from = Math.max(0, end - TAIL);
    const held = spanOf(handle, from, end);
    for (let at = held.lastIndexOf(PROMPT_KEY); at >= 0; at = held.lastIndexOf(PROMPT_KEY, at - 1)) {
      const start = from + held.lastIndexOf(NEWLINE, at) + 1;
      if (isPrompt(handle, start, size)) return start;
    }
    if (from === 0) return -1;
    end = from + PROMPT_KEY.length - 1;
  }
  return -1;
};

/** This turn, without reading the session for it: a transcript reaches hundreds of megabytes and the
 *  last prompt is at the end. Grown rather than fixed, because one turn's records can outrun a
 *  window, and a partial first line is dropped since a read cuts wherever the offset lands. */
const turns = new Map();
export function turnRecords(path, { tail = TAIL, cap = TAIL_CAP } = {}) {
  const key = `${path}\0${tail}\0${cap}`;
  if (!turns.has(key)) turns.set(key, readTurn(path, tail, cap));
  return turns.get(key);
}

function readTurn(path, tail, cap) {
  let size = 0;
  let handle = null;
  try {
    size = statSync(path).size;
    handle = openSync(path, "r");
  } catch {
    return null;
  }
  try {
    for (let span = tail; ; span *= 2) {
      const from = Math.max(0, size - span);
      const text = spanOf(handle, from, size).toString("utf8");
      const records = parsed(from > 0 ? text.slice(text.indexOf("\n") + 1) : text);
      if (promptIndex(records) >= 0 || from === 0) return records;
      if (span >= cap) {
        const at = promptAt(handle, size);
        return at >= 0 ? parsed(spanOf(handle, at, size).toString("utf8")) : records;
      }
    }
  } catch {
    return null;
  } finally {
    closeSync(handle);
  }
}

/** The last records of a transcript, whichever turn they fall in: an agent's own carries no prompt record, so nothing in it marks a turn and `turnRecords` would parse the file whole to learn that. A record the window cut is dropped, a line read in part not being the line. */
export function lastRecords(path, span = TAIL) {
  let handle = null;
  try {
    const size = statSync(path).size;
    handle = openSync(path, "r");
    const from = Math.max(0, size - span);
    const text = spanOf(handle, from, size).toString("utf8");
    return parsed(from > 0 ? text.slice(text.indexOf("\n") + 1) : text);
  } catch {
    return null;
  } finally {
    if (handle !== null) closeSync(handle);
  }
}

/** Null and not an empty list: a gate that reads "no advice" from a transcript it could not open
 *  would stop the work it exists to order. */
export function transcript(path) {
  try {
    return parsed(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
