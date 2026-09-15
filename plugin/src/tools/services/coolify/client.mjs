/* Requests to the configured Coolify instance. The token travels in a header and appears in
   nothing this prints: a gateway echoing a request back would otherwise put it in a transcript,
   and from there into a consult or a record. docs/cli/coolify.md. */
import { clockFor, deadlineOf, parsedOr, ranOut } from "../../../wire/request.mjs";
import { fail } from "../../../resolve/settings.mjs";
import { MASK } from "./shape.mjs";

const BODY_CUT = 1500;

export const struck = (text, token) =>
  token ? String(text).split(token).join(MASK) : String(text);

const hint = (status) => {
  if (status === 401) return "\n  token rejected — check `forge coolify login`, or the token's abilities";
  if (status === 403) return "\n  the token lacks the read, write or deploy ability this route needs";
  if (status === 404) return "\n  not found — check the uuid, and that it belongs to this team";
  return "";
};

const detailOf = (text) => {
  const parsed = parsedOr(text);
  if (!parsed || typeof parsed !== "object") return text.trim();
  const said = parsed.message ?? parsed.error ?? JSON.stringify(parsed);
  return parsed.errors ? `${said} | ${JSON.stringify(parsed.errors)}` : said;
};

const addressOf = (url, query) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const tail = params.toString();
  return tail ? `${url}?${tail}` : url;
};

/** A run's own handle on the instance: the target, the caller's switches and one request cache. */
export const session = (target, opts) => ({ target, opts, seen: new Map() });

/* `internal` is the scope guard's own lookups. They run under `--dry-run` too, because suppressing
   them would switch the guard off exactly where somebody is checking that it is on. */
export const ask = async (held, method, path, { query, body, internal = false, cache = false } = {}) => {
  const { target, opts } = held;
  const url = addressOf(`${target.url}${path}`, query);
  const key = cache ? `${method} ${url}` : null;
  if (key !== null && held.seen.has(key)) return held.seen.get(key);

  if (opts.dryRun && !internal) {
    console.log(struck(`${method} ${url}`, target.token));
    if (body) console.log(struck(JSON.stringify(body, null, 2), target.token));
    return null;
  }

  /* A deploy is the longest call this CLI makes by design, where a hang reads as a slow build. */
  const deadline = deadlineOf(null);
  let response = null;
  let text = "";
  try {
    response = await fetch(url, {
      method,
      signal: clockFor(deadline),
      headers: {
        Authorization: `Bearer ${target.token}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    text = await response.text();
  } catch (dropped) {
    /* `response` says which stage dropped: a body failure of its own was never wrapped here. */
    if (dropped.name === "TimeoutError") {
      return fail(`coolify: did not answer ${method} ${struck(url, target.token)}: ${ranOut(dropped, deadline)}`);
    }
    if (response) throw dropped;
    return fail(`coolify: cannot reach ${struck(url, target.token)} — ${struck(dropped.message, target.token)}`);
  }
  if (!response.ok) {
    const said = struck(detailOf(text), target.token).slice(0, BODY_CUT);
    return fail(`coolify: HTTP ${response.status} on ${method} ${struck(url, target.token)}\n  ${said}${hint(response.status)}`);
  }
  const answer = text.trim() ? (parsedOr(text) ?? text) : {};
  if (key !== null) held.seen.set(key, answer);
  return answer;
};

/* What the guard reads while deciding, never what the caller asked for: cached and internal, so a
   scoped `app get` guard-checks the very object it then fetches without a second round trip. */
export const look = (held, path) => ask(held, "GET", path, { internal: true, cache: true });
