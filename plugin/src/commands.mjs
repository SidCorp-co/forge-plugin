import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { fail, projectScope, settings, translateTo } from "./settings.mjs";
import { projectId, scoped, tools } from "./rpc.mjs";
import { translated } from "./vi.mjs";
import { didYouMean } from "./suggest.mjs";
import { userConfig } from "./config.mjs";
import { flags } from "./flags.mjs";
import { doctor } from "./doctor.mjs";
import { deps } from "./deps.mjs";

/* The server's own default page is 25 and its schema caps `limit` at 500 with no offset or
   cursor beside it, so a full page is the only signal that anything was left behind. */
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const HUMAN_REF = /^[A-Za-z]+-\d+$/u;

const limitFrom = (raw) => {
  if (raw === undefined) return DEFAULT_LIMIT;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_LIMIT) {
    fail(`--limit takes an integer from 1 to ${MAX_LIMIT}, not \`${raw}\`.`);
  }
  return value;
};

/* One rule for every payload this CLI takes: inline, `@path`, or `-` for stdin. Measured on a
   3,895-character issue body — passing the file costs 153 characters against 4,202 inline, but
   only because the file already existed; writing one in the same breath costs what inlining does
   (4,078), and for a small flat payload the extra command makes it 1.6x worse. */
const bodyFrom = (path) => {
  if (path === "-") return readFileSync(0, "utf8");
  return readFileSync(path.startsWith("@") ? path.slice(1) : path, "utf8");
};

const show = (value) =>
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));

/* A null `plan` and an empty `attachments` are 179 bytes of an issue's 1,938 and say only that
   the field exists, which the schema already says. Absence here means empty. */
const filled = (record) =>
  Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (value === null || value === undefined) return false;
      return !(typeof value === "object" && !Object.keys(value).length);
    }),
  );

/* `format: "uuid"` and a 150-character regex asserting the same thing appear together on every
   id field; the regex is 8% of `schema forge_issues` and tells a reader nothing the format did
   not. Anything patterned without a format is kept — that one carries the only copy of its rule. */
const trimPatterns = (node) => {
  if (Array.isArray(node)) return node.map(trimPatterns);
  if (!node || typeof node !== "object") return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "pattern" && node.format) continue;
    out[key] = trimPatterns(value);
  }
  return out;
};

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
    console.log(
      `This is a full page of ${limit}; there are more. Raise --limit (max ${MAX_LIMIT}).`,
    );
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

/* Wherever the schema wants an issue uuid. Resolving them here is what lets a raw `call` carry
   `ISS-8` too, so the cheap reference is not a privilege of the wrapped verbs. */
const REFERENCE_KEYS = new Set([
  "documentId",
  "dependsOnId",
  "blocksId",
  "issue",
  "issueId",
  "fromIssueId",
  "toIssueId",
]);

const resolveReferences = async (value, key) => {
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => resolveReferences(item)));
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [name, held] of Object.entries(value)) out[name] = await resolveReferences(held, name);
    return out;
  }
  if (typeof value === "string" && REFERENCE_KEYS.has(key) && HUMAN_REF.test(value)) {
    return documentIdOf(value);
  }
  return value;
};

/* A write goes to whichever project the cwd resolves, and `forge_issues` has no delete action, so
   the target is announced before the post rather than discovered in the response. */
const announce = (verb) => {
  const { slug, from } = projectScope();
  if (!slug) return;
  console.error(
    `${verb} -> project ${slug} (from ${from}), prose ${translateTo() ?? "as written"}`,
  );
};

/* A refusal `forge doctor` measured, applied where the tool would otherwise be offered. A
   capability this credential cannot use is not a warning to weigh, it is noise that invites an
   error — so it is withheld rather than annotated, and `--all` is how a human sees past it.

   Deliberately a replay, not a fresh probe: filtering a listing must not cost a call per tool. */
const knownGates = () => {
  const { slug } = projectScope();
  const recorded = slug ? (userConfig().capabilities ?? {})[slug] : null;
  if (!recorded) return { gates: {}, checkedAt: null };
  const { checkedAt, ...gates } = recorded;
  return { gates, checkedAt };
};

/* The schema a gated tool publishes is an invitation to a call that cannot succeed, so it is not
   printed at all. The refusal names its own measurement rather than asserting a permanent fact. */
const refuseIfGated = (name, override) => {
  const { gates, checkedAt } = knownGates();
  if (override || !gates[name]) return;
  fail(
    `${name} is not available to this credential: ${gates[name]}\n` +
      `Measured ${checkedAt} by \`forge doctor\`. Re-run it after a credential change, or pass --all.`,
  );
};

export const callable = (declared) => {
  const { gates } = knownGates();
  return declared.filter((tool) => !gates[tool.name]);
};

/* Verbs a human chose to withhold with `forge doctor --hide`, as opposed to those the server
   refuses. Same principle, different authority. */
export const withheldVerbs = () => new Set(userConfig().withheld ?? []);

export const gatedTools = () => {
  const { gates } = knownGates();
  return new Set(Object.entries(gates).filter(([, refusal]) => refusal).map(([name]) => name));
};

