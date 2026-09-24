/* The page and its parts: the summary's sentences and what they name, the trend beside each
   headline, the sort a header click performs, what the page may load, and the ranking of what the
   rounds went on. Each over content made by hand, so a figure asserted is one the case chose. */
import assert from "node:assert/strict";
import test from "node:test";

import { SORT_SCRIPT, pageOf } from "../../../src/stats/daily/page.mjs";
import { indexLineOf, summaryOf } from "../../../src/stats/daily/summary.mjs";
import { LISTED, opportunitiesOf } from "../../../src/stats/daily/opportunities.mjs";
import { sidesOf } from "../../../src/stats/daily/releases.mjs";
import { MISSING } from "../../../src/stats/daily/gather.mjs";
import { runFrom } from "../../../src/stats/runs.mjs";
import { runOn } from "./fixture-daily.mjs";

const DAY = "2026-09-20";
const DAYS = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", DAY];
const figure = (runs, medianMinutes, medianCalls) => ({ runs, medianMinutes, medianCalls });
const row = (name, runs) => ({ name, ...figure(runs, 20, 40), thin: runs < 10 ? "thin" : null });

const friction = (extra = {}) => ({ refusals: [], errors: [], repeats: [], waits: [], guideParts: [], ...extra });

const content = (extra = {}) => ({
  day: DAY, zone: "UTC", written: "2026-09-21T06:00:00.000Z", trendDays: DAYS,
  projects: [{ name: "alpha", slug: "alpha", checkout: "/work/alpha" }], unread: [],
  runs: {
    headline: { day: figure(12, 20, 40), before: figure(9, 25, 44), week: { runs: 10, medianMinutes: 22, medianCalls: 41, days: 7 } },
    trend: DAYS.map((day, index) => ({ day, ...figure(index + 5, 20 + index, 40) })),
    projects: [row("alpha", 12)], phases: [row("4 Implement", 12), row("7 Ship", 3)], rungs: [row("fix", 12)],
    models: [row("claude-opus-5", 12)], effort: MISSING.effort,
  },
  landings: { headline: { passes: 5, resumed: 1, rejectedRuns: 0, gateCalls: 7, gateMinutes: 31.5 },
    trend: DAYS.map((day) => ({ day, passes: 3 })), missing: [MISSING.firstGate, MISSING.causes, MISSING.gateLost] },
  consults: { headline: { answered: 8, atBudget: 2, budgeted: 8, incomplete: 1, retried: 0 },
    trend: DAYS.map((day) => ({ day, answered: 4 })),
    groups: [{ model: "cx/a", prompt: "v3 abc", consults: 8, findings: 12, ruled: 10, kept: 70, how: 5, rightAboutHow: 80, thin: "thin" }],
    missing: [MISSING.transport] },
  friction: { headline: { refusals: 4, runs: 12 }, trend: DAYS.map((day) => ({ day, refusals: 4 })),
    refusals: [{ key: "Hold — a rule", calls: 4, runs: 3 }], errors: [], repeats: [], waits: [], guideParts: [], standDowns: [] },
  releases: { landed: [{ version: "3.9.1", head: "abcdef1234", at: Date.parse(`${DAY}T12:00:00Z`), scope: "forge-plugin",
    issues: [{ key: "ISS-7", title: "A title", note: "What a user now sees." }],
    before: figure(3, 10, 20), after: figure(2, 11, 21), early: true }], installed: [], trend: [0, 0, 0, 0, 0, 0, 1] },
  opportunities: { listed: [{ kind: "refusal", met: "Hold — a rule", runs: 3, calls: 4, minutes: null,
    match: { key: "ISS-9", title: "The rule is too eager" }, unmatched: null }], unlisted: 0, evaluator: "forge stats eval" },
  moved: { phases: { rose: { row: "7 Ship", before: 5, now: 9, by: 4, runsBefore: 20, runsNow: 3 }, fell: null },
    rungs: { rose: null, fell: null } },
  followed: { version: "3.9.1", at: Date.parse(`${DAY}T12:00:00Z`), kind: "release" },
  ...extra,
});

test("the summary is three to five sentences naming the move, the release it followed and the largest opportunity", () => {
  const said = summaryOf(content());
  assert.ok(said.length >= 3 && said.length <= 5, said.join("\n"));
  const whole = said.join(" ");
  assert.ok(whole.includes("the phase that rose most was 7 Ship, 5 → 9 min over 20 → 3 run(s)"), whole);
  assert.ok(whole.includes("following release 3.9.1 at 2026-09-20 12:00Z"), whole);
  assert.ok(whole.includes("The largest opportunity was a refusal — Hold — a rule — which 3 run(s) paid 4 call(s) for, open as ISS-9."), whole);
});

test("the summary says so where nothing moved, nothing was released and nothing is an opportunity", () => {
  const whole = summaryOf(content({ moved: { phases: { rose: null, fell: null }, rungs: { rose: null, fell: null } }, followed: null,
    opportunities: { listed: [], unlisted: 0, evaluator: "forge stats eval" } })).join(" ");
  assert.ok(whole.includes("No phase had runs both on the day and in the seven days before it"), whole);
  assert.ok(whole.includes("no release written or copy installed on the day or the day before"), whole);
  assert.ok(whole.includes("The day holds no opportunity"), whole);
});

test("the index line names the same move and release the summary does", () => {
  const line = indexLineOf(content());
  assert.ok(line.includes("rose most was 7 Ship") && line.includes("release 3.9.1"), line);
});

test("each section opens with its headline beside a seven-day trend", () => {
  const page = pageOf(content());
  for (const id of ["runs", "landings", "consults", "friction", "releases"]) {
    const section = page.slice(page.indexOf(`<section id="${id}">`));
    const body = section.slice(0, section.indexOf("</section>"));
    assert.ok(body.indexOf('class="headline"') < body.indexOf('<figure class="trend">'), id);
    assert.match(body, /seven days: 09-14 .*, 09-20 /u);
  }
});

test("the page loads nothing from the network", () => {
  const page = pageOf(content());
  assert.doesNotMatch(page, /(?:src|href)\s*=\s*["']?\s*https?:|url\(\s*["']?\s*https?:/iu);
  assert.doesNotMatch(page, /<link\b|<script\s+src/iu);
});

test("every colour stands beside text saying the same thing", () => {
  const page = pageOf(content());
  for (const [, cls, text] of page.matchAll(/<span class="(thin|missing)">([^<]*)<\/span>/gu)) {
    assert.ok(cls === "thin" ? text === "thin" : text.startsWith("missing: "), `${cls}: ${text}`);
  }
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

const entry = (index) => ({ key: `Hold — rule ${index}`, calls: 20 - index, runs: 1 });

test("opportunities rank by calls paid, list ten, count the rest, and name the open issue each matches or say none", async () => {
  const held = friction({ refusals: Array.from({ length: 12 }, (_, index) => entry(index)) });
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
