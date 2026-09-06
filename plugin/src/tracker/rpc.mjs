/* One transport: the request, plus the two things a caller should never type — the credentials and
   the project id. Which request each capability makes is `rest.mjs`'s declared table, and this
   module is what makes it. docs/cli/one-transport.md. */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { configDir, once, readJson } from "../resolve/config.mjs";
import { DATA_FIELD, sseData } from "../sse.mjs";
import { fail, projectSlug, projectTarget, settings, translateTarget } from "../resolve/settings.mjs";
import { translated } from "../tools/vi.mjs";
import { DECLARES, ROUTES, answersOf, droppedRefusal, isMcp, keyOf, noRouteRefusal, undeclaredIn } from "./rest.mjs";

const RETRY_ATTEMPTS = 4;
const FALLBACK_RETRY_SECONDS = 2;
const MAX_RETRY_SECONDS = 60;
const RATE_LIMITED = 429;
/* Only a read is sent again, and which a row is, is the row's own declaration; 429 is the tracker
   saying it did not process the call, which is safe whatever the call was. */
const TRANSIENT = [408, 425, 500, 502, 503, 504];
const AMBIGUOUS = "This call may have been processed and is not sent again: idempotence is "
  + "documented for the merged mark alone, so a repeat could write twice. Read the record first.";

export const retryOf = (status, repeatable) => {
  if (status === RATE_LIMITED) return "rate-limited";
  return (status === null || TRANSIENT.includes(status)) && repeatable ? "transient" : null;
};

const sleep = (seconds) => new Promise((done) => setTimeout(done, seconds * 1000));
const backoff = (attempt) => Math.min(FALLBACK_RETRY_SECONDS * 2 ** (attempt - 1), MAX_RETRY_SECONDS);

const parsed = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/* Honour the server's stated wait, with a ceiling: 3600 would be an hour of sleep, four times. */
const retryAfter = (text, headers) => {
  const capped = (seconds) => Math.min(seconds, MAX_RETRY_SECONDS);
  const header = Number(headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return capped(header);
  const seconds = parsed(text)?.details?.retryAfterSeconds;
  return Number.isFinite(seconds) && seconds > 0 ? capped(seconds) : FALLBACK_RETRY_SECONDS;
};

/** Soft for a caller holding the refusal beside its real work, `fail()` for one that is not. */
const refusing = (soft) => (message) => (soft ? { refused: message } : fail(message));

/* The tracker's fence: one home, and where each strip has to stand — docs/cli/the-primitives.md. */
export const FENCE_PATTERN = String.raw`⟦(?:END_)?UNTRUSTED_DATA[^⟧]*⟧`;
const FENCE = new RegExp(String.raw`(\r?\n)?^(${FENCE_PATTERN})[ \t]*$(\r?\n)?`, "gmu");
const OPENER = "⟦";
const CLOSER = "⟦END";

const unfenced = (text) => {
  const held = String(text);
  return held.includes(OPENER)
    ? held.replace(FENCE, (all, before, marker, after) => (marker.startsWith(CLOSER) ? after ?? "" : before ?? ""))
    : held;
};

export const unfencedIn = (value) => {
  if (typeof value === "string") return unfenced(value);
  if (Array.isArray(value)) return value.map(unfencedIn);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, held]) => [key, unfencedIn(held)]));
};

export const mcpUrl = () => settings().url;
export const restBase = () => mcpUrl().replace(/\/mcp\/?$/u, "") + "/api";

const authorized = () => {
  const { token } = settings();
  return { Authorization: token, "Content-Type": "application/json" };
};

