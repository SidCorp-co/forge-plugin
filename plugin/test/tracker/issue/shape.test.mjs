/* One case per line of the shape, each with the refusal it earns, and the body that meets every one
   of them. The four filed off the ninth dry run are the fixtures: three of them are what this reads
   as a fix, one is what it lets through, and one is a duplicate of an issue already open. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync, shortPage, tempHome } from "../../fixtures.mjs";

const home = tempHome("issue-shape");
process.env.XDG_CONFIG_HOME = home.path;
const { UNRANKED, duplicateOf, filedAs, partsIn, priorityFor, refusalFrom,
  shapeOf, tokensNamed, twoChangesIn, withMark } = await import("../../../src/tracker/issue-shape.mjs");
const { FIX, TIERS, belowTop, markFor, markedIn } = await import("../../../src/ladder.mjs");
const SIZE_LINE = markFor(FIX);
const { filingsOf } = await import("../../../src/tracker/issue-read.mjs");
const { refusing } = await import("../../../src/resolve/settings.mjs");

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
  for (const body of ["", "   \n\n\t", SIZE_LINE]) {
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
  const body = "`forge issue` calls `forge_project_pm`, which refuses a personal access token. It should "
    + "take the `data.relations` route instead.";
  const { gaps, fix, tokens } = shapeOf({ title: "forge issue writes the edge a token can write", body });
  assert.equal(fix, true);
  assert.deepEqual(gaps, [], "a fix owes no section: what it owes is a route");
  assert.equal(tokens[0], "forge issue", "and the route's candidates are searched on what it names");
  assert.deepEqual(tokensNamed("no span here, and `a prose span` and `path` name nothing"), []);
});

test("a body naming nothing is missing its outcome rather than reading as a fix", () => {
  const { gaps, fix } = shapeOf({ title: TITLE, body: "It is broken and should be fixed." });
  assert.equal(fix, false);
  assert.match(gaps.map((one) => one.wants).join(" "), /a heading naming the outcome/u);
});

/* The exemption is the light path's and not one rung's, and the reading is the ladder's. */
test("the mark clears the fix route on every route, because the CLI writes it into the body", () => {
  const body = "`forge issue` should take the `data.relations` route.";
  assert.equal(markedIn(body), null);
  const marked = withMark(body);
  assert.ok(marked.includes(SIZE_LINE));
  assert.equal(markedIn(marked), FIX);
  assert.equal(belowTop(markedIn(marked)), true, "and a fix is a rung below the top");
  assert.equal(shapeOf({ title: TITLE, body: marked }).fix, false, "a marked fix is refused nothing");
  assert.equal(withMark(marked), marked, "and marking twice writes one line");
  for (const rung of TIERS) {
    assert.equal(shapeOf({ title: TITLE, body: withMark(body, rung) }).fix, rung === TIERS.at(-1),
      "the two rungs below the top are exempt from the sections, and the top one is not");
  }
  assert.equal(markedIn(`## Where\n\nplugin/src/tracker/rpc.mjs\n\n${SIZE_LINE}`), FIX,
    "the mark is read a line at a time, wherever in the body its line stands");
  for (const near of ["Size: fix later", "Size: fix-me", "Size: fix!", "the Size: fix. it wants"]) {
    assert.equal(markedIn(near), null, `${near} is not the mark, and a body it appears in owes its route`);
  }
  assert.equal(markedIn("size:fix"), FIX, "while the spacing and the full stop are the author's");
  assert.equal(markedIn(`\`\`\`\n${SIZE_LINE}\n\`\`\``), null, "and a mark inside an example is not one");
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
  assert.equal(ranked.said, "priority none, by default");
  assert.equal(ranked.refusal, undefined);
  assert.equal(RANKS.at(-1), UNRANKED, "the tracker's own value for nobody having judged");
  assert.notEqual(UNRANKED, "low", "a rank somebody chose has to read apart from one nobody did");
});

test("a rank the filer typed is kept, and the line says it was theirs", () => {
  assert.deepEqual(priorityFor("high", RANKS), { value: "high", said: "priority high, as given" });
});

test("a rank outside the tracker's set is refused with the set and the nearest name", () => {
  const { refusal, value } = priorityFor("hgh", RANKS);
  assert.equal(value, undefined, "nothing is filed under a rank that was refused");
  assert.match(refusal, /No priority named hgh\. Did you mean: high\?/u);
  assert.match(refusal, /The set is critical, high, medium, low, none\. That set is what the route table declares/u);
});

