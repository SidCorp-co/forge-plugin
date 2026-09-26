/* One declared table: the route each tool action takes, and which shaper in answers/projections.mjs
   its answer goes through. Pure — it builds requests and reads bodies and makes none, which is what
   lets the captured pairs under plugin/test/fixtures/rest judge it. docs/cli/one-transport.md. */

import { UPLOAD_MIMES, mimeForName } from "../wire/upload-mimes.mjs";
import { PROJECT_ROW, attachmentOf, attributedOf, browseOf, citingOf, commentOf, configOf, eventsOf,
  filled, issueOf, labelOf, paged, pick, projectOf, rowsIn, threadOf, writtenRow } from "./answers/projections.mjs";

const PAGE = ({ page }) => page;

/** Read through here, never off the row: a default only the transport sees is one no capture can. */
export const answersOf = (row) => row?.answers ?? PAGE;

/* Every filter the browse verb takes, by what applies it: the list route narrows on `wire`, `route`
   is served by a route of its own, and the walk applies `here` to the rows it is holding. */
const FILTERS = {
  search: "route",
  status: "wire",
  priority: "wire",
  category: "wire",
  statusNot: "here",
  complexity: "here",
  createdAfter: "here",
  createdBefore: "here",
  updatedAfter: "here",
};

/* Strict: a target outside this map builds no path, and its one caller refuses one before asking. */
const COLLECTIONS = { issue: "issues", comment: "comments" };

/* Only what the route serves is declared, as the values the route takes — or, where a value carries
   more than its own name, as rows that answer with one. A name on neither list is refused rather
   than ignored. The reader that spends a row beside its name is `statusKind` in `rest.mjs`. */
export const DECLARES = {
  forge_issues: {
    filters: Object.keys(FILTERS),
    priority: ["critical", "high", "medium", "low", "none"],
    status: [
      { name: "open", step: true },
      { name: "confirmed", step: true },
      { name: "clarified", replacedBy: "approved" },
      { name: "waiting" },
      { name: "approved", step: true },
      { name: "in_progress", step: true },
      { name: "developed", step: true },
      { name: "testing", step: true },
      { name: "tested", replacedBy: "awaiting_release" },
      { name: "awaiting_release", step: true },
      { name: "releasing", writtenByNobody: "the release path's own status: the release button "
        + "enters it and the release batch alone leaves it" },
      { name: "closed", step: true },
      { name: "reopen" },
      { name: "on_hold" },
      { name: "needs_info" },
      { name: "draft" },
      { name: "dropped" },
    ],
    caps: {
      title: { self: 500, halves: {} },
      description: { self: 100000, halves: {} },
      category: { self: 100, halves: {} },
      detectorKey: { self: 120, halves: {} },
      acceptanceCriteria: { self: 100000, halves: {} },
      plan: { self: 200000, halves: {} },
      releaseNotes: { self: null, halves: { section: null, userFacing: 500, technical: 500 } },
      note: { self: 2000, halves: {} },
      taskTitle: { self: 500, halves: {} },
      taskDescription: { self: 50000, halves: {} },
      reason: { self: 10000, halves: {} },
    },
  },
  /* The body's cap, as the tracker's refusal of a longer one prints it: a record measured against it
     before its evidence goes up is refused while nothing it sends can be taken back (ISS-489). */
  forge_comments: {
    caps: {
      body: { self: 10000, halves: {} },
    },
  },
  forge_knowledge: {
    kind: ["overview", "scenario", "workflow", "rule", "guide", "reference", "glossary"],
    injection: ["always", "on_demand", "none"],
    confidence: ["verified", "inferred", "deprecated"],
    authoredBy: ["human", "agent", "imported"],
  },
  /* The names this CLI can type, which is the map's own key set: the tracker allows types and not
     names, so a name missing here may go up under one that is in it (ISS-134). */
  forge_uploads: {
    extensions: Object.keys(UPLOAD_MIMES),
    targets: Object.keys(COLLECTIONS),
  },
};

const WIRE_FILTERS = Object.keys(FILTERS).filter((name) => FILTERS[name] === "wire");

const query = (pairs) => {
  const held = new URLSearchParams();
  for (const [key, value] of Object.entries(pairs)) {
    if (value !== undefined && value !== null && value !== "") held.set(key, String(value));
  }
  const text = held.toString();
  return text ? `?${text}` : "";
};

/* The order the tool answered in, and a verb printing a page prints what it put there. */
const ORDER = "updatedAt:desc";

