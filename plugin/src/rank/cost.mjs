/* The three signals printed beside the score and folded into none of it: docs/cli/next.md. */
import { join } from "node:path";

import { callsIn, readTranscript, slugFor, transcriptBase } from "../stats/transcripts.mjs";
import { keysIn } from "../tracker/issues.mjs";
import { meets, pathsNamed } from "./eligible.mjs";
import { bandOf } from "./score.mjs";
import { runsUnder } from "../stats/runs.mjs";

export const RESTARTS = ["plugin/hooks", "plugin/skills"];

export const rootFor = (directory) => join(transcriptBase(), slugFor(directory.replace(/\/+$/u, "") || "/"));

const claimedIn = (text) => {
  const claim = callsIn(text).calls.find((call) => call.class === "forge claim");
  return claim ? keysIn(claim.command)[0] ?? null : null;
};

/* The corpus and the is-this-a-flow-run predicate are `stats runs`'s; only the key is read here. */
export const measuredRuns = (root, since = null) =>
  runsUnder(root, since).runs
    .map((run) => ({ key: claimedIn(readTranscript(run.path) ?? ""), minutes: run.seconds / 60 }))
    .filter((one) => one.key);

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (!sorted.length) return null;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** A band no past run landed in falls back to every run and says so: a dash reads as no corpus. */
export const costFor = (band, runs, bands) => {
  const own = runs.filter((one) => bands.get(one.key) === band);
  const pool = own.length ? own : runs;
  const minutes = median(pool.map((one) => one.minutes));
  if (minutes === null) return { minutes: null, over: 0, band: null };
  return { minutes: Math.round(minutes), over: pool.length, band: own.length ? band : null };
};

/* Off the browse projection alone: a body per past run is the fan-out this verb exists without. */
export const bandsOf = (rows) =>
  new Map(rows.map((row) => [row.issueId, bandOf(row).band]));

export const owesRestart = (body) =>
  pathsNamed(body).some((path) => RESTARTS.some((tree) => meets(path, tree)));

/* Off the backlog rather than off a checkout this verb may not be standing in. */
export const lastLanded = (rows) =>
  rows
    .filter((row) => row?.mergedAt)
    .sort((left, right) => Date.parse(right.mergedAt) - Date.parse(left.mergedAt))[0] ?? null;

export const isWarm = (body, warmPaths) =>
  pathsNamed(body).some((path) => warmPaths.some((other) => meets(path, other)));
