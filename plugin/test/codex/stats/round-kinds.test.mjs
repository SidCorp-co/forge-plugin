import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves: the live config directory holds the device's own log. */
process.env.XDG_CONFIG_HOME = tempRoom("forge-codex-round-kinds-");

const { logPath } = await import("../../../src/codex/codex-log.mjs");
const { printStats, roundKindLines, roundKindsOf } = await import("../../../src/codex/codex-stats.mjs");

const ROW = (held = {}) => ({ kind: "consult", ok: true, at: "2026-09-04T00:00:00.000Z", reply: "CODEX: 0 findings", root: "/r", usage: {}, ...held });
const RECHECK = (held) => ROW({ recheck: true, files: ["a.mjs"], ...held });

/* Three passes, one of them retried, and two rechecks: the pass's cache share is its own tokens'
   (400 read of 1200 sent, the retried row's included), the recheck's its own (100 of 400). */
const WINDOW = [
  ROW({ calls: 2, attempt: 1, usage: { input_tokens: 100, cache_read_input_tokens: 300, cache_creation_input_tokens: 100 } }),
  ROW({ calls: 3, attempt: 1, usage: { input_tokens: 500 } }),
  ROW({ calls: 7, attempt: 2, retriedFrom: 4, usage: { input_tokens: 100, cache_read_input_tokens: 100 } }),
  RECHECK({ calls: 1, attempt: 1, usage: { input_tokens: 200 } }),
  RECHECK({ calls: 1, attempt: 1, usage: { input_tokens: 100, cache_read_input_tokens: 100 } }),
];

const printed = (rows) => {
  mkdirSync(dirname(logPath()), { recursive: true });
  writeFileSync(logPath(), rows.map((one) => `${JSON.stringify(one)}\n`).join(""));
  const before = readFileSync(logPath());
  const said = mock.method(console, "log", () => {});
  try {
    printStats([]);
    return { lines: said.mock.calls.map((call) => String(call.arguments[0])), before };
  } finally {
    said.mock.restore();
  }
};

test("stats print a pass beside a recheck, each over its own rows", () => {
  const { lines, before } = printed(WINDOW);
  assert.ok(lines.includes("pass        3 consult(s)  read from cache 33% of 1200 input token(s)  calls reached 2:1  3:1  retried 1"),
    "the pass line: its own count, its own cache share, a histogram without the retried row, and the retry counted apart");
  assert.ok(lines.includes("recheck     2 consult(s)  read from cache 25% of 400 input token(s)  calls reached 1:2  retried 0"),
    "the recheck line, over the two recheck rows alone");
  assert.ok(lines.includes("calls reached     1:2  2:1  3:1  7:1"), "the window-wide histogram is the one it always was");
  assert.ok(lines.includes("read from cache   31% of 1600 input token(s)"), "and so is the window-wide cache line");
  assert.deepEqual(readFileSync(logPath()), before, "reading the log writes nothing to it");
});

test("a row with no recheck field is a pass, and a kind with no row says so", () => {
  const kinds = roundKindsOf([ROW({ calls: 1, usage: { input_tokens: 10 } })]);
  assert.deepEqual(kinds.map(({ name, consults }) => [name, consults]), [["pass", 1], ["recheck", 0]]);
  const [, recheck] = roundKindLines(kinds);
  assert.equal(recheck, "recheck     0 consult(s)  none in this window");
});

test("a kind whose rows recorded no input tokens says that rather than a share", () => {
  const [pass] = roundKindLines(roundKindsOf([ROW({ calls: 2 })]));
  assert.equal(pass, "pass        1 consult(s)  read from cache — no input token recorded  calls reached 2:1  retried 0");
});
