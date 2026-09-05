/* How Claude Code calls a gate. Unwrapping the answer stays each suite's: `deny()` and `block()` do
   not answer alike, and the git rules need a tree with work to lose. */
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const callHook = (hook, event, env = process.env) =>
  spawnSync(process.execPath, [hook], { input: JSON.stringify(event), encoding: "utf8", env });

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

const DECLARED = ["forge_issues", "forge_comments", "forge_projects.list", "forge_uploads",
  "forge_projects.get", "forge_config", "forge_memory.search", "forge_knowledge"];
/* `scoped` reads the schema to know whether to send the project id, so a tool declared with no
   properties is one a verb calls unscoped — which is a real call the tracker would refuse. Both of
   these declare one, so the id lookup runs, and the listing that answers it is served below from
   this repository's own slug rather than left for every suite to stub. */
const TAKES_PROJECT = ["forge_projects.get", "forge_config", "forge_memory.search", "forge_knowledge"];
/* Deliberately not the tracker's own sets, field names included: a verb reading them off the schema
   at the call accepts `fixture-only` and refuses `guide`, which one holding a copy does the reverse
   of. So the fixture is what proves there is no copy. */
export const FIXTURE_ENUMS = {
  kind: ["reference", "rule", "fixture-only"],
  injection: ["always", "none"],
  confidence: ["verified", "inferred"],
};
export const FIXTURE_FIELDS = ["plan", "sessionContext", "fixture-only"];
const OWN = { id: "1e1c1a1e-0000-4000-8000-0000000000ff" };
const ownSlug = () =>
  JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", ".forge.json"), "utf8")).slug;
/* The browse order and the rank refusal read this; `scoped` keys on `projectId` alone. */
const RANKS = ["critical", "high", "medium", "low", "none"];
const declaration = (name) => ({
  name,
  inputSchema: {
    properties: {
      ...(TAKES_PROJECT.includes(name) ? { projectId: { type: "string" } } : {}),
      ...(name === "forge_issues"
        ? { data: { properties: { priority: { enum: RANKS } } }, fields: { items: { enum: FIXTURE_FIELDS } } }
        : {}),
      ...(name === "forge_knowledge"
        ? Object.fromEntries(Object.entries(FIXTURE_ENUMS).map(([field, values]) => [field, { enum: values }]))
        : {}),
    },
  },
});

/** The tracker's `list` as it actually answers, for a case about paging: rows in the order they were
 *  last touched, cut to what FITS rather than to the limit, `createdBefore` exclusive and
 *  `createdAfter` inclusive. A `touched` out of step with `createdAt` drops a row off page one. */
export const pageOf = (rows, fits) => (args) => {
  const before = args.filters?.createdBefore ? Date.parse(args.filters.createdBefore) : Infinity;
  const after = args.filters?.createdAfter ? Date.parse(args.filters.createdAfter) : -Infinity;
  const matched = rows
    .filter((one) => Date.parse(one.createdAt) < before && Date.parse(one.createdAt) >= after)
    .sort((one, other) => other.touched - one.touched);
  const page = matched.slice(0, fits);
  const short = page.length < matched.length;
  return {
    issues: page,
    returned: page.length,
    limit: args.limit,
    hasMore: short,
    ...(short
      ? {
        truncated: true,
        truncatedBy: "response-size",
        notice: `More rows match than were returned: the response-size cap cut this to the ${page.length}`
          + " most recent of them. A higher limit will NOT help — add status/priority/category/label"
          + " filters instead.",
      }
      : {}),
  };
};

/** The other cap, which the byte one hides: the caller's own `limit` bound the page, so raising it
 *  is what helps and the tracker says so. `truncatedBy` is the only thing telling the two apart. */
export const boundByLimit = (rows) => (args) => {
  const page = rows.slice(0, args.limit);
  const short = page.length < rows.length;
  return {
    issues: page,
    returned: page.length,
    limit: args.limit,
    hasMore: short,
    ...(short
      ? {
        truncated: true,
        truncatedBy: "limit",
        notice: `More rows match than were returned: your limit of ${args.limit} bound this to the`
          + ` ${page.length} most recent. Raise limit or add status/priority/category/label filters to`
          + " see the rest.",
      }
      : {}),
  };
};

/** A tracker a verb can be spawned against, answering out of `state` at request time so a case that
 *  changes the state changes the answer. `state.calls` collects every call for a case to assert on;
 *  a handler in `state.answer` keyed by tool takes precedence over the defaults below. */
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

export const fakeTracker = async (state) => {
  const body = (request) =>
    new Promise((done) => {
      let text = "";
      request.on("data", (chunk) => {
        text += chunk;
      });
      request.on("end", () => done(JSON.parse(text)));
    });
  /* `state.hidden` is what lies past the page the list returns: a search reaches it, a listing
     does not, which is the seam a duplicate check with no cursor has to answer for. */
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
  const served = createServer(async (request, response) => {
    if (state.status) {
      response.writeHead(state.status, { "Content-Type": "text/plain" });
      response.end("no");
      return;
    }
    const call = await body(request);
    const name = call.params?.name;
    const args = call.params?.arguments ?? {};
    (state.calls ??= []).push({ name, args, slug: request.headers["x-forge-project-slug"] });
    /* Extended, never replaced: one suite's tool is not every suite's declared surface. */
    let result = { tools: [...DECLARED, ...(state.declared ?? [])].map(declaration) };
    const own = (state.answer ?? {})[name];
    /* A handler answering `{ refused }` is the tool's own refusal, which the transport reads from
       `isError` and no structured content: the shape a verb's way out is reached by. */
    if (own) {
      const answered = own(args);
      /* `{ http: n }` is the transport failing rather than the tool refusing: only one catchable. */
      if (answered?.http) {
        response.writeHead(answered.http, { "Content-Type": "text/plain" });
        response.end("gateway");
        return;
      }
      result = answered?.refused
        ? { isError: true, content: [{ type: "text", text: answered.refused }] }
        : { structuredContent: answered };
    }
    else if (name === "forge_memory.search") result = { structuredContent: { hits: memory(args) } };
    else if (name === "forge_issues") result = { structuredContent: issues(args) };
    else if (name === "forge_comments") result = { structuredContent: comments(args) };
    else if (name === "forge_projects.list") {
      result = { structuredContent: { projects: [{ ...OWN, slug: ownSlug() }] } };
    }
    else if (name) result = { structuredContent: {} };
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ jsonrpc: "2.0", id: call.id ?? 1, result }));
  });
  await new Promise((ready) => served.listen(0, "127.0.0.1", ready));
  const home = tempHome("tracker");
  mkdirSync(join(home.path, "forge"), { recursive: true });
  const url = `http://127.0.0.1:${served.address().port}/mcp`;
  writeFileSync(join(home.path, "forge", "config.json"), JSON.stringify({ url, token: "t" }));
  return { url, env: { ...process.env, XDG_CONFIG_HOME: home.path }, close: () => served.close(),
    unref: () => served.unref() };
};
