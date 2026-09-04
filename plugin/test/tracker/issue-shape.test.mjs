/* One case per line of the shape, each with the refusal it earns, and the body that meets every one
   of them. The four filed off the ninth dry run are the fixtures: three of them are what this reads
   as a fix, one is what it lets through, and one is a duplicate of an issue already open. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync, tempHome } from "../fixtures.mjs";

const home = tempHome("issue-shape");
process.env.XDG_CONFIG_HOME = home.path;
const { SIZE_LINE, UNRANKED, duplicateOf, filedAs, isFix, partsIn, priorityFor, refusalFrom,
  shapeOf, tokensNamed, twoChangesIn, withMark } = await import("../../src/tracker/issue-shape.mjs");
const { filingsOf } = await import("../../src/tracker/issue-read.mjs");

const WHOLE = [
  "## Outcome",
  "",
  "A filing is read against the shape the flow needs before the tracker ever sees it.",
  "",
  "## Rules",
  "",
  "- The refusal names what was read and what to add, so no second call is owed.",
  "",
  "## Out of scope",
  "",
  "Judging whether the issue is true.",
].join("\n");
const TITLE = "the filing is read against the shape before the tracker sees it";

const read = (body, title = TITLE) => shapeOf({ title, body }).gaps.map((one) => one.read);
const wants = (body, title = TITLE) => shapeOf({ title, body }).gaps.map((one) => one.wants).join(" | ");
const clears = (body, title = TITLE) => shapeOf({ title, body }).gaps.map((one) => one.clear).join(" | ");

test("a body carrying the outcome, a rule and an out-of-scope line files with nothing said", () => {
  const { gaps, fix } = shapeOf({ title: TITLE, body: WHOLE });
  assert.deepEqual(gaps, [], "the body that meets every line earns no refusal");
  assert.equal(fix, false);
});

/* The zero case, refused before any heading is looked for: a `-` whose heredoc went to another
   command filed a titled issue with an empty description, while the same lint had twice refused a
   5.9 kB epic for its headings. */
test("a body with no text in it is refused first, mark or no mark", () => {
  for (const body of ["", "   \n\n\t", `⟦UNTRUSTED_DATA source="x"⟧\n\n⟦END_UNTRUSTED_DATA⟧`, SIZE_LINE]) {
    const { gaps, fix } = shapeOf({ title: TITLE, body });
    assert.equal(gaps.length, 1, JSON.stringify(body));
    assert.match(gaps[0].read, /no text in them/u);
    assert.match(gaps[0].wants, /the issue itself/u);
    assert.equal(fix, false, "and an empty body is no fix either, so no route files it");
  }
});

test("the out-of-scope section may be a heading or the one line that says there is none", () => {
  const bare = WHOLE.replace("## Out of scope\n\nJudging whether the issue is true.", "Nothing is out of scope here.");
  assert.deepEqual(shapeOf({ title: TITLE, body: bare }).gaps, []);
});

test("each missing section is its own refusal, naming the headings read and the line to add", () => {
  const noOutcome = WHOLE.replace("## Outcome", "## Why");
  assert.match(wants(noOutcome), /a heading naming the outcome/u);
  assert.match(read(noOutcome).join(" "), /`Why`/u, "what was read is the headings themselves");
  assert.match(clears(noOutcome), /add `## Outcome`/u);
  /* An out-of-scope section keeps this from reading as a fix, which is what the rule line is for. */
  const noRule = WHOLE.replace("## Rules", "## Notes").replace("- The refusal names", "The refusal names");
  assert.match(wants(noRule), /rules, invariants or acceptance/u);
  assert.match(clears(noRule), /add `## Rules`/u);
  const noScope = WHOLE.replace("## Out of scope\n\nJudging whether the issue is true.", "");
  assert.match(wants(noScope), /an out-of-scope heading, or one line/u);
});

