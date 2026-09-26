/* The page's reading over a stand-in call: what each stage is sent, what the checks drop and count,
   and what a stage left unset or failing leaves the next one. The content is the verb's own `--json`
   over a device made small, so every figure key asserted is one the gathered content really holds. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

import { daily, daysAgo, device } from "./fixture-daily.mjs";
import { SECTIONS, readingInput } from "../../../src/stats/daily/reading/figures.mjs";
import { blockedBy, judgeDay } from "../../../src/stats/daily/reading/judge.mjs";
import { decisionsHtml, sectionHead } from "../../../src/stats/daily/page/page.mjs";
import { decisionsSaid } from "../../../src/stats/daily/page/summary.mjs";

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

/* The plugin's backlog as the page's reading meets it: ISS-2424 open at medium, ISS-2425 closed,
   ISS-2426 unknown to it, and one open issue, ISS-777, that a runs finding and one filing match. */
const BACKLOG = {
  issue: (key) => ({ "ISS-2424": { status: "open", priority: "medium" }, "ISS-2425": { status: "closed", priority: "low" },
    "ISS-777": { status: "open", priority: "low" } })[key] ?? null,
  match: async (text) => (/took longer|Ship waits/u.test(text) ? { key: "ISS-777", title: "Ship waits on the landing" } : null),
};

const DAY_MINUTES = "runs.headline.day.medianMinutes";
const QUOTED = `O'Brien's "slow" $(phase) \`gate\``;

const JUDGED = {
  sections: [
    { section: "runs", verdict: "worse", why: "runs took longer", baseline: "runs.headline.week.medianMinutes" },
    { section: "landings", verdict: "better", why: "fewer passes", baseline: `landings.trend[${daysAgo(2)}].passes` },
    { section: "consults", verdict: "worse", why: "cites another section's baseline", baseline: "runs.headline.week.medianMinutes" },
    { section: "friction", verdict: "steady", why: "nothing moved" },
    { section: "nowhere", verdict: "better", why: "?" },
  ],
  decisions: [
    { action: "leave alone", what: "one day of longer runs is inside the trend", figure: DAY_MINUTES },
    { action: "revert", what: "revert the release", figure: DAY_MINUTES, command: "git revert" },
    { action: "raise", what: "raise one the page never named", figure: DAY_MINUTES, issue: "ISS-99999", priority: "high" },
    { action: "raise", what: "raise one the backlog does not hold", figure: DAY_MINUTES, issue: "ISS-2426", priority: "high" },
    { action: "raise", what: "raise a closed one", figure: DAY_MINUTES, issue: "ISS-2425", priority: "high" },
    { action: "raise", what: "raise to a word", figure: DAY_MINUTES, issue: "ISS-2424", priority: "urgent" },
    { action: "raise", what: "raise to where it stands", figure: DAY_MINUTES, issue: "ISS-2424", priority: "medium" },
    { action: "raise", what: "raise downwards", figure: DAY_MINUTES, issue: "ISS-2424", priority: "low" },
    { action: "file", what: "file with no title", figure: DAY_MINUTES, title: "", cause: "a cause", category: "bug" },
    { action: "file", what: "file as a feature", figure: DAY_MINUTES, title: "t", cause: "c", category: "feature" },
    { action: "file", what: "cites nothing held", figure: "runs.madeUp", title: "t", cause: "c", category: "bug" },
    { action: "raise", what: "the effort reading is owed sooner", figure: DAY_MINUTES, issue: "ISS-2424", priority: "high" },
    { action: "file", what: "file the slow phase", figure: DAY_MINUTES, title: QUOTED, cause: "the gate's wait rose", category: "enhancement" },
    { action: "file", what: "file what ISS-777 already holds", figure: DAY_MINUTES, title: "Ship waits less", cause: "landings queue", category: "bug" },
    { action: "raise", what: "raise the matched issue", figure: DAY_MINUTES, issue: "ISS-777", priority: "medium" },
    { action: "raise", what: "raise it further", figure: DAY_MINUTES, issue: "ISS-777", priority: "high" },
    { action: "raise", what: "a sixth that passes", figure: DAY_MINUTES, issue: "ISS-777", priority: "critical" },
  ],
  nothing: false,
};

