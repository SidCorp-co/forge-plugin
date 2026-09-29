/* One transport: the request, plus the two things a caller should never type — the credentials and
   the project id. Which request each capability makes is `routes.mjs`'s declared table, and this
   module is what makes it. docs/cli/one-transport.md. */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  callRoom, ceilingFrom, ceilingLeft, clockFor, clockSpentSaid, deadlineOf, parsedOr, ranOut, sawHeadersAfter, secondsGiven,
  spending, textWithin, within,
} from "../wire/request.mjs";
import { sawAnswer, sharedNow } from "../wire/shared-clock.mjs";
import { reserveIn, sawBudget, settled, unpredictedIn } from "../wire/budget.mjs";
import { configDir, once, readJson, userConfig } from "../resolve/config.mjs";
import { fromProject, fail, projectSlug, projectTarget, settings, translateTarget } from "../resolve/settings.mjs";
import { translated } from "../tools/vi.mjs";
import { DATA_FENCE_PATTERN } from "../markdown.mjs";
import { nearestOutside } from "../suggest.mjs";
import { DECLARES, ROUTES, answersOf, declaredFor, keyOf, rowFor } from "./routes.mjs";
import { droppedRefusal, noRouteRefusal, undeclaredIn } from "./declared/no-route.mjs";

const RETRY_ATTEMPTS = 4;
const FALLBACK_RETRY_SECONDS = 2;
const MAX_RETRY_SECONDS = 60;
const RATE_LIMITED = 429;
/* Only a read is sent again, off the row's own declaration; 429 says the call was not processed. */
const TRANSIENT = [408, 425, 500, 502, 503, 504];
export const AMBIGUOUS = "This call may have been processed and is not sent again: idempotence is "
  + "documented for the merged mark alone, so a repeat could write twice. Read the record first.";

export const retryOf = (status, repeatable) => {
  if (status === RATE_LIMITED) return "rate-limited";
  return (status === null || TRANSIENT.includes(status)) && repeatable ? "transient" : null;
};

const sleep = (seconds) => new Promise((done) => setTimeout(done, seconds * 1000));

/* Only where the attempt's bound was cut to the process's clock: a caller's own `waits` is a deadline
   the account does not answer for. */
const onClock = (said, deadline) => {
  if (!ceilingFrom() || deadline?.from !== ceilingFrom()) return said;
  return `${said}${/[.!?]$/u.test(said) ? "" : "."} ${clockSpentSaid()}`;
};

/* The first wait, doubled per attempt under the cap; `retrySeconds` in config.json sets it, 0 for a suite proving the message rather than the wait, and the attempt count and a 429's wait stay (ISS-736). */
export const retrySeconds = (config = userConfig()) => secondsGiven(config.retrySeconds) ?? FALLBACK_RETRY_SECONDS;
export const backoff = (attempt, config) => Math.min(retrySeconds(config) * 2 ** (attempt - 1), MAX_RETRY_SECONDS);

