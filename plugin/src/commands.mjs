import { fail, keepOnFailure } from "./resolve/settings.mjs";
import { bodyFrom, notABody } from "./resolve/payload.mjs";
import { declaredFor, refuseUndeclared, refuseUnreadableDate, scoped, write } from "./tracker/rest.mjs";
import { EDGE_KINDS, edgeRow, otherOf } from "./tracker/edges/kinds.mjs";
import { partsAmong } from "./tracker/routes.mjs";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  documentIdOf,
  everyIssue,
  projectedTo,
  queued,
  rowLine,
  rowsOf,
  shortOf,
} from "./tracker/issues.mjs";
import { commentPage, cutIn, mustBeShown, postComment, readThread } from "./tracker/comments.mjs";
import { attachmentNames, uploadAll, uploadRead, urlBearing } from "./tracker/evidence.mjs";
import {
  KINDS_HELP,
  KIND_NAMES,
  complexityRefusal,
  kindNeeded,
  kindRefusal,
} from "./tracker/issue-shape.mjs";
import { keysFrom, rankFor } from "./tracker/filing/route.mjs";
import { fileAndSay } from "./tracker/filing/say.mjs";
import { routingBlock } from "./tracker/filing/plugin-defect.mjs";
import { commentLanded, sayLanded } from "./tracker/filing/landed.mjs";
import { COMPLEXITY_NAMES } from "./ladder.mjs";
import { helpOf, isGated, refuseIfGated, skillRefusal, usageOf } from "./resolve/visibility.mjs";
import { didYouMean } from "./suggest.mjs";
import { exclusive, flags, partition, pullRepeated, unknownFlag, wantsHelp } from "./resolve/flags.mjs";
import { dispositionOf, localGuide, localRows, localSlugs, trackerHeader, visibleGuides, withholds } from "./guides/guides.mjs";
import { briefGoals, servesOwed } from "./tracker/knowledge/brief.mjs";
import { goalBlock } from "./goals.mjs";
import { finderSaid, notAnothers, renew } from "./flow/lease.mjs";
import { retiredFlagIn } from "./resolve/retiring.mjs";

const show = (value) =>
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));

/* Every entry of the table below is a loader: called with nothing, it answers with the verb's own handler and runs none of it. The table named all nineteen verb modules at the top of this file until ISS-1775, so `forge -h` loaded every verb's imports to print a list of names and any one verb cost the lot. A specifier here is the only place a verb's module is named, which is what `sourceFor` in checks/surface/judged-arguments.mjs reads to find where a verb judges its arguments. */
const loads = (module, name) => async () => (await import(module))[name];

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

const limitFrom = (raw) => {
  if (raw === undefined) return DEFAULT_LIMIT;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_LIMIT) {
    fail(`--limit takes an integer from 1 to ${MAX_LIMIT}, not \`${raw}\`.`);
  }
  return value;
};

/* Floor 0 and no ceiling: the offset indexes the set the walk already holds, so a page past its end is an answer and not a refusal, and page one is not a number to be refused for naming (ISS-1150). */
const offsetFrom = (raw) => {
  if (raw === undefined) return 0;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) fail(`--offset takes an integer from 0 up, not \`${raw}\`.`);
  return value;
};

