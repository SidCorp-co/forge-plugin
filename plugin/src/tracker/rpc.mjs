/* One transport: the POST, plus the two things a caller should never type — the credentials and
   the project id. docs/cli/one-transport.md. */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { configDir, once, readJson } from "../resolve/config.mjs";
import { DATA_FIELD, sseData } from "../sse.mjs";
import { suggest } from "../suggest.mjs";
import { fail, projectSlug, projectTarget, settings, translateTarget } from "../resolve/settings.mjs";
import { translated } from "../tools/vi.mjs";

const RETRY_ATTEMPTS = 4;
const FALLBACK_RETRY_SECONDS = 2;
const MAX_RETRY_SECONDS = 60;
const RATE_LIMITED = 429;
/* A gateway status or a dropped socket leaves a call that may have landed, so only a named read is
   sent again. Decided rather than derived from the arguments: `set_dependency` mutates with no
   `data` at all, and an action this list does not name is not retried, which is the safe side.
   429 is the tracker saying it did not process the call, which is safe whatever the call was. */
const TRANSIENT = [408, 425, 500, 502, 503, 504];
const READS = ["list", "get", "listTasks", "snapshot", "graph", "runner_load", "search"];
const AMBIGUOUS = "This call may have been processed and is not sent again: idempotence is "
  + "documented for the merged mark alone, so a repeat could write twice. Read the record first.";

/* A tool naming its action in its own name carries none in its arguments: docs/cli/beside.md. */
const DOTTED = /\.([a-z_]+)$/u;
const actionOf = (params) => params?.arguments?.action ?? DOTTED.exec(params?.name ?? "")?.[1] ?? null;

const repeatable = (params) => {
  const args = params?.arguments;
  if (!args || !Object.keys(args).length) return true;
  return READS.includes(actionOf(params)) && !args.data;
};
export const retryOf = (status, params) => {
  if (status === RATE_LIMITED) return "rate-limited";
  return (status === null || TRANSIENT.includes(status)) && repeatable(params) ? "transient" : null;
};

const sleep = (seconds) => new Promise((done) => setTimeout(done, seconds * 1000));
const backoff = (attempt) => Math.min(FALLBACK_RETRY_SECONDS * 2 ** (attempt - 1), MAX_RETRY_SECONDS);

/* Honour the server's stated wait, with a ceiling: 3600 would be an hour of sleep, four times. */
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

/* The path and the message are the whole signal; the uuid pattern repeats ~150 chars per field. */
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

/* A refusal naming a key the tool does not take is answerable from the tool's own schema: the key
   is usually real and one level out. Reported, never moved — the same name can be valid elsewhere
   and mean something else there, and no tool here has a delete action to undo the write. */
/* Wherever the schema wants an issue uuid, so a raw `call` carries `ISS-45` too — and so a
   refusal can name the argument that identifies a record when a different one was sent. */
export const REFERENCE_KEYS = new Set([
  "documentId",
  "dependsOnId",
  "blocksId",
  "issue",
  "issueId",
  "fromIssueId",
  "toIssueId",
]);
const UNRECOGNIZED = /Unrecognized keys?: (.+)/gu;
const QUOTED = /"([^"]+)"/g;
const MAX_DEPTH = 6;

const inside = (path) => (path.length ? [...path.slice(0, -1), `${path.at(-1)}[]`] : path);

export const keyPaths = (schema, wanted, path = [], depth = 0) => {
  if (!schema || typeof schema !== "object" || depth > MAX_DEPTH) return [];
  const found = [];
  for (const [name, child] of Object.entries(schema.properties ?? {})) {
    if (name === wanted) found.push([...path, name].join("."));
    found.push(...keyPaths(child, wanted, [...path, name], depth + 1));
  }
  if (schema.items) found.push(...keyPaths(schema.items, wanted, inside(path), depth + 1));
  for (const branch of [schema.anyOf, schema.oneOf, schema.allOf].flat()) {
    found.push(...keyPaths(branch, wanted, path, depth + 1));
  }
  return [...new Set(found)];
};

