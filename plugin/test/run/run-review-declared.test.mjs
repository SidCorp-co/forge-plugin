/* What a count is reckoned under, and the trees that can take no count at all: the declaration both
   readers read, the source each half of it came from, and the paths a checkout has to hold for a
   zero over them to mean a quiet week. */
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { escaped } from "../fixtures.mjs";
import { BARE, lastStep, landIn, noBacklog, pushed, recordOf, ref, runIn, seen, stubbed,
  withReview } from "./run-fixtures.mjs";

/* The filing is a module call, so what it sent is a payload on the endpoint, not an argv. */
const creating = () => seen("create")[0]?.args.data ?? null;

/* One transposed character in a declared path counted zero, printed that zero with the file it was
   read from beside it, and owed a reading never again (ISS-1939). */
test("a declared path this checkout does not hold is refused where the reckoning is spent, not counted as zero", () => {
  const { work } = pushed("mistyped");
  withReview(work, 40, ["plugin/scr"]);
  runIn(work, ["review", "--done"], BARE);
  landIn(work, join("plugin", "src", "wide.mjs"), 60, "a module a run grew");

  const asked = runIn(work, ["review"], BARE);
  assert.equal(asked.status, 1, asked.stdout);
  assert.doesNotMatch(asked.stdout, /changed line\(s\)/u, "a path that is not there counts no lines");
  assert.match(asked.stderr, /plugin\/scr is a counted path this repository does not hold/u, asked.stderr);
  assert.ok(asked.stderr.includes(`\`review.paths\` in ${recordOf(work)}`), asked.stderr);
  assert.match(asked.stderr, /--set project\.review\.paths/u,
    "the key the refusal names, which is what makes this the declared-paths refusal and not another");
});

/* The same zero from the other side: a declared path is the repository root's, and a pathspec is
   the caller's directory's, so the verb run below the root counted nothing and said so (ISS-1939). */
test("the reckoning counts the repository's declared paths from wherever in it the verb is run", () => {
  const { work } = pushed("below-root");
  withReview(work, 40, ["plugin/src"]);
  runIn(work, ["review", "--done"], BARE);
  landIn(work, join("plugin", "src", "wide.mjs"), 60, "a module a run grew");

  const below = runIn(work, ["review"], BARE, "plugin");
  assert.equal(below.status, 0, below.stderr);
  assert.match(below.stdout, /1 file\(s\), 60 changed line\(s\) under plugin\/src/u, below.stdout);
  assert.match(below.stdout, /^A review is owed:/mu, below.stdout);
});

test("the last step refuses that same reckoning, files no reading and leaves the release where it stood", () => {
  const { work } = pushed("mistyped-ship");
  stubbed(work);
  withReview(work, 40, ["plugin/scr"]);
  runIn(work, ["review", "--done"], BARE);
  const planted = ref(work);
  landIn(work, join("plugin", "src", "wide.mjs"), 60, "a module a run grew");
  noBacklog();

  const run = lastStep(work);
  assert.equal(run.status, 0, "the reckoning is the last step's report, and reports do not fail a release");
  assert.match(run.stderr, /plugin\/scr is a counted path this repository does not hold/u, run.stderr);
  assert.doesNotMatch(run.stdout, /release\(s\)/u, "a tree that cannot be counted prints no count");
  assert.equal(creating(), null, "nothing is filed off a count nobody could take");
  assert.equal(ref(work), planted, "the mark is not moved by a reckoning that was refused");
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
  assert.match(half, new RegExp(`under plugin/src, plugin/hooks, plugin/bin {2}← the volume ${
    escaped(recordOf(work))}, the paths the plugin's default$`, "mu"), half);
  assert.match(half, /^Short of the 40 changed line\(s\)/mu, half);

  landIn(work, join("plugin", "test", "wide.test.mjs"), 40, "the cases that module wanted");
  withReview(work, 40, ["plugin/src", "plugin/hooks", "plugin/bin", "plugin/test"]);
  const both = runIn(work, ["review"], BARE).stdout;
  assert.match(both, new RegExp(`under plugin/src, plugin/hooks, plugin/bin, plugin/test {2}← ${
    escaped(recordOf(work))}$`, "mu"), both);
  assert.match(both, /^A review is owed: 40 changed line\(s\)/mu, both);
});

