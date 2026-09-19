/* Which of `forge doctor`'s rows reach the terminal. It filters rather than reorders, so nothing a
   caller names can move a check the release ask overlaps (ISS-1460). docs/cli/the-subjects.md. */
import { IN_BARE, heldSaid } from "./subjects.mjs";

export const OK = "  ok  ";
export const BAD = " miss ";
export const NOTE = " note ";

export const LEVELS = { note: NOTE, miss: BAD };

let missed = 0;
let asked = null;
let here = null;
let reached = [];

export const reading = (subject) => {
  asked = subject ?? null;
  here = null;
  reached = [];
  missed = 0;
};

export const under = (subject) => {
  here = subject;
  if (!reached.includes(subject)) reached.push(subject);
};

export const shown = (...subjects) =>
  subjects.some((subject) => (asked ? asked === subject : IN_BARE.has(subject)));

export const missedHere = () => missed;

export const asking = () => asked;

/* A bare reading keeps every fault, whatever subject it is of, so the first command a session runs
   still diagnoses the whole box and exits as it did; a subject asked for answers for itself alone. */
export const line = (mark, label, detail) => {
  if (!shown(here) && (asked || mark === OK)) return;
  if (mark === BAD) missed += 1;
  console.log(`[${mark}] ${label.padEnd(22)} ${detail}`);
};

export const report = (rows) => {
  for (const row of rows) line(LEVELS[row.level] ?? OK, row.label, row.detail);
};

/* A miss that stops the reading rather than reporting on part of it: the reason the rest could not be read is the answer to whatever subject was asked for, so it prints there and counts. */
export const stopping = (label, detail) => {
  under(asked ?? here);
  line(BAD, label, detail);
};

/* A block a reader reads rather than scans, and never the finding itself. */
export const block = (text) => {
  if (shown(here)) console.log(text);
};

export const closing = () => {
  if (asked) return ["", "The rest of the reading, subject by subject: `forge doctor -h`"];
  return heldSaid(reached.filter((subject) => !IN_BARE.has(subject)));
};
