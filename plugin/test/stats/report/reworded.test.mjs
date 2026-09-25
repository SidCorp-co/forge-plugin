/* ISS-2501. A refusal is followed by the gate that wrote it and the name that gate gave it, so a
   rewording keeps its row, a gate that named nothing keeps a row per wording, and a row whose gate
   went on refusing under a key it does not carry is never read as fixed. Every run is the fixture
   run of `stats runs`'s own suite moved onto a day, its one refusal replaced by the body a case names. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { frictionOf } from "../../../src/stats/daily/gather.mjs";
import { entriesOf } from "../../../src/stats/daily/opportunities.mjs";
import { currentOf } from "../../../src/stats/report/current.mjs";
import { currentPageOf } from "../../../src/stats/report/current-page.mjs";
import { DEFAULTS } from "../../../src/stats/report/settings.mjs";
import { runFrom } from "../../../src/stats/runs.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { runOn } from "../daily/fixture-daily.mjs";

process.env.TZ = "UTC";

const TODAY = "2026-09-20";
const NOW = Date.parse(`${TODAY}T20:00:00.000Z`);
const ago = (back) => new Date(Date.parse(`${TODAY}T00:00:00.000Z`) - back * 86_400_000).toISOString().slice(0, 10);

/* The fixture's refusal, whole, is what a case replaces: its line and the How line under it. */
const FIXTURE_REFUSAL = "Hold — ISS-99 owes a release note.";
let made = 0;
const runOf = (day, body) => {
  made += 1;
  const escaped = JSON.stringify(body).slice(1, -1);
  return runFrom(`/fixture/reworded-${made}.jsonl`, `session-${made}`, runOn(day).replaceAll(FIXTURE_REFUSAL, escaped));
};

const how = (topic, named = null) => `How: \`forge hooks --how ${topic}\`${named ? ` (cause: ${named})` : ""}`;
const refusal = (line, topic, named = null) => `${line}\n\nWhat was refused.\n\n${how(topic, named)}`;

const readingOf = (runs) => {
  const all = [...runs].sort((left, right) => left.startedAt - right.startedAt);
  return { projects: [], all, passes: [], entries: [], hooks: [], first: all.length ? all[0].startedAt : null };
};

/* Matched by the wording the row shows, which is the latest run's, so a row joined across a
   rewording is asked about once and carries one issue. */
const trackerOf = (matches, issues) => ({
  rows: new Map(Object.entries(issues).map(([key, one]) => [key, { issueId: key, title: one.title, status: one.status }])),
  match: async (text) => matches[text] ?? null,
  issue: async (key) => ({ key, relates: [], ...issues[key] }),
});

const reportsRoom = () => {
  const dir = join(tempRoom("stats-reworded-"), "reports");
  mkdirSync(dir, { recursive: true });
  return dir;
};

const contentOf = (runs, { matches = {}, issues = {}, marks = [] } = {}) =>
  currentOf(readingOf(runs), { dir: reportsRoom(), tracker: trackerOf(matches, issues), now: NOW, marks,
    settings: { ...DEFAULTS, from: "the plugin's defaults" } });

const everyRow = (content) => ["new", "recurring", "oneOff", "fixed"].flatMap((one) => content.causes[one].rows);
const rowsMeeting = (content, met) => everyRow(content).filter((row) => row.causes.some((one) => one.met === met));

const OLD = "Hold — this writes to ISS-nn, and every comment on the page is below.";
const NEW = "Hold — read the comments below, then re-send the same command.";

test("two wordings one gate names as one cause are one row, with one series, its days seen and one matched issue", async () => {
  const runs = [
    ...[6, 5, 4].map((back) => runOf(ago(back), refusal(OLD, "gate-a", "gate-a/unread"))),
    ...[3, 2, 1].map((back) => runOf(ago(back), refusal(NEW, "gate-a", "gate-a/unread"))),
  ];
  const content = await contentOf(runs, { matches: { [`refusal: ${NEW}`]: "ISS-1" },
    issues: { "ISS-1": { title: "unread comments", status: "open" } } });
  const rows = everyRow(content).filter((row) => row.causes.some((one) => one.kind === "refusal"));
  assert.equal(rows.length, 1, "one refusal row across the rewording");
  const [row] = rows;
  assert.deepEqual(row.causes.map((one) => one.key), ["refusal · gate-a · unread"]);
  assert.equal(row.figures.daysSeen, 6, "the days seen under either wording");
  assert.deepEqual(row.figures.series.slice(-7), [1, 1, 1, 1, 1, 1, 0]);
  assert.deepEqual(row.issues.map((one) => one.key), ["ISS-1"], "and the one issue it matched");
  assert.equal(row.causes[0].met, NEW, "shown under the latest run's wording");
});