test("a heading with nothing under it is no section, and the refusal names the floor", () => {
  const empty = WHOLE.replace("A filing is read against the shape the flow needs before the tracker ever sees it.", "TBD");
  assert.match(wants(empty), /a heading naming the outcome/u);
  /* A refusal that says only "at least one line" leaves an author with a three-word line stuck,
     and the probe against the released copy is where that was found. */
  assert.match(read(empty).join(" "), /nothing under it of 4 words or more/u);
  assert.match(read(WHOLE.replace("## Outcome", "## Why")).join(" "), /no heading naming the outcome/u);
  /* Both halves of the same defect: a missing heading and an empty one must not read alike, and
     every wants line has to name the floor or the second refusal is the first one again. */
  assert.match(wants(WHOLE.replace("## Outcome", "## Why")), /one line of 4 words or more/u);
  const hollow = WHOLE.replace("Judging whether the issue is true.", "## Evidence\n\nnone");
  assert.match(read(hollow).join(" "), /an out-of-scope heading with nothing under it/u);
});

test("a title says the behaviour after the change, and three shapes never do", () => {
  assert.match(wants(WHOLE, "cursor"), /not one word/u);
  assert.match(wants(WHOLE, "fix and update"), /which a work verb alone never says/u);
  assert.match(wants(WHOLE, "update plugin/src/commands.mjs"), /the path in the body/u);
  assert.match(read(WHOLE, "update plugin/src/commands.mjs").join(" "), /a file path in the title/u);
  assert.match(wants(WHOLE, "refactor the cursor into the browse projection"), /^(?!.*work verb).*$/su,
    "a work verb with an object says the behaviour, and is not refused");
  assert.match(clears(WHOLE, "cursor"), /--title/u);
});

/* ISS-56 asked for two changes in one sentence and was folded into ISS-51 by hand. */
test("one sentence asking two things of two names is the split rule, and one name is one change", () => {
  const two = "`git_diff` without a path should return the consult's diff, and `read_file` on a missing "
    + "path should say what does exist.";
  assert.deepEqual(twoChangesIn(two)?.named, ["git_diff", "read_file"]);
  assert.match(wants(`${WHOLE}\n\n${two}`), /one change per issue: a sibling for git_diff and read_file/u);
  const one = "`git_diff` should return the consult's diff, and `git_diff` should say so in its help.";
  assert.equal(twoChangesIn(one), null, "two clauses about one name are one change described twice");
  const claim = "`git_diff` returns the consult's diff, and `read_file` says what exists.";
  assert.equal(twoChangesIn(claim), null, "and a statement with no modal on either side asks for nothing");
});

test("a line naming other issues as this one's parts is a split, and a citation is not", () => {
  assert.deepEqual(partsIn("Parts: ISS-48 and ISS-58 are the halves of it.")?.keys, ["ISS-48", "ISS-58"]);
  assert.match(wants(`${WHOLE}\n\nParts: ISS-48 and ISS-58.`), /the parts themselves as issues/u);
  assert.equal(partsIn("- The parts of the plan cite FR-05 for the two lines."), null,
    "one identifier on the line is a citation, and every clause of the tree wears an issue key's shape");
});

test("a body with no rule and no out-of-scope that names one thing reads as a fix", () => {
  const body = "`forge dep` calls `forge_project_pm`, which refuses a personal access token. It should "
    + "take the `data.relations` route instead.";
  const { gaps, fix, tokens } = shapeOf({ title: "forge dep writes the edge a token can write", body });
  assert.equal(fix, true);
  assert.deepEqual(gaps, [], "a fix owes no section: what it owes is a route");
  assert.equal(tokens[0], "forge dep", "and the route's candidates are searched on what it names");
  assert.deepEqual(tokensNamed("no span here, and `a prose span` and `path` name nothing"), []);
});

test("a body naming nothing is missing its outcome rather than reading as a fix", () => {
  const { gaps, fix } = shapeOf({ title: TITLE, body: "It is broken and should be fixed." });
  assert.equal(fix, false);
  assert.match(gaps.map((one) => one.wants).join(" "), /a heading naming the outcome/u);
});