const post = (method, params) => {
  const slug = projectTarget().value;
  return fetch(mcpUrl(), {
    method: "POST",
    headers: {
      ...authorized(),
      ...(slug ? { "X-Forge-Project-Slug": slug } : {}),
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
};

const send = ({ path, method = "GET", body }) => fetch(`${restBase()}${path}`, {
  method,
  headers: authorized(),
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

/** The retry loop both transports share; what a failure means is the caller's, the two differing. */
const attempted = async (make, repeatable) => {
  let text = "";
  let response = null;
  let dropped = null;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    [response, dropped] = [null, null];
    try {
      response = await make();
      text = await response.text();
    } catch (error) {
      dropped = error;
    }
    if (response?.ok) break;
    const again = retryOf(response ? response.status : null, repeatable);
    if (!again || attempt === RETRY_ATTEMPTS) break;
    const limited = again === "rate-limited";
    const wait = limited ? retryAfter(text, response.headers) : backoff(attempt);
    const said = limited ? "rate-limited this call" : `answered ${response?.status ?? dropped.message}`;
    console.error(`Forge ${said}; waiting ${wait}s (attempt ${attempt} of ${RETRY_ATTEMPTS}).`);
    await sleep(wait);
  }
  return { response, text, dropped };
};

/* The tracker's own validation error is the diagnostic; nothing here re-derives it. Each message is
   stripped before its field name goes in front, the fence being anchored to the start of a line. */
const said = (body, status) => {
  const details = body?.details ?? {};
  const lines = [
    ...(details.formErrors ?? []).map(unfenced),
    ...Object.entries(details.fieldErrors ?? {})
      .map(([field, held]) => `${field}: ${[held].flat().map(unfenced).join("; ")}`),
  ];
  const head = body?.message ? `${body.code ?? status}: ${unfenced(body.message)}` : `Forge answered ${status}`;
  return lines.length ? `${head}\n${lines.join("\n")}` : head;
};

export const rpc = async (method, params, soft = false) => {
  const { response, text, dropped } = await attempted(() => post(method, params), false);
  const stop = refusing(soft);
  if (dropped) return stop(`Forge did not answer: ${dropped.message}.\n${AMBIGUOUS}`);
  if (!response.ok) return stop(`Forge answered ${response.status}: ${text.slice(0, 400)}`);
  /* The endpoint may answer either as JSON or as a single SSE frame. */
  const frame = text.startsWith("event:") || text.startsWith(DATA_FIELD) ? sseData(text) : text;
  const held = parsed(frame);
  if (held === undefined) return stop(`Forge answered unparseable body: ${text.slice(0, 400)}`);
  if (held.error) return stop(`Forge refused: ${JSON.stringify(held.error)}`);
  return held.result;
};

/* A row that keeps the JSON-RPC endpoint by its own nature reaches it here and nowhere else. */
const overMcp = async (name, args, soft) => {
  const result = await rpc("tools/call", { name, arguments: args }, soft);
  if (result?.refused) return result;
  const text = (result?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
  if (result?.isError) {
    const rendered = unfenced(text) || JSON.stringify(result);
    return soft ? { refused: rendered } : fail(`${name} refused:\n${rendered}`);
  }
  if (result?.structuredContent) return unfencedIn(result.structuredContent);
  const held = parsed(text);
  return held === undefined ? unfenced(text) : unfencedIn(held);
};

const aimedAt = async (row, args, soft) => {
  if (!row.project) return { id: null };
  return args.projectId ? { id: args.projectId } : idOfProject(soft);
};

const refused = (message) => ({ refused: message });

/* Every part of a row's answer is asked for at once: three routes cost one round trip, not three. */
const fetchedParts = async (row, args, soft) => {
  const project = await aimedAt(row, args, soft);
  if (project.refused) return [["page", refused(project.refused)]];
  const requests = row.requests(args, project.id);
  const parts = await Promise.all(Object.entries(requests).map(async ([part, request]) => {
    const { response, text, dropped } = await attempted(() => send(request), !row.writes);
    if (dropped) return [part, refused(`Forge did not answer ${request.method ?? "GET"} ${request.path}: `
      + `${dropped.message}${row.writes ? `\n${AMBIGUOUS}` : ""}`)];
    if (!response.ok) return [part, refused(said(parsed(text), response.status))];
    const body = text ? parsed(text) : null;
    /* Refused rather than projected: an empty page built out of a gateway's HTML would read as the
       tracker saying the row is not there. */
    if (text && (body === undefined || typeof body !== "object" || body === null)) {
      return [part, refused(`${request.method ?? "GET"} ${request.path} answered 200 with no record: `
        + `${text.slice(0, 200)}`)];
    }
    return [part, { body }];
  }));
  return parts;
};

export const callTool = async (name, args, soft = false) => {
  const key = keyOf(name, args);
  const row = ROUTES[key];
  const stop = refusing(soft);
  if (!row) return stop(noRouteRefusal(key));
  if (isMcp(row)) return overMcp(name, args, soft);
  const dropped = undeclaredIn(row, args);
  if (dropped.length) return stop(droppedRefusal(key, dropped, row));
  const parts = await fetchedParts(row, args, soft);
  /* The tracker's words with nothing in front: a caller reading the first line frames it itself. */
  const bad = parts.find(([, held]) => held.refused);
  if (bad) return stop(bad[1].refused);
  return unfencedIn(answersOf(row)(Object.fromEntries(parts.map(([part, held]) => [part, held.body])), args));
};

/* The slug-to-id answer is cached beside the config, keyed by endpoint: an issue's project never
   changes, and every project-scoped path carries the id rather than the slug. */
const cachePath = () => {
  const key = createHash("sha256").update(settings().url).digest("hex").slice(0, 12);
  return join(configDir("forge"), `tools-${key}.json`);
};

const stored = once(() => readJson(cachePath()) ?? {});

const writeCache = (patch) => {
  const merged = { ...stored(), ...patch };
  Object.assign(stored(), merged);
  try {
    writeFileSync(cachePath(), `${JSON.stringify(merged)}\n`, { mode: 0o600 });
  } catch {
    /* A cache that cannot be written is a slow run, never a failed one. */
  }
};

/* The lookup is itself a call, which is why `soft` reaches it at all: `fail()` inside one exits past
   the caller that was holding the refusal. */
const idOfProject = async (soft) => {
  const aimed = projectTarget().value;
  if (!aimed && soft) return { refused: "no project slug is set" };
  const slug = aimed ?? projectSlug();
  const known = stored().projects?.[slug];
  if (known) return { id: known };
  const listed = await callTool("forge_projects.list", {}, soft);
  if (listed?.refused) return listed;
  const projects = listed?.projects ?? (Array.isArray(listed) ? listed : []);
  const found = projects.find((project) => project.slug === slug || project.key === slug);
  if (!found) {
    return refusing(soft)(`No Forge project has slug ${slug}. Seen: ${projects.map((one) => one.slug)}`);
  }
  writeCache({ projects: { ...(stored().projects ?? {}), [slug]: found.id } });
  return { id: found.id };
};

export const projectId = async () => (await idOfProject(false)).id;

export const scoped = callTool;

export const tried = async (name, args) => callTool(name, args, true);

/** What the table declares in the tracker's stead, for a check the tracker's own refusal cannot
 *  carry. The set is this CLI's and goes stale when the tracker grows a value, which is what the
 *  refusal citing it has to say. */
export const declaredFor = (tool, field) => DECLARES[tool]?.[field] ?? [];

/* One seat rather than a list of the payload kinds that may carry a secret, which goes stale the
   next time a verb learns to write. `uploadTo` holds the other seat: an attachment's bytes never
   pass here. */
export const refuseCredential = async (value, what) => {
  if (!value) return;
  const held = await import("./project-config.mjs");
  const found = held.credentialLeak(value, await held.stagingDeploy());
  if (found) fail(held.leakRefusal(found, what));
};

/* Every write announces its target, and hands the payload it sent back to a caller that asks: on a
   project with a prose language that copy and the one the caller wrote are different documents, and
   only the first can be read back and compared. */
export const write = async (name, args, onSent, soft = false) => {
  await refuseCredential(args.data, `The payload ${name} was about to send`);
  const project = projectTarget();
  const language = translateTarget();
  console.error(
    `${name} -> project ${project.value ?? "(none)"} (from ${project.from ?? "nowhere"}), ` +
      `prose ${language.value ?? "as written"}`,
  );
  const data = args.data ? translated(args.data) : null;
  onSent?.(data);
  return scoped(name, data ? { ...args, data } : args, soft);
};

/* `doctor` drops it, because a credential change can change which project ids resolve. */
export const forgetProjects = () => writeCache({ projects: {} });
