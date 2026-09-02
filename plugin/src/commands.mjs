import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { fail, settings } from "./resolve/settings.mjs";
import { projectId, REFERENCE_KEYS, scoped, toolNamed, tools, write } from "./rpc.mjs";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  documentIdOf,
  listIssues,
  rowsOf,
  truncated,
} from "./issues.mjs";
import { callable, isGated, refuseIfGated, usageOf } from "./resolve/visibility.mjs";
import { didYouMean } from "./suggest.mjs";
import { flags } from "./resolve/flags.mjs";
import { doctor } from "./doctor.mjs";
import { deps } from "./deps.mjs";
import { cloudflare } from "./cloudflare.mjs";
import { codex } from "./codex.mjs";
import { hooks } from "./hook-log.mjs";
import { record } from "./record.mjs";
import { advance } from "./advance.mjs";

/* One rule for every payload: inline, `@path`, or `-` for stdin. */
const bodyFrom = (path) => {
  if (path === "-") return readFileSync(0, "utf8");
  return readFileSync(path.startsWith("@") ? path.slice(1) : path, "utf8");
};

const show = (value) =>
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));

/* Absence means empty; the schema already says the field exists. */
const filled = (record) => {
  if (!record || typeof record !== "object" || Array.isArray(record)) return record;
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (value === null || value === undefined) return false;
      return !(typeof value === "object" && !Object.keys(value).length);
    }),
  );
};

/* An attachment answers with its id, name, mime, size and timestamp, and a reader acts on none
   of them: the url is what gets fetched. Keyed on carrying a url rather than on the field being
   called `attachments`, so a payload that grows another such list is covered. */
export const urlBearing = (item) => Boolean(item) && typeof item === "object" && typeof item.url === "string";

export const terse = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => (urlBearing(item) ? item.url : terse(item)));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, held]) => [key, terse(held)]));
  }
  return value;
};

/* The upload reply is that same object, and the name is already on the line. Unparseable is
   printed whole: a body that is not the expected shape is the one worth seeing. */
export const uploaded = (answer) => {
  try {
    const parsed = JSON.parse(answer);
    return urlBearing(parsed) ? parsed.url : answer;
  } catch {
    return answer;
  }
};

/* A pattern without a format is kept — that one carries the only copy of its rule. */
const trimPatterns = (node) => {
  if (Array.isArray(node)) return node.map(trimPatterns);
  if (!node || typeof node !== "object") return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "pattern" && typeof node.format === "string") continue;
    out[key] = trimPatterns(value);
  }
  return out;
};

const enumAt = async (tool, path) => {
  const declared = await toolNamed(tool);
  const node = path.reduce((held, key) => held?.[key], declared?.inputSchema?.properties);
  return node ?? [];
};

const checkNames = async (given, tool, path, kind, extra = []) => {
  const allowed = [...(await enumAt(tool, path)), ...extra];
  if (!allowed.length) return;
  for (const name of given) if (!allowed.includes(name)) fail(didYouMean(kind, name, allowed));
};

const limitFrom = (raw) => {
  if (raw === undefined) return DEFAULT_LIMIT;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_LIMIT) {
    fail(`--limit takes an integer from 1 to ${MAX_LIMIT}, not \`${raw}\`.`);
  }
  return value;
};

/* One line per issue: the uuid column was 22% of this verb and bought nothing. */
const printIssues = (payload, limit) => {
  const issues = rowsOf(payload);
  for (const issue of issues) {
    console.log(`${(issue.issueId ?? "").padEnd(8)} ${(issue.status ?? "").padEnd(12)} ${issue.title}`);
  }
  console.log(`\n${issues.length} issue(s)`);
  if (truncated(issues, limit)) {
    console.log(`Full page of ${limit}; there are more. Raise --limit (max ${MAX_LIMIT}).`);
  }
};

const resolveReferences = async (value, key) => {
  if (Array.isArray(value)) return Promise.all(value.map((item) => resolveReferences(item, key)));
  if (value && typeof value === "object") {
    const entries = await Promise.all(
      Object.entries(value).map(async ([name, held]) => [name, await resolveReferences(held, name)]),
    );
    return Object.fromEntries(entries);
  }
  if (typeof value === "string" && REFERENCE_KEYS.has(key)) return documentIdOf(value);
  return value;
};

const suggestTool = async (name) =>
  didYouMean("tool", name, callable(await tools()).map((tool) => tool.name), "Ask `forge tools`.");