export const commands = {
  doctor,
  deps,
  tools: async (rest) => {
    const all = rest.includes("--all");
    const { gates, checkedAt } = knownGates();
    for (const tool of await tools()) {
      const gate = gates[tool.name];
      if (gate && !all) continue;
      console.log(gate ? `${tool.name}  [refused ${checkedAt}: ${gate}]` : tool.name);
    }
  },
  schema: async ([name, ...rest]) => {
    if (!name) fail("Usage: forge schema <tool>");
    const tool = (await tools()).find((candidate) => candidate.name === name);
    if (!tool) fail(didYouMean("tool", name, (await tools()).map((tool) => tool.name), "Ask `forge tools`."));
    refuseIfGated(name, rest.includes("--all"));
    show({ description: tool.description, inputSchema: trimPatterns(tool.inputSchema) });
  },
  call: async ([name, json]) => {
    if (!name) fail("Usage: forge call <tool> <'json'|@file|->");
    if (!(await tools()).some((tool) => tool.name === name)) {
      fail(didYouMean("tool", name, callable(await tools()).map((tool) => tool.name), "Ask `forge tools`."));
    }
    refuseIfGated(name, false);
    const raw = json === undefined || json === "-" || json.startsWith("@") ? bodyFrom(json ?? "-") : json;
    if (!raw.trim()) fail(`No arguments given for ${name}. Pass json as an argument or on stdin.`);
    let args;
    try {
      args = JSON.parse(raw);
    } catch (error) {
      return fail(`Arguments for ${name} are not json: ${error.message}`);
    }
    const resolved = await resolveReferences(args);
    if (resolved.data) announce(`call ${name}`);
    /* `call` reaches the same create and update the wrapped verbs do, so an untranslated one here
       would be the bypass that makes every gate above decorative. */
    const answer = await scoped(name, {
      ...resolved,
      ...(resolved.data ? { data: translated(resolved.data) } : {}),
    });
    /* Measured 2026-08-27 and filed as forge-dev ISS-868: the field is schema-validated and then
       discarded, and the 200 is indistinguishable from a write that landed. */
    if (name === "forge_issues" && resolved.action === "update" && resolved.data?.relations) {
      console.error(
        "warning: data.relations on `update` is a validated no-op — the server accepts it,\n" +
          "changes nothing, and there is no read path to check. Nothing here confirms an edge.",
      );
    }
    show(answer);
  },
  issues: async (rest) => {
    const { limit: raw, ...filters } = flags(rest, "issues");
    const limit = limitFrom(raw);
    /* The server answers an unknown filter with `Unrecognized key`, one round trip later and
       without naming a valid one. Its own schema is already in hand. */
    const declared = (await tools()).find((tool) => tool.name === "forge_issues");
    const allowed = Object.keys(declared?.inputSchema?.properties?.filters?.properties ?? {});
    for (const given of Object.keys(filters)) {
      if (!allowed.includes(given)) fail(didYouMean("filter", `--${given}`, [...allowed.map((a) => `--${a}`), "--limit"]));
    }
    printIssues(await listIssues(filters, limit), limit);
  },
  /* Three tiers, and the payload is what costs: `issues` is a line per issue, `issue` is one
     whole body, `--fields plan` is one part of one body. Measured on this tracker — the list is
     2,557 bytes for 50 issues against ~1,900 for a single body, so drilling into 48 of the 50
     still costs less than one call that returned them all. Fetch narrow, then fetch again. */
  issue: async ([reference, ...rest]) => {
    if (!reference) fail("Usage: forge issue <issue-uuid|ISS-45> [--fields a,b]");
    const { fields } = flags(rest, "issue");
    const documentId = await documentIdOf(reference);
    const wanted = fields ? { fields: fields.split(",").map((name) => name.trim()) } : {};
    show(filled(await scoped("forge_issues", { action: "get", documentId, ...wanted })));
  },
  /* `open` is the default: a repository that drives its own builders ignores the tracker's
     pipeline, so `open` marks the active set and nothing dispatches off it. `draft` stays
     reachable through `--status`, and it is the only status nothing may transition back INTO. */
  new: async ([path, ...rest]) => {
    if (!path) fail("Usage: forge new <file.md|-> --title T [--status S] [--priority P]");
    const data = { description: bodyFrom(path), status: "open", ...flags(rest, "new") };
    if (!data.title) fail("An issue needs --title; the tracker refuses an untitled one.");
    announce("new");
    show(await scoped("forge_issues", { action: "create", data: translated(data) }));
  },
  comment: async ([reference, path]) => {
    if (!reference || !path) fail("Usage: forge comment <issue-uuid|ISS-45> <file.md|->");
    const issue = await documentIdOf(reference);
    announce("comment");
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
    if (!slug) {
      const listed = await scoped("forge_guide", { action: "list" });
      for (const guide of listed?.guides ?? []) console.log(`${guide.slug}\n  ${guide.summary}`);
      return undefined;
    }
    const listed = await scoped("forge_guide", { action: "list" });
    const slugs = (listed?.guides ?? []).map((guide) => guide.slug);
    if (slugs.length && !slugs.includes(slug)) fail(didYouMean("guide", slug, slugs));
    show(await scoped("forge_guide", { action: "get", slug }));
  },
  project: async () => console.log(await projectId()),
};
