import { availableParallelism, loadavg } from "node:os";

const CAP = 8;

export const patience = (ms) =>
  Math.round(ms * Math.min(CAP, Math.max(1, loadavg()[0] / availableParallelism())));

const TICK = 10;

/* A count a stub server fills from its own request handler is on this process's loop, so a case reading it the instant a client gave up reads whether that loop was scheduled, not what the client sent. */
export const reached = async (reading, want) => {
  const cap = Date.now() + patience(10_000);
  while (reading() !== want && Date.now() < cap) await new Promise((tick) => setTimeout(tick, TICK));
  await new Promise((tick) => setTimeout(tick, patience(TICK * 20)));
  return reading();
};
