/* The session start as the schedule: which project starts a writer, for which day, and what stops
   a second one. The writer itself is stood in for, so a case proves the start without running it. */
import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { dailyDue } from "../../../src/stats/daily/trigger.mjs";
import { reportsWhere, shownDeep, writePage } from "../../../src/stats/daily/store.mjs";
import { PROJECT_KEYS } from "../../../src/tools/services/project-file.mjs";
import { daysAgo, device } from "./fixture-daily.mjs";

/* The trigger reads the config home and the checkout's record in this process, so each case points
   the process at its own device and puts both back. */
const under = (held, run) => {
  const was = { home: process.env.XDG_CONFIG_HOME, tz: process.env.TZ };
  process.env.XDG_CONFIG_HOME = held.home;
  try {
    return run();
  } finally {
    if (was.home === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = was.home;
  }
};

const starter = () => {
  const calls = [];
  const start = (command, args, options) => {
    calls.push({ command, args, options });
    return { pid: 424242, unref: () => calls.push("unref") };
  };
  return { calls, start };
};

const NOON = Date.parse(`${daysAgo(0)}T12:00:00Z`);

test("a project whose report key is daily starts a detached writer for yesterday and does not wait for it", () => {
  const held = device({ project: { report: "daily" } });
  const { calls, start } = starter();
  const started = under(held, () => dailyDue("/plugin", { start, now: NOON, cwd: held.checkout }));
  const day = new Date(NOON - 86_400_000).toISOString().slice(0, 10);
  assert.deepEqual(started, { day, pid: 424242 });
  assert.deepEqual(calls[0].args, ["/plugin/bin/forge", "stats", "daily", "--day", day]);
  assert.equal(calls[0].options.detached, true);
  assert.equal(calls[0].options.stdio, "ignore");
  assert.equal(calls[1], "unref");
  assert.equal(readFileSync(join(held.reports, `${day}.writing`), "utf8"), "424242\n");
});

test("a project that has not set report to daily starts nothing", () => {
  for (const project of [{}, { report: "off" }]) {
    const held = device({ project });
    const { calls, start } = starter();
    assert.equal(under(held, () => dailyDue("/plugin", { start, now: NOON, cwd: held.checkout })), null);
    assert.deepEqual(calls, []);
  }
});

test("a day already written or still being written starts no second writer, and a dead writer's mark does not stop the next", () => {
  const held = device({ project: { report: "daily" } });
  const day = new Date(NOON - 86_400_000).toISOString().slice(0, 10);
  mkdirSync(held.reports, { recursive: true });
  const { calls, start } = starter();
  writeFileSync(join(held.reports, `${day}.html`), "held");
  assert.equal(under(held, () => dailyDue("/plugin", { start, now: NOON, cwd: held.checkout })), null);
  const other = device({ project: { report: "daily" } });
  mkdirSync(other.reports, { recursive: true });
  writeFileSync(join(other.reports, `${day}.writing`), `${process.pid}\n`);
  assert.equal(under(other, () => dailyDue("/plugin", { start, now: NOON, cwd: other.checkout })), null);
  assert.deepEqual(calls, []);
  writeFileSync(join(other.reports, `${day}.writing`), "999999999\n");
  assert.deepEqual(under(other, () => dailyDue("/plugin", { start, now: NOON, cwd: other.checkout })), { day, pid: 424242 });
  assert.ok(existsSync(join(other.reports, `${day}.writing`)));
});

test("the reports directory is the device's reports key, and the forge config directory's reports otherwise", () => {
  const held = device();
  assert.equal(under(held, () => reportsWhere().dir), join(held.home, "forge", "reports"));
  const set = device({ config: { reports: "/somewhere/pages/" } });
  assert.equal(under(set, () => reportsWhere().dir), "/somewhere/pages");
});

test("the report key takes daily or off and refuses anything else", () => {
  assert.equal(PROJECT_KEYS.report.judge("daily"), null);
  assert.equal(PROJECT_KEYS.report.judge("off"), null);
  assert.match(PROJECT_KEYS.report.judge("weekly"), /`report` in .* is one of off, daily, not `"weekly"`/u);
});

test("a spawn that fails on a later tick is heard, and gives the mark back", async () => {
  const held = device({ project: { report: "daily" } });
  const day = new Date(NOON - 86_400_000).toISOString().slice(0, 10);
  const start = () => {
    const child = new EventEmitter();
    setTimeout(() => child.emit("error", new Error("spawn EAGAIN")), 0);
    return child;
  };
  assert.equal(under(held, () => dailyDue("/plugin", { start, now: NOON, cwd: held.checkout })), null);
  await new Promise((done) => setTimeout(done, 20));
  assert.equal(existsSync(join(held.reports, `${day}.writing`)), false);
});

test("a path that walks out of an allowed root through .. is masked", () => {
  assert.equal(shownDeep({ said: "cat /work/p/../../private/file /work/p/src/a.mjs" }, ["/work/p"]).said, "cat … /work/p/src/a.mjs");
});

test("a page is written whole or not at all, and a failed rewrite leaves the page it would have replaced", () => {
  const { reports } = device();
  writePage(reports, "2026-09-20.html", "the good page");
  mkdirSync(join(reports, `2026-09-20.html.${process.pid}.tmp`));
  assert.throws(() => writePage(reports, "2026-09-20.html", "a rewrite"));
  assert.equal(readFileSync(join(reports, "2026-09-20.html"), "utf8"), "the good page");
});
