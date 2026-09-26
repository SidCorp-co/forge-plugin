/* `forge stats daily` end to end over a device made small: what it refuses, what it writes and
   where, what it leaves alone, and what each section of the day's content holds. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { NAME, consult, daily, daysAgo, device, envOf, today } from "./fixture-daily.mjs";
import { FORGE } from "../fixture-runs.mjs";
import { slugFor } from "../../../src/stats/corpus/corpus.mjs";
import { contentOf } from "../../../src/stats/daily/store.mjs";

const written = (held) => (existsSync(held.reports) ? readdirSync(held.reports) : []);

test("a day that does not parse is refused with the form and the days held, and nothing is written", () => {
  const held = device({ days: [daysAgo(3)] });
  const run = daily(held, "--day", "2026-13-40");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--day takes a calendar day as YYYY-MM-DD, not `2026-13-40`/u);
  assert.ok(run.stderr.includes(`The days held run from ${daysAgo(3)} to ${daysAgo(1)}.`), run.stderr);
  assert.deepEqual(written(held), []);
});

test("a day earlier than anything held is refused with the days held, and nothing is written", () => {
  const held = device({ days: [daysAgo(3)] });
  const run = daily(held, "--day", daysAgo(6));
  assert.equal(run.status, 1, run.stdout);
  assert.ok(run.stderr.includes(`${daysAgo(6)} is earlier than anything this device still holds`), run.stderr);
  assert.ok(run.stderr.includes(`from ${daysAgo(3)} to ${daysAgo(1)}`), run.stderr);
  assert.deepEqual(written(held), []);
});

test("a day that has not ended is refused with the days held, and nothing is written", () => {
  const held = device({ days: [daysAgo(3)] });
  const run = daily(held, "--day", today());
  assert.equal(run.status, 1, run.stdout);
  assert.ok(run.stderr.includes(`${today()} has not ended in this device's zone`), run.stderr);
  assert.ok(run.stderr.includes(`from ${daysAgo(3)} to ${daysAgo(1)}`), run.stderr);
  assert.deepEqual(written(held), []);
});

test("no --day writes yesterday's page in the reports directory and prints its path", () => {
  const held = device({ days: [daysAgo(1)] });
  const run = daily(held);
  assert.equal(run.status, 0, run.stderr);
  const path = join(held.reports, `${daysAgo(1)}.html`);
  assert.ok(existsSync(path), run.stdout);
  assert.ok(run.stdout.includes(`Wrote ${daysAgo(1)}: ${path}`), run.stdout);
  assert.ok(existsSync(join(held.reports, "index.html")));
});

test("--open prints the page's path on one line and nothing else", () => {
  const held = device({ days: [daysAgo(1)] });
  const run = daily(held, "--open");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, `${join(held.reports, `${daysAgo(1)}.html`)}\n`);
});

test("a day already written is left byte for byte without --force, and --force rewrites it and says so", () => {
  const held = device({ days: [daysAgo(1)] });
  assert.equal(daily(held).status, 0);
  const path = join(held.reports, `${daysAgo(1)}.html`);
  writeFileSync(path, "held by hand");
  const again = daily(held);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(readFileSync(path, "utf8"), "held by hand");
  assert.ok(again.stdout.includes(`forge stats daily --day ${daysAgo(1)} --force`), again.stdout);
  const forced = daily(held, "--force");
  assert.equal(forced.status, 0, forced.stderr);
  assert.notEqual(readFileSync(path, "utf8"), "held by hand");
  assert.ok(forced.stdout.includes(`Rewrote the page held for ${daysAgo(1)}`), forced.stdout);
});

test("--json prints the content as one object and writes nothing", () => {
  const held = device({ days: [daysAgo(1)] });
  const run = daily(held, "--json");
  assert.equal(run.status, 0, run.stderr);
  const content = JSON.parse(run.stdout);
  assert.equal(content.day, daysAgo(1));
  assert.deepEqual(written(held), []);
});

const contentFor = (held, day) => JSON.parse(daily(held, "--day", day, "--json").stdout);

test("every registered project a store names is a row with its runs, and one no store names is said unread", () => {
  const held = device({ days: [daysAgo(1), daysAgo(1)] });
  mkdirSync(join(held.home, "forge", "projects", "ghost"), { recursive: true });
  writeFileSync(join(held.home, "forge", "projects", "ghost", "config.json"), JSON.stringify({ slug: "ghost" }));
  const content = contentFor(held, daysAgo(1));
  assert.deepEqual(content.projects.map((one) => one.name), [NAME]);
  assert.deepEqual(content.runs.projects.map((one) => [one.name, one.runs]), [[NAME, 2]]);
  assert.deepEqual(content.unread.map((one) => one.name), ["ghost"]);
});

test("the runs headline stands beside the day before and the seven days before, each with its runs", () => {
  const held = device({ days: [daysAgo(1), daysAgo(1), daysAgo(2), daysAgo(4), daysAgo(4), daysAgo(4)] });
  const { headline } = contentFor(held, daysAgo(1)).runs;
  assert.equal(headline.day.runs, 2);
  assert.equal(headline.day.medianMinutes, 41.7);
  assert.equal(headline.day.medianCalls, 16);
  assert.equal(headline.before.runs, 1);
  /* Seven days holding 1, 0, 3, 0, 0, 0, 0 runs: a median of none, and two days held a run. */
  assert.equal(headline.week.runs, 0);
  assert.equal(headline.week.days, 2);
  assert.equal(headline.week.medianMinutes, 41.7);
});