test("the mark clears the fix route on every route, because the CLI writes it into the body", () => {
  const body = "`forge dep` should take the `data.relations` route.";
  assert.equal(isFix(body), false);
  const marked = withMark(body);
  assert.ok(marked.includes(SIZE_LINE));
  assert.equal(isFix(marked), true);
  assert.equal(shapeOf({ title: TITLE, body: marked }).fix, false, "a marked fix is refused nothing");
  assert.equal(withMark(marked), marked, "and marking twice writes one line");
  assert.equal(isFix(`⟦UNTRUSTED_DATA source="issue.description"⟧\n${SIZE_LINE}\n⟦END_UNTRUSTED_DATA⟧`), true,
    "the description comes back fenced, and the mark is read a line at a time");
  for (const near of ["Size: fix later", "Size: fix-me", "Size: fix!", "the Size: fix. it wants"]) {
    assert.equal(isFix(near), false, `${near} is not the mark, and a body it appears in owes its route`);
  }
  assert.equal(isFix("size:fix"), true, "while the spacing and the full stop are the author's");
});



/* The measure is the one this repository's own documents are held to, so a title restating an open
   issue is refused by the same index a restated paragraph is. ISS-56 against ISS-51, at 0.60. */
test("a filing that overlaps an open issue's title is a duplicate, and a settled one is not", () => {
  const live = [{ issueId: "ISS-51", title: "codex consult: the recheck after a clean pass runs, and git_diff without a path answers" }];
  const filing = { title: "codex's git_diff without a path returns the consult's diff", body: "" };
  const same = duplicateOf(filing, live);
  assert.equal(same.key, "ISS-51");
  assert.ok(same.score >= 0.34, `scored ${same?.score}`);
  assert.equal(same.where, "the title");
  assert.equal(duplicateOf({ title: TITLE, body: WHOLE }, live), null, "and an unrelated filing is not one");
});

test("a create is found on the tracker's own tool and on a raw call, and nothing else is", () => {
  const mcp = (action, data) => filingsOf({ name: "mcp__forge__forge_issues", input: { action, data } }, []);
  assert.deepEqual(mcp("create", { title: "t", description: "b" }), [{ title: "t", body: "b", kind: null }]);
  assert.deepEqual(mcp("update", { title: "t" }), [], "an update files nothing");
  assert.deepEqual(filingsOf({ name: "mcp__forge__forge_comments", input: { action: "create", data: {} } }, []), []);
  const said = filingsOf({ name: "Bash", input: {} },
    [`forge call forge_issues '{"action":"create","data":{"title":"t","description":"b"}}'`]);
  assert.deepEqual(said, [{ title: "t", body: "b", kind: null }]);
  /* The kind travels with the body, so the gate on this route reads the same shape the verb does. */
  assert.deepEqual(mcp("create", { title: "t", description: "b", category: "bug" }),
    [{ title: "t", body: "b", kind: "bug" }]);
  assert.deepEqual(filingsOf({ name: "Bash", input: {} }, ["forge new body.md --title t"]), [],
    "and the verb reads its own file, so this does not guess at one");
});

/* A rank is not a shape, and it is read in the same place for the same reason: two routes file, and
   the value written has to be the value said. */
const RANKS = ["critical", "high", "medium", "low", "none"];

test("a filing nobody ranked is the bottom of the set, and the line says by default", () => {
  const ranked = priorityFor(undefined, RANKS);
  assert.equal(ranked.value, UNRANKED);
  assert.equal(ranked.said, "priority low, by default");
  assert.equal(ranked.refusal, undefined);
  assert.equal(RANKS.at(-2), UNRANKED, "the bottom a queue can be worked from, `none` being no rank at all");
});

