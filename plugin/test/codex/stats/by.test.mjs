import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves: the live config directory holds the device's own log. */
process.env.XDG_CONFIG_HOME = tempRoom("forge-codex-stats-by-");

const { logPath } = await import("../../../src/codex/codex-log.mjs");
const { EVAL_USAGE, STATS_USAGE, evalObject, printStats } = await import("../../../src/codex/codex-stats.mjs");
const { LOG_USAGE, printLog } = await import("../../../src/codex/log/verbs.mjs");
const { refusing } = await import("../../../src/resolve/settings.mjs");

const MODELS = ["cx/alpha", "cx/beta", "cx/gamma"];
const AT = Date.parse("2026-09-01T00:00:00.000Z");
const stamp = (minute) => new Date(AT + minute * 60_000).toISOString();
const reply = (many) => [`CODEX: ${many} findings`, "",
  ...Array.from({ length: many }, (_, at) => `- **F${at + 1} — New — major:** \`a.mjs:${at + 1}\` — thing ${at + 1}.`)].join("\n");
/* Each model's timed rows are odd in number, so a median is the middle row under the definition of
   2026-09-05 and under the mean-of-two-middles one ISS-364 gave it since. */
const consult = (id, at, n, held = {}) => ({
  kind: "consult", id, ok: true, root: "/r", at: stamp(at), model: MODELS[n % 3], effortVia: "model",
  ...(n % 11 === 5 || n === 1 || n === 2 ? {} : { ms: 1000 * (10 + ((n * 7) % 50)) }),
  usage: { input_tokens: 100 + n, cache_read_input_tokens: 50 * (n % 5), cache_creation_input_tokens: 10 },
  prompt: n < 50 ? { v: 3, sha: "aaaaaaaa" } : { v: 4, sha: "bbbbbbbb" },
  reply: reply(n % 4), ...held,
});
const verdictOn = (one, n, at) => {
  const many = n % 4;
  if (!many || n % 5 === 0) return null;
  const kept = Math.ceil(many / 2);
  if (n % 7 === 0) return { kind: "verdict", of: one.id, at: stamp(at), accepted: kept, rejected: many - kept };
  const ids = Array.from({ length: many }, (_, i) => `F${i + 1}`);
  return { kind: "verdict", of: one.id, at: stamp(at), accepted: kept, rejected: many - kept,
    kept: ids.slice(0, kept), dropped: Object.fromEntries(ids.slice(kept).map((id) => [id, "not so"])) };
};
/* `older` answered consults ahead of the hundred, one failed consult between, and every third verdict written after the last consult. */
const fixtureLog = (older = 0, window = 100) => {
  const rows = [];
  const late = [];
  for (let n = 0; n < older; n += 1) rows.push(consult(`o${n}`, n, n + 1, { model: "cx/older" }));
  rows.push({ kind: "consult", id: "x0", ok: false, root: "/r", at: stamp(older), model: "cx/alpha", error: "timed out" });
  for (let n = 0; n < window; n += 1) {
    const one = consult(`w${n}`, older + 1 + n * 2, n);
    rows.push(one);
    const said = verdictOn(one, n, older + 2 + n * 2);
    if (said) (n % 3 === 0 ? late : rows).push(said);
  }
  return [...rows, ...late.map((one, at) => ({ ...one, at: stamp(older + 1 + window * 2 + at) }))];
};

/* What `forge codex log --score` printed at e27bfa0a (2026-09-05) over `fixtureLog(0)`: that hundred and its verdicts alone. */
const PRINTED_2026_09_05 = [
  "cx/alpha                   34 consults    51 findings (9 none)    27 accepted   13 rejected    35s median  39% cached",
  "cx/beta                    33 consults    49 findings (8 none)    27 accepted   13 rejected    37s median  39% cached",
  "cx/gamma                   33 consults    50 findings (8 none)    26 accepted   14 rejected    34s median  38% cached",
];

const FIGURES = /^(\S+)(?: via model)? +(\d+) consults +(\d+) findings \((\d+) none\) +(\d+) accepted +(\d+) rejected .*?([\d.]+)s median +(\d+)% cached$/u;
const figuresIn = (line) => FIGURES.exec(line)?.slice(1) ?? null;

