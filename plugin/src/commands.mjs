import { fail, keepOnFailure } from "./resolve/settings.mjs";
import { bodyFrom, notABody } from "./resolve/payload.mjs";
import { projectId, REFERENCE_KEYS, enumAt, scoped, toolNamed, tools, write } from "./tracker/rpc.mjs";
import {
  DEFAULT_LIMIT,
  FIELDS_AT,
  MAX_LIMIT,
  documentIdOf,
  everyIssue,
  projectedTo,
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
  filedAs,
  inFlowWords,
  insteadOf,
  kindRefusal,
} from "./tracker/issue-shape.mjs";
import { BESIDE_HELP, foldedInto, suggestionLines } from "./tracker/neighbours.mjs";
import { filedOrFail, rankFor, readFiling } from "./tracker/filing.mjs";
import { TIERS } from "./ladder.mjs";
import { filingsOf, targetsOfTool } from "./tracker/issue-read.mjs";
import { callable, helpOf, isGated, refuseIfGated, usageOf } from "./resolve/visibility.mjs";
import { didYouMean, unknownFlag } from "./suggest.mjs";
import { flags, partition, pullRepeated, wantsHelp } from "./resolve/flags.mjs";
import { LOCAL_ROWS, LOCAL_SLUGS, dispositionOf, localGuide, trackerHeader, visibleGuides } from "./guides/guides.mjs";
import { briefLines, confirmSource, projectLines, readBrief, refreshBrief, releasePolicy,
  replaceBriefLine, stagingDeploy } from "./tracker/project-config.mjs";
import { doctor } from "./tools/doctor.mjs";
import { deps } from "./tools/deps.mjs";
import { next } from "./rank/next.mjs";
import { cloudflare } from "./tools/cloudflare.mjs";
import { knowledge } from "./tools/knowledge.mjs";
import { feedback } from "./tools/feedback.mjs";
import { codex } from "./codex/codex.mjs";
import { bodyChecked } from "./codex/codex-read.mjs";
import { stats } from "./stats/runs.mjs";
import { hooks } from "./hooks/hook-log.mjs";
import { record } from "./flow/record.mjs";
import { advance } from "./flow/advance.mjs";
import { spec } from "./spec/verbs.mjs";
import { citationProblems, citationRefusal, revisionSaid, unrevisionedIn } from "./spec/citation.mjs";
import { hasTree, specTree } from "./spec/tree.mjs";
import { claim } from "./flow/claim.mjs";
import { resume } from "./flow/resume.mjs";
import { notAnothers, renew } from "./flow/lease.mjs";

const show = (value) =>
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));

/* Resolved before anything is sent, and only where the project keeps a tree: a plan is one field
   replaced rather than accumulated, so a refusal costs the author nothing but the clause they meant,
   while a wrong citation stored is one the spec gate reports about a plan nobody is holding. */
const citationsChecked = (text) => {
  if (!hasTree()) return;
  const index = specTree();
  const refusal = citationRefusal(citationProblems(index, text));
  if (refusal) fail(refusal);
  const said = revisionSaid(unrevisionedIn(index, text));
  if (said) console.error(said);
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

/* Two names, and the one place they are stated: `attach` reads its target from them. */
const ATTACH_TARGETS = ["issue", "comment"];

/* Longer than the row it comes from, because what a body is read against depends on the kind it
   names, and the table of that is the kinds' own. */
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
  "since. Nothing here writes the brief's prose, because no program reads a repository's dangers",
  "out of its README — so a stale line is judged by a run and closed by whichever of these it is:",
  "",
  "  --confirm <source>   the lines naming that source were read against the file as it now is",
  "                       and their prose still holds, so the digest alone is re-stamped and the",
  "                       body goes back byte for byte. The lines it covered are printed.",
  "  --line <n> <text>    one line's prose, replaced. A digest is a path's and not a line's, so a",
  "                       source another line also reads is left stale and that line is named.",
  "  --refresh <body>     the whole brief, for one being rewritten on purpose. Its digests are",
  "                       stamped from that same body in the same call.",
  "",
  "The entry is `forge knowledge`'s in every other respect — one slug, `project-brief`, kind",
  "`overview`, injection `always` — and --title, --confidence and --meta mean there what they mean",
  "here. Injection is not a flag: a brief a session has to ask for is the call this entry removes.",
].join("\n");

/* Three ways to write one entry, and a call takes one: silently preferring a route would leave the
   caller reading a success about the write they did not ask for. The body's fields are refused
   beside a narrow write rather than ignored, since the narrow writes carry them forward untouched. */
const WRITES = ["refresh", "confirm", "line"];
const WITH_BODY = ["title", "confidence"];

