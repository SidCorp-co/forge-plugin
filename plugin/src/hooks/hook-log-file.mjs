/* The log file itself, apart from the verb that reads it back: a gate writes one line per decision and
   the release step reads the notes, and neither should load the CLI to do it (docs/cli/the-refusal-log.md).
   The append-only JSONL store all three of this tool's logs keep is here because `resolve/` is at the folder-width limit. */
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

export const hookEntries = () => {
  try {
    return jsonLines(readFileSync(hookLogPath(), "utf8"));
  } catch {
    return [];
  }
};
