/* What is open beside a filing, and what a fix-size filing joins. The fold is a comment nothing
   here can take back, so every case that keeps it from firing is worth as much as the one that
   makes it: a same-place hit the semantic query never ranked, an issue the projection says is
   closed, a search that could not run at all. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempHome } from "../fixtures.mjs";

const home = tempHome("neighbours");
process.env.XDG_CONFIG_HOME = home.path;
const { BESIDE_HELP, FLOOR, foldOnto, foldedInto, suggestionLines } =
  await import("../../src/tracker/neighbours.mjs");
const { placeIn, seedFor } = await import("../../src/tracker/issue-shape.mjs");

const suggestion = (issueId, score, samePlace) =>
  ({ issueId, documentId: `uuid-${issueId}`, title: `${issueId}'s title`, score, samePlace });

/* Both signals on one issue, because the place query ranks nothing: every hit it returns comes back
   at one score, so on its own it would name whichever issue the tracker happened to list first. */
test("the fold takes the nearest open neighbour that also names the place, and nothing else", () => {
  const near = suggestion("ISS-2", 0.81, true);
  assert.equal(foldOnto([suggestion("ISS-1", 0.9, false), near, suggestion("ISS-3", 0.7, true)]), near,
    "the higher-scoring ISS-1 names another place, and ISS-3 is the same place further away");
  assert.equal(foldOnto([suggestion("ISS-1", 0.9, false)]), null, "a neighbour elsewhere is no fold");
  assert.equal(foldOnto([suggestion("ISS-1", null, true)]), null,
    "and one the place query alone found is a place match nothing ranked");
  assert.equal(foldOnto([]), null);
});

test("the floor is one constant, and it is the one the measurement names", () => {
  assert.equal(FLOOR, 0.7);
});