/* Honour the server's stated wait, with a ceiling: 3600 would be an hour of sleep, four times. */
export const retryAfter = (text, headers) => {
  const capped = (seconds) => Math.min(seconds, MAX_RETRY_SECONDS);
  const header = Number(headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return capped(header);
  const seconds = parsedOr(text)?.details?.retryAfterSeconds;
  return Number.isFinite(seconds) && seconds > 0 ? capped(seconds) : FALLBACK_RETRY_SECONDS;
};

/** Soft for a caller holding the refusal beside its real work, `fail()` for one that is not. A soft one
 *  keeps the answer's status and the body's `details` where the tracker sent them: an upload tells its
 *  verdict on the file from a call that failed by the first, and reads the accepted set off the second. */
const refusing = (soft) => (message, answer = {}) => (soft ? { refused: message, ...answer } : fail(message));

/* Where each strip of the tracker's fence has to stand — docs/cli/the-primitives.md. */
const FENCE = new RegExp(String.raw`(\r?\n)?^(${DATA_FENCE_PATTERN})[ \t]*$(\r?\n)?`, "gmu");
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

/* Declared where a JSON body follows it and nowhere else — docs/cli/one-transport.md says what a header over an empty body cost, and why a multipart one's boundary is the runtime's. */
const authorized = (json) => {
  const { token } = settings();
  return { Authorization: token, ...(json ? { "Content-Type": "application/json" } : {}) };
};

/* Per attempt and never kept: a rate limit is sent again whatever the row declares. */
const bodied = (form) => {
  const held = new FormData();
  for (const [field, part] of Object.entries(form)) {
    held.append(field, new Blob([part.bytes], { type: part.mime }), part.name);
  }
  return held;
};

const send = ({ path, method = "GET", form, body }, signal) => {
  const json = !form && body !== undefined;
  return fetch(`${restBase()}${path}`, {
    method,
    signal,
    headers: authorized(json),
    ...(form ? { body: bodied(form) } : {}),
    ...(json ? { body: JSON.stringify(body) } : {}),
  });
};

/* What a caller inside somebody else's clock needs: one attempt rather than the ladder, `waits` for its own deadline, `signal` for its own abort, and `spend` charged before each attempt — so a refusal is one the other end never saw, and a retry and a nested lookup are both counted. A caller naming no deadline still gets one, fresh per attempt: no answer at all is the failure a count of attempts cannot bound. */
const waited = (seconds, signal) => new Promise((done) => {
  const timer = setTimeout(done, seconds * 1000);
  signal?.addEventListener("abort", () => {
    clearTimeout(timer);
    done();
  }, { once: true });
});

/* Predictable rather than discovered by the refusal after it (ISS-1849), against the tracker's own
   clock, the reset being an instant in its frame, and inside what is left of the attempt's own once
   the call after the wait has room to be answered in: a wait that takes all of it leaves the call a
   clock it cannot be answered inside, which is a stand-down bought with a wait (ISS-2385). */
const paced = async (key, clock, left) => {
  while (!clock.aborted) {
    const held = reserveIn(key, sharedNow(), left() - callRoom());
    if (!held) return true;
    if (held.said) console.error(held.said);
    const done = spending("pacing");
    await waited(held.seconds, clock);
    done();
  }
  return false;
};

const attempted = async (make, repeatable, { once = false, spend = null, waits = null, signal = null } = {}, key = null) => {
  const deadline = deadlineOf(waits);
  const attempts = once ? 1 : RETRY_ATTEMPTS;
  let text = "";
  let response = null;
  let dropped = null;
  let bound = deadline;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const stop = spend?.() ?? (ceilingLeft() > 0 ? null : `Nothing was sent: ${ceilingFrom()} had no time left. ${clockSpentSaid()}`);
    if (stop) return { response: null, text: "", dropped: null, spent: stop };
    [text, response, dropped] = ["", null, null];
    /* Only a reservation this attempt took is its to retire: one an abort ended before it took any
       would retire another call's, and the next window would lend that call's room twice. */
    let took = false;
    let unpredicted = unpredictedIn(key);
    let inFlight = null;
    try {
      bound = within(deadline);
      const clock = clockFor(bound, signal);
      const armed = performance.now();
      took = await paced(key, clock, () => bound.millis - (performance.now() - armed));
      unpredicted = unpredictedIn(key);
      inFlight = spending("call");
      const sentAt = performance.now();
      response = await make(clock);
      const gotAt = performance.now();
      sawAnswer(response.headers, sentAt, gotAt);
      sawHeadersAfter(gotAt - sentAt);
      sawBudget(key, response.headers);
      text = await textWithin(response, clock);
    } catch (error) {
      dropped = error;
    } finally {
      inFlight?.();
      if (took) settled(key);
    }
    /* An attempt whose body dropped is a dropped attempt, whatever its headers said: those describe a request the server answered and `dropped` the connection dying before the answer arrived, so a 200 whose body stalled is no success and a 429's is judged no differently. What the rule costs rather than exempts: a 429 whose body stalls waits the ladder's number instead of the one the server sent (ISS-828). */
    if (response?.ok && !dropped) break;
    const again = retryOf(dropped ? null : response.status, repeatable);
    if (!again || attempt === attempts) break;
    const limited = again === "rate-limited";
    const wait = limited ? retryAfter(text, response.headers) : backoff(attempt);
    const answered = dropped ? ranOut(dropped, bound) : `answered ${response.status}`;
    const said = limited ? `rate-limited this call ${unpredicted}` : answered;
    /* A wait the process's clock cannot hold is not slept into the kill: the caller is told now, while it can still answer. */
    const left = ceilingLeft();
    if (wait * 1000 >= left) {
      const spent = `Forge ${said.trimEnd()}, and waiting ${wait}s to send it again would outlast the `
        + `${left / 1000}s left of ${ceilingFrom()}, so it was not sent again. ${clockSpentSaid()}`;
      return { response, text, dropped, deadline: bound, spent };
    }
    const resting = spending("retry");
    console.error(`Forge ${said}; waiting ${wait}s (attempt ${attempt} of ${attempts}).`);
    await sleep(wait);
    resting();
  }
  return { response, text, dropped, deadline: bound };
};