/* The footer below is a command a reader pastes, so a value a shell would split travels quoted. */
const typedBack = (value) => (/^[\w.:@/-]+$/u.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`);

/* The next page's whole call in the caller's own terms, because a footer naming a flag already at its ceiling is the unactionable advice ISS-264 was closed on. */
const nextCall = (asked, offset) => [
  "forge issue",
  ...Object.entries(asked.filters)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `--${name} ${typedBack(String(value))}`),
  ...(asked.raw === undefined ? [] : [`--limit ${asked.limit}`]),
  ...(asked.fields ? [`--fields ${typedBack(asked.fields.join(","))}`] : []),
  `--offset ${offset}`,
].join(" ");

/* Every matching row being in hand, the only cut left is the printed one — by the order above and at the offset this call named, so the route past that cut is the offset and never `--limit`. */
const countSaid = (shown, read, asked) => {
  const total = read.rows.length;
  const behind = total - asked.offset - shown;
  const over = `${read.pages} page(s)`;
  if (shown === 0 && asked.offset > 0) {
    return total
      ? `Nothing at offset ${asked.offset}: ${total} issue(s) match this ask over ${over}, the last`
        + ` of them at offset ${total - 1}, so a walk by offset ends here.`
      : `Nothing at offset ${asked.offset}: nothing matches this ask at all, over ${over}.`;
  }
  const held = asked.offset
    ? `${asked.offset + 1} to ${asked.offset + shown} of ${total} issue(s) over ${over}`
    : `${shown === total ? total : `${shown} of ${total}`} issue(s) over ${over}`;
  return behind > 0
    ? `${held}. The ${behind} behind this page are the tail of the order above, and this call prints`
      + ` the next page of them:\n  ${nextCall(asked, asked.offset + shown)}`
    : `${held}${read.whole ? ", which is every row matching this ask." : "."}`;
};

/* One line per issue: the uuid column was 22% of this verb and bought nothing, and the rank is here
   because an order a reader cannot see reads as a shuffle. */
const printIssues = (read, asked, order) => {
  const shown = queued(read.rows, order).slice(asked.offset, asked.offset + asked.limit);
  /* Judged against a row the walk holds rather than one this page prints, so a name nobody carries is a typo at any offset; a set that came back empty has no row to judge one against and the count line is what that caller reads. */
  if (asked.fields && read.rows.length) rowLine(read.rows[0], asked.fields);
  for (const issue of shown) {
    console.log(asked.fields
      ? rowLine(issue, asked.fields)
      : `${(issue.issueId ?? "").padEnd(8)} ${(issue.priority ?? "").padEnd(8)} `
        + `${(issue.status ?? "").padEnd(12)} ${issue.title}`);
  }
  const say = asked.fields ? console.error : console.log;
  say(`${asked.fields ? "" : "\n"}${countSaid(shown.length, read, asked)}`);
  const said = shortOf(read, "This reading");
  if (said) say(said);
};

const fieldsIn = (given) =>
  (given ? { fields: given.split(",").map((name) => name.trim()) } : {});

export const LIST_USAGE = "Usage: forge issue [--status s] [--search q] [--limit n] [--offset n] [--fields a,b]";
/* Seventeen names are a list rather than a sentence, so the route out is where they are counted. */
const STATUSES_SEEN = "`forge doctor` counts the statuses this project's issues carry.";

export const READ_USAGE = "Usage: forge issue <uuid|ISS-45> [--fields a,b] [--full] [--set f=v... --why W]"
  + " [--blocks ISS-46|--relates ISS-46|--unlink ISS-46 --kind k]";

/* The one thing a row cannot hold: what this project's own configuration does to a value before it is stored, which a caller otherwise learns by reading the body back. Which language, which file it came from and which setting are `forge doctor`'s to name, so none of the three is here (ISS-1790). */
const SET_PROSE = "`--set f=v` sends the value through this project's prose language, and so goes the rest of\n"
  + "the prose the same command writes, its `--why` note included: where one is set, none of it is\n"
  + "stored as you typed it — it is rewritten first, or the write refuses where this CLI does not\n"
  + "write that language. `forge doctor` names the language, where it was read from, and the\n"
  + "setting that stores prose unchanged.";

/* Which of this verb's two outputs a program may key on, said where a caller looks for it: a column added to the browse rows once moved a positional parse one field along, and it kept finding the right issue and reading the wrong word off it (ISS-174). */
const WHICH_SURFACE = "The rows a call prints with no `--fields` are for a person to read. Which columns they are,\n"
  + "and in what order, is a judgement that has changed and will change again, so nothing keys on\n"
  + "their positions. `--fields a,b` is the surface a program reads: a listed row is the names asked\n"
  + "for, in the order asked; one issue is those names and the two identifiers, keyed by name. One\n"
  + "issue's status on its own is `forge issue ISS-45 --fields status`.";

/* One line per flag, then the one table a row cannot hold: what a body is read against depends on the kind it names. What is open beside a filing prints on the filing, and which rank it took is in the reply — the reasoning behind both is docs/cli/beside.md and docs/cli/new.md, whose second copy this help was. */
const NEW_FLAGS = [
  "  --title T      what is true once this is fixed, one line",
  `  --category C   ${KIND_NAMES.join(" | ")} — the shape the body is read against`,
  "  --status S     the status to file at; the tracker's own default absent one",
  "  --priority P   the tracker's own set; absent, the filing is unranked and the reply says so",
  `  --complexity C ${COMPLEXITY_NAMES.join(" | ")} — the tracker's field, and the one source of the rung`,
  "  --with ISS-45  file it with a `relates` edge to that issue, or to several separated by commas",
  "  --new          file it even where it would have folded onto a neighbour, and say which",
].join("\n");

