/* One declared table: the route each tool action takes, and how its answer becomes the shape every
   caller above it reads. Pure — it builds requests and reads bodies and makes none, which is what
   lets the captured pairs under plugin/test/fixtures/rest judge it. docs/cli/one-transport.md. */

const pick = (row, names) =>
  Object.fromEntries(names.map((name) => [name, Object.hasOwn(row ?? {}, name) ? row[name] : null]));

const rowsIn = (payload, key) => payload?.[key] ?? (Array.isArray(payload) ? payload : []);

const filled = (held) => Object.fromEntries(Object.entries(held).filter(([, value]) => value !== undefined));

/* Only a row whose route takes a window may name what held a page back, `hasMore` there meaning the
   window did not cover the set; one taking neither guesses no cap, and none carries `notice`. */
const paged = (payload, key, rows, by = null) => {
  const more = payload?.hasMore ?? null;
  return {
    [key]: rows,
    returned: Number(payload?.returned ?? rows.length),
    limit: payload?.limit ?? null,
    hasMore: more,
    ...(more === true && by ? { truncated: true, truncatedBy: by } : {}),
  };
};

/* The full read is the row whole, less these. A keep-list would put the column the tracker grows
   next out of reach of `--fields`, so what is named is what says nothing to a caller (ISS-151). */
const NOT_THE_ISSUE = new Set(["id", "displayId", "projectId", "issSeq", "identSearch", "externalId",
  "metadata", "pipelineHealth", "releaseBatchRunId", "source", "reportedBy", "createdById",
  "createdVia", "creatorEmail", "creatorIsAgent", "creatorLabel", "agentStatus", "agentSessions",
  "activity", "comments"]);

const columns = (row) =>
  Object.fromEntries(Object.entries(row ?? {}).filter(([name]) => !NOT_THE_ISSUE.has(name)));

const COMMENT = ["issueId", "authorId", "authorDeviceId", "body", "format", "template", "slots",
  "text", "parentId", "createdAt", "updatedAt", "attachments"];

const PROJECT_ROW = ["id", "slug", "name", "orgId", "role", "archivedAt"];

const ATTACHMENT = ["name", "mime", "size", "url", "createdAt"];

/* Only the identifiers the row carries: an `issueId: null` reads as an issue with no key. */
const named = (row) => filled({ documentId: row?.id, issueId: row?.displayId });

const writtenRow = ({ page }) => ({ ...named(page), ...page });

const PAGE = ({ page }) => page;

/** Read through here, never off the row: a default only the transport sees is one no capture can. */
export const answersOf = (row) => row?.answers ?? PAGE;

/* The column is null where nothing was configured and the tool answered with the empty shape, which
   is what `stagingDeploy` and `--credentials` read; a null here would be a shape they cannot walk. */
const NO_DEPLOY = { notes: null, stagingApiUrl: null, stagingUrl: null, testCredentials: [], testingUrls: [] };

const projectOf = (row) => {
  const { id, slug, name, description, orgId, createdBy, role, repoPath, workspaceSetup, baseBranch,
    productionBranch, defaultDeviceId, previewDeploy, createdAt, archivedAt } = row ?? {};
  return { id, slug, name, description, orgId, createdBy, role, repoPath, workspaceSetup, baseBranch,
    productionBranch, defaultDeviceId, previewDeploy: previewDeploy ?? NO_DEPLOY, createdAt, archivedAt };
};

const expired = (until) => Boolean(until) && Date.parse(until) < Date.now();

/* An edge is one row whichever side it is read from; which end is *the other issue* is the whole
   difference. `gatesDispatch` is carried only where the row has it: absent falls back to the kind,
   false is the tracker saying this edge orders nothing, and filling it in decides that for it. */
const edgeOf = (edge, side) => ({
  edgeId: edge?.id ?? null,
  kind: edge?.kind ?? null,
  ...(edge?.gatesDispatch === undefined ? {} : { gatesDispatch: edge.gatesDispatch }),
  fromIssueId: edge?.fromIssueId ?? null,
  toIssueId: edge?.toIssueId ?? null,
  otherIssueId: edge?.[`${side}IssueId`] ?? null,
  otherDisplayId: edge?.[`${side}DisplayId`] ?? null,
  otherStatus: edge?.[`${side}Status`] ?? null,
  otherMergedAt: edge?.[`${side}MergedAt`] ?? null,
  validUntil: edge?.validUntil ?? null,
  expired: expired(edge?.validUntil),
});

/* Three lists: a `relates` edge orders nothing, and sat in `blockedBy` under a key no read answered. */
export const RELATES = "relates";
const ORDERS = (edge) => edge.kind !== RELATES;

export const EDGE_KINDS = ["blocks", RELATES];
export const otherOf = (edge) => edge?.otherDisplayId ?? edge?.otherIssueId ?? null;

export const relationsOf = (deps) => {
  const out = (deps?.outgoing ?? []).map((edge) => edgeOf(edge, "to"));
  const held = (deps?.incoming ?? []).map((edge) => edgeOf(edge, "from"));
  return {
    blocks: out.filter(ORDERS),
    blockedBy: held.filter(ORDERS),
    relates: [...out, ...held].filter((edge) => edge.kind === RELATES),
  };
};

/* Two of the three parts are separate requests, so a reader that named neither is not made to pay
   for them — and the key is left off rather than answered empty, an empty relation set being a
   thing the tracker can say and this not being it. */
export const issueOf = ({ issue, dependencies, attachments }) => ({
  ...named(issue),
  ...columns(issue),
  labels: issue?.labels ?? [],
  ...(attachments === undefined ? {} : { attachments: rowsIn(attachments, "items") }),
  ...(dependencies === undefined ? {} : { relations: relationsOf(dependencies) }),
});

