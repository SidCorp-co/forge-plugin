/* The one switch about production, after it moved off the tracker (ISS-2190). Every reader of it
   spends `autoProd`, which is derived once, so what is judged here is the derivation and the readers
   that would each have needed their own key had it been derived at the caller instead — the closing
   rung's among them, since that one is two trees away and is what the move was asked for. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("release-switch").path;
const { landingRoute, personOwedForRelease, releaseFrom, waitsForPerson } =
  await import("../../src/tracker/project-config.mjs");
const { render } = await import("../../src/flow/record/page.mjs");
const { deployedOwed, viewFrom } = await import("../../src/flow/earned.mjs");

const NONE = { value: null, from: null };
const PUBLISHES = { baseBranch: "master", releaseModel: "publish" };

/* What `releaseScope` hands `releaseFrom`, spelled here rather than read off a file: this file is
   about what the derivation does with each answer, and the file it came out of is the report's. */
const declared = (value) => ({ value, from: "the project's own record" });
const unset = { value: null, from: "the plugin's default" };
const mistyped = { value: null, from: "the plugin's default", unknown: "manul" };

const policy = (autoProdDeploy, release) =>
  releaseFrom({ ...PUBLISHES, pipelineConfig: { autoProdDeploy } }, release);

test("the project's own key answers the switch, over a tracker flag that says the opposite either way", () => {
  assert.equal(policy(false, declared("auto")).autoProd, true);
  assert.equal(policy(true, declared("manual")).autoProd, false);
  assert.equal(policy(false, declared("auto")).autoProdFrom, "the project's own record",
    "and the level that answered travels with the answer, for the row that prints it");
  assert.equal(policy(true, declared("manual")).autoProdFrom, "the project's own record",
    "whichever of the two answers the key gave");
});

test("a project that declared nothing locally is the project the tracker's flag already described", () => {
  assert.equal(policy(true, unset).autoProd, true, "which is what it read before the key existed");
  assert.equal(policy(false, unset).autoProd, false);
  assert.equal(releaseFrom(PUBLISHES, unset).autoProd, false,
    "and neither level having spoken is the reading that stops rather than the one that ships");
  assert.equal(policy(true, unset).autoProdFrom,
    "the tracker's project config, this project's own `release` key being unset",
    "named in full, a fallback nobody can see being a precedence nobody can undo");
});

/* A word the key does not take falls back with the rest, as every key of that file does: the report
   is where it is named, and the behaviour is the one the project had before the typo. */
test("a word the key does not take leaves the tracker's flag answering, and is carried for the report", () => {
  assert.equal(policy(true, mistyped).autoProd, true);
  assert.equal(policy(true, mistyped).autoProdFrom,
    "the tracker's project config, this project's own `release` key holding `manul`, which is no value"
    + " of it — it takes auto, manual",
    "the values it does take included, so the row hands back a correction rather than a complaint");
});

/* The three readers that make this one derivation rather than one key each. Each of them read the
   tracker's flag directly until the move, and none of them is edited by it. */
test("the landing route, the person's look and the closing rung all follow the one derivation", () => {
  assert.equal(landingRoute(policy(false, declared("auto")), NONE).value, "before-merge",
    "a model that moves no ref and deploys on its own means the push IS the deploy");
  assert.equal(landingRoute(policy(true, declared("manual")), NONE).value, "after-merge");
  assert.equal(waitsForPerson(policy(false, declared("auto"))), false,
    "a change that ships without a person's look waits for nobody");
  assert.equal(waitsForPerson(policy(true, declared("manual"))), true);
  assert.equal(personOwedForRelease(policy(false, declared("auto"))), null,
    "and a production that deploys on its own is what takes a person out of the closing rung");
  assert.match(personOwedForRelease(policy(true, declared("manual"))),
    /act on this project's live deploy binding/u);
});

/* The reader two trees away, and the one the issue was filed for: `deployOwed` tests
   `view.release?.autoProd` alone, so a key resolved anywhere but inside the policy would leave this
   rung reading the level the switch moved off. The refusals themselves are entry-checks.test.mjs's. */
const NOTE = "merged to master at 43b811e; reviewed head 43b811e; judged head 43b811e; "
  + "landing moved nothing; landing wrote nothing";

let clock = 0;
const at = () => `2026-09-02T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body) => ({ createdAt: at(), authorId: "agent", body });

/* A verification asserting a deploy and naming none: the shape the rung refuses where production is
   automatic and takes where it is a person's. */
const ASSERTED = [
  comment(`mark_merged target=base — ${NOTE}`),
  comment(render("verification", { where: "https://app.example", commit: "43b811e", evidence: ["43b811e"] })),
];

const owed = (autoProdDeploy, release) => deployedOwed(
  viewFrom("the-uuid", { attachments: [{ name: "run.txt" }], releaseNotes: { section: "Fixed" } },
    ASSERTED, null, policy(autoProdDeploy, declared(release))),
  "ISS-3",
);

test("a project declaring it releases on its own owes the deploy proof, whatever the tracker's flag says", () => {
  const refused = owed(false, "auto");
  assert.equal(refused.length, 1, "the local key is what the rung reads, and it says nobody is asked");
  assert.match(refused[0].what, /a sha names no deployment/u);
});

test("a project declaring a person's look owes no deploy proof, whatever the tracker's flag says", () => {
  assert.deepEqual(owed(true, "manual"), [],
    "the rung asks for the proof because nobody is asked, and here somebody is");
});
