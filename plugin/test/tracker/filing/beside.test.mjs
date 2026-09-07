/* The fold acted on, spawned against a tracker. It is a comment nothing here can take back, so
   every case that keeps it from firing is worth as much as the one that makes it: a same-place hit
   the semantic query never ranked, an issue the projection says is closed, a kind whose body names
   no cause, a search that could not run at all. What the fold decides before it acts, and what each
   reply says of it, is fold.test.mjs; the reasoning is docs/cli/the-fold.md's. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempHome } from "../../fixtures.mjs";

const home = tempHome("neighbours");
process.env.XDG_CONFIG_HOME = home.path;

const OPEN = { issueId: "ISS-45", documentId: "uuid-45", status: "open", title: "the attach verb refuses a name already on the issue" };
const SETTLED = { issueId: "ISS-70", documentId: "uuid-70", status: "closed", title: "the browse projection answers with a cursor" };
const ELSEWHERE = { issueId: "ISS-52", documentId: "uuid-52", status: "in_progress", title: "the consult log records the effort it asked for" };

const state = { issues: [OPEN, SETTLED, ELSEWHERE], comments: {}, calls: [], memory: {} };
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

mkdirSync(join(home.path, "forge"), { recursive: true });
writeFileSync(join(home.path, "forge", "config.json"), JSON.stringify({ url: tracker.url, token: "t" }));

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const room = tempHome("filing").path;

/* A body with no rule and no out-of-scope reads as a fix and is refused for a route, so every body
   below carries both: what is measured here is the fold, not the route offer. */
const BODY = [
  "## What happened",
  "",
  "`forge attach issue ISS-45 ./gate.txt` puts a second document of that name beside the first.",
  "",
  "## Why it happens",
  "",
  "`plugin/src/commands.mjs` uploads under the name it was handed, reading nothing already there.",
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

const posted = (...argv) => {
  const path = join(room, "body.md");
  writeFileSync(path, `${BODY}\n`);
  return ranAsync(FORGE, ["comment", "ISS-45", path, ...argv], tracker.env);
};

/* The body carries a *Where*, which is the bug shape's, so the kind is named on every filing but
   the one that redirects, `--size fix`, which reads no shape at all. */
const filed = (...argv) => wrote("--kind", "bug", ...argv);

const both = (key, score) => ({ semantic: [[key, score]], keyword: [[key, 0.0608]] });

const created = () => state.calls.find((one) => one.name === "forge_issues" && one.args.action === "create");
const commented = () => state.calls.find((one) => one.name === "forge_comments" && one.args.action === "create");
const before = () => {
  state.calls = [];
  state.answer = {};
  state.memory = {};
};

/* `--new` so the filing lands rather than folding: what is measured here is the block's own rows. */
test("a filing is told what is open beside it, on a filing that was refused nothing", async () => {
  before();
  state.memory = { semantic: [[OPEN.issueId, 0.83], [ELSEWHERE.issueId, 0.71]], keyword: [[OPEN.issueId, 0.06]] };
  const run = await filed("--new");
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
  assert.match(run.stdout, /--new declined the fold: ISS-45 is the nearest of the neighbours/u);
  /* And the flag reaches neither the payload nor the flags a --into refusal lists as a filing's. */
  assert.equal("new" in created().args.data, false);
});

/* The flag this verb no longer takes: refused before any of the above is reached, so a filing it
   would once have redirected costs no reading at all. */
test("--into is refused with the verb that took it over, and files nothing", async () => {
  before();
  const run = await wrote("--into", "ISS-45", "--new");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /`forge new --into` is retired/u);
  assert.match(run.stderr, /forge comment <uuid\|ISS-45>/u);
  assert.equal(state.calls.some((one) => one.args.action === "create"), false);
});

test("forge comment redirects as --into did, and asks the tracker nothing about neighbours", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.83);
  const run = await posted();
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

