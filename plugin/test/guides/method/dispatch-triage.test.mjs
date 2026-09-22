/* The three readings the triage phase takes beyond a disposition — whether the ground moved under an
   issue, what it costs the workflow, and whether it belongs with others as one change. Read off the
   served answer rather than off the source, because what a project gets is what the renderer
   produces; and read at both flows, because a statement carried by one of them is two methods rather
   than one (ISS-2081). */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("dispatch-triage").path;
const { DEFAULT, SCREEN } = await import("../../../src/guides/flow.mjs");
const { skillGuideAnswer } = await import("../../../src/guides/skill-guides.mjs");
const { FINDINGS } = await import("../../../src/flow/machine.mjs");
const { roleText } = await import("../../../src/tools/roles.mjs");

const PLUGIN = new URL("../../../", import.meta.url).pathname;
const FLOWS = [DEFAULT, SCREEN];

/* Whitespace collapsed on both sides, so a rule that survives a reflow survives these cases too: a
   phrase pinned to its line breaks fails on a rewrap that changed nothing a reader acts on. */
const flat = (text) => String(text).replace(/\s+/gu, " ").trim();

const served = (flow, part) => {
  const answer = skillGuideAnswer("dispatch", PLUGIN, flow)({ part });
  assert.equal(answer.refusal, undefined, `\`${flow}\` refused the \`${part}\` part: ${answer.refusal}`);
  return flat(answer.lines.join("\n"));
};

/* One helper for every case below, so a phrase that moves fails once per flow with the flow named
   rather than in a diff of two whole methods. */
const carries = (part, phrases) => {
  for (const flow of FLOWS) {
    const said = served(flow, part);
    for (const [what, phrase] of phrases) {
      assert.ok(said.includes(flat(phrase)),
        `the \`${flow}\` flow's \`${part}\` part says nothing of ${what}: "${flat(phrase)}"`);
    }
  }
};

test("supersession is a disposition of its own, earned by what replaced the flow", () => {
  carries("dispositions", [
    ["the row itself", "| superseded | the release or the issue that replaced the flow, named"],
    ["the ask answered elsewhere", "this issue's own ask is answered there, differently"],
  ]);
});

test("supersession is separated from obsolete, and age earns neither", () => {
  carries("dispositions", [
    ["the two being one reading", "Superseded is not obsolete"],
    ["what obsolete is", "Obsolete is the subject gone"],
    ["what supersession is", "Superseded is the subject still standing"],
    ["age as an earner", "Age earns neither, nor any other row"],
    ["an old issue still true", "An old issue describing something still true is still real"],
  ]);
});

/* The walk selects a survivor for two bodies naming one module and one mechanism. A cluster's
   members share exactly that and must not fold, so the two would give a dispatcher opposite
   instructions for one pair unless the walk says which question decides. */
test("the walk's fold turns on reports-or-symptoms, and the module decides nothing", () => {
  carries("dispositions", [
    ["what decides a fold", "What decides a fold is reports-or-symptoms, never the module"],
    ["reports folding wherever filed", "two reports of one thing fold onto a survivor wherever they were filed"],
    ["symptoms folding nowhere", "two distinct symptoms of one cause fold nowhere"],
    ["the same-module case", "however far inside one module and one mechanism they sit"],
    ["where they go instead", "Those leave triage as the phase's cluster instead"],
  ]);
});

test("a reading the method does not have is filed rather than supplied by hand", () => {
  carries("dispositions", [
    ["the rule", "A reading this page cannot make is filed, never supplied by hand"],
    ["where it goes", "it goes on the backlog as a filing against the method"],
  ]);
});

test("a surviving candidate carries where it sits, in three values earned by an act", () => {
  carries("2", [
    ["the reading", "A candidate that survives also carries a reading of where it sits"],
    ["the ordinary run", "Core, where the surface it names is met by a run doing nothing unusual"],
    ["the declared route", "edge, where it is met on a route the project itself declares or chooses"],
    ["the investigation", "peripheral, where no run reaches it unless somebody is investigating"],
    ["what earns it", "earned by naming the act that meets the issue, never by asserting a tier"],
  ]);
});

test("where two tiers fit, the higher is the reading", () => {
  carries("2", [
    ["the rule", "where two would both fit the higher one is the reading"],
    ["the configured surface", "is edge, however rarely that configuration is chosen"],
  ]);
});

test("the priority is read from the reach rather than held apart from it", () => {
  carries("2", [
    ["the ground", "That reading is what the priority is read from"],
    ["what a priority is", "a reading of what the issue costs this plugin"],
    ["the bands still apart", "The two stay different bands"],
    ["the band that sits against the reach", "carries the reason it does or it carries nothing"],
  ]);
});

test("a defect with no way round it outranks one a run can detour", () => {
  carries("2", [
    ["the ordering", "A defect with no way round it outranks one with a workaround, at equal reach and equal size"],
    ["the detour written beside the band", "The detour is what earned the lower band, so it is written on the issue"],
  ]);
});