const briefRoute = async (asked, pairs, positionals) => {
  const asks = WRITES.filter((one) => asked[one] !== undefined);
  if (asks.length > 1) {
    fail(`project: ${asks.map((one) => `--${one}`).join(" and ")} each write the brief a different `
      + "way and one call takes one — --refresh the whole body, --confirm one source's digest, "
      + "--line one line's prose.");
  }
  const carried = [...WITH_BODY.filter((one) => asked[one] !== undefined), ...(pairs.length ? ["meta"] : [])];
  if (carried.length && asks.length && asks[0] !== "refresh") {
    fail(`project: ${carried.map((one) => `--${one}`).join(" and ")} are written with a body, so `
      + `they belong to --refresh. --${asks[0]} carries the stored entry's forward untouched.`);
  }
  if (positionals.length && asked.line === undefined) {
    fail(`project: \`${positionals[0]}\` names no flag, and this verb takes no argument of its own. `
      + "The prose of a line is --line's: forge project --line <n> <text>");
  }
  if (asked.line !== undefined && positionals.length !== 1) {
    fail("project: --line takes the line's number and the one line of prose replacing it, so quote "
      + `that prose as a single argument: forge project --line <n> <text>${positionals.length
        ? ` — ${positionals.length} arrived after it` : ""}`);
  }
  if (asked.confirm !== undefined) return confirmSource(asked.confirm);
  if (asked.line !== undefined) return replaceBriefLine(asked.line, positionals[0]);
  if (asked.refresh !== undefined) return refreshBrief(asked.refresh, { ...asked, pairs });
  return [
    ...projectLines({
      id: await projectId(),
      policy: await releasePolicy(),
      deploy: await stagingDeploy(),
      credentials: Boolean(asked.credentials),
    }),
    ...briefLines(await readBrief()),
  ];
};

export const commands = {
  doctor,
  claim,
  resume,
  record,
  advance,
  spec,
  deps,
  next,
  knowledge,
  cloudflare,
  feedback,
  codex,
  hooks,
  stats,
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
      if (read.refusal) fail(read.refusal.text);
      if (read.shape.said) console.error(read.shape.said);
      beside = read.beside;
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
    const declared = names ? await enumAt("forge_issues", FIELDS_AT) : [];
    const narrow = Boolean(names) && names.every((one) => declared.includes(one));
    const documentId = await documentIdOf(reference);
    const answer = inFlowWords(await scoped("forge_issues",
      { action: "get", documentId, ...(narrow ? { fields: names } : {}) }));
    const body = filled(names && !narrow ? projectedTo(answer, names, declared) : answer);
    show(full ? body : terse(body));
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
    if (size !== undefined && !TIERS.includes(size)) {
      fail(`${didYouMean("size", size, TIERS)} They are the contract's three rungs, smallest first,`
        + " and the two below the top are the ones it gives a light path.");
    }
    if (kind !== undefined && !KIND_NAMES.includes(kind)) fail(kindRefusal(kind));
    const instead = insteadOf(given);
    if (instead) fail(instead);
    /* Before the body is read: a stdin payload cannot be sent twice, and a rank the tracker's own
       set does not carry is knowable without it. The filing takes the answer rather than asking
       again, so one filing costs one reading of that set. */
    const rank = await rankFor(priority);
    if (rank.refusal) fail(rank.refusal.text);
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
    const { title, ...carried } = given;
    const filed = await filedOrFail({
      title,
      body,
      kind: kind ?? null,
      ranked: rank.ranked,
      size,
      fields: carried,
      routed: relating,
      fresh,
      relations: relating ? [{ kind: "relates", blocksId: await documentIdOf(rides) }] : null,
    });
    if (filed.shape.said) console.error(filed.shape.said);
    if (filed.joined) {
      show(filed.answer);
      keepOnFailure(null);
      console.log(foldedInto(filed.joined));
      return sayBeside(filed.beside, filed.said);
    }
    keepOnFailure(null);
    show(inFlowWords(filed.answer));
    console.log(filedAs(filed.answer, filed.ranked.said));
    return sayBeside(filed.beside, filed.said);
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
    /* Read before the reference is resolved: a round trip between two reads is a second file. */
    const plan = await bodyChecked(path, fail);
    if (!plan.trim()) fail("An empty plan would clear the field; pass the plan itself.");
    citationsChecked(plan);
    const documentId = await documentIdOf(reference);
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
  /* Read through this plugin's disposition of them, which guides/guides.mjs holds and explains. A
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
    /* This copy's own guides — the contract and each skill's method — answer off disk through one
       registry, so the verb compares no slug against a constant of its own. */
    const local = localGuide(slug);
    if (local) {
      const [part, ...rest] = extra;
      const answer = local({ part, extra: rest, tracker: asked.tracker });
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
      for (const row of LOCAL_ROWS) console.log(row);
      if (isGated("forge_guide")) return console.log("The tracker's guides are withheld from this credential: `forge doctor`.");
      for (const guide of await listed()) console.log(`${guide.slug}\n  ${guide.summary}`);
      return;
    }
    refuseIfGated("forge_guide");
    const row = dispositionOf(slug);
    /* The one place a slug the verb does not serve is refused, so a held one and an unserved one
       answer in the same words. A held slug reaches it without the get: the body is not wanted. */
    const noSuchGuide = async () =>
      fail(didYouMean("guide", slug, [...LOCAL_SLUGS, ...(await listed()).map((one) => one.slug)],
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
    /* `--line <n> <text>` is two words, and partition is what already reads a value beside a
       positional: a fourth parse shape in resolve/flags.mjs for one verb is the drift it warns of. */
    const { positionals, flagArgv } = partition(rest, ["--credentials"]);
    const asked = flags(flagArgv, "project", ["--credentials"]);
    for (const line of await briefRoute(asked, pairs, positionals)) console.log(line);
  },
};

commands.project.answersHelp = true;

commands.new.answersHelp = true;
commands.feedback.answersHelp = true;