test("a rank the filer typed is kept, and the line says it was theirs", () => {
  assert.deepEqual(priorityFor("high", RANKS), { value: "high", said: "priority high, as given" });
});

test("a rank outside the tracker's set is refused with the set and the nearest name", () => {
  const { refusal, value } = priorityFor("hgh", RANKS);
  assert.equal(value, undefined, "nothing is filed under a rank that was refused");
  assert.match(refusal, /No priority named hgh\. Did you mean: high\?/u);
  assert.match(refusal, /The set is critical, high, medium, low, none, the tracker's own/u);
});

/* The schema is the only authority on the set, so a schema that answered with nothing leaves the
   value alone rather than refusing on a set this CLI would have had to invent. */
test("a set the schema did not declare refuses nothing", () => {
  assert.deepEqual(priorityFor("urgent", []), { value: "urgent", said: "priority urgent, as given" });
  assert.equal(priorityFor(undefined, []).value, UNRANKED);
});

/* The default answers to the same set a typed value does. Held to nothing, a tracker that renamed
   this rank would refuse every unranked filing in its own words, at the write, with no route out. */
test("a set that no longer holds the default refuses the filing and names the plugin as the fix", () => {
  const { refusal, value } = priorityFor(undefined, ["critical", "high", "medium", "none"]);
  assert.equal(value, undefined);
  assert.match(refusal, /files an issue nobody ranked as `low`/u);
  assert.match(refusal, /the tracker's set is now critical, high, medium, none/u);
  assert.match(refusal, /Name one with --priority/u);
  assert.match(refusal, /the default is what has to change/u);
});

test("the filed line names the key, and degrades to what the reply did carry", () => {
  const said = priorityFor(undefined, RANKS).said;
  assert.equal(filedAs({ issueId: "ISS-157", documentId: "u" }, said), "ISS-157 is filed, priority low, by default.");
  assert.equal(filedAs({ documentId: "u" }, said), "u is filed, priority low, by default.");
  assert.match(filedAs({}, said), /^Filed, priority low, by default; the reply named no key/u);
});

/* End to end: the refusal text, the mark landing in the description and the two routes are the
   verb's, and only spawning it against a tracker measures them. */
const state = {
  issues: [
    { issueId: "ISS-45", documentId: "uuid-45", status: "open", title: "three refusals carry the way out, forge dep under a token among them" },
    { issueId: "ISS-70", documentId: "uuid-70", status: "closed", title: "the browse projection answers with a cursor for the rows past the page" },
  ],
  comments: {},
  hidden: [{
    issueId: "ISS-99",
    documentId: "uuid-99",
    status: "open",
    title: "codex consult: the recheck after a clean pass runs, and git_diff without a path answers",
  }],
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const { mkdirSync, writeFileSync } = await import("node:fs");
const { join } = await import("node:path");
const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const room = tempHome("filing").path;
/* The verb spawns with the tracker's own home; the one case below calls the reader in this process,
   whose credential path was fixed at import, so the same endpoint is written where that path looks.
   A temporary home either way: a run on the developer's credential is the one thing a test may not do. */
mkdirSync(join(home.path, "forge"), { recursive: true });
writeFileSync(join(home.path, "forge", "config.json"), JSON.stringify({ url: tracker.url, token: "t" }));
const filed = (body, ...argv) => {
  const path = join(room, "body.md");
  writeFileSync(path, body);
  return ranAsync(FORGE, ["new", path, ...argv], tracker.env);
};

/* What a whole pass over one body costs, counted through a getter, because a body scanned for its
   shape a second time changes no output. The refusal is handed the read instead of taking one, so
   the line it leaves beside the gaps is reachable off that read and asks the tracker nothing. */
test("one pass over a filing reads its body twice, and the line it says costs no third read", async () => {
  let reads = 0;
  const filing = { title: TITLE, kind: null, get body() { reads += 1; return WHOLE; } };
  const shape = shapeOf(filing);
  assert.match(shape.said, /^Read as a feature/u, "the line is a field of a read that calls no tracker");
  assert.equal(reads, 1, "and that read is one pass over the body");
  assert.equal(await refusalFrom(filing, shape), null, "the body meeting every line earns no refusal");
  assert.equal(reads, 2, "the shape read and the duplicate measure; a second shape read makes it three");
});

test("the verb refuses a fix with the three routes and the open issues naming what it names", async () => {
  const run = await filed("`forge dep` should take the `data.relations` route.", "--title", "forge dep writes an edge a token can write");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--into ISS-nn/u);
  assert.match(run.stderr, /--with ISS-nn/u);
  /* The mark stopped meaning "files it": where an open issue both reads like the filing and names
     its place, the mark lands it there instead, and the route that promised a filing would be a
     refusal telling a filer the wrong thing (ISS-139). */
  assert.match(run.stderr, /--size fix\s+mark it, and the flow carries it on the light path/u);
  assert.doesNotMatch(run.stderr, /--size fix\s+file it marked/u);
  assert.match(run.stderr, /the mark lands it there as a finding/u);
  assert.match(run.stderr, /ISS-45/u, "the candidate is searched on the token the body names");
  assert.doesNotMatch(run.stderr, /ISS-70/u, "and a closed issue is no candidate");
  assert.match(run.stderr, /Name a route:/u, "and what it says is the whole of what to do");
  /* The light path left this module; what this nudge justified itself by is what changed (ISS-141). */
  assert.doesNotMatch(run.stderr, /whatever the size/u,
    "which the mark made false: it is what drops the decision, the plan and the note");
  assert.match(run.stderr, /the mark is what drops the decision, the plan and the note/u);
});

test("--size fix files the same body, with the mark the CLI writes into the description", async () => {
  state.calls = [];
  const run = await filed("`forge dep` should take the `data.relations` route.", "--title", "forge dep writes an edge a token can write", "--size", "fix");
  assert.equal(run.status, 0, run.stderr);
  const create = state.calls.find((one) => one.args.action === "create");
  assert.match(create.args.data.description, new RegExp(SIZE_LINE, "u"));
  assert.equal(create.args.data.status, "open");
});

test("a size the contract has no path for is refused rather than kept", async () => {
  const run = await filed(WHOLE, "--title", TITLE, "--size", "small");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--size takes `fix`/u);
});

test("--into posts the body where it belongs and files nothing, lint or no lint", async () => {
  state.calls = [];
  const run = await filed("`forge dep` should take the `data.relations` route.", "--title", "the edge a token can write", "--into", "ISS-45");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(state.calls.some((one) => one.args.action === "create" && one.name === "forge_issues"), false);
  const posted = state.calls.find((one) => one.name === "forge_comments" && one.args.action === "create");
  assert.equal(posted.args.data.issue, "uuid-45");
  assert.match(posted.args.data.body, /the edge a token can write/u);
});

test("--with files it and relates it in the same create, so one branch carries both", async () => {
  state.calls = [];
  const run = await filed("`forge dep` should take the `data.relations` route.", "--title", "the edge a token can write", "--with", "ISS-45");
  assert.equal(run.status, 0, run.stderr);
  const create = state.calls.find((one) => one.args.action === "create");
  assert.deepEqual(create.args.data.relations, [{ kind: "relates", blocksId: "uuid-45" }]);
  /* The relation is the route and the mark is the other one: a fix carried by another issue's
     branch has that issue's flow, and marking every related filing would call each of them a fix. */
  assert.doesNotMatch(create.args.data.description, new RegExp(SIZE_LINE, "u"));
});

/* Every input is used or refused, never dropped: the second dry run found six of that family. */
test("a flag that belongs to a filing is refused on the comment route, not silently dropped", async () => {
  for (const argv of [["--size", "fix"], ["--priority", "high"], ["--status", "draft"]]) {
    const run = await filed(WHOLE, "--title", TITLE, "--into", "ISS-45", ...argv);
    assert.equal(run.status, 1, argv.join(" "));
    assert.match(run.stderr, new RegExp(`${argv[0]} belongs to a filing`, "u"));
  }
});

test("the two routes are two, and asking for both is refused", async () => {
  const run = await filed(WHOLE, "--title", TITLE, "--into", "ISS-45", "--with", "ISS-45");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Ask for one of them/u);
});

