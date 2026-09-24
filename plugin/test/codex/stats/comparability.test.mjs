import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves: the live config directory holds the device's own log and marks.
   Each case below moves it again, the log and the mark store being read where they are used. */
process.env.XDG_CONFIG_HOME = tempRoom("forge-codex-comparability-");

const { crossingSaid, evalLines, evalObject, printEval } = await import("../../../src/codex/codex-stats.mjs");
const { logPath } = await import("../../../src/codex/codex-log.mjs");
const { marksOf, writeMark } = await import("../../../src/stats/marks/marks.mjs");

const MINUTE = 60_000;
const BASE = Date.UTC(2026, 8, 1);
const ROW = (n) => ({
  kind: "consult", ok: true, id: `c${n}`, at: new Date(BASE + n * MINUTE).toISOString(),
  slot: "codex", model: "m", root: "/r", reply: "CODEX: 0 findings", prompt: { v: 5, sha: "aaa" },
});
const log = (many) => Array.from({ length: many }, (one, n) => ROW(n));
const room = (name) => {
  process.env.XDG_CONFIG_HOME = tempRoom(`forge-codex-comparability-${name}-`);
};
const screen = (entries) => evalLines(evalObject(entries)).join("\n");

/* The window lines report what was selected and leave the reader to decide whether it was evidence;
   a log that lost its depth prints the same counts as a young one. The judgement is the line a
   reader acts on, as ISS-1328 made it for the runs corpus (ISS-1373, criteria 1 to 5). */
test("a consult reading short of two full windows is judged not a comparison, and two full ones are not", () => {
  room("judged");
  const hundred = screen(log(100));
  assert.match(hundred, /no window before them: the log holds 100 answered consult\(s\) in all\.$/mu, hundred);
  assert.match(hundred,
    /^not a comparison: there is no window before it, over a log holding 100 answered consult\(s\) in all\.$/mu, hundred);

  const half = screen(log(150));
  assert.match(half, /the 50 before them .* — the log does not reach a full 100 further back/u);
  assert.match(half,
    /^not a comparison: the window before it holds 50 of 100, over a log holding 150 answered consult\(s\) in all\.$/mu, half);

  const young = screen(log(50));
  assert.match(young, /^not a comparison: the recent window holds 50 of 100, and there is no window before it, over a log holding 50 answered consult\(s\) in all\.$/mu, young);

  for (const said of [hundred, half, young]) {
    assert.doesNotMatch(said, /nothing yet/u, "which asserted a young log in the one case where a lost one is indistinguishable");
  }

  const full = screen(log(200));
  assert.doesNotMatch(full, /not a comparison/u, "two full windows are a comparison and are not judged one");
  assert.doesNotMatch(full, /the log reaches back to/u, "and owe no account of what bounded them");
});

test("an empty log says there is nothing to compare, and not that there is nothing yet", () => {
  room("empty");
  mkdirSync(dirname(logPath()), { recursive: true });
  writeFileSync(logPath(), "");
  const printed = [];
  const said = mock.method(console, "log", (line) => printed.push(line));
  try {
    printEval([]);
  } finally {
    said.mock.restore();
  }
  assert.match(printed.join("\n"), /^No answered consult is in the log, so there is nothing to compare\./u);
  assert.doesNotMatch(printed.join("\n"), /yet/u);
});

/* Watchable firing: the same shallow log with a deeper reading held and with none must print two
   different sentences, or the reach reading is indistinguishable from a clean run (ISS-1373,
   criteria 6, 7 and 10). */
test("a consult reading held deeper than the log reaches is what tells a lost log from a young one", () => {
  room("reach");
  const shallow = log(40).map((one, n) => ({ ...one, at: new Date(BASE + (n + 600) * MINUTE).toISOString() }));

  const silent = screen(shallow);
  assert.match(silent,
    /^ {2}the log reaches back to 2026-09-01 10:00Z; no reading held on this device records an earlier reach, which is not to say the log was never deeper — a mark is a snapshot and not a history\.$/mu,
    silent);

  /* A reading stored before the reach was recorded carries only its window, whose `from` is a logged
     moment rather than a clock reading, and is read by it. */
  writeMark({ kind: "consults", mark: 100, at: new Date(BASE).toISOString(),
    now: { consults: 100, from: new Date(BASE + 60 * MINUTE).toISOString(), to: new Date(BASE + 159 * MINUTE).toISOString() } });
  const legacy = screen(shallow);
  assert.match(legacy,
    /^ {2}the log reaches back to 2026-09-01 10:00Z; mark 100's reading reached back to 2026-09-01 01:00Z, so depth this device once read is no longer here\.$/mu,
    legacy);
  assert.notEqual(legacy, silent);

  /* A reading taken over a deep log records a late window floor and an early reach; the reach is
     the field carrying the depth. */
  writeMark({ kind: "consults", mark: 300, at: new Date(BASE).toISOString(),
    now: { consults: 100, from: new Date(BASE + 500 * MINUTE).toISOString(), to: new Date(BASE + 599 * MINUTE).toISOString() },
    comparability: { comparable: true, short: [], reach: { from: BASE, earlier: null } } });
  assert.match(screen(shallow), /mark 300's reading reached back to 2026-09-01 00:00Z, so depth this device once read is no longer here/u,
    "the deepest reading held is the one named, by the reach it carries and not by its window's floor");

  const held = evalObject(shallow);
  assert.deepEqual(held.comparability.short, ["the recent window holds 40 of 100", "there is no window before it"]);
  assert.deepEqual(held.comparability.reach, { from: BASE + 600 * MINUTE, earlier: { from: BASE, by: "mark 300" } },
    "the judgement is a field of the reading, so a stored reading can be read back for it");
});

test("the reading a crossing writes carries the log's own floor as its reach, not its window's", () => {
  room("crossing");
  const entries = log(300);
  crossingSaid({ mark: 300, at: 299, said: "codex:", entries });
  const [record] = marksOf("consults");
  assert.equal(record.now.from, entries[200].at, "the recent window begins two hundred consults in");
  assert.deepEqual(record.comparability, { comparable: true, short: [], reach: { from: BASE, earlier: null } });
});
