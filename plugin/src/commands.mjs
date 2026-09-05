import { fail, keepOnFailure } from "./resolve/settings.mjs";
import { bodyFrom, notABody } from "./resolve/payload.mjs";
import { projectId, REFERENCE_KEYS, enumAt, scoped, toolNamed, tools, write } from "./tracker/rpc.mjs";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  documentIdOf,
  everyIssue,
  queued,
  rowsOf,
  shortOf,
} from "./tracker/issues.mjs";
import { commentPage, creditAfter, credited, cutLine, mustBeShown, postComment } from "./tracker/comments.mjs";
import { attachmentNames, uploadRead, uploadTo, urlBearing } from "./tracker/evidence.mjs";
import {
  INSTEAD_FLAGS,
  KINDS_HELP,
  KIND_NAMES,
  PRIORITY_AT,
  PRIORITY_HELP,
  SIZE_WORDS,
  filedAs,
  inFlowWords,
  insteadOf,
  kindRefusal,
  liveTitles,
  rankOf,
  refusalFrom,
  shapeOf,
  trackerFields,
  withMark,
} from "./tracker/issue-shape.mjs";
import { BESIDE_HELP, foldFiling, foldedInto, neighboursOf, suggestionLines }
  from "./tracker/neighbours.mjs";
import { filingsOf, targetsOfTool } from "./tracker/issue-read.mjs";
import { callable, helpOf, isGated, refuseIfGated, usageOf } from "./resolve/visibility.mjs";
import { didYouMean, unknownFlag } from "./suggest.mjs";
import { flags, partition, pullRepeated, wantsHelp } from "./resolve/flags.mjs";
import { dispositionOf, trackerHeader, visibleGuides } from "./tracker/guides.mjs";
import { briefLines, projectLines, readBrief, refreshBrief, releasePolicy, stagingDeploy }
  from "./tracker/project-config.mjs";
import { LISTING_ROW as CONTRACT_ROW, SLUG as CONTRACT_SLUG, contractAnswer } from "./tracker/contract.mjs";
import { doctor } from "./tools/doctor.mjs";
import { deps } from "./tools/deps.mjs";
import { cloudflare } from "./tools/cloudflare.mjs";
import { knowledge } from "./tools/knowledge.mjs";
import { feedback } from "./tools/feedback.mjs";
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

/* Both routes that file an issue, refusing and saying through one place: what each says was pinned
   to what the other says by hand, which is a pair of copies agreeing until one is corrected. One
   body scanned once, and one open-issues page for the duplicate check and for what is open beside
   the filing both. */
const readFiling = async (filing, options) => {
  const shape = shapeOf(filing);
  const page = await liveTitles();
  const refusal = await refusalFrom(filing, shape, { ...options, page });
  if (refusal) fail(refusal);
  if (shape.said) console.error(shape.said);
  return { shape, live: page.live };
};

const sayBeside = (beside, options) => {
  for (const line of suggestionLines(beside, options)) console.log(line);
};

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

/* Every matching row being in hand, the only cut left is the printed one — by the order above. */
const routeSaid = (shown) => (shown < MAX_LIMIT
  ? ` — \`--limit\` up to ${MAX_LIMIT} prints more of it, and a filter narrows the ask.`
  : " — a filter narrows the ask.");

const countSaid = (shown, read) => (shown < read.rows.length
  ? `${shown} of ${read.rows.length} issue(s) over ${read.pages} page(s). The ${read.rows.length - shown}`
    + ` not printed are the tail of the order above${routeSaid(shown)}`
  : `${read.rows.length} issue(s) over ${read.pages} page(s)`
    + (read.whole ? ", which is every row matching this ask." : "."));

/* One line per issue: the uuid column was 22% of this verb and bought nothing, and the rank is here
   because an order a reader cannot see reads as a shuffle. */
