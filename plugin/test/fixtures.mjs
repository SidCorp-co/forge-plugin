/* Unwrapping the answer stays each suite's: `deny()` and `block()` do not answer alike, and the git rules need a tree with work to lose. */
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { checkoutAt } from "../src/git/checkout-at.mjs";
import { OWN as OWN_KEYS } from "./fixtures/own-keys.mjs";
import { reachOf } from "./fixtures/answer-reach.mjs";
import { answeringThrows, body } from "./fixtures/served.mjs";
import { madeIn } from "../../tools/room.mjs";
import { PLAN_SECTIONS } from "../src/flow/machine.mjs";

const PLAN_BODY = {
  Declarations: "Screen change: no\nSchema coupling: no\nDeploy coupling: no",
  "Witnessed on screen": "none — nothing this change moves is a thing a person could look at.",
  Steps: "1. The one step — criteria 1, 2",
};

/** A typed plan, built off the table so it cannot drift: every section but the way back, the
 *  three required declarations, one step citing two criteria. `null` drops a section, a string replaces its body. */
export const typedPlan = (over = {}) => {
  const held = { ...PLAN_BODY, ...over };
  return PLAN_SECTIONS
    .filter((one) => held[one.name] !== null)
    .filter((one) => one.name !== "The way back" || held[one.name] !== undefined)
    .map((one) => `## ${one.name}\n\n${held[one.name] ?? `What ${one.asks}.`}`)
    .join("\n\n");
};

export const flat = (text) => text.replace(/\s+/gu, " ");

export { escaped } from "../src/markdown.mjs";

/* The same problem where the path reaches a shell rather than a `RegExp`: a bare `(` is syntax, so a case spells the word the product's own quoter spells (ISS-1543). */
export { pathed, typed } from "../src/hooks/shell-spans.mjs";

export const jsonlOf = (rows) => Buffer.from(rows.map((one) => `${JSON.stringify(one)}\n`).join(""));

export { answered, callHook, callHookAsync } from "./fixtures/answered.mjs";

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

/* Thousands of these have filled the mount a shell needed (ISS-42, ISS-125), on a tmpfs out of inodes while gigabytes are free.
   So a suite's rooms go inside one root this process removes on its way out, the pid in its name because Ctrl-C runs no handler:
   a root whose process is gone is swept by the next to ask for one, and one this fixture never named is nobody's — so the flag
   renames rather than only spares, a kept root's pid being dead at once. Made at import because `TMPDIR` points at it below and
   a gate stamps under `tmpdir()` per call, so a suite leaving that alone fills the room every hook reaps; `MACHINE` is first. */
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

const KEPT = process.env.KEEP_TEST_ROOMS === "1";
const PREFIX = join(MACHINE, `forge-plugin-test-${KEPT ? "kept-" : ""}${process.pid}-`);
const root = madeIn(PREFIX, () => mkdtempSync(PREFIX));
if (KEPT) process.stderr.write(`keeping this test process's room: ${root}\n`);
else process.on("exit", () => rmSync(root, { recursive: true, force: true }));
sweep();

process.env.TMPDIR = root;

export const tempRoom = (prefix) => madeIn(join(root, prefix), () => mkdtempSync(join(root, prefix)));

/* A case about which run a call is controls the tree it stands in as it controls the config home: a
   suite run from a worktree naming its own run resolves that id, where a case written about the
   inherited one wants a tree naming none (ISS-467).

   The room is a checkout of its own, and a fresh `git init` names no run. It carried a committed
   project file until ISS-1403, on the reasoning that leaving the checkout then moved nothing else;
   that stopped being true when the project's configuration stopped being a file a directory could
   carry, and a room in no checkout resolves no project at all — so a case standing
   in one had every project-scoped call refused for want of a slug rather than answering about the
   run. Where the case needs keys as well as a checkout, `projectRecord(at, home, keys)` writes
   them. */
export const standsInNoTree = (name) => {
  const at = tempRoom(`${name}-no-tree-`);
  spawnSync("git", ["init", "-q", at], { cwd: at, encoding: "utf8" });
  process.chdir(at);
  return at;
};

/** Where this machine's record of the project a room belongs to is kept, which is the path every
 *  report names after its arrow. Keyed on the room's REPOSITORY's root folder, exactly as the
 *  resolver keys it, so a linked worktree and the checkout it was added from compose one path — and
 *  so a case pinning a source pins a path its own home resolves to and not a shape. A room no
 *  checkout holds has no project at all, which is a case's mistake rather than an empty answer. */
export const projectEntry = (room, home) => {
  const repository = checkoutAt(room)?.repository;
  if (!repository) throw new Error(`${room} belongs to no checkout, so it has no project record`);
  return join(home, "forge", "projects", basename(repository), "config.json");
};

