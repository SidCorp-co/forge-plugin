/* How Claude Code calls a gate. Unwrapping the answer stays each suite's: `deny()` and `block()` do
   not answer alike, and the git rules need a tree with work to lose. */
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PLAN_SECTIONS } from "../src/flow/machine.mjs";

const PLAN_BODY = {
  Declarations: "Screen change: no\nSchema coupling: no",
  Steps: "1. The one step — criteria 1, 2",
};

/** A typed plan, built off the table so it cannot drift: every section but the way back, both
 *  declarations, one step citing two criteria. `null` drops a section, a string replaces its body. */
export const typedPlan = (over = {}) => {
  const held = { ...PLAN_BODY, ...over };
  return PLAN_SECTIONS
    .filter((one) => held[one.name] !== null)
    .filter((one) => one.name !== "The way back" || held[one.name] !== undefined)
    .map((one) => `## ${one.name}\n\n${held[one.name] ?? `What ${one.asks}.`}`)
    .join("\n\n");
};

/* `cwd` is the project the hook stands in, a different question from the event's `cwd`: the settings resolver walks up from the process, so a case varying a `.forge.json` key sets this. */
export const callHook = (hook, event, env = process.env, cwd = process.cwd()) =>
  spawnSync(process.execPath, [hook], { input: JSON.stringify(event), encoding: "utf8", env, cwd });

/* A child awaited rather than waited on: anything that asks a server the test itself is running
   deadlocks under `spawnSync`, which holds the loop that would answer it. */
export const ranAsync = (command, argv, env = process.env, cwd = process.cwd(), stdin = null) =>
  new Promise((done) => {
    const child = spawn(command, argv, { env, cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => done({ stdout, stderr, status }));
    child.stdin.end(stdin ?? undefined);
  });

export const callHookAsync = (hook, event, env = process.env) =>
  new Promise((done) => {
    const child = spawn(process.execPath, [hook], { env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => done({ stdout, stderr, status }));
    child.stdin.end(JSON.stringify(event));
  });

/* Thousands of these have filled the mount a shell needed (ISS-42, ISS-125), on a tmpfs out of
   inodes while gigabytes are free. So a suite's rooms go inside one root this process removes on its
   way out, the pid in its name because Ctrl-C runs no handler: a root whose process is gone is swept
   by the next to ask for one, and one this fixture never named is nobody's. It is made at import
   because `TMPDIR` points at it below and a gate stamps under `tmpdir()` per call, so a suite
   leaving that alone fills the room every hook reaps; `MACHINE` is therefore read before then. */
const OWNED = /^forge-plugin-test-(\d+)-/u;
const MACHINE = tmpdir();

const gone = (pid) => {
  try {
    process.kill(pid, 0);
    return false;
  } catch (refused) {
    return refused.code === "ESRCH";
  }
};

const sweep = () => {
  for (const name of readdirSync(MACHINE)) {
    const owner = OWNED.exec(name);
    if (!owner || Number(owner[1]) === process.pid || !gone(Number(owner[1]))) continue;
    try {
      rmSync(join(MACHINE, name), { recursive: true, force: true });
    } catch {
      /* Another process sweeping the same root, or one that is not this user's to remove. */
    }
  }
};

const root = mkdtempSync(join(MACHINE, `forge-plugin-test-${process.pid}-`));
process.on("exit", () => rmSync(root, { recursive: true, force: true }));
sweep();

process.env.TMPDIR = root;

export const tempRoom = (prefix) => mkdtempSync(join(root, prefix));

export const tempHome = (name) => {
  const path = tempRoom(`${name}-home-`);
  return { path, remove: () => rmSync(path, { recursive: true, force: true }) };
};

export const homeEnv = (name) => ({
  ...process.env,
  XDG_CONFIG_HOME: tempRoom(`${name}-home-`),
});

const git = (room, ...args) =>
  spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...args], { encoding: "utf8" });

