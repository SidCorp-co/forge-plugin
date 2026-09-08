/* The three signals printed beside the score and folded into none of it: docs/cli/next.md. */
import { callsIn, readTranscript } from "../stats/transcripts.mjs";
import { keysIn } from "../tracker/issues.mjs";
import { meets, pathsNamed } from "./eligible.mjs";
import { bandOf } from "./score.mjs";
import { freezesSession } from "../tools/plugin-copy.mjs";
import { runsUnder } from "../stats/runs.mjs";
import { median } from "../stats/median.mjs";

const claimedIn = (text) => {
  const claim = callsIn(text).calls.find((call) => call.class === "forge claim");
  return claim ? keysIn(claim.command)[0] ?? null : null;
};

/* The corpus and the is-this-a-flow-run predicate are `stats runs`'s; only the key is read here. */
export const measuredRuns = (root, since = null) =>
  runsUnder(root, since).runs
    .map((run) => ({ key: claimedIn(readTranscript(run.path) ?? ""), minutes: run.seconds / 60 }))
    .filter((one) => one.key);

/** A band no past run landed in falls back to every run and says so: a dash reads as no corpus. */
export const costFor = (band, runs, bands) => {
  const own = runs.filter((one) => bands.get(one.key) === band);
  const pool = own.length ? own : runs;
  const minutes = median(pool.map((one) => one.minutes));
  if (minutes === null) return { minutes: null, over: 0, band: null };
  return { minutes: Math.round(minutes), over: pool.length, band: own.length ? band : null };
};

/* This and `lastLanded` below read the browse projection and the backlog the verb already holds, and never a checkout it may not be standing in: a body per past run is the fan-out this verb exists without. */
export const bandsOf = (rows) =>
  new Map(rows.map((row) => [row.issueId, bandOf(row)]));

export const owesRestart = (body) => pathsNamed(body).some(freezesSession);

export const lastLanded = (rows) =>
  rows
    .filter((row) => row?.mergedAt)
    .sort((left, right) => Date.parse(right.mergedAt) - Date.parse(left.mergedAt))[0] ?? null;

export const isWarm = (body, warmPaths) =>
  pathsNamed(body).some((path) => warmPaths.some((other) => meets(path, other)));
