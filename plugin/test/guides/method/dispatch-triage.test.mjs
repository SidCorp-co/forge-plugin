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

const PLUGIN = new URL("../../../", import.meta.url).pathname;
const FLOWS = [DEFAULT, SCREEN];

const served = (flow, part) => {
  const answer = skillGuideAnswer("dispatch", PLUGIN, flow)({ part });
  assert.equal(answer.refusal, undefined, `\`${flow}\` refused the \`${part}\` part: ${answer.refusal}`);
  return answer.lines.join("\n");
};

/* One helper for every case below, so a phrase that moves fails once per flow with the flow named
   rather than in a diff of two whole methods. */
const carries = (part, phrases) => {
  for (const flow of FLOWS) {
    const said = served(flow, part);
    for (const [what, phrase] of phrases) {
      assert.ok(said.includes(phrase),
        `the \`${flow}\` flow's \`${part}\` part says nothing of ${what}: "${phrase}"`);
    }
  }
};

test("supersession is a disposition of its own, earned by what replaced the flow", () => {
  carries("dispositions", [
    ["the row itself", "| superseded |"],
    ["what earns it", "the release or the issue that replaced the flow, named"],
    ["the ask answered elsewhere", "this issue's own ask is answered there, differently"],
  ]);
});

test("supersession is separated from obsolete, and age earns neither", () => {
  carries("dispositions", [
    ["the two being one reading", "Superseded and obsolete are not one reading"],
    ["what obsolete is", "Obsolete is the subject gone"],
    ["what supersession is", "Superseded is the subject still standing"],
    ["age as an earner", "Age earns neither, and no other row either"],
    ["an old issue still true", "An old issue describing something still true is\nstill real"],
  ]);
});

/* The walk selects a survivor for two bodies naming one module and one mechanism. A cluster's
   members share exactly that and must not fold, so the two would give a dispatcher opposite
   instructions for one pair unless the walk says which question decides. */
test("the walk's fold turns on reports-or-symptoms, and the module decides nothing", () => {
  carries("dispositions", [
    ["what decides a fold", "whether the two are reports of one thing or symptoms of one cause"],
    ["the module deciding nothing", "the module they sit in\n   decides nothing either way"],
    ["reports folding wherever filed", "fold onto a survivor wherever they were\n   filed"],
    ["symptoms folding nowhere", "two distinct symptoms of one cause fold nowhere"],
    ["the same-module case", "however far inside one module and one\n   mechanism they both sit"],
  ]);
});

test("a reading the method does not have is filed rather than supplied by hand", () => {
  carries("dispositions", [
    ["the rule", "A reading this page cannot make is filed, and never supplied by hand"],
    ["what it costs otherwise", "costs whoever happened to be watching"],
  ]);
});

test("a surviving candidate carries where it sits, in three values earned by an act", () => {
  carries("2", [
    ["the reading", "A candidate that survives also carries a reading of where it sits"],
    ["the ordinary run", "Core, where the surface it"],
    ["the declared route", "edge, where it is met on a route the project itself\ndeclares or chooses"],
    ["the investigation", "peripheral, where no run reaches it unless somebody is investigating"],
    ["what earns it", "earned by naming the act that meets the issue, never by asserting a tier"],
  ]);
});

test("where two tiers fit, the higher is the reading", () => {
  carries("2", [
    ["the rule", "where two of\nthe three would both fit the higher one is the reading"],
    ["the configured surface", "is edge and not peripheral"],
    ["the unpopular option", "however rarely that configuration\nis chosen"],
  ]);
});

test("the reading is not the priority field", () => {
  carries("2", [
    ["the separation", "That reading is not the priority field"],
    ["what priority is", "Priority is what somebody wants done"],
    ["what conflating costs", "Conflating\nthem loses both readings"],
  ]);
});

test("a family of symptoms over one cause is a cluster whose members survive whole", () => {
  carries("2", [
    ["the cluster", "distinct symptoms of one cause, the reading is a cluster"],
    ["the relation", "related to one another on the tracker rather than only described together in one place"],
    ["what each keeps", "each keeps its own key, its own evidence and its own disposition"],
    ["why a fold loses", "a fold destroys the thing that would have proved it"],
    ["the cause naming no key", "one\nsentence that names no issue key"],
    ["a cause that is not one", "a cause that can only be described by listing its issues is not a\ncause"],
  ]);
});

test("a shared file is not a cause, and the proposal is triage's while the filing is not", () => {
  carries("2", [
    ["the neighbour rule", "Two issues sharing a file are neighbours, not a cluster"],
    ["what makes a cluster", "What makes a cluster is a shared cause"],
    ["the forced cluster", "it sends one change at two problems"],
    ["whose the proposal is", "this phase's to propose and the owner's to decide"],
    ["the filing withheld", "does not file\nthe grouping issue"],
  ]);
});

/* The readings this change leaves alone. A row whose bar moved, or a complexity redefined as
   anything but effort, would answer this issue's criteria and break the phase it sits in. */
test("the five standing dispositions and the complexity reading are untouched", () => {
  carries("dispositions", [
    ["already fixed", "| already fixed | the change that fixed it, named,"],
    ["duplicate", "| duplicate | the issue it duplicates, named,"],
    ["intended", "| intended | where the behaviour is decided on purpose"],
    ["obsolete", "| obsolete | what the issue was about, gone:"],
    ["premise false", "| premise false | the line of the body that is wrong,"],
    ["holding as the ordinary answer", "Anything else *holds*, and holding is the ordinary answer"],
  ]);
  carries("2", [
    ["the complexity field", "the tracker's `complexity` field is\nwhere"],
    ["what it is read from", "files the change would touch, whether a person sees the result, whether a rule changes"],
    ["no run on an unsized issue", "no run is dispatched on an issue holding none"],
  ]);
});