test("two wordings under a gate that named neither are two rows", async () => {
  const runs = [
    ...[6, 5].map((back) => runOf(ago(back), refusal(OLD, "gate-a"))),
    ...[2, 1].map((back) => runOf(ago(back), refusal(NEW, "gate-a"))),
  ];
  const content = await contentOf(runs);
  assert.equal(rowsMeeting(content, OLD).length, 1);
  assert.notEqual(rowsMeeting(content, OLD)[0], rowsMeeting(content, NEW)[0]);
  assert.deepEqual(rowsMeeting(content, OLD)[0].causes.map((one) => one.key), [`refusal · gate-a · ${OLD}`]);
});

test("one wording from two gates is two rows", async () => {
  const runs = [
    ...[6, 5].map((back) => runOf(ago(back), refusal(OLD, "gate-a"))),
    ...[2, 1].map((back) => runOf(ago(back), refusal(OLD, "gate-b"))),
  ];
  const rows = rowsMeeting(await contentOf(runs), OLD);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.causes[0].gate).sort(), ["gate-a", "gate-b"]);
});

test("a repeat is keyed under the gate its line names, and a refusal no gate wrote keeps its line", async () => {
  const repeat = "Refused again, for the reason this session was already shown in full: `forge hooks --how gate-a`";
  const runs = [runOf(ago(2), repeat), runOf(ago(1), "forge_issues refused: no issue answers ISS-4")];
  const keys = everyRow(await contentOf(runs)).flatMap((row) => row.causes).filter((one) => one.kind === "refusal")
    .map((one) => one.key).sort();
  assert.deepEqual(keys, [`refusal · gate-a · ${repeat}`, "refusal · no issue answers ISS-nn"]);
});

test("a day's page lists a cause met under two wordings as one entry, each run that met it counted once", () => {
  const both = runOf(ago(1), refusal(OLD, "gate-a", "gate-a/unread"));
  const again = runOf(ago(1), refusal(NEW, "gate-a", "gate-a/unread"));
  const entries = entriesOf(frictionOf([both, again])).filter((one) => one.kind === "refusal");
  assert.deepEqual(entries.map((one) => [one.cause, one.runs, one.calls]), [["gate-a · unread", 2, 2]]);
});

const release = (version, issue, day) => ({ kind: "releases", version, issues: [issue], at: `${day}T12:00:00.000Z`, scope: "forge-plugin" });

test("a released row whose gate refused after the release under a key it does not carry is recurring, and says why", async () => {
  const runs = [
    ...[6, 5, 4].map((back) => runOf(ago(back), refusal(OLD, "gate-a", "gate-a/unread"))),
    ...[2, 1].map((back) => runOf(ago(back), refusal(NEW, "gate-a"))),
  ];
  const content = await contentOf(runs, { matches: { [`refusal: ${OLD}`]: "ISS-1" },
    issues: { "ISS-1": { title: "unread comments", status: "closed" } }, marks: [release("3.1.0", "ISS-1", ago(3))] });
  const [row] = rowsMeeting(content, OLD);
  assert.equal(row.recurred, null, "its own key never came back");
  assert.deepEqual(row.unsettled, { gates: ["gate-a"], keys: 1, days: 2 });
  assert.ok(content.causes.recurring.rows.includes(row), "so it is not listed as fixed");
  assert.match(currentPageOf(content),
    /not read as fixed at 3\.1\.0: gate-a refused since under 1 cause\(s\) this row does not carry, on 2 day\(s\)/u);
});

test("a released row whose gate refused under another key only before the release is fixed", async () => {
  const runs = [
    ...[6, 5, 4].map((back) => runOf(ago(back), refusal(OLD, "gate-a", "gate-a/unread"))),
    runOf(ago(5), refusal(NEW, "gate-a")),
    runOf(ago(1), refusal(NEW, "gate-b")),
  ];
  const content = await contentOf(runs, { matches: { [`refusal: ${OLD}`]: "ISS-1" },
    issues: { "ISS-1": { title: "unread comments", status: "closed" } }, marks: [release("3.1.0", "ISS-1", ago(3))] });
  const [row] = rowsMeeting(content, OLD).filter((one) => one.causes[0].gate === "gate-a" && one.release);
  assert.equal(row.unsettled, null, "another gate's refusal after it is not this gate's");
  assert.ok(content.causes.fixed.rows.includes(row));
});
