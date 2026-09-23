/* A project's dispatcher sessions, read back for the waves they wrote. A dispatcher is the session
   itself and not one of the runs it sent, so the file read is the top-level one and never a
   subagent's. What it gives is which headlines its wave and fold writes named, and every call it
   made, for a wave's span to be cut from: docs/cli/stats-the-waves.md. */
import { readdirSync } from "node:fs";
import { basename, join } from "node:path";

import { durableBase, readTranscript, rootFor } from "../corpus/corpus.mjs";
import { callsIn } from "../corpus/transcripts.mjs";
import { refusalIn } from "../runs.mjs";

const SESSION_FILE = /\.jsonl$/u;
const WROTE = /\bforge record (?<kind>wave|fold) (?<ref>ISS-\d+)\b/gu;

/** A call that ran and was not refused: the only call a count off a transcript may count as done. */
export const landed = (call) => call.answered && !call.error && !refusalIn(call);

/** The headline refs a call's own shell wrote a wave or a fold record against. Off the shell and
 *  not the command, so a ref quoted in text the call only printed writes nothing. */
const writesIn = (call) => (call.name === "Bash"
  ? [...call.shell.matchAll(WROTE)].map((one) => ({ kind: one.groups.kind, ref: one.groups.ref }))
  : []);

const sessionFiles = (directory) => {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => !entry.isDirectory() && SESSION_FILE.test(entry.name))
      .map((entry) => join(directory, entry.name));
  } catch {
    return [];
  }
};

/** Every session of the project the checkout names that wrote a wave or fold record which landed,
 *  with its calls and those writes. `read` counts every session file opened, so a corpus holding
 *  no wave says how many sessions it looked through. */
export const dispatchersOf = (directory) => {
  const where = join(durableBase(), basename(rootFor(directory)));
  const sessions = [];
  let read = 0;
  let unreadable = 0;
  for (const path of sessionFiles(where)) {
    const text = readTranscript(path);
    if (text === null) {
      unreadable += 1;
      continue;
    }
    read += 1;
    const { calls } = callsIn(text);
    const writes = calls.filter(landed).flatMap((call) => writesIn(call).map((one) => ({ ...one, at: call.at })));
    if (writes.length) sessions.push({ session: basename(path).replace(SESSION_FILE, ""), path, calls, writes });
  }
  return { where, read, unreadable, sessions };
};

/** The headline refs the sessions wrote against, first-seen order. */
export const headlinesOf = (sessions) => [...new Set(sessions.flatMap((one) => one.writes.map((write) => write.ref)))];

/** The folds the sessions wrote that landed, the count a fold's trigger reads. */
export const foldsIn = (sessions) => sessions.reduce((many, one) =>
  many + one.writes.filter((write) => write.kind === "fold").length, 0);