/** This machine's record of the project a room ALREADY belongs to, written where the resolver reads
 *  it, under the configuration home the case runs against. Returns the entry. */
export const projectRecord = (room, home, config) => {
  const entry = projectEntry(room, home);
  mkdirSync(dirname(entry), { recursive: true });
  writeFileSync(entry, `${JSON.stringify(config, null, 2)}\n`);
  return entry;
};

/** A room that is a checkout, holding this machine's record of its project: `git init` gives a bare
 *  room a repository for the entry to be keyed on, and the record follows. Returns the room. A room
 *  that is already a checkout — this repository, or a worktree of it — takes `projectRecord`. */
export const projectRoom = (room, home, config) => {
  spawnSync("git", ["init", "-q", room], { cwd: room, encoding: "utf8" });
  projectRecord(room, home, config);
  return room;
};

export const tempHome = (name) => {
  const path = tempRoom(`${name}-home-`);
  return { path, remove: () => rmSync(path, { recursive: true, force: true }) };
};

export const homeEnv = (name) => {
  const room = tempRoom(`${name}-home-`);
  return { ...process.env, HOME: room, XDG_CONFIG_HOME: room };
};

export const git = (room, ...args) =>
  spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...args],
    { cwd: room, encoding: "utf8" });

export const dirtyRepo = () => {
  const room = tempRoom("dirty-repo-");
  spawnSync("git", ["init", "-q", room], { cwd: room, encoding: "utf8" });
  writeFileSync(join(room, "tracked.txt"), "committed\n");
  git(room, "add", "tracked.txt");
  git(room, "commit", "-qm", "base");
  writeFileSync(join(room, "tracked.txt"), "changed, and never committed\n");
  return room;
};

/** A repository with nothing to lose, which is where every git rule in bash-guard stands down. */
export const cleanRepo = () => {
  const room = tempRoom("clean-repo-");
  spawnSync("git", ["init", "-q", room], { cwd: room, encoding: "utf8" });
  return room;
};

const OWN = { id: "1e1c1a1e-0000-4000-8000-0000000000ff" };

/* Every column `GET /projects/:id` answers, and the three documents it answers under `agentConfig`
   rather than beside them. Both sets are the wire's own, not this fixture's idea of it. */
const PROJECT_COLUMNS = ["id", "slug", "name", "description", "orgId", "createdBy", "role", "orgRole",
  "repoPath", "repoUrl", "workspaceSetup", "baseBranch", "liveBranch", "releaseModel",
  "releaseStrategy", "defaultDeviceId", "environments", "issuePrefix", "labels", "members",
  "devicePool", "createdAt", "archivedAt"];

const NESTED = ["agentConfig", "pipelineConfig", "projectFacts", "plugins"];
/* The project travels as an id in a path now, so a case asking which project a call went to reads
   the slug back through the one listing the fixture serves. */
const SLUGS = new Map();
/* The same declaration a case writes into a record, so the slug this fixture serves and the slug
   that record carries cannot differ. */
const ownSlug = () => OWN_KEYS.slug;
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

/* The keys a handler fails with, read off its answer and never off a route's: a route that pages,
   projects or defaults that answer drops them, and its 200 reads as a tracker holding nothing (ISS-618). */
const FAILURE = ["refused", "http", "notARecord"];
const failed = (held) => FAILURE.some((key) => held?.[key]);

/* Declared JSON with nothing under it, which only the merge handler was measured refusing: every other route serves that shape, knowledge's own DELETE answering `deleted` with the header or without, so a fake refusing it everywhere would be a red for a request the tracker takes (ISS-729). */
const emptyJson = ({ method, headers }) => (method === "POST" || method === "DELETE")
  && String(headers["content-type"] ?? "").startsWith("application/json")
  && !headers["transfer-encoding"] && Number(headers["content-length"] ?? 0) === 0;

/** A tracker a verb can be spawned against, answering out of `state` at request time so a case that
 *  changes the state changes the answer; a handler in `state.answer` keyed by tool wins over the
 *  defaults, and `state.calls` collects every call for a case to assert on. */
