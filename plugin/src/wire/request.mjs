/* The clock one outbound attempt runs under and the REST origin beside an MCP endpoint, shared once `forge chatgpt` became a second caller: a copied deadline is a second place `waitSeconds` has to be honoured. The ladder above one attempt stays `tracker/rest.mjs`'s and the route table stays `tracker/routes.mjs`'s. */
import { userConfig } from "../resolve/config.mjs";

const FALLBACK_WAIT_SECONDS = 60;
/* Signed, not unsigned: `AbortSignal.timeout` validates against the unsigned range while the timer under it fires at 1ms past the signed one, so past that a deadline of nothing wears the number asked for (consult 8b2c3d, F1). */
const MAX_DEADLINE_MILLIS = 2 ** 31 - 1;
const MCP_TAIL = /\/mcp\/?$/u;

export const secondsGiven = (given) =>
  (typeof given === "number" && Number.isFinite(given) && given >= 0 ? given : null);

const millisOf = (seconds) => Math.min(Math.round(seconds * 1000), MAX_DEADLINE_MILLIS);

export const waitSeconds = (config = userConfig()) =>
  secondsGiven(config.waitSeconds) ?? FALLBACK_WAIT_SECONDS;

export const deadlineSeconds = (config) => millisOf(waitSeconds(config)) / 1000;

export const deadlineOf = (waits) => {
  const own = secondsGiven(waits);
  const millis = millisOf(own ?? waitSeconds());
  return {
    millis,
    value: millis / 1000,
    from: own === null ? "waitSeconds in config.json" : "the caller's own deadline",
  };
};

export const ranOut = (dropped, deadline) => (dropped.name === "TimeoutError"
  ? `ran out after ${deadline.value}s (${deadline.from})`
  : dropped.message);

/* Covers the body read as well as the headers, since a 200 whose body stalls is no success, and is built per attempt because a signal already aborted refuses the next before it is sent. */
export const clockFor = (deadline, signal = null) => {
  const held = AbortSignal.timeout(deadline.millis);
  return signal ? AbortSignal.any([signal, held]) : held;
};

/* Takes the URL rather than reading one: two endpoints are configured now, so a function reading its own would derive one caller's origin from the other's host (ISS-791, consult 26a108 F2). */
export const apiBaseOf = (url) => {
  if (typeof url !== "string" || !MCP_TAIL.test(url)) {
    return { problem: `no /mcp at the end of ${url ?? "(unset)"}, so the REST origin beside it cannot be read` };
  }
  return { base: `${url.replace(MCP_TAIL, "")}/api` };
};
