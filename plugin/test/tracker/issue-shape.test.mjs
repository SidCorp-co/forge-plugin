/* One case per line of the shape, each with the refusal it earns, and the body that meets every one
   of them. The four filed off the ninth dry run are the fixtures: three of them are what this reads
   as a fix, one is what it lets through, and one is a duplicate of an issue already open. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync, tempHome } from "../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("issue-shape").path;
const { FIX_OWES, SIZE_LINE, duplicateOf, isFix, partsIn, shapeOf, tokensNamed, twoChangesIn, withMark } =
  await import("../../src/tracker/issue-shape.mjs");
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

test("a heading with nothing under it is no section", () => {
  const empty = WHOLE.replace("A filing is read against the shape the flow needs before the tracker ever sees it.", "TBD");
  assert.match(wants(empty), /a heading naming the outcome/u, "four words is the floor for a line");
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

test("what a fix owes and what it does not is said, and nothing is relaxed by saying it", () => {
  assert.match(FIX_OWES, /owed {8}the plan/u);
  assert.match(FIX_OWES, /not owed {4}a decision record/u);
  assert.match(FIX_OWES, /Every entry check below still asks for the full set/u);
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
  assert.deepEqual(mcp("create", { title: "t", description: "b" }), [{ title: "t", body: "b" }]);
  assert.deepEqual(mcp("update", { title: "t" }), [], "an update files nothing");
  assert.deepEqual(filingsOf({ name: "mcp__forge__forge_comments", input: { action: "create", data: {} } }, []), []);
  const said = filingsOf({ name: "Bash", input: {} },
    [`forge call forge_issues '{"action":"create","data":{"title":"t","description":"b"}}'`]);
  assert.deepEqual(said, [{ title: "t", body: "b" }]);
  assert.deepEqual(filingsOf({ name: "Bash", input: {} }, ["forge new body.md --title t"]), [],
    "and the verb reads its own file, so this does not guess at one");
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

const { writeFileSync } = await import("node:fs");
const { join } = await import("node:path");
const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const room = tempHome("filing").path;
const filed = (body, ...argv) => {
  const path = join(room, "body.md");
  writeFileSync(path, body);
  return ranAsync(FORGE, ["new", path, ...argv], tracker.env);
};

test("the verb refuses a fix with the three routes and the open issues naming what it names", async () => {
  const run = await filed("`forge dep` should take the `data.relations` route.", "--title", "forge dep writes an edge a token can write");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--into ISS-nn/u);
  assert.match(run.stderr, /--with ISS-nn/u);
  assert.match(run.stderr, /--size fix\s+file it marked/u);
  assert.match(run.stderr, /ISS-45/u, "the candidate is searched on the token the body names");
  assert.doesNotMatch(run.stderr, /ISS-70/u, "and a closed issue is no candidate");
  assert.match(run.stderr, /Name a route:/u, "and what it says is the whole of what to do");
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
    assert.match(run.stderr, /neither an issue uuid nor a reference/u);
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