export const dirtyRepo = () => {
  const room = tempRoom("dirty-repo-");
  spawnSync("git", ["init", "-q", room], { encoding: "utf8" });
  writeFileSync(join(room, "tracked.txt"), "committed\n");
  git(room, "add", "tracked.txt");
  git(room, "commit", "-qm", "base");
  writeFileSync(join(room, "tracked.txt"), "changed, and never committed\n");
  return room;
};

/** A repository with nothing to lose, which is where every git rule in bash-guard stands down. */
export const cleanRepo = () => {
  const room = tempRoom("clean-repo-");
  spawnSync("git", ["init", "-q", room], { encoding: "utf8" });
  return room;
};

const OWN = { id: "1e1c1a1e-0000-4000-8000-0000000000ff" };
/* The project travels as an id in a path now, so a case asking which project a call went to reads
   the slug back through the one listing the fixture serves. */
const SLUGS = new Map();
const ownSlug = () =>
  JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", ".forge.json"), "utf8")).slug;
/** The route pages by offset, so a fixture page is a size rather than a window: the rows come back
 *  whole and `fits` is how many of them one request serves, binding below whatever a caller asked. */
export const pageOf = (rows, fits) => (args) => {
  const wanted = String(args.filters?.search ?? "").toLowerCase();
  const matched = rows.filter((one) => !wanted || JSON.stringify(one).toLowerCase().includes(wanted));
  return { issues: matched, returned: matched.length, hasMore: false, fits };
};

/** A route that counts more rows than it will serve: the walk pages to the end of what it hands
 *  over and `hasMore` is still true, which is the one reading that comes back short. */
export const shortPage = (rows, beyond) => () =>
  ({ issues: rows, returned: rows.length, hasMore: false, beyond });

/** The caller's own `limit` bound the page, which the route honours exactly: one cap, not two. */
export const boundByLimit = (rows) => () =>
  ({ issues: rows, returned: rows.length, hasMore: false });

/* The knowledge store as probed on 2026-09-04: `upsert` writes the row it was handed and nothing
   of the row it replaces, `get` refuses an absent slug, `delete` says whether there was one. Two
   suites answer with it — the store's own verb and the project verb's brief — so the tracker's
   replace-not-merge behaviour is declared once. */
export const fakeStore = () => {
  const store = new Map();
  const entry = (slug, held) => ({
    id: `k-${slug}`,
    slug,
    kind: held.kind ?? "guide",
    title: held.title ?? "",
    body: held.body ?? "",
    injection: held.injection ?? "on_demand",
    confidence: held.confidence ?? "inferred",
    authoredBy: "agent",
    metadata: held.metadata ?? {},
    updatedAt: "2026-09-04T21:00:00.000Z",
  });
  const knowledge = (args) => {
    if (args.action === "list") {
      const rows = [...store.values()]
        .filter((one) => !args.kindFilter || one.kind === args.kindFilter)
        .filter((one) => !args.injectionFilter || one.injection === args.injectionFilter);
      return { rows, returned: rows.length, total: rows.length, truncated: false };
    }
    if (args.action === "get") {
      return store.get(args.slug) ?? { refused: "Error: knowledge entry not found" };
    }
    if (args.action === "upsert") {
      if (!args.title) return { refused: "Error: title is required for action=upsert" };
      store.set(args.slug, entry(args.slug, args));
      return { id: `k-${args.slug}`, slug: args.slug, degraded: false };
    }
    if (args.action === "delete") return { deleted: store.delete(args.slug) };
    const hits = [...store.values()].map((one) => ({ ...one, score: 0.5, origin: "knowledge" }));
    return { knowledge: hits, memory: [] };
  };
  return { store, knowledge };
};

/* The tool-shaped answer a handler wrote, turned back into the envelope the route it stands for
   would have sent. Tests author what the tool answers; the CLI reads what the route serves, and
   this is the one place the two meet. */