/* The kinds table comes before the goals list: every filing reads the table to pick a category and
   its required sections, and most name no `Serves:` line at all (`none stated` is legal), so a
   `head` short of the whole text reaches the table it needs before the goals list it usually does
   not (ISS-2028). The goals are the project's own lines, read here rather than named: a caller who
   has to ask which goals there are has spent a round to write the `Serves:` line a filing carries. */
const newUsage = (goals) =>
  [helpOf("new"), NEW_FLAGS, KINDS_HELP, routingBlock(), goalBlock(goals, "A body filed here").join("\n")]
    .join("\n\n");

/* What each kind means, and the column each answer below is read off: tracker/edges/kinds.mjs. */
const kindOf = (edge) => edge?.kind ?? "an unnamed kind";

const kindBelongsTo = (wrote) =>
  `issue: --kind names which edge --unlink removes, and this call ${wrote === undefined
    ? "removes none — a read takes no kind"
    : `asks for --${wrote}, which names its own`}. Nothing was sent.`;

/* The edge id is the tracker's and no caller holds one, so the removal reads the pair's edges — all
   of them, the first of an object's values being an insertion order rather than an answer. */
const edgesBetween = async (subjectId, subject, otherId, other) => {
  const held = await scoped("forge_issues", { action: "get", documentId: subjectId, fields: ["relations"] });
  const found = Object.values(held?.relations ?? {}).flat()
    .filter((edge) => edge.otherIssueId === otherId);
  if (!found.length) {
    fail(`issue: ${subject} and ${other} have no edge between them, so there is none to remove and `
      + `nothing was sent. \`forge issue ${subject} --fields relations\` prints what it does have.`);
  }
  return found;
};

/* One edge, or a refusal saying which it could not do: name an edge the pair has, or name one of
   them. `--kind` is offered only for a kind that selects exactly one edge, so no route out refuses. */
const oneEdgeOf = (held, subject, other, kind) => {
  const wanted = kind === undefined ? held : held.filter((edge) => edge.kind === kind);
  if (wanted.length === 1) return wanted[0];
  const has = [...new Set(held.map(kindOf))].join(", ");
  const apart = [...new Set((wanted.length ? wanted : held).map((edge) => edge.kind))]
    .filter((one) => EDGE_KINDS.includes(one) && held.filter((edge) => edge.kind === one).length === 1);
  const said = wanted.length
    ? `${subject} and ${other} have ${wanted.length} edges between them, ${has}, and --unlink removes one`
    : `${subject} and ${other} have no ${kind} edge between them, and what they do have is ${has}`;
  fail(`issue: ${said}. Nothing was sent. ${apart.length
    ? `Name which:\n  forge issue ${subject} --unlink ${other} --kind ${apart[0]}`
    : `Read them with the id the tracker holds each under:\n  forge issue ${subject} --fields relations`}`);
  return null;
};