test("the block prints the key, how near it reads and whether the place matched", () => {
  const lines = suggestionLines({
    suggestions: [suggestion("ISS-2", 0.83, true), suggestion("ISS-9", null, true)],
    notes: [],
    place: "plugin/src/commands.mjs",
  }).join("\n");
  assert.match(lines, /^ {2}ISS-2 {4}0\.83 {2}same place {2}ISS-2's title$/mu);
  assert.match(lines, /^ {2}ISS-9 {4} {2}— {2} {2}same place {2}ISS-9's title$/mu,
    "a place match the semantic query never ranked shows no score rather than a made-up one");
  assert.match(lines, /a duplicate filed anyway is one the filer was shown/u);
});

/* A filing told nothing cannot tell a backlog with nothing like it from a check that never ran, and
   the second is the one worth knowing. */
test("a filing that found nothing is told so, and one whose search failed is told which", () => {
  const empty = suggestionLines({ suggestions: [], notes: [], place: "forge dep" }).join("\n");
  assert.match(empty, /Nothing open reads like this filing or names `forge dep` — the check ran and found none/u);
  const broken = suggestionLines({
    suggestions: [],
    notes: ["the semantic query could not run: Forge answered 400: no"],
    place: null,
  }).join("\n");
  assert.match(broken, /the semantic query could not run: Forge answered 400/u);
  assert.match(broken, /this filing was made as it would have been without it/u);
  assert.doesNotMatch(broken, /or names/u, "and a filing with no place is not told about one");
  /* The two are what this exists to tell apart, so they cannot both be said of one filing. */
  assert.doesNotMatch(broken, /the check ran and found none/u);
  assert.match(broken, /the check did not run whole/u);
});

/* Qualifying and being foldable are two questions: a neighbour that would have taken a marked
   filing takes nothing from an unmarked one, and one line for both states a backlog nobody read. */
test("--new tells a fold it declined from one it was never going to make, and from neither", () => {
  const nearest = suggestion("ISS-2", 0.83, true);
  const block = { suggestions: [nearest], notes: [], place: "p" };
  const said = (options) => suggestionLines(block, { fresh: true, ...options }).join("\n");
  assert.match(said({ nearest, foldable: true }),
    /--new declined the fold: this filing is marked and ISS-2 is the nearest of the neighbours naming its place/u);
  assert.match(said({ nearest, foldable: false }),
    /--new declined nothing to decline: ISS-2 would have qualified, and only a filing marked/u);
  assert.match(said({ nearest: null, foldable: true }),
    /--new declined nothing: no open issue both reads like this filing at 0\.78/u);
  /* Without the flag none of the three is owed: what is open is said and no more. */
  assert.doesNotMatch(suggestionLines(block, { nearest, foldable: true }).join("\n"), /--new/u);
});

test("the fold's reply names the issue and why it won, and claims no nearness it does not have", () => {
  const said = foldedInto(suggestion("ISS-2", 0.83, true));
  assert.match(said, /^ISS-2 is open, names the same place and is the nearest of the neighbours that do, at 0\.83/u);
  /* A neighbour reading closer under another place is not the nearest of all, and a reply saying
     so would be false on exactly the filings the fold is least sure about. */
  assert.doesNotMatch(said, /nearest to this filing/u);
  assert.match(said, /lands there as a finding under its own title/u);
  assert.match(said, /No issue was filed and no lease was taken/u);
  assert.match(said, /the block below is everything it was measured against/u);
});

test("the help says what the two queries are, the floor, and what the fold needs", () => {
  assert.match(BESIDE_HELP, /what reads like this filing, and what names the same place/u);
  assert.match(BESIDE_HELP, /at or above 0\.70/u);
  assert.match(BESIDE_HELP, /--new {7}file it even where the mark would have folded it/u);
  assert.match(BESIDE_HELP, /Both signals\s+are needed/u);
});

/* The two seeds, read off the body the shape reader already scanned. */
test("the place is the Where section's first path or verb, and the body's own where there is none", () => {
  assert.equal(placeIn("## Where\n\n`plugin/src/commands.mjs`, the attach verb\n"), "plugin/src/commands.mjs");
  assert.equal(placeIn("`forge dep` takes `--json`, and `plugin/src/x.mjs` holds it"), "forge dep",
    "with no Where section the body's first names it");
  /* The Where section wins even where the body named something earlier: the place is where the
     defect is, and the prose above it names whatever it is being compared against. */
  assert.equal(placeIn("`forge record` already does it.\n\n## Where\n\n`forge attach`, the bare verb\n"),
    "forge attach");
  assert.equal(placeIn("nothing in here names a thing at all"), null);
  /* A *Where* whose prose names nothing does not suppress the body: an empty section is no place,
     and the filing that carries one would otherwise send no place query at all. */
  assert.equal(placeIn("`forge dep` writes it.\n\n## Where\n\nwherever the edge is written.\n"), "forge dep");
});

test("the semantic seed is the title and the first section the kind requires", () => {
  const body = "## What happened\n\nthe verb refuses a name it should take\n\n## Outcome\n\nit takes it\n";
  assert.equal(seedFor({ title: "the verb takes the name", body, kind: "bug" }),
    "the verb takes the name\n\nthe verb refuses a name it should take");
  /* A feature has no past-tense section, so the same body seeds from the outcome instead. */
  assert.equal(seedFor({ title: "t", body, kind: "feature" }), "t\n\nit takes it");
  /* A marked body is read against no section and may carry no heading at all. */
  assert.equal(seedFor({ title: "t", body: "one line, no heading, marked\n\nSize: fix.\n" }),
    "t\n\none line, no heading, marked");
});

/* End to end. What a hit carries and what the projection carries are different things, and only a
   verb spawned against a tracker measures which one the block read. */
const OPEN = { issueId: "ISS-45", documentId: "uuid-45", status: "open", title: "the attach verb refuses a name already on the issue" };
const SETTLED = { issueId: "ISS-70", documentId: "uuid-70", status: "closed", title: "the browse projection answers with a cursor" };
const ELSEWHERE = { issueId: "ISS-52", documentId: "uuid-52", status: "in_progress", title: "the consult log records the effort it asked for" };

const state = { issues: [OPEN, SETTLED, ELSEWHERE], comments: {}, calls: [], memory: {} };
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

mkdirSync(join(home.path, "forge"), { recursive: true });
writeFileSync(join(home.path, "forge", "config.json"), JSON.stringify({ url: tracker.url, token: "t" }));

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const room = tempHome("filing").path;

/* A body with no rule and no out-of-scope reads as a fix and is refused for a route, so every body
   below carries both: what is measured here is the fold, not the route offer. */
const BODY = [
  "## What happened",
  "",
  "`forge attach issue ISS-45 ./gate.txt` puts a second document of that name beside the first.",
  "",
  "## Where",
  "",
  "`plugin/src/commands.mjs`, the attach verb.",
  "",
  "## Outcome",
  "",
  "One name on one issue names one document, whichever verb put it there.",
  "",
  "## Rules",
  "",
  "- A name already on the issue is refused rather than attached twice.",
  "",
  "## Out of scope",
  "",
  "The names already doubled.",
].join("\n");

const TITLE = "one name on an issue resolves to one document";

const wrote = (...argv) => {
  const path = join(room, "body.md");
  writeFileSync(path, `${BODY}\n`);
  return ranAsync(FORGE, ["new", path, "--title", TITLE, ...argv], tracker.env);
};

/* The body carries a *Where*, which is the bug shape's, so the kind is named on every filing but
   the two that redirect: `--into` refuses every flag a filing takes, `--kind` among them. */
const filed = (...argv) => wrote("--kind", "bug", ...argv);

const both = (key, score) => ({ semantic: [[key, score]], keyword: [[key, 0.0608]] });

const created = () => state.calls.find((one) => one.name === "forge_issues" && one.args.action === "create");
const commented = () => state.calls.find((one) => one.name === "forge_comments" && one.args.action === "create");
const before = () => {
  state.calls = [];
  state.answer = {};
  state.memory = {};
};

test("a filing is told what is open beside it, on a filing that was refused nothing", async () => {
  before();
  state.memory = { semantic: [[OPEN.issueId, 0.83], [ELSEWHERE.issueId, 0.71]], keyword: [[OPEN.issueId, 0.06]] };
  const run = await filed();
  assert.equal(run.status, 0, run.stderr);
  assert.ok(created(), "the filing was made");
  assert.match(run.stdout, /^ {2}ISS-45 {3}0\.83 {2}same place {2}the attach verb refuses a name already on the issue$/mu);
  assert.match(run.stdout, /^ {2}ISS-52 {3}0\.71 {14}the consult log records the effort it asked for$/mu);
  /* The title came from the projection: the hit's own text is the body as it was embedded. */
  assert.doesNotMatch(run.stdout, /as it was embedded/u);
});

test("a hit under the floor and a hit the projection calls closed are not suggested", async () => {
  before();
  state.memory = { semantic: [[SETTLED.issueId, 0.95], [ELSEWHERE.issueId, 0.69]], keyword: [] };
  const run = await filed();
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /ISS-70/u, "a closed issue is never suggested, whatever it scored");
  assert.doesNotMatch(run.stdout, /ISS-52/u, "and 0.69 is under the floor");
  assert.match(run.stdout, /the check ran and found none/u);
});

