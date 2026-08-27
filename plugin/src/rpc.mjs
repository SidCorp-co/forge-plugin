/* One transport for every verb. The endpoint speaks JSON-RPC over a single POST, so this is that
   POST plus the two things a caller should never type: the credentials, and the project id. */
import { fail, projectSlug, settings, slugIfAny } from "./settings.mjs";

const RETRY_ATTEMPTS = 4;
const FALLBACK_RETRY_SECONDS = 2;

const sleep = (seconds) => new Promise((done) => setTimeout(done, seconds * 1000));

/* The endpoint may answer either as JSON or as a single SSE frame. */
const sseData = (text) =>
  text
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("");

/* The server states its own wait: `{"code":"RATE_LIMITED", …,"details":{"retryAfterSeconds":2}}`.
   Failing the command instead of honouring it turns a two-second pause into a lost run. */
const retryAfter = (text, headers) => {
  const header = Number(headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return header;
  try {
    const seconds = JSON.parse(text)?.details?.retryAfterSeconds;
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  } catch {
    /* Not every 429 answers as JSON. */
  }
  return FALLBACK_RETRY_SECONDS;
};

const post = async (method, params) => {
  const { url, token } = settings();
  const slug = slugIfAny();
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
  let response = null;
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

let declared = null;
export const tools = async () => (declared ??= (await rpc("tools/list", {})).tools);

/* Memoised: every scoped call would otherwise re-list the projects, and `attach` re-lists once
   per file, which is enough sequential traffic to trip the rate limit on its own. */
let cachedId = null;
export const projectId = async () => {
  if (cachedId) return cachedId;
  const slug = projectSlug();
  const listed = await callTool("forge_projects.list", {});
  const projects = listed?.projects ?? listed?.data ?? (Array.isArray(listed) ? listed : []);
  const found = projects.find((project) => project.slug === slug || project.key === slug);
  if (!found) fail(`No Forge project has slug ${slug}. Seen: ${projects.map((p) => p.slug)}`);
  cachedId = found.id;
  return cachedId;
};

/* Some tools scope by project and the rest refuse the key outright, so the schema decides rather
   than a list here that would go stale against the server it is describing. */
export const scoped = async (name, args, soft = false) => {
  const schema = (await tools()).find((tool) => tool.name === name)?.inputSchema;
  const wants = Boolean(schema?.properties?.projectId);
  return callTool(name, wants ? { projectId: await projectId(), ...args } : args, soft);
};
