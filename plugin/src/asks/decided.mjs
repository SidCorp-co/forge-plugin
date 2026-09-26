/* Where one project's ask state lives, and the log of what the gate did with each question: beside
   that project's config, so nothing one project decided is read for another. The owner reads the
   log to review a decision and reverse it: plugin/hooks/how/ask-decide.md. */
import { dirname, join } from "node:path";

import { appendJsonl, jsonlAt } from "../hooks/log/hook-log-file.mjs";
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

const outcomes = (room = asksRoom()) => {
  const path = decidedPath(room);
  return path ? jsonlAt(path) : [];
};

/** The calls the gate answered itself: none of them is the owner's answer, so none may become precedent. */
export const decidedIds = (room = asksRoom()) =>
  new Set(outcomes(room).filter((one) => one.outcome === DECIDED && one.toolUseId).map((one) => one.toolUseId));