export const fakeTracker = async (state) => {
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
  /* A created comment answers with the author the `forge_comments.create` route projects, as the tracker's does: a reader telling a person's comment from an agent's keys on that field. */
  const comments = (args) => {
    if (args.action !== "list") {
      return { documentId: "comment-uuid", authorDeviceId: state.device ?? "a-fake-device", ...(args.data ?? {}) };
    }
    const held = (state.comments ?? {})[args.filters?.issue] ?? [];
    /* `state.cut` names the issues whose thread reports more behind it and no cursor to it: a walk that cannot finish, which is the read a gate still holds a verb's write for. */
    return { comments: held, returned: held.length, hasMore: (state.cut ?? []).includes(args.filters?.issue) };
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
  const askedOn = new WeakMap();
  const noted = (name, args) => {
    (state.calls ??= []).push({ ...pending, name, args });
    if (pending) {
      pending.stood = true;
      askedOn.set(pending, name);
    }
  };

  const reach = reachOf(state);
  let refusal = null;
  /* A handler a test registered wins over the built-in one, exactly as it did on the other
     transport: the key is the tool's name, and never a route. */
  const answered = (name, args) => {
    noted(name, args);
    const held = builtIn(name, args);
    if (name === "forge_projects.list") {
      for (const one of held.projects ?? []) SLUGS.set(one.id, one.slug);
    }
    if (!refusal && failed(held)) refusal = held;
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
    reach.asked(name);
    const own = (state.answer ?? {})[name];
    const said = own ? own(args) : undefined;
    if (said !== undefined) return said;
    if (name === "forge_config" && SETTINGS[args.action]) return settings(SETTINGS[args.action], args);
    if (name === "forge_memory.search") return { hits: memory(args) };
    if (name === "forge_issues") return issues(args);
    if (name === "forge_comments") return comments(args);
    if (name === "forge_projects.list") return { projects: [{ ...OWN, slug: ownSlug() }] };
    return {};
  };

  /* The row the tracker serves, and every column of it: null where a case named no value, the three
     nested documents under `agentConfig` and at no top level, and whatever else a case put on the row
     beside them. A stub answering thirteen fewer columns than the wire does is a row no reader of it
     can tell a retired column from, which is the thing `plugin/src/tracker/declared/name-join.mjs` reports on
     and the thing it found here first (ISS-1970). The set is the wire's, read off the capture at
     `plugin/test/fixtures/rest/projects-get.json`; a column the tracker grows is one line here. */
  const projectRow = (held) => {
    const given = { ...OWN, slug: ownSlug(), ...(held.project ?? {}), ...(held.config ?? {}) };
    return {
      ...Object.fromEntries(PROJECT_COLUMNS.map((name) =>
        [name, Object.hasOwn(given, name) ? given[name] : null])),
      ...Object.fromEntries(Object.entries(given)
        .filter(([name]) => !NESTED.includes(name) && !PROJECT_COLUMNS.includes(name))),
      agentConfig: Object.fromEntries(NESTED
        .filter((name) => held.config?.[name] !== undefined)
        .map((name) => [name, held.config[name]])
        .concat(Object.entries(held.config?.agentConfig ?? {}))),
    };
  };

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
    [/^\/api\/projects\/([^/]+)\/issues$/u, (q, sent, method, [project]) => {
      if (method === "POST") return asRow(answered("forge_issues", { action: "create", project, data: sent }));
      /* Omitted where the query narrowed on nothing, exactly as the caller omits it: a handler
         asking whether a page was filtered may not be told it always was. */
      const narrowed = filtersFrom(q);
      const held = answered("forge_issues",
        { action: "list", project, ...(Object.keys(narrowed).length ? { filters: narrowed } : {}) });
      return windowOn(q, held, q.get("sort"));
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
      const counted = Object.hasOwn(held ?? {}, "total") ? { total: held.total } : {};
      const walking = Object.hasOwn(held ?? {}, "nextCursor") ? { nextCursor: held.nextCursor } : {};
      return { ...asPage(rows, 0, rows.length, says), ...counted, ...walking };
    }],
    [/^\/api\/issues\/([^/]+)\/transition$/u, (q, sent, method, [id]) => {
      const { toStatus, ...rest } = sent;
      return asRow(answered("forge_issues",
        { action: "transition", documentId: id, data: { status: toStatus, ...rest } }));
    }],
    [/^\/api\/issues\/([^/]+)\/merge$/u, (q, sent, method, [id]) =>
      answered("forge_issues", { action: method === "DELETE" ? "unmark" : "mark_merged", data: { issueId: id, ...sent } })],
    /* `expect` comes off the body and stands beside it, as the route composes it: a precondition on the write and not a field, so a case counting what an update wrote counts fields and one about the precondition reads it by name. */
    [/^\/api\/issues\/([^/]+)$/u, (q, sent, method, [id]) => {
      const { expect, ...data } = sent;
      return asRow(answered("forge_issues", method === "PATCH"
        ? { action: "update", documentId: id, data, ...(expect ? { expect } : {}) }
        : { action: "get", documentId: id }));
    }],
    [/^\/api\/projects\/[^/]+\/knowledge\/([^/]+)$/u, (q, sent, method, [slug]) =>
      answered("forge_knowledge", { action: method === "PUT" ? "upsert" : method === "DELETE" ? "delete" : "get", slug, ...sent })],
    [/^\/api\/projects\/[^/]+\/knowledge$/u, (q) =>
      answered("forge_knowledge", { action: "list", kindFilter: q.get("kind") ?? undefined, injectionFilter: q.get("injection") ?? undefined })],
    [/^\/api\/memory\/search$/u, (q, sent) => answered("forge_memory.search", sent)],
    [/^\/api\/guides\/([^/]+)$/u, (q, sent, method, [slug]) => answered("forge_guide", { action: "get", slug })],
    [/^\/api\/guides$/u, () => answered("forge_guide", { action: "list" })],
    [/^\/api\/projects\/[^/]+\/pm\/([a-z-]+)$/u, (q, sent, method, [what]) =>
      answered("forge_project_pm", { action: what === "runner-load" ? "runner_load" : what })],
    /* The tracker's binding of the deployment platform to this project. One row per shape the CLI
       may send: the listing at the root, and one action segment under it either way round. */
    [/^\/api\/projects\/[^/]+\/integrations\/coolify\/([a-z-]+)$/u, (q, sent, method, [what]) =>
      answered("forge_coolify", { action: what, ...Object.fromEntries(q), ...sent })],
    [/^\/api\/projects\/[^/]+\/integrations\/coolify$/u, () =>
      answered("forge_coolify", { action: "list" })],
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
      const config = answered("forge_config", { action: "get" });
      const detail = state.answer?.["forge_projects.get"] ? answered("forge_projects.get", {}) : {};
      return projectRow({ ...config, ...detail });
    }],
    [/^\/api\/projects$/u, (q, sent, method) => (method === "POST"
      ? answered("forge_projects.create", { data: sent })
      : rowsFrom(answered("forge_projects.list",
        { ...(q.get("archived") ? { archived: q.get("archived") } : {}) }), "projects")
        .map((one) => ({ ...one })))],
  ];

  const serve = async (request, response, mine) => {
    response.sendDate = state.noDate !== true && !state.dateOffset;
    if (state.dateOffset) response.setHeader("Date", new Date(Date.now() + state.dateOffset).toUTCString());
    for (const [name, held] of Object.entries(state.budget ?? {})) response.setHeader(name, String(held));
    if (state.status) {
      response.writeHead(state.status, { "Content-Type": "text/plain" });
      response.end("no");
      return;
    }
    const url = new URL(request.url, "http://x");
    reach.serving(`${request.method} ${url.pathname}`);
    /* A fixture answering inside one tick tells a caller that waits for each answer apart from one
       that does not by nothing at all. `state.hold` holds every answer open for that many
       milliseconds and writes down when each request opened and when it was let go, which is the
       pair a case about calls in flight together compares. */
    if (state.hold) {
      const opened = Date.now();
      await new Promise((go) => setTimeout(go, state.hold));
      (state.holds ??= []).push({ path: url.pathname, opened, answered: Date.now() });
    }
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
    mine.call = pending;
    const row = ROUTES.find(([pattern]) => pattern.test(url.pathname));
    if (!row) {
      (state.calls ??= []).push(pending);
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ code: "NOT_FOUND", message: `Not Found: ${request.method} ${url.pathname}` }));
      return;
    }
    const [, ...caught] = row[0].exec(url.pathname);
    refusal = null;
    const built = row[1](url.searchParams, sent, request.method, caught);
    if (!pending.stood) (state.calls ??= []).push(pending);
    const answer = refusal ?? built;
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
  };
  const served = createServer(answeringThrows(serve, (call) => askedOn.get(call)));
  await new Promise((ready) => served.listen(0, "127.0.0.1", ready));
  const home = tempHome("tracker");
  mkdirSync(join(home.path, "forge"), { recursive: true });
  const url = `http://127.0.0.1:${served.address().port}/mcp`;
  writeFileSync(join(home.path, "forge", "config.json"), JSON.stringify({ url, token: "t", retrySeconds: 0 }));
  const close = () => {
    served.close();
    const said = reach.unreached();
    if (said) throw new Error(said);
  };
  return { url, routes: ROUTES.map(([pattern]) => pattern.source),
    env: { ...process.env, XDG_CONFIG_HOME: home.path }, close,
    unref: () => served.unref() };
};

const rowsFrom = (payload, key = "issues") =>
  payload?.[key] ?? payload?.data ?? (Array.isArray(payload) ? payload : []);

const FILTERS = ["status", "priority", "category"];

const filtersFrom = (query) =>
  Object.fromEntries(FILTERS.map((name) => [name, query.get(name) ?? undefined])
    .filter(([, value]) => value !== undefined));