/* The declaration is the only authority on the set, so a declaration answering with nothing leaves
   the value alone rather than refusing on a set this reading would have had to invent. */
test("a set the declaration did not carry refuses nothing", () => {
  assert.deepEqual(priorityFor("urgent", []), { value: "urgent", said: "priority urgent, as given" });
  assert.equal(priorityFor(undefined, []).value, UNRANKED);
});

/* The default answers to the same set a typed value does. Held to nothing, a tracker that renamed
   this rank would refuse every unranked filing in its own words, at the write, with no route out. */
test("a set that no longer holds the default refuses the filing and names the plugin as the fix", () => {
  const { refusal, value } = priorityFor(undefined, ["critical", "high", "medium", "low"]);
  assert.equal(value, undefined);
  assert.match(refusal, /files an issue nobody ranked as `none`/u);
  assert.match(refusal, /the tracker's set is now critical, high, medium, low/u);
  assert.match(refusal, /Name one with --priority/u);
  assert.match(refusal, /the default is what has to change/u);
});

test("the filed line names the key, and degrades to what the reply did carry", () => {
  const said = priorityFor(undefined, RANKS).said;
  assert.equal(filedAs({ issueId: "ISS-157", documentId: "u" }, said), "ISS-157 is filed, priority none, by default.");
  assert.equal(filedAs({ documentId: "u" }, said), "u is filed, priority none, by default.");
  assert.match(filedAs({}, said), /^Filed, priority none, by default; the reply named no key/u);
});

/* End to end: the refusal text, the mark landing in the description and the two routes are the
   verb's, and only spawning it against a tracker measures them. */
const state = {
  issues: [
    { issueId: "ISS-45", documentId: "uuid-45", status: "open", title: "three refusals carry the way out, forge issue under a token among them" },
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
const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const room = tempHome("filing").path;
/* The verb spawns with the tracker's own home and one case below reads in this process, whose
   credential path was fixed at import, so the same endpoint is written where that path looks. */
mkdirSync(join(home.path, "forge"), { recursive: true });
writeFileSync(join(home.path, "forge", "config.json"), JSON.stringify({ url: tracker.url, token: "t" }));
/* The helper names a kind where the argv did not, that not being what these cases are about. */
const bodyAt = (body) => {
  const path = join(room, "body.md");
  writeFileSync(path, body);
  return path;
};
const filed = (body, ...argv) => {
  const kind = argv.includes("--kind") ? [] : ["--kind", "feature"];
  return ranAsync(FORGE, ["new", bodyAt(body), ...argv, ...kind], tracker.env);
};

const posted = (body, ...argv) => ranAsync(FORGE, ["comment", "ISS-45", bodyAt(body), ...argv], tracker.env);

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

test("the verb refuses a fix with the two flags, the comment route and the open issues naming what it names", async () => {
  const run = await filed("`forge issue` should take the `data.relations` route.", "--title", "forge issue writes an edge a token can write");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /forge comment ISS-nn <body>/u);
  assert.match(run.stderr, /--with ISS-nn/u);
  assert.match(run.stderr, /it needs no --kind/u,
    "the comment route says what a filing owes that it does not");
  /* The mark stopped meaning "files it": where an open issue both reads like the filing and names
     the place its cause names, it lands there instead, and the route that promised a filing would
     be a refusal telling a filer the wrong thing (ISS-139). The mark is not what buys that any
     more, so the routes no longer offer it as one — a filer sent to `--size` for a fold would take
     the rung to get the landing, which is the rung deciding the flow off the wrong question. */
  assert.match(run.stderr, /--size trivial\|fix\|feature\s+mark it at a rung/u);
  assert.doesNotMatch(run.stderr, /--size fix\s+file it marked/u);
  assert.doesNotMatch(run.stderr, /the mark lands it there as a finding/u);
  assert.match(run.stderr, /Whichever of those you take, an open issue that both reads like this filing/u);
  assert.match(run.stderr, /takes it as a finding rather than a second issue; `--new` declines that/u);
  assert.match(run.stderr, /ISS-45/u, "the candidate is searched on the token the body names");
  assert.doesNotMatch(run.stderr, /ISS-70/u, "and a closed issue is no candidate");
  assert.match(run.stderr, /Name a route:/u, "and what it says is the whole of what to do");
  /* The light path left this module; what this nudge justified itself by is what changed (ISS-141). */
  assert.doesNotMatch(run.stderr, /whatever the size/u,
    "which the mark made false: it is what drops the decision, the plan and the note");
  assert.match(run.stderr, /the mark is what drops the decision, the plan and the note/u);
});

test("a size the contract has no path for is refused rather than kept", async () => {
  const run = await filed(WHOLE, "--title", TITLE, "--size", "small");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No size named small\. The set is trivial, fix, feature\./u);
  assert.match(run.stderr, /the contract's three rungs, smallest first/u);
});

test("forge comment posts the body where it belongs and files nothing, lint or no lint", async () => {
  state.calls = [];
  const run = await posted("`forge issue` should take the `data.relations` route.", "--title", "the edge a token can write");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(state.calls.some((one) => one.args.action === "create" && one.name === "forge_issues"), false);
  const wrote = state.calls.find((one) => one.name === "forge_comments" && one.args.action === "create");
  assert.equal(wrote.args.data.issue, "uuid-45");
  assert.match(wrote.args.data.body, /the edge a token can write/u);
});

test("--with files it and relates it in the same create, so one branch carries both", async () => {
  state.calls = [];
  const run = await filed("`forge issue` should take the `data.relations` route.", "--title", "the edge a token can write", "--with", "ISS-45");
  assert.equal(run.status, 0, run.stderr);
  const create = state.calls.find((one) => one.args.action === "create");
  assert.deepEqual(create.args.data.relations, [{ kind: "relates", blocksId: "uuid-45" }]);
  /* The relation is the route and the mark is the other one: a fix carried by another issue's
     branch has that issue's flow, and marking every related filing would call each of them a fix. */
  assert.doesNotMatch(create.args.data.description, new RegExp(SIZE_LINE, "u"));
});

/* Every input is used or refused, never dropped: the second dry run found six of that family. And
   the flags a filing takes are refused on the comment verb by the verb's own unknown-flag route,
   which is what having two verbs removes — there is no route left to drop one on. */
test("a flag that belongs to a filing is refused on the comment verb, not silently dropped", async () => {
  for (const argv of [["--size", "fix"], ["--priority", "high"], ["--status", "draft"],
    ["--kind", "feature"]]) {
    const run = await posted(WHOLE, ...argv);
    assert.equal(run.status, 1, argv.join(" "));
    assert.match(run.stderr, new RegExp(`No comment flag named ${argv[0]}`, "u"));
  }
});

test("the flag the comment verb took over is refused with it, and files nothing", async () => {
  state.calls = [];
  const run = await filed(WHOLE, "--title", TITLE, "--into", "ISS-45", "--with", "ISS-45");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /`forge new --into` is retired/u);
  assert.match(run.stderr, /forge comment <uuid\|ISS-45>/u);
  assert.equal(state.calls.some((one) => one.args.action === "create"), false);
});

test("a key that is no key is refused, and never read as no target at all", async () => {
  const run = await ranAsync(FORGE, ["comment", "", bodyAt(WHOLE)], tracker.env);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Usage: forge comment/u, "an empty target names no issue and no file either");
  /* The relating flag takes a list, so an empty one is no key rather than one that will not
     resolve, and the refusal names both shapes it does take. */
  const empty = await filed(WHOLE, "--title", TITLE, "--with", " , ");
  assert.equal(empty.status, 1);
  assert.match(empty.stderr, /--with takes an issue key, or several separated by commas/u);
});