/* The shared parser takes an empty string as a value, so a route read by truthiness is a route
   dropped: this one filed the issue instead of commenting, silently. */
test("a route named with nothing is refused, and never read as no route at all", async () => {
  for (const argv of [["--into", ""], ["--with", ""]]) {
    const run = await filed(WHOLE, "--title", TITLE, ...argv);
    assert.equal(run.status, 1, argv.join(" "));
    assert.match(run.stderr, /neither an issue uuid nor an issue key/u);
  }
});

test("a whole body files with no output but the issue", async () => {
  state.calls = [];
  const run = await filed(WHOLE, "--title", TITLE);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /filed-uuid/u);
  assert.doesNotMatch(run.stdout, /Hold/u);
});

/* The payload may arrive as a file or on stdin, which a hook reading the command line cannot see,
   so the verb that parsed it lints it too. */
test("a raw call filing from a file is linted, and the hook is not the only place it is", async () => {
  const path = join(room, "create.json");
  writeFileSync(path, JSON.stringify({ action: "create", data: { title: "fix", description: "It is broken." } }));
  const run = await ranAsync(FORGE, ["call", "forge_issues", `@${path}`], tracker.env);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /a heading naming the outcome/u);
  const whole = join(room, "whole.json");
  writeFileSync(whole, JSON.stringify({ action: "create", data: { title: TITLE, description: WHOLE } }));
  assert.equal((await ranAsync(FORGE, ["call", "forge_issues", `@${whole}`], tracker.env)).status, 0);
});

