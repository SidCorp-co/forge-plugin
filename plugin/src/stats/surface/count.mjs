/* A Claude token is counted by Anthropic's own endpoint and by nothing else: a third-party tokenizer
   undercounts this surface by construction, and bytes cannot express a figure that is billed per
   model. So every token this subject prints is an `input_tokens` answered here, and every way one
   could not be taken is a reason by name. docs/cli/stats-the-surface.md. */
import { clockFor, deadlineOf, parsedOr, ranOut } from "../../wire/request.mjs";
import { machineValue } from "../../resolve/machine/stores.mjs";

const STORE = "anthropic";
const ORIGIN = "https://api.anthropic.com";
const ROUTE = "/v1/messages/count_tokens";
const VERSION = "2023-06-01";
const ATTEMPTS = 4;
const RATE_LIMITED = 429;
const MAX_WAIT_SECONDS = 60;
const FIRST_WAIT_SECONDS = 2;

const sleep = (seconds) => new Promise((done) => setTimeout(done, seconds * 1000));

/* The server's stated wait where it gave one, doubling from the first otherwise, capped either way. */
const waitFor = (headers, attempt) => {
  const said = Number(headers.get("retry-after"));
  const seconds = Number.isFinite(said) && said > 0 ? said : FIRST_WAIT_SECONDS * 2 ** (attempt - 1);
  return Math.min(seconds, MAX_WAIT_SECONDS);
};

/** The key this machine saved for the count, and the origin it is asked at: the store's own, read at the call. */
export const countSettings = () => ({
  key: machineValue(STORE, "key").value,
  origin: (machineValue(STORE, "url").value ?? ORIGIN).replace(/\/+$/u, ""),
});

/** What would measure the figures, or null where the counter can be built: checked before anything is sent. */
export const unmeasuredWhy = ({ model, key }) => {
  if (!model) {
    return "no --model was named, and which model's tokenizer counts is the caller's decision: "
      + "forge stats surface --model <id>";
  }
  if (!key) {
    return "this machine holds no key for Anthropic's count endpoint, and a Claude token is counted "
      + "there and nowhere else: forge doctor --anthropic-key <key>, then run this again";
  }
  return null;
};

const failureOf = (status, text) => {
  const said = parsedOr(text)?.error?.message ?? String(text).slice(0, 200);
  return `the count endpoint answered ${status}: ${said}`;
};

/** A counter for one model at one origin: `(text) => ({ tokens })` or `({ unmeasured: reason })`. */
export const counterFor = ({ model, key, origin, fetchImpl = fetch, waits = sleep }) => async (text) => {
  const deadline = deadlineOf();
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    let answer;
    let body;
    /* The body read inside the same guard: a stalled or dropped body is as much a count not taken
       as a refused connection, and escaping here would take every other text's count with it. */
    try {
      answer = await fetchImpl(`${origin}${ROUTE}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": VERSION },
        body: JSON.stringify({ model, messages: [{ role: "user", content: text }] }),
        signal: clockFor(deadline),
      });
      body = await answer.text();
    } catch (dropped) {
      return { unmeasured: `the count endpoint gave no answer: ${ranOut(dropped, deadline)}` };
    }
    if (answer.status === RATE_LIMITED && attempt < ATTEMPTS) {
      await waits(waitFor(answer.headers, attempt));
      continue;
    }
    if (!answer.ok) return { unmeasured: failureOf(answer.status, body) };
    const tokens = parsedOr(body)?.input_tokens;
    if (!Number.isInteger(tokens)) return { unmeasured: "the count endpoint answered with no input_tokens" };
    return { tokens };
  }
  return { unmeasured: `the count endpoint was still rate-limited after ${ATTEMPTS} attempts` };
};
