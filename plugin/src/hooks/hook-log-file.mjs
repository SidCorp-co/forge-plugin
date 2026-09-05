/* The log file itself, apart from the verb that reads it back: a gate writes one line per decision
   and the release step reads the notes, and neither should load the CLI to do it. What goes in it
   and why: docs/cli/the-refusal-log.md. */
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { configDir } from "../resolve/config.mjs";

export const HOOK_LOG_PATH = join(configDir("forge"), "hook-log.jsonl");

export const logHook = (record) => {
  try {
    mkdirSync(configDir("forge"), { recursive: true });
    if (!existsSync(HOOK_LOG_PATH)) closeSync(openSync(HOOK_LOG_PATH, "a", 0o600));
    appendFileSync(HOOK_LOG_PATH, `${JSON.stringify(record)}\n`);
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
    return jsonLines(readFileSync(HOOK_LOG_PATH, "utf8"));
  } catch {
    return [];
  }
};