test("the two queries and the resolve cost the filing one issue-list call", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.83);
  const run = await filed("--size", "fix", "--new");
  assert.equal(run.status, 0, run.stderr);
  const listed = state.calls.filter((one) => one.name === "forge_issues" && one.args.action === "list");
  assert.equal(listed.filter((one) => !one.args.filters).length, 1,
    "the duplicate check's page and the open-issues resolve are the same page");
  const searches = state.calls.filter((one) => one.name === "forge_memory.search");
  assert.deepEqual(searches.map((one) => one.args.strategy).sort(), ["keyword", "semantic"]);
  assert.deepEqual(searches.map((one) => one.args.sourceFilter), [["issue"], ["issue"]]);
  assert.ok(searches.every((one) => one.args.projectId), "the tool requires the project id");
});

test("a marked filing whose nearest open neighbour names its place lands there as a finding", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.83);
  const run = await filed("--size", "fix");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(created(), undefined, "no second issue was filed");
  const said = commented();
  assert.equal(said.args.data.issue, OPEN.documentId);
  assert.match(said.args.data.body, new RegExp(`^## ${TITLE.slice(0, 8)}`, "u"),
    "the filing's own title is the comment's first line, so the run sees each defect as one item");
  assert.match(said.args.data.body, /Size: fix\./u, "and the mark travels with it");
  assert.match(run.stdout, /^ISS-45 is open, names the same place and is the nearest of the neighbours that do, at 0\.83/mu);
  /* The block prints on every filing, this one included: the reply names the destination and the
     block is what says what else was open, with the titles and the scores. */
  assert.match(run.stdout, /^ {2}ISS-45 {3}0\.83 {2}same place {2}the attach verb refuses a name already on the issue$/mu);
});

