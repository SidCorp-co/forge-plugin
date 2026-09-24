/* One change as the unit: which runs each population holds, what makes a comparison eligible to carry
   the association, and which of the three verdicts each way of falling short earns. The corpus is
   `fixture-eval.mjs`'s, one run an hour, so a copy installed at hour N cuts it where it is counted. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ALONE, NOT_MEASURED, NO_COUNTERFACTUAL, VERDICTS, WIDER,
  changeOf, comparisonOf, exposureOf, populationsOf, verdictOf,
} from "../../../src/stats/eval/change.mjs";
import { changeLines } from "../../../src/stats/eval/change-lines.mjs";
import { distanceOf, mixFloorsOver, mixOf, tallyOf } from "../../../src/stats/eval/mix.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { BASE, HOUR, PROJECT, askStats, runsOf } from "../fixture-eval.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("stats-change-home-");

/* Two hundred, so a three-run population taints under a twentieth of the reference's own adjacent
   positions and a movement planted inside it lands past a p95 rather than inside the tail it made. */
const MANY = 200;
const corpus = runsOf(MANY);

/* A copy per hour named for it, so every bound in a case reads off the hour it was written with. */
const copy = (name, hour, born = true) => ({ copy: name, at: BASE + hour * HOUR * 1000, born });
const COPIES = [copy("1.0.0", 0), copy("1.0.1", 60), copy("1.0.2", 63)];

const over = (runs, at, many, fields) => runs.map((run, n) =>
  (n >= at && n < at + many ? { ...run, ...fields } : run));

/* Uniform in everything the angles read, so the corpus's own adjacent positions shift by nothing and
   the reference p95 is nought — which is what lets a case put a movement past it on purpose. */
const flat = (runs) => runs.map((run) => ({ ...run, seconds: 600, calls: 100 }));

const release = (version, issues) => ({ kind: "releases", version, issues });
const RELEASES = [release("1.0.0", ["ISS-1"]), release("1.0.1", ["ISS-2", "ISS-3"]), release("1.0.2", ["ISS-4"])];

const NAMES = ["wall", "calls"];

const readingOf = (runs = corpus, copies = COPIES, version = "1.0.1", claim = null) =>
  changeOf({ ordered: runs, copies, releases: RELEASES, version, names: NAMES, declared: null, claim });

const screen = (held) => changeLines(held).join("\n");

test("1. the isolated population is the runs that began at or after this install and ended before the next", () => {
  const held = populationsOf(corpus, COPIES, "1.0.1");
  assert.equal(held.alone.length, 3);
  assert.ok(held.alone.every((run) => run.startedAt >= COPIES[1].at && run.endedAt < COPIES[2].at));
  assert.match(screen(readingOf()), /ran this change and no other\n {2}before {5}3 run\(s\)\n {2}now {8}3 run\(s\)/u);
});

test("2. a population with no later installation is said to be open-ended", () => {
  const held = readingOf(corpus, COPIES, "1.0.2");
  assert.equal(held.open, true);
  assert.match(screen(held), /no copy was installed after it, so the population that ran this change and no other is open-ended/u);
});

test("3. every later change installed inside the wider population's span is named", () => {
  const held = readingOf();
  assert.deepEqual(held.exposures[WIDER].releases.map((one) => one.version), ["1.0.1", "1.0.2"]);
  assert.match(screen(held), /ISS-2, ISS-3, ISS-4/u);
});

test("4. a movement is associated with the whole set the population was exposed to", () => {
  const runs = over(flat(corpus), 60, 3, { seconds: 60 });
  const held = readingOf(runs);
  assert.equal(held.deciding, ALONE);
  assert.match(held.verdict, /^associated with 2 change\(s\): ISS-2, ISS-3$/u);
});

test("5. the size of the set a movement is associated with is stated", () => {
  const held = readingOf(over(flat(corpus), 60, 3, { seconds: 60 }));
  assert.equal(held.associated.changes, 2);
  assert.match(screen(held), /set {8}2 change\(s\) over 1 release\(s\): ISS-2, ISS-3/u);
});

test("6. a change whose release carried more than one key names the other keys it carried", () => {
  assert.deepEqual(exposureOf(COPIES, RELEASES, COPIES[1]).keys, ["ISS-2", "ISS-3"]);
  assert.match(screen(readingOf()), /ran this change and no other\n {4}2 change\(s\) over 1 release\(s\): ISS-2, ISS-3/u);
});

test("7. no movement is associated with a single change where the population ran more than one", () => {
  const held = readingOf(over(flat(corpus), 60, 3, { seconds: 60 }));
  assert.equal(held.associated.single, false);
  assert.match(screen(held), /That population ran all of them, so none of them singly carries this movement\./u);
});