const OFF_THE_ROW = new Set(["documentId", "issueId", "relations", "attachments"]);
const asRow = (issue) => ({
  id: issue?.documentId,
  displayId: issue?.issueId,
  ...Object.fromEntries(Object.entries(issue ?? {}).filter(([name]) => !OFF_THE_ROW.has(name))),
});

const asComment = (comment) => {
  const { documentId, ...rest } = comment ?? {};
  return { id: documentId, ...rest };
};

/* The arguments the tool took, so a handler keyed by tool reads the shape it always read. */
const uploadAsk = (target, targetId, sent) =>
  ({ action: "request", data: { target, targetId, name: sent.multipart?.name ?? null } });

/* The inverse of the attachment projection, so a handler answering the tool's own shape needs no
   rewriting: what it leaves out is filled from the part that arrived. */
const asAttachment = (held, part = {}) => {
  const id = held?.id ?? "attachment-uuid";
  return {
    id,
    name: held?.name ?? part.name ?? null,
    mime: held?.mime ?? part.mime ?? null,
    size: held?.size ?? part.bytes?.length ?? 0,
    createdAt: held?.createdAt ?? "2026-09-07T00:00:00.000Z",
    url: held?.url ?? `/api/attachments/${id}/download`,
    ...(held?.refused ? { refused: held.refused, code: held.code } : {}),
  };
};

const seqOf = (row) => Number(String(row?.displayId ?? "").replace(/\D+/gu, "")) || 0;

/* The route the key lookup searches is the set oldest first, so the fixture orders by the number in
   the key, which is what rises with a row's age on the tracker it stands for. */
const ordered = (rows, sort) =>
  (sort === "createdAt:asc" ? [...rows].sort((one, two) => seqOf(one) - seqOf(two)) : rows);

const asPage = (rows, offset, limit, hasMore) => ({
  items: rows,
  returned: rows.length,
  total: rows.length + offset,
  limit,
  offset,
  hasMore,
});

/* An edge authored in the shape a reader sees, sent back in the shape the route serves: the tests
   above name relations, and the projection is what turns one into the other. */
const sided = (edge, side) => ({
  id: edge.edgeId, kind: edge.kind, fromIssueId: edge.fromIssueId, toIssueId: edge.toIssueId,
  [`${side}DisplayId`]: edge.otherDisplayId,
  [`${side}Status`]: edge.otherStatus,
  [`${side}MergedAt`]: edge.otherMergedAt,
  validUntil: edge.validUntil ?? null,
  ...(edge.gatesDispatch === undefined ? {} : { gatesDispatch: edge.gatesDispatch }),
});

const edgesOf = (issue) => ({
  outgoing: (issue?.relations?.blocks ?? []).map((edge) => sided(edge, "to")),
  incoming: (issue?.relations?.blockedBy ?? []).map((edge) => sided(edge, "from")),
});

/* Which resource each configuration action reads or merges: two routes, two keys, one answer. */
const SETTINGS = {
  pipeline: "pipelineConfig",
  set_pipeline: "pipelineConfig",
  facts: "projectFacts",
  set_facts: "projectFacts",
};

const MERGE_ROUTE = /^\/api\/issues\/[^/]+\/merge$/u;

/* Declared JSON with nothing under it, which only the merge handler was measured refusing: every other route serves that shape, knowledge's own DELETE answering `deleted` with the header or without, so a fake refusing it everywhere would be a red for a request the tracker takes (ISS-729). */
const emptyJson = ({ method, headers }) => (method === "POST" || method === "DELETE")
  && String(headers["content-type"] ?? "").startsWith("application/json")
  && !headers["transfer-encoding"] && Number(headers["content-length"] ?? 0) === 0;

/** A tracker a verb can be spawned against, answering out of `state` at request time so a case that
 *  changes the state changes the answer; a handler in `state.answer` keyed by tool wins over the
 *  defaults, and `state.calls` collects every call for a case to assert on. */
