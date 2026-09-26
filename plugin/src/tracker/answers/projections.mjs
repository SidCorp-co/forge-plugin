/* How each route's answer becomes the shape its callers read: the row shapers the declared table in
   routes.mjs names. Pure, as that table is — docs/cli/one-transport.md. */

import { relationsOf } from "../edges/kinds.mjs";

export const pick = (row, names) =>
  Object.fromEntries(names.map((name) => [name, Object.hasOwn(row ?? {}, name) ? row[name] : null]));

export const rowsIn = (payload, key) => payload?.[key] ?? (Array.isArray(payload) ? payload : []);

export const filled = (held) => Object.fromEntries(Object.entries(held).filter(([, value]) => value !== undefined));

/* `hasMore` is the route's own word for the window not covering the set, and a route that says nothing about its own completeness answers null rather than a cap this CLI guessed for it. */
export const paged = (payload, key, rows) => ({
  [key]: rows,
  returned: Number(payload?.returned ?? rows.length),
  limit: payload?.limit ?? null,
  hasMore: payload?.hasMore ?? null,
});

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

export const PROJECT_ROW = ["id", "slug", "name", "orgId", "role", "archivedAt"];

const ATTACHMENT = ["name", "mime", "size", "url", "createdAt"];

/* A module is a label of kind `module`, so one projection reads both: the kind is what tells them
   apart, and the parent and description are what `forge doctor modules` prints. docs/cli/modules.md. */
export const labelOf = (row) => pick(row, ["id", "name", "kind", "parentId", "slug", "description", "color"]);

/* Only the identifiers the row carries: an `issueId: null` reads as an issue with no key. */
const named = (row) => filled({ documentId: row?.id, issueId: row?.displayId });

/* The answer is what the caller could not already know: the row less the columns the read path drops, less every field this same call sent and got back unchanged — docs/cli/what-a-write-says.md (ISS-1400). */
export const writtenRow = ({ page }, args) => ({ ...named(page), ...Object.fromEntries(
  Object.entries(columns(page)).filter(([name, held]) =>
    JSON.stringify(args?.data?.[name]) !== JSON.stringify(held))) });


/* The deploy bindings travel as the row holds them: null where the project configured none, and the
   tracker's own shape where it did. A default substituted here would answer the same for both, and
   every reader below would be walking this file's invention rather than the project's record. */
export const projectOf = (row) => {
  const { id, slug, name, description, orgId, createdBy, role, repoPath, workspaceSetup, baseBranch,
    liveBranch, releaseModel, releaseStrategy, defaultDeviceId, environments, createdAt,
    archivedAt } = row ?? {};
  return { id, slug, name, description, orgId, createdBy, role, repoPath, workspaceSetup, baseBranch,
    liveBranch, releaseModel, releaseStrategy, defaultDeviceId, environments, createdAt, archivedAt };
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

/* What reading a citation backwards needs and `browseOf` may not grow: docs/cli/spec-the-status.md. */
export const citingOf = (row) => ({
  ...named(row),
  ...pick(row, ["title", "status", "mergedAt", "mergedCommitSha", "matchedFields",
    "description", "plan", "acceptanceCriteria"]),
});

export const commentOf = (row) => ({ documentId: row?.id ?? null, ...pick(row, COMMENT) });

export const threadOf = (page) => ({
  ...paged(page, "comments", rowsIn(page, "items").map(commentOf)),
  ...filled({ total: page?.total, nextCursor: page?.nextCursor }),
});

export const attachmentOf = (row) => ({ documentId: row?.id ?? null, ...pick(row, ATTACHMENT) });

/* The config is the project row plus what it keeps under `agentConfig`; three fields the tool
   answered with are on no route this credential reaches, and are left out rather than invented. */
export const configOf = (project) => {
  const { id, slug, name, repoPath, baseBranch, liveBranch, releaseModel, releaseStrategy } = project ?? {};
  return {
    project: { id, slug, name },
    config: { repoPath, baseBranch, liveBranch, releaseModel, releaseStrategy,
      ...(project?.agentConfig ?? {}) },
  };
};

export const attributedOf = (row) => ({ ...named(row), status: row?.status ?? null, modules: row?.modules ?? null });

const eventOf = (row) => ({ id: row?.id ?? null, issueId: row?.issueId ?? null, action: row?.action ?? null,
  from: row?.payload?.from ?? null, to: row?.payload?.to ?? null, reopenCount: row?.payload?.reopenCount ?? null,
  at: row?.createdAt ?? null });

export const eventsOf = ({ page }) => ({ events: rowsIn(page, "items").map(eventOf), nextBefore: page?.nextBefore ?? null });