test("the runs split by phase, rung and model, a row under ten runs marked thin", () => {
  const content = contentFor(device({ days: [daysAgo(1)] }), daysAgo(1));
  const ship = content.runs.phases.find((one) => one.name === "7 Ship");
  assert.equal(ship.runs, 1);
  assert.equal(ship.thin, "thin");
  assert.deepEqual(content.runs.rungs.map((one) => [one.name, one.runs, one.thin]), [["unknown", 1, "thin"]]);
  assert.deepEqual(content.runs.models.map((one) => [one.name, one.runs, one.thin]), [["claude-opus-5", 1, "thin"]]);
});

test("a figure no reader computes is named once in the footer with its issue, and never as a red line in the body", () => {
  const held = device({ days: [daysAgo(1)] });
  assert.equal(daily(held).status, 0);
  const page = readFileSync(join(held.reports, `${daysAgo(1)}.html`), "utf8");
  const footer = page.slice(page.indexOf("<footer>"), page.indexOf("</footer>"));
  for (const [reading, issue] of [["issue-flow runs by the effort they ran at", "ISS-2424"],
    ["hand-backs by cause", "ISS-2425"], ["gate minutes lost", "ISS-2425"],
    ["consult calls lost to transport failures", "ISS-2426"], ["the minutes work waited on a person each day", "ISS-2600"]]) {
    assert.ok(footer.includes(`<li>Not computed yet: ${reading}, owed by ${issue}.</li>`), reading);
  }
  assert.doesNotMatch(page, /missing: /u, "no red missing line anywhere on the page");
});

test("--json and the terminal carry the scorecard, one entry and one line per metric, and no template sentence", () => {
  const held = device({ days: [daysAgo(1), daysAgo(2)] });
  const { scorecard } = contentFor(held, daysAgo(1));
  assert.deepEqual(scorecard.map((one) => one.metric), ["closed", "minutesPerClosed", "firstGate", "ownerWait", "wasted", "atBudget"]);
  for (const one of scorecard) {
    for (const field of ["metric", "value", "baseline", "change", "verdict", "goal"]) assert.ok(field in one, `${one.metric} lacks ${field}`);
  }
  const wasted = scorecard.find((one) => one.metric === "wasted");
  assert.equal(wasted.baselineDays, 1, "the one day before that held a run");
  assert.equal(wasted.change, 0);
  assert.equal(wasted.verdict, "steady", "the same run on both days wastes the same share");
  const written = daily(held, "--day", daysAgo(1));
  assert.equal(written.status, 0, written.stderr);
  const lines = written.stdout.split("\n");
  assert.equal(lines[0], "Scorecard, the day against the median of the seven days before:");
  assert.equal(lines.slice(1, 7).filter((one) => one.startsWith("  ")).length, 6, written.stdout);
  assert.match(written.stdout, /^ {2}issues closed: not read: no Forge endpoint is saved on this machine \(higher is better, G-11\)$/mu,
    "14, 16. a device with no endpoint reads no close, and says so rather than nought");
  const closed = scorecard.find((one) => one.metric === "closed");
  assert.deepEqual([closed.value, closed.baseline, closed.unread], [null, null, "no Forge endpoint is saved on this machine"],
    "15. --json carries the value, the baseline and why it was not read");
  assert.match(written.stdout, new RegExp(`^  wasted calls, of all calls: ${wasted.value}% against ${wasted.baseline}%, \\+?0 pt, steady \\(lower is better, G-11\\)$`, "mu"));
  assert.ok(!written.stdout.includes("issue-flow run(s) across"), "no template sentence");
  const again = daily(held, "--day", daysAgo(1));
  assert.ok(again.stdout.startsWith("Scorecard, the day against"), "a held page's scorecard is printed on a plain open");
});