const wroteEdge = async (subject, asked) => {
  const kind = EDGE_KINDS.find((one) => asked[one] !== undefined);
  const other = kind ? asked[kind] : asked.unlink;
  const [subjectId, otherId] = await Promise.all([documentIdOf(subject), documentIdOf(other)]);
  if (subjectId === otherId) {
    fail(`issue: ${subject} and ${other} are one issue, and an issue neither blocks nor relates to `
      + "itself. Nothing was sent.");
  }
  /* The end the kind's row names is the end the route is taken against, and a removal is taken
     against the subject, whose row holds the edge id. Neither end is claimed for an edge, and the
     live check asks after the row this call writes and not the other (ISS-1423). */
  const row = edgeRow(kind);
  const written = row?.writtenOn === "other"
    ? { id: otherId, ref: other, dependsOnId: subjectId }
    : { id: subjectId, ref: subject, dependsOnId: otherId };
  const renewed = await renew(written.id, written.ref, undefined, null, { finder: true });
  await notAnothers(written.id, written.ref);
  console.log(finderSaid(written.ref, renewed));
  if (!row) {
    const found = oneEdgeOf(await edgesBetween(subjectId, subject, otherId, other), subject, other, asked.kind);
    await write("forge_issues", { action: "unlink_edge", documentId: subjectId, edgeId: found.edgeId });
    return `${subject} —/— ${other}: removed the ${kindOf(found)} edge to `
      + `${otherOf(found) ?? "the other end"}.`;
  }
  await write("forge_issues", { action: "link", documentId: written.id,
    data: { dependsOnId: written.dependsOnId, kind } });
  return `${subject} ${kind} ${other}: written on the ${written.ref} dependency route, and reads back `
    + `under ${row.readsBack} there.`;
};