/* A filing riding another issue's branch owes no fold: it is already answered somewhere, and the
   comment would land on a third issue that is neither. The one condition the two routes never
   shared, so nothing but this case keeps it from being dropped as a copy. */
test("a marked filing routed onto another issue's branch is filed and never folded", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.83);
  const run = await filed("--size", "fix", "--with", ELSEWHERE.issueId);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(created(), "it was filed rather than folded");
  assert.equal(commented(), undefined, "and nothing was posted onto the neighbour it reads like");
  assert.deepEqual(created().args.data.relations, [{ kind: "relates", blocksId: ELSEWHERE.documentId }]);
  assert.match(run.stdout, /^ {2}ISS-45 {3}0\.83 {2}same place/mu, "the block still prints");
});

/* Criterion 6: the consequential case of dropping the rung. This body carries no mark at all, so it
   is read as a `feature` by the tier the flow costs most for, and it folds all the same. */
test("a filing that names its cause folds whatever size it is marked at, this one at none", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.99);
  const run = await filed();
  assert.equal(run.status, 0, run.stderr);
  assert.equal(created(), undefined, "the mark is no longer what buys the fold");
  assert.equal(commented().args.data.issue, OPEN.documentId);
  assert.doesNotMatch(commented().args.data.body, /Size:/u, "and no mark was invented to justify it");
});

test("and the same body marked `Size: feature.` folds too", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.99);
  const run = await filed("--size", "feature");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(created(), undefined);
  assert.equal(commented().args.data.issue, OPEN.documentId);
  assert.match(commented().args.data.body, /Size: feature\./u, "the mark travels with it and decides nothing");
});

/* Criterion 21, and the case the predicate exists for: `tools/run.mjs` files the ship's own batch
   reading as a `review` with no mark, and consecutive readings differ only in two abbreviated shas.
   Without the predicate the reading of a new range would land on the previous range's issue and no
   issue would exist for the new one — which is the whole of what that step's accounting rests on. */
test("a kind whose body names no cause folds onto nothing, however near the neighbour reads", async () => {
  for (const kind of ["review", "feature"]) {
    before();
    state.memory = both(OPEN.issueId, 0.99);
    const path = join(room, "body.md");
    writeFileSync(path, `## Outcome\n\nthe range is read once as a whole\n\n## Rules\n\n`
      + `- \`plugin/src/commands.mjs\` is inside the range.\n\n## Out of scope\n\nthe rest of the tree.\n`);
    const run = await ranAsync(FORGE, ["new", path, "--title", TITLE, "--kind", kind], tracker.env);
    assert.equal(run.status, 0, run.stderr);
    assert.ok(created(), `a ${kind} was folded away instead of filed`);
    assert.equal(commented(), undefined, `a ${kind} became a comment on ${OPEN.issueId}`);
    assert.match(run.stdout, /^ {2}ISS-45 {3}0\.99 {2}same place/mu, "and it is still shown the neighbour");
  }
});

test("a search the tracker refuses files the issue and says the check could not run", async () => {
  before();
  state.answer = { "forge_memory.search": () => ({ refused: "forge_memory.search is not available to this credential" }) };
  const run = await filed("--size", "fix");
  assert.equal(run.status, 0, run.stderr);
  assert.ok(created(), "the filing lands whatever the check did");
  assert.match(run.stdout, /the semantic query could not run: .*forge_memory.search is not available/u,
    "the tracker's own code and message, and no words of ours in front of them");
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

/* ISS-335 closed this route: the reading below is `forge new`'s, and the raw call took none of the
   rest of it — no kind required, no rank written, no key in the reply. So the call is refused with
   the verb, and nothing is filed by it. */
test("a raw create is refused with the verb that reads it, and files nothing", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.83);
  const payload = JSON.stringify({
    action: "create",
    data: { title: TITLE, description: `${BODY}\n\nSize: fix.\n`, category: "bug" },
  });
  const run = await ranAsync(FORGE, ["call", "forge_issues", payload], tracker.env);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /forge_issues create is what `forge new` wraps/u);
  assert.equal(created(), undefined, "and the call it refused was never made");
  assert.equal(run.stdout, "", "nothing was said beside a filing that did not happen");
});