/* The route that arrives from a file or stdin is a filing too, so what the verb says about the kind
   it read is owed there as well. */
test("a raw call filing is told what kind it was read as, the same as the verb", async () => {
  const path = join(room, "kindless.json");
  writeFileSync(path, JSON.stringify({ action: "create", data: { title: TITLE, description: WHOLE } }));
  const run = await ranAsync(FORGE, ["call", "forge_issues", `@${path}`], tracker.env);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /Read as a feature, the kind a filing naming none is read as/u);
});

/* Reading to EOF on a stdin nobody fed waited two minutes and then filed. */
test("`-` with nothing on stdin is refused, and never read as an empty body", async () => {
  state.calls = [];
  const run = await ranAsync(FORGE, ["new", "-", "--title", TITLE], tracker.env);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /read nothing from stdin/u);
  assert.equal(state.calls.some((one) => one.args.action === "create"), false);
});

/* The page has no cursor, so a duplicate past it is reachable only by name — which is what the body
   already names, and what the fix route already searches for. */
test("a duplicate the listing never returned is still found, through a search for what the body names", async () => {
  const body = "## Outcome\n\nThe reviewer's `git_diff` answers a call with no path.\n\n## Rules\n\n"
    + "- A call with no path returns the diff the consult was given.\n\n## Out of scope\n\nThe other tools.";
  const run = await filed(body, "--title", "codex's git_diff without a path returns the consult's diff");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /ISS-99/u);
  assert.match(run.stderr, /--into ISS-99/u);
});

/* The kinds end to end: what the verb refuses before it reads anything, what it sends the tracker
   for the kind it was given, and what it says about a shortfall it files anyway. */
const BUG = [
  "## What happened",
  "",
  "`forge new` answered success and stored a description with no section in it.",
  "",
  "## Outcome",
  "",
  "A filing is read against the shape the kind it names asks for.",
  "",
  "## Rules",
  "",
  "- The refusal names the missing section and the kind that requires it.",
  "",
  "## Out of scope",
  "",
  "Any change to the tracker.",
].join("\n");