test("the top band names what reaches it, being the whole of the table's spread", () => {
  carries("2", [
    ["the threshold", "what reaches it is an issue that leaves a run no route to its outcome at all"],
    ["read by somebody who did not file it", "has to be able to see that in the body"],
  ]);
});

test("the priority is this phase's fourth write, and a reading leaving neither band is unfinished", () => {
  carries("2", [
    ["the write", "The priority goes with it, by the same reader and into the tracker's"],
    ["the count", "This phase's four writes — the confirmation, the candidate line, the complexity and the priority"],
    ["neither band", "A reading that leaves its issue holding neither band has not finished"],
    ["the issue nobody can read", "that inability is itself the finding"],
  ]);
});

/* The served method reaches a dispatcher; a role dispatched to one issue reads its own file and may
   read nothing else, so the ownership and the ground are pinned there as well (ISS-2131). */
test("the triage role is told the priority is its own, and where the bands' rules are", () => {
  const text = flat(roleText("triage"));
  for (const [what, phrase] of [
    ["the write's owner", "The priority is yours on the same terms"],
    ["the ground", "a reading of what the issue costs this plugin rather than of what anyone wants done"],
    ["the route to the rules", "is in that same served part"],
    ["neither band", "an issue you leave holding neither band is one you have not finished reading"],
  ]) {
    assert.ok(text.includes(flat(phrase)),
      `the triage role says nothing of ${what}: "${flat(phrase)}"`);
  }
});

test("a family of symptoms over one cause is a cluster whose members survive whole", () => {
  carries("2", [
    ["the cluster", "distinct symptoms of one cause, the reading is a cluster"],
    ["the relation", "members are related to one another on the tracker"],
    ["what each keeps", "each keeps its own key, its own evidence and its own disposition"],
    ["the cause naming no key", "The cause goes in one sentence naming no issue key"],
  ]);
});

test("a shared file is not a cause, and the proposal is triage's while the filing is not", () => {
  carries("2", [
    ["the neighbour rule", "Two issues sharing a file are neighbours, not a cluster"],
    ["what makes a cluster", "What makes one is a shared cause"],
    ["whose the proposal is", "this phase's to propose and the owner's to decide"],
    ["the filing withheld", "does not file the grouping issue"],
  ]);
});

/* The readings this change leaves alone, each asserted whole rather than by its opening: a row that
   quietly lost its evidence bar would pass a prefix and is exactly the regression this guards. */
test("the five standing dispositions keep their evidence bars whole", () => {
  carries("dispositions", [
    ["already fixed", "| already fixed | the change that fixed it, named, and the behaviour the issue"
      + " describes read at the current head |"],
    ["duplicate", "| duplicate | the issue it duplicates, named, and the reading that says they are one"
      + " thing rather than two that rhyme |"],
    ["intended", "| intended | where the behaviour is decided on purpose — a rule, a refusal, a"
      + " declared default — cited |"],
    ["obsolete", "| obsolete | what the issue was about, gone: the file, the verb, the surface it names |"],
    ["premise false", "| premise false | the line of the body that is wrong, and what the code says instead |"],
    ["holding as the ordinary answer", "Anything else *holds*, and holding is the ordinary answer"],
  ]);
});

test("the complexity reading is untouched, and stays what a rung is claimed from", () => {
  carries("2", [
    /* Whole, not by phrase: the sentence most easily lost is the one saying the field is the only
       place it goes, and a selective assertion passes without it. */
    ["the paragraph whole", "**A candidate that survives also carries a complexity, and the tracker's"
      + " `complexity` field is where.** Setting it is this phase's, because it is the same reading"
      + " triage has just done: `forge issue ISS-nn --set complexity=<value> --why <w>`, the why"
      + " naming what was read to judge it — the files the change would touch, whether a person sees"
      + " the result, whether a rule changes. Which value claims which rung, and what a rung then"
      + " buys, is the contract's. The write goes on the issue and nowhere else, so the brief carries"
      + " no rung and there is nothing for a run to find disagreeing with the field."],
    ["no run on an unsized issue", "no run is dispatched on an issue holding none"],
  ]);
});

/* The page's rows against the enum the write validates against, rather than by naming the values
   twice: a row added to the served table and not to `FINDINGS` reads as a disposition a triage may
   take and is refused at `forge record confirmation`, which is the one failure the text cannot
   show (ISS-2081). */
test("every disposition the page serves is a finding the confirmation accepts", () => {
  const rows = (flow) => served(flow, "dispositions")
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell) => /^[a-z]+(?: [a-z]+)?$/u.test(cell) && cell !== "Disposition" && cell !== "Earned by");
  for (const flow of FLOWS) {
    const found = rows(flow);
    assert.ok(found.length >= 6, `the \`${flow}\` flow's table parsed ${found.length} rows, not the six it serves`);
    for (const row of found) {
      assert.ok(FINDINGS.includes(row.replace(/ /gu, "-")),
        `the \`${flow}\` flow serves the disposition "${row}", which \`forge record confirmation --finding\``
        + ` refuses: FINDINGS holds ${FINDINGS.join(", ")}`);
    }
  }
});