const misplaced = async (name, rendered) => {
  const schema = (await toolNamed(name))?.inputSchema;
  if (!schema) return "";
  const top = Object.keys(schema.properties ?? {});
  const lines = [];
  for (const [, listed] of rendered.matchAll(UNRECOGNIZED)) {
    for (const [, key] of listed.matchAll(QUOTED)) {
      const elsewhere = keyPaths(schema, key).filter((where) => where !== key);
      lines.push(
        elsewhere.length
          ? `\`${key}\` is not an argument of ${name}; this schema takes it at ${elsewhere.join(", ")}.`
          : `\`${key}\` appears nowhere in this schema.`,
      );
      const named = REFERENCE_KEYS.has(key) ? top.filter((one) => REFERENCE_KEYS.has(one)) : [];
      const close = named.length ? named : suggest(key, top).filter((one) => one !== key);
      if (close.length) {
        const why = named.length ? "arguments that identify a record here" : "arguments close to it";
        lines.push(`  ${why}: ${close.join(", ")}`);
      }
    }
  }
  if (!lines.length) return "";
  return `\n\n${lines.join("\n")}\nNo key is relocated for you — the one that identifies a record and the one ` +
    `carried inside \`data\` are different fields. \`forge schema ${name}\` prints them.`;
};

const post = async (method, params) => {
  const { url, token } = settings();
  const slug = projectTarget().value;
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

export const rpc = async (method, params, soft = false) => {
  let text = "";
  let response = null;
  let dropped = null;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    [response, dropped] = [null, null];
    try {
      response = await post(method, params);
      text = await response.text();
    } catch (error) {
      dropped = error;
    }
    if (response?.ok) break;
    const again = retryOf(response ? response.status : null, params);
    if (!again || attempt === RETRY_ATTEMPTS) break;
    const limited = again === "rate-limited";
    const wait = limited ? retryAfter(text, response.headers) : backoff(attempt);
    const said = limited ? "rate-limited this call" : `answered ${response?.status ?? dropped.message}`;
    console.error(`Forge ${said}; waiting ${wait}s (attempt ${attempt} of ${RETRY_ATTEMPTS}).`);
    await sleep(wait);
  }
  const owed = repeatable(params) ? "" : `\n${AMBIGUOUS}`;
  const stop = (message) => (soft ? { refused: message } : fail(message));
  if (dropped) return stop(`Forge did not answer: ${dropped.message}.${owed}`);
  if (!response.ok) {
    return stop(`Forge answered ${response.status}: ${text.slice(0, 400)}`
      + `${TRANSIENT.includes(response.status) ? owed : ""}`);
  }
  /* The endpoint may answer either as JSON or as a single SSE frame. */
  const frame = text.startsWith("event:") || text.startsWith(DATA_FIELD) ? sseData(text) : text;
  let parsed;
  try {
    parsed = JSON.parse(frame);
  } catch {
    return stop(`Forge answered unparseable body: ${text.slice(0, 400)}`);
  }
  if (parsed.error) return stop(`Forge refused: ${JSON.stringify(parsed.error)}`);
  return parsed.result;
};