/* What a POSIX shell hands `forge` for a composed command, each argument whole, and what it reads on stdin. */
const shellSplit = (command) => {
  const ran = spawnSync("sh", ["-c", `forge() { printf '%s\\0' "$@"; printf 'stdin:'; cat; }\n${command}`], { encoding: "utf8" });
  const [stdin, ...rest] = ran.stdout.split("stdin:").reverse();
  return { argv: rest.reverse().join("stdin:").split("\0").slice(0, -1), stdin };
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

const judgedWith = async (backlog = BACKLOG, answer = JUDGED) => {
  const { calls, call } = standIn({ candidates: EXPLORED, review: REVIEW_KEEP_FIRST, judge: answer });
  return { judgement: await judgeDay(content, { roles: ALL, gateway: GATEWAY, call, backlog }), calls };
};

const countOf = (judgement) => (stage, reason) => judgement.dropped.find((one) => one.stage === stage && one.reason.startsWith(reason))?.count ?? 0;

test("a candidate citing a figure the section does not hold, or saying too much, is dropped and counted", async () => {
  const { judgement } = await judgedWith();
  const count = countOf(judgement);
  assert.equal(count("explore", "cited a figure the section does not hold"), SECTIONS.length);
  assert.equal(count("explore", "said nothing, or more than 200"), SECTIONS.length);
});

test("an item with no action a command carries out, or a raise the backlog does not bear out, is dropped and counted", async () => {
  const { judgement } = await judgedWith();
  const count = countOf(judgement);
  assert.equal(count("judge", "named no action a command of this CLI carries out"), 2, "leave alone and revert");
  assert.equal(count("judge", "raised an issue key the page does not name"), 1);
  assert.equal(count("judge", "raised an issue whose status and priority the backlog did not give"), 1);
  assert.equal(count("judge", "raised an issue that is closed or dropped"), 1);
  assert.equal(count("judge", "raised to a priority the tracker does not take"), 1);
  assert.equal(count("judge", "raised to a priority no higher than the issue's own"), 2);
  assert.equal(count("judge", "filed with no title or cause"), 1);
  assert.equal(count("judge", "filed under no category of bug or enhancement"), 1);
  assert.equal(count("judge", "cited a figure the page does not hold"), 1);
  assert.equal(count("judge", "past the 5 decisions"), 1, "six pass the checks and the sixth is past the five");
  assert.match(decisionsHtml(judgement), /reading\(s\) dropped before this page was written: .*at judge, named no action a command of this CLI carries out/u);
});

test("a kept raise names its issue, the priority it stands at and the target, and carries the command that sets it", async () => {
  const { judgement } = await judgedWith();
  const [raise] = judgement.decisions;
  assert.deepEqual(raise.figure, { key: DAY_MINUTES, said: "median minutes a run, the day", value: content.runs.headline.day.medianMinutes },
    "the figure is the page's label and value, never the model's");
  assert.deepEqual([raise.action, raise.issue, raise.from, raise.to], ["raise", "ISS-2424", "medium", "high"]);
  assert.equal(raise.command, `forge issue ISS-2424 --set priority=high --why 'median minutes a run, the day: ${raise.figure.value}'`);
  assert.deepEqual(shellSplit(raise.command).argv, ["issue", "ISS-2424", "--set", "priority=high", "--why", `median minutes a run, the day: ${raise.figure.value}`]);
  assert.match(decisionsHtml(judgement), /<strong>raise<\/strong> — the effort reading is owed sooner ISS-2424 from medium to high\./u);
});

test("a filing no open issue matches carries its title, its cause and a forge new that takes that title whole, its body the reader's", async () => {
  const { judgement } = await judgedWith();
  const filing = judgement.decisions.find((one) => one.action === "file");
  assert.deepEqual([filing.title, filing.cause, filing.category], [QUOTED, "the gate's wait rose", "enhancement"]);
  assert.deepEqual(shellSplit(filing.command).argv, ["new", "-", "--title", QUOTED, "--category", "enhancement"],
    "a quote, a substitution and a backtick in the title reach forge as one argument");
  const html = decisionsHtml(judgement);
  assert.ok(html.includes("The body the command reads on stdin is yours to write, with the sections a enhancement asks for."), html);
  assert.ok(html.includes("Cause: the gate&#39;s wait rose."), html);
});

test("a filing an open issue already covers is kept as a comment on that issue, its text piped to forge comment", async () => {
  const { judgement } = await judgedWith();
  const comment = judgement.decisions.find((one) => one.action === "comment");
  assert.equal(comment.issue, "ISS-777");
  const ran = shellSplit(comment.command);
  assert.deepEqual(ran.argv, ["comment", "ISS-777", "-"]);
  assert.equal(ran.stdin, "Ship waits less: landings queue\n");
  assert.ok(decisionsSaid(judgement).some((line) => line.includes("ISS-777 is open and matches this filing, so it goes there as a comment.")));
});

test("with no backlog to ask, a filing is kept saying no open issue was checked, and no raise can be borne out", async () => {
  const { judgement } = await judgedWith({ refused: "no Forge endpoint is saved on this machine" });
  assert.equal(judgement.decisions.filter((one) => one.action === "raise").length, 0);
  assert.equal(countOf(judgement)("judge", "raised an issue whose status and priority the backlog did not give"), 6);
  const [filing] = judgement.decisions.filter((one) => one.action === "file");
  assert.equal(filing.unchecked, "no Forge endpoint is saved on this machine");
  assert.match(decisionsHtml(judgement), /No open issue was checked for it: no Forge endpoint is saved on this machine\./u);
});

test("the judge is sent each offered issue's status and priority, and each finding's matching open issue", async () => {
  const { calls } = await judgedWith();
  const sent = calls.find((one) => one.model === "cx/judge").data;
  const issue = (key) => sent.issues.find((one) => one.key === key);
  assert.deepEqual([issue("ISS-2424").status, issue("ISS-2424").priority], ["open", "medium"]);
  assert.deepEqual([issue("ISS-2426").status, issue("ISS-2426").priority], [null, null]);
  assert.deepEqual(issue("ISS-777"), { key: "ISS-777", title: "Ship waits on the landing", where: "the open issue matching a finding of Runs",
    status: "open", priority: "low" });
  assert.equal(sent.sections.find((one) => one.section === "runs").findings[0].open, "ISS-777");
});

test("better or worse stands only beside a baseline figure of its own section, which a trend's earlier day is not", async () => {
  const { judgement } = await judgedWith();
  assert.equal(countOf(judgement)("judge", "gave better or worse citing no baseline figure of its section"), 2);
  assert.equal(countOf(judgement)("judge", "named a section the page does not have"), 1);
  const runs = judgement.sections.runs;
  assert.deepEqual([runs.verdict, runs.baseline.key], ["worse", "runs.headline.week.medianMinutes"]);
  assert.equal(sectionHead(judgement, "runs"), '<p class="verdict"><strong>worse</strong> — runs took longer <span class="note">(against '
    + `<span class="figure" title="runs.headline.week.medianMinutes">${runs.baseline.said}: ${runs.baseline.value}</span>)</span></p>`);
  assert.equal(judgement.sections.landings.verdict, undefined);
  assert.equal(judgement.sections.landings.verdictDropped, "better");
  assert.match(sectionHead(judgement, "landings"), /^<p class="note">No verdict: the judge's better was dropped, citing no baseline figure of this section\.<\/p>/u);
  assert.doesNotMatch(sectionHead(judgement, "landings"), /no judge having ruled/u);
  assert.equal(judgement.sections.friction.verdict, "steady", "steady claims no movement and owes no baseline");
});

test("the terminal's Decisions lines carry each kept decision's command", async () => {
  const { judgement } = await judgedWith();
  const lines = decisionsSaid(judgement);
  for (const one of judgement.decisions) assert.ok(lines.some((line) => line.endsWith(` — ${one.command}`)), one.command);
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
