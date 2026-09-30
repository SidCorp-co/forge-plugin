/* Whose backlog a filing is for has two answers once a call is aimed elsewhere — where it lands and
   which checkout it stands in — and the hold and the routing block must ask the same one. Read in
   this process, which stands in the plugin's own checkout, so aiming it elsewhere parts the two. */
import assert from "node:assert/strict";
import test from "node:test";

import { projectRecord, tempRoom } from "../fixtures.mjs";
import { OWN } from "../fixtures/own-project.mjs";

/* Both channels closed in the record this checkout resolves, set before any reader is loaded. */
process.env.XDG_CONFIG_HOME = tempRoom("channel-readings-");
projectRecord(process.cwd(), process.env.XDG_CONFIG_HOME,
  { ...OWN, feedback: { plugin: "off", project: "off" } });
const { aimsAtPlugin, pluginDefectHold, routingBlock, standsInPlugin } =
  await import("../../src/tracker/filing/plugin-defect.mjs");
const { useProject } = await import("../../src/resolve/settings.mjs");
const { channelRefusal, offeredVerbs, wrappedRefusal } = await import("../../src/resolve/visibility.mjs");
const { conditionsAt } = await import("../../src/guides/conditions.mjs");
const { render } = await import("../../src/guides/render.mjs");
const { withholdingLines } = await import("../../src/tools/services/doctor/jobs.mjs");

const ELSEWHERE = "somewhere-else";

const BODY = [
  "## What happened", "", "A gate refused a record it should have taken.", "",
  "## Why it happens", "", "`plugin/hooks/gates/learning.mjs` reads the cause too early.", "",
].join("\n");

/* Before the aim, then after it: each case below reads one of the two states, so the order is theirs. */
test("standing in the plugin's checkout, an unaimed call lands on the plugin's backlog and holds nothing", () => {
  assert.equal(standsInPlugin(), true, "the suite runs from this plugin's own checkout");
  assert.equal(aimsAtPlugin(), true, "and nothing has aimed it elsewhere yet");
  assert.match(routingBlock(), /this call files on the plugin's own backlog/u);
  assert.equal(pluginDefectHold(BODY), null, "a plugin defect filed on the plugin's backlog is held by nothing");
});

test("aimed at another project, the block and the hold both answer where the call lands", () => {
  useProject({ slug: ELSEWHERE, from: "this case" });
  assert.equal(standsInPlugin(), true, "the checkout has not moved");
  assert.equal(aimsAtPlugin(), false, "the filing has");
  const block = routingBlock();
  assert.doesNotMatch(block, /plugin's own (checkout|backlog)/u, block);
  assert.match(block, /is not this project's issue/u, "the block for a filing aimed away from the plugin");
  const held = pluginDefectHold(BODY);
  assert.ok(held, "the hold reads the same aim, so a plugin path aimed elsewhere is held");
  assert.match(held, new RegExp(`not an issue of ${ELSEWHERE}, where this call files`, "u"),
    "and says which of the two readings it answered");
});

test("the project channel closed takes `new` off the offered verbs and out of its raw route", () => {
  assert.equal(offeredVerbs().some((row) => row[0] === "new"), false, "no `new` row is offered");
  const typed = channelRefusal("new");
  assert.match(typed, /feedback\.project to off in /u, typed);
  assert.match(typed, /tracker's own screen/u, "naming where a person files one instead");
  const raw = wrappedRefusal("forge_issues", "create");
  assert.match(raw, /^Use `forge new` and not the raw call — `forge new` is withheld here: /u, raw);
  assert.match(raw, /feedback\.project to off/u, "the raw route is refused with the channel's own sentence");
  assert.equal(channelRefusal("issue"), null, "a verb whose row names no channel is closed by neither");
});

test("a fence on feedback.project resolves against the project's value", () => {
  const text = [
    "# One", "",
    "<!-- forge:when feedback.project off -->", "Kept under off.", "<!-- forge:end -->", "",
    "<!-- forge:when feedback.project bugs all -->", "Dropped under off.", "<!-- forge:end -->", "",
  ].join("\n");
  const shown = render(text, conditionsAt("feature"));
  assert.deepEqual(shown.problems, [], "the condition is known, so nothing is refused");
  assert.equal(shown.text.includes("Kept under off."), true, shown.text);
  assert.equal(shown.text.includes("Dropped under off."), false, shown.text);
});

test("doctor places `new` under closed, on a line that names no one channel's key for both", () => {
  const closed = withholdingLines().find((row) => row.label === "verbs closed");
  assert.ok(closed, "a closed row, both channels being off here");
  assert.match(closed.detail, /^new, feedback — /u, closed.detail);
  assert.doesNotMatch(closed.detail, /feedback\.plugin|feedback\.project/u,
    "one line for every closed verb, so it names the channel's row rather than one key");
});
