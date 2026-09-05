/* Every delegated run reviews its own diff and stops there, so a helper two of them each wrote is
   inside no run's range and is found by nobody (ISS-95). The count that spans them, the mark it
   counts from and the issue the release step files for the reading are this script's second
   responsibility; the release steps themselves are `run-script.test.mjs`. */
import assert from "node:assert/strict";
import test from "node:test";
import { chmodSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BARE, called, git, lastStep, landIn, noBacklog, owedAt, pushed, ref, runIn, seen }
  from "./run-fixtures.mjs";

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
    assert.match(under.stdout, /short of the 500 line\(s\) that call for a reading/u, under.stdout);
  }
});

/* Read through the verb rather than through a ship, so the release count stays at zero and the
   volume is the only thing that can be what fired. */
test("the five hundredth changed line is owed a reading, and only in the counted paths", () => {
  const { work } = pushed("lines");
  runIn(work, ["review", "--done"], BARE);

  landIn(work, join("docs", "long.md"), 600, "prose, which the one-home check reads");
  const outside = runIn(work, ["review"], BARE);
  assert.match(outside.stdout, /holds 0 release\(s\), 0 file\(s\), 0 changed line\(s\)/u, outside.stdout);
  assert.match(outside.stdout, /^Short of the 500 changed line\(s\)/mu, "docs/ is not a path this count reads");

  landIn(work, join("plugin", "src", "wide.mjs"), 499, "a module a run grew");
  const under = runIn(work, ["review"], BARE);
  assert.match(under.stdout, /holds 0 release\(s\), 1 file\(s\), 499 changed line\(s\)/u, under.stdout);
  assert.match(under.stdout, /^Short of the/mu, "499 is one line short, and the boundary is exact");

  landIn(work, join("plugin", "src", "wide.mjs"), 500, "the line that crosses it");
  const owed = runIn(work, ["review"], BARE);
  assert.match(owed.stdout, /holds 0 release\(s\), 1 file\(s\), 500 changed line\(s\)/u, owed.stdout);
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
  assert.equal(filing.category, "feature", "the filing names no kind the shape reads a body against");
  assert.ok(filing.title.includes(`${from.slice(0, 7)}..${to.slice(0, 7)}`),
    `the title names no commit pair: ${filing.title}`);
  assert.equal(called(at).filter((one) => one.argv[0] === "new").length, 0,
    "the filing spawned the CLI, which is the parse this step no longer makes");

  for (const said of ["## Outcome", "## Rules", "## Out of scope", "1 file(s) and 501 changed line(s)",
    `git diff ${from}..${to} -- plugin/src plugin/hooks plugin/bin`, "ISS-77", `review --done ${to}`,
    "forge knowledge write module-<name>", "forge project --refresh",
    /* One needle per obligation: dropping one leaves the batch read by no named instrument (ISS-339). */
    "`simplify`", "reuse, simplification, efficiency,", "altitude", "forge new --into",
    "whether or not it raised anything", "finds no such record makes the reading itself",
    "listing has no `simplify`", "git status --porcelain"]) {
    assert.ok(filing.description.includes(said), `the body carries no ${said}:\n${filing.description}`);
  }
  assert.ok(owed.stdout.includes("filed ISS-777"), owed.stdout);
  assert.ok(owed.stdout.includes("Work ISS-777. Use the Skill tool: skill forge:issue-flow, args ISS-777."),
    `the launch line is not printed as the parent reads it:\n${owed.stdout}`);
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
  const { at, work, from } = owedAt("twice");
  noBacklog({ key: "ISS-777" });
  lastStep(work);
  /* What the filing left, as the lookup reads it back: that lookup is a browse verb through the CLI
     and the filing is a module call, so no one act writes both. */
  writeFileSync(join(at, "forge-rows.txt"),
    `${"ISS-777".padEnd(8)} ${"open".padEnd(8)} ${"open".padEnd(12)} `
    + `The batch ${from.slice(0, 7)}..deadbee is read once as a whole\n`);

  landIn(work, join("plugin", "src", "wider.mjs"), 40, "more of the same");
  const again = lastStep(work);
  assert.equal(seen("create").length, 1, `the mark's reading was filed twice:\n${again.stdout}`);
  assert.match(again.stdout, /ISS-777 is open for this mark already, so nothing was filed/u, again.stdout);
  assert.ok(again.stdout.includes("Work ISS-777."), `the run still has one thing to do:\n${again.stdout}`);
});

