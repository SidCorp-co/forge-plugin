/* The page and its parts: the scorecard above the decisions, the drill-downs closed below them, the
   charts, the footer of what could not be read, the sort a header click performs, what the page may
   load, and the ranking of what the rounds went on. Each over content made by hand, so a figure
   asserted is one the case chose. */
import assert from "node:assert/strict";
import test from "node:test";

import { FRICTION_SHOWN, SORT_SCRIPT, pageOf } from "../../../src/stats/daily/page/page.mjs";
import { indexLineOf } from "../../../src/stats/daily/page/summary.mjs";
import { METRICS } from "../../../src/stats/daily/scorecard.mjs";
import { LISTED, backlogMatcher, opportunitiesOf } from "../../../src/stats/daily/opportunities.mjs";
import { sidesOf } from "../../../src/stats/daily/releases.mjs";
import { MISSING } from "../../../src/stats/daily/gather.mjs";
import { runFrom } from "../../../src/stats/runs.mjs";
import { runOn } from "./fixture-daily.mjs";

const DAY = "2026-09-20";
const DAYS = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", DAY];
const figure = (runs, medianMinutes, medianCalls) => ({ runs, medianMinutes, medianCalls });
const row = (name, runs) => ({ name, ...figure(runs, 20, 40), thin: runs < 10 ? "thin" : null });

const friction = (extra = {}) => ({ refusals: [], refusalCauses: [], errors: [], answers: [], repeats: [], waits: [], guideParts: [], ...extra });

/* One tile per metric the table declares, each moved the way the case needs: wasted calls worse,
   consults better, and each metric with no reader greyed. */
const tileFor = (metric, value, baseline, change, verdict) => ({ metric: metric.id, label: metric.label, unit: metric.unit,
  better: metric.better, goal: metric.goal, value, detail: null, baseline, baselineDays: baseline === null ? 0 : 7, change, verdict,
  missing: metric.of ? null : metric.missing });
const SCORECARD = METRICS.map((metric) => {
  if (metric.id === "wasted") return tileFor(metric, 12.5, 10, 2.5, "worse");
  if (metric.id === "atBudget") return tileFor(metric, 20, 25, -5, "better");
  return tileFor(metric, null, null, null, null);
});

const content = (extra = {}) => ({
  day: DAY, zone: "UTC", written: "2026-09-21T06:00:00.000Z", trendDays: DAYS,
  projects: [{ name: "alpha", slug: "alpha", checkout: "/work/alpha" }], unread: [],
  runs: {
    headline: { day: figure(12, 20, 40), before: figure(9, 25, 44), week: { runs: 10, medianMinutes: 22, medianCalls: 41, days: 7 } },
    trend: DAYS.map((day, index) => ({ day, ...figure(index + 5, 20 + index, 40) })),
    projects: [row("alpha", 12), row("idle", 0)], phases: [row("4 Implement", 12), row("7 Ship", 3)],
    rungs: [row("fix", 4), row("unknown", 8)], models: [row("claude-opus-5", 12), row("claude-none", 0)], effort: MISSING.effort,
    phaseShares: [{ name: "4 Implement", minutes: 180, share: 75, baseline: 70, change: 5 },
      { name: "7 Ship", minutes: 60, share: 25, baseline: 30, change: -5 }],
  },
  landings: { headline: { passes: 5, resumed: 1, outsideRuns: 4, rejectedRuns: 0, gateCalls: 7, gateMinutes: 31.5 },
    trend: DAYS.map((day) => ({ day, passes: 3 })), missing: [MISSING.firstGate, MISSING.causes, MISSING.gateLost] },
  consults: { headline: { answered: 8, atBudget: 2, budgeted: 8, incomplete: 1, retried: 0 },
    trend: DAYS.map((day) => ({ day, answered: 4 })),
    groups: [{ model: "cx/a", prompt: "v3 abc", consults: 8, findings: 12, ruled: 10, kept: 70, how: 5, rightAboutHow: 80, thin: "thin" }],
    missing: [MISSING.transport] },
  friction: { headline: { refusals: 4, runs: 12 }, trend: DAYS.map((day) => ({ day, refusals: 4 })),
    refusals: [{ key: "Hold — a rule", calls: 4, runs: 3 }], errors: [], answers: [], repeats: [], waits: [], guideParts: [], standDowns: [] },
  releases: { landed: [{ version: "3.9.1", head: "abcdef1234", at: Date.parse(`${DAY}T12:00:00Z`), scope: "forge-plugin",
    issues: [{ key: "ISS-7", title: "A title", note: "What a user now sees." }],
    before: figure(3, 10, 20), after: figure(2, 11, 21), early: true }], installed: [], trend: [0, 0, 0, 0, 0, 0, 1] },
  opportunities: { listed: [{ kind: "refusal", met: "Hold — a rule", runs: 3, calls: 4, minutes: null,
    match: { key: "ISS-9", title: "The rule is too eager" }, unmatched: null }], unlisted: 0, evaluator: "forge stats eval" },
  moved: { phases: { rose: { row: "7 Ship", before: 5, now: 9, by: 4, runsBefore: 20, runsNow: 3 }, fell: null },
    rungs: { rose: null, fell: null } },
  followed: { version: "3.9.1", at: Date.parse(`${DAY}T12:00:00Z`), kind: "release" },
  scorecard: SCORECARD,
  ...extra,
});

