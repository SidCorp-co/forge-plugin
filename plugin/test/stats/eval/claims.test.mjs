/* The figure a change states before it lands: what a claim may name, when the write is refused, what
   the write could not establish, and how the reading that judges it reports one written too late. */
import assert from "node:assert/strict";
import test from "node:test";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  BROKEN, KEPT, UNDECIDED, UNJUDGED, WHAT_A_CLAIM_BUYS,
  claimAsked, claimFor, claimJudged, claimLines, claimSaid, writeClaim,
} from "../../../src/stats/eval/claims.mjs";
import { DISPOSITIONS } from "../../../src/stats/eval/angles.mjs";
import { CLAIMS, RELEASES, marksOf, marksPath, scopeOf } from "../../../src/stats/marks/marks.mjs";
import { refusing } from "../../../src/resolve/settings.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { PROJECT, askStats, corpusOf } from "../fixture-eval.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("stats-claims-home-");

const ROOT = "/fixture/root";
const AT = Date.parse("2026-09-10T00:00:00.000Z");

const holding = (record) => {
  const path = marksPath();
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(record)}\n`);
};

const angle = (name, disposition, shift) => ({ name, disposition, shift });

/* `fail` ends the process outside `refusing`, which is where the verb calls it from. */
const refused = async (run) => {
  let held = null;
  await assert.rejects(refusing(async () => run()), (error) => {
    held = error.message;
    return true;
  });
  return held;
};

test("21. a claim naming an angle outside the shipped set, or naming no direction, is refused", async () => {
  assert.match(await refused(() => claimAsked("nope:falls")), /no angle named nope/u);
  assert.match(await refused(() => claimAsked("wall:sideways")), /no direction named sideways/u);
  assert.match(await refused(() => claimAsked("wall")), /--claim takes <angle>:<direction>/u);
});

test("22. a claim refused for what it named is refused with what it may name instead", async () => {
  assert.match(await refused(() => claimAsked("nope:falls")), /There is: wall, calls, edit-chars/u);
  assert.match(await refused(() => claimAsked("wall:sideways")), /A figure falls or rises\./u);
});

test("23. a claim is refused where a release reading held for this project already names that issue", async () => {
  holding({ kind: RELEASES, scope: ROOT, version: "2.0.0", issues: ["ISS-11"], mark: 1, at: "2026-09-10T00:00:00.000Z" });
  const said = await refused(() => writeClaim(ROOT, "ISS-11", { angle: "wall", direction: "falls" }));
  assert.match(said, /ISS-11 landed in release 2\.0\.0/u);
  assert.match(said, /A claim is written before the change lands\./u);
  assert.equal(marksOf(CLAIMS, ROOT).filter((one) => one.issue === "ISS-11").length, 0);
});

test("24. a claim the store could not place records that landing could not be established", () => {
  const { record } = writeClaim(ROOT, "ISS-12", { angle: "calls", direction: "falls" });
  assert.equal(record.landingKnown, false);
  assert.equal(claimFor(ROOT, "ISS-12").angle, "calls");
  assert.match(claimSaid(record), /the whole of what this write could establish about whether it has landed/u);
});

test("25. the reading prints when the claim was written and when the change's copy was installed", () => {
  const record = { issue: "ISS-13", angle: "wall", direction: "falls", at: "2026-09-09T00:00:00.000Z" };
  const judged = claimJudged(record, [angle("wall", DISPOSITIONS.improved, -0.5)], AT);
  assert.equal(judged.writtenAt, "2026-09-09T00:00:00.000Z");
  assert.equal(judged.installedAt, "2026-09-10T00:00:00.000Z");
  const said = claimLines(judged).join("\n");
  assert.match(said, /written {4}2026-09-09T00:00:00\.000Z/u);
  assert.match(said, /installed {2}2026-09-10T00:00:00\.000Z/u);
});

test("26. a claim written at or after that install counts as no prediction", () => {
  const late = { issue: "ISS-14", angle: "wall", direction: "falls", at: "2026-09-11T00:00:00.000Z" };
  const judged = claimJudged(late, [angle("wall", DISPOSITIONS.improved, -0.5)], AT);
  assert.equal(judged.predicted, false);
  assert.equal(judged.outcome, KEPT);
  assert.match(claimLines(judged).join("\n"), /no prediction: it was written at or after that install/u);
});

test("27. a kept claim is stated to be a prediction that held and no evidence the harness improved", () => {
  const early = { issue: "ISS-15", angle: "wall", direction: "falls", at: "2026-09-09T00:00:00.000Z" };
  const judged = claimJudged(early, [angle("wall", DISPOSITIONS.improved, -0.5)], AT);
  assert.equal(judged.predicted, true);
  assert.match(claimLines(judged).join("\n"), /no evidence that the harness improved/u);
  assert.match(WHAT_A_CLAIM_BUYS, /no counterfactual, no independence between changes and no statistical power/u);
});

test("a claim the figure moved against is broken, and one over an angle with no verdict is neither", () => {
  const record = { issue: "ISS-16", angle: "wall", direction: "falls", at: "2026-09-09T00:00:00.000Z" };
  assert.equal(claimJudged(record, [angle("wall", DISPOSITIONS.declined, 0.5)], AT).outcome, BROKEN);
  assert.equal(claimJudged(record, [angle("wall", DISPOSITIONS.same, 0.01)], AT).outcome, UNDECIDED);
  assert.equal(claimJudged(record, [angle("wall", DISPOSITIONS.unevaluable, null)], AT).outcome, UNJUDGED);
  assert.equal(claimJudged(record, [], AT).outcome, UNJUDGED);
});

test("a change with no claim held says so rather than printing an empty block", () => {
  assert.match(claimLines(null).join("\n"), /no claim is held for this change/u);
  assert.equal(claimJudged(null, [], AT), null);
});

/* One corpus, one home, one release reading held over it: the two cases below both ask what a stored
   release reading answers for, and building it twice would be two fixtures for one arrangement. */
const releaseHeld = (version, issues) => {
  const room = corpusOf(6);
  const home = tempRoom("stats-claims-read-");
  const path = join(home, "forge", "eval-marks.jsonl");
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify({ kind: RELEASES, scope: scopeOf(PROJECT), version, issues,
    mark: 6, at: "2026-09-10T00:00:00.000Z",
    now: { runs: 6, profile: { runs: 6, from: 0, to: 1, medianMinutes: 10, medianCalls: 3,
      rungs: [], phases: [], perRun: {}, ships: {}, tokens: {} }, groups: [] } })}\n`);
  return { room, home };
};

test("30. an issue key is resolved to the copy that carried it through the release readings held", () => {
  const { room, home } = releaseHeld("3.1.4", ["ISS-17"]);
  const ran = askStats(room, ["change", "ISS-17", "--checkout", PROJECT], home);
  assert.equal(ran.status, 1);
  assert.match(ran.stderr, /ISS-17 landed in 3\.1\.4/u);
});

test("29. a comparison since a release says which runs its recent side is taken from", () => {
  const { room, home } = releaseHeld("3.1.5", ["ISS-18"]);
  const ran = askStats(room, ["eval", "--checkout", PROJECT, "--since-release", "3.1.5", "--requests", "1"], home);
  assert.match(ran.stdout, /the recent side of this comparison is the corpus's last runs by end time/u);
  assert.match(ran.stdout, /forge stats change 3\.1\.5/u);
});