/* The five this table answers itself: each is a handler like an imported verb's, and `commands` below hands every one of them over by the same loader an imported verb gets, so the dispatch has one contract to hold and no entry of it is a handler to be called by mistake. */
const own = {
  /* One verb, two asks, and a flag of one is a stranger to the other, so each path hands the parser its own text and names the other as its `modes`: a combined set would take `--status` beside a key and answer nothing about it, and one text alone called the other's flag a flag nobody has (ISS-932). */
  issue: async (argv) => {
    if (wantsHelp(argv)) return console.log(`${helpOf("issue")}\n\n${WHICH_SURFACE}\n\n${SET_PROSE}`);
    const [first, ...rest] = argv;
    if (first === undefined || first.startsWith("--")) {
      const declared = declaredFor("forge_issues", "filters").map((one) => `--${one}`);
      const { limit: raw, offset: atRaw, fields: named, ...filters } = flags(argv, "issue", [], { usage: LIST_USAGE, hidden: declared, modes: [READ_USAGE] });
      /* Each named at its own call, not looped: the value a caller typed is what the judge is handed, and a loop would name the field and pass whatever the loop held (ISS-936). */
      refuseUndeclared("issue", "status", filters.status,
        { values: declaredFor("forge_issues", "status"), hint: STATUSES_SEEN });
      refuseUndeclared("issue", "statusNot", filters.statusNot,
        { field: "status", values: declaredFor("forge_issues", "status"), hint: STATUSES_SEEN });
      refuseUndeclared("issue", "priority", filters.priority,
        { values: declaredFor("forge_issues", "priority") });
      refuseUndeclared("issue", "category", filters.category, { values: KIND_NAMES });
      refuseUndeclared("issue", "complexity", filters.complexity, { values: COMPLEXITY_NAMES });
      /* The three whose values are a shape, so no declared set reaches them and the checker holding the five above cannot either (ISS-1081). */
      refuseUnreadableDate("issue", "createdAfter", filters.createdAfter);
      refuseUnreadableDate("issue", "createdBefore", filters.createdBefore);
      refuseUnreadableDate("issue", "updatedAfter", filters.updatedAfter);
      const asked = { filters, raw, limit: limitFrom(raw), offset: offsetFrom(atRaw), ...fieldsIn(named) };
      return printIssues(await everyIssue(filters), asked, declaredFor("forge_issues", "priority"));
    }
    const reference = first;
    const pulled = pullRepeated(rest, "--set", "issue", { usage: READ_USAGE, boolean: ["--full"], modes: [LIST_USAGE] });
    const { fields, full, why, ...single } = flags(pulled.rest, "issue", ["--full"], { usage: READ_USAGE, modes: [LIST_USAGE] });
    const asked = { ...single, ...(pulled.values.length ? { set: pulled.values } : {}) };
    const [wrote] = exclusive(asked, [...EDGE_KINDS, "unlink", "set"], "issue", "writes and a call makes one");
    /* Used or refused rather than read and dropped: `--kind` belongs to `--unlink` alone, and a call
       that named neither a kind this CLI serves nor a removal is turned away before anything is sent. */
    if (asked.kind !== undefined) {
      if (wrote !== "unlink") fail(kindBelongsTo(wrote));
      if (!EDGE_KINDS.includes(asked.kind)) {
        fail(`issue: --kind takes ${EDGE_KINDS.join(" or ")}, and \`${asked.kind}\` is neither. Nothing was sent.`);
      }
    }
    if (wrote === "set") {
      const { overrideFields } = await import("./flow/override.mjs");
      return overrideFields(reference, asked.set, why, { ask: pulled.ask });
    }
    if (wrote !== undefined) return console.log(await wroteEdge(reference, asked));
    if (why !== undefined) fail("--why belongs to --set; a read takes no reason.");
    const names = fieldsIn(fields).fields ?? null;
    const documentId = await documentIdOf(reference);
    /* The parts among the names ride along so the read skips the routes nothing asked for; the answer is the row whole either way, and the projection off it is this verb's own, which is why the names it cannot choose a route by are dropped here rather than sent to be refused. */
    const held = await scoped("forge_issues", { action: "get", documentId, ...(names ? { fields: partsAmong(names) } : {}) });
    const body = filled(names ? projectedTo(held, names) : held);
    show(full ? body : terse(body));
    return null;
  },
  /* `open` marks the active set; `draft` never dispatches. A filing is read before it is made, because the flow costs the same for one line as for a feature: how/issue-shape.md. */
  new: async (argv) => {
    if (wantsHelp(argv)) return console.log(newUsage(await briefGoals()));
    const [path, ...rest] = argv;
    if (!path) fail(usageOf("new"));
    const row = { usage: usageOf("new") };
    if (path.startsWith("--")) fail(unknownFlag("new", [path], row) ?? notABody(path));
    /* Before the unknown-flag route, whose nearest live name answers a question nobody asked. */
    const retired = retiredFlagIn("new", rest);
    if (retired) fail(retired);
    const { with: rides, complexity, category, priority, new: fresh, ...given } = flags(rest, "new", ["--new"], row);
    if (!given.title) fail("An issue needs --title; the tracker refuses an untitled one.");
    refuseUndeclared("new", "status", given.status,
      { values: declaredFor("forge_issues", "status"), hint: STATUSES_SEEN });
    if (complexity !== undefined && !COMPLEXITY_NAMES.includes(complexity)) fail(complexityRefusal(complexity));
    if (category !== undefined && !KIND_NAMES.includes(category)) fail(kindRefusal(category));
    const { keys: withKeys, refusal: badKeys } = keysFrom(rides);
    if (badKeys) fail(badKeys);
    const relating = withKeys.length > 0;
    if (category === undefined) fail(kindNeeded());
    /* Every refusal a call could not change is above this line, and this is the one call a filing
       makes before the body: a rank outside the tracker's own set is knowable without one, and the
       filing takes this answer rather than asking again. */
    const rank = await rankFor(priority);
    if (rank.refusal) fail(rank.refusal.text);
    const body = await bodyFrom(path);
    /* Registered the moment there is something to lose, and only then: a body from a file is on
       disk, and one from stdin cannot be sent a second time. */
    if (path === "-") keepOnFailure(`Your body, so that nothing here loses it:\n\n${body}`);
    const unnamed = await servesOwed(body, "This body's `Serves:` line");
    if (unnamed) fail(unnamed);
    const { title, ...carried } = given;
    return fileAndSay({
      title,
      body,
      kind: category,
      ranked: rank.ranked,
      complexity,
      fields: carried,
      routed: relating,
      fresh,
      relations: relating
        ? await Promise.all(withKeys.map(async (one) =>
          ({ kind: "relates", blocksId: await documentIdOf(one) })))
        : null,
    }, { withKeys });
  },
  /* One verb for one write: the holder's post renews the lease and a finder's takes nothing, read
     off the record rather than asked for, and said in the reply — a caller who thought they held the issue learns it here or not at all. `--title` frames a heading over the body. */
  comment: async (argv) => {
    const usage = usageOf("comment");
    const { positionals, flagArgv } = partition(argv, [], { verb: "comment", usage });
    const [reference, path] = positionals;
    if (!reference) fail(usage);
    const { title } = flags(flagArgv, "comment", [], { usage });
    const issue = await documentIdOf(reference);
    /* No body is the read: one verb for the thread, whichever direction it is going. */
    if (!path) {
      if (title !== undefined) fail("comment: --title frames a body, and this call names none. Drop it to read the thread.");
      return readThread(reference, issue, (said) => console.log(said));
    }
    await mustBeShown([{ ref: reference, documentId: issue }]);
    const body = await bodyFrom(path);
    const renewed = await renew(issue, reference, undefined, null, { finder: true });
    const posted = await postComment(issue, title === undefined ? body : `## ${title}\n\n${body}`);
    show(posted);
    console.log(finderSaid(reference, renewed));
    return sayLanded(await commentLanded(issue, posted, reference));
  },
  attach: async (argv) => {
    const { positionals } = partition(argv, [], { verb: "attach", usage: usageOf("attach") });
    const [target, targetRef, ...paths] = positionals;
    if (!target || !targetRef || !paths.length) fail(usageOf("attach"));
    /* The two names off the table that holds the routes they name, which is what `evidence.mjs` refuses on: here for the suggestion, since a caller who mistyped one is owed the nearest. */
    const targets = declaredFor("forge_uploads", "targets");
    if (!targets.includes(target)) fail(didYouMean("attach target", target, targets));
    const targetId = target === "issue" ? await documentIdOf(targetRef) : targetRef;
    /* One name on one issue names one document (ISS-137), and the read comes before the first
       request: what is up can be neither deleted nor replaced, so a collision seen afterwards is one
       nobody can clear. A comment id names no issue, so that route reads no names and refuses none. */
    if (target === "issue") {
      const [page, body] = await Promise.all([
        commentPage(targetId),
        scoped("forge_issues", { action: "get", documentId: targetId, fields: ["attachments"] }),
      ]);
      const cut = cutIn(page);
      const read = uploadRead(paths, attachmentNames(body, page.comments), { reference: targetRef, cut });
      if (read.refusal) fail(read.refusal);
      if (read.said) console.error(read.said);
    }
    /* The renewal rides the sending pass; a comment id names no issue to read a lease from. */
    await uploadAll(target, targetId, paths, {
      renewing: target === "issue" ? () => renew(targetId, targetRef) : undefined,
    });
  },
  /* Read through this plugin's disposition of them, which guides/guides.mjs holds and explains. A held slug is answered as one the tracker never served, through that refusal's own call site so the two cannot drift, and its body is never fetched: a line saying a page exists and is stale is what sends an agent to read it.
     --tracker is the maintainer's way past that, and the only one. The contract is on disk, so it is answered before the transport is touched. */
  guide: async (argv) => {
    const usage = usageOf("guide");
    const { positionals, flagArgv } = partition(argv, ["--tracker"], { verb: "guide", usage });
    const asked = flags(flagArgv, "guide", ["--tracker"], { usage });
    const [slug, ...extra] = positionals;
    const held = slug ? skillRefusal(slug) : null;
    if (held) fail(`guide: ${held}`);
    /* Which phases an issue still owes is the tracker's to say, so the offline registry stays so. */
    if (asked.for) {
      if (extra.length) fail(`guide: --for takes the slug alone, not \`${positionals.join(" ")}\`. ${usageOf("guide")}`);
      if (asked.rung) fail(`guide: --for ${asked.for} reads the rung off that issue, so --rung ${asked.rung} decides nothing. Ask for one: \`forge guide ${slug} --for ${asked.for}\`, or \`forge guide ${slug} <part> --rung ${asked.rung}\`.`);
      const { indexFor } = await import("./flow/resume.mjs");
      return console.log((await indexFor(slug, asked.for)).join("\n"));
    }
    /* This copy's own guides — the contract and each skill's method — answer off disk through one
       registry, so the verb compares no slug against a constant of its own. */
    const local = localGuide(slug);
    if (local) {
      const [part, ...rest] = extra;
      const answer = local({ part, extra: rest, tracker: asked.tracker, rung: asked.rung });
      if (answer.refusal) fail(`guide: ${answer.refusal}`);
      return console.log(answer.lines.join("\n"));
    }
    if (asked.rung) fail(`guide: --rung renders this plugin's own guides — ${localSlugs().join(", ")} — and \`${slug}\` is the tracker's. ${usageOf("guide")}`);
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
      for (const row of localRows()) console.log(row);
      if (isGated("forge_guide")) return console.log("The tracker's guides are withheld from this credential: `forge doctor`.");
      for (const guide of await listed()) console.log(`${guide.slug}\n  ${guide.summary}`);
      return;
    }
    refuseIfGated("forge_guide");
    const row = dispositionOf(slug);
    /* The one place a slug the verb does not serve is refused, so a held one and an unserved one
       answer in the same words. A held slug reaches it without the get: the body is not wanted. */
    const noSuchGuide = async () =>
      fail(didYouMean("guide", slug, [...localSlugs(), ...(await listed()).map((one) => one.slug)],
        "`forge guide` lists the guides this plugin stands behind."));
    if (withholds(row) && !asked.tracker) await noSuchGuide();
    const answer = await scoped("forge_guide", { action: "get", slug }, true);
    if (answer?.refused) await noSuchGuide();
    /* `trackerHeader` answers on every path, a row or none, so --tracker alone decides the header. */
    if (asked.tracker) console.log(`${trackerHeader(row).join("\n")}\n`);
    /* Markdown, not Markdown escaped inside JSON: every `\n` tokenizes worse than the character. */
    show(answer?.guide?.body ?? answer);
  },
};

