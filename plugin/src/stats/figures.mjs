import { median } from "./median.mjs";

export const medianOrZero = (values) => median(values) ?? 0;

export const minutes = (seconds) => Math.round((seconds / 60) * 10) / 10;
export const share = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");
export const add = (map, key, by = 1) => map.set(key, (map.get(key) ?? 0) + by);
export const stamp = (at) => new Date(at).toISOString().slice(0, 16).replace("T", " ");
