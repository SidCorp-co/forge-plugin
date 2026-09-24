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

test("dispatch Phase 4 gives each run of a wave a scratch directory of its own, and says why", () => {
  for (const flow of FLOWS) {
    const said = served("dispatch", flow, "4");
    for (const [what, phrase] of [
      ["one directory per run where the wave holds more than one", "one scratch directory per run where the wave holds more than one"],
      ["the inherited id as the cause", "Every agent a session dispatches inherits that session's id"],
      ["the host's scratchpad as a directory keyed on it", "the host's own scratchpad among them, is the wave's and not the run's"],
      ["the route a project's own directory takes", "The brief prints a run's own directory as `TMPDIR` where the project mints one"],
      ["a wave of one", "A wave of one shares nothing and needs neither"],
      ["that a judging run writes files", "It still writes files — its captures"],
    ]) {
      assert.ok(said.includes(flat(phrase)), `dispatch Phase 4 under \`${flow}\` says nothing of ${what}: "${phrase}"`);
    }
    assert.ok(!said.includes("writes no file"),
      `dispatch Phase 4 under \`${flow}\` still says a judging run writes no file, which the judging reference contradicts`);
  }
});

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
