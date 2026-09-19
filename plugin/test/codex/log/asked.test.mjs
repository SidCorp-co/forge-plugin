/* The two questions a gate asks per tool call and per run, against the reader that held the log as
   rows to answer them: the same answer, on the same rows, is all that earns the cheaper scan. */
import assert from "node:assert/strict";
import test from "node:test";

import { jsonlOf, tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves, since the module reaches the log's path and the developer's is live. */
const sandbox = tempRoom("forge-codex-asked-");
process.env.XDG_CONFIG_HOME = sandbox;

const { checkStops, consultCount, sentShaOf } = await import("../../../src/codex/log/asked.mjs");
const { answered, logEntries } = await import("../../../src/codex/codex-log.mjs");

/* What the callers ran before ISS-1044: every row as an object, then the one field. */
const heldAsRows = (rows, root, rel) => {
  for (const one of answered(rows).reverse()) {
    if (one.root !== root) continue;
    const hit = (one.sent ?? []).find((sent) => sent.rel === rel);
    if (hit) return hit.sha ?? null;
  }
  return null;
};

const sent = (over) => ({ kind: "consult", ok: true, reply: "CODEX: 0 findings", root: "/a", ...over });
const QUOTED = 'docs/a"b.md';
const rows = [
  sent({ id: "c1", sent: [{ rel: "docs/one.md", sha: "aaa" }, { rel: QUOTED, sha: "qqq" }] }),
  sent({ id: "c2", root: "/other", sent: [{ rel: "docs/one.md", sha: "bbb" }] }),
  sent({ id: "c3", sent: [{ rel: "docs/two.md", sha: "ccc" }] }),
  sent({ id: "c4", ok: false, reply: null, sent: [{ rel: "docs/one.md", sha: "ddd" }] }),
  sent({ id: "c5", sent: [{ rel: "docs/nosha.md" }] }),
  { kind: "verdict", of: "c1" },
];
const bytes = jsonlOf(rows);

test("the sha a path was last sent under is the one the whole-log reader answered", () => {
  const asked = [
    ["a path this root sent", "/a", "docs/one.md"],
    ["a newer failed consult does not answer for it", "/a", "docs/one.md"],
    ["a path only another root sent", "/a", "docs/three.md"],
    ["the other root's own", "/other", "docs/one.md"],
    ["a root the log has never seen", "/nowhere", "docs/one.md"],
    ["a sent row carrying no sha", "/a", "docs/nosha.md"],
    ["a path whose name JSON escapes", "/a", QUOTED],
  ];
  for (const [what, root, rel] of asked) {
    assert.equal(sentShaOf(bytes, root, rel), heldAsRows(rows, root, rel), what);
  }
  assert.equal(sentShaOf(bytes, "/a", "docs/one.md"), "aaa", "and the answer is the sha itself");
  assert.equal(sentShaOf(bytes, "/a", "docs/nosha.md"), null, "a row with no sha is no hash, not undefined");
  assert.equal(sentShaOf(Buffer.alloc(0), "/a", "docs/one.md"), null, "an unwritten log answers null");
});

test("the consult count is the count the parsed log gives", () => {
  assert.equal(consultCount(bytes), rows.filter((one) => one.kind === "consult").length);
  assert.equal(consultCount(Buffer.alloc(0)), 0);
  const torn = Buffer.concat([bytes, Buffer.from(`{"kind":"consult","id":"c6"${JSON.stringify(sent({ id: "c7" }))}\n`)]);
  assert.equal(consultCount(torn), consultCount(bytes), "a row an append tore carries the mark and is no consult");
  assert.deepEqual(logEntries(), [], "the sandbox holds no log of its own, so nothing here read the developer's");
});

const HOUR = 60 * 60 * 1000;
const ago = (hours) => new Date(Date.now() - hours * HOUR).toISOString();
const stop = ({ at, root, seconds = 300, command = "npm test" }) => ({
  kind: "consult", at, root,
  refused: [`run_check : \`${command}\` ran past ${seconds}s and was stopped. That clock is \`codex.checkMs\` in .forge.json`],
});
const ask = (rows, held) => checkStops(jsonlOf(rows), { command: "npm test", ms: 300_000, since: Date.now() - 24 * HOUR, ...held });

/* `at` is stamped when a consult starts and the row appended when it ends, so a long consult lands
   after short ones that began later: append order is not time order, and both the count and which
   stop is the newest have to come off the timestamps rather than off the position in the file. */
test("a stop out of append order is counted and ordered by its own time, not by where it landed", () => {
  const live = [stop({ at: ago(3), root: "/tmp/b" }), stop({ at: ago(5), root: "/tmp/a" })];
  assert.deepEqual(ask(live).map((one) => one.root), ["/tmp/b", "/tmp/a"],
    "the newest by time, whichever of them was appended last");
  const behind = [stop({ at: ago(2), root: "/tmp/live" }), stop({ at: ago(40), root: "/tmp/expired" })];
  assert.deepEqual(ask(behind).map((one) => one.root), ["/tmp/live"],
    "an expired row appended after a live one hides none of it: the walk filters and never stops");
  assert.deepEqual(ask([stop({ at: "not a time", root: "/tmp/x" })]), [],
    "and a row whose time will not read counts towards nothing rather than towards everything");
});

/* The mark is bytes in a JSON file, so a command the project declared with a quote in it is written
   escaped and searched for unescaped, and a project reads that it was never stopped at all. */
test("a declared command carrying a quote or a backslash is found in the log it was written to", () => {
  const command = 'npm test -- --grep "unit" --p C:\\x';
  const rows = [stop({ at: ago(2), root: "/tmp/q", command })];
  assert.deepEqual(ask(rows, { command }).map((one) => one.root), ["/tmp/q"]);
  assert.deepEqual(ask(rows, { command }).length, 1, "and once, not once per appearance of the mark");
});

/* A record answers for the clock it was taken at: a project that moved past every recorded stop has
   no evidence left against the clock it now declares, which is what lets the row clear itself. */
test("a stop counts only against a clock it was taken at or above", () => {
  const rows = [stop({ at: ago(2), root: "/tmp/a", seconds: 300 }), stop({ at: ago(1), root: "/tmp/b", seconds: 600 })];
  assert.deepEqual(ask(rows).map((one) => one.root), ["/tmp/b", "/tmp/a"], "at 300s both records speak");
  assert.deepEqual(ask(rows, { ms: 600_000 }).map((one) => one.root), ["/tmp/b"], "at 600s only the one taken there");
  assert.deepEqual(ask(rows, { ms: 900_000 }), [], "and past both, nothing recorded says anything");
  assert.deepEqual(ask(rows, { command: "npm run check" }), [], "another command's stops are not this one's");
});
