/* One transport for every verb. The endpoint speaks JSON-RPC over a single POST, so this is that
   POST plus the two things a caller should never type: the credentials, and the project id. */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { configDir, once, readJson } from "./config.mjs";
import { fail, projectScope, projectSlug, settings, translateScope } from "./settings.mjs";
import { translated } from "./vi.mjs";

const RETRY_ATTEMPTS = 4;
const FALLBACK_RETRY_SECONDS = 2;
const MAX_RETRY_SECONDS = 60;

const sleep = (seconds) => new Promise((done) => setTimeout(done, seconds * 1000));

/* The endpoint may answer either as JSON or as a single SSE frame. */
const sseData = (text) =>
  text
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("");

/* The server states its own wait: `{"code":"RATE_LIMITED", …,"details":{"retryAfterSeconds":2}}`.
   Failing instead of honouring it turns a two-second pause into a lost run; honouring it without a
   ceiling turns a server saying 3600 into an hour of sleep, four times over. */
const retryAfter = (text, headers) => {
  const capped = (seconds) => Math.min(seconds, MAX_RETRY_SECONDS);
  const header = Number(headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return capped(header);
  try {
    const seconds = JSON.parse(text)?.details?.retryAfterSeconds;
    if (Number.isFinite(seconds) && seconds > 0) return capped(seconds);
  } catch {
    /* Not every 429 answers as JSON. */
  }
  return FALLBACK_RETRY_SECONDS;
};

/* A schema violation comes back as a pretty-printed zod array carrying `pattern` — the full uuid
   regex, ~150 characters, repeated per field. The path and the message are the whole signal. */
const readable = (text) => {
  const start = text.indexOf("[");
  if (start < 0) return text;
  let parsed;
  try {
    parsed = JSON.parse(text.slice(start));
  } catch {
    return text;
  }
  if (!Array.isArray(parsed) || !parsed.length) return text;
  return parsed
    .map((issue) => `${(issue.path ?? []).join(".") || "(root)"}: ${issue.message ?? issue.code}`)
    .join("\n");
};

const post = async (method, params) => {
  const { url, token } = settings();
  const slug = projectScope().value;
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: token,
      ...(slug ? { "X-Forge-Project-Slug": slug } : {}),
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
};

export const rpc = async (method, params) => {
  let text = "";
  let response;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    response = await post(method, params);
    text = await response.text();
    if (response.status !== 429 || attempt === RETRY_ATTEMPTS) break;
    const wait = retryAfter(text, response.headers);
    console.error(`Forge rate-limited this call; waiting ${wait}s (attempt ${attempt}).`);
    await sleep(wait);
  }
  if (!response.ok) fail(`Forge answered ${response.status}: ${text.slice(0, 400)}`);
  const frame = text.startsWith("event:") || text.startsWith("data:") ? sseData(text) : text;
  let parsed;
  try {
    parsed = JSON.parse(frame);
  } catch {
    return fail(`Forge answered unparseable body: ${text.slice(0, 400)}`);
  }
  if (parsed.error) fail(`Forge refused: ${JSON.stringify(parsed.error)}`);
  return parsed.result;
};

/* A tool result carries its payload as text, structured, or both; `isError` is the tool's own
   refusal rather than a transport failure, and it must not read as a success. */
export const callTool = async (name, args, soft = false) => {
  const result = await rpc("tools/call", { name, arguments: args });
  const text = (result?.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
  if (result?.isError && soft) return { refused: readable(text) || "refused" };
  if (result?.isError) fail(`${name} refused:\n${readable(text) || JSON.stringify(result)}`);
  if (result?.structuredContent) return result.structuredContent;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/* `tools/list` is 130 KB and every verb needs it — to answer "does this tool take a projectId",
   and to validate a name or a filter before spending a round trip on it. Fetched per process it
   was 75% of the traffic of `forge issue`. It is a description of the server, so it is cached
   beside the config, keyed by endpoint, and refreshed whenever a lookup misses. */
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

/* Memoise the promise, not the value: assigning after the await lets two concurrent callers each
   fire the request, which turns one 130 KB fetch into five the moment anything runs in parallel. */
let pending = null;
const fetchTools = () => (pending ??= rpc("tools/list", {}).then((answer) => answer.tools));

export const tools = async ({ refresh = false } = {}) => {
  if (!refresh && stored().tools) return stored().tools;
  const declared = await fetchTools();
  writeCache({ tools: declared, at: new Date().toISOString() });
  return declared;
};

/* Refetch before erroring: a name absent from the cache may be a typo or may be a tool the server
   grew since the cache was written, and only one of those is worth an error message. */
export const toolNamed = async (name) => {
  const first = (await tools()).find((tool) => tool.name === name);
  if (first) return first;
  if (stored().tools) return (await tools({ refresh: true })).find((tool) => tool.name === name);
  return undefined;
};

/* An issue's project never changes, so the slug-to-id answer is cached with the tools. */
export const projectId = async () => {
  const slug = projectSlug();
  const known = stored().projects?.[slug];
  if (known) return known;
  const listed = await callTool("forge_projects.list", {});
  const projects = listed?.projects ?? listed?.data ?? (Array.isArray(listed) ? listed : []);
  const found = projects.find((project) => project.slug === slug || project.key === slug);
  if (!found) fail(`No Forge project has slug ${slug}. Seen: ${projects.map((p) => p.slug)}`);
  writeCache({ projects: { ...(stored().projects ?? {}), [slug]: found.id } });
  return found.id;
};

/* Some tools scope by project and the rest refuse the key outright, so the schema decides rather
   than a list here that would go stale against the server it is describing. */
export const scoped = async (name, args, soft = false) => {
  const wants = Boolean((await toolNamed(name))?.inputSchema?.properties?.projectId);
  return callTool(name, wants ? { projectId: await projectId(), ...args } : args, soft);
};

/* Every write goes through here. A write goes to whichever project the cwd resolves and
   `forge_issues` has no delete action, so announcing the target is not a courtesy owed per verb —
   `dep` and `attach` had each been written without it. */
export const write = async (name, args) => {
  const project = projectScope();
  const language = translateScope();
  console.error(
    `${name} -> project ${project.value ?? "(none)"} (from ${project.from ?? "nowhere"}), ` +
      `prose ${language.value ?? "as written"}`,
  );
  return scoped(name, args.data ? { ...args, data: translated(args.data) } : args);
};

/* `doctor` refreshes it, because a credential change can change which tools are declared. */
export const refreshTools = () => tools({ refresh: true });
