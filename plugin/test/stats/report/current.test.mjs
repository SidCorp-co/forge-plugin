/* `forge stats daily --current` on a device made small: what it writes and where, what `--open` and `--json`
   print, the series over every day held, the dated snapshots it lists and leaves alone, the page's
   masking, and the writer's mark with its once-more flag. Every home is the fixture's room. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { writeCurrent } from "../../../src/stats/report/current.mjs";
import { againPath, contentOf, markPath, takeMark } from "../../../src/stats/daily/store.mjs";
import { FORGE } from "../fixture-runs.mjs";
import { daily, daysAgo, device, envOf, today } from "../daily/fixture-daily.mjs";

const report = (held, ...argv) => spawnSync(FORGE, ["stats", "daily", "--current", ...argv], { encoding: "utf8", cwd: held.room, env: envOf(held) });

const index = (held) => join(held.reports, "index.html");

test("stats daily --current writes the current report as index.html in the reports directory and prints its path", () => {
  const held = device({ days: [daysAgo(1)] });
  const run = report(held);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(existsSync(index(held)));
  assert.ok(run.stdout.includes(`Wrote the current report: ${index(held)}\n`), run.stdout);
  assert.equal(contentOf(readFileSync(index(held), "utf8")).kind, "current");
});

test("--open prints the path of the report it wrote and nothing else", () => {
  const held = device({ days: [daysAgo(1)] });
  const run = report(held, "--open");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, `${index(held)}\n`);
});

test("--json prints the content as one object and writes no file", () => {
  const held = device({ days: [daysAgo(1)] });
  const run = report(held, "--json");
  assert.equal(run.status, 0, run.stderr);
  const content = JSON.parse(run.stdout);
  assert.equal(content.kind, "current");
  assert.ok(Array.isArray(content.causes.recurring.rows));
  assert.equal(existsSync(held.reports), false);
});

test("every headline figure is a series over every day held, and its last point is today so far", () => {
  const held = device({ days: [daysAgo(3), daysAgo(1)], consults: [{ kind: "consult", ok: true, reply: "CODEX: 0 findings",
    at: `${daysAgo(2)}T03:00:00.000Z`, model: "cx/model-a", prompt: { v: 3, sha: "abc" }, calls: 1, budget: 4, id: "c-1" }] });
  const { series } = JSON.parse(report(held, "--json").stdout);
  assert.deepEqual(series.days, [daysAgo(3), daysAgo(2), daysAgo(1), today()]);
  assert.deepEqual(series.runs, [1, 0, 1, 0]);
  assert.deepEqual(series.consults, [0, 1, 0, 0]);
  for (const name of ["runs", "medianMinutes", "medianCalls", "refusals", "consults", "landings", "releases"]) {
    assert.equal(series[name].length, 4, name);
  }
  assert.equal(report(held).status, 0);
  const page = readFileSync(index(held), "utf8");
  for (const label of ["issue-flow runs a day", "median minutes a run", "median calls a run", "refused calls a day",
    "answered consults a day", "landing passes a day", "releases a day"]) {
    assert.match(page, new RegExp(`<figcaption>${label}, every day held: [^<]*today so far [^<]*</figcaption>`, "u"), label);
  }
});

test("the current report lists every dated snapshot newest first, linked, with its own summary's line", () => {
  const held = device({ days: [daysAgo(1), daysAgo(2)] });
  assert.equal(daily(held, "--day", daysAgo(2)).status, 0);
  assert.equal(daily(held, "--day", daysAgo(1)).status, 0);
  assert.equal(report(held).status, 0);
  const page = readFileSync(index(held), "utf8");
  const [newer, older] = [`<a href="${daysAgo(1)}.html">`, `<a href="${daysAgo(2)}.html">`];
  assert.ok(page.includes(newer) && page.includes(older) && page.indexOf(newer) < page.indexOf(older), page);
  assert.match(page, new RegExp(`${daysAgo(1)}</a> — [^<]*following no release written`, "u"));
});

test("stats daily rewrites the current report after its dated snapshot, and its help names --current", () => {
  const held = device({ days: [daysAgo(1)] });
  const run = daily(held);
  assert.equal(run.status, 0, run.stderr);
  const content = contentOf(readFileSync(index(held), "utf8"));
  assert.equal(content.kind, "current");
  assert.deepEqual(content.snapshots.map((one) => one.day), [daysAgo(1)]);
  assert.match(run.stdout, /The current report, listing every day held: /u);
  const help = spawnSync(FORGE, ["stats", "daily", "-h"], { encoding: "utf8", cwd: held.room, env: envOf(held) });
  assert.match(help.stdout.replaceAll("\n", " "), /`forge stats daily --current` writes the current report instead/u);
  const idle = daily(held, "--current", "--day", daysAgo(1));
  assert.equal(idle.status, 1);
  assert.match(idle.stderr, /--current writes the report over every day held and always rewrites it, so it takes no --day/u);
});

test("a dated snapshot is left byte for byte as it was by stats daily --current", () => {
  const held = device({ days: [daysAgo(1)] });
  assert.equal(daily(held).status, 0);
  const page = join(held.reports, `${daysAgo(1)}.html`);
  const before = readFileSync(page);
  assert.equal(report(held).status, 0);
  assert.ok(readFileSync(page).equals(before));
});

test("a bad report key is refused with the key named, and nothing is written", () => {
  const held = device({ days: [daysAgo(1)], config: { report: { score: { formula: "max" } } } });
  const run = report(held);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /`report\.score\.formula` in .*config\.json is one of product, sum, not `"max"`/u);
  assert.equal(existsSync(index(held)), false);
});

test("the page carries no credential, no path outside the reports directory and the checkouts read, and no network resource", () => {
  const held = device({ days: [daysAgo(1)] });
  const store = readdirSync(join(held.room, ".claude", "projects"))[0];
  const agents = join(held.room, ".claude", "projects", store, "session-leak", "subagents");
  mkdirSync(agents, { recursive: true });
  const call = (id, second) => [
    JSON.stringify({ timestamp: `${daysAgo(1)}T01:0${second}:00.000Z`, message: { role: "assistant", model: "claude-opus-5",
      content: [{ type: "tool_use", id, name: "Bash", input: { command: "forge claim ISS-5 --token sekrit-value /home/elsewhere/x https://example.com/a.js" } }] } }),
    JSON.stringify({ timestamp: `${daysAgo(1)}T01:0${second}:05.000Z`, message: { role: "user",
      content: [{ type: "tool_result", tool_use_id: id, content: "claimed" }] } }),
  ].join("\n");
  writeFileSync(join(agents, "agent-leak.jsonl"), `${JSON.stringify({ timestamp: `${daysAgo(1)}T01:00:00.000Z`, type: "user",
    message: { role: "user", content: "Skill forge:issue-flow ISS-5" } })}\n${[call("c1", 1), call("c2", 2), call("c3", 3)].join("\n")}\n`);
  assert.equal(report(held).status, 0);
  const page = readFileSync(index(held), "utf8");
  assert.ok(page.includes("forge claim ISS-5"), "the leaking command is on the page, so its masking is what is read");
  assert.ok(!page.includes("sekrit-value"));
  assert.ok(!page.includes("/home/elsewhere"));
  for (const path of page.match(/(?<![\w.~<:/-])\/[^\s"'`<>()[\]{}|;,&]+/gu) ?? []) {
    assert.ok(path.startsWith(held.reports) || path.startsWith(held.checkout), path);
  }
  assert.doesNotMatch(page, /(?:src|href)\s*=\s*["']?https?:|url\(\s*["']?https?:/iu);
});

test("a writer finding the current report held does not write alongside it, and the holder writes once more before it exits", async () => {
  const { reports } = device();
  mkdirSync(reports, { recursive: true });
  const wrote = [];
  /* The holder's first write is where a second writer arrives. */
  let second = null;
  const holder = async (dir) => {
    wrote.push("holder");
    if (wrote.length === 1) second = await writeCurrent(dir, async () => wrote.push("second"));
    return { path: join(dir, "index.html") };
  };
  const result = await writeCurrent(reports, holder, holder);
  assert.equal(second, null);
  assert.deepEqual(wrote, ["holder", "holder"]);
  assert.ok(result);
  assert.equal(existsSync(againPath(reports)), false);
  assert.equal(existsSync(markPath(reports, "current")), false);
});

test("a writer whose take was refused by a holder that has since let go writes for its own flag", async () => {
  const { reports } = device();
  mkdirSync(reports, { recursive: true });
  let takes = 0;
  /* The first take meets the holder; by the second, the holder has read no flag and let go. */
  const take = (dir, name) => {
    takes += 1;
    return takes > 1 && takeMark(dir, name);
  };
  const wrote = [];
  const result = await writeCurrent(reports, async (dir) => {
    wrote.push("late");
    return { path: join(dir, "index.html") };
  }, undefined, take);
  assert.deepEqual(wrote, ["late"]);
  assert.ok(result);
  assert.equal(existsSync(againPath(reports)), false);
  assert.equal(existsSync(markPath(reports, "current")), false);
});