test("the landings are the landing reader's passes and the profile's gate figures for the day", () => {
  const { headline } = contentFor(device({ days: [daysAgo(1)] }), daysAgo(1)).landings;
  assert.deepEqual(headline, { passes: 1, resumed: 0, outsideRuns: 0, rejectedRuns: 0, gateCalls: 1, gateMinutes: 2 });
});

/* A dispatching session's own transcript, which is no issue-flow run: the two landings it typed on
   the day, and a mention of the verb that lands nothing. */
const dispatcherLanded = (held, on) => {
  const use = (id, at, command) => JSON.stringify({ timestamp: `${on}T${at}.000Z`, type: "assistant",
    message: { role: "assistant", content: [{ type: "tool_use", id, name: "Bash", input: { command } }] } });
  const store = join(held.room, ".claude", "projects", slugFor(held.checkout));
  writeFileSync(join(store, "session-dispatcher.jsonl"), [
    JSON.stringify({ timestamp: `${on}T09:00:00.000Z`, type: "user", message: { role: "user", content: "fold the wave" } }),
    use("d1", "09:10:00", "node tools/run.mjs land-ready ISS-9 ISS-10 2>&1 | tail -40"),
    use("d2", "11:00:00", "cd /w && node tools/run.mjs land-ready ISS-11"),
    use("d3", "11:30:00", 'pgrep -f "tools/run.mjs land-ready"'),
  ].join("\n") + "\n");
};

/* Criteria 6 and 7 of ISS-2435: the one reader, read by both verbs over one device. */
test("a landing a session that is no run typed is counted on the day, and stats runs counts the same passes", () => {
  const held = device({ days: [daysAgo(1)] });
  dispatcherLanded(held, daysAgo(1));
  const { headline, trend } = contentFor(held, daysAgo(1)).landings;
  assert.deepEqual({ passes: headline.passes, outsideRuns: headline.outsideRuns }, { passes: 3, outsideRuns: 2 },
    "the run's own ship pass and the dispatcher's two land-ready passes, the mention of one among neither");
  assert.equal(trend.at(-1).passes, 3, "and the trend's day is the headline's");
  const runs = spawnSync(FORGE, ["stats", "runs", "--checkout", held.checkout, "--json"],
    { encoding: "utf8", cwd: held.room, env: envOf(held) });
  assert.equal(runs.status, 0, runs.stderr);
  const { landings } = JSON.parse(runs.stdout);
  assert.deepEqual(landings, { passes: 3, resumed: 0, outsideRuns: 2 }, "the landings stats runs reads are the ones the day showed");
  const said = spawnSync(FORGE, ["stats", "runs", "--checkout", held.checkout], { encoding: "utf8", cwd: held.room, env: envOf(held) });
  assert.match(said.stdout, /^landings {8}3 pass\(es\) in every transcript of the project, 2 of them in a session no issue-flow run holds/mu,
    said.stdout);
});

test("a day whose only record is a landing a dispatching session typed is read, and stats runs says it", () => {
  const held = device();
  dispatcherLanded(held, daysAgo(1));
  const { headline } = contentFor(held, daysAgo(1)).landings;
  assert.deepEqual({ passes: headline.passes, outsideRuns: headline.outsideRuns }, { passes: 2, outsideRuns: 2 },
    "the landings alone hold the day, so it is not refused as earlier than anything held");
  const said = spawnSync(FORGE, ["stats", "runs", "--checkout", held.checkout], { encoding: "utf8", cwd: held.room, env: envOf(held) });
  assert.match(said.stdout, /^No issue-flow run for this project/u, said.stdout);
  assert.match(said.stdout, /^landings {8}2 pass\(es\)/mu, "and the landings are printed beside the runs it found none of");
});