test("--new declines the fold, files the issue and names what it would have joined", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.83);
  const run = await filed("--size", "fix", "--new");
  assert.equal(run.status, 0, run.stderr);
  assert.ok(created(), "the filing was made after all");
  assert.equal(commented(), undefined);
  assert.match(run.stdout, /--new declined the fold: this filing is marked and ISS-45/u);
  /* And the flag reaches neither the payload nor the flags a --into refusal lists as a filing's. */
  assert.equal("new" in created().args.data, false);
});

test("--into and --new ask for opposite things and are refused together", async () => {
  before();
  const run = await wrote("--into", "ISS-45", "--new");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--into posts the body on the issue you named and --new refuses/u);
  assert.equal(state.calls.some((one) => one.args.action === "create"), false);
});

test("--into redirects as it did, and asks the tracker nothing about neighbours", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.83);
  const run = await wrote("--into", "ISS-45");
  assert.equal(run.status, 0, run.stderr);
  assert.ok(commented());
  assert.equal(state.calls.some((one) => one.name === "forge_memory.search"), false);
  assert.doesNotMatch(run.stdout, /Open beside this filing/u);
});

/* A place match nothing ranked is the case the fold is bought against: the keyword query answers
   every hit at one score, so a fold on it alone would post onto whichever came back first. */
test("a same-place hit the semantic query never ranked is printed and not folded onto", async () => {
  before();
  state.memory = { semantic: [], keyword: [[OPEN.issueId, 0.0608]] };
  const run = await filed("--size", "fix");
  assert.equal(run.status, 0, run.stderr);
  assert.ok(created(), "it was filed rather than folded");
  assert.equal(commented(), undefined);
  assert.match(run.stdout, /^ {2}ISS-45\s+—\s+same place {2}the attach verb/mu);
});

test("a filing that is not marked is never folded, however near the neighbour reads", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.99);
  const run = await filed();
  assert.equal(run.status, 0, run.stderr);
  assert.ok(created());
  assert.equal(commented(), undefined);
});

test("a search the tracker refuses files the issue and says the check could not run", async () => {
  before();
  state.answer = { "forge_memory.search": () => ({ refused: "forge_memory.search is not available to this credential" }) };
  const run = await filed("--size", "fix");
  assert.equal(run.status, 0, run.stderr);
  assert.ok(created(), "the filing lands whatever the check did");
  assert.match(run.stdout, /the semantic query could not run: forge_memory.search is not available/u);
  assert.match(run.stdout, /the keyword query could not run/u);
  assert.match(run.stdout, /this filing was made as it would have been without it/u);
  assert.doesNotMatch(run.stdout, /the check ran and found none/u, "which it did not");
});

/* The refusal a `soft` call cannot reach: `fail()` exits, so before ISS-139 a gateway status on this
   read killed the filing and, from stdin, the body with it. 400 rather than 503, which is retried. */
test("a search the transport loses files the issue too, and does not exit before the write", async () => {
  before();
  state.answer = { "forge_memory.search": () => ({ http: 400 }) };
  const run = await filed("--size", "fix");
  assert.equal(run.status, 0, run.stderr);
  assert.ok(created(), "the write happened, so nothing exited on the read beside it");
  assert.match(run.stdout, /the semantic query could not run: Forge answered 400/u);
  assert.doesNotMatch(run.stdout, /may have been processed/u,
    "a read named by its tool rather than by an action field is still a read");
});

test("a raw create is told what is open beside it and is never folded onto it", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.83);
  const payload = JSON.stringify({
    action: "create",
    data: { title: TITLE, description: `${BODY}\n\nSize: fix.\n`, category: "bug" },
  });
  const run = await ranAsync(FORGE, ["call", "forge_issues", payload], tracker.env);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(created(), "the call asked for a create and got one");
  assert.equal(commented(), undefined, "and carries no flag to decline a comment with");
  assert.match(run.stdout, /^ {2}ISS-45 {3}0\.83 {2}same place/mu);
});

/* The defect route files on the same measure: ISS-162 was filed through it as a duplicate of the
   open ISS-156, which is the case ISS-139 was opened for. */