test("a whole body files with no output but the issue", async () => {
  state.calls = [];
  const run = await filed(WHOLE, "--title", TITLE);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /filed-uuid/u);
  assert.doesNotMatch(run.stdout, /Hold/u);
});

/* ISS-335 closed this route: the payload may arrive from a file or on stdin, where a hook reading
   the command line sees nothing, so the refusal is the verb's own and is made off the parsed body
   whatever carried it. A body that would have passed the shape read is refused with the rest. */
test("a raw call filing is refused with the verb that reads it, from a file as from the line", async () => {
  state.calls = [];
  for (const data of [{ title: "fix", description: "It is broken." }, { title: TITLE, description: WHOLE }]) {
    const path = join(room, "create.json");
    writeFileSync(path, JSON.stringify({ action: "create", data }));
    const run = await ranAsync(FORGE, ["call", "forge_issues", `@${path}`], tracker.env);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /forge_issues create is what `forge new` wraps/u);
    assert.doesNotMatch(run.stderr, /a heading naming the outcome/u, "the body is not what refused it");
  }
  assert.equal(state.calls.some((one) => one.args.action === "create"), false, "and nothing was filed");
});

/* Reading to EOF on a stdin nobody fed waited two minutes and then filed. */
test("`-` with nothing on stdin is refused, and never read as an empty body", async () => {
  state.calls = [];
  const run = await ranAsync(FORGE, ["new", "-", "--title", TITLE, "--kind", "feature"], tracker.env);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /read nothing from stdin/u);
  assert.equal(state.calls.some((one) => one.args.action === "create"), false);
});