const listQuery = (args) => query({
  q: args.filters?.search,
  limit: args.limit,
  offset: args.offset,
  sort: ORDER,
  ...Object.fromEntries(WIRE_FILTERS.map((name) => [name, args.filters?.[name]])),
});

/* The search route with each row's module attributions — the list route refuses `withModules` — and
   a set of statuses repeated rather than joined, which is how the route takes one. */
const attributedQuery = (args) => {
  const held = new URLSearchParams({ withModules: "true", sort: ORDER });
  for (const status of args.statuses ?? []) held.append("status", status);
  for (const status of args.statusNot ?? []) held.append("statusNot", status);
  return `?${held.toString()}${query({ module: args.module, limit: args.limit, offset: args.offset }).replace("?", "&")}`;
};

/* Two routes, one query: the search route narrows on the same columns, and a search that dropped
   them printed closed rows as a whole answer to `--status open` (codex F2). */
const issueList = (args, project) => {
  const where = args.filters?.search ? "issues/search" : "issues";
  return { page: { path: `/projects/${project}/${where}${listQuery(args)}` } };
};

const one = (path, method = "GET", body) => ({ page: filled({ path, method, body }) });

/* Which separate requests ride with the row, never a projection of it: the row comes back whole, so a
   list naming neither asks for the row alone and a name outside these two narrows nothing (ISS-588). */
export const ISSUE_PARTS = ["relations", "attachments"];

export const partsAmong = (names) => (names ?? []).filter((name) => ISSUE_PARTS.includes(name));

const asked = (args, name) => !args.fields || args.fields.includes(name);

/* Every row: which requests it makes, what its answer is, and whether it may be sent twice. A row
   with more than one request names them, and the caller makes them together. */