/* Two ships fifteen minutes apart read one mark and answered differently: its issue had left `open`
   between them. The window `open` was right for is the one before anybody starts work (ISS-140). */
test("the mark's issue is found at whatever status it has reached, and the lookup asks for none", () => {
  const { at, work, from } = owedAt("statuses");
  noBacklog({ key: "ISS-777" });
  /* The row's own shape, rank and all: this projection grew a column between two ships of this
     batch, and a fixture one column short reads the rank as the status and proves nothing. */
  const seed = (key, status) => writeFileSync(join(at, "forge-rows.txt"),
    `${key.padEnd(8)} ${"medium".padEnd(8)} ${status.padEnd(12)} `
    + `The batch ${from.slice(0, 7)}..deadbee is read once as a whole\n`);

  seed("ISS-501", "in_progress");
  const held = lastStep(work);
  assert.equal(seen("create").length, 0,
    `an issue the tracker already holds for this mark was filed again:\n${held.stdout}${held.stderr}`);
  assert.match(held.stdout, /ISS-501 is in_progress for this mark already, so nothing was filed/u, held.stdout);
  assert.ok(held.stdout.includes("Work ISS-501."), held.stdout);
  const lookup = called(at).find((one) => one.argv[0] === "issues");
  assert.ok(!lookup.argv.includes("--status"),
    `the question is whether an issue for this mark exists, and a status is no part of it: ${lookup.argv.join(" ")}`);
  assert.ok(called(at).some((one) => one.argv[0] === "issue" && one.argv[1] === "ISS-501"),
    "the status is read off the issue, the row's columns being a projection that grows without notice");

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

/* Nothing may invite a duplicate of an issue it has already found: only that issue's status went
   unread, and the count keeps growing until someone reads it. */
test("an issue found but unread files nothing, and is not routed to a filing of its replacement", () => {
  const { at, work, from } = owedAt("unread");
  noBacklog();
  writeFileSync(join(at, "forge-rows.txt"),
    `${"ISS-504".padEnd(8)} ${"medium".padEnd(8)} ${"tested".padEnd(12)} `
    + `The batch ${from.slice(0, 7)}..deadbee is read once as a whole\n`);
  writeFileSync(join(at, "forge-unread"), "");

  const run = lastStep(work);
  assert.equal(seen("create").length, 0,
    `an issue already found was replaced because its status would not read:\n${run.stdout}${run.stderr}`);
  assert.match(run.stderr, /ISS-504 is this mark's reading, so nothing was filed/u, run.stderr);
  assert.match(run.stdout, /forge issue ISS-504/u, run.stdout);
  assert.doesNotMatch(run.stdout, /forge new - --title/u,
    `a route that files a replacement for an issue already found:\n${run.stdout}`);
});

/* The duplicate line is this plugin's own filing check, and the only thing stopping a second issue
   for a mark that already has one. A refusal is not a silence (ISS-140), the route under it is never
   the filing just refused, and the party named is the check's and not the tracker's (ISS-163). */
test("a filing refused by name is reported as refused, by the check whose it was, and not routed back to the filing it forbade", () => {
  const { work } = owedAt("wt-ISS-999");
  noBacklog({ issues: [{ issueId: "ISS-135", documentId: "u-135", status: "open",
    title: "The batch 0000000..1111111 is read once as a whole by a run that wrote none of it, and "
      + "the mark moves" }] });

  const run = lastStep(work);
  assert.match(run.stderr, /this plugin's own filing check refused the body, the tracker having answered: it reads as ISS-135/u,
    `a refusal and a silence are different findings, and so are a check of this plugin's and the tracker's answer:\n${run.stderr}`);
  assert.doesNotMatch(run.stderr, /did not answer/u, "the tracker answered — by name, with what it collided with");
  assert.doesNotMatch(run.stdout, /forge new - --title/u,
    `the route under a refusal has to be one the refusal leaves open:\n${run.stdout}`);
  assert.match(run.stdout, /forge issue ISS-135/u, run.stdout);
  assert.doesNotMatch(run.stdout, /Work ISS-135\./u,
    `the gate collides on title similarity, so the key it names is nothing to launch a run on:\n${run.stdout}`);
  assert.match(run.stderr, /as ISS-135:/u, run.stderr);
  assert.doesNotMatch(run.stdout, /ISS-999/u,
    `the collision is the key the tracker named, and a path in its reason carries one too:\n${run.stdout}`);
});

/* A CLI that will not start answered nothing, so calling it the tracker's silence names a party
   that was never reached. Its route out is neither the tracker's nor the filing check's. */
test("a CLI that cannot be run is this checkout's failure and not a tracker that did not answer", () => {
  const { work } = owedAt("unrunnable");
  lastStep(work);
  chmodSync(join(work, "plugin", "bin", "forge"), 0o000);

  const run = runIn(work, ["ship", "--from", "10"], BARE);
  assert.match(run.stderr, /could not be run, so nothing is filed and the next ship asks again/u,
    `a CLI that would not start, reported as a tracker that did not answer:\n${run.stderr}`);
  assert.doesNotMatch(run.stderr, /the tracker did not answer/u,
    "no call reached the tracker, so its silence is not what this was");
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
  assert.match(run.stdout, /a review of [0-9a-f]{7}\.\.HEAD is owed: 1 release\(s\), 1 file\(s\), 501 changed line\(s\)/u,
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
  const { at, work } = owedAt("offline");
  noBacklog({ key: "ISS-777" });
  writeFileSync(join(at, "forge-refuses"), "");

  const blind = lastStep(work);
  assert.equal(blind.status, 0, blind.stderr);
  assert.match(blind.stdout, /a review of [0-9a-f]{7}\.\.HEAD is owed: 1 release\(s\), 1 file\(s\), 501 changed line\(s\)/u, blind.stdout);
  assert.match(blind.stderr, /the tracker did not answer the lookup, so nothing is filed and the next ship asks again/u,
    `a silence names which call it was, so a refusal is not read as one:\n${blind.stderr}`);
  assert.match(blind.stdout, /forge new - --title "review [0-9a-f]{7}\.\.HEAD" --kind feature/u,
    `the route it prints has to run as printed, and --size takes only \`fix\` (ISS-118):\n${blind.stdout}`);
  assert.match(blind.stdout, /start <that ISS-nn>/u, blind.stdout);
  assert.equal(seen("create").length, 0, "a refused list may not file");

  rmSync(join(at, "forge-refuses"));
  const then = lastStep(work);
  assert.equal(seen("create").length, 1,
    `the reading was lost rather than retried:\n${then.stdout}${then.stderr}`);
  assert.ok(then.stdout.includes("Work ISS-777."), then.stdout);
});

test("a reading that finds nothing moves the mark in one line, and the count starts again there", () => {
  const { work } = pushed("moved");
  runIn(work, ["review", "--done"], BARE);
  landIn(work, join("plugin", "src", "wide.mjs"), 501, "a module a run grew");
  assert.match(lastStep(work).stdout, /a review of/u, "501 lines under plugin/src is past the threshold");

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
  landIn(work, join("plugin", "src", "wide.mjs"), 501, "a module a run grew, and the reading read to here");
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
  assert.match(said.stdout, /the gate: 100s over 12 of 12 step\(s\) on 2026-01-02, 1\.25x the 80s before it/u,
    said.stdout);

  const lines = said.stdout.split("\n");
  const figure = lines.findIndex((one) => one.includes("the gate: 100s"));
  const volume = lines.findIndex((one) => one.includes("changed line(s) under"));
  assert.equal(volume - figure, 1, `the figure and the volume count are not one place:\n${said.stdout}`);
});