const tileHtml = (page, id) => {
  const from = page.indexOf(`id="tile-${id}"`);
  return page.slice(from, page.indexOf('<div class="tile', from + 1) === -1 ? page.indexOf("</section>", from) : page.indexOf('<div class="tile', from + 1));
};

const JUDGED = { judged: true, at: "2026-09-21T06:00:00Z", why: null, stages: {}, dropped: [], cost: {},
  decisions: [{ action: "raise", what: "the rule costs calls", figure: { key: "friction.headline.refusals", said: "refused calls, the day", value: 4 },
    command: "ISS-9" }],
  sections: { friction: { title: "Friction", verdict: "worse", why: "more refusals", notes: [], findings: [],
    input: "findings" } } };

test("the scorecard stands above the Decisions, which stand above every drill-down", () => {
  const page = pageOf(content({ judgement: JUDGED }));
  const scorecard = page.indexOf('<section id="scorecard">');
  assert.ok(scorecard > 0 && scorecard < page.indexOf('<section id="decisions">'), "the scorecard first");
  assert.ok(page.indexOf('<section id="decisions">') < page.indexOf("<details"), "the decisions before any drill-down");
});

test("the scorecard holds one tile per metric the table declares, in its order", () => {
  const page = pageOf(content());
  const ids = [...page.matchAll(/<div class="tile[^"]*" id="tile-([^"]+)">/gu)].map((one) => one[1]);
  assert.deepEqual(ids, ["closed", "minutesPerClosed", "firstGate", "ownerWait", "wasted", "atBudget"]);
  assert.deepEqual(METRICS.map((one) => one.label), ["issues closed", "agent minutes per closed issue",
    "landings that passed their first gate", "owner wait minutes", "wasted calls, of all calls", "consults that ended at their call budget"]);
});

test("a computed tile shows its value, its baseline, its change and its goal, worse in red with the arrow the way it moved", () => {
  const tile = tileHtml(pageOf(content()), "wasted");
  assert.ok(tile.startsWith('id="tile-wasted"'), tile);
  assert.ok(tile.includes('<div class="value">12.5%</div>'), tile);
  assert.ok(tile.includes('<div class="baseline">seven days before: 10%</div>'), tile);
  assert.ok(tile.includes('<div class="move"><span class="arrow" aria-hidden="true">▲</span> +2.5 pt, worse</div>'), tile);
  assert.ok(tile.includes('<span class="goal">G-11, lower is better</span>'), tile);
  const page = pageOf(content());
  assert.ok(page.includes('<div class="tile worse" id="tile-wasted">'), "the colour class repeats the word");
  assert.match(page, /\.tile\.worse \.move\{color:#b42318\}/u);
});

test("a tile that fell the way its metric declares better reads better, in green with a downward arrow", () => {
  const page = pageOf(content());
  assert.ok(page.includes('<div class="tile better" id="tile-atBudget">'));
  assert.ok(tileHtml(page, "atBudget").includes('<span class="arrow" aria-hidden="true">▼</span> -5 pt, better'));
  assert.match(page, /\.tile\.better \.move\{color:#1a7f37\}/u);
});

test("a tile with no change reads steady, and one with no baseline or no value says which and judges nothing", () => {
  const [wasted] = METRICS.filter((one) => one.id === "wasted");
  const steady = pageOf(content({ scorecard: [tileFor(wasted, 10, 10, 0, "steady")] }));
  assert.ok(steady.includes('<div class="tile steady" id="tile-wasted">'));
  assert.ok(steady.includes('<span class="arrow" aria-hidden="true">=</span> 0 pt, steady'), steady);
  const unbased = pageOf(content({ scorecard: [tileFor(wasted, 10, null, null, null)] }));
  assert.ok(unbased.includes('<div class="tile" id="tile-wasted">'));
  assert.ok(unbased.includes("no baseline: the seven days before hold none"));
  const valueless = pageOf(content({ scorecard: [tileFor(wasted, null, 10, null, null)] }));
  assert.ok(valueless.includes("none on this day"));
  assert.doesNotMatch(unbased + valueless, /class="tile (better|worse)"/u);
});

test("a metric no reader computes is a greyed tile naming the issue that owes its reader", () => {
  const page = pageOf(content());
  for (const [id, issue] of [["closed", "ISS-2599"], ["minutesPerClosed", "ISS-2599"], ["firstGate", "ISS-2425"], ["ownerWait", "ISS-2600"]]) {
    assert.ok(page.includes(`<div class="tile greyed" id="tile-${id}">`), id);
    assert.ok(tileHtml(page, id).includes(`<div class="move">${issue} owes its reader</div>`), id);
  }
  assert.doesNotMatch(page, /missing: /u, "no red missing line in the body");
});

test("a decision names and links the tile its figure's section answers to, and shows its figure by label and value", () => {
  const page = pageOf(content({ judgement: JUDGED }));
  assert.ok(page.includes('<span class="figure" title="friction.headline.refusals">refused calls, the day: 4</span>. '
    + 'Tile: <a href="#tile-wasted">wasted calls, of all calls</a>.'), page);
  assert.doesNotMatch(page.slice(0, page.indexOf("<script")), />[^<]*friction\.headline\.refusals/u, "the key is only a hover");
});

test("every drill-down is closed when the page opens, and carries its section's line", () => {
  const page = pageOf(content({ judgement: JUDGED }));
  for (const id of ["phases", "runs", "landings", "consults", "friction", "releases"]) {
    assert.ok(page.includes(`<details id="${id}"><summary>`), id);
  }
  assert.doesNotMatch(page, /<details[^>]*\bopen\b/u);
  assert.match(page, /<details id="friction"><summary>.*?<\/summary><p class="verdict"><strong>worse<\/strong> — more refusals<\/p>/u);
});

test("the phases are bars of their share of the day's run minutes, each with its change against the seven days before", () => {
  const page = pageOf(content());
  assert.ok(page.includes('<li><span class="bar-name">4 Implement</span><span class="bar"><span style="width:75%"></span></span>'
    + '<span class="bar-said">75% of run minutes, against 70%, +5 pt</span></li>'), page);
  assert.ok(page.includes("25% of run minutes, against 30%, -5 pt"));
  assert.ok(page.includes("each phase's share of the day's run minutes, against the seven days before"));
});

test("the runs drill-down lists only rows that had runs, and no row for the unknown rung", () => {
  const page = pageOf(content());
  const runs = page.slice(page.indexOf('<details id="runs">'), page.indexOf("</details>", page.indexOf('<details id="runs">')));
  assert.ok(runs.includes("<td>alpha</td>") && runs.includes("<td>claude-opus-5</td>") && runs.includes("<td>fix</td>"), runs);
  for (const idle of ["<td>idle</td>", "<td>claude-none</td>", "<td>unknown</td>"]) assert.ok(!runs.includes(idle), idle);
});

test("the friction drill-down lists the top five by calls lost, each with the issue matching it or the words for none", () => {
  const listed = Array.from({ length: 7 }, (_, index) => ({ kind: "refusal", met: `rule ${index}`, runs: 1, calls: 10 - index, minutes: null,
    match: index === 0 ? { key: "ISS-9", title: "The rule" } : null, unmatched: null }));
  const page = pageOf(content({ opportunities: { listed, unlisted: 3, evaluator: "forge stats eval" } }));
  const friction = page.slice(page.indexOf('<details id="friction">'), page.indexOf("</details>", page.indexOf('<details id="friction">')));
  assert.equal(FRICTION_SHOWN, 5);
  assert.equal((friction.match(/<tr><td>\d<\/td>/gu) ?? []).length, 5);
  assert.ok(friction.includes("<th scope=\"col\" title=\"sort by calls lost\">calls lost</th>"));
  assert.ok(friction.includes("ISS-9 — The rule") && friction.includes("matches no open issue: no filing yet"));
  assert.ok(!friction.includes("rule 5"), friction);
  assert.ok(friction.includes("<p>2 more listed in <code>--json</code>; 3 more ranked below those and counted, never listed.</p>"), friction);
  const five = pageOf(content({ opportunities: { listed: listed.slice(0, 5), unlisted: 0, evaluator: "forge stats eval" } }));
  assert.ok(!five.includes("more listed in") && !five.includes("counted, never listed"), "nothing beyond the five is said to exist");
});

test("the releases are one line with their count, expanding to one line per release", () => {
  const page = pageOf(content());
  assert.ok(page.includes('<details id="releases"><summary><h2>Harness implementation</h2><span class="note">1 release(s) written and 0 cop(ies) installed</span></summary>'));
  assert.ok(page.includes('<ul class="releases"><li>3.9.1 at 2026-09-20 12:00Z: ISS-7 A title</li></ul>'), page);
});

test("the footer names the runs on no known rung, the projects with no runs, and every reader not built", () => {
  const page = pageOf(content());
  const footer = page.slice(page.indexOf("<footer>"), page.indexOf("</footer>"));
  assert.ok(footer.includes("8 of the day&#39;s 12 run(s) claimed no rung this reading could establish."), footer);
  assert.ok(footer.includes("No run on this day in: idle."));
  for (const issue of ["ISS-2424", "ISS-2425", "ISS-2426", "ISS-2599", "ISS-2600"]) assert.ok(footer.includes(`owed by ${issue}.`), issue);
});

test("every chart names its axis, labels its scale and its days, spans the column, and repeats no value as text", () => {
  const page = pageOf(content());
  const charts = [...page.matchAll(/<figure class="chart">([\s\S]*?)<\/figure>/gu)].map((one) => one[1]);
  assert.equal(charts.length, 5);
  for (const chart of charts) {
    assert.match(chart, /<text class="axis"[^>]*>[a-z]+<\/text>/u);
    assert.match(chart, /<text class="scale"[^>]*text-anchor="end">0<\/text>/u);
    for (const day of DAYS) assert.ok(chart.includes(`>${day.slice(5)}</text>`), day);
    assert.match(chart, /<figcaption>[A-Z][A-Za-z -]+<\/figcaption>/u, "the caption names the chart and holds no value");
    assert.doesNotMatch(chart, /width="\d/u, "no fixed width: it takes the column's");
  }
  assert.match(page, /\.chart svg\{width:100%/u);
  assert.doesNotMatch(page, /<figcaption>[^<]*\d{2}-\d{2} \d/u, "no caption lists the values");
});

test("the index line names the phase that moved most and the release it followed", () => {
  const line = indexLineOf(content());
  assert.ok(line.includes("rose most was 7 Ship") && line.includes("release 3.9.1"), line);
});

test("the page loads nothing from the network", () => {
  const page = pageOf(content());
  assert.doesNotMatch(page, /(?:src|href)\s*=\s*["']?\s*https?:|url\(\s*["']?\s*https?:/iu);
  assert.doesNotMatch(page, /<link\b|<script\s+src/iu);
});

/* The inline script over a table of stand-ins: rows with cells, a body that re-appends. */
const fakeTable = (values) => {
  const body = { rows: values.map((one) => ({ cells: [{ dataset: {}, textContent: String(one) }] })) };
  body.appendChild = (row) => {
    body.rows = [...body.rows.filter((one) => one !== row), row];
  };
  const header = { cellIndex: 0, dataset: {}, handlers: [] };
  header.closest = () => ({ tBodies: [body] });
  header.addEventListener = (kind, handler) => header.handlers.push(handler);
  return { body, header };
};

test("a header click sorts its table by that column, numbers as numbers, and a second click reverses it", () => {
  const { body, header } = fakeTable([10, 9, 100]);
  const document = { querySelectorAll: () => [header] };
  new Function("document", SORT_SCRIPT)(document);
  header.handlers[0]();
  assert.deepEqual(body.rows.map((one) => one.cells[0].textContent), ["9", "10", "100"]);
  header.handlers[0]();
  assert.deepEqual(body.rows.map((one) => one.cells[0].textContent), ["100", "10", "9"]);
});

test("a release is read beside the runs either side only where each side holds ten", () => {
  const runs = (on, many) => Array.from({ length: many }, (_, index) => runFrom(`/r/${on}-${index}`, `s-${on}-${index}`, runOn(on)));
  const at = Date.parse("2026-09-10T12:00:00Z");
  const read = sidesOf([...runs("2026-09-10", 10), ...runs("2026-09-11", 10)], at);
  assert.equal(read.early, false);
  assert.deepEqual([read.before.runs, read.after.runs, read.before.medianMinutes, read.after.medianCalls], [10, 10, 41.7, 16]);
  const few = sidesOf([...runs("2026-09-10", 10), ...runs("2026-09-11", 9)], at);
  assert.equal(few.early, true);
});

const entry = (index) => ({ key: `Hold — rule ${index}`, met: `Hold — rule ${index}`, gate: null, calls: 20 - index, runs: 1 });

test("opportunities rank by calls paid, list ten, count the rest, and name the open issue each matches or say none", async () => {
  const held = friction({ refusalCauses: Array.from({ length: 12 }, (_, index) => entry(index)) });
  const matcher = { match: async (text) => {
    if (text.includes("rule 2")) throw new Error("the semantic query could not run: 503");
    return text.includes("rule 0") ? { key: "ISS-9", title: "The rule" } : null;
  } };
  const found = await opportunitiesOf(held, matcher);
  assert.equal(found.listed.length, LISTED);
  assert.equal(found.unlisted, 2);
  assert.deepEqual(found.listed.map((one) => one.calls), [20, 19, 18, 17, 16, 15, 14, 13, 12, 11]);
  assert.deepEqual(found.listed[0].match, { key: "ISS-9", title: "The rule" });
  assert.equal(found.listed[1].match, null);
  assert.equal(found.listed[1].unmatched, null);
  assert.deepEqual([found.listed[2].match, found.listed[2].unmatched], [null, "the semantic query could not run: 503"]);
  const page = pageOf(content({ opportunities: found }));
  assert.ok(page.includes("ISS-9 — The rule"));
  assert.ok(page.includes("matches no open issue: no filing yet"));
  assert.ok(page.includes("not matched: the semantic query could not run: 503"));
  assert.ok(page.includes("proposes no change") && page.includes("<code>forge stats eval</code>"));
});

test("a backlog read short, or a search that could not run, is said as not matched and never as matching none", async () => {
  const registered = [{ name: "forge-plugin", slug: "forge-plugin" }];
  const held = () => true;
  const near = async () => ({ suggestions: [], notes: [] });
  const short = await backlogMatcher(registered, { held, near, read: async () => ({ rows: [], whole: false, pages: 1 }) });
  assert.match(short.refused, /the plugin's open backlog reached 0 issue\(s\) over 1 page\(s\) and the reading is incomplete/u);
  const found = await opportunitiesOf(friction({ refusalCauses: [entry(0)] }), short);
  assert.deepEqual([found.listed[0].match, found.listed[0].unmatched], [null, short.refused]);
  const whole = await backlogMatcher(registered, { held, read: async () => ({ rows: [], whole: true, pages: 1 }),
    near: async () => ({ suggestions: [], notes: ["the semantic query could not run: 503"] }) });
  await assert.rejects(() => whole.match("x"), /could not run: 503/u);
  const none = await backlogMatcher(registered, { held, near, read: async () => ({ rows: [], whole: true, pages: 1 }) });
  assert.equal(await none.match("x"), null);
});
