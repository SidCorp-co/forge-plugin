/* What the served method's phases say, phrase by phrase. Split from contract.test.mjs at its line
   limit (ISS-899): that file is about a document this repository serves, and these are the phases of
   the method served beside it. Every case asserts both directions, since a rule stated in a second
   phase is two rules the moment one of them is edited. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { flat, tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("method-phases").path;
const { DEFAULT, FLOW_SLUGS, SCREEN } = await import("../../../src/guides/flow.mjs");
const { servedBody } = await import("../../../src/guides/skill-guides.mjs");
const { render: rendered } = await import("../../../src/guides/render.mjs");
const { conditionsAt } = await import("../../../src/guides/conditions.mjs");
const { TOOL_STATES } = await import("../../../src/tools/services/tool-config.mjs");
const { PHASE } = await import("../../../src/guides/phases.mjs");
const { partFor, partsOf, readContract } = await import("../../../src/guides/contract.mjs");

const PLUGIN = new URL("../../../", import.meta.url).pathname;
const TEXT = readContract();
const PARTS = partsOf(TEXT);

/* The body `forge guide issue-flow` serves, not the stub Claude Code loads (ISS-353): a phase read
   out of one part file is measured against a fragment of the method rather than the method. */
const SKILL = servedBody("issue-flow", PLUGIN);
const VERIFICATION = join(PLUGIN, "guides", "skills", "issue-flow", DEFAULT, "references", "verification.md");
/* Split rather than matched to a lookahead: a lazy body against a multiline `$` ends at the first
   line break, and every phase then reads as empty. */
