/* A run's consults are logged in the home its scratch holds (ISS-2651), and `finish` removes that
   scratch. The machine's log is the corpus `forge codex stats`, the evaluator's windows and the daily
   report read, so a row that never reaches it is a consult those figures never counted: every run's,
   once the brief printed the run home for all of them (ISS-2659). */
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { configDir } from "../../../plugin/src/resolve/config.mjs";
import { BORROW_VAR } from "../../../plugin/src/resolve/machine/borrowed.mjs";
import { homeIn } from "../../../plugin/src/resolve/session/run-home.mjs";

const LOG = "codex-log.jsonl";
const NEWLINE = 0x0a;

/* The home `start` and the brief print, then the scratch itself, which is where a run told to point
   its home at the scratch (ISS-189) logged. */
const logsIn = (scratch) => [join(homeIn(scratch), "forge", LOG), join(scratch, "forge", LOG)];

/* Beside the config the borrow names, which is the machine's own whatever this call's home is: a run
   finishing its own tree stands in its run home, and that home's log is the one being removed. */
const machineLog = () => {
  const borrowed = process.env[BORROW_VAR];
  return borrowed ? join(dirname(borrowed), LOG) : join(configDir("forge"), LOG);
};

/* Where a path lands once every link on the part of it that exists is followed: a home reached
   through a link into the scratch is the scratch, and the log there is the very copy being removed. */
const landed = (path) => {
  const at = resolve(path);
  if (existsSync(at)) return realpathSync(at);
  return dirname(at) === at ? at : join(landed(dirname(at)), basename(at));
};

const inside = (path, dir) => {
  const rel = relative(landed(dir), landed(path));
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};

const refusedInside = (log, scratch) => {
  if (!inside(log, scratch)) return;
  throw new Error(`the machine's consult log resolves to ${log}, inside the scratch itself, so no copy `
    + `outlives it: run finish with ${BORROW_VAR} naming this machine's config.json, or with `
    + `XDG_CONFIG_HOME at this machine's own home`);
};

/* A row is a line that parses as a JSON object: a log written by appends is torn at the line it
   stopped on, and a torn line carried would tear the machine's log too. */
const rowsOf = (path) => {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter((line) => {
    try {
      const row = JSON.parse(line);
      return Boolean(row) && typeof row === "object" && !Array.isArray(row);
    } catch {
      return false;
    }
  });
};

/* By the whole line and never the consult id: ids are six hex characters and the machine log already
   repeats some, and a verdict row carries none. Only lines of a length some row has are compared, so
   a hundred-megabyte log costs one read and almost no comparisons. */
const absentFrom = (log, rows) => {
  const wanted = new Map();
  for (const line of rows) {
    const bytes = Buffer.from(line);
    if (!wanted.has(bytes.length)) wanted.set(bytes.length, []);
    wanted.get(bytes.length).push(bytes);
  }
  const held = new Set();
  const text = existsSync(log) ? readFileSync(log) : Buffer.alloc(0);
  for (let start = 0; start < text.length;) {
    const stop = text.indexOf(NEWLINE, start);
    const end = stop < 0 ? text.length : stop;
    for (const one of wanted.get(end - start) ?? []) {
      if (text.subarray(start, end).equals(one)) held.add(one.toString("utf8"));
    }
    start = end + 1;
  }
  return [...new Set(rows)].filter((line) => !held.has(line));
};

/* A newline first where the log's last byte is not one, so a row an append left torn is not joined to
   the first row carried after it. */
const endsTorn = (log) => {
  const size = existsSync(log) ? statSync(log).size : 0;
  if (!size) return false;
  const fd = openSync(log, "r");
  try {
    const last = Buffer.alloc(1);
    readSync(fd, last, 0, 1, size - 1);
    return last[0] !== NEWLINE;
  } finally {
    closeSync(fd);
  }
};

const appended = (log, lines) => {
  mkdirSync(dirname(log), { recursive: true });
  if (!existsSync(log)) closeSync(openSync(log, "a", 0o600));
  appendFileSync(log, `${endsTorn(log) ? "\n" : ""}${lines.join("\n")}\n`);
};

const isConsult = (line) => JSON.parse(line).kind === "consult";

/** Every row the scratch's consult logs hold that the machine's log lacks, appended to it once: what
 *  was carried, into which log, and from where. Throws with the reason where the machine's log sits
 *  in the scratch itself or cannot be written, the scratch being the only copy of those rows. */
export const carried = (scratch) => {
  const log = machineLog();
  const from = logsIn(scratch).filter(existsSync);
  const rows = from.flatMap(rowsOf);
  if (!rows.length) return { log, from, rows: 0, consults: 0 };
  refusedInside(log, scratch);
  const lines = absentFrom(log, rows);
  if (lines.length) appended(log, lines);
  // Again once the file exists: a link left dangling into the scratch lands only when the append made its target.
  refusedInside(log, scratch);
  return { log, from, rows: lines.length, consults: lines.filter(isConsult).length };
};