test("a landing older than the page's trend is on the current report's series and off the page, which reads alike written or printed", () => {
  const held = device({ days: [daysAgo(1)] });
  dispatcherLanded(held, daysAgo(12));
  const printed = contentFor(held, daysAgo(1));
  assert.equal(daily(held, "--day", daysAgo(1)).status, 0);
  const written = contentOf(readFileSync(join(held.reports, `${daysAgo(1)}.html`), "utf8"));
  assert.equal(written.dayOfFirst, printed.dayOfFirst);
  assert.deepEqual(written.landings, printed.landings);
  const current = contentOf(readFileSync(join(held.reports, "index.html"), "utf8"));
  assert.equal(current.series.days[0], daysAgo(12));
  assert.equal(current.series.landings[0], 2);
});

test("consults are counted for the day, one row per model and prompt version", () => {
  const on = `${daysAgo(1)}T10:00:00.000Z`;
  const held = device({ days: [daysAgo(1)], consults: [consult(on), consult(on, { id: "c-2", prompt: { v: 4, sha: "def456" } }),
    consult(`${daysAgo(2)}T10:00:00.000Z`, { id: "c-3" })] });
  const { consults } = contentFor(held, daysAgo(1));
  assert.equal(consults.headline.answered, 2);
  assert.equal(consults.headline.atBudget, 2);
  assert.deepEqual(consults.groups.map((one) => one.prompt).sort(), ["v3 abc123", "v4 def456"]);
  assert.deepEqual(consults.trend.map((one) => one.answered).slice(-2), [1, 2]);
});

test("friction lists refusals, errors, repeats and long waits with the runs behind each, and stand-downs with their sessions", () => {
  const on = `${daysAgo(1)}T10:00:00.000Z`;
  const held = device({ days: [daysAgo(1), daysAgo(1)], hooks: [
    { at: on, hook: "learning-gate", decision: "error", session: "s1" },
    { at: on, hook: "learning-gate", decision: "error", session: "s2" },
    { at: on, hook: "bash-guard", decision: "deny", session: "s1" },
  ] });
  const { friction } = contentFor(held, daysAgo(1));
  assert.deepEqual(friction.refusals.map((one) => [one.calls, one.runs]), [[2, 2]]);
  assert.ok(friction.repeats.some((one) => one.key === "forge issue ISS-nn --full" && one.calls === 6 && one.runs === 2));
  assert.ok(friction.waits.some((one) => one.waits === 2 && one.runs === 2 && one.minutes === 30));
  assert.deepEqual(friction.standDowns, [{ hook: "learning-gate", count: 2, sessions: 2 }]);
});