test("the release step names the reckoning on both sides of the threshold", () => {
  const { work } = pushed("step-source");
  stubbed(work);
  runIn(work, ["review", "--done"], BARE);
  withReview(work, 40, ["plugin/src", "plugin/test"]);
  landIn(work, join("plugin", "src", "wide.mjs"), 4, "a module a run grew");

  const short = lastStep(work).stdout;
  assert.match(short, new RegExp(`under plugin/src, plugin/test since [0-9a-f]{7}, short of the 40 `
    + `line\\(s\\) that call for a reading {2}← ${escaped(recordOf(work))}`, "u"), short);

  noBacklog({ key: "ISS-779" });
  landIn(work, join("plugin", "src", "wider.mjs"), 41, "the lines that cross it");
  const past = lastStep(work).stdout;
  assert.match(past, new RegExp(`under plugin/src, plugin/test, at or past 40 line\\(s\\) {2}← ${
    escaped(recordOf(work))}`, "u"), past);
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
    assert.ok(filing.description.includes(
      `Reckoned at 40 changed line(s) over ${paths.length} path(s)  ← ${recordOf(work)}`),
      `the body names no reckoning:\n${filing.description}`);
    assert.ok(filing.description.includes(`its diff under those ${paths.length} paths`),
      `the body counts a number of paths it did not count:\n${filing.description}`);
  }
});

/* The help is the declaration's other reader, and it is read before any count has been taken, so a
   caller who typed `-h` is told the number and the paths the next one will run under (ISS-1912). */
test("the help names the reckoning a count will be taken under, this script's until the project declares one", () => {
  const { work } = pushed("help-source");
  runIn(work, ["review", "--done"], BARE);

  const shipped = runIn(work, ["-h"], BARE).stdout;
  assert.match(shipped, /range holds 1500 changed line\(s\)/u, "the number this script ships with");
  assert.match(shipped, /counts what landed under plugin\/src, plugin\/hooks, plugin\/bin since/u,
    "and the three paths it ships with");

  withReview(work, 40, ["plugin/src", "tools"]);
  const declared = runIn(work, ["-h"], BARE).stdout;
  assert.match(declared, /range holds 40 changed line\(s\)/u, "the number the project has replaced");
  assert.match(declared, /counts what landed under plugin\/src, tools since/u,
    "and the paths the project has replaced");
});

/* The refusal is the CLI's and each value reaches it on its own, so the loop spawns per value. */
test("a review.lines that is no count of lines is refused by name rather than replaced", () => {
  for (const given of [0, -5, 1.5, null]) {
    const { work } = pushed(`review-lines-${String(given).replace(/[.-]/gu, "_")}`);
    runIn(work, ["review", "--done"], BARE);
    withReview(work, given);
    const run = runIn(work, ["review"], BARE);
    assert.equal(run.status, 1, run.stdout);
    assert.ok(run.stderr.includes(`\`review.lines\` in ${recordOf(work)} is a whole number of `
      + "changed lines above zero"), run.stderr);
    assert.ok(run.stderr.includes(String(given)), `the value refused is not named:\n${run.stderr}`);
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
  assert.match(help.stdout, /^Usage: node \S*run\.mjs <start\|relink\|finish\|ship\|land\|land-ready\|wait\|review>/mu, help.stdout);
  assert.ok(help.stdout.includes("whose declaration every reader of it refuses: "
    + `\`review.lines\` in ${recordOf(work)} is a whole number`),
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
  assert.ok(counted.stderr.includes(`\`review.lines\` in ${recordOf(work)} is a whole number of `
    + 'changed lines above zero, not `"lots"`'), counted.stderr);
  assert.match(counted.stderr, /Drop the key to take the 1500 this plugin ships with/u, counted.stderr);
});