/* A reading the walk could not finish is the only thing left with rows behind it, and past that
   ceiling the one axis is the name — which is what the body already names, and what the fix route
   already searches for. A route counting rows it will not serve is the one shape with such a
   reading, the offsets being exact otherwise. */
test("a duplicate past a reading the walk could not finish is still found, through a search for what the body names", async () => {
  const short = shortPage(state.issues, state.hidden.length);
  state.answer = {
    forge_issues: (args) => {
      if (args.action !== "list") return { documentId: state.mint ?? "filed-uuid", ...(args.data ?? {}) };
      const wanted = String(args.filters?.search ?? "").toLowerCase();
      if (!wanted) return short(args);
      const pool = [...state.issues, ...state.hidden];
      const found = pool.filter((one) => JSON.stringify(one).toLowerCase().includes(wanted));
      return { issues: found, returned: found.length, hasMore: false };
    },
  };
  const body = "## Outcome\n\nThe reviewer's `git_diff` answers a call with no path.\n\n## Rules\n\n"
    + "- A call with no path returns the diff the consult was given.\n\n## Out of scope\n\nThe other tools.";
  const run = await filed(body, "--title", "codex's git_diff without a path returns the consult's diff");
  state.answer = undefined;
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /ISS-99/u);
  assert.match(run.stderr, /forge comment ISS-99 <body>/u);
});

/* The same body against a reading that came back whole: every open issue is already in it, so a
   search for the tokens the body names can add nothing, and the verb asks for none. */
test("a whole reading buys the filing no search at all", async () => {
  const body = "## Outcome\n\nThe reviewer's `git_diff` answers a call with no path.\n\n## Rules\n\n"
    + "- A call with no path returns the diff the consult was given.\n\n## Out of scope\n\nThe other tools.";
  state.calls = [];
  const run = await filed(body, "--title", "a title nothing open here comes close to sharing");
  assert.equal(run.status, 0, run.stderr);
  const searches = state.calls.filter((one) => one.name === "forge_issues" && one.args.filters?.search);
  assert.deepEqual(searches, [], "the hidden row is unreachable and nothing was asked for it");
});

/* The fix route's own search, at the seam where a settled row is indistinguishable from no row at
   all: the ask counted status names, the answer is filtered down to open rows, and a failure was
   caught into an empty one (ISS-565). The walk behind the duplicate check answers whole out of
   `state.issues`, so the search route below is the only one these cases reach. */
const SETTLED_SIX = Array.from({ length: 6 }, (one, at) => ({
  issueId: `ISS-6${at}`,
  documentId: `uuid-6${at}`,
  status: "closed",
  title: `forge issue under a token, settled ${at}`,
}));
const OPEN_BEHIND = {
  issueId: "ISS-88",
  documentId: "uuid-88",
  status: "in_progress",
  title: "forge issue writes its edge through the relations route",
};
const FIX_BODY = "`forge issue` should take the `data.relations` route.";
const FIX_TITLE = "forge issue writes an edge a token can write";

const routed = async (search) => {
  state.answer = {
    forge_issues: (args) => {
      if (args.action !== "list") return { documentId: "filed-uuid", ...(args.data ?? {}) };
      return args.filters?.search ? search(args) : { issues: state.issues };
    },
  };
  try {
    return await filed(FIX_BODY, "--title", FIX_TITLE);
  } finally {
    state.answer = undefined;
  }
};

/* The status the fixture serves is the server's and not a route's, so it is armed off the walk's own
   answer and lands on the request after it, which is the search: no handler can refuse that route
   (ISS-618). Through the verb, `fail` exits before any caller sees the throw. */
test("a search the route refused leaves the verb saying what failed, not what is open", async () => {
  state.answer = {
    forge_issues: (args) => {
      if (args.action === "list" && !args.filters?.search) state.status = 403;
      return { issues: state.issues };
    },
  };
  try {
    const run = await filed(FIX_BODY, "--title", FIX_TITLE);
    assert.equal(run.status, 1);
    assert.doesNotMatch(run.stderr, /No open issue names/u,
      "a search that failed said nothing about what is open, and that sentence routes a filer to --size fix");
    assert.match(run.stderr, /Forge answered 403/u, "what the tracker answered is what the verb exits on");
  } finally {
    state.answer = undefined;
    state.status = undefined;
  }
});

