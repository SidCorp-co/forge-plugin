/* Where one project's ask state lives, and the log of what the gate did with each question: beside
   that project's config, so nothing one project decided is read for another. The owner reads the
   log to review a decision and reverse it: plugin/hooks/how/ask-decide.md. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { appendJsonl } from "../hooks/log/hook-log-file.mjs";
import { projectFilePath } from "../resolve/settings.mjs";

export const DECIDED = "decided";
export const OWNER = "owner";

/** The project's ask directory, or null where this process stands in no checkout. */
export const asksRoom = () => {
  const entry = projectFilePath();
  return entry ? join(dirname(entry), "asks") : null;
};

export const decidedPath = (room = asksRoom()) => (room ? join(room, "decided.jsonl") : null);

/** One outcome appended; false where there is no project or the write failed, which the gate says. */
export const logOutcome = (entry, room = asksRoom()) => {
  const path = decidedPath(room);
  if (!path) return false;
  try {
    appendJsonl(path, { at: new Date().toISOString(), ...entry });
    return true;
  } catch {
    return false;
  }
};

/* A log that cannot be read whole cannot say which answers were the gate's, so it is reported rather
   than read as empty: an answer of the gate's taken for the owner's would decide the next question. */
const outcomes = (room) => {
  const path = decidedPath(room);
  let text;
  try {
    text = path ? readFileSync(path, "utf8") : "";
  } catch (error) {
    if (error.code === "ENOENT") return { rows: [] };
    return { unreadable: `${path} could not be read: ${error.message}` };
  }
  const rows = [];
  for (const [at, line] of text.split("\n").entries()) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      return { unreadable: `${path} line ${at + 1} is not a record` };
    }
  }
  return { rows };
};

/** The calls the gate answered itself, which none may become precedent, or why they cannot be known. */
export const decidedIds = (room = asksRoom()) => {
  const held = outcomes(room);
  return held.unreadable ? held
    : { ids: new Set(held.rows.filter((one) => one.outcome === DECIDED && one.toolUseId).map((one) => one.toolUseId)) };
};