/* The tracker's own validation error is the diagnostic; nothing here re-derives it. Each message is
   stripped before its field name goes in front, the fence being anchored to the start of a line. */
const said = (body, status, args) => {
  const details = body?.details ?? {};
  const lines = [
    ...(details.formErrors ?? []).map(unfenced),
    ...Object.entries(details.fieldErrors ?? {})
      .map(([field, held]) => `${field}: ${[held].flat().map(unfenced).join("; ")}`),
  ];
  const head = body?.message ? `${body.code ?? status}: ${unfenced(body.message)}` : `Forge answered ${status}`;
  const whole = lines.length ? `${head}\n${lines.join("\n")}` : head;
  if (body?.code === NO_WORK_EVIDENCE) return `${whole}\n${capturedBy(args?.documentId ?? args?.data?.issueId)}`;
  return status === 401 ? `${UNAUTHORIZED}\n\n${whole}` : whole;
};

/* The tracker's work-evidence refusal, met by a status move and by the merged mark alike, names two
   fields a branch may be recorded in and never a command: one is the field `forge claim --pushed`
   writes, and the other is one no verb here writes and `forge issue --set` refuses, so a run told
   only the tracker's words is sent to a field it cannot reach (ISS-2775). */
const NO_WORK_EVIDENCE = "NO_WORK_EVIDENCE";
const capturedBy = (id) => `Capture the branch the work is on, which is not the project's base branch, `
  + `with \`forge claim ${id ?? "<issue>"} --pushed\`: it writes sessionContext.worklog.branch, which `
  + "that check reads. Then send the refused command again.";

/* The tracker's words say the token was refused and never which token or where it came from, which
   left a run unable to tell a wrong one from an expired one without a person (ISS-45). */
const UNAUTHORIZED = "Run `forge doctor` for the token this sent and the file it was read from, and "
  + "`forge doctor --token <t>` to replace it. The tracker refused that token:";

const aimedAt = async (row, args, soft, held) => {
  if (!row.project) return { id: null };
  return args.projectId ? { id: args.projectId } : idOfProject(soft, held);
};

const refused = (message, answer = {}) => ({ refused: message, ...answer });

