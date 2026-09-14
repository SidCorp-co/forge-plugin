import { availableParallelism, loadavg } from "node:os";

const CAP = 8;

export const patience = (ms) =>
  Math.round(ms * Math.min(CAP, Math.max(1, loadavg()[0] / availableParallelism())));
