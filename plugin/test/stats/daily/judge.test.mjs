/* The page's reading over a stand-in call: what each stage is sent, what the checks drop and count,
   and what a stage left unset or failing leaves the next one. The content is the verb's own `--json`
   over a device made small, so every figure key asserted is one the gathered content really holds. */
import assert from "node:assert/strict";
import test from "node:test";

import { daily, daysAgo, device } from "./fixture-daily.mjs";
import { SECTIONS, readingInput } from "../../../src/stats/daily/reading/figures.mjs";
import { blockedBy, judgeDay } from "../../../src/stats/daily/reading/judge.mjs";
import { decisionsHtml, sectionHead } from "../../../src/stats/daily/page.mjs";

const held = device({ days: [daysAgo(1), daysAgo(1), daysAgo(2)] });
const content = JSON.parse(daily(held, "--day", daysAgo(1), "--json").stdout);
const GATEWAY = { values: { ANTHROPIC_BASE_URL: "http://stand-in", ANTHROPIC_AUTH_TOKEN: "sk-stand-in" }, problem: null };
const ALL = { roles: { explore: "cx/explorer", review: "cx/reviewer-max", judge: "cx/judge" }, from: "config.json" };

const valueAt = (key) => readingInput(content).sections.flatMap((one) => one.figures).find((one) => one.key === key)?.value;

/* Answers by the tool each call is forced through, and keeps every call for the case to read. */
const standIn = (answers) => {
  const calls = [];
  const call = async (spec) => {
    calls.push(spec);
    const answer = answers[spec.tool.name];
    if (answer instanceof Error) throw answer;
    return { input: typeof answer === "function" ? answer(spec) : answer, spent: { input: 100, output: 10 }, ms: 1 };
  };
  return { calls, call };
};

/* Per section: one candidate on a figure that section holds, one on a key nothing computed, and one
   over the length; the runs section's first stands on the day's median minutes. */
const firstKey = (spec) => (spec.data.section === "runs" ? "runs.headline.day.medianMinutes" : spec.data.figures[0].key);
const EXPLORED = (spec) => ({ candidates: [
  { figure: firstKey(spec), reading: "the day's runs took longer than the day before's", direction: "worse" },
  { figure: `${spec.data.section}.nonsense`, reading: "a figure nobody computed", direction: "worse" },
  { figure: firstKey(spec), reading: "x".repeat(201), direction: "steady" },
] });

const JUDGED = {
  sections: [{ section: "runs", verdict: "worse", why: "runs took longer" }, { section: "nowhere", verdict: "better", why: "?" }],
  decisions: [
    { action: "leave alone", what: "one day of longer runs is inside the trend", figure: "runs.headline.day.medianMinutes" },
    { action: "file", what: "file the slow phase", figure: "runs.headline.day.medianMinutes", command: "forge new" },
    { action: "raise", what: "raise ISS-99999", figure: "runs.headline.day.medianMinutes", command: "ISS-99999" },
    { action: "file", what: "cites nothing held", figure: "runs.madeUp", command: "forge new" },
    { action: "revert", what: "revert with no command", figure: "runs.headline.day.runs" },
    { action: "drop", what: "drop via a shell", figure: "runs.headline.day.runs", command: "rm -rf /" },
    { action: "leave alone", what: "second leave", figure: "runs.headline.day.runs" },
    { action: "leave alone", what: "third leave", figure: "runs.headline.day.runs" },
    { action: "leave alone", what: "fourth leave", figure: "runs.headline.day.runs" },
    { action: "leave alone", what: "fifth leave", figure: "runs.headline.day.runs" },
  ],
  nothing: false,
};

const REVIEW_KEEP_FIRST = { kept: [{ candidate: 1 }], dropped: [] };

test("every figure a stage is sent is keyed by its path in the gathered content, rows by name, and holds that value", () => {
  const input = readingInput(content);
  assert.deepEqual(input.sections.map((one) => one.id), SECTIONS.map((one) => one.id));
  const keys = input.sections.flatMap((one) => one.figures.map((figure) => figure.key));
  assert.equal(new Set(keys).size, keys.length, "no key names two figures");
  assert.ok(keys.includes("runs.phases[7 Ship].medianMinutes"), keys.join("\n"));
  assert.equal(valueAt("runs.headline.day.runs"), content.runs.headline.day.runs);
  assert.equal(valueAt("runs.phases[7 Ship].medianMinutes"), content.runs.phases.find((one) => one.name === "7 Ship").medianMinutes);
  assert.equal(valueAt("landings.headline.gateCalls"), content.landings.headline.gateCalls);
  assert.equal(valueAt(`runs.trend[${daysAgo(1)}].runs`), 2);
});