const phasesOf = (text) => Object.fromEntries(
  text.split(/^## /mu)
    .map((one) => [/^Phase (\d)/u.exec(one)?.[1], flat(one)])
    .filter(([n]) => n),
);

/* Met after the judging instead, the pass moves a path and every verdict is owed again — thirty-eight
   records for nineteen criteria, once (ISS-236, ISS-51, ISS-230). */
test("the read that earns the review has one place, and no landing owes a recheck", () => {
  const phases = phasesOf(SKILL);
  assert.match(PHASE.in_progress[0], /to the review/u, "the ladder names the review in Phase 4");
  const naming = Object.keys(phases).filter((n) => /read that earns the review/u.test(phases[n]));
  assert.deepEqual(naming, ["4"], "and the spine names that read in Phase 4 and in no other phase");
  const order = (text, first, then) => text.includes(first) && text.indexOf(first) < text.indexOf(then);
  assert.ok(order(phases["4"], "Replay the change onto", "the read of the whole set"),
    "the replay comes before the read it is taken after, by place and not by presence: a read named "
    + "first leaves both phrases in the section and judges a head the mark's note cannot bridge");
  const naming4 = Object.keys(phases).filter((n) => /Replay the change onto/u.test(phases[n]));
  assert.deepEqual(naming4, ["4"], "and the replay is stated in that phase and nowhere else");
  const held = flat(partFor(PARTS, "in_progress").text);
  assert.match(held, /the pass the review is earned by/u, "the contract names what earns the review");
  assert.match(held, /never a recheck/u, "and says what a landing owes instead");
  for (const [what, held2] of [["the contract", TEXT], ["the served method", SKILL],
    [VERIFICATION, readFileSync(VERIFICATION, "utf8")]]) {
    assert.doesNotMatch(held2, /owes its own recheck/u, `${what} sends a landing back for a recheck: `
      + "every surface is asked, not the two that state the rule, because a run reading the one left "
      + "behind takes a step the CLI refuses");
  }
});

/* Two of ISS-791's criteria were met by nothing and its own run judged them met: nothing compares a
   case's title to the assertions under it, so the method names the comparison target instead. */
test("Phase 5 names what a criterion is matched against, and no other phase answers that", () => {
  const phases = phasesOf(SKILL);
  for (const [beat, phrase] of [
    ["the comparison target", "the assertion lines that would go red"],
    ["that a case's name is not it", "never a case's name"],
    ["what a name carrying two claims costs", "two searches rather than one"],
    ["that an assertion which cannot fail is not coverage", "cannot fail covers nothing"],
  ]) {
    assert.ok(phases["5"].includes(phrase), `Phase 5 no longer names ${beat}, so a run judging a `
      + "criterion is back to reading a case's title for the assertions under it (ISS-960)");
  }
  const naming = Object.keys(phases).filter((n) => /criterion is matched against/u.test(phases[n]));
  assert.deepEqual(naming, ["5"], "and the phase that judges the criteria is the only one that says "
    + "what they are matched against, sought by the instruction's own words rather than the two "
    + "ordinary ones in it, since a phase saying anything else is matched against anything is prose "
    + "this rule has no claim on (review 6cae45, F2)");
});

/* Three runs in one night each invented a different amount of what a checker's refusal arriving
   after the read owes, and whether behaviour moved is not a mechanical question. */
test("Phase 4 says what a refusal arriving after that read owes, and no other phase does", () => {
  const phases = phasesOf(SKILL);
  for (const [beat, phrase] of [
    ["the case at all", "refusing the tree after that read"],
    ["what the fix is measured against", "measured against the set the read carried"],
    ["what a fix inside that set owes", "moving no behaviour owes no second read for what it changed"],
    ["what it says instead", "a correction naming it and why the read still holds"],
    ["the read a wider fix owes", "widening the set or moving behaviour owes a fresh read of the "
      + "whole set at the new head"],
    ["the verdicts it owes with it", "every verdict re-judged there"],
  ]) {
    assert.ok(phases["4"].includes(phrase), `Phase 4 no longer names ${beat}, so a run whose own fix `
      + "moved the head after the read is back to inventing what the record owes (ISS-1008)");
  }
  const naming = Object.keys(phases).filter((n) => /the tree after that read/u.test(phases[n]));
  assert.deepEqual(naming, ["4"], "and the phase that takes the read is the only one that says what "
    + "a refusal arriving after it owes");
});

/* Without these two lines the rule above does not terminate: a finding asking for a clearer sentence
   is answered by changing what the code prints, which reads as a change to what it does (ISS-1211). */
test("Phase 4 says what separates a change that owes a fresh read, and what a fix to a finding owes", () => {
  const phases = phasesOf(SKILL);
  for (const [beat, phrase] of [
    ["the separator at all", "which branch the code takes, not how many lines changed"],
    ["what counts as behaviour", "a value something outside the change reads: behaviour moved"],
    ["what does not", "the name of a thing nothing else uses: it did not"],
    ["why the line is load-bearing", "the rule does not terminate"],
    ["the reading a fix to a finding owes", "answered by a recheck"],
    ["the verb that takes it", "forge codex consult --recheck"],
    ["when the whole set is owed as well", "owed on top of it only where the fix widened the set"],
  ]) {
    assert.ok(phases["4"].includes(phrase), `Phase 4 no longer names ${beat}, so a run that accepted `
      + "a finding about a printed string has two defensible readings and takes the expensive one "
      + "(ISS-1211)");
  }
  const naming = Object.keys(phases).filter((n) => /--recheck/u.test(phases[n]));
  assert.deepEqual(naming, ["4"], "and the phase that takes the read is the only one naming the "
    + "recheck, the round's own limits being the verb's help and not this method's");
});

/* The two rules above are about the diff alone, so a run amending its confined fix into its one
   commit followed the phase exactly and lost the read the landing asks for (ISS-923, ISS-1395). */
test("Phase 4 says the head the read was taken at survives to the landing, and no other phase does", () => {
  const phases = phasesOf(SKILL);
  const under = (state) => {
    const held = conditionsAt(null);
    return rendered(SKILL, { ...held, "tool.codex": { ...held["tool.codex"], value: state } }).text;
  };
  const served = TOOL_STATES.map(under);
  for (const [beat, phrase] of [
    ["what the read is pinned to", "pinned to the head it was taken at"],
    ["the property that keeps it", "nothing you do afterwards takes that head off the branch"],
    ["where the answering fix goes", "goes on top of it and is never folded into it"],
    ["why a byte-identical tree is no defence", "leave the review answering for a commit the branch no longer carries"],
    ["that the rule is the property rather than one verb", "an amend, a reset and a rebase of your own each break it alike"],
    ["when a run may collapse its commits instead", "collapses the branch before it takes the read"],
  ]) {
    for (const [at, state] of TOOL_STATES.entries()) {
      assert.ok(phasesOf(served[at])["4"].includes(phrase), `Phase 4 under a ${state} reviewer no `
        + `longer names ${beat}, so a run answering a finding with an amend follows the phase `
        + "exactly and arrives at the landing with a review that answers for a commit nothing "
        + "carries (ISS-1395). Each state is rendered rather than joined, a fenced paragraph being "
        + "in the joined body whatever this machine saved");
    }
  }
  const naming = Object.keys(phases).filter((n) => /takes that head off the branch/u.test(phases[n]));
  assert.deepEqual(naming, ["4"], "and the phase that takes the read is the only one that says the "
    + "head it was taken at has to survive to the landing");
});

/* The method's own instruction is what put the file in the tree: `forge record criteria` takes a path
   and Phase 3 named no place for it, so a run wrote one at its worktree root and the next gate went
   red on a repository checker, at the baseline, where it reads as an already broken tree (ISS-1018). */
test("Phase 3 says where a payload file is written, in every flow and under either reviewer", () => {
  const beats = [
    ["whose file it is and where it goes", "so it is written outside the checkout"],
    ["how the place is chosen", "the project names for this run's own scratch"],
    ["that a project's own directory has to be outside as well", "where that directory is itself outside the checkout"],
    ["what answers where it is not", "the system's temporary one in every other case"],
    ["what a file left in the tree costs the run", "names a repository checker rather than the change"],
    ["why that reading is the expensive one", "the shape of a tree already red"],
    ["the tree a delegated run stands in", "where the worktree is not the checkout root"],
    ["that the rule outlives this phase's own two writes", "Every later file a verb reads off a path goes the same way"],
  ];
  for (const flow of FLOW_SLUGS) {
    const body = servedBody("issue-flow", PLUGIN, flow);
    const held = conditionsAt(null);
    for (const state of TOOL_STATES) {
      const phases = phasesOf(rendered(body, { ...held, "tool.codex": { ...held["tool.codex"], value: state } }).text);
      for (const [beat, phrase] of beats) {
        assert.ok(phases["3"].includes(phrase), `Phase 3 of the ${flow} flow under a ${state} reviewer `
          + `no longer names ${beat}, so the phase that sends a run to write a payload file names no `
          + "place for it and the run writes it into the tree it is about to gate (ISS-899)");
      }
    }
    const phases = phasesOf(body);
    const naming = Object.keys(phases).filter((n) => /it is written outside the checkout/u.test(phases[n]));
    assert.deepEqual(naming, ["3"], `and in the ${flow} flow the phase that first sends a run to `
      + "write a payload file is the only one that says where it goes, on that flow's own unrendered "
      + "body, since a copy behind a `forge:when` fence reads as absent in the state rendered away");
  }
});

/* The flow with a screen is the one that has an independent judge, and this clause was written before
   it did: a builder read Phase 3 for a `skipped` verdict and `judgeProblem` in
   `src/flow/qa/verdicts.mjs` refused it for carrying the builder's own id (ISS-1696). Watched failing
   by taking the condition back out of the paragraph. */
test("Phase 3 of the screen flow says whose the record for a criterion the builder cannot reach is", () => {
  const phases = phasesOf(servedBody("issue-flow", PLUGIN, SCREEN));
  const beats = [
    ["that proving carries no condition", "it proves every criterion it can reach, user-facing ones included"],
    ["that which record is owed is a question", "Which record it is turns on who this project made the judge"],
    ["what a builder judging its own change writes", "under the builder's own judgement, a `skipped` verdict"],
    ["what it leaves where another run judges", "the access shortfall by itself"],
  ];
  for (const [beat, phrase] of beats) {
    assert.ok(phases["3"].includes(phrase), `Phase 3 of the ${SCREEN} flow no longer names ${beat}, so `
      + "a builder under an independent judgement is sent here to write a verdict the tracker refuses "
      + "for carrying its own id, and spends the round learning that (ISS-1696)");
  }
  const naming = Object.keys(phases).filter((n) => /Which record it is turns on/u.test(phases[n]));
  assert.deepEqual(naming, ["3"], "and the phase that splits the criteria is the only one saying whose "
    + "that record is, a second copy being a second rule from the moment one of them is edited");
});

/* The flow named for having no screen kept the whole screen apparatus until ISS-1694: a run on it was
   asked what a person witnesses, told to park a change for human eyes, and given no branch at all for
   the independent judgement its own Phase 0 had it read. Watched failing by putting either half back. */
test("the default flow describes a project with no screen, and branches on who judges", () => {
  const body = servedBody("issue-flow", PLUGIN, DEFAULT);
  const phases = phasesOf(body);
  const held = flat(body);
  for (const [beat, phrase] of [
    ["what a run does where the judging is another run's", "this run stops short of judging"],
    ["the declaration that branch is read off", "an independent run's"],
    ["that the deployment is named by what it answers it is serving", "reading back what that deployment answers it is serving"],
    ["whose the record for a criterion out of reach is", "Which record carries that naming turns on who"],
  ]) {
    assert.ok(held.includes(phrase), `the ${DEFAULT} flow no longer names ${beat}, so a project that `
      + "declared an independent judgement is walked into a round of verdicts the rung refuses");
  }
  for (const [beat, phrase] of [
    ["the screen park", "parks the issue for human review"],
    ["the witnessed section", "## Witnessed on screen"],
    ["the credential a rendered state needs", "a login is what reaches one on a deployed host"],
    ["a screen change as a park", "A screen change is a park"],
  ]) {
    assert.ok(!held.includes(phrase), `the ${DEFAULT} flow still names ${beat}, and it serves the `
      + "projects that have no screen at all: what it asks for there, nobody can answer");
  }
  assert.ok(!/\bscreen\b/u.test(flat(phases["5"])), `Phase 5 of the ${DEFAULT} flow still mentions a `
    + "screen, which is the half of this phase that was written for the other flow");
  const naming = Object.keys(phases).filter((n) => /stops short of judging/u.test(phases[n]));
  assert.deepEqual(naming, ["5"], "and the phase where the judging happens is the only one that says "
    + "what replaces it, a second copy being a second rule from the moment one of them is edited");
});

/* The reference is the builder's, and the two sections above are a screen's: a CLI has no rendered
   state to reach and no login that reaches one, and the line saying so is the one that belongs. */
test("the default flow's verification reference keeps the skip and drops the rendered state", () => {
  const held = flat(readFileSync(join(PLUGIN, "guides", "skills", "issue-flow", DEFAULT, "references", "verification.md"), "utf8"));
  assert.ok(held.includes("A library has no deployment; a CLI has no screen"),
    `the ${DEFAULT} flow's verification reference no longer says which items a project skips, which `
      + "is the line written for a project with no screen and the one that stays");
  for (const [beat, phrase] of [
    ["the rendered-state row", "| A screen |"],
    ["the login fallback", "When no login reaches the rendered state"],
  ]) {
    assert.ok(!held.includes(phrase), `the ${DEFAULT} flow's verification reference still carries `
      + `${beat}, which asks a project with no screen for evidence it has no way to produce`);
  }
});