/* Every part of a row's answer is asked for at once: three routes cost one round trip, not three. */
const fetchedParts = async (key, row, args, soft, held) => {
  const project = await aimedAt(row, args, soft, held);
  if (project.refused) return [["page", refused(project.refused)]];
  const requests = row.requests(args, project.id);
  const parts = await Promise.all(Object.entries(requests).map(async ([part, request]) => {
    const { response, text, dropped, spent, deadline } = await attempted(
      (signal) => send(request, signal),
      !row.writes,
      held,
      key,
    );
    if (spent) return [part, refused(spent)];
    if (dropped) return [part, refused(`Forge did not answer ${request.method ?? "GET"} ${request.path}: `
      + `${onClock(ranOut(dropped, deadline), deadline)}${row.writes ? `\n${AMBIGUOUS}` : ""}`)];
    if (!response.ok) {
      const body = parsedOr(text);
      return [part, refused(said(body, response.status, args),
        { status: response.status, ...(body?.details ? { details: body.details } : {}) })];
    }
    const body = text ? parsedOr(text) : null;
    /* Refused rather than projected: an empty page built out of a gateway's HTML would read as the
       tracker saying the row is not there. `parsedOr` answers `null` both for that and for a body
       that is genuinely the four bytes `null` — a route allowed to say so (`forge_release_batch.active`,
       answering that no batch is running) — so the text itself, and not what it parsed to, is what
       tells the two apart. */
    if (text && text.trim() !== "null" && (typeof body !== "object" || body === null)) {
      return [part, refused(`${request.method ?? "GET"} ${request.path} answered 200 with no record: `
        + `${text.slice(0, 200)}`)];
    }
    return [part, { body }];
  }));
  return parts;
};

/* What a write's answer says beside the row, and why it is read here rather than out of what a row
   projects: docs/cli/what-a-write-says.md. */
const sentence = (one) => {
  if (one === null || one === undefined) return "";
  return typeof one === "string" ? one : one.message ?? JSON.stringify(one);
};

const warningsIn = (body) => {
  const held = body?.warnings;
  return (Array.isArray(held) ? held : [held]).map(sentence).filter((one) => one.trim() !== "");
};

/* Marked on every line of it, blank lines apart: an unmarked sentence stating a rule and a route
   out is a refusal to whoever reads it, whichever line of the account it sits on. That makes the
   line the unit a statement is judged by, which is why one is also what gets withheld below: an
   account carrying an answered rule beside something to act on must lose the first and keep the
   second. What it is not the unit of is the count, an account wrapped over two lines being one
   thing the tracker said. */
const MARK = "warning from the tracker";

const linesIn = (said) => said.split(/\r?\n/u).filter((line) => line.trim() !== "");

const marked = (line) => `  ${MARK} — ${line}`;

/* Said under a line saying the write stood, and never as `${key}: …`, which is the shape every
   refusal this module writes opens in: the one action a reader takes on a refusal is to send the
   write again, and a comment sent twice is a duplicate the tracker has no delete for (ISS-2070).
   What that line may claim is the row and no more — the tracker attaches an account like this to a
   call it declined a part of as well, so a reader told the whole call went through stops before the
   part that says otherwise — and what the line tells them not to repeat is the row and never the
   call, a declined half being exactly the thing that may have to be asked for again. */
const sayDeclined = async (key, bodies) => {
  const carried = bodies.flatMap((body) => unfencedIn(warningsIn(body)));
  if (!carried.length) return;
  /* Loaded here and not at the head of the file: the table is a leaf of the guides tree, and a
     transport every verb imports pays for it on the calls that carry a warning rather than on all
     of them. */
  const { warningAnswered } = await import("../guides/guides.mjs");
  /* A rule this copy has already read and replaced is not said at all, by the same judgement
     `forge guide` makes about the page that warning quotes: a sentence holding on every correct use
     of a verb teaches a reader to skip the line the next one arrives on, and each call here is its
     own process, so there is no once for it to be said. Withheld a line at a time and never a whole
     account: an account joining that rule to something the caller has to act on would otherwise take
     the second down with the first. */
  const said = carried.map((one) => linesIn(one).filter((line) => !warningAnswered(line)))
    .filter((lines) => lines.length);
  if (!said.length) return;
  console.error(`The write was not refused. ${key} stored its row, and the tracker attached `
    + `${said.length === 1 ? "one warning" : `${said.length} warnings`} to the call; do not send `
    + "that row again, and read below for whatever part of the call it did not do.");
  for (const line of said.flat().map(marked)) console.error(line);
};