export const fakeTracker = async (state) => {
  const raw = (request) =>
    new Promise((done) => {
      const chunks = [];
      request.on("data", (chunk) => chunks.push(chunk));
      request.on("end", () => done(Buffer.concat(chunks)));
    });
  /* The one part an upload sends, read off the wire rather than off the caller's intent: the name
     and the type the tracker judges are the part's own, so a case can assert on what arrived. */
  const parted = (held, boundary) => {
    const text = held.toString("latin1");
    const open = text.indexOf(`--${boundary}\r\n`) + boundary.length + 4;
    const head = text.slice(open, text.indexOf("\r\n\r\n", open));
    const bytes = held.subarray(text.indexOf("\r\n\r\n", open) + 4, text.lastIndexOf(`\r\n--${boundary}--`));
    return {
      field: /name="([^"]*)"/u.exec(head)?.[1] ?? null,
      name: /filename="([^"]*)"/u.exec(head)?.[1] ?? null,
      mime: /content-type:\s*(\S+)/iu.exec(head)?.[1] ?? null,
      bytes,
    };
  };
  const body = async (request) => {
    const held = await raw(request);
    const boundary = /boundary=([^;]+)/u.exec(request.headers["content-type"] ?? "")?.[1];
    if (boundary) return { multipart: parted(held, boundary) };
    const text = held.toString("utf8");
    return text ? JSON.parse(text) : {};
  };
  /* `state.hidden` is what the list route does not carry and the search route, a different index,
     reaches: the seam a duplicate check answers for. A reading the walk cannot finish is `shortPage`
     and nothing else, since a route that counts what it will not serve is the only shape with one. */
  const listed = (filters = {}) => {
    const wanted = String(filters.search ?? "").toLowerCase();
    const pool = wanted ? [...(state.issues ?? []), ...(state.hidden ?? [])] : (state.issues ?? []);
    const rows = pool.filter((one) => !wanted || JSON.stringify(one).toLowerCase().includes(wanted));
    return { issues: rows, returned: rows.length, hasMore: false };
  };
  const issues = (args) => {
    if (args.action === "list") return listed(args.filters);
    if (args.action === "get") return (state.issues ?? []).find((one) => one.documentId === args.documentId) ?? {};
    if (args.action === "create") return { documentId: state.mint ?? "filed-uuid", ...(state.key ? { issueId: state.key } : {}), ...args.data };
    return { documentId: args.documentId, ...(args.data ?? {}) };
  };
  const comments = (args) => {
    if (args.action !== "list") return { documentId: "comment-uuid", ...(args.data ?? {}) };
    const held = (state.comments ?? {})[args.filters?.issue] ?? [];
    return { comments: held, returned: held.length, hasMore: false };
  };
  /* `state.memory` is `[issue, score]` per strategy; the uuid a hit carries is resolved here. */
  const memory = ({ strategy }) =>
    ((state.memory ?? {})[strategy] ?? []).map(([key, score]) => ({
      source: "issue",
      sourceRef: [...(state.issues ?? []), ...(state.hidden ?? [])]
        .find((one) => one.issueId === key)?.documentId ?? key,
      text: `${key} as it was embedded`,
      score,
      stale: false,
    }));

  /* One row per call, carrying both the route it went to and the tool and action it stood for, so a
     test asserting on either reads the same list; a route two tools answer on writes two. The route
     is held rather than written and revised, because `run-fixtures.mjs` records to a file. */
  let pending = null;
  const noted = (name, args) => {
    (state.calls ??= []).push({ ...pending, name, args });
    if (pending) pending.stood = true;
  };

  /* A handler a test registered wins over the built-in one, exactly as it did on the other
     transport: the key is the tool's name, and never a route. */
  const answered = (name, args) => {
    noted(name, args);
    const held = builtIn(name, args);
    if (name === "forge_projects.list") {
      for (const one of held.projects ?? []) SLUGS.set(one.id, one.slug);
    }
    return held;
  };

  /* Merged per key, as the tracker's own PATCH is. `state.stripped` models a key its schema does not
     declare: the write is taken and the key is not there after, the only signal a caller gets. */
  const settings = (which, args) => {
    const held = (state.settings ??= {
      pipelineConfig: { ...(state.config?.pipelineConfig ?? {}) },
      projectFacts: { ...(state.config?.projectFacts ?? {}) },
    });
    const patch = which === "projectFacts" ? (args.data?.projectFacts ?? {}) : (args.data ?? {});
    for (const [key, value] of Object.entries(patch)) {
      if (!(state.stripped ?? []).includes(key)) held[which][key] = value;
    }
    return which === "projectFacts"
      ? { projectFacts: held.projectFacts, projectFactsConfig: state.factsConfig ?? {} }
      : { pipelineConfig: held.pipelineConfig };
  };
  const builtIn = (name, args) => {
    const own = (state.answer ?? {})[name];
    if (own) return own(args);
    if (name === "forge_config" && SETTINGS[args.action]) return settings(SETTINGS[args.action], args);
    if (name === "forge_memory.search") return { hits: memory(args) };
    if (name === "forge_issues") return issues(args);
    if (name === "forge_comments") return comments(args);
    if (name === "forge_projects.list") return { projects: [{ ...OWN, slug: ownSlug() }] };
    return {};
  };

  const projectRow = (held) => ({
    ...OWN,
    slug: ownSlug(),
    ...(held.project ?? {}),
    ...(held.config ?? {}),
    agentConfig: {
      ...(held.config?.agentConfig ?? {}),
      ...(held.config?.pipelineConfig ? { pipelineConfig: held.config.pipelineConfig } : {}),
      ...(held.config?.projectFacts ? { projectFacts: held.config.projectFacts } : {}),
      ...(held.config?.plugins ? { plugins: held.config.plugins } : {}),
    },
  });

  /* One page of a handler's whole answer, by the offset and limit the caller sent: `fits` binds
     below whatever was asked for, and `beyond` is a count the route reports and will not serve. */
  const windowOn = (q, held, sort) => {
    const rows = ordered(rowsFrom(held).map(asRow), sort);
    const offset = Number(q.get("offset") ?? 0);
    const limit = Math.min(Number(q.get("limit") ?? 200), held.fits ?? state.page ?? Infinity);
    const page = rows.slice(offset, offset + limit);
    const counted = rows.length + (held.beyond ?? 0);
    return { items: page, returned: page.length, total: counted, limit, offset,
      hasMore: offset + page.length < counted };
  };

  /* One row per route the CLI may call: the pattern it matches, and the envelope its tool-shaped
     answer becomes. `parts` names what a route serves out of a body the handler answered whole. */
  const ROUTES = [
    [/^\/api\/projects\/[^/]+\/issues\/search$/u, (q) =>
      windowOn(q, answered("forge_issues", { action: "list", filters: { search: q.get("q") } }))],
    [/^\/api\/projects\/[^/]+\/issues$/u, (q, sent, method) => {
      if (method === "POST") return asRow(answered("forge_issues", { action: "create", data: sent }));
      /* Omitted where the query narrowed on nothing, exactly as the caller omits it: a handler
         asking whether a page was filtered may not be told it always was. */
      const narrowed = filtersFrom(q);
      return windowOn(q, answered("forge_issues",
        { action: "list", ...(Object.keys(narrowed).length ? { filters: narrowed } : {}) }), q.get("sort"));
    }],
    [/^\/api\/issues\/([^/]+)\/dependencies\/([^/]+)$/u, (q, sent, method, [id, edgeId]) =>
      answered("forge_issues", { action: "unlink_edge", documentId: id, edgeId })],
    [/^\/api\/issues\/([^/]+)\/dependencies$/u, (q, sent, method, [id]) => (method === "POST"
      ? answered("forge_issues", { action: "link", documentId: id, data: sent })
      : edgesOf(answered("forge_issues", { action: "get", documentId: id })))],
    [/^\/api\/issues\/([^/]+)\/attachments$/u, (q, sent, method, [id]) => {
      if (method !== "POST") return answered("forge_issues", { action: "get", documentId: id })?.attachments ?? [];
      return asAttachment(answered("forge_uploads", uploadAsk("issue", id, sent)), sent.multipart);
    }],
    [/^\/api\/comments\/([^/]+)\/attachments$/u, (q, sent, method, [id]) =>
      asAttachment(answered("forge_uploads", uploadAsk("comment", id, sent)), sent.multipart)],
    [/^\/api\/issues\/([^/]+)\/comments$/u, (q, sent, method, [id]) => {
      if (method === "POST") return asComment(answered("forge_comments", { action: "create", data: { issue: id, ...sent } }));
      const held = answered("forge_comments", { action: "list", filters: { issue: id } });
      const rows = (held.comments ?? []).map(asComment);
      /* Neither coerced nor derived: `hasMore: null` is an envelope saying nothing of its own
         completeness, and a `total` above the rows sent is one no reader may take off those rows. */
      const says = Object.hasOwn(held ?? {}, "hasMore") ? held.hasMore : false;
      const failing = held.refused || held.notARecord;
      const counted = Object.hasOwn(held ?? {}, "total") ? { total: held.total } : {};
      return { ...asPage(rows, 0, rows.length, says), ...counted, ...(failing ? held : {}) };
    }],
    [/^\/api\/issues\/([^/]+)\/transition$/u, (q, sent, method, [id]) => {
      const { toStatus, ...rest } = sent;
      return asRow(answered("forge_issues",
        { action: "transition", documentId: id, data: { status: toStatus, ...rest } }));
    }],
    [/^\/api\/issues\/([^/]+)\/merge$/u, (q, sent, method, [id]) =>
      answered("forge_issues", { action: method === "DELETE" ? "unmark" : "mark_merged", data: { issueId: id, ...sent } })],
    [/^\/api\/issues\/([^/]+)$/u, (q, sent, method, [id]) =>
      asRow(answered("forge_issues", method === "PATCH"
        ? { action: "update", documentId: id, data: sent }
        : { action: "get", documentId: id }))],
    [/^\/api\/projects\/[^/]+\/knowledge\/([^/]+)$/u, (q, sent, method, [slug]) =>
      answered("forge_knowledge", { action: method === "PUT" ? "upsert" : method === "DELETE" ? "delete" : "get", slug, ...sent })],
    [/^\/api\/projects\/[^/]+\/knowledge$/u, (q) =>
      answered("forge_knowledge", { action: "list", kindFilter: q.get("kind") ?? undefined, injectionFilter: q.get("injection") ?? undefined })],
    [/^\/api\/memory\/search$/u, (q, sent) => answered("forge_memory.search", sent)],
    [/^\/api\/guides\/([^/]+)$/u, (q, sent, method, [slug]) => answered("forge_guide", { action: "get", slug })],
    [/^\/api\/guides$/u, () => answered("forge_guide", { action: "list" })],
    [/^\/api\/projects\/[^/]+\/pm\/([a-z-]+)$/u, (q, sent, method, [what]) =>
      answered("forge_project_pm", { action: what === "runner-load" ? "runner_load" : what })],
    [/^\/api\/projects\/[^/]+\/pipeline-config$/u, (q, sent, method) => answered("forge_config",
      method === "PATCH" ? { action: "set_pipeline", data: sent } : { action: "pipeline" })],
    [/^\/api\/projects\/[^/]+\/project-facts$/u, (q, sent, method) => answered("forge_config",
      method === "PATCH" ? { action: "set_facts", data: sent } : { action: "facts" })],
    [/^\/api\/projects\/([^/]+)\/(archive|unarchive)$/u, (q, sent, method, [id, act]) =>
      answered(`forge_projects.${act}`, { projectRef: id })],
    /* One route, two readers: a case answering a project the caller NAMED registers
       `forge_projects.read`; without one the route answers the row the checkout's slug resolves to. */
    [/^\/api\/projects\/([^/]+)$/u, (q, sent, method, [id]) => {
      if (method === "PATCH") return answered("forge_projects.update", { projectRef: id, data: sent });
      if (state.answer?.["forge_projects.read"]) return answered("forge_projects.read", { projectRef: id });
      return projectRow({
        ...answered("forge_config", { action: "get" }),
        ...(state.answer?.["forge_projects.get"] ? answered("forge_projects.get", {}) : {}),
      });
    }],
    [/^\/api\/projects$/u, (q, sent, method) => (method === "POST"
      ? answered("forge_projects.create", { data: sent })
      : rowsFrom(answered("forge_projects.list",
        { ...(q.get("archived") ? { archived: q.get("archived") } : {}) }), "projects")
        .map((one) => ({ ...one })))],
  ];

  const served = createServer(async (request, response) => {
    if (state.status) {
      response.writeHead(state.status, { "Content-Type": "text/plain" });
      response.end("no");
      return;
    }
    const url = new URL(request.url, "http://x");
    if (MERGE_ROUTE.test(url.pathname) && emptyJson(request)) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ code: "BAD_REQUEST", message: "Malformed JSON in request body" }));
      return;
    }
    const sent = request.method === "GET" ? {} : await body(request);
    pending = {
      path: url.pathname,
      method: request.method,
      query: Object.fromEntries(url.searchParams),
      sent,
      slug: SLUGS.get(url.pathname.split("/")[3]) ?? null,
    };
    const row = ROUTES.find(([pattern]) => pattern.test(url.pathname));
    if (!row) {
      (state.calls ??= []).push(pending);
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ code: "NOT_FOUND", message: `Not Found: ${request.method} ${url.pathname}` }));
      return;
    }
    const [, ...caught] = row[0].exec(url.pathname);
    const answer = row[1](url.searchParams, sent, request.method, caught);
    if (!pending.stood) (state.calls ??= []).push(pending);
    if (answer?.refused) {
      response.writeHead(400, { "Content-Type": "application/json" });
      /* The tracker's own code where a handler names one: what an upload's refusal is read by. */
      response.end(JSON.stringify({ code: answer.code ?? "BAD_REQUEST", message: answer.refused }));
      return;
    }
    if (answer?.http) {
      response.writeHead(answer.http, { "Content-Type": "text/plain" });
      response.end("gateway");
      return;
    }
    /* A 200 whose body is not a record: what a proxy in front of the tracker answers with. */
    if (answer?.notARecord) {
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end(answer.notARecord);
      return;
    }
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(answer ?? {}));
  });
  await new Promise((ready) => served.listen(0, "127.0.0.1", ready));
  const home = tempHome("tracker");
  mkdirSync(join(home.path, "forge"), { recursive: true });
  const url = `http://127.0.0.1:${served.address().port}/mcp`;
  writeFileSync(join(home.path, "forge", "config.json"), JSON.stringify({ url, token: "t", retrySeconds: 0 }));
  return { url, env: { ...process.env, XDG_CONFIG_HOME: home.path }, close: () => served.close(),
    unref: () => served.unref() };
};

const rowsFrom = (payload, key = "issues") =>
  payload?.[key] ?? payload?.data ?? (Array.isArray(payload) ? payload : []);

const FILTERS = ["status", "priority", "category"];

const filtersFrom = (query) =>
  Object.fromEntries(FILTERS.map((name) => [name, query.get(name) ?? undefined])
    .filter(([, value]) => value !== undefined));