export const ROUTES = {
  "forge_issues.list": {
    project: true,
    requests: issueList,
    answers: ({ page }) => paged(page, "issues", rowsIn(page, "items").map(browseOf)),
    sends: ["limit", "offset", "filters"],
  },
  /* One wire route, two actions: a projection chosen at the call is one no capture can pin. */
  "forge_issues.citing": {
    project: true,
    requests: issueList,
    answers: ({ page }) => paged(page, "issues", rowsIn(page, "items").map(citingOf)),
    sends: ["limit", "offset", "filters"],
  },
  "forge_issues.at": {
    project: true,
    requests: (args, project) => ({
      page: { path: `/projects/${project}/issues${query({ limit: 1, offset: args.offset, sort: "createdAt:asc" })}` },
    }),
    answers: ({ page }) => ({
      row: rowsIn(page, "items").map(browseOf)[0] ?? null,
      total: Number(page?.total ?? 0),
    }),
    sends: ["offset"],
  },
  "forge_issues.get": {
    requests: (args) => filled({
      issue: { path: `/issues/${args.documentId}` },
      dependencies: asked(args, "relations") ? { path: `/issues/${args.documentId}/dependencies` } : undefined,
      attachments: asked(args, "attachments") ? { path: `/issues/${args.documentId}/attachments` } : undefined,
    }),
    answers: issueOf,
    sends: ["documentId", "fields"],
    honours: { fields: ISSUE_PARTS },
  },
  "forge_issues.create": {
    project: true,
    writes: true,
    requests: (args, project) => one(`/projects/${project}/issues`, "POST", args.data),
    answers: writtenRow,
    sends: ["data"],
  },
  /* `expect` rides beside `data` and never inside it: it is a precondition on the write and not a field of the issue, and one folded into the body would be read back as a field by everything that lists what an update wrote. */
  "forge_issues.update": {
    writes: true,
    requests: (args) => one(`/issues/${args.documentId}`, "PATCH",
      args.expect ? { ...args.data, expect: args.expect } : args.data),
    answers: writtenRow,
    sends: ["documentId", "data", "expect"],
  },
  "forge_issues.transition": {
    writes: true,
    requests: (args) => one(`/issues/${args.documentId}/transition`, "POST",
      { toStatus: args.data?.status, ...filled({ ...args.data, status: undefined }) }),
    answers: writtenRow,
    sends: ["documentId", "data"],
  },
  "forge_issues.mark_merged": {
    writes: true,
    requests: (args) => one(`/issues/${args.data?.issueId}/merge`, "POST",
      filled({ target: args.data?.target, mergedAt: args.data?.mergedAt, note: args.data?.note })),
    sends: ["data"],
  },
  "forge_issues.unmark": {
    writes: true,
    requests: (args) => one(`/issues/${args.data?.issueId}/merge`, "DELETE", filled({ note: args.data?.note })),
    sends: ["data"],
  },
  /* The edge store, on the issue's own route: `documentId` is the issue that DEPENDS and
     `data.dependsOnId` the one it depends on, so the edge lands as `(from = dependsOnId, to =
     documentId)` and reads back on `documentId` as `blockedBy`. */
  "forge_issues.link": {
    writes: true,
    requests: (args) => one(`/issues/${args.documentId}/dependencies`, "POST", args.data),
    sends: ["documentId", "data"],
  },
  "forge_issues.unlink_edge": {
    writes: true,
    requests: (args) => one(`/issues/${args.documentId}/dependencies/${args.edgeId}`, "DELETE"),
    sends: ["documentId", "edgeId"],
  },
  /* The status history, a project's and one issue's, newest first: `before` is the cursor the answer's
     `nextBefore` hands back, and an update event's payload carries the whole field it wrote, so an
     event travels as the names a reader of a transition wants and nothing more. */
  "forge_issues.activity": {
    project: true,
    requests: (args, project) => one(`/projects/${project}/activity${query({ type: "issue", limit: args.limit, before: args.before })}`),
    answers: eventsOf,
    sends: ["limit", "before"],
  },
  "forge_issues.issue_activity": {
    requests: (args) => one(`/issues/${args.documentId}/activity${query({ limit: args.limit, before: args.before })}`),
    answers: eventsOf,
    sends: ["documentId", "limit", "before"],
  },
  "forge_issues.attributed": {
    project: true,
    requests: (args, project) => one(`/projects/${project}/issues/search${attributedQuery(args)}`),
    answers: ({ page }) => paged(page, "issues", rowsIn(page, "items").map(attributedOf)),
    sends: ["limit", "offset", "statuses", "statusNot", "module"],
  },
  /* The project's labels, a module being one kind; the delete is refused while an issue carries it. */
  "forge_labels.list": {
    project: true,
    requests: (args, project) => one(`/projects/${project}/labels`),
    answers: ({ page }) => ({ labels: rowsIn(page, "items").map(labelOf) }),
    sends: [],
  },
  "forge_labels.create": {
    project: true,
    writes: true,
    requests: (args, project) => one(`/projects/${project}/labels`, "POST", args.data),
    answers: ({ page }) => labelOf(page),
    sends: ["data"],
  },
  "forge_labels.update": {
    writes: true,
    requests: (args) => one(`/labels/${args.labelId}`, "PATCH", args.data),
    answers: ({ page }) => labelOf(page),
    sends: ["labelId", "data"],
  },
  "forge_labels.delete": {
    writes: true,
    requests: (args) => one(`/labels/${args.labelId}`, "DELETE"),
    sends: ["labelId"],
  },
  "forge_comments.list": {
    requests: (args) => one(`/issues/${args.filters?.issue}/comments${query({ cursor: args.filters?.cursor })}`),
    answers: ({ page }) => threadOf(page),
    sends: ["filters"],
  },
  "forge_comments.create": {
    writes: true,
    requests: (args) => one(`/issues/${args.data?.issue}/comments`, "POST",
      filled({ body: args.data?.body, parentId: args.data?.parentId })),
    answers: ({ page }) => commentOf(page),
    sends: ["data"],
  },
  "forge_knowledge.get": {
    project: true,
    requests: (args, project) => one(`/projects/${project}/knowledge/${args.slug}`),
    sends: ["slug"],
  },
  "forge_knowledge.list": {
    project: true,
    requests: (args, project) => one(`/projects/${project}/knowledge${query({ kind: args.kindFilter, injection: args.injectionFilter })}`),
    sends: ["kindFilter", "injectionFilter"],
  },
  "forge_knowledge.upsert": {
    project: true,
    writes: true,
    requests: (args, project) => one(`/projects/${project}/knowledge/${args.slug}`, "PUT",
      filled({ ...args, action: undefined, slug: undefined, projectId: undefined })),
    sends: ["slug", "title", "body", "kind", "injection", "confidence", "authoredBy", "metadata"],
  },
  "forge_knowledge.delete": {
    project: true,
    writes: true,
    requests: (args, project) => one(`/projects/${project}/knowledge/${args.slug}`, "DELETE"),
    sends: ["slug"],
  },
  /* The tracker's own binding of the deployment platform to this project, which is the scope: the
     path names the project and nothing here names a Coolify instance or reads a file this checkout
     carries. Six rows and no seventh — three actions that tool has are on no project-scoped route,
     and the rollback whose own listing read does not answer is refused before it reaches here. The
     two that act declare `writes`, so a transient answer is not sent again under them. */
  "forge_coolify.list": {
    project: true,
    requests: (args, project) => one(`/projects/${project}/integrations/coolify`),
    sends: [],
  },
  "forge_coolify.targets": {
    project: true,
    requests: (args, project) =>
      one(`/projects/${project}/integrations/coolify/targets${query({ integrationId: args.integrationId })}`),
    sends: ["integrationId"],
  },
  "forge_coolify.status": {
    project: true,
    requests: (args, project) =>
      one(`/projects/${project}/integrations/coolify/status${query({ integrationId: args.integrationId })}`),
    sends: ["integrationId"],
  },
  "forge_coolify.rollback_images": {
    project: true,
    requests: (args, project) => one(`/projects/${project}/integrations/coolify/rollback-images`
      + query({ integrationId: args.integrationId, resourceUuid: args.resourceUuid })),
    sends: ["integrationId", "resourceUuid"],
  },
  /* The body is the route's own strict object: a key it does not declare refuses the whole call at
     its end, so `filled` is what keeps an argument nobody gave out of it. */
  "forge_coolify.deploy": {
    project: true,
    writes: true,
    requests: (args, project) => one(`/projects/${project}/integrations/coolify/deploy`, "POST",
      filled({ issueId: args.issueId, pipelineRunId: args.pipelineRunId, integrationId: args.integrationId })),
    sends: ["issueId", "pipelineRunId", "integrationId"],
  },
  "forge_coolify.cancel": {
    project: true,
    writes: true,
    requests: (args, project) => one(`/projects/${project}/integrations/coolify/cancel`, "POST",
      filled({ integrationId: args.integrationId, deploymentUuid: args.deploymentUuid })),
    sends: ["integrationId", "deploymentUuid"],
  },
  "forge_memory.search": {
    project: true,
    requests: (args, project) => one(`/memory/search`, "POST", { ...args, projectId: project }),
    sends: ["query", "topK", "scope", "strategy", "sourceFilter"],
  },
  "forge_config.get": {
    project: true,
    requests: (args, project) => one(`/projects/${project}`),
    answers: ({ page }) => configOf(page),
    sends: [],
  },
  /* The two typed resources a project's own settings live in, rather than the whole-`agentConfig`
     patch on `/projects/:id`: that one replaces the document, so two writers to different keys of it
     clobber each other. These merge per key. */
  "forge_config.pipeline": {
    project: true,
    requests: (args, project) => one(`/projects/${project}/pipeline-config`),
    sends: [],
  },
  "forge_config.set_pipeline": {
    project: true,
    writes: true,
    requests: (args, project) => one(`/projects/${project}/pipeline-config`, "PATCH", args.data),
    sends: ["data"],
  },
  "forge_config.facts": {
    project: true,
    requests: (args, project) => one(`/projects/${project}/project-facts`),
    sends: [],
  },
  "forge_config.set_facts": {
    project: true,
    writes: true,
    requests: (args, project) => one(`/projects/${project}/project-facts`, "PATCH", args.data),
    sends: ["data"],
  },
  "forge_guide.list": {
    requests: () => one(`/guides`),
    sends: [],
  },
  "forge_guide.get": {
    requests: (args) => one(`/guides/${args.slug}`),
    sends: ["slug"],
  },
  /* The archived are excluded unless asked for, which is the tracker's default and not this CLI's:
     a project the caller wants to unarchive is one the plain list cannot name. */
  "forge_projects.list": {
    requests: (args) => one(`/projects${query({ archived: args.archived })}`),
    answers: ({ page }) => ({ projects: rowsIn(page, "items").map((row) => pick(row, PROJECT_ROW)) }),
    sends: ["archived"],
  },
  "forge_projects.get": {
    project: true,
    requests: (args, project) => one(`/projects/${project}`),
    answers: ({ page }) => ({ project: projectOf(page) }),
    sends: [],
  },
  /* `projectRef` and not `documentId`: a reference key is resolved as an issue key on a raw call, and
     a project id resolved as an issue answers about the wrong record. Nothing declares the tracker's
     own DELETE. `account` says the subject is the record, not the scope, so no prose language reaches it. */
  "forge_projects.create": {
    writes: true,
    account: true,
    requests: (args) => one(`/projects`, "POST", args.data),
    answers: ({ page }) => ({ project: projectOf(page) }),
    sends: ["data"],
  },
  "forge_projects.read": {
    requests: (args) => one(`/projects/${args.projectRef}`),
    answers: ({ page }) => ({ project: projectOf(page) }),
    sends: ["projectRef"],
  },
  "forge_projects.update": {
    writes: true,
    account: true,
    requests: (args) => one(`/projects/${args.projectRef}`, "PATCH", args.data),
    answers: ({ page }) => ({ project: projectOf(page) }),
    sends: ["projectRef", "data"],
  },
  "forge_projects.archive": {
    writes: true,
    account: true,
    requests: (args) => one(`/projects/${args.projectRef}/archive`, "POST"),
    answers: ({ page }) => ({ project: projectOf(page) }),
    sends: ["projectRef"],
  },
  "forge_projects.unarchive": {
    writes: true,
    account: true,
    requests: (args) => one(`/projects/${args.projectRef}/unarchive`, "POST"),
    answers: ({ page }) => ({ project: projectOf(page) }),
    sends: ["projectRef"],
  },
  "forge_project_pm.snapshot": {
    project: true,
    requests: (args, project) => one(`/projects/${project}/pm/snapshot`),
    sends: [],
  },
  "forge_project_pm.graph": {
    project: true,
    requests: (args, project) => one(`/projects/${project}/pm/graph${query({ issueId: args.issueId, depth: args.depth })}`),
    sends: ["issueId", "depth"],
  },
  "forge_project_pm.runner_load": {
    project: true,
    requests: (args, project) => one(`/projects/${project}/pm/runner-load`),
    answers: ({ page }) => ({ runners: rowsIn(page, "runners") }),
    sends: [],
  },
  "forge_uploads.request": {
    writes: true,
    /* Given a target, the route it takes; given none, which is `served()` printing the row, every
       route it may take. The bytes ride beside `data`, the credential seat reading `data` alone. */
    requests: (args) => {
      const part = (target) => ({
        path: `/${COLLECTIONS[target]}/${args.data?.targetId}/attachments`,
        method: "POST",
        form: { file: { name: args.data?.name, mime: mimeForName(args.data?.name), bytes: args.bytes } },
      });
      const aimed = args.data?.target;
      return aimed
        ? { page: part(aimed) }
        : Object.fromEntries(Object.keys(COLLECTIONS).map((one) => [one, part(one)]));
    },
    answers: ({ page }) => attachmentOf(page),
    sends: ["data", "bytes"],
  },
};