/* The defect route files on the same measure: ISS-162 was filed through it as a duplicate of the
   open ISS-156, which is the case ISS-139 was opened for. */
const noteFile = () => {
  const path = join(room, "note.md");
  writeFileSync(path, `${BODY}\n\nSize: fix.\n`);
  return path;
};

const noted = (...argv) =>
  ranAsync(FORGE, ["feedback", noteFile(), "--title", TITLE, ...argv], tracker.env);

test("a note whose title is open nowhere folds onto the neighbour that shares its place", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.83);
  const run = await noted();
  assert.equal(run.status, 0, run.stderr);
  assert.equal(created(), undefined);
  assert.equal(commented().args.data.issue, OPEN.documentId);
  assert.match(run.stdout, /^ISS-45 is open, names the same place/mu);
});

/* An exact title is a neighbour like any other and routes nothing on its own (ISS-334); the note
   below is measured under the fold's floor, so nothing else could have acted either. */
test("a note whose title is already open on that project is filed rather than commented there", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.5);
  const run = await ranAsync(FORGE, ["feedback", noteFile(), "--title", OPEN.title], tracker.env);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(created(), "the title matches ISS-45 exactly and no longer routes the note there");
  assert.equal(commented(), undefined);
  assert.equal(created().args.data.title, OPEN.title);
});

/* A note that names its issue rides that issue's flow, so the fold may not put it on a third. */
test("a note naming an issue with --with relates it and declines the fold", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.83);
  const run = await ranAsync(FORGE, ["feedback", noteFile(), "--title", TITLE, "--with", "ISS-52"], tracker.env);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(created(), "0.83 would have folded it, and --with is a route of its own");
  assert.equal(commented(), undefined);
  assert.deepEqual(created().args.data.relations, [{ kind: "relates", blocksId: ELSEWHERE.documentId }]);
});

test("a note declines the fold with --new, and prints the block above what it filed", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.83);
  const run = await noted("--new");
  assert.equal(run.status, 0, run.stderr);
  assert.ok(created());
  assert.match(run.stdout, /^ {2}ISS-45 {3}0\.83 {2}same place/mu);
  assert.match(run.stdout, /--new declined the fold/u);
  /* Criterion 13, on the outcome with the most to print: once, and before the line about the body. */
  assert.equal(run.stdout.match(/Open beside this filing/gu).length, 1);
  assert.ok(run.stdout.indexOf("Open beside this filing") < run.stdout.indexOf("The note is a new bug"),
    "the filer reads what was open and then what became of their body, not the other way round");
});

test("the note verb still refuses a flag that is neither of its two", async () => {
  before();
  const run = await noted("--kind", "bug");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /feedback takes --title, --with and --new and nothing else; --kind names no flag/u);
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
  /* Criterion 12: that hold exits the process, so a block printed after the fold would be a block
     this filer never saw at all — the one filing whose neighbours most want reading. */
  assert.match(held.stdout, /^ {2}ISS-45 {3}0\.83 {2}same place/mu,
    "the block goes out before the fold acts, so a held fold has already printed it");
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

/* The same two questions, spawned rather than in process: the verb has to pass them separately.
   Criterion 21's other half — the filing that could never have folded is told which of the two
   reasons it was, so nobody goes looking for a mark or a flag that was never the condition. */
test("--new on a kind that owes no cause names the neighbour and says the kind is why", async () => {
  before();
  state.memory = both(OPEN.issueId, 0.83);
  const path = join(room, "body.md");
  writeFileSync(path, "## Outcome\n\nthe verb takes the name it is handed\n\n## Rules\n\n"
    + "- `plugin/src/commands.mjs` is where the name is read.\n\n## Out of scope\n\nthe rest of it.\n");
  const run = await ranAsync(FORGE, ["new", path, "--title", TITLE, "--kind", "feature", "--new"], tracker.env);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(created());
  assert.match(run.stdout, /--new declined nothing to decline: ISS-45 would have qualified/u);
  assert.match(run.stdout, /this filing is of a kind whose body names no cause/u);
  assert.doesNotMatch(run.stdout, /no open issue both reads like this filing/u);
});

/* A body from a file is on disk and one from stdin exists nowhere else, so the second is registered
   before the first tracker read: a refusal past that point — the shape's, the duplicate's, a hold
   from the fold — would otherwise be the body gone with the process. */
test("a body piped in is printed back by a refusal that comes after the read", async () => {
  before();
  const body = "## Outcome\n\nthe piped body reaches the refusal and comes back out of it\n";
  const argv = ["new", "-", "--title", "the piped body survives what refuses it", "--kind", "feature"];
  const run = await ranAsync(FORGE, argv, tracker.env, process.cwd(), body);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /Your body, so that nothing here loses it:/u);
  assert.match(run.stderr, /the piped body reaches the refusal and comes back out of it/u);
  assert.equal(created(), undefined);
});

