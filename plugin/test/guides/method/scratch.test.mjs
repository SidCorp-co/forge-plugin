/* Where a dispatched run writes its own files, read off the served answer at both flows: every agent
   of a wave inherits one session id, so a directory keyed on it is the wave's, and two runs that
   were each told to use "their own scratch" wrote one plan between them (ISS-1344). Each phrase was
   watched failing by taking its sentence back out of the part under the flow it names. */
import assert from "node:assert/strict";
import test from "node:test";

import { flat, tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("method-scratch").path;
const { DEFAULT, SCREEN } = await import("../../../src/guides/flow.mjs");
const { skillGuideAnswer } = await import("../../../src/guides/skill-guides.mjs");

const PLUGIN = new URL("../../../", import.meta.url).pathname;
const FLOWS = [DEFAULT, SCREEN];

const served = (slug, flow, part) => {
  const answer = skillGuideAnswer(slug, PLUGIN, flow)({ part });
  assert.equal(answer.refusal, undefined, `\`${slug}\` under \`${flow}\` refused \`${part}\`: ${answer.refusal}`);
  return flat(answer.lines.join("\n"));
};

test("the judging reference sends captures to a directory the run makes where it was handed none", () => {
  for (const flow of FLOWS) {
    const said = served("qa", flow, "judging");
    for (const [what, phrase] of [
      ["a directory the run makes", "a directory you make for yourself in the system's temporary one"],
      ["why the inherited one is not that", "A directory keyed on the session id you inherited is the whole wave's"],
    ]) {
      assert.ok(said.includes(flat(phrase)), `the judging reference under \`${flow}\` says nothing of ${what}: "${phrase}"`);
    }
  }
});

test("the briefs section gives a judge of a wave a directory of its own, and names where the brief prints one", () => {
  for (const flow of FLOWS) {
    const said = served("dispatch", flow, "briefs");
    assert.ok(said.includes("in a wave of more than one they go to a directory of its own"),
      `${flow}: a judge of a wave is not told its captures need a directory of their own`);
    assert.ok(said.includes("The brief prints a run's own directory as `TMPDIR`"),
      `${flow}: nothing says where the brief hands a run its directory`);
  }
});