const noted = (...argv) => {
  const path = join(room, "note.md");
  writeFileSync(path, `${BODY}\n\nSize: fix.\n`);
  return ranAsync(FORGE, ["feedback", path, "--title", TITLE, ...argv], tracker.env);
};

test("a note whose title is open nowhere folds onto the neighbour that shares its place", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.83);
  const run = await noted();
  assert.equal(run.status, 0, run.stderr);
  assert.equal(created(), undefined);
  assert.equal(commented().args.data.issue, OPEN.documentId);
  assert.match(run.stdout, /No open issue on forge-plugin carries this title, and ISS-45 is open/u);
});

test("a note declines the fold with --new, and prints the block under what it filed", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.83);
  const run = await noted("--new");
  assert.equal(run.status, 0, run.stderr);
  assert.ok(created());
  assert.match(run.stdout, /^ {2}ISS-45 {3}0\.83 {2}same place/mu);
  assert.match(run.stdout, /--new declined the fold/u);
});

test("the note verb still refuses a flag that is neither of its two", async () => {
  before();
  const run = await noted("--kind", "bug");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /feedback takes --title and --new and nothing else; --kind names no flag/u);
});

/* The band the block prints from is the band the measurement calls machinery rather than subject,
   so the fold has its own threshold above it: printing costs a glance and this costs a comment. */
test("a same-place neighbour inside the printed band is shown and not folded onto", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.72);
  const run = await filed("--size", "fix");
  assert.equal(run.status, 0, run.stderr);
  assert.ok(created(), "0.72 is over the printing floor and under the fold's");
  assert.equal(commented(), undefined);
  assert.match(run.stdout, /^ {2}ISS-45 {3}0\.72 {2}same place/mu);
});

/* A destination the filer did not name is one whose thread may already carry this finding. */
test("the fold reads the target's thread once before it writes to it", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.83);
  state.comments = { [OPEN.documentId]: [{ documentId: "c-1", body: "already reported here", createdAt: "2026-09-04T00:00:00Z" }] };
  const held = await filed("--size", "fix");
  state.comments = {};
  assert.equal(held.status, 1, held.stdout);
  assert.match(held.stderr, /Hold — this writes to ISS-45/u);
  assert.match(held.stderr, /already reported here/u, "the thread is delivered rather than described");
  assert.equal(commented(), undefined, "and nothing was written while it was unread");
});

test("and folds on the re-send, the thread having been shown to that session", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.83);
  state.comments = { [OPEN.documentId]: [{ documentId: "c-1", body: "already reported here", createdAt: "2026-09-04T00:00:00Z" }] };
  const env = { ...tracker.env, FORGE_SESSION_ID: "beside-fold" };
  const path = join(room, "body.md");
  writeFileSync(path, `${BODY}\n`);
  const argv = ["new", path, "--title", TITLE, "--kind", "bug", "--size", "fix"];
  assert.equal((await ranAsync(FORGE, argv, env)).status, 1, "held once");
  const again = await ranAsync(FORGE, argv, env);
  state.comments = {};
  assert.equal(again.status, 0, again.stderr);
  assert.equal(created(), undefined, "no second issue");
  assert.equal(commented().args.data.issue, OPEN.documentId);
});

/* The same two questions, spawned rather than in process: the verb has to pass them separately. */
test("--new on an unmarked filing names the neighbour that would have qualified", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.83);
  const run = await filed("--new");
  assert.equal(run.status, 0, run.stderr);
  assert.ok(created());
  assert.match(run.stdout, /--new declined nothing to decline: ISS-45 would have qualified/u);
  assert.doesNotMatch(run.stdout, /no open issue both reads like this filing/u);
});

/* A body from a file is on disk and one from stdin exists nowhere else, so the second is registered
   before the first tracker read: a refusal past that point — the shape's, the duplicate's, a hold
   from the fold — would otherwise be the body gone with the process. */
test("a body piped in is printed back by a refusal that comes after the read", async () => {
  before();
  const body = "## Outcome\n\nthe piped body reaches the refusal and comes back out of it\n";
  const argv = ["new", "-", "--title", "the piped body survives what refuses it"];
  const run = await ranAsync(FORGE, argv, tracker.env, process.cwd(), body);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /Your body, so that nothing here loses it:/u);
  assert.match(run.stderr, /the piped body reaches the refusal and comes back out of it/u);
  assert.equal(created(), undefined);
});
