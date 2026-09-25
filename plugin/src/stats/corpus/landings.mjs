/* The landing passes of a project, read off every transcript it holds and not off its issue-flow
   runs alone: where a project's runs stop at the ready checkpoint, the landing is typed by the
   session that dispatched them, which is no run. Why, and what the figure leaves out:
   docs/cli/stats-the-landing.md. */
import { statSync } from "node:fs";

import { classOf } from "./classes.mjs";
import { sessionsUnder, readTranscript } from "./corpus.mjs";
import { shellOf } from "./transcripts.mjs";
import { scopeOf } from "../marks/marks.mjs";
import { redBatchLine, redBatchesOver } from "../marks/red-batches.mjs";

/** The row every landing pass is filed under, whichever route a project lands by. */
const SHIP_CLASS = "ship";

/** A pass that took a landing up again at a step rather than from its start. */
export const RESUMED = /--from\s+\d/u;
const TOOL_USE = '"tool_use"';

/** Every landing pass among a run's calls, each at the moment it was typed. */
export const passesIn = (calls) => calls
  .filter((call) => call.class === SHIP_CLASS)
  .map((call) => ({ at: call.at, resumed: RESUMED.test(call.shell) }));

/* A session transcript is never folded into a run, so only the records that carry a tool use are
   parsed, and each Bash use is classed by the table a run's calls are classed by. */
const passesOfSession = (text, classes) => {
  const passes = [];
  for (const line of text.split("\n")) {
    if (!line.includes(TOOL_USE)) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    const at = Date.parse(record.timestamp);
    const content = record.message?.content;
    if (!at || !Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type !== "tool_use" || (block.name || "Bash") !== "Bash") continue;
      const shell = shellOf(typeof block.input?.command === "string" ? block.input.command : "");
      if (classOf("Bash", shell, classes) === SHIP_CLASS) passes.push({ at, resumed: RESUMED.test(shell), inRun: false });
    }
  }
  return passes;
};

/* A session last written before the window holds no pass inside it, so it is not read: these are the
   host's own files and not the links an index makes, so the time is the last record's. */
const writtenSince = (path, since) => {
  try {
    return statSync(path).mtimeMs >= since;
  } catch {
    return false;
  }
};

/** What `runsUnder` found in the transcripts it read, run or not, joined to what the sessions it
 *  never reads hold, cut to `since`. */
export const landingsUnder = (root, classes, found, since = null) => {
  const sessions = sessionsUnder(root)
    .filter(({ path }) => since === null || writtenSince(path, since))
    .flatMap(({ path }) => {
      const text = readTranscript(path);
      return text === null ? [] : passesOfSession(text, classes);
    });
  return [...found, ...sessions]
    .filter((one) => since === null || one.at >= since)
    .sort((left, right) => left.at - right.at);
};

/** The one landing figure `stats runs` prints and the daily page shows, over whichever passes the
 *  caller cut to its window. `outsideRuns` is the share no issue-flow run holds. */
export const landingsOver = (passes) => ({
  passes: passes.length,
  resumed: passes.filter((one) => one.resumed).length,
  outsideRuns: passes.filter((one) => !one.inRun).length,
});

/** What `stats runs` holds of the landings: the passes, off every transcript, and the red sets, off
 *  the records the landing wrote under this checkout's project — each over the same window. */
export const landingsHeld = ({ root, classes, passes, from, directory }) => ({
  landings: landingsOver(landingsUnder(root, classes, passes, from)),
  redBatches: redBatchesOver(scopeOf(directory), from),
});

const landingLine = (held) => `landings        ${held.passes} pass(es) in every transcript of the project, `
  + `${held.outsideRuns} of them in a session no issue-flow run holds, ${held.resumed} resumed with --from`;

export const landingLines = (held) => [landingLine(held.landings), ...(held.redBatches ? [redBatchLine(held.redBatches)] : [])];
