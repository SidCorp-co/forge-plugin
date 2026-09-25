import { median } from "./median.mjs";

export const medianOrZero = (values) => median(values) ?? 0;

export const minutes = (seconds) => Math.round((seconds / 60) * 10) / 10;
/* A token figure crosses four orders of magnitude inside one line — a window's sum and a per-request
   mean — so the unit travels with the number rather than the reader counting digits. A figure no
   population supports is a dash, which is the absence `medianOrZero` deliberately does not have. */
const SCALES = [[1e9, "B"], [1e6, "M"], [1e3, "k"]];
export const scaled = (value) => {
  if (value === null || value === undefined) return "—";
  const found = SCALES.find(([at]) => Math.abs(value) >= at);
  return found ? `${Math.round((value / found[0]) * 10) / 10}${found[1]}` : String(Math.round(value));
};
export const share = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");
/** A share to one decimal, as the angle and the mix blocks print their floors. */
export const percent = (value) => `${(value * 100).toFixed(1)}%`;
/** Words folded greedily to a width, each line after the first opening with `indent`, which counts
 *  towards the width as the words do. */
export const foldedWords = (words, width, indent = "") => words.reduce((lines, word) => {
  const last = lines.at(-1);
  if (last && `${last} ${word}`.length <= width) lines[lines.length - 1] = `${last} ${word}`;
  else lines.push(`${indent}${word}`);
  return lines;
}, []);
/** A flag as a refusal repeats it back: with its value, or bare where it was given none. */
export const flagSaid = (flag, value) => (value === null ? flag : `${flag} ${value}`);
export const add = (map, key, by = 1) => map.set(key, (map.get(key) ?? 0) + by);
/* UTC to the minute with its zone said, because a bound printed without one is read in the reader's
   own zone, and a `--since` typed off it then names a different span. */
export const stamp = (at) => `${new Date(at).toISOString().slice(0, 16).replace("T", " ")}Z`;

/* Waits overlap: the host issues several calls in one turn and they run at once, so their durations
   summed exceed the wall clock they shared and would report more waiting than the run took. The
   union is what the wall time is split by; a class's own row stays a sum of its calls, which is
   tool-seconds and says so. */
export const unionSeconds = (spans) => {
  const sorted = [...spans].sort((left, right) => left.at - right.at);
  let total = 0;
  let openedAt = null;
  let closesAt = null;
  for (const span of sorted) {
    if (closesAt === null || span.at > closesAt) {
      total += closesAt === null ? 0 : closesAt - openedAt;
      openedAt = span.at;
      closesAt = span.endedAt;
    } else closesAt = Math.max(closesAt, span.endedAt);
  }
  return (closesAt === null ? total : total + closesAt - openedAt) / 1000;
};
