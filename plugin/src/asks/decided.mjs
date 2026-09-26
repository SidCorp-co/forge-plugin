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

const nonEmpty = (value) => typeof value === "string" && value.trim() !== "";

/* The one shape an outcome has, held at the write and at the read alike: a pass names its reason and
   its questions, a decision names its call and, per question, the option, the precedent and the undo. */
const wellFormed = (row) => {
  if (!row || typeof row !== "object" || !Array.isArray(row.questions) || !row.questions.length) return false;
  if (row.outcome === OWNER) return nonEmpty(row.reason) && row.questions.every(nonEmpty);
  return row.outcome === DECIDED && nonEmpty(row.toolUseId) && row.questions.every((one) => one && nonEmpty(one.question)
    && nonEmpty(one.option) && nonEmpty(one.reversal) && one.precedent && nonEmpty(one.precedent.id));
};

/** One outcome appended; false where there is no project, the row is not an outcome, or the write
 *  failed — a decision the owner could not review later is one the gate does not take. */
export const logOutcome = (entry, room = asksRoom()) => {
  const path = decidedPath(room);
  if (!path || !wellFormed(entry)) return false;
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
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      row = null;
    }
    if (!wellFormed(row)) return { unreadable: `${path} line ${at + 1} is not a record this gate wrote` };
    rows.push(row);
  }
  return { rows };
};

/** The calls the gate answered itself, which none may become precedent, or why they cannot be known. */
export const decidedIds = (room = asksRoom()) => {
  const held = outcomes(room);
  return held.unreadable ? held
    : { ids: new Set(held.rows.filter((one) => one.outcome === DECIDED).map((one) => one.toolUseId)) };
};
