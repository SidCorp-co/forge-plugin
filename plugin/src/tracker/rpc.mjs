/* One transport: the request, plus the two things a caller should never type — the credentials and
   the project id. Which request each capability makes is `rest.mjs`'s declared table, and this
   module is what makes it. docs/cli/one-transport.md. */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { configDir, once, readJson, userConfig } from "../resolve/config.mjs";
import { FROM_PROJECT, fail, projectSlug, projectTarget, settings, translateTarget } from "../resolve/settings.mjs";
import { translated } from "../tools/vi.mjs";
import { DECLARES, ROUTES, answersOf, droppedRefusal, keyOf, noRouteRefusal, rowFor, undeclaredIn } from "./rest.mjs";

const RETRY_ATTEMPTS = 4;
const FALLBACK_RETRY_SECONDS = 2;
const MAX_RETRY_SECONDS = 60;
const RATE_LIMITED = 429;
/* Only a read is sent again, off the row's own declaration; 429 says the call was not processed. */
const TRANSIENT = [408, 425, 500, 502, 503, 504];
const AMBIGUOUS = "This call may have been processed and is not sent again: idempotence is "
  + "documented for the merged mark alone, so a repeat could write twice. Read the record first.";

export const retryOf = (status, repeatable) => {
  if (status === RATE_LIMITED) return "rate-limited";
  return (status === null || TRANSIENT.includes(status)) && repeatable ? "transient" : null;
};

const sleep = (seconds) => new Promise((done) => setTimeout(done, seconds * 1000));

/* The first wait, doubled per attempt under the cap; `retrySeconds` in config.json sets it (0 for a suite proving
   the message, not the wait), only a non-negative JSON number counts, and the attempt count and a 429's wait stay (ISS-736). */
export const retrySeconds = (config = userConfig()) => {
  const given = config.retrySeconds;
  return typeof given === "number" && Number.isFinite(given) && given >= 0 ? given : FALLBACK_RETRY_SECONDS;
};
export const backoff = (attempt, config) => Math.min(retrySeconds(config) * 2 ** (attempt - 1), MAX_RETRY_SECONDS);

const parsed = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/* Honour the server's stated wait, with a ceiling: 3600 would be an hour of sleep, four times. */
export const retryAfter = (text, headers) => {
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

/** One configured value, whatever form it names, with the endpoint segment off the end of it. */
export const restBase = () => settings().url.replace(/\/mcp\/?$/u, "") + "/api";

/* No declared content type where a part carries the body: the boundary is the runtime's to name. */
const authorized = (multipart = false) => {
  const { token } = settings();
  return { Authorization: token, ...(multipart ? {} : { "Content-Type": "application/json" }) };
};

/* Per attempt and never kept: a rate limit is sent again whatever the row declares. */
const bodied = (form) => {
  const held = new FormData();
  for (const [field, part] of Object.entries(form)) {
    held.append(field, new Blob([part.bytes], { type: part.mime }), part.name);
  }
  return held;
};

const send = ({ path, method = "GET", form, body }) => fetch(`${restBase()}${path}`, {
  method,
  headers: authorized(Boolean(form)),
  ...(form ? { body: bodied(form) } : {}),
  ...(form || body === undefined ? {} : { body: JSON.stringify(body) }),
});

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
  const dropped = undeclaredIn(row, args);
  if (dropped.length) return stop(droppedRefusal(key, dropped, row));
  const parts = await fetchedParts(row, args, soft);
  /* The tracker's words with nothing in front: a caller reading the first line frames it itself. */
  const bad = parts.find(([, held]) => held.refused);
  if (bad) return stop(bad[1].refused);
  return unfencedIn(answersOf(row)(Object.fromEntries(parts.map(([part, held]) => [part, held.body])), args));
};

/* Cached beside the config and keyed by endpoint: an issue's project never changes. */
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