/* A column the tracker owns is read as a property and never written as a span, so nothing in this
   file can print one — docs/cli/doctor.md says what a name an agent has to translate costs. */
export const browseOf = (row) => {
  const { title, status, priority, category, complexity, assigneeId, reopenCount, mergedAt,
    createdAt, updatedAt } = row ?? {};
  return { ...named(row), title, status, priority, category, complexity, assigneeId, reopenCount,
    mergedAt, createdAt, updatedAt };
};

export const commentOf = (row) => ({ documentId: row?.id ?? null, ...pick(row, COMMENT) });

const threadOf = (page) => ({
  ...paged(page, "comments", rowsIn(page, "items").map(commentOf), "cursor"),
  ...filled({ total: page?.total, nextCursor: page?.nextCursor }),
});

export const attachmentOf = (row) => ({ documentId: row?.id ?? null, ...pick(row, ATTACHMENT) });

/* The config is the project row plus what it keeps under `agentConfig`; three fields the tool
   answered with are on no route this credential reaches, and are left out rather than invented. */
export const configOf = (project) => {
  const { id, slug, name, repoPath, baseBranch, productionBranch } = project ?? {};
  return {
    project: { id, slug, name },
    config: { repoPath, baseBranch, productionBranch, ...(project?.agentConfig ?? {}) },
  };
};

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

/* An upload is judged on the type its multipart part carries, so this CLI is what puts one there;
   the pairs are the tracker's own at 29977155, and the argument docs/cli/one-transport.md's. */
const UPLOAD_MIMES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".qt": "video/quicktime",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".csv": "text/csv",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** What a name outside the map is sent as; the tracker's allowlist holds it, so its answer is the
 *  refusal and nothing here anticipates one. */
export const UNTYPED = "application/octet-stream";

/** Read the way the tracker reads it: the last dot onwards, lowercased, a bare extension included. */
export const mimeForName = (name) => {
  const held = String(name ?? "");
  const at = held.lastIndexOf(".");
  return (at < 0 ? null : UPLOAD_MIMES[held.slice(at).toLowerCase()]) ?? UNTYPED;
};

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

export const WIRE_FILTERS = Object.keys(FILTERS).filter((name) => FILTERS[name] === "wire");

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

/* Two routes, one query: the search route narrows on the same columns, and a search that dropped
   them printed closed rows as a whole answer to `--status open` (codex F2). */
const issueList = (args, project) => {
  const where = args.filters?.search ? "issues/search" : "issues";
  return { page: { path: `/projects/${project}/${where}${listQuery(args)}` } };
};

const one = (path, method = "GET", body) => ({ page: filled({ path, method, body }) });

/* A reader naming no field asked for the whole issue, and one naming fields asked for those. */
const asked = (args, name) => !args.fields || args.fields.includes(name);

/* Every row: which requests it makes, what its answer is, and whether it may be sent twice. A row
   with more than one request names them, and the caller makes them together. */
export const ROUTES = {
  "forge_issues.list": {
    project: true,
    requests: issueList,
    answers: ({ page }) => paged(page, "issues", rowsIn(page, "items").map(browseOf), "limit"),
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
  "forge_guide", "forge_project_pm", "forge_uploads"]);

export const toolOf = (key) => {
  const head = key.slice(0, key.lastIndexOf("."));
  return ACTION_ARG.has(head) ? head : key;
};

/* The path a row would build, read off the builder itself with the identifiers standing in for
   themselves: a template written out beside it would be a second copy of the same string. */
const SAMPLE = {
  documentId: ":documentId",
  projectRef: ":projectRef",
  edgeId: ":edgeId",
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

/* Every row's rather than a route's: `action` makes the key, `projectId` aims off the resolved slug. */
const STRUCTURAL = new Set(["action", "projectId"]);

/** The arguments a caller gave that the row's route does not send. */
export const undeclaredIn = (row, args) =>
  Object.keys(args ?? {}).filter((name) => !STRUCTURAL.has(name) && !(row?.sends ?? []).includes(name));

/* A narrowing dropped on the way out is worse than a refusal: the caller reads a whole answer as
   though it were the narrow one it asked for, and pays for the difference without being told. */
export const droppedRefusal = (key, names, row) =>
  `${key} was given ${names.join(", ")}, which its route does not send, so nothing was sent at all: `
  + "an argument dropped in transit reads back as an answer to a question the tracker never heard. "
  + `This route takes ${(row?.sends ?? []).join(", ") || "no arguments"}, which the -h of the verb `
  + "that owns it names too.";

/** The capabilities this CLI declares and REST does not serve. Each names the route it wanted, so
 *  the gap is reportable as a route rather than as a verb that stopped working, and each names what
 *  still reaches the same thing. A name outside this table wanted no route and is told so. */
export const NO_ROUTE = {
  "forge_knowledge.search": {
    wanted: "POST /api/projects/:id/knowledge/search",
    instead: "`forge knowledge list` and `forge knowledge get <slug>` are what still reach the store.",
  },
};

export const noRouteRefusal = (key) => {
  const held = NO_ROUTE[key];
  if (held) {
    return `${key} has no route on this tracker's REST API. It wanted \`${held.wanted}\`, which this `
      + "credential does not reach, so nothing was sent and there is no second endpoint anything "
      + `could have fallen back to.${held.instead ? `\n${held.instead}` : ""}`;
  }
  return `${key} is not a capability this CLI declares a route for, so nothing was sent.\n`
    + "`forge -h` lists every verb, and each route this CLI serves is some verb's own.";
};