/* `isError` is the tool's own refusal, not a transport failure, and must not read as success. */
export const callTool = async (name, args, soft = false, transport = false) => {
  const result = await rpc("tools/call", { name, arguments: args }, transport);
  if (result?.refused) return result;
  const text = (result?.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
  if (result?.isError && soft) return { refused: readable(text) || "refused" };
  if (result?.isError) {
    const rendered = readable(text) || JSON.stringify(result);
    fail(`${name} refused:\n${rendered}${await misplaced(name, rendered)}`);
  }
  if (result?.structuredContent) return result.structuredContent;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/* `tools/list` is 130 KB and every verb needs it — 75% of `forge issue` when fetched per process.
   Cached beside the config, keyed by endpoint, refreshed when a lookup misses. */
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

/* Memoise the PROMISE: assigning after the await lets concurrent callers each fire the request. */
let pending = null;
const fetchTools = () => (pending ??= rpc("tools/list", {}).then((answer) => answer.tools));

export const tools = async ({ refresh = false } = {}) => {
  if (!refresh && stored().tools) return stored().tools;
  const declared = await fetchTools();
  writeCache({ tools: declared, at: new Date().toISOString() });
  return declared;
};

/** What a tool declares at a path under its input schema, or nothing where it declares none. Here
 *  rather than at either caller: an enum read in two places is two ideas of what silence means. */
export const enumAt = async (tool, path) => {
  const declared = await toolNamed(tool);
  return path.reduce((held, key) => held?.[key], declared?.inputSchema?.properties) ?? [];
};

/* Refetch before erroring: an absent name may be a typo or a tool the server grew. */
export const toolNamed = async (name) => {
  const first = (await tools()).find((tool) => tool.name === name);
  if (first) return first;
  if (stored().tools) return (await tools({ refresh: true })).find((tool) => tool.name === name);
  return undefined;
};

/* An issue's project never changes, so the slug-to-id answer is cached with the tools. Soft for the
   caller whose call is a check beside its real work: the lookup is itself a call. */
const idOfProject = async (soft) => {
  const aimed = projectTarget().value;
  if (!aimed && soft) return { refused: "no project slug is set" };
  const slug = aimed ?? projectSlug();
  const known = stored().projects?.[slug];
  if (known) return { id: known };
  const listed = await callTool("forge_projects.list", {}, soft, soft);
  if (listed?.refused) return listed;
  const projects = listed?.projects ?? listed?.data ?? (Array.isArray(listed) ? listed : []);
  const found = projects.find((project) => project.slug === slug || project.key === slug);
  if (!found) {
    const said = `No Forge project has slug ${slug}. Seen: ${projects.map((p) => p.slug)}`;
    return soft ? { refused: said } : fail(said);
  }
  writeCache({ projects: { ...(stored().projects ?? {}), [slug]: found.id } });
  return { id: found.id };
};

export const projectId = async () => (await idOfProject(false)).id;

/* The schema decides, not a list that would go stale against the server it describes. */
const aimed = async (name, args) =>
  (Boolean((await toolNamed(name))?.inputSchema?.properties?.projectId)
    ? { projectId: await projectId(), ...args }
    : args);

export const scoped = async (name, args, soft = false) => callTool(name, await aimed(name, args), soft);

/* Aiming is itself calls, and `fail()` in one exits past the caller holding the refusal. */
const readied = async (name) => {
  const declared = (stored().tools ?? []).find((tool) => tool.name === name);
  if (!declared) return { refused: `${name} is in no tool list this process has resolved` };
  if (!declared.inputSchema?.properties?.projectId) return { args: {} };
  const found = await idOfProject(true);
  return found.refused ? found : { args: { projectId: found.id } };
};

export const tried = async (name, args) => {
  const aim = await readied(name);
  return aim.refused ? aim : callTool(name, { ...aim.args, ...args }, true, true);
};

/* One seat rather than a list of the payload kinds that may carry a secret, which is a list that
   goes stale the next time a verb learns to write. Dynamic because the reader it asks reaches the
   tracker through this module; soft and memoised, so a payload is never refused by a read this CLI
   could not make — that refusal would have no route out. `uploadTo` holds the other seat: an
   attachment's bytes never pass here. */
export const refuseCredential = async (value, what) => {
  if (!value) return;
  const held = await import("./project-config.mjs");
  const found = held.credentialLeak(value, await held.stagingDeploy());
  if (found) fail(held.leakRefusal(found, what));
};

/* Every write announces its target: the cwd usually picks the project, one verb aims it elsewhere,
   and there is no delete action. The payload it sent is handed back to a caller that asks, because
   on a project with a prose language that copy and the one the caller wrote are different
   documents, and only the first can be read back and compared. `soft` hands the tool's own refusal
   back instead of exiting, for the caller that has something to say before the body is lost. */
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

/* `doctor` refreshes it, because a credential change can change which tools are declared. */
export const refreshTools = () => tools({ refresh: true });