test("a kind outside the set is refused with the set, before a single tracker call", async () => {
  state.calls = [];
  const run = await filed(BUG, "--title", TITLE, "--kind", "chore");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--kind takes one of bug, enhancement, feature/u);
  assert.match(run.stderr, /read as a feature/u, "and the kind a filing naming none is read as");
  assert.deepEqual(state.calls, [], "nothing was asked of the tracker to find that out");
});

test("the kind the filing names is what the body is read against, and what the tracker is sent", async () => {
  state.calls = [];
  const refused = await filed(WHOLE, "--title", TITLE, "--kind", "bug");
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /no heading naming what happened/u);
  assert.match(refused.stderr, /required of a bug/u);
  state.calls = [];
  const run = await filed(BUG, "--title", TITLE, "--kind", "bug");
  assert.equal(run.status, 0, run.stderr);
  const create = state.calls.find((one) => one.args.action === "create");
  assert.equal(create.args.data.category, "bug");
  assert.match(run.stdout, /"kind": "bug"/u, "and the answer is read back in the CLI's own word");
  assert.doesNotMatch(run.stdout, /category/u);
});

test("a filing naming no kind is filed as it was before kinds, and told what it was read as", async () => {
  state.calls = [];
  const run = await filed(WHOLE, "--title", TITLE);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /Read as a feature, the kind a filing naming none is read as/u);
  const create = state.calls.find((one) => one.args.action === "create");
  assert.equal("category" in create.args.data, false, "and the field is left for a filing that chose");
});

test("a nice-to-have section left out is said on the way past, and the issue is filed", async () => {
  state.calls = [];
  const run = await filed(BUG, "--title", TITLE, "--kind", "bug");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /leaves out Where, nice to have on a bug/u);
  assert.ok(state.calls.some((one) => one.args.action === "create"), "said, not refused");
});

test("--size fix marks the description and sends the tracker nothing for a size", async () => {
  state.calls = [];
  const run = await filed("`forge dep` should take the `data.relations` route.",
    "--title", "forge dep writes an edge a token can write", "--size", "fix");
  assert.equal(run.status, 0, run.stderr);
  const create = state.calls.find((one) => one.args.action === "create");
  assert.match(create.args.data.description, new RegExp(SIZE_LINE, "u"));
  assert.equal("complexity" in create.args.data, false, "one source for the light path, and it is the line");
});

test("a filing that named no rank is filed at the bottom, and the reply says which line ranked it", async () => {
  state.calls = [];
  const run = await filed(WHOLE, "--title", TITLE);
  assert.equal(run.status, 0, run.stderr);
  const create = state.calls.find((one) => one.args.action === "create");
  assert.equal(create.args.data.priority, "low", "the tracker was left to fill its own middle");
  assert.match(run.stdout, /^filed-uuid is filed, priority low, by default\.$/mu);
});

test("a rank the filer typed is what is written, and the reply says it was theirs", async () => {
  state.calls = [];
  const run = await filed(WHOLE, "--title", TITLE, "--priority", "high");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(state.calls.find((one) => one.args.action === "create").args.data.priority, "high");
  assert.match(run.stdout, /is filed, priority high, as given\.$/mu);
});

/* The set is the tracker's, declared in its own schema: read at the call, so a rank outside it is
   refused here rather than filed and read back later as one somebody chose. */
test("a rank outside the tracker's set is refused before the body is even read", async () => {
  state.calls = [];
  const run = await filed(WHOLE, "--title", TITLE, "--priority", "urgent");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No priority named urgent/u);
  assert.match(run.stderr, /The set is critical, high, medium, low, none/u);
  assert.equal(state.calls.some((one) => one.args.action === "create"), false, "a refused rank filed an issue");
});