test("what a stage is sent carries no path, no credential and no text a transcript holds", () => {
  const sent = JSON.stringify(readingInput(content));
  assert.ok(content.opportunities.listed.length, "the fixture lists an opportunity, so its absence below is a finding");
  for (const one of content.opportunities.listed) assert.ok(!sent.includes(one.met), one.met);
  assert.ok(!sent.includes(held.room), "no path under the room this device lives in");
  assert.doesNotMatch(sent, /(?<![\w.~-])\/(?:home|tmp|run|Users)\//u);
});

test("each section is explored and reviewed once, and the judge is asked once for the page", async () => {
  const { calls, call } = standIn({ candidates: EXPLORED, review: REVIEW_KEEP_FIRST, judge: JUDGED });
  const judgement = await judgeDay(content, { roles: ALL, gateway: GATEWAY, call });
  const byModel = (model) => calls.filter((one) => one.model === model);
  assert.equal(byModel("cx/explorer").length, SECTIONS.length);
  assert.equal(byModel("cx/reviewer-max").length, SECTIONS.length);
  assert.equal(byModel("cx/judge").length, 1);
  assert.deepEqual(byModel("cx/explorer").map((one) => one.data.section).sort(), SECTIONS.map((one) => one.id).sort());
  assert.ok(judgement.judged);
  assert.deepEqual(judgement.cost.judge, { model: "cx/judge", calls: 1, failed: 0, input: 100, output: 10 });
  assert.equal(judgement.cost.explore.calls, SECTIONS.length);
});

test("a candidate or decision citing a figure the page does not hold, an issue key it does not name, or a command it does not know is dropped and counted", async () => {
  const { call } = standIn({ candidates: EXPLORED, review: REVIEW_KEEP_FIRST, judge: JUDGED });
  const judgement = await judgeDay(content, { roles: ALL, gateway: GATEWAY, call });
  const count = (stage, reason) => judgement.dropped.find((one) => one.stage === stage && one.reason.startsWith(reason))?.count ?? 0;
  assert.equal(count("explore", "cited a figure the section does not hold"), SECTIONS.length);
  assert.equal(count("explore", "said nothing, or more than 200"), SECTIONS.length);
  assert.equal(count("judge", "cited a figure the page does not hold"), 1);
  assert.equal(count("judge", "named an issue key the page does not name"), 1);
  assert.equal(count("judge", "named no command"), 1);
  assert.equal(count("judge", "named a command that is neither"), 1);
  assert.equal(count("judge", "named a section the page does not have"), 1);
  assert.equal(count("judge", "past the 5 decisions"), 1, "six pass the checks and the sixth is past the five");
  assert.equal(judgement.decisions.length, 5);
  const [first, second] = judgement.decisions;
  assert.deepEqual(first.figure, { key: "runs.headline.day.medianMinutes", said: "median minutes a run, the day",
    value: content.runs.headline.day.medianMinutes }, "the figure is the page's label and value, never the model's");
  assert.equal(first.command, null);
  assert.equal(second.command, "forge new");
  const html = decisionsHtml(judgement);
  assert.match(html, /^<section id="decisions"><h2>Decisions<\/h2>.*<\/section>$/su);
  assert.match(html, /reading\(s\) dropped before this page was written: .*at judge, cited a figure the page does not hold/u);
  assert.equal(sectionHead(judgement, "runs"), '<p class="verdict"><strong>worse</strong> — runs took longer</p>');
});

test("a candidate the review neither keeps nor drops with a reason is counted as dropped", async () => {
  const twoKept = (spec) => {
    const [first] = EXPLORED(spec).candidates;
    return { candidates: [first, { ...first, reading: "again" }] };
  };
  const { call } = standIn({ candidates: twoKept, review: { kept: [], dropped: [{ candidate: 1, why: "" }, { candidate: 2, why: "thin row" }] }, judge: JUDGED });
  const judgement = await judgeDay(content, { roles: ALL, gateway: GATEWAY, call });
  const count = (reason) => judgement.dropped.find((one) => one.stage === "review" && one.reason.startsWith(reason))?.count ?? 0;
  assert.equal(count("neither kept nor dropped"), SECTIONS.length, "the drop with no reason is no ruling");
  assert.equal(count("the figures it cites do not support it"), SECTIONS.length);
  assert.equal(judgement.sections.runs.rejected[0].why, "thin row");
});

test("a review that rewords a candidate past the length drops it rather than keeping the uncorrected claim", async () => {
  const { calls, call } = standIn({ candidates: EXPLORED, review: { kept: [{ candidate: 1, reading: "y".repeat(201) }], dropped: [] }, judge: JUDGED });
  const judgement = await judgeDay(content, { roles: ALL, gateway: GATEWAY, call });
  assert.equal(judgement.dropped.find((one) => one.stage === "review" && one.reason.startsWith("reworded it past 200"))?.count, SECTIONS.length);
  assert.deepEqual(judgement.sections.runs.findings, []);
  assert.deepEqual(calls.find((one) => one.model === "cx/judge").data.sections.find((one) => one.section === "runs").findings, []);
});

test("a judge that proposes nothing without saying there is nothing, or whose every proposal fails, is not read as nothing to decide", async () => {
  for (const judged of [{ sections: [], decisions: [], nothing: false }, {},
    { sections: [], decisions: [{ action: "file", what: "x", figure: "runs.madeUp", command: "forge new" }], nothing: true }]) {
    const { call } = standIn({ candidates: EXPLORED, review: REVIEW_KEEP_FIRST, judge: judged });
    const judgement = await judgeDay(content, { roles: ALL, gateway: GATEWAY, call });
    assert.equal(judgement.nothing, false, JSON.stringify(judged));
    assert.match(decisionsHtml(judgement), /No decision the judge proposed survived the checks\./u);
    assert.doesNotMatch(decisionsHtml(judgement), /Nothing to decide/u);
  }
});

test("a judge with nothing to decide leaves a block saying so", async () => {
  const { call } = standIn({ candidates: { candidates: [] }, review: REVIEW_KEEP_FIRST, judge: { sections: [], decisions: [], nothing: true } });
  const judgement = await judgeDay(content, { roles: ALL, gateway: GATEWAY, call });
  assert.ok(judgement.nothing);
  assert.match(decisionsHtml(judgement), /<p><strong>Nothing to decide\.<\/strong><\/p>/u);
});

test("with review unset the judge reads the candidates marked unreviewed, and the block names the stage and its key", async () => {
  const { calls, call } = standIn({ candidates: EXPLORED, judge: JUDGED });
  const judgement = await judgeDay(content, { roles: { roles: { explore: "cx/explorer", judge: "cx/judge" }, from: "config.json" }, gateway: GATEWAY, call });
  const sent = calls.find((one) => one.model === "cx/judge").data.sections.find((one) => one.section === "runs");
  assert.deepEqual(Object.keys(sent).sort(), ["section", "title", "unreviewed"]);
  assert.equal(sent.unreviewed[0].figure, "runs.headline.day.medianMinutes");
  assert.match(decisionsHtml(judgement), /The review stage was skipped: `reports\.roles\.review` in config\.json names no model\./u);
});

test("with explore unset the judge reads each section's figures", async () => {
  const { calls, call } = standIn({ judge: JUDGED });
  await judgeDay(content, { roles: { roles: { judge: "cx/judge" }, from: "config.json" }, gateway: GATEWAY, call });
  assert.equal(calls.length, 1);
  const sent = calls[0].data.sections.find((one) => one.section === "runs");
  assert.ok(sent.figures.some((one) => one.key === "runs.headline.day.runs"));
  assert.equal(sent.findings, undefined);
});

test("a judge that fails leaves no decisions and says why, and each section keeps what its stages found", async () => {
  const { call } = standIn({ candidates: EXPLORED, review: REVIEW_KEEP_FIRST, judge: new Error("gateway answered 503") });
  const judgement = await judgeDay(content, { roles: ALL, gateway: GATEWAY, call });
  assert.equal(judgement.judged, false);
  assert.equal(judgement.why, "the judge did not answer: gateway answered 503");
  assert.equal(judgement.cost.judge.failed, 1);
  assert.match(sectionHead(judgement, "runs"), /Reviewed findings, no judge having ruled/u);
});

test("no gateway, the variable standing codex down, a refused roles table, or no role at all stops every stage with one reason", () => {
  assert.match(blockedBy({ disabled: true, gateway: GATEWAY, roles: ALL }), /FORGE_CODEX_DISABLE=1/u);
  assert.match(blockedBy({ disabled: false, gateway: { problem: "no gateway endpoint" }, roles: ALL }), /no gateway endpoint/u);
  assert.equal(blockedBy({ disabled: false, gateway: GATEWAY, roles: { refused: "`reports.roles.x` is wrong" } }), "`reports.roles.x` is wrong");
  assert.match(blockedBy({ disabled: false, gateway: GATEWAY, roles: { roles: {}, from: "c.json" } }), /`reports\.roles` in c\.json names no model/u);
  assert.equal(blockedBy({ disabled: false, gateway: GATEWAY, roles: ALL }), null);
});
