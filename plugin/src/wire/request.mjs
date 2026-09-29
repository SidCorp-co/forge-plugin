/* The clock one outbound attempt runs under and the REST origin beside an MCP endpoint, shared once `forge chatgpt` became a second caller: a copied deadline is a second place `waitSeconds` has to be honoured. The ladder above one attempt stays `tracker/rest.mjs`'s and the route table stays `tracker/routes.mjs`'s. */
import { userConfig } from "../resolve/config.mjs";

const FALLBACK_WAIT_SECONDS = 60;
/* Signed, not unsigned: `AbortSignal.timeout` validates against the unsigned range while the timer under it fires at 1ms past the signed one, so past that a deadline of nothing wears the number asked for (consult 8b2c3d, F1). */
const MAX_DEADLINE_MILLIS = 2 ** 31 - 1;
const MCP_TAIL = /\/mcp\/?$/u;

/* A body this side did not write and cannot make a caller's problem: a document that will not parse answers `null` here, and what to do about `null` is the caller's. Three transports had written this three times and two of them answered differently, so a caller moving between them got a different falsy value for the same failure. */
export const parsedOr = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const secondsGiven = (given) =>
  (typeof given === "number" && Number.isFinite(given) && given >= 0 ? given : null);

const millisOf = (seconds) => Math.min(Math.round(seconds * 1000), MAX_DEADLINE_MILLIS);

export const waitSeconds = (config = userConfig()) =>
  secondsGiven(config.waitSeconds) ?? FALLBACK_WAIT_SECONDS;

export const deadlineSeconds = (config) => millisOf(waitSeconds(config)) / 1000;

/** The longest wait a caller is handed rather than refused: `millisOf` clamps at it, and a call that asked past it is told what it got rather than judged for asking. */
export const MAX_WAIT_SECONDS = MAX_DEADLINE_MILLIS / 1000;

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

/* A process its own caller kills at an instant — a hook, under what hooks.json registers — names that clock once, and every attempt and every wait between attempts stays inside it: a budget the retries can run past is not one (ISS-215). One process answers one event, so the clock is the process's; a process that names none keeps the ladder it had. */
let ceiling = null;

export const boundedBy = (left, from) => {
  ceiling = left ? { left, from } : null;
};

/** What the process's clock has left in milliseconds, or Infinity where nothing named one. */
export const ceilingLeft = () => (ceiling ? Math.max(0, Math.floor(ceiling.left())) : Infinity);

/** Which clock `ceilingLeft` reads, for a refusal that has to say what ran out. */
export const ceilingFrom = () => ceiling?.from ?? null;

/** One attempt's deadline, cut to what the process's clock has left where that is the shorter. */
export const within = (deadline) => {
  const millis = ceilingLeft();
  return millis >= deadline.millis ? deadline : { millis, value: millis / 1000, from: ceiling.from };
};

/* Covers the body read as well as the headers, since a 200 whose body stalls is no success, and is built per attempt because a signal already aborted refuses the next before it is sent. */
export const clockFor = (deadline, signal = null) => {
  const held = AbortSignal.timeout(deadline.millis);
  return signal ? AbortSignal.any([signal, held]) : held;
};

const UTF8 = new TextDecoder();

/* Read from a reader this side holds, and cancelled from a listener this side adds, rather than left to fetch: undici follows the signal it was handed through a weak reference to a controller of its own, and on a request refusing redirects nothing else holds that controller once the headers are in, so a collection there leaves the read with no deadline at all and it runs to undici's own five minutes as `terminated` (ISS-2767). The cancel is also what closes the socket. A response with no stream has nothing that can stall, and is read as it is. */
export const bytesWithin = (response, signal) => {
  if (!response.body) return response.arrayBuffer().then((held) => Buffer.from(held));
  const reader = response.body.getReader();
  return new Promise((resolve, reject) => {
    const chunks = [];
    const stop = () => {
      reader.cancel(signal.reason).catch(() => {});
      reject(signal.reason);
    };
    const settled = (then) => (value) => {
      signal.removeEventListener("abort", stop);
      then(value);
    };
    const next = () => reader.read().then(({ done, value }) => {
      if (done) return settled(resolve)(Buffer.concat(chunks));
      chunks.push(value);
      return next();
    }, settled(reject));
    if (signal.aborted) return stop();
    signal.addEventListener("abort", stop, { once: true });
    return next();
  });
};

/** The body as `Response.text()` decodes it — UTF-8, a leading BOM dropped — under the deadline `bytesWithin` holds. A response with no stream is handed to its own `text()` rather than `bytesWithin`'s `arrayBuffer()` branch: a caller's response duck-types one or the other and not always both, and the two agree only where a real `Response` backs the call. */
export const textWithin = async (response, signal) =>
  (response.body ? UTF8.decode(await bytesWithin(response, signal)) : response.text());

/* Takes the URL rather than reading one: two endpoints are configured now, so a function reading its own would derive one caller's origin from the other's host (ISS-791, consult 26a108 F2). */
export const apiBaseOf = (url) => {
  if (typeof url !== "string" || !MCP_TAIL.test(url)) {
    return { problem: `no /mcp at the end of ${url ?? "(unset)"}, so the REST origin beside it cannot be read` };
  }
  return { base: `${url.replace(MCP_TAIL, "")}/api` };
};