const printIssues = (read, limit, order) => {
  const shown = queued(read.rows, order).slice(0, limit);
  for (const issue of shown) {
    console.log(`${(issue.issueId ?? "").padEnd(8)} ${(issue.priority ?? "").padEnd(8)} `
      + `${(issue.status ?? "").padEnd(12)} ${issue.title}`);
  }
  console.log(`\n${countSaid(shown.length, read)}`);
  const said = shortOf(read, "This reading");
  if (said) console.log(said);
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

/* Asked before the parser reads a value, and before an endpoint is resolved: a token no verb takes
   is a local mistake, and answering it costs no credential and no call. */
const onlyFlags = (verb, argv, hidden = []) => {
  const said = unknownFlag(verb, argv, { usage: usageOf(verb), hidden });
  if (said) fail(said);
};

const suggestTool = async (name) =>
  didYouMean("tool", name, callable(await tools()).map((tool) => tool.name), "Ask `forge tools`.");

/* The one verb whose help is longer than its row: what a body is read against depends on the kind
   it names, and the table of that is the kinds' own. */
/* Two names, and the one place they are stated: `attach` reads its target from them. */
const ATTACH_TARGETS = ["issue", "comment"];

const NEW_USAGE = `${helpOf("new")}\n\n${BESIDE_HELP}\n\n${PRIORITY_HELP}\n\n${KINDS_HELP}`;

/* Its own, rather than the row's, for the reason `new` keeps one: the dozen lines below are what a
   row cannot hold. A row's blurb is one line, and a reader who has to be told what a `stale:` line
   means before they can act on one is a reader the row has already lost. */
const PROJECT_USAGE = [
  usageOf("project"),
  "the id, the branches a change lands on, the staging deploy to walk it against, and the",
  "project's brief — the one entry Phase 0 reads instead of learning the repository by hand.",
  "",
  "The brief prints with a `stale:` line naming which of the files it was read from have moved",
  "since, so a run refreshes the lines those files carried and spends one call on the rest.",
  "--refresh takes the corrected brief itself: nothing here writes its prose, because no program",
  "reads a repository's dangers out of its README. The digests are stamped from that same body in",
  "the same call, which is what stops a re-stamp of a brief nobody corrected.",
  "",
  "The entry is `forge knowledge`'s in every other respect — one slug, `project-brief`, kind",
  "`overview`, injection `always` — and --title, --confidence and --meta mean there what they mean",
  "here. Injection is not a flag: a brief a session has to ask for is the call this entry removes.",
].join("\n");

export const commands = {
  doctor,
  claim,
  resume,
  record,
  advance,
  spec,
  deps,
  knowledge,
  cloudflare,
  feedback,
  codex,
  hooks,
  tools: async (rest) => {
    onlyFlags("tools", rest);
    const { all } = flags(rest, "tools", ["--all"]);
    for (const tool of await tools()) {
      if (all || !isGated(tool.name)) console.log(tool.name);
    }
  },
  schema: async ([name, ...rest]) => {
    if (!name) fail(usageOf("schema"));
    onlyFlags("schema", rest, ["--all"]);
    const { all } = flags(rest, "schema", ["--all"]);
    const tool = await toolNamed(name);
    if (!tool) fail(await suggestTool(name));
    refuseIfGated(name, all);
    show({ description: tool.description, inputSchema: trimPatterns(tool.inputSchema) });
  },
  call: async (argv) => {
    const [name, json] = argv;
    if (!name) fail(usageOf("call"));
    onlyFlags("call", argv);
    if (!(await toolNamed(name))) fail(await suggestTool(name));
    refuseIfGated(name);
    const raw = json === undefined || json === "-" || json.startsWith("@") ? await bodyFrom(json ?? "-") : json;
    if (json === undefined || json === "-") keepOnFailure(`Your payload, so that nothing loses it:\n\n${raw}`);
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
       file or from stdin, which the hook reading the command line cannot see. Told what is open
       beside the filing and never folded onto it: this route asked for a create. */
    let beside = null;
    for (const filing of filingsOf({ name: `mcp__forge__${name}`, input: args })) {
      const read = await readFiling(filing);
      beside = await neighboursOf(read.shape, read.live);
    }
    const wrote = Boolean(resolved.data);
    const answer = wrote ? await write(name, resolved) : await scoped(name, resolved);
    credited(name, resolved, answer);
    keepOnFailure(null);
    show(answer);
    if (beside) sayBeside(beside);
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
    printIssues(await everyIssue(filters), limit, await enumAt("forge_issues", PRIORITY_AT));
  },
  /* Three tiers, and the payload is what costs. Fetch narrow, then fetch again. */
  issue: async ([reference, ...rest]) => {
    if (!reference) fail(usageOf("issue"));
    onlyFlags("issue", rest);
    const { fields, full } = flags(rest, "issue", ["--full"]);
    const names = fields ? fields.split(",").map((name) => name.trim()) : null;
    if (names) await checkNames(names, "forge_issues", ["fields", "items", "enum"], "field");
    const documentId = await documentIdOf(reference);
    const body = filled(
      await scoped("forge_issues", { action: "get", documentId, ...(names ? { fields: names } : {}) }),
    );
    show(inFlowWords(full ? body : terse(body)));
  },
  /* `open` marks the active set; `draft` never dispatches. A filing is read before it is made,
     because the flow costs the same for one line as for a feature: how/issue-shape.md. */
  new: async (argv) => {
    if (wantsHelp(argv)) return console.log(NEW_USAGE);
    const [path, ...rest] = argv;
    if (!path) fail(usageOf("new"));
    const row = { usage: usageOf("new"), hidden: INSTEAD_FLAGS };
    if (path.startsWith("--")) fail(unknownFlag("new", [path], row) ?? notABody(path));
    onlyFlags("new", rest, INSTEAD_FLAGS);
    const { into, with: rides, size, kind, priority, new: fresh, ...given } = flags(rest, "new", ["--new"]);
    if (!given.title) fail("An issue needs --title; the tracker refuses an untitled one.");
    if (size !== undefined && !SIZE_WORDS.includes(size)) {
      fail(`${didYouMean("size", size, SIZE_WORDS)} It is the one size the contract gives a light`
        + " path, and a whole issue needs none.");
    }
    if (kind !== undefined && !KIND_NAMES.includes(kind)) fail(kindRefusal(kind));
    const instead = insteadOf(given);
    if (instead) fail(instead);
    /* Before the body is read, and the default answers to the same set a typed rank does. */
    const ranked = await rankOf(priority);
    if (ranked.refusal) fail(ranked.refusal);
    /* Presence, never truth: the shared parser takes an empty string as a value, and a route read
       by truthiness would drop `--into ""` on the floor and file the issue instead. */
    const commenting = into !== undefined;
    const relating = rides !== undefined;
    if (commenting && relating) fail("--into posts a comment and --with files an issue. Ask for one of them.");
    if (commenting && fresh) {
      fail("--into posts the body on the issue you named and --new refuses to post it on an issue at "
        + "all. Ask for one of them.");
    }
    const named = [...(size === undefined ? [] : ["size"]), ...(kind === undefined ? [] : ["kind"]),
      ...(priority === undefined ? [] : ["priority"])];
    const filing = [...Object.keys(given).filter((one) => one !== "title"), ...named];
    if (commenting && filing.length) {
      fail(`--into posts a comment, and ${filing.map((one) => `--${one}`).join(", ")} belongs to a filing. `
        + "Drop it, or file the issue and comment on it separately.");
    }
    const body = await bodyFrom(path);
    /* Registered the moment there is something to lose, and only then: a body from a file is on
       disk, and one from stdin cannot be sent a second time. */
    if (path === "-") keepOnFailure(`Your body, so that nothing here loses it:\n\n${body}`);
    /* A comment is not an issue and owes none of the shape; the read the write owes is still owed,
       and it takes no lease, because a finding on an issue nobody holds is nobody's claim. */
    if (commenting) {
      const issue = await documentIdOf(into);
      await mustBeShown([{ ref: into, documentId: issue }]);
      return show(await postComment(issue, `## ${given.title}\n\n${body}`));
    }
    const description = size ? withMark(body) : body;
    const read = { title: given.title, body: description, kind: kind ?? null };
    const { shape, live } = await readFiling(read, { routed: relating });
    const beside = await neighboursOf(shape, live);
    const { joined, answer: comment, said } =
      await foldFiling(beside, { title: given.title, body: description, routed: relating, fresh });
    if (joined) {
      show(comment);
      keepOnFailure(null);
      console.log(foldedInto(joined));
      return sayBeside(beside, said);
    }
    const data = { description, status: "open", priority: ranked.value, ...given, ...trackerFields({ kind }) };
    if (relating) data.relations = [{ kind: "relates", blocksId: await documentIdOf(rides) }];
    const answer = await write("forge_issues", { action: "create", data });
    keepOnFailure(null);
    show(inFlowWords(answer));
    console.log(filedAs(answer, ranked.said));
    return sayBeside(beside, said);
  },
  comment: async (argv) => {
    onlyFlags("comment", argv);
    const [reference, path] = argv;
    if (!reference || !path) fail(usageOf("comment"));
    const issue = await documentIdOf(reference);
    await renew(issue, reference);
    show(await postComment(issue, await bodyFrom(path)));
  },
  /* A plan is a field, not a comment: one value, replaced rather than accumulated. Read back before
         reporting success — a field accepted and dropped answers 200 like one that was stored. */
  plan: async (argv) => {
    onlyFlags("plan", argv);
    const [reference, path] = argv;
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
  attach: async (argv) => {
    onlyFlags("attach", argv);
    const [target, targetRef, ...paths] = argv;
    if (!target || !targetRef || !paths.length) fail(usageOf("attach"));
    if (!ATTACH_TARGETS.includes(target)) fail(didYouMean("attach target", target, ATTACH_TARGETS));
    const targetId = target === "issue" ? await documentIdOf(targetRef) : targetRef;
    /* One name on one issue names one document, whichever verb attached it (ISS-137), and the read
       comes before the first PUT: what is up can be neither deleted nor replaced, so a collision
       seen afterwards is one nobody can clear. A comment id names no issue, here as for the lease
       below, so that route reads no names and refuses on none. */
    if (target === "issue") {
      const [page, body] = await Promise.all([
        commentPage(targetId),
        scoped("forge_issues", { action: "get", documentId: targetId }),
      ]);
      const cut = page.hasMore ? cutLine(page) : null;
      const read = uploadRead(paths, attachmentNames(body, page.comments), { reference: targetRef, cut });
      if (read.refusal) fail(read.refusal);
      if (read.said) console.error(read.said);
    }
    for (const path of paths) {
      /* Every payload write renews, uploads included; a comment id names no issue to read a lease
         from, and the tracker offers no route from one to the other. */
      if (target === "issue") await renew(targetId, targetRef);
      await uploadTo(target, targetId, path);
    }
  },
  /* An edge changes the order the blocked issue is worked in, so its lease is the one that covers
     the write: a new issue filed to block the one in hand renews the one in hand. */
  dep: async (argv) => {
    onlyFlags("dep", argv);
    const [from, to, kind = "blocks"] = argv;
    if (!from || !to) fail(usageOf("dep"));
    const [fromIssueId, toIssueId] = await Promise.all([documentIdOf(from), documentIdOf(to)]);
    await notAnothers(fromIssueId, from);
    await renew(toIssueId, to);
    show(await write("forge_project_pm", { action: "set_dependency", fromIssueId, toIssueId, kind }));
  },
  /* Read through this plugin's disposition of them, which tracker/guides.mjs holds and explains. A
     held slug is answered as a slug the tracker never served, through that refusal's own call site
     so the two answers cannot drift apart, and its body is never fetched: hiding a page an agent
     cannot follow comes before naming it, and a line saying one exists and is stale is what makes
     an agent go read it. --tracker is the maintainer's way past that, and the only one. The
     contract is this plugin's own and on disk, so it is answered before the transport is touched —
     an installed copy with no tracker reachable still reads the rule. */
  guide: async (argv) => {
    const { positionals, flagArgv } = partition(argv, ["--tracker"]);
    onlyFlags("guide", flagArgv, ["--tracker"]);
    const asked = flags(flagArgv, "guide", ["--tracker"]);
    const [slug, ...extra] = positionals;
    if (slug === CONTRACT_SLUG) {
      const [part, ...rest] = extra;
      const answer = contractAnswer({ part, extra: rest, tracker: asked.tracker });
      if (answer.refusal) fail(`guide: ${answer.refusal}`);
      return console.log(answer.lines.join("\n"));
    }
    if (extra.length) fail(`guide: one slug, not \`${positionals.join(" ")}\`. ${usageOf("guide")}`);
    /* Echoing back a flag the caller typed, and saying nothing about what it does: what a copy or a
       credential cannot use is shown under `forge doctor` and nowhere else. */
    if (!slug && asked.tracker) fail(`guide: --tracker names no guide. ${usageOf("guide")}`);
    const listed = async () => {
      const rows = rowsOf(await scoped("forge_guide", { action: "list" }), "guides");
      const shown = new Set(visibleGuides(rows.map((one) => one.slug)));
      return rows.filter((one) => shown.has(one.slug));
    };
    if (!slug) {
      console.log(CONTRACT_ROW);
      for (const guide of await listed()) console.log(`${guide.slug}\n  ${guide.summary}`);
      return;
    }
    const row = dispositionOf(slug);
    /* The one place a slug the verb does not serve is refused, so a held one and an unserved one
       answer in the same words. A held slug reaches it without the get: the body is not wanted. */
    const noSuchGuide = async () =>
      fail(didYouMean("guide", slug, [CONTRACT_SLUG, ...(await listed()).map((one) => one.slug)],
        "`forge guide` lists the guides this plugin stands behind."));
    if (row && !asked.tracker) await noSuchGuide();
    const answer = await scoped("forge_guide", { action: "get", slug }, true);
    if (answer?.refused) await noSuchGuide();
    /* `trackerHeader` answers on every path, a row or none, so --tracker alone decides the header. */
    if (asked.tracker) console.log(`${trackerHeader(row).join("\n")}\n`);
    /* Markdown, not Markdown escaped inside JSON: every `\n` tokenizes worse than the character. */
    show(answer?.guide?.body ?? answer);
  },
  project: async (argv) => {
    if (wantsHelp(argv)) return console.log(PROJECT_USAGE);
    onlyFlags("project", argv);
    const { values: pairs, rest } = pullRepeated(argv, "--meta", "project");
    const asked = flags(rest, "project", ["--credentials"]);
    const said = asked.refresh
      ? await refreshBrief(asked.refresh, { ...asked, pairs })
      : [
        ...projectLines({
          id: await projectId(),
          policy: await releasePolicy(),
          deploy: await stagingDeploy(),
          credentials: Boolean(asked.credentials),
        }),
        ...briefLines(await readBrief()),
      ];
    for (const line of said) console.log(line);
  },
};

commands.project.answersHelp = true;

commands.new.answersHelp = true;
commands.feedback.answersHelp = true;
