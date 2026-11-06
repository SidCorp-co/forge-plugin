/* The dispositions section a wave takes an issue off by, and the triage role's own text. Read off the
   served answer rather than off the source, because what a project gets is what the renderer
   produces; and read at both flows, because a statement carried by one of them is two sections
   rather than one (ISS-2081). */
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

/* The served method reaches a dispatcher; a role dispatched to one issue reads its own file and may
   read nothing else, so the ownership, the ground and the route to the rest are pinned there as well
   (ISS-2131). The role file has no flow, so it is read directly rather than through a served answer. */
test("the triage role is told the priority is its own, and where the bands' rules are", () => {
  const text = flat(roleText("triage"));
  for (const [what, phrase] of [
    ["the write's owner", "The priority is yours on the same terms"],
    ["the ground", "it is a reading of what the issue costs this plugin rather than of what anyone wants done"],
    ["what the served part carries", "how far a defect with a way round it sits below one with none, and what reaches the top of the table"],
    ["the route to it", "is in that same served part"],
    ["neither band", "an issue you leave holding neither band is one you have not finished reading"],
  ]) {
    assert.ok(text.includes(flat(phrase)),
      `the triage role says nothing of ${what}: "${flat(phrase)}"`);
  }
});

/* The readings this change leaves alone, each asserted whole rather than by its opening: a row that
   quietly lost its evidence bar would pass a prefix and is exactly the regression this guards. */
test("the five standing dispositions keep their evidence bars whole", () => {
  carries("dispositions", [
    ["already fixed", "| already fixed | another change that fixed it, named, and the behaviour the issue"
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
