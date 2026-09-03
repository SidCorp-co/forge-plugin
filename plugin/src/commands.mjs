import { fail } from "./resolve/settings.mjs";
import { bodyFrom } from "./resolve/payload.mjs";
import { projectId, REFERENCE_KEYS, scoped, toolNamed, tools, write } from "./tracker/rpc.mjs";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  documentIdOf,
  listIssues,
  rowsOf,
  truncated,
} from "./tracker/issues.mjs";
import { creditAfter, credited, mustBeShown, postComment } from "./tracker/comments.mjs";
import { uploadTo, urlBearing } from "./tracker/evidence.mjs";
import { refusalForFiling, withMark } from "./tracker/issue-shape.mjs";
import { filingsOf, targetsOfTool } from "./tracker/issue-read.mjs";
import { callable, isGated, refuseIfGated, usageOf } from "./resolve/visibility.mjs";
import { didYouMean } from "./suggest.mjs";
import { flags, partition } from "./resolve/flags.mjs";
import {
  caveatLine,
  dispositionOf,
  replacementLine,
  trackerHeader,
  visibleGuides,
  withheldLine,
} from "./tracker/guides.mjs";
import { doctor } from "./tools/doctor.mjs";
import { deps } from "./tracker/deps.mjs";
import { cloudflare } from "./tools/cloudflare.mjs";
import { codex } from "./codex/codex.mjs";
import { hooks } from "./hooks/hook-log.mjs";
import { record } from "./flow/record.mjs";
import { advance } from "./flow/advance.mjs";
import { spec } from "./spec/verbs.mjs";
import { claim } from "./flow/claim.mjs";
import { resume } from "./flow/resume.mjs";
import { notAnothers, renew } from "./flow/lease.mjs";

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
export const terse = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => (urlBearing(item) ? item.url : terse(item)));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, held]) => [key, terse(held)]));
  }
  return value;
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
  claim,
  resume,
  record,
  advance,
  spec,
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
    const raw = json === undefined || json === "-" || json.startsWith("@") ? await bodyFrom(json ?? "-") : json;
    if (!raw.trim()) fail(`No arguments given for ${name}. Pass json as an argument or on stdin.`);
    let args;
    try {
      args = JSON.parse(raw);
    } catch (error) {
      return fail(`Arguments for ${name} are not json: ${error.message}`);
    }
    const resolved = await resolveReferences(args);
    /* `call` reaches the same writes the wrapped verbs do, so it takes the same gates — and it is
       the route that renews no lease, so the read-before-write check is made here by hand. */
    const targets = await Promise.all(
      targetsOfTool(name, args).map(async (ref) => ({ ref, documentId: await documentIdOf(ref) })),
    );
    if (targets.length) await mustBeShown(targets);
    /* And the shape a filing owes, here rather than only in the hook: the payload may arrive from a
       file or from stdin, which the hook reading the command line cannot see. */
    for (const filing of filingsOf({ name: `mcp__forge__${name}`, input: args })) {
      const refused = await refusalForFiling(filing);
      if (refused) fail(refused);
    }
    const wrote = Boolean(resolved.data);
    const answer = wrote ? await write(name, resolved) : await scoped(name, resolved);
    credited(name, resolved, answer);
    show(answer);
    /* The mark writes a comment of the tracker's own and this is the route it takes, so the page is
       read once more after the write and what it brought is delivered here (ISS-65). */
    if (wrote && targets.length) await creditAfter(name, targets);
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
  /* `open` marks the active set; `draft` never dispatches. A filing is read before it is made,
     because the flow costs the same for one line as for a feature: how/issue-shape.md. */
  new: async ([path, ...rest]) => {
    if (!path) fail(usageOf("new"));
    const { into, with: rides, size, ...given } = flags(rest, "new");
    if (!given.title) fail("An issue needs --title; the tracker refuses an untitled one.");
    if (size !== undefined && size !== "fix") {
      fail(`--size takes \`fix\`, the one size the contract gives a light path, not \`${size}\`. `
        + "A whole issue needs no size.");
    }
    /* Presence, never truth: the shared parser takes an empty string as a value, and a route read
       by truthiness would drop `--into ""` on the floor and file the issue instead. */
    const commenting = into !== undefined;
    const relating = rides !== undefined;
    if (commenting && relating) fail("--into posts a comment and --with files an issue. Ask for one of them.");
    const filing = [...Object.keys(given).filter((one) => one !== "title"), ...(size === undefined ? [] : ["size"])];
    if (commenting && filing.length) {
      fail(`--into posts a comment, and ${filing.map((one) => `--${one}`).join(", ")} belongs to a filing. `
        + "Drop it, or file the issue and comment on it separately.");
    }
    const body = await bodyFrom(path);
    /* A comment is not an issue and owes none of the shape; the read the write owes is still owed,
       and it takes no lease, because a finding on an issue nobody holds is nobody's claim. */
    if (commenting) {
      const issue = await documentIdOf(into);
      await mustBeShown([{ ref: into, documentId: issue }]);
      return show(await postComment(issue, `## ${given.title}\n\n${body}`));
    }
    const description = size ? withMark(body) : body;
    const refusal = await refusalForFiling({ title: given.title, body: description }, { routed: relating });
    if (refusal) fail(refusal);
    const data = { description, status: "open", ...given };
    if (relating) data.relations = [{ kind: "relates", blocksId: await documentIdOf(rides) }];
    show(await write("forge_issues", { action: "create", data }));
  },
  comment: async ([reference, path]) => {
    if (!reference || !path) fail(usageOf("comment"));
    const issue = await documentIdOf(reference);
    await renew(issue, reference);
    show(await postComment(issue, await bodyFrom(path)));
  },
  /* A plan is a field, not a comment: one value, replaced rather than accumulated. Read back before
         reporting success — a field accepted and dropped answers 200 like one that was stored. */
  plan: async ([reference, path]) => {
    if (!reference || !path) fail(usageOf("plan"));
    const documentId = await documentIdOf(reference);
    const plan = await bodyFrom(path);
    if (!plan.trim()) fail("An empty plan would clear the field; pass the plan itself.");
    await renew(documentId, reference);
    await write("forge_issues", { action: "update", documentId, data: { plan } });
    const back = await scoped("forge_issues", { action: "get", documentId, fields: ["plan"] });
    const stored = (back?.plan ?? "").trim();
    if (!stored) {
      fail(`The update answered success but ${reference} still has no plan. Nothing was stored.`);
    }
    show({ documentId, plan: stored });
  },
  attach: async ([target, targetRef, ...paths]) => {
    if (!target || !targetRef || !paths.length) fail(usageOf("attach"));
    if (!["issue", "comment"].includes(target)) {
      fail(`attach takes \`issue\` or \`comment\` as its target, not \`${target}\`.`);
    }
    const targetId = target === "issue" ? await documentIdOf(targetRef) : targetRef;
    for (const path of paths) {
      /* Every payload write renews, uploads included; a comment id names no issue to read a lease
         from, and the tracker offers no route from one to the other. */
      if (target === "issue") await renew(targetId, targetRef);
      await uploadTo(target, targetId, path);
    }
  },
  /* An edge changes the order the blocked issue is worked in, so its lease is the one that covers
     the write: a new issue filed to block the one in hand renews the one in hand. */
  dep: async ([from, to, kind = "blocks"]) => {
    if (!from || !to) fail(usageOf("dep"));
    const [fromIssueId, toIssueId] = await Promise.all([documentIdOf(from), documentIdOf(to)]);
    await notAnothers(fromIssueId, from);
    await renew(toIssueId, to);
    show(await write("forge_project_pm", { action: "set_dependency", fromIssueId, toIssueId, kind }));
  },
  /* Read through this plugin's disposition of them, which tracker/guides.mjs holds and explains. A
     superseded slug costs no call: the table answers it, and only --tracker fetches the body. */
  guide: async (argv) => {
    const { positionals, flagArgv } = partition(argv, ["--tracker"]);
    const asked = flags(flagArgv, "guide", ["--tracker"]);
    for (const key of Object.keys(asked)) {
      if (key !== "tracker") fail(`guide: no --${key} flag. ${usageOf("guide")}`);
    }
    const [slug, ...extra] = positionals;
    if (extra.length) fail(`guide: one slug, not \`${positionals.join(" ")}\`. ${usageOf("guide")}`);
    if (!slug && asked.tracker) fail(`guide: --tracker is one guide's own text; name it. ${usageOf("guide")}`);
    if (!slug) {
      const rows = rowsOf(await scoped("forge_guide", { action: "list" }), "guides");
      const shown = new Set(visibleGuides(rows.map((one) => one.slug)));
      for (const guide of rows) {
        if (shown.has(guide.slug)) console.log(`${guide.slug}\n  ${guide.summary}`);
      }
      if (rows.length > shown.size) console.log(withheldLine(rows.length - shown.size));
      return;
    }
    const row = dispositionOf(slug);
    if (row?.disposition === "superseded" && !asked.tracker) {
      console.log(replacementLine(row));
      return;
    }
    const answer = await scoped("forge_guide", { action: "get", slug }, true);
    if (answer?.refused) {
      const rows = rowsOf(await scoped("forge_guide", { action: "list" }), "guides");
      fail(didYouMean("guide", slug, visibleGuides(rows.map((one) => one.slug))));
    }
    const header = asked.tracker ? trackerHeader(row) : (row ? [caveatLine(row)] : []);
    if (header.length) console.log(`${header.join("\n")}\n`);
    /* Markdown, not Markdown escaped inside JSON: every `\n` tokenizes worse than the character. */
    show(answer?.guide?.body ?? answer);
  },
  project: async () => console.log(await projectId()),
};
