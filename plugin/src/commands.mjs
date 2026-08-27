import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { fail, settings } from "./settings.mjs";
import { projectId, scoped, tools } from "./rpc.mjs";
import { translated } from "./vi.mjs";
import { doctor } from "./doctor.mjs";

/* The server's own default page is 25 and its schema caps `limit` at 500 with no offset or
   cursor beside it, so a full page is the only signal that anything was left behind. */
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const HUMAN_REF = /^[A-Za-z]+-\d+$/u;

/* A flag whose value is missing used to read as `undefined`, which `JSON.stringify` drops: the
   filter silently vanished and the command answered about the whole tracker. */
const flags = (rest, verb) => {
  const out = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    if (!key.startsWith("--")) fail(`${verb}: expected a --flag, got \`${key}\`.`);
    if (index + 1 >= rest.length) fail(`${verb}: ${key} was given no value.`);
    out[key.slice(2)] = rest[index + 1];
  }
  return out;
};

const limitFrom = (raw) => {
  if (raw === undefined) return DEFAULT_LIMIT;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_LIMIT) {
    fail(`--limit takes an integer from 1 to ${MAX_LIMIT}, not \`${raw}\`.`);
  }
  return value;
};

const bodyFrom = (path) => (path === "-" ? readFileSync(0, "utf8") : readFileSync(path, "utf8"));

const show = (value) =>
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));

const listIssues = async (filters, limit) =>
  scoped("forge_issues", {
    action: "list",
    limit,
    ...(Object.keys(filters).length ? { filters } : {}),
  });

const rowsOf = (payload) => payload?.issues ?? (Array.isArray(payload) ? payload : []);

/* The one-line-per-issue projection the tracker returns for `list`, printed as a table rather
   than as its json: browsing is the case this verb exists for. */
const printIssues = (payload, limit) => {
  const issues = rowsOf(payload);
  /* `issueId` is the reference a human cites; `documentId` is what every other verb here takes. */
  for (const issue of issues) {
    const ref = (issue.issueId ?? "").padEnd(8);
    console.log(`${ref} ${(issue.status ?? "").padEnd(12)} ${issue.documentId}  ${issue.title}`);
  }
  console.log(`\n${issues.length} issue(s)`);
  if (issues.length === limit) {
    console.log(`This is a full page of ${limit}; there are more. Raise --limit (max ${MAX_LIMIT}).`);
  }
};

/* `issues` prints `ISS-45` in its first column, so that is the reference a reader copies — and
   every other verb takes the uuid. Resolving it here costs one list call and only when asked. */
const documentIdOf = async (reference) => {
  if (UUID.test(reference)) return reference;
  if (!HUMAN_REF.test(reference)) {
    fail(`\`${reference}\` is neither an issue uuid nor a reference like ISS-45.`);
  }
  const wanted = reference.toUpperCase();
  const found = rowsOf(await listIssues({}, MAX_LIMIT)).find(
    (issue) => (issue.issueId ?? "").toUpperCase() === wanted,
  );
  if (!found) fail(`No issue is referenced ${reference} in the newest ${MAX_LIMIT}.`);
  return found.documentId;
};

export const commands = {
  doctor,
  tools: async () => {
    for (const tool of await tools()) console.log(tool.name);
  },
  schema: async ([name]) => {
    if (!name) fail("Usage: forge schema <tool>");
    const tool = (await tools()).find((candidate) => candidate.name === name);
    if (!tool) fail(`No tool named ${name}. Ask \`tools\` for the list.`);
    show({ description: tool.description, inputSchema: tool.inputSchema });
  },
  call: async ([name, json]) => {
    if (!name) fail("Usage: forge call <tool> '<json>'   (json from stdin when omitted)");
    const raw = json ?? readFileSync(0, "utf8");
    if (!raw.trim()) fail(`No arguments given for ${name}. Pass json as an argument or on stdin.`);
    let args;
    try {
      args = JSON.parse(raw);
    } catch (error) {
      return fail(`Arguments for ${name} are not json: ${error.message}`);
    }
    /* `call` reaches the same create and update the wrapped verbs do, so an untranslated one here
       would be the bypass that makes every gate above decorative. */
    show(await scoped(name, { ...args, ...(args.data ? { data: translated(args.data) } : {}) }));
  },
  issues: async (rest) => {
    const { limit: raw, ...filters } = flags(rest, "issues");
    const limit = limitFrom(raw);
    printIssues(await listIssues(filters, limit), limit);
  },
  issue: async ([reference]) => {
    if (!reference) fail("Usage: forge issue <issue-uuid|ISS-45>");
    show(await scoped("forge_issues", { action: "get", documentId: await documentIdOf(reference) }));
  },
  /* `open` is the default: a repository that drives its own builders ignores the tracker's
     pipeline, so `open` marks the active set and nothing dispatches off it. `draft` stays
     reachable through `--status`, and it is the only status nothing may transition back INTO. */
  new: async ([path, ...rest]) => {
    if (!path) fail("Usage: forge new <file.md|-> --title T [--status S] [--priority P]");
    const data = { description: bodyFrom(path), status: "open", ...flags(rest, "new") };
    if (!data.title) fail("An issue needs --title; the tracker refuses an untitled one.");
    show(await scoped("forge_issues", { action: "create", data: translated(data) }));
  },
  comment: async ([reference, path]) => {
    if (!reference || !path) fail("Usage: forge comment <issue-uuid|ISS-45> <file.md|->");
    const issue = await documentIdOf(reference);
    show(
      await scoped("forge_comments", {
        action: "create",
        data: translated({ issue, body: bodyFrom(path) }),
      }),
    );
  },
  /* Bytes go straight to the presigned URL, never base64 through a model's context, and that PUT
     carries no auth header of its own — the URL is the credential and expires in ~300s. */
  attach: async ([target, targetRef, ...paths]) => {
    if (!target || !targetRef || !paths.length) {
      fail("Usage: forge attach <issue|comment> <uuid> <file>...");
    }
    const targetId = target === "issue" ? await documentIdOf(targetRef) : targetRef;
    for (const path of paths) {
      const name = basename(path);
      const minted = await scoped("forge_uploads", {
        action: "request",
        data: { target, targetId, name },
      });
      const url = minted.uploadUrl ?? `${new URL(settings().url).origin}${minted.uploadPath}`;
      const put = await fetch(url, { method: "PUT", body: readFileSync(path) });
      const answer = await put.text();
      if (!put.ok) fail(`Upload of ${name} answered ${put.status}: ${answer.slice(0, 300)}`);
      console.log(`${name}  ${answer}`);
    }
  },
  dep: async ([from, to, kind = "blocks"]) => {
    if (!from || !to) fail("Usage: forge dep <blocker-uuid> <blocked-uuid> [blocks|relates]");
    show(
      await scoped("forge_project_pm", {
        action: "set_dependency",
        fromIssueId: await documentIdOf(from),
        toIssueId: await documentIdOf(to),
        kind,
      }),
    );
  },
  guide: async ([slug]) => {
    show(await scoped("forge_guide", slug ? { action: "get", slug } : { action: "list" }));
  },
  project: async () => console.log(await projectId()),
};