/** One slug's id, off the cache or off the list — the archived too where asked, since the one verb that unarchives has to find its subject; a slug nothing matches answers with what was seen, and the caller words the refusal. The lookup is itself a call, which is why `soft` reaches it: `fail()` inside one exits past the caller that was holding the refusal. */
export const projectIdOf = async (slug, { archived = false, soft = false } = {}) => {
  const known = stored().projects?.[slug];
  if (known) return { id: known };
  const listed = await callTool("forge_projects.list", archived ? { archived: 1 } : {}, soft);
  if (listed?.refused) return listed;
  const projects = listed?.projects ?? (Array.isArray(listed) ? listed : []);
  const found = projects.find((project) => project.slug === slug || project.key === slug);
  if (!found) return { seen: projects.map((one) => one.slug) };
  writeCache({ projects: { ...(stored().projects ?? {}), [slug]: found.id } });
  return { id: found.id };
};

const idOfProject = async (soft) => {
  const aimed = projectTarget().value;
  if (!aimed && soft) return { refused: "no project slug is set" };
  const slug = aimed ?? projectSlug();
  const held = await projectIdOf(slug, { soft });
  if (held.id || held.refused) return held;
  return refusing(soft)(`No Forge project has slug ${slug}. Seen: ${held.seen}`);
};

export const projectId = async () => (await idOfProject(false)).id;

export const scoped = callTool;

export const tried = async (name, args) => callTool(name, args, true);

/** What the table declares in the tracker's stead. The set is this CLI's and goes stale when the
 *  tracker grows a value, which is what a refusal citing it has to say. */
export const declaredFor = (tool, field) => DECLARES[tool]?.[field] ?? [];

/* One seat rather than a list of the payload kinds that may carry a secret, which goes stale the
   next time a verb learns to write. `uploadAll` holds the other: bytes never pass here. */
export const refuseCredential = async (value, what) => {
  if (!value) return;
  const held = await import("./project-config.mjs");
  const found = held.credentialLeak(value, await held.stagingDeploy());
  if (found) fail(held.leakRefusal(found, what));
};

/* Every write announces its target, and hands the payload it sent back to a caller that asks: on a project with a prose language that copy and the one the caller wrote are different documents, and only the first can be read back and compared. */
/* Whose write this is, off the table's own `account` flag: where a project record is the subject, the announce names that record and not the project this checkout is aimed at, which would name one project while the write went to another. A prose language is the written project's rather than the reading one's, so it is left off there too. The subject is said in the caller's own word where the cache holds it — the id is what the route takes and no reader knows one by sight. */
const slugFor = (id) => Object.entries(stored().projects ?? {}).find(([, held]) => held === id)?.[0];

const wroteFor = (name, args) => {
  const row = rowFor(name, args);
  if (row?.account) {
    const ref = args.projectRef;
    const value = (ref && (slugFor(ref) ?? ref)) ?? args.data?.slug ?? "the account";
    return { target: { value, from: "the call" }, own: false };
  }
  return { target: projectTarget(), own: true };
};

export const write = async (name, args, onSent, soft = false) => {
  await refuseCredential(args.data, `The payload ${name} was about to send`);
  const { target, own } = wroteFor(name, args);
  const language = own ? translateTarget() : {};
  /* The source in a reader's words: the project file is `forge doctor`'s to name, and dropping the source took with it the line saying the CLI itself re-aimed this write (ISS-700). */
  const from = target.from === FROM_PROJECT ? "the project file" : target.from ?? "nowhere";
  console.error(
    `${name} -> project ${target.value ?? "(none)"} (from ${from}), `
      + `prose ${language.value ?? "as written"}`,
  );
  const data = own && args.data ? translated(args.data) : args.data ?? null;
  onSent?.(data);
  return scoped(name, data ? { ...args, data } : args, soft);
};

/* `doctor` drops it, because a credential change can change which project ids resolve. */
export const forgetProjects = () => writeCache({ projects: {} });