/* Inside `refusing`, the mode `tools/run.mjs` files under, where `fail` throws instead of exiting:
   the one caller a swallowed search can lie to, and the only seam the catch was visible at. The
   first call is what puts the slug's id in the cache and proves the search route is reached with the
   page handed in, so the 403 below lands on that search and on no lookup behind it. */
test("a search that failed reaches the caller, rather than an empty backlog it never read", async () => {
  const filing = { title: FIX_TITLE, body: FIX_BODY, kind: null };
  const shape = shapeOf(filing);
  const page = { live: [], read: { rows: [], whole: true, pages: 1 } };
  state.calls = [];
  assert.match(await refusing(() => refusalFrom(filing, shape, { page })),
    /Naming forge issue, still open: ISS-45/u, "the search reached its answer and the route says what it named");
  assert.ok(state.calls.some((one) => one.args?.filters?.search === "forge issue"),
    "and that one request was the search, the page handed in buying no walk");
  state.status = 403;
  try {
    await assert.rejects(refusing(() => refusalFrom(filing, shape, { page })), /Forge answered 403/u,
      "swallowed, it would have come back as the sentence above with the tracker down");
  } finally {
    state.status = undefined;
  }
});

/* Six settled rows is what the old ask fitted, being CANDIDATES + the length of the settled list. */
test("settled rows ahead of an open one no longer hide it, the ask being a count of rows", async () => {
  const rows = [...SETTLED_SIX, OPEN_BEHIND];
  const run = await routed(() => ({ issues: rows }));
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Naming forge issue, still open: ISS-88/u,
    "the seventh row is inside the page the route reads, and openTitles keeps it");
  assert.doesNotMatch(run.stderr, /No open issue names/u);
});

test("a page with rows behind it and no open row among them says the reading did not settle it", async () => {
  const run = await routed(() => ({ issues: SETTLED_SIX, beyond: 4 }));
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Whether an open issue names forge issue is unread/u);
  assert.doesNotMatch(run.stderr, /No open issue names/u,
    "four rows the route counted and would not serve is silence, not absence");
  assert.match(run.stderr, /forge issues --search forge issue/u,
    "and the one command that finishes the reading, the sentence sitting under `Name a route:`");
});

test("a page the route served whole with no open row on it still says no open issue names it", async () => {
  const run = await routed(() => ({ issues: SETTLED_SIX }));
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No open issue names forge issue, so --size fix is the route unless you know one\./u);
  assert.doesNotMatch(run.stderr, /is unread/u, "the reading reached its answer, and the answer is none");
});

/* The duplicate check's own line, in process: it is a console.error beside a refusal that may be
   null, so spawning a verb would judge the wrong thing. */
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

/* A page still reporting rows the next offset did not serve: 97 rows over 36 requests. */
const SHORT_READ = { rows: Array.from({ length: 97 }, () => ({})), whole: false, pages: 36 };

test("the duplicate check says its reading was short, in the count it measured", async () => {
  const out = await said({ live: [], read: SHORT_READ });
  assert.match(out, /reached 97 issue\(s\) over 36 page\(s\)/u);
  assert.match(out, /add filters until/u, "and the way out, the route sending no sentence of its own");
});

test("that line names no limit it asked for", async () => {
  const out = await said({ live: [], read: SHORT_READ });
  assert.doesNotMatch(out, /\b500\b/u, "and the old line named 500 twice");
});

test("that line still says what the short reading costs the check", async () => {
  const out = await said({ live: [], read: SHORT_READ });
  assert.match(out, /Past that ceiling the measure is what a search for/u);
  assert.match(out, /sharing no such name is not/u);
});

test("a reading the walk finished leaves the check silent", async () => {
  assert.equal(await said({ live: [], read: { rows: [], whole: true, pages: 1, notice: null } }), "");
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

test("the parts refusal clears by the edge, the keys it read being issues already", () => {
  const clear = clears(`${WHOLE}\n\nParts: iss-48 and ISS-58.`);
  assert.match(clear, /take the claim off the line and re-send with `--with ISS-48,ISS-58`/u,
    "a filer told only to file each part is told to file issues that exist");
  assert.doesNotMatch(clear, /file each part on its own/u);
  assert.match(clears(`${WHOLE}\n\nSplit into ISS-48 (the parser, as ISS-99 asked) and ISS-58.`),
    /`--with ISS-48,ISS-58`/u, "a key cited inside a label is no part, so no edge is offered for it");
});