/* Wherever a route wants an issue uuid, a raw call may carry `ISS-45` and the caller resolves it. */
export const REFERENCE_KEYS = new Set([
  "documentId", "dependsOnId", "blocksId", "issue", "issueId", "fromIssueId", "toIssueId",
]);

/* A tool that carries its action in an argument, against one that spells it in its own name: the
   table's key is `<tool>.<action>` either way, and this says which half of it is the tool. */
const ACTION_ARG = new Set(["forge_issues", "forge_comments", "forge_knowledge", "forge_config",
  "forge_guide", "forge_project_pm", "forge_uploads", "forge_labels"]);

const toolOf = (key) => {
  const head = key.slice(0, key.lastIndexOf("."));
  return ACTION_ARG.has(head) ? head : key;
};

/* The path a row would build, read off the builder itself with the identifiers standing in for
   themselves: a template written out beside it would be a second copy of the same string. */
const SAMPLE = {
  documentId: ":documentId",
  projectRef: ":projectRef",
  edgeId: ":edgeId",
  labelId: ":labelId",
  slug: ":slug",
  offset: ":offset",
  filters: { issue: ":issue" },
  data: { issueId: ":issueId", issue: ":issue", targetId: ":targetId", name: ":name" },
};

export const served = () => Object.entries(ROUTES).map(([key, row]) => {
  const of = (request) => `${request.method ?? "GET"} ${decodeURIComponent(request.path)}`;
  const requests = Object.values(row.requests(SAMPLE, ":project")).map(of);
  return { key, tool: toolOf(key), requests, sends: row.sends ?? [] };
});

/* A tool naming its action in its own name carries none in its arguments — docs/cli/beside.md — and
   that reading is the table's key here rather than a retry decision. */
const DOTTED = /\.([a-z_]+)$/u;

export const keyOf = (name, args) => {
  if (ROUTES[name]) return name;
  const action = args?.action ?? DOTTED.exec(name ?? "")?.[1];
  return action ? `${name}.${action}` : name;
};

/** The pair such a key stands for, so a check keyed on the tool is given the tool (codex F1). */
export const asToolCall = (name, args) => {
  const held = String(name ?? "");
  const action = DOTTED.exec(held)?.[1];
  const tool = toolOf(held);
  return action && tool !== held ? { name: tool, args: { ...args, action } } : { name, args };
};

export const rowFor = (name, args) => ROUTES[keyOf(name, args)] ?? null;