export const commands = {
  doctor,
  record,
  advance,
  deps,
  cloudflare,
  codex,
  hooks,
  tools: async (rest) => {
    const { all } = flags(rest, "tools", ["--all"]);
    for (const tool of await tools()) {
      if (all || !isGated(tool.name)) console.log(tool.name);
    }
  },
  schema: async ([name, ...rest]) => {
    if (!name) fail(usageOf("schema"));
    const { all } = flags(rest, "schema", ["--all"]);
    const tool = await toolNamed(name);
    if (!tool) fail(await suggestTool(name));
    refuseIfGated(name, all);
    show({ description: tool.description, inputSchema: trimPatterns(tool.inputSchema) });
  },
  call: async ([name, json]) => {
    if (!name) fail(usageOf("call"));
    if (!(await toolNamed(name))) fail(await suggestTool(name));
    refuseIfGated(name);
    const raw = json === undefined || json === "-" || json.startsWith("@") ? bodyFrom(json ?? "-") : json;
    if (!raw.trim()) fail(`No arguments given for ${name}. Pass json as an argument or on stdin.`);
    let args;
    try {
      args = JSON.parse(raw);
    } catch (error) {
      return fail(`Arguments for ${name} are not json: ${error.message}`);
    }
    const resolved = await resolveReferences(args);
    /* `call` reaches the same writes the wrapped verbs do, so it takes the same gates. */
    const answer = resolved.data ? await write(name, resolved) : await scoped(name, resolved);
    show(answer);
  },
  issues: async (rest) => {
    const { limit: raw, ...filters } = flags(rest, "issues");
    const limit = limitFrom(raw);
    const allowed = Object.keys(await enumAt("forge_issues", ["filters", "properties"]));
    for (const given of Object.keys(filters)) {
      if (allowed.length && !allowed.includes(given)) {
        fail(didYouMean("filter", `--${given}`, [...allowed.map((one) => `--${one}`), "--limit"]));
      }
    }
    printIssues(await listIssues(filters, limit), limit);
  },
  /* Three tiers, and the payload is what costs. Fetch narrow, then fetch again. */
  issue: async ([reference, ...rest]) => {
    if (!reference) fail(usageOf("issue"));
    const { fields, full } = flags(rest, "issue", ["--full"]);
    const names = fields ? fields.split(",").map((name) => name.trim()) : null;
    if (names) await checkNames(names, "forge_issues", ["fields", "items", "enum"], "field");
    const documentId = await documentIdOf(reference);
    const body = filled(
      await scoped("forge_issues", { action: "get", documentId, ...(names ? { fields: names } : {}) }),
    );
    show(full ? body : terse(body));
  },
  /* `open` marks the active set; `draft` never dispatches. */
  new: async ([path, ...rest]) => {
    if (!path) fail(usageOf("new"));
    const data = { description: bodyFrom(path), status: "open", ...flags(rest, "new") };
    if (!data.title) fail("An issue needs --title; the tracker refuses an untitled one.");
    show(await write("forge_issues", { action: "create", data }));
  },
  comment: async ([reference, path]) => {
    if (!reference || !path) fail(usageOf("comment"));
    const issue = await documentIdOf(reference);
    show(await write("forge_comments", { action: "create", data: { issue, body: bodyFrom(path) } }));
  },
  /* A plan is a field, not a comment: one value, replaced rather than accumulated. Read back before
         reporting success — a field accepted and dropped answers 200 like one that was stored. */
  plan: async ([reference, path]) => {
    if (!reference || !path) fail(usageOf("plan"));
    const documentId = await documentIdOf(reference);
    const plan = bodyFrom(path);
    if (!plan.trim()) fail("An empty plan would clear the field; pass the plan itself.");
    await write("forge_issues", { action: "update", documentId, data: { plan } });
    const back = await scoped("forge_issues", { action: "get", documentId, fields: ["plan"] });
    const stored = (back?.plan ?? "").trim();
    if (!stored) {
      fail(`The update answered success but ${reference} still has no plan. Nothing was stored.`);
    }
    show({ documentId, plan: stored });
  },
  /* Bytes go to the presigned URL, never base64 through context. The URL is the credential. */
  attach: async ([target, targetRef, ...paths]) => {
    if (!target || !targetRef || !paths.length) fail(usageOf("attach"));
    if (!["issue", "comment"].includes(target)) {
      fail(`attach takes \`issue\` or \`comment\` as its target, not \`${target}\`.`);
    }
    const targetId = target === "issue" ? await documentIdOf(targetRef) : targetRef;
    for (const path of paths) {
      const name = basename(path);
      const minted = await write("forge_uploads", {
        action: "request",
        data: { target, targetId, name },
      });
      const url = minted.uploadUrl ?? `${new URL(settings().url).origin}${minted.uploadPath}`;
      const put = await fetch(url, { method: "PUT", body: readFileSync(path) });
      const answer = await put.text();
      if (!put.ok) fail(`Upload of ${name} answered ${put.status}: ${answer.slice(0, 300)}`);
      console.log(`${name}  ${uploaded(answer)}`);
    }
  },
  dep: async ([from, to, kind = "blocks"]) => {
    if (!from || !to) fail(usageOf("dep"));
    const [fromIssueId, toIssueId] = await Promise.all([documentIdOf(from), documentIdOf(to)]);
    show(await write("forge_project_pm", { action: "set_dependency", fromIssueId, toIssueId, kind }));
  },
  /* Ask for the guide; reach for the list only when the slug was wrong. */
  guide: async ([slug]) => {
    if (!slug) {
      const listed = await scoped("forge_guide", { action: "list" });
      for (const guide of rowsOf(listed, "guides")) console.log(`${guide.slug}\n  ${guide.summary}`);
      return;
    }
    const answer = await scoped("forge_guide", { action: "get", slug }, true);
    if (answer?.refused) {
      const listed = await scoped("forge_guide", { action: "list" });
      fail(didYouMean("guide", slug, rowsOf(listed, "guides").map((one) => one.slug)));
    }
    /* Markdown, not Markdown escaped inside JSON: every `\n` tokenizes worse than the character. */
    show(answer?.guide?.body ?? answer);
  },
  project: async () => console.log(await projectId()),
};