/* One more run on the day, holding a command's answer and a failure, beside the fixture's own. */
const failing = (held, on) => {
  const stamp = (second) => `${on}T01:00:${String(second).padStart(2, "0")}.000Z`;
  const call = (id, second, command, body, isError = true) => [
    { timestamp: stamp(second), message: { role: "assistant", content: [{ type: "tool_use", id, name: "Bash", input: { command } }] } },
    { timestamp: stamp(second + 1), message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: body, is_error: isError }] } },
  ];
  const rows = [{ timestamp: stamp(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-8" } },
    ...call("f1", 1, "forge claim ISS-8", "claimed", false),
    ...call("f2", 10, "pgrep -f 'tools/run.mjs ship'", "Exit code 1\n"),
    ...call("f3", 20, "node --test plugin/test/a.test.mjs", "Exit code 1\n# fail 1")];
  const store = join(held.room, ".claude", "projects", slugFor(held.checkout), "session-failing", "subagents");
  mkdirSync(store, { recursive: true });
  writeFileSync(join(store, "agent-failing.jsonl"), `${rows.map((one) => JSON.stringify(one)).join("\n")}\n`);
};

test("the day's errors are keyed as stats runs keys them, its answers are listed apart, and no answer is an opportunity", () => {
  const held = device({ days: [daysAgo(1)] });
  failing(held, daysAgo(1));
  const { friction, opportunities } = contentFor(held, daysAgo(1));
  assert.equal(friction.errorRows, 2);
  assert.deepEqual(friction.answers, [{ key: "pgrep, exit 1", calls: 1, runs: 1 }]);
  assert.deepEqual(friction.errors, [{ key: "test · exit 1: # fail N", calls: 1, runs: 1 }]);
  const met = opportunities.listed.map((one) => one.met);
  assert.ok(met.includes("a non-zero exit no rule refused, test · exit 1: # fail N"), met.join("\n"));
  assert.ok(!met.some((one) => one.includes("pgrep")), met.join("\n"));
});

test("a release reading of the day is listed with its version, commit, time and issues", () => {
  const on = `${daysAgo(1)}T12:00:00.000Z`;
  const held = device({ days: [daysAgo(1)], marks: [{ kind: "releases", version: "3.9.1", head: "abcdef1234567890",
    issues: ["ISS-7"], at: on, scope: "forge-plugin" }] });
  const [release] = contentFor(held, daysAgo(1)).releases.landed;
  assert.equal(release.version, "3.9.1");
  assert.equal(release.head, "abcdef1234567890");
  assert.equal(release.at, Date.parse(on));
  assert.deepEqual(release.issues.map((one) => one.key), ["ISS-7"]);
  /* No endpoint in this home: the row says why it could not be read, and the report carries on. */
  assert.match(release.issues[0].unread, /no Forge endpoint/u);
});

test("the page carries no credential and no path outside the reports directory and the checkouts read", () => {
  const held = device({ days: [daysAgo(1)] });
  const store = readdirSync(join(held.room, ".claude", "projects"))[0];
  const leaked = ["cx1", "cx2", "cx3"].map((id, index) => [
    JSON.stringify({ timestamp: `${daysAgo(1)}T01:0${index}:00.000Z`, message: { role: "assistant", model: "claude-opus-5",
      content: [{ type: "tool_use", id, name: "Bash", input: { command: "forge claim ISS-5 --token sekrit-value /home/elsewhere/x" } }] } }),
    JSON.stringify({ timestamp: `${daysAgo(1)}T01:0${index}:05.000Z`, message: { role: "user",
      content: [{ type: "tool_result", tool_use_id: id, content: "claimed" }] } }),
  ].join("\n")).join("\n");
  const agents = join(held.room, ".claude", "projects", store, "session-leak", "subagents");
  mkdirSync(agents, { recursive: true });
  writeFileSync(join(agents, "agent-leak.jsonl"), `${JSON.stringify({ timestamp: `${daysAgo(1)}T01:00:00.000Z`, type: "user",
    message: { role: "user", content: "Skill forge:issue-flow ISS-5" } })}\n${leaked}\n`);
  assert.equal(daily(held).status, 0);
  const page = readFileSync(join(held.reports, `${daysAgo(1)}.html`), "utf8");
  assert.ok(!page.includes("sekrit-value"));
  assert.ok(!page.includes("/home/elsewhere"));
  for (const path of page.match(/(?<![\w.~<-])\/[^\s"'`<>()[\]{}|;,&]+/gu) ?? []) {
    assert.ok(path.startsWith(held.reports) || path.startsWith(held.checkout), path);
  }
});

test("the index lists every held day newest first, each with the line its own summary names", () => {
  const held = device({ days: [daysAgo(1), daysAgo(2)] });
  assert.equal(daily(held, "--day", daysAgo(2)).status, 0);
  assert.equal(daily(held, "--day", daysAgo(1)).status, 0);
  const index = readFileSync(join(held.reports, "index.html"), "utf8");
  assert.ok(index.indexOf(`${daysAgo(1)}.html`) < index.indexOf(`${daysAgo(2)}.html`), index);
  const content = contentOf(readFileSync(join(held.reports, `${daysAgo(1)}.html`), "utf8"));
  assert.ok(index.includes("no release written"), index);
  assert.equal(content.day, daysAgo(1));
});

test("the reports directory is the device key where it is set, and a relative one is refused", () => {
  const elsewhere = join(device().room, "pages");
  const held = device({ days: [daysAgo(1)], config: { reports: elsewhere } });
  const run = daily(held, "--open");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), join(elsewhere, `${daysAgo(1)}.html`));
  const refused = daily(device({ days: [daysAgo(1)], config: { reports: "pages" } }));
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /`reports` in .*config\.json is an absolute directory, not `"pages"`/u);
});