test("a rank is a filing flag, so the comment route refuses it rather than dropping it", async () => {
  state.calls = [];
  const run = await filed(WHOLE, "--title", TITLE, "--into", "ISS-45", "--priority", "high");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--priority belongs to a filing/u);
  assert.equal(state.calls.some((one) => one.name === "forge_comments"), false);
});

test("`forge new -h` says what a filing with no rank gets", async () => {
  const run = await ranAsync(FORGE, ["new", "-h"], tracker.env);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /absent it a filing is low/u);
});

test("`forge new -h` lists every kind with the sections it requires", async () => {
  const run = await ranAsync(FORGE, ["new", "-h"], tracker.env);
  assert.equal(run.status, 0, run.stderr);
  for (const kind of ["bug", "enhancement", "feature"]) assert.match(run.stdout, new RegExp(`\\n  ${kind} `, "u"));
  assert.match(run.stdout, /required {3}What happened, Outcome, Rules, Out of scope/u);
  assert.match(run.stdout, /nice {7}Where/u);
  assert.match(run.stdout, /Usage: forge new/u, "and what to type is still the first line of it");
});

/* The duplicate check's own line, which fired only at a page of exactly MAX_LIMIT and so never
   fired at all: the byte cap returns FEWER rows than the ask. Called in process — the line is a
   console.error beside a refusal that may be null, so spawning a verb would judge the wrong thing. */
const said = async (page) => {
  const kept = console.error;
  const lines = [];
  console.error = (...parts) => lines.push(parts.join(" "));
  try {
    await refusalFrom({ title: TITLE, body: WHOLE }, shapeOf({ title: TITLE, body: WHOLE }), { page });
  } finally {
    console.error = kept;
  }
  return lines.join("\n");
};

const CUT_PAGE = {
  returned: 97,
  by: "response-size",
  notice: "More rows match than were returned: the response-size cap cut this to the 97 most recent"
    + " of them. A higher limit will NOT help — add status/priority/category/label filters instead.",
};

test("the duplicate check says its page was cut when the tracker says so, not when a length matches", async () => {
  const out = await said({ live: [], short: CUT_PAGE });
  assert.match(out, /was cut to the 97 row\(s\) read, by response-size/u,
    "97 rows against an ask of 500 is the shape the length test read as whole");
});

test("that line names no limit it asked for", async () => {
  const out = await said({ live: [], short: CUT_PAGE });
  assert.doesNotMatch(out, /\b500\b/u, "and the old line named 500 twice");
});

test("that line still says what the cut costs the check", async () => {
  const out = await said({ live: [], short: CUT_PAGE });
  assert.match(out, /no cursor to page by/u);
  assert.match(out, /sharing no such name is not measured/u);
});

test("a page the tracker reported whole leaves the check silent", async () => {
  assert.equal(await said({ live: [], short: null }), "");
});

/* The third place the loose shape lived (ISS-36). Two keys were demanded on a parts line precisely
   because one could be a citation — a workaround the narrowed shape retires, so the threshold below
   is left alone and only the miscounting goes. */
test("a parts line counts the tracker's keys and not the clauses cited beside them", () => {
  assert.equal(partsIn("Parts: ISS-48 and FR-05 are the halves of it."), null,
    "one part and one citation is not a split, and this filing was refused for it");
  assert.equal(partsIn("Parts: FR-05 and UC-05 are the halves."), null,
    "and a line with no issue key on it named no parts at all");
});

test("a real split is still one, and a lowercase key still counts", () => {
  assert.deepEqual(partsIn("Parts: ISS-48 and ISS-58 are the halves of it.")?.keys, ["ISS-48", "ISS-58"]);
  assert.deepEqual(partsIn("Parts: iss-48 and ISS-58 are the halves.")?.keys, ["iss-48", "ISS-58"]);
});

test("the two-key threshold is untouched, so one part named alone is still no split", () => {
  assert.equal(partsIn("Parts: ISS-48 is the half of it."), null,
    "relaxing this would newly refuse a filing, which no issue asked for");
});