/* The other half of the same rule: a refusal BEFORE the read may not consume the one payload
   nothing can send twice, so the kind is asked for ahead of the body rather than beside it. */
test("a filing with no kind is refused without reading the stdin it was piped", async () => {
  before();
  const body = "## Outcome\n\nthe body nothing read is the body still in the sender's hand\n";
  const argv = ["new", "-", "--title", "the kind is asked for before the body is taken"];
  const run = await ranAsync(FORGE, argv, tracker.env, process.cwd(), body);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /A filing needs --kind/u);
  assert.match(run.stderr, /bug, enhancement, feature, review/u);
  assert.doesNotMatch(run.stderr, /Your body, so that nothing here loses it:/u,
    "nothing was read, so there is nothing to print back and nothing was lost");
  assert.equal(created(), undefined);
});

/* A closed stdin proves nothing: a body read before the refusal reads empty and the case above
   still passes. Here the pipe is never ended, so a route that takes the body cannot answer at all. */
test("that refusal answers on a stdin nothing ever closes", async () => {
  before();
  const child = spawn(FORGE, ["new", "-", "--title", "the kind is asked for before the body is taken"],
    { env: tracker.env, stdio: ["pipe", "pipe", "pipe"] });
  child.stdin.write("## Outcome\n\nheld open, and the sender still has it\n");
  const said = await new Promise((done) => {
    let err = "";
    const giveUp = setTimeout(() => {
      child.kill("SIGKILL");
      done({ code: null, err });
    }, 20000);
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.on("exit", (code) => {
      clearTimeout(giveUp);
      done({ code, err });
    });
  });
  child.stdin.destroy();
  assert.equal(said.code, 1, `the refusal never came; the body was being waited for:\n${said.err}`);
  assert.match(said.err, /A filing needs --kind/u);
  assert.equal(created(), undefined);
});

/* One decision, so one reply: the two routes fold through the same call, and a correction of what
   either says is a correction of both. Anything either route prints ahead of the fold sentence is
   its own — a comment payload here, a title verdict there — and everything from it on is shared. */
test("the two filing routes fold with the same words, so neither can be corrected alone", async () => {
  const tailFrom = (out) => {
    const at = out.indexOf(`${OPEN.issueId} is open, names the same place`);
    assert.notEqual(at, -1, `no fold reply in:\n${out}`);
    return out.slice(at);
  };
  before();
  state.memory = both(OPEN.issueId, 0.83);
  const verb = await filed("--size", "fix");
  assert.equal(verb.status, 0, verb.stderr);
  assert.equal(commented().args.data.issue, OPEN.documentId);
  before();
  state.memory = both(OPEN.issueId, 0.83);
  const note = await noted();
  assert.equal(note.status, 0, note.stderr);
  assert.equal(commented().args.data.issue, OPEN.documentId);
  assert.equal(tailFrom(note.stdout), tailFrom(verb.stdout));
});