test("8. each installation moment says whether it is a birth time or a substituted modification time", () => {
  const copies = [COPIES[0], COPIES[1], copy("1.0.2", 63, false)];
  const held = readingOf(corpus, copies);
  assert.deepEqual(held.moments.alone.map((one) => one.born), [true, false]);
  assert.match(screen(held), /the directory's modification time, the filesystem reporting no birth time/u);
});

test("9. a comparison whose bound rests on a modification time is ineligible", () => {
  const runs = over(flat(corpus), 60, 3, { seconds: 60 });
  const copies = [COPIES[0], COPIES[1], copy("1.0.2", 63, false)];
  const alone = readingOf(runs, copies).comparisons.find((one) => one.name === ALONE);
  assert.equal(alone.eligible, false);
  assert.ok(alone.why.some((one) => /the copy installed after it is dated by the directory's modification time/u.test(one)));
});

test("10. undetermined is the answer where no comparison is eligible", () => {
  const held = readingOf(corpus, [copy("1.0.0", 0, false), copy("1.0.1", 60, false), copy("1.0.2", 63, false)]);
  assert.equal(held.verdict, VERDICTS.undetermined);
  assert.equal(held.deciding, null);
});

test("11. each comparison held ineligible says why it was", () => {
  const held = readingOf(corpus, [copy("1.0.0", 0, false), copy("1.0.1", 60, false), copy("1.0.2", 63, false)]);
  assert.deepEqual(held.why.map((one) => one.comparison), [ALONE, WIDER]);
  assert.ok(held.why.every((one) => one.why.length > 0));
  assert.match(screen(held), /why {8}ran this change and no other is not eligible:/u);
});

test("12. undetermined is a verdict of its own and carries no shift standing in for it", () => {
  const held = readingOf(corpus, [copy("1.0.0", 0, false), copy("1.0.1", 60, false), copy("1.0.2", 63, false)]);
  assert.equal(held.associated, null);
  assert.equal(Object.hasOwn(held, "verdict"), true);
  assert.match(screen(held), /verdict {4}undetermined/u);
});

test("13. nothing moved is answered only where an angle returned a verdict and none moved", () => {
  const held = readingOf(flat(corpus));
  const alone = held.comparisons.find((one) => one.name === ALONE);
  assert.ok(alone.judged > 0);
  assert.deepEqual(alone.moved, []);
  assert.equal(held.verdict, VERDICTS.nothing);
});

test("14. the no-movement answer is worded as no movement past the reference", () => {
  assert.equal(VERDICTS.nothing, "no angle that returned a verdict moved past this corpus's own reference");
  assert.doesNotMatch(VERDICTS.nothing, /no effect|did nothing|caused/u);
});

test("15. the reading states that no comparison it makes supplies a counterfactual", () => {
  assert.match(NO_COUNTERFACTUAL, /supplies a counterfactual/u);
  assert.match(screen(readingOf()), /No comparison here supplies a counterfactual/u);
});

test("16. a covariate past its reference p95 holds the comparison ineligible", () => {
  const runs = over(flat(corpus), 60, 3, { rung: "fix" });
  const alone = readingOf(runs).comparisons.find((one) => one.name === ALONE);
  assert.equal(alone.eligible, false);
  assert.equal(alone.mix.find((one) => one.name === "rung").holds, true);
});

test("17. the covariate that held a comparison ineligible is named", () => {
  const alone = readingOf(over(flat(corpus), 60, 3, { rung: "fix" }))
    .comparisons.find((one) => one.name === ALONE);
  assert.ok(alone.why.some((one) => one.startsWith("rung: the mix moved")));
});

test("18. the mix reference is over this corpus's adjacent positions at the two sizes, an absent value counting as nought", () => {
  assert.equal(distanceOf({ a: 1 }, { b: 1 }), 1);
  assert.equal(distanceOf({ a: 2, b: 2 }, { a: 4 }), 0.5);
  const floors = mixFloorsOver(over(flat(corpus), 0, 60, { rung: "fix" }), 10, 10);
  assert.equal(floors.get("rung").before, 10);
  assert.equal(floors.get("rung").now, 10);
  assert.equal(floors.get("rung").over, MANY - 20 + 1);
  assert.ok(floors.get("rung").p95 > 0);
});

test("19. a mix reference over fewer positions than the minimum holds the comparison ineligible", () => {
  const short = flat(corpus).slice(0, 25);
  const copies = [copy("1.0.0", 0), copy("1.0.1", 10), copy("1.0.2", 22)];
  const alone = changeOf({ ordered: short, copies, releases: RELEASES, version: "1.0.1", names: NAMES,
    declared: null, claim: null }).comparisons.find((one) => one.name === ALONE);
  assert.equal(alone.eligible, false);
  assert.ok(alone.why.some((one) => /fewer than the 20 a p95 needs/u.test(one)));
});

test("20. a mix reference under the minimum says the count of positions that yielded a distance", () => {
  const short = flat(corpus).slice(0, 25);
  const copies = [copy("1.0.0", 0), copy("1.0.1", 10), copy("1.0.2", 22)];
  const held = changeOf({ ordered: short, copies, releases: RELEASES, version: "1.0.1", names: NAMES,
    declared: null, claim: null });
  assert.match(screen(held), /rung: \d+ adjacent position\(s\) of this corpus yielded a mix distance at \d+ against \d+/u);
});

test("28. the reading states what none of its figures measures, a phase duration among them", () => {
  assert.match(NOT_MEASURED, /A phase duration is how the work was spent and not whether the result was good/u);
  assert.match(screen(readingOf()), /Nothing here is a quality measure\./u);
});

test("a covariate whose two populations hold the same values has no distance to hold anything back", () => {
  const tally = tallyOf(corpus.slice(0, 3), (run) => run.rung);
  assert.deepEqual(tally, { unknown: 3 });
  const held = mixOf("rung", corpus.slice(0, 3), corpus.slice(3, 6), null);
  assert.equal(held.distance, 0);
});

test("the verdict prefers the isolated comparison and prints the wider one's reason whatever it decides", () => {
  const runs = over(flat(corpus), 60, 3, { seconds: 60 });
  const held = readingOf(runs);
  assert.equal(held.deciding, ALONE);
  assert.deepEqual(held.why.map((one) => one.comparison), [WIDER]);
});

test("a change no copy under this cache carries is refused by the name that was typed", () => {
  const ran = askStats(tempRoom("stats-change-"), ["change", "9.9.9", "--checkout", PROJECT]);
  assert.equal(ran.status, 1);
  assert.match(ran.stderr, /no copy of 9\.9\.9 is under this machine's plugin cache/u);
});

test("31. an issue key no held release reading names is refused rather than judged over some other population", () => {
  const ran = askStats(tempRoom("stats-change-"), ["change", "ISS-404", "--checkout", PROJECT]);
  assert.equal(ran.status, 1);
  assert.doesNotMatch(ran.stdout, /verdict/u);
});

test("32. the key that could not be resolved is named in the refusal that reports it", () => {
  const ran = askStats(tempRoom("stats-change-"), ["change", "ISS-404", "--checkout", PROJECT]);
  assert.match(ran.stderr, /no release reading held for this project names ISS-404/u);
});

test("the subject is named by the verb's own usage and refuses a call naming no change", () => {
  const ran = askStats(tempRoom("stats-change-"), ["change"]);
  assert.equal(ran.status, 1);
  assert.match(ran.stderr, /name the change — a version, or the issue key that landed in it/u);
  assert.match(askStats(tempRoom("stats-change-"), ["-h"]).stdout, /change {4}one change as the unit/u);
});

test("verdictOf answers undetermined where the comparisons it is handed are all ineligible", () => {
  const one = { name: ALONE, eligible: false, why: ["nothing evaluable"], moved: [] };
  const two = { name: WIDER, eligible: false, why: ["nothing evaluable"], moved: [] };
  const held = verdictOf([one, two], {});
  assert.equal(held.verdict, VERDICTS.undetermined);
  assert.deepEqual(held.why.map((each) => each.comparison), [ALONE, WIDER]);
});

test("a comparison counts an angle that returned no verdict as neither moved nor still", () => {
  const held = comparisonOf({ ordered: flat(corpus).slice(0, 4), name: ALONE,
    before: flat(corpus).slice(0, 2), now: flat(corpus).slice(2, 4), moments: [], names: NAMES, declared: null });
  assert.equal(held.judged, 0);
  assert.deepEqual(held.moved, []);
  assert.equal(held.eligible, false);
});

test("a change whose copy served no run answers rather than throwing, and matches an empty before side", () => {
  const copies = [COPIES[0], COPIES[1], COPIES[2], copy("1.0.3", 900)];
  const held = readingOf(corpus, copies, "1.0.3");
  const alone = held.comparisons.find((one) => one.name === ALONE);
  assert.equal(alone.now.runs, 0);
  assert.equal(alone.before.runs, 0);
  assert.equal(held.verdict, VERDICTS.undetermined);
  assert.match(screen(held), /verdict {4}undetermined/u);
});

test("a change installed before every run has an empty before side and is still read", () => {
  const held = readingOf(corpus, [copy("1.0.1", -1), copy("1.0.2", 63)], "1.0.1");
  const alone = held.comparisons.find((one) => one.name === ALONE);
  assert.equal(alone.before.runs, 0);
  assert.equal(held.verdict, VERDICTS.undetermined);
});

test("a release inside the span whose reading names no issue is named by its version and still counted", () => {
  const releases = [release("1.0.1", ["ISS-2"]), release("1.0.2", [])];
  const held = changeOf({ ordered: over(flat(corpus), 60, 3, { seconds: 60 }), copies: COPIES,
    releases, version: "1.0.1", names: NAMES, declared: null, claim: null });
  assert.equal(held.exposures[WIDER].changes, 2);
  assert.match(screen(held), /ISS-2, 1\.0\.2 \(no issue on its reading\)/u);
});

test("the installed moment and the next copy's end in their zone, so git reads them as the same instant", () => {
  const said = screen(readingOf());
  assert.match(said, /^ {2}installed {2}2026-09-03 12:00Z, by the directory's birth time$/mu, said);
  assert.match(said, /^ {2}next {7}1\.0\.2 at 2026-09-03 15:00Z, by the directory's birth time$/mu, said);
});