const logged = (entries) => {
  mkdirSync(dirname(logPath()), { recursive: true });
  writeFileSync(logPath(), entries.map((one) => `${JSON.stringify(one)}\n`).join(""));
};

const asVerb = async (then) => {
  const said = mock.method(console, "log", () => {});
  try {
    const refused = await refusing(async () => {
      try {
        await then();
        return null;
      } catch (error) {
        return error.message;
      }
    });
    return { refused, lines: said.mock.calls.flatMap((call) => String(call.arguments[0]).split("\n")) };
  } finally {
    said.mock.restore();
  }
};

test("stats by model over the last hundred prints the figures log --score printed on 2026-09-05 for those hundred", async () => {
  logged(fixtureLog(7));
  const { refused, lines } = await asVerb(() => printStats(["--by", "model"]));
  assert.equal(refused, null);
  const printed = lines.map(figuresIn).filter(Boolean);
  assert.deepEqual(printed, PRINTED_2026_09_05.map(figuresIn),
    "consults, findings, none, accepted, rejected, median and cache per model, the seven older consults outside the window and a third of the verdicts after it");
  assert.ok(!lines.some((line) => line.startsWith("cx/older")), "an older consult is not in the last hundred");
  assert.match(lines[0], /^the last 100 consult\(s\), .*, by model$/u);
});

test("stats by prompt groups by the key the eval groups a prompt by", async () => {
  const entries = fixtureLog(7);
  logged(entries);
  const { lines } = await asVerb(() => printStats(["--by", "prompt"]));
  const heads = lines.filter((line) => / consults /u.test(line)).map((line) => line.split(/ {2,}/u)[0]);
  assert.deepEqual(heads, ["v3 aaaaaaaa", "v4 bbbbbbbb"]);
  assert.deepEqual([...new Set(evalObject(entries).now.groups.map((one) => one.prompt))].sort(), heads,
    "the eval's own prompt field over the same hundred");
  assert.ok(lines.some((line) => /^v3 aaaaaaaa +50 consults +73 findings/u.test(line)));
});

test("stats with no grouping prints the window as one group and keeps what it printed before", async () => {
  logged(fixtureLog(7));
  const { lines } = await asVerb(() => printStats([]));
  for (const held of ["consults          100", "read from cache   39% of 25950 input token(s)", "prompt v3 aaaaaaaa  50 consult(s)",
    "by round kind, a retried consult counted apart from the calls it reached",
    "pass      100 consult(s)  read from cache 39% of 25950 input token(s)  calls reached 0:100  retried 0"]) {
    assert.ok(lines.includes(held), `still printed: ${held}`);
  }
  assert.ok(lines.some((line) => /^the window +100 consults +150 findings \(25 none\) +80 accepted +40 rejected .* 35s median +39% cached$/u.test(line)),
    "and the window's own findings, dispositions, median and cache share");
});

test("a grouping stats does not take is refused with the three it does, before the log is read", async () => {
  logged([]);
  const { refused, lines } = await asVerb(() => printStats(["--by", "effort"]));
  assert.equal(refused, "codex: stats --by takes window, model, prompt, not `effort`.");
  assert.deepEqual(lines, [], "an empty log would have printed that its window is empty, had it been read first");
});

test("log --score is refused with the stats command that reads the same rows", async () => {
  logged(fixtureLog(7));
  const held = await asVerb(() => printLog(["--score"]));
  assert.match(held.refused, /`log --score` is `forge codex stats --by model` now/u);
  assert.match(held.refused, /`forge codex stats --by model --last 107`/u, "seven older and the hundred, the failed one not answered");
  logged([]);
  const none = await asVerb(() => printLog(["--score"]));
  assert.match(none.refused, /holds no answered consult yet: `forge codex stats --by model`\.$/u);
});

test("the help says where each figure lives", () => {
  assert.doesNotMatch(LOG_USAGE, /--score/u);
  assert.match(STATS_USAGE, /^Usage: forge codex stats \[--by window\|model\|prompt\]/u);
  assert.match(EVAL_USAGE, /^`forge codex stats` over two windows/mu);
});