own.issue.answersHelp = true;
own.new.answersHelp = true;

export const commands = {
  doctor: loads("./tools/doctor.mjs", "doctor"),
  claim: loads("./flow/claim.mjs", "claim"),
  resume: loads("./flow/resume.mjs", "resume"),
  record: loads("./flow/record/record.mjs", "record"),
  advance: loads("./flow/advance.mjs", "advance"),
  /* The one composition in this table: `spec/` reads the checkout and may not import the workflow, and the rung `--status` prints is derived from workflow records, so the two halves are wired here — and loaded here, a caller typing any other verb needing neither of them. */
  spec: async () => {
    const [{ spec }, { statusOf }] = await Promise.all([
      import("./spec/verbs.mjs"),
      import("./trace/citing.mjs"),
    ]);
    const composed = (argv) => spec(argv, { readStatus: statusOf });
    composed.answersHelp = true;
    return composed;
  },
  project: loads("./tools/project.mjs", "project"),
  next: loads("./rank/next.mjs", "next"),
  alike: loads("./alike/alike.mjs", "alike"),
  knowledge: loads("./tools/knowledge.mjs", "knowledge"),
  cloudflare: loads("./tools/services/cloudflare.mjs", "cloudflare"),
  coolify: loads("./tools/services/coolify/coolify.mjs", "coolify"),
  feedback: loads("./tools/feedback.mjs", "feedback"),
  codex: loads("./codex/codex.mjs", "codex"),
  chatgpt: loads("./tools/services/chatgpt.mjs", "chatgpt"),
  hooks: loads("./hooks/log/hook-log.mjs", "hooks"),
  stats: loads("./stats/stats.mjs", "stats"),
  ...Object.fromEntries(Object.entries(own).map(([verb, held]) => [verb, () => held])),
};
