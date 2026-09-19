/* Every delegated run reviews its own diff and stops there, so a helper two of them each wrote is
   inside no run's range and is found by nobody (ISS-95). The count that spans them, the mark it
   counts from and the issue the release step files for the reading are this script's second
   responsibility; the release steps themselves are `run-script.test.mjs`. */
import assert from "node:assert/strict";
import test from "node:test";
import { chmodSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { REVIEW } from "../../../tools/gates/timing.mjs";

import { alsoOpen, BARE, called, git, LAST_STEP, lastStep, landIn, noBacklog, owedAt, pushed, ref,
  runIn, seen, stubbed, withReview } from "./run-fixtures.mjs";

/* The shape reader reaches the tracker's own settings, so it is loaded after the fixtures, whose
   static import has already pointed XDG_CONFIG_HOME at a room that is not the developer's. */
const { shapeOf } = await import("../../src/tracker/issue-shape.mjs");

/* The filing is a module call, so what it sent is a payload on the endpoint, not an argv. */
const creating = () => seen("create")[0]?.args.data ?? null;

test("with no mark, the last step says it cannot count and plants nothing", () => {
  const { work } = pushed("unmarked");
  landIn(work, join("plugin", "src", "one.mjs"), 4, "the change");

  const run = lastStep(work);
  assert.match(run.stderr, /no refs\/forge\/reviewed in this repository/u, run.stderr);
  assert.match(run.stderr, /the release that introduced this rule/u, run.stderr);
  assert.doesNotMatch(run.stdout, /release\(s\)/u, "a run that cannot count may not report a count");
  assert.equal(ref(work), "", "the release step is not the mark's writer");

  const asked = runIn(work, ["review"], BARE);
  assert.equal(asked.status, 1, asked.stdout);
  assert.match(asked.stderr, /no refs\/forge\/reviewed/u, asked.stderr);
});

/* The release count is printed and decides nothing: the trigger is the code there is to read. */
test("releases alone owe no reading, however many, and the count still names them", () => {
  const { work } = pushed("releases");
  const planted = runIn(work, ["review", "--done"], BARE);
  assert.match(planted.stdout, /refs\/forge\/reviewed planted at [0-9a-f]{7}/u, planted.stdout);
  assert.equal(ref(work), git(work, "rev-parse", "HEAD").stdout.trim());

  for (const nth of [1, 2, 3]) {
    landIn(work, join("plugin", "hooks", `gate-${nth}.mjs`), 4, `the ${nth} change`);
    const under = lastStep(work);
    assert.match(under.stdout, new RegExp(`${nth} release\\(s\\), ${nth} file\\(s\\)`, "u"), under.stdout);
    assert.doesNotMatch(under.stdout, /a review of/u, `${nth} release(s) of 4 lines is no reading's worth`);
    assert.match(under.stdout, /short of the 1500 line\(s\) that call for a reading/u, under.stdout);
  }
});

/* Read through the verb rather than through a ship, so the release count stays at zero and the
   volume is the only thing that can be what fired. */
test("the fifteen-hundredth changed line is owed a reading, and only in the counted paths", () => {
  const { work } = pushed("lines");
  runIn(work, ["review", "--done"], BARE);

  landIn(work, join("docs", "long.md"), 1600, "prose, which the one-home check reads");
  const outside = runIn(work, ["review"], BARE);
  assert.match(outside.stdout, /holds 0 release\(s\), 0 file\(s\), 0 changed line\(s\)/u, outside.stdout);
  assert.match(outside.stdout, /^Short of the 1500 changed line\(s\)/mu, "docs/ is not a path this count reads");

  landIn(work, join("plugin", "src", "wide.mjs"), 1499, "a module a run grew");
  const under = runIn(work, ["review"], BARE);
  assert.match(under.stdout, /holds 0 release\(s\), 1 file\(s\), 1499 changed line\(s\)/u, under.stdout);
  assert.match(under.stdout, /^Short of the/mu, "1499 is one line short, and the boundary is exact");

  landIn(work, join("plugin", "src", "wide.mjs"), 1500, "the line that crosses it");
  const owed = runIn(work, ["review"], BARE);
  assert.match(owed.stdout, /holds 0 release\(s\), 1 file\(s\), 1500 changed line\(s\)/u, owed.stdout);
  assert.match(owed.stdout, /^A review is owed:/mu, owed.stdout);
  assert.match(lastStep(work).stdout, /a review of [0-9a-f]{7}\.\.HEAD is owed: 1 release\(s\)/u,
    "the release step says it too, on a release count of its own bump alone");
});

test("past the threshold the step files the reading's issue itself, and prints the line that launches it", () => {
  const { at, work, from } = owedAt("filed");
  noBacklog({ key: "ISS-777" });

  const owed = lastStep(work);
  const to = git(work, "rev-parse", "HEAD").stdout.trim();
  const filing = creating();
  assert.ok(filing, `nothing was filed:\n${owed.stdout}${owed.stderr}`);
  assert.equal(filing.category, "review", "a reading filed as a feature reads as work somebody owes");
  assert.ok(filing.title.includes(`${from.slice(0, 7)}..${to.slice(0, 7)}`),
    `the title names no commit pair: ${filing.title}`);
  assert.equal(called(at).filter((one) => one.argv[0] === "new").length, 0,
    "the filing spawned the CLI, which is the parse this step no longer makes");

  for (const said of ["## Outcome", "## Rules", "## Out of scope", "1 file(s) and 1501 changed line(s)",
    `git diff ${from}..${to} -- plugin/src plugin/hooks plugin/bin`, "ISS-77",
    "review --done",
    "forge knowledge write module-<name>", "forge doctor --refresh",
    /* One needle per obligation: dropping one leaves the batch read by no named instrument (ISS-339). */
    "`simplify`", "reuse, simplification, efficiency,", "altitude", "forge comment",
    "whether or not it raised anything", "finds no such record makes the reading itself",
    "listing has no `simplify`", "git status --porcelain"]) {
    assert.ok(filing.description.includes(said), `the body carries no ${said}:\n${filing.description}`);
  }
  /* The one command of this body, read from another run's worktree days later, once `finish` has removed the directory the filing stood in: a name or a head resolved here sends that reader nowhere it can go (ISS-1143). */
  const done = filing.description.split("\n").filter((one) => one.includes("review --done"));
  assert.equal(done.length, 1, `one --done line, not ${done.length}:\n${filing.description}`);
  assert.match(done[0], /`node tools\/run\.mjs review --done /u,
    `the --done command names a directory before the script: ${done[0]}`);
  assert.doesNotMatch(done[0], /--done\s+\S*[0-9a-f]{7}/u,
    `the --done command pins a sha, and ${to.slice(0, 7)} is the one this filing resolved: ${done[0]}`);
  assert.doesNotMatch(filing.description, /\bwt-[a-z0-9-]*ISS-\d+/iu,
    `a path of somebody's worktree is in the body:\n${filing.description}`);

  assert.ok(owed.stdout.includes("filed ISS-777"), owed.stdout);
  assert.ok(owed.stdout.includes("Work ISS-777. Use the Skill tool: skill forge:issue-flow, args ISS-777."),
    `the launch line is not printed as the parent reads it:\n${owed.stdout}`);
  assert.equal(ref(work), from, "filing the reading is not reading it, so the mark stands still");
});

/* The threshold reaches the filing too: a body naming 1500 where the ship filed at 40 misleads it. */
test("the reading the step files names the threshold the project set, not the one this script ships with", () => {
  const { work } = owedAt("filed-project", 40);
  noBacklog({ key: "ISS-778" });

  const owed = lastStep(work);
  const filing = creating();
  assert.ok(filing, `nothing was filed at the project's own threshold:\n${owed.stdout}${owed.stderr}`);
  assert.ok(filing.description.includes("once 40 changed line(s) have landed"),
    `the filed body names a threshold nobody set:\n${filing.description}`);
  assert.ok(!filing.description.includes("once 1500 changed line(s)"), filing.description);
});

/* The keys of a reading are its range's, off the commit subjects, and its own body cites others as
   the reasons its rules exist: a body scan would relate those. The range's issues are closed by the
   time the reading is filed, so the resolve reads every row the walk returned (ISS-334). */
test("the reading relates the issues its range spans, closed included, and not the ones its body cites", () => {
  const { work } = owedAt("edges");
  noBacklog({ key: "ISS-777", issues: [
    { issueId: "ISS-77", documentId: "u-77", status: "closed", title: "the module a run grew" },
    { issueId: "ISS-146", documentId: "u-146", status: "open", title: "the invoice export writes a header row" },
    { issueId: "ISS-95", documentId: "u-95", status: "open", title: "a colour token resolves in the dark theme" },
  ] });
  const owed = lastStep(work);
  const filing = creating();
  assert.ok(filing, `nothing was filed:\n${owed.stdout}${owed.stderr}`);
  assert.deepEqual(filing.relations, [{ kind: "relates", blocksId: "u-77" }],
    `the edges are not the range's alone:\n${JSON.stringify(filing.relations)}`);
  for (const cited of ["ISS-146", "ISS-95"]) {
    assert.ok(filing.description.includes(cited),
      `the body cites no ${cited}, so nothing here proves a body scan was not made`);
  }
});

/* `data.relations` takes twenty and a range's span is unbounded: refused, the step files nothing,
   the volume keeps growing and every later ship fails the same way. */
test("a range naming more keys than a create takes files with the twenty it takes", () => {
  const { work } = owedAt("capped");
  const keys = Array.from({ length: 25 }, (_, at) => `ISS-${800 + at}`);
  noBacklog({ key: "ISS-777", issues: keys.map((one) =>
    ({ issueId: one, documentId: `u-${one}`, status: "closed", title: `the work ${one} carried` })) });
  for (const [at, key] of keys.entries()) {
    landIn(work, join("plugin", "src", `each-${at}.mjs`), 2, `one more change (${key})`);
  }
  const owed = lastStep(work);
  const filing = creating();
  assert.ok(filing, `nothing was filed:\n${owed.stdout}${owed.stderr}`);
  assert.equal(filing.relations.length, 20, "twenty is the payload's ceiling, and past it nothing files");
  assert.ok(filing.description.includes(keys.at(-1)),
    "and the body's own line still names the whole span the edges could not carry");
  assert.match(owed.stdout, /the range named more than the filing relates: 5 over the 20 one create carries/u,
    "and the five are said where the key is, an edge absent in silence reading as one nobody wanted");
});

test("the generated title and body are a filing this CLI's own shape reader accepts", () => {
  const { work } = owedAt("shaped");
  noBacklog();
  lastStep(work);

  const filing = creating();
  assert.ok(filing, "nothing was filed, so there is no body to read");
  const shape = shapeOf({ title: filing.title, body: filing.description, kind: filing.category });
  assert.deepEqual(shape.gaps, [], `the filing the step generates would be refused:\n${JSON.stringify(shape.gaps, null, 1)}`);
  assert.equal(shape.said, null, `the filing draws a notice the step cannot answer: ${shape.said}`);
});

test("a second ship at the same mark names the issue already there and files nothing", () => {
  const { work, from } = owedAt("twice");
  noBacklog({ key: "ISS-777" });
  lastStep(work);
  /* What the filing left, as the lookup reads it back: this tracker echoes a create rather than
     storing it, so the row the next ship has to see is put there by hand. */
  alsoOpen([{ issueId: "ISS-777", documentId: "u-777", status: "open",
    title: `The batch ${from.slice(0, 7)}..deadbee is read once as a whole` }]);

  landIn(work, join("plugin", "src", "wider.mjs"), 40, "more of the same");
  const again = lastStep(work);
  assert.equal(seen("create").length, 1, `the mark's reading was filed twice:\n${again.stdout}`);
  assert.match(again.stdout, /ISS-777 is open for this mark already, so nothing was filed/u, again.stdout);
  assert.ok(again.stdout.includes("Work ISS-777."), `the run still has one thing to do:\n${again.stdout}`);
  assert.equal(ref(work), from, "a row already there is no reason to move the mark either");
});

/* Two ships fifteen minutes apart read one mark and answered differently: its issue had left `open`
   between them. The window `open` was right for is the one before anybody starts work (ISS-140). */
test("the mark's issue is found at whatever status it has reached, and the lookup asks for none", () => {
  const { work, from } = owedAt("statuses");
  const seed = (key, status) => noBacklog({ key: "ISS-777", issues: [{ issueId: key,
    documentId: `u-${key}`, status,
    title: `The batch ${from.slice(0, 7)}..deadbee is read once as a whole` }] });

  seed("ISS-501", "in_progress");
  const held = lastStep(work);
  assert.equal(seen("create").length, 0,
    `an issue the tracker already holds for this mark was filed again:\n${held.stdout}${held.stderr}`);
  assert.match(held.stdout, /ISS-501 is in_progress for this mark already, so nothing was filed/u, held.stdout);
  assert.ok(held.stdout.includes("Work ISS-501."), held.stdout);
  const lookup = seen("list").find((one) => one.args.filters?.search);
  assert.equal(lookup.args.filters.status, undefined,
    `the question is whether an issue for this mark exists, and a status is no part of it: ${JSON.stringify(lookup.args.filters)}`);
  assert.equal(seen("get").length, 0,
    "the status rides back on the row the lookup already read, a second read of the issue buying nothing");

  /* A finished reading whose mark was never moved is a state of its own: the count keeps growing,
     and the route out is the move, never a second filing of a reading already done. */
  seed("ISS-502", "closed");
  const done = lastStep(work);
  assert.equal(seen("create").length, 0, done.stdout);
  assert.match(done.stdout, /ISS-502 is closed for this mark and the mark never moved/u, done.stdout);
  assert.match(done.stdout, /review --done/u, `the route out of a finished reading is the move:\n${done.stdout}`);
  assert.doesNotMatch(done.stdout, /Work ISS-502\./u, "a closed issue is nothing to launch a run on");

  /* Counted, a dropped reading would leave the range an issue nobody reads and no route to another. */
  seed("ISS-503", "dropped");
  const again = lastStep(work);
  assert.equal(seen("create").length, 1,
    `a dropped reading left the range with no issue and no filing:\n${again.stdout}${again.stderr}`);
  assert.ok(again.stdout.includes("filed ISS-777"), again.stdout);
});

/* The prose duplicate check is off for this filing, so the lookup alone stands between one range and
   two rows for it, and a backlog that came back short holds no absence to act on (ISS-1887). */
test("a lookup over a backlog that came back short files nothing, and says which read was short", () => {
  const { work } = owedAt("short-read");
  noBacklog({ key: "ISS-777", beyond: 3 });
  const before = ref(work);

  const run = lastStep(work);
  assert.equal(seen("create").length, 0,
    `a row was filed over a backlog that could not say whether one was already there:\n${run.stdout}${run.stderr}`);
  assert.match(run.stderr, /whether an issue already holds this reading is unread, so nothing was filed/u, run.stderr);
  assert.match(run.stderr, /the search for the issue holding this mark's reading reached/u,
    `a short read has to name which read was short:\n${run.stderr}`);
  assert.match(run.stdout, /forge issue --search [0-9a-f]{7}/u, run.stdout);
  assert.doesNotMatch(run.stdout, /forge new - --title/u,
    `a route that files over a reading which could not rule out a row already there:\n${run.stdout}`);
  assert.equal(ref(work), before, "an unread backlog is no reason to move the mark");
});

/* A row found is conclusive whatever the reading left behind it: the page that carried it carried
   it, and withholding the answer there would file a second row for a range that has one. */
test("a row found over a backlog that came back short is still this debt's answer", () => {
  const { work, from } = owedAt("short-but-held");
  noBacklog({ key: "ISS-777", beyond: 3, issues: [{ issueId: "ISS-505", documentId: "u-505",
    status: "in_progress",
    title: `The batch ${from.slice(0, 7)}..deadbee is read once as a whole` }] });

  const run = lastStep(work);
  assert.equal(seen("create").length, 0,
    `a row the short page carried was passed over and a second one filed:\n${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /ISS-505 is in_progress for this mark already, so nothing was filed/u, run.stdout);
  assert.doesNotMatch(run.stderr, /unread/u,
    `a reading that answered the question was reported as one that could not:\n${run.stderr}`);
});

/* Two readings' titles differ only in the two short hashes, and the prose measure discards exactly
   those: it scored the last four releases' filings 1.00 against the previous range's row and refused
   every one of them. The range is what tells two readings apart, and the lookup above asks it
   (ISS-475, ISS-1887). */
test("a reading of another range, open and reading 1.00 against this one's title, refuses nothing", () => {
  const { work, from } = owedAt("wt-ISS-999");
  const before = ref(work);
  noBacklog({ key: "ISS-777", issues: [{ issueId: "ISS-135", documentId: "u-135", status: "open",
    title: "The batch 0000000..1111111 is read once as a whole by a run that wrote none of it, and "
      + "the mark moves" }] });

  const run = lastStep(work);
  const filing = creating();
  assert.ok(filing, `the reading this mark owes was refused by a reading of another range:\n${run.stdout}${run.stderr}`);
  assert.ok(filing.title.startsWith(`The batch ${from.slice(0, 7)}..`),
    `the filing names a range that does not open at the mark: ${filing.title}`);
  assert.ok(run.stdout.includes("filed ISS-777"), run.stdout);
  assert.doesNotMatch(run.stderr, /refused the body/u,
    `the prose measure was asked a question it cannot see the range in:\n${run.stderr}`);
  assert.doesNotMatch(run.stdout, /ISS-135/u,
    `a reading whose range ends elsewhere was named as this debt's:\n${run.stdout}`);
  assert.equal(seen("comment").length, 0,
    "and the fold was declined, a body no person typed landing on nobody's issue as a finding");
  assert.equal(ref(work), before, "filing the reading is not reading it, so the mark stands still");
});

/* Both halves run in process now, so a checkout whose own CLI will not start still files: the step
   that reads the backlog and the step that writes to it are one process's calls (ISS-1887). */
test("the reading is filed though this checkout's own CLI will not start", () => {
  const { work } = owedAt("unrunnable");
  noBacklog({ key: "ISS-777" });
  lastStep(work);
  chmodSync(join(work, "plugin", "bin", "forge"), 0o000);

  const run = runIn(work, ["ship", "--from", String(LAST_STEP)], BARE);
  assert.ok(run.stdout.includes("filed ISS-777"),
    `a reading lost to a CLI no part of it calls:\n${run.stdout}${run.stderr}`);
  assert.doesNotMatch(run.stderr, /could not be run/u,
    "nothing in the filing spawns that CLI, so nothing here may report it as the party that failed");
});

/* Nobody typed this body, so a check that reads it as wrong is this script's own defect: the route
   out is a filing against this repository, and no re-run of the same generated body. */
test("a shape refusal of the body this step generates is named as this plugin's, and routed to this repository", () => {
  const { work } = owedAt("shape");
  noBacklog();
  /* The body the step generates, made unreadable by the shape, and committed because the first ship
     step refuses a dirty tree: forcing the refusal from outside would prove nothing of this route.
     Everything else the module exports is re-exported off the module itself, so this is one override
     and not a list of names whose drift is a SyntaxError rather than a red assertion. */
  const beside = join("tools", "run", "review-itself.mjs");
  renameSync(join(work, "tools", "run", "review.mjs"), join(work, beside));
  writeFileSync(join(work, "tools", "run", "review.mjs"),
    'export * from "./review-itself.mjs";\n'
    + 'export const reviewBody = () => "a body carrying no heading at all";\n');
  git(work, "add", join("tools", "run", "review.mjs"), beside);
  git(work, "commit", "-m", "a body the shape will not carry");

  const run = lastStep(work);
  assert.match(run.stdout, /a review of [0-9a-f]{7}\.\.HEAD is owed: 1 release\(s\), 1 file\(s\), 1501 changed line\(s\)/u,
    `the range and the count are printed whatever becomes of the filing:\n${run.stdout}`);
  assert.match(run.stderr, /this plugin's own filing check refused the body this step generates, and named no issue/u,
    `a check of this plugin's, reported as the tracker's:\n${run.stderr}`);
  assert.doesNotMatch(run.stderr, /the tracker did not answer/u,
    "the tracker answered; the refusal was this plugin's own reading of a body this script wrote");
  assert.match(run.stdout, /forge feedback -/u,
    `the gap is in this repository, and the route has to reach it:\n${run.stdout}`);
  assert.doesNotMatch(run.stdout, /forge new - --title/u,
    `the route printed is the filing the check just refused:\n${run.stdout}`);
  assert.doesNotMatch(run.stdout, /Work ISS-/u, "nothing was filed, so there is no run to launch");
});

/* A review is never lost for want of a network: nothing is filed, the count and the route print as
   they did before anything filed itself, and the next ship asks again. */
test("a tracker that does not answer files nothing, prints the route, and leaves the next ship to file it", () => {
  const { work } = owedAt("offline");
  noBacklog({ key: "ISS-777", status: 502 });

  const blind = lastStep(work);
  assert.equal(blind.status, 0, blind.stderr);
  assert.match(blind.stdout, /a review of [0-9a-f]{7}\.\.HEAD is owed: 1 release\(s\), 1 file\(s\), 1501 changed line\(s\)/u, blind.stdout);
  assert.match(blind.stderr, /whether an issue already holds this reading is unread, so nothing was filed/u,
    `a lookup that reached nobody is a lookup that ruled nothing out:\n${blind.stderr}`);
  assert.match(blind.stderr, /502/u,
    `a silence names what came back, so a refusal is not read as one:\n${blind.stderr}`);
  /* The route out of a silence is the read and not a filing: a lookup that ruled no row out is the
     one state where filing by hand is how one range gets two rows (ISS-1887). */
  assert.doesNotMatch(blind.stdout, /forge new - --title "review/u, blind.stdout);
  assert.match(blind.stdout, /forge issue --search [0-9a-f]{7}/u, blind.stdout);
  assert.equal(seen("create").length, 0, "a refused list may not file");

  noBacklog({ key: "ISS-777" });
  const then = lastStep(work);
  assert.equal(seen("create").length, 1,
    `the reading was lost rather than retried:\n${then.stdout}${then.stderr}`);
  assert.ok(then.stdout.includes("Work ISS-777."), then.stdout);
});

test("a reading that finds nothing moves the mark in one line, and the count starts again there", () => {
  const { work } = pushed("moved");
  runIn(work, ["review", "--done"], BARE);
  landIn(work, join("plugin", "src", "wide.mjs"), 1501, "a module a run grew");
  assert.match(lastStep(work).stdout, /a review of/u, "1501 lines under plugin/src is past the threshold");

  const before = ref(work);
  const asked = runIn(work, ["review"], BARE);
  assert.match(asked.stdout, /[0-9a-f]{7}\.\.HEAD is the next review's, and holds 1 release\(s\)/u, asked.stdout);
  assert.match(asked.stdout, /git diff [0-9a-f]{40}\.\.HEAD -- plugin\/src plugin\/hooks plugin\/bin/u, asked.stdout);
  assert.equal(ref(work), before, "reading the range moves nothing");

  const done = runIn(work, ["review", "--done", git(work, "rev-parse", "HEAD").stdout.trim()], BARE);
  assert.match(done.stdout, /refs\/forge\/reviewed [0-9a-f]{7} -> [0-9a-f]{7}/u, done.stdout);
  assert.equal(ref(work), git(work, "rev-parse", "HEAD").stdout.trim());
  assert.doesNotMatch(lastStep(work).stdout, /a review of/u, "the range restarts at the mark it just moved");

  const nowhere = runIn(work, ["review", "--done", "no-such-ref"], BARE);
  assert.equal(nowhere.status, 1, nowhere.stdout);
  assert.match(nowhere.stderr, /`no-such-ref` is no commit in this tree/u, nowhere.stderr);
});

/* The plant is the one moment nothing else checks, and a mark off this history opens a range that
   still counts and still prints a plausible number, so no threshold is reached honestly (ISS-104). */
test("the first plant proves the target is this history's, apart from a mark behind the head", () => {
  const { work } = pushed("offhistory");
  const held = git(work, "rev-parse", "HEAD^{tree}").stdout.trim();
  const orphan = git(work, "commit-tree", held, "-m", "a commit on no branch of this repository").stdout.trim();

  const off = runIn(work, ["review", "--done", orphan], BARE);
  assert.equal(off.status, 1, off.stdout);
  assert.match(off.stderr, /is on no history reaching this tree's head/u, off.stderr);
  assert.doesNotMatch(off.stderr, /is not a descendant of the mark/u,
    "a target off this history is not a target behind the mark, and the two send a reader to different fixes");
  assert.ok(off.stderr.includes(`git update-ref refs/forge/reviewed ${orphan.slice(0, 7)}`),
    `the plant's escape has to carry the two-argument form:\n${off.stderr}`);
  assert.doesNotMatch(off.stderr, /update-ref refs\/forge\/reviewed [0-9a-f]{7} [0-9a-f]{7}/u,
    "there is no old value on the plant path, so a compare-and-swap escape refuses a second time");
  assert.match(off.stderr, /fetch/u, "a tree that has not fetched is the usual reason, so the refusal names that read");
  assert.equal(ref(work), "", "the refused plant left no mark");

  const planted = runIn(work, ["review", "--done", "HEAD"], BARE);
  assert.equal(planted.status, 0, planted.stderr);
  assert.match(planted.stdout, /planted at [0-9a-f]{7}/u, planted.stdout);
});

/* The range is fixed when its issue is filed and other runs land on the branch while it is being
   read, so HEAD at the end of a review run is ahead of the head that reading reached. A mark planted
   there marks unread commits as read, and unlike a mark left unmoved nothing grows to say so
   (ISS-146). The discriminator is local: an owed range is one a reading was filed for. */
test("a bare --done moves no mark already there, and the named ref moves it to the head that was read", () => {
  const { work } = pushed("named");
  const planted = runIn(work, ["review", "--done"], BARE);
  assert.equal(planted.status, 0, `a plant answers to no range, so it is not refused:\n${planted.stderr}`);
  const from = ref(work);
  landIn(work, join("plugin", "src", "wide.mjs"), 1501, "a module a run grew, and the reading read to here");
  const reached = git(work, "rev-parse", "HEAD").stdout.trim();
  landIn(work, join("plugin", "src", "later.mjs"), 20, "what another run landed while it was being read");

  const bare = runIn(work, ["review", "--done"], BARE);
  assert.equal(bare.status, 1, bare.stdout);
  assert.match(bare.stderr, /a move of the mark names the head the reading reached/u, bare.stderr);
  assert.ok(bare.stderr.includes(git(work, "rev-parse", "HEAD").stdout.trim()),
    `a reading that did reach HEAD has to be left a way to say so:\n${bare.stderr}`);
  assert.equal(ref(work), from, "the refused write moved nothing");

  const told = runIn(work, ["review", "--done", reached], BARE);
  assert.equal(told.status, 0, told.stderr);
  assert.equal(ref(work), reached, "the mark names the head the reading reached, not the head it pushed");

  /* The count is a net diff, so later deletions bring a filed range back under the threshold. */
  landIn(work, join("plugin", "src", "small.mjs"), 20, "a little more, well under the threshold");
  const under = runIn(work, ["review", "--done"], BARE);
  assert.equal(under.status, 1, `every move names its ref, the volume deciding nothing:\n${under.stdout}`);
  assert.equal(ref(work), reached, "the refused write moved nothing");
});

/* A mark moved back hands the next reading a range it has already been told was read — a codex
   finding on this change, alongside the shared ref two review worktrees both write. */
test("the mark only ever moves forward, and the refusal carries the way past a wrong one", () => {
  const { work } = pushed("forward");
  const first = git(work, "rev-parse", "HEAD").stdout.trim();
  landIn(work, join("plugin", "src", "one.mjs"), 4, "the change");
  runIn(work, ["review", "--done"], BARE);

  const back = runIn(work, ["review", "--done", first], BARE);
  assert.equal(back.status, 1, back.stdout);
  assert.match(back.stderr, /is not a descendant of the mark at [0-9a-f]{7}/u, back.stderr);
  assert.match(back.stderr, /git update-ref refs\/forge\/reviewed [0-9a-f]{7} [0-9a-f]{7}/u,
    "a refusal over a mark that is itself the mistake has to carry the way past it");
  assert.equal(ref(work), git(work, "rev-parse", "HEAD").stdout.trim(), "the refused write moved nothing");
});

/* Descent from the mark and ancestry of the head are different questions, and a move owes both: a
   side branch rooted after the mark and a commit fetched but never merged each descend from the
   mark and reach no head, so each would become the mark and open a range measured from a start this
   history has no line to (ISS-159). The plant's own case is above, and stays its own. */
test("a move proves the target is on this history too, and the three refusals stay apart", () => {
  const { work } = pushed("moveoff");
  const before = git(work, "rev-parse", "HEAD").stdout.trim();
  landIn(work, join("plugin", "src", "one.mjs"), 4, "the change the mark is planted over");
  runIn(work, ["review", "--done"], BARE);
  const mark = ref(work);
  landIn(work, join("plugin", "src", "two.mjs"), 4, "what landed while the reading was being read");
  const head = git(work, "rev-parse", "HEAD").stdout.trim();
  const held = git(work, "rev-parse", "HEAD^{tree}").stdout.trim();
  const child = (parent, why) => git(work, "commit-tree", held, "-p", parent, "-m", why).stdout.trim();

  for (const [what, target] of [
    ["a side branch rooted after the mark", child(mark, "an attempt nobody merged")],
    ["a commit this tree holds and has not merged", child(head, "a fetched head ahead of this one")],
  ]) {
    const off = runIn(work, ["review", "--done", target], BARE);
    assert.equal(off.status, 1, `${what} became the mark:\n${off.stdout}`);
    assert.match(off.stderr, /is on no history reaching this tree's head/u, `${what}: ${off.stderr}`);
    assert.doesNotMatch(off.stderr, /is not a descendant of the mark/u,
      `${what} does descend from the mark, so that refusal would send the reader to a fix it already has`);
    assert.ok(off.stderr.includes(`git update-ref refs/forge/reviewed ${target.slice(0, 7)} ${mark.slice(0, 7)}`),
      `a move's escape carries the old value, or the by-hand write is refused too:\n${off.stderr}`);
    assert.ok(off.stderr.includes(`log --left-right --oneline HEAD...${target.slice(0, 7)}`),
      `both shapes show one commit on the target's side, so only a symmetric read says which:\n${off.stderr}`);
    assert.equal(ref(work), mark, `${what}: the refused write moved nothing`);
  }

  const orphan = git(work, "commit-tree", held, "-m", "a commit on no branch of this repository").stdout.trim();
  const both = runIn(work, ["review", "--done", orphan], BARE);
  assert.equal(both.status, 1, both.stdout);
  assert.match(both.stderr, /is on no history reaching this tree's head/u, both.stderr);
  assert.match(both.stderr, /is not a descendant of the mark at [0-9a-f]{7}/u,
    "a target that is neither says both, because neither fix on its own reaches it");
  assert.equal(ref(work), mark, "the refused write moved nothing");

  const back = runIn(work, ["review", "--done", before], BARE);
  assert.equal(back.status, 1, back.stdout);
  assert.match(back.stderr, /is not a descendant of the mark at [0-9a-f]{7}/u, back.stderr);
  assert.doesNotMatch(back.stderr, /is on no history reaching this tree's head/u,
    "a commit this head descends from is on this history, whatever the mark makes of it");

  const told = runIn(work, ["review", "--done", head], BARE);
  assert.equal(told.status, 0, told.stderr);
  assert.equal(ref(work), head, "a target ahead of the mark and behind the head is what the mark is for");
});

/* The gate this release spent a step earlier wrote the newest figure, so the release is where it is
   freshest — and beside the volume count, because both are what this run left the next one to
   answer for and a second place to look is a second thing to remember to read (ISS-166). */
test("the last step prints the newest whole-run figure beside the volume count, and says when it has none", () => {
  const { work } = pushed("timing");
  runIn(work, ["review", "--done"], BARE);
  landIn(work, join("plugin", "src", "one.mjs"), 4, "the change");

  const blank = lastStep(work);
  assert.match(blank.stdout, /the gate: no run is recorded, so nothing says whether this gate has grown/u, blank.stdout);
  assert.match(blank.stdout, /npm run check -- --full/u, "a tree with no figure is told what plants one");

  const dir = join(work, ".git", "gate-ledger");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "runs"), "2026-01-01T00:00:00.000Z 80s 12/12\n2026-01-02T00:00:00.000Z 100s 12/12\n");
  const said = lastStep(work);
  assert.match(said.stdout, new RegExp(`the gate: 100s over 12 of 12 step\\(s\\) on 2026-01-02, \\d\\.\\d\\dx the ${REVIEW.seconds}s the review of `
    + `${REVIEW.on} measured under load ${REVIEW.load} on ${REVIEW.cores} core\\(s\\) \\(${REVIEW.issue}\\); 1\\.25x the 80s before it`, "u"), said.stdout);

  const lines = said.stdout.split("\n");
  const figure = lines.findIndex((one) => one.includes("the gate: 100s"));
  const volume = lines.findIndex((one) => one.includes("changed line(s) under"));
  assert.equal(volume - figure, 1, `the figure and the volume count are not one place:\n${said.stdout}`);
});

/* A number and a path list with no declaration behind them are read by the next run as its own, and
   the two halves come from two places: `review.lines` set alone leaves the paths this plugin ships
   with (ISS-1912). */
test("the verb names the reckoning it counted under, and names both sources where the two differ", () => {
  const { work } = pushed("verb-source");
  runIn(work, ["review", "--done"], BARE);
  landIn(work, join("plugin", "src", "wide.mjs"), 4, "a module a run grew");

  const shipped = runIn(work, ["review"], BARE).stdout;
  assert.match(shipped, /under plugin\/src, plugin\/hooks, plugin\/bin {2}← the plugin's default$/mu, shipped);
  assert.match(shipped, /^Short of the 1500 changed line\(s\)/mu, shipped);

  withReview(work, 40);
  const half = runIn(work, ["review"], BARE).stdout;
  assert.match(half, /under plugin\/src, plugin\/hooks, plugin\/bin {2}← the volume \.forge\.json, the paths the plugin's default$/mu, half);
  assert.match(half, /^Short of the 40 changed line\(s\)/mu, half);

  landIn(work, join("plugin", "test", "wide.test.mjs"), 40, "the cases that module wanted");
  withReview(work, 40, ["plugin/src", "plugin/hooks", "plugin/bin", "plugin/test"]);
  const both = runIn(work, ["review"], BARE).stdout;
  assert.match(both, /under plugin\/src, plugin\/hooks, plugin\/bin, plugin\/test {2}← \.forge\.json$/mu, both);
  assert.match(both, /^A review is owed: 40 changed line\(s\)/mu, both);
});

test("the release step names the reckoning on both sides of the threshold", () => {
  const { work } = pushed("step-source");
  stubbed(work);
  runIn(work, ["review", "--done"], BARE);
  withReview(work, 40, ["plugin/src", "plugin/test"]);
  landIn(work, join("plugin", "src", "wide.mjs"), 4, "a module a run grew");

  const short = lastStep(work).stdout;
  assert.match(short, /under plugin\/src, plugin\/test since [0-9a-f]{7}, short of the 40 line\(s\) that call for a reading {2}← \.forge\.json/u, short);

  noBacklog({ key: "ISS-779" });
  landIn(work, join("plugin", "src", "wider.mjs"), 41, "the lines that cross it");
  const past = lastStep(work).stdout;
  assert.match(past, /under plugin\/src, plugin\/test, at or past 40 line\(s\) {2}← \.forge\.json/u, past);
});

/* The body is read in another run's tree days later, where the declaration this was counted under
   may not resolve at all: a count with no reckoning beside it is a range that reader cannot check. */
test("the filed body states the reckoning it was filed under, and counts the paths it counted", () => {
  for (const paths of [["plugin/src", "plugin/hooks"], ["plugin/src", "plugin/hooks", "plugin/bin", "plugin/test"]]) {
    const { work } = pushed(`filed-reckoning-${paths.length}`);
    stubbed(work);
    withReview(work, 40, paths);
    runIn(work, ["review", "--done"], BARE);
    landIn(work, join("plugin", "src", "wide.mjs"), 41, "a module a run grew (ISS-77)");
    noBacklog({ key: "ISS-780" });

    const owed = lastStep(work);
    const filing = creating();
    assert.ok(filing, `nothing was filed at ${paths.length} paths:\n${owed.stdout}${owed.stderr}`);
    assert.ok(filing.description.includes(`Reckoned at 40 changed line(s) over ${paths.length} path(s)  ← .forge.json`),
      `the body names no reckoning:\n${filing.description}`);
    assert.ok(filing.description.includes(`its diff under those ${paths.length} paths`),
      `the body counts a number of paths it did not count:\n${filing.description}`);
  }
});

/* A caller who typed `-h` asked what the tool does; answering with a configuration fault instead is
   withholding the one thing they asked for, and every verb paid for it while the help was built at
   import. The value is still refused where something needs it. */
test("a declaration the readers refuse withholds no usage, and is refused where the count needs it", () => {
  const { work } = pushed("refused-declaration");
  runIn(work, ["review", "--done"], BARE);
  withReview(work, "lots");

  const help = runIn(work, ["-h"], BARE);
  assert.equal(help.status, 0, `the help exited on a configuration fault:\n${help.stderr}`);
  assert.match(help.stdout, /^Usage: node \S*run\.mjs <start\|relink\|finish\|ship\|land\|land-ready\|review>/mu, help.stdout);
  assert.match(help.stdout, /whose declaration every reader of it refuses: `review\.lines` in \.forge\.json is a whole number/u,
    `the usage says nothing of the declaration it could not read:\n${help.stdout}`);
  assert.ok(!help.stdout.includes("range holds 1500 changed line(s)"),
    `the help took this plugin's own number for a declaration that was refused:\n${help.stdout}`);

  const unknown = runIn(work, ["nosuchverb"], BARE);
  assert.equal(unknown.status, 1, unknown.stdout);
  assert.match(unknown.stderr, /^no step `nosuchverb`\. It is start, relink/u, unknown.stderr);
  assert.ok(!unknown.stderr.includes("review.lines"),
    `a verb needing no reckoning was answered with the reckoning's refusal:\n${unknown.stderr}`);

  const counted = runIn(work, ["review"], BARE);
  assert.equal(counted.status, 1, counted.stdout);
  assert.match(counted.stderr, /`review\.lines` in \.forge\.json is a whole number of changed lines above zero, not `"lots"`/u,
    counted.stderr);
  assert.match(counted.stderr, /Drop the key to take the 1500 this plugin ships with/u, counted.stderr);
});
