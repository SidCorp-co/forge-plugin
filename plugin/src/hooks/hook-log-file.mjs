/* The log file itself, apart from the verb that reads it back: a gate writes one line per decision and the release step reads the notes, and neither should load the CLI to do it (docs/cli/the-refusal-log.md).
   The append-only JSONL store every one of this tool's logs keeps — the append, the parse and the read — is here because `resolve/` is at the folder-width limit. */
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { configDir } from "../resolve/config.mjs";

export const hookLogPath = () => join(configDir("forge"), "hook-log.jsonl");

/** One line appended to a JSONL store, the file created at `0o600` while it is still empty because `appendFileSync` alone would leave it `0644`; it raises rather than answering, so each store keeps its own catch, its own return and its own sentence about the loss, and `dir` is the directory the caller means to make rather than always the file's own. */
export const appendJsonl = (path, record, dir = dirname(path)) => {
  mkdirSync(dir, { recursive: true });
  if (!existsSync(path)) closeSync(openSync(path, "a", 0o600));
  appendFileSync(path, `${JSON.stringify(record)}\n`);
};

export const logHook = (record) => {
  try {
    appendJsonl(hookLogPath(), record, configDir("forge"));
    return true;
  } catch {
    return false;
  }
};

/** A JSONL text as the objects it holds; a log written by appends is torn at the line it stopped on, so a line that will not parse is dropped. */
export const jsonLines = (text) =>
  String(text ?? "")
    .split("\n")
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

/** A JSONL store read back, or an empty list where there is no file yet: the read side of `appendJsonl`, in one place because an unwritten store is the ordinary case for every one of them. */
export const jsonlAt = (path) => {
  try {
    return jsonLines(readFileSync(path, "utf8"));
  } catch {
    return [];
  }
};

/** The store's bytes, or none where there is no file yet: a question about one row is answered off the text, and decoding a 43 MB log to UTF-16 costs ten times reading it (ISS-1044). */
export const jsonlBytes = (path) => {
  try {
    return readFileSync(path);
  } catch {
    return Buffer.alloc(0);
  }
};

/** A key and its value as `JSON.stringify` writes the pair. Nothing inside a row's string values can spell one, every quote there being escaped, so a mark selects rows by a field rather than by a word that could be anywhere. */
export const jsonlMark = (key, value) => `"${key}":${JSON.stringify(value)}`;

const NEWLINE = 0x0a;

/** The store's rows carrying any of these marks and all of those, newest first, each parsed as it is reached: a caller that stops at its answer pays the distance back to it rather than the whole store. A row an append left half-written is what it is to `jsonLines` — a line that will not parse, and no row. */
export function* jsonlBack(bytes, any, all = []) {
  const marks = any.map((one) => ({ mark: Buffer.from(one), at: bytes.length }));
  const every = all.map((one) => Buffer.from(one));
  let end = bytes.length;
  while (end > 0) {
    let found = -1;
    for (const held of marks) {
      if (held.at >= end) held.at = end < held.mark.length ? -1 : bytes.lastIndexOf(held.mark, end - held.mark.length);
      found = Math.max(found, held.at);
    }
    if (found < 0) return;
    const start = bytes.lastIndexOf(NEWLINE, found) + 1;
    const stop = bytes.indexOf(NEWLINE, found);
    const line = bytes.subarray(start, stop < 0 ? bytes.length : stop);
    if (every.every((mark) => line.includes(mark))) {
      let row = null;
      try {
        row = JSON.parse(line.toString("utf8"));
      } catch {
        row = null;
      }
      if (row) yield row;
    }
    end = start;
  }
}

export const hookEntries = () => jsonlAt(hookLogPath());
