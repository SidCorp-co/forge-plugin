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
export const add = (map, key, by = 1) => map.set(key, (map.get(key) ?? 0) + by);
/* UTC to the minute with its zone said, because a bound printed without one is read in the reader's
   own zone, and a `--since` typed off it then names a different span. */
export const stamp = (at) => `${new Date(at).toISOString().slice(0, 16).replace("T", " ")}Z`;