/** The bodies a read row's own routes answered, before any projection reads them. The one caller is
 *  the name join, which has to see what the wire carried and not what a shaper kept of it; a write
 *  is refused, nothing being diagnosed by sending one. */
export const wireBodies = async (name, args = {}, held = {}) => {
  const key = keyOf(name, args);
  const row = ROUTES[key];
  if (!row) return { refused: noRouteRefusal(key) };
  if (row.writes) return { refused: `${key} writes, and no shape is read off a write` };
  const parts = await fetchedParts(key, row, args, true, held);
  const bad = parts.find(([, one]) => one.refused);
  return bad ? { refused: bad[1].refused } : { parts: Object.fromEntries(parts.map(([part, one]) => [part, one.body])) };
};

export const callTool = async (name, args, soft = false, held = {}) => {
  const key = keyOf(name, args);
  const row = ROUTES[key];
  const stop = refusing(soft);
  if (!row) return stop(noRouteRefusal(key));
  const dropped = undeclaredIn(row, args);
  if (dropped.length) return stop(droppedRefusal(key, dropped, row));
  const parts = await fetchedParts(key, row, args, soft, held);
  /* The tracker's words with nothing in front: a caller reading the first line frames it itself. */
  const bad = parts.find(([, held]) => held.refused);
  if (bad) {
    const { refused: message, ...answer } = bad[1];
    return stop(message, answer);
  }
  if (row.writes) await sayDeclined(key, parts.map(([, held]) => held.body));
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

/* A listing still in flight, shared by every caller asking the same way while it is: the settled id
   is the cache's, so only callers who arrive before it lands would otherwise each send their own —
   which is what several reads started together, as `forge doctor` starts them, all do. */
const listing = new Map();

const projectsListed = (archived, soft, held) => {
  const args = archived ? { archived: 1 } : {};
  if (Object.keys(held).length) return callTool("forge_projects.list", args, soft, held);
  const asked = `${archived}|${soft}`;
  if (!listing.has(asked)) {
    listing.set(asked, callTool("forge_projects.list", args, soft).finally(() => listing.delete(asked)));
  }
  return listing.get(asked);
};

/** One slug's id, off the cache or off the list — the archived too where asked, since the one verb that unarchives has to find its subject; a slug nothing matches answers with what was seen, and the caller words the refusal. The lookup is itself a call, which is why `soft` reaches it: `fail()` inside one exits past the caller that was holding the refusal. */
export const projectIdOf = async (slug, { archived = false, soft = false, ...held } = {}) => {
  const known = stored().projects?.[slug];
  if (known) return { id: known };
  const listed = await projectsListed(archived, soft, held);
  if (listed?.refused) return listed;
  const projects = listed?.projects ?? (Array.isArray(listed) ? listed : []);
  const found = projects.find((project) => project.slug === slug || project.key === slug);
  if (!found) return { seen: projects.map((one) => one.slug) };
  writeCache({ projects: { ...(stored().projects ?? {}), [slug]: found.id } });
  return { id: found.id };
};

const idOfProject = async (soft, given = {}) => {
  const aimed = projectTarget().value;
  if (!aimed && soft) return { refused: "no project slug is set" };
  const slug = aimed ?? projectSlug();
  const held = await projectIdOf(slug, { soft, ...given });
  if (held.id || held.refused) return held;
  return refusing(soft)(`No Forge project has slug ${slug}. Seen: ${held.seen}`);
};

export const projectId = async () => (await idOfProject(false)).id;

export const scoped = callTool;

export const tried = async (name, args) => callTool(name, args, true);

/* Where the table's unwrap lives, re-exported so a verb reading a set and the transport name one module. */
export { declaredFor };

/** A value judged against what the table declares: the nearest name, or null where the value is in the set or the table declares none. */
export const declaredValue = (tool, field, given) => nearestOutside(field, given, declaredFor(tool, field));

/** The whole of what this CLI reads a date as, and below it the judge a date slot spends because no declared set can hold every date. It is exported so this judge and whatever narrows rows against a caller's date ask one question: a second reading would disagree on some word and be the one nobody ran (ISS-1081). */
export const readsAsDate = (given) => !Number.isNaN(Date.parse(given));

export const refuseUnreadableDate = (verb, flag, given) => {
  if (given === undefined || readsAsDate(given)) return;
  fail(`${verb} --${flag}: ${given} is no date this CLI can read. One it does: 2026-01-01, or `
    + "2026-01-01T00:00:00+07:00 where the hour matters. Nothing was sent: the reading is this "
    + "CLI's own, so a word it cannot read is answered here rather than by narrowing every row "
    + "against it, which answers the same for all of them.");
};

/** What a status name is, off the row that declares it: `step` a rung of this plugin's own flow, `replacedBy` the rung that took a retired name over, `writtenByNobody` the clause saying whose path enters it and no run's. Two more place a status off the ladder for a reader asking how far work got: `past` the rung only a run beyond it reaches this status from, `landsNothing` a status the work ended at without landing. A row carrying none of the step, retired and nobody's three is readable, written by a park or a set, and no step. Null for a name the table does not declare, which `declaredValue` is what refuses. */
export const statusKind = (name) =>
  DECLARES.forge_issues.status.find((one) => one.name === name) ?? null;

const saidStored = new Set();

/* One seat rather than a list of the payload kinds that may carry a secret, which goes stale the
   next time a verb learns to write. `uploadAll` holds the other: bytes never pass here.
   `stored` is the record the payload was built from, matched by leaf path, and `ref` the issue it is:
   a string that record already holds is re-sent rather than supplied, so it goes and is said once. */
export const refuseCredential = async (value, what, { stored = null, ref = null, id = null } = {}) => {
  if (!value) return;
  const held = await import("./project-config.mjs");
  const deploy = await held.stagingDeploy();
  /* A reading that did not answer stops the write: there is no delete for what the tracker has taken, and a held write costs a retry — docs/cli/one-transport.md (ISS-487). */
  if (deploy?.refused) fail(held.unreadRefusal(deploy.refused, what));
  const { leak, copies } = held.credentialSplit(value, deploy, stored);
  if (leak) fail(held.leakRefusal(leak, what));
  if (!stored) return;
  for (const hit of copies) {
    /* Keyed by the issue and not by how the caller named it, a key and a uuid being one issue. */
    const key = JSON.stringify([id ?? ref, hit.field, hit.credential]);
    if (!saidStored.has(key)) console.error(held.storedCopyLine(hit, ref ?? "this issue"));
    saidStored.add(key);
  }
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

const announced = new Set();

export const write = async (name, args, onSent, soft = false, { stored = null, ref = null } = {}) => {
  await refuseCredential(args.data, `The payload ${name} was about to send`, { stored, ref, id: args.documentId ?? null });
  const { target, own } = wroteFor(name, args);
  const language = own ? translateTarget() : {};
  /* The source in a reader's words: the project file is `forge doctor`'s to name, and dropping the source took with it the line saying the CLI itself re-aimed this write (ISS-700) — which is now the only sort of case that says it at all, and says it once for the command rather than once for each send the transport happened to make: docs/cli/what-a-write-says.md (ISS-1192). */
  const from = target.from === fromProject() ? "the project file" : target.from ?? "nowhere";
  const usual = own && target.from === fromProject() && !language.value;
  const said = `project ${target.value ?? "(none)"} (from ${from}), prose ${language.value ?? "as written"}`;
  if (!usual && !announced.has(said)) {
    console.error(`${name} -> ${said}`);
    announced.add(said);
  }
  const data = own && args.data ? translated(args.data) : args.data ?? null;
  onSent?.(data);
  return scoped(name, data ? { ...args, data } : args, soft);
};

/* `doctor` drops it, because a credential change can change which project ids resolve. */
export const forgetProjects = () => writeCache({ projects: {} });
