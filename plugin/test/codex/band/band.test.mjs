/* `forge codex band`: one typed question to the second model, a proposal that is never the field, and
   the measurement that decides whether the proposal is worth reading. Every case here runs against a
   faked gateway and faked readers; the one live run is criterion 23's and is posted on the issue. */
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves, so nothing here can touch the caller's own log. */
const sandbox = tempRoom("forge-codex-band-");
process.env.XDG_CONFIG_HOME = sandbox;

const { COMPLEXITY_NAMES, rungFrom } = await import("../../../src/ladder.mjs");
const { consults, isAnswered } = await import("../../../src/codex/codex-log.mjs");
const {
  BAND_ROLE, BAND_TOOL, BAND_USAGE, READERS, agreementOf, askBand, band, readAnswer, spearman, stateOf,
} = await import("../../../src/codex/band/band.mjs");

const SOURCE = readFileSync(fileURLToPath(new URL("../../../src/codex/band/band.mjs", import.meta.url)), "utf8");

const ROW = {
  documentId: "e8678546-0e83-48d5-abc4-ed5a93163d8f", issueId: "ISS-457", title: "forge record --evidence accepts a suite log",
  category: "bug", description: "## What happened\n\nA log path was refused. Filed 2026-09-06 against 3.36.161.", priority: "high", complexity: "s",
  createdAt: "2026-09-06T08:00:00.000Z", updatedAt: "2026-09-22T08:00:00.000Z", mergedAt: null,
  sessionContext: { lease: { at: "2026-09-22T08:00:00.000Z" } },
};

const VALUES = { ANTHROPIC_BASE_URL: "https://gateway.example.com", ANTHROPIC_AUTH_TOKEN: "sk-secret" };

/* The gateway's answer as `consume` shapes it: one forced call, its typed input, and a usage row. */
const answering = (input) => async () => ({
  text: "", stop: "tool_use", usage: { input_tokens: 900, output_tokens: 40 }, thought: null,
  calls: [{ id: "toolu_1", name: BAND_TOOL.name, input }],
});

test("the tool's bands are the ladder's five, smallest first, and the module spells none of its own", () => {
  assert.deepEqual(BAND_TOOL.input_schema.properties.band.enum, COMPLEXITY_NAMES);
  assert.equal(BAND_TOOL.input_schema.properties.band.enum, COMPLEXITY_NAMES,
    "the enum is the ladder's list itself, so a band added there is in the schema with no second edit");
  for (const one of COMPLEXITY_NAMES) {
    assert.doesNotMatch(SOURCE, new RegExp(`["'\`]${one}["'\`]`, "u"), `the module spells \`${one}\` nowhere of its own`);
  }
});

test("the role names each band's rung as the ladder gives it, and no minute and no date", () => {
  for (const one of COMPLEXITY_NAMES) {
    assert.match(BAND_ROLE, new RegExp(`\\b${one} a ${rungFrom(one)}\\b`, "u"), `${one} is said with its rung`);
  }
  assert.doesNotMatch(BAND_ROLE, /minute|\bday|\bage\b|\d{4}-\d{2}/u, "the role carries no cost and no date");
});

test("the state is the key, the title, the category and the body, and nothing dated or banded", () => {
  const state = stateOf(ROW);
  assert.deepEqual(Object.keys(state).sort(), ["body", "category", "key", "title"]);
  assert.equal(state.key, "ISS-457");
  assert.match(state.body, /A log path was refused\. Filed <date> against 3\.36\.161\./u,
    "a date the body quotes is one marker, and the version beside it is left alone");
  assert.match(BAND_ROLE, /<date>/u, "and the role says what the marker stands for");
  assert.match(BAND_ROLE, /<band>/u);
  /* The reviewer's four fixtures (ISS-2161 consult 2, F1): a dated title, a written date, an age, and
     the band a reader once set — each is the answer or the calendar in the state's clothing. */
  const dressed = stateOf({
    ...ROW,
    title: "Since 2026-09-15 the gate refuses a log path",
    description: "Filed September 15, 2026, opened three weeks ago and reopened 2 days ago; current complexity: l. "
      + "A run at 12h read it. Not a date: 3.36.161, ISS-2161, xl-sized is prose, and `xs` alone is a word.",
  });
  assert.equal(dressed.title, "Since <date> the gate refuses a log path");
  assert.match(dressed.body, /^Filed <date>, opened <date> and reopened <date>; current <band>\. /u);
  assert.match(dressed.body, /A run at 12h read it\./u, "a bare duration is no age");
  assert.match(dressed.body, /3\.36\.161, ISS-2161, xl-sized is prose, and `xs` alone is a word\./u,
    "a version, a key and a band name standing as a word are not a band mention");
  const text = JSON.stringify(state);
  for (const leak of ["2026-09", "high", "\"s\"", "lease", "priority", "complexity"]) {
    assert.ok(!text.includes(leak), `the state carries no ${leak}`);
  }
});

test("an answer outside the ladder is refused with the set named, and a missing call too", () => {
  const outside = readAnswer([{ id: "t", name: BAND_TOOL.name, input: { band: "huge", why: "x" } }]);
  assert.match(outside.refused, /`huge`/u);
  assert.ok(outside.refused.includes(COMPLEXITY_NAMES.join(", ")), "the set is named in the refusal");
  assert.equal(outside.band, undefined, "and no proposal is made from it");
  assert.match(readAnswer([]).refused, /no `band` call/u);
  assert.match(readAnswer([{ id: "t", name: "grep", input: {} }]).refused, /no `band` call/u);
});

test("a confidence is carried as the model gave it, and the module compares it to nothing", () => {
  assert.equal(readAnswer([{ id: "t", name: BAND_TOOL.name, input: { band: "m", confidence: 0.31, why: "x" } }]).confidence, 0.31);
  assert.equal(readAnswer([{ id: "t", name: BAND_TOOL.name, input: { band: "m", why: "x" } }]).confidence, null,
    "a confidence not given is null, not nought");
  assert.doesNotMatch(SOURCE, /confidence\s*(?:[<>]=?|[!=]==?)/u, "no comparison on it anywhere in the module");
});

test("one askBand call logs one band row, and the consult readers count none of it", async () => {
  const rows = [];
  const held = await askBand(VALUES, "cx/gpt-5.6-sol", ROW, {
    effort: "low", ask: answering({ band: "m", confidence: 0.7, why: "two files" }), log: rows.push.bind(rows),
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "band");
  assert.equal(rows[0].key, "ISS-457");
  assert.equal(rows[0].band, "m");
  assert.equal(rows[0].model, "cx/gpt-5.6-sol");
  assert.ok(rows[0].ok);
  assert.deepEqual(consults(rows), [], "`consults()` counts no band row");
  assert.equal(isAnswered(rows[0]), false, "and `isAnswered()` holds none answered");
  assert.equal(held.band, "m");
  assert.equal(held.hand, "s", "the hand band rides beside the proposal for the line and the measure");
});

test("a refused answer is logged as the row's own refusal and a thrown call as failed", async () => {
  const rows = [];
  const refused = await askBand(VALUES, "cx/x", ROW, { ask: answering({ band: "huge", why: "x" }), log: rows.push.bind(rows) });
  assert.match(refused.refused, /`huge`/u);
  assert.match(rows[0].refused, /`huge`/u);
  assert.ok(rows[0].ok, "the gateway answered; it is the answer that is refused");
  const failed = await askBand(VALUES, "cx/x", ROW, {
    ask: async () => { throw new Error("gateway answered 503: down"); }, log: rows.push.bind(rows),
  });
  assert.match(failed.refused, /503/u);
  assert.equal(rows[1].ok, false);
  assert.match(rows[1].error, /503/u);
});

/* Six runs, one unbanded by hand. Worked by hand for the sentence case: over the five banded runs the
   hand order ranks minutes at 0.21 and the proposed order at 0.87, so the proposed arm wins here and
   the swapped fixture below makes the hand arm win. */
const RUNS = [
  { key: "ISS-1", minutes: 20, hand: "xs", proposed: "xs" },
  { key: "ISS-2", minutes: 60, hand: "m", proposed: "s" },
  { key: "ISS-3", minutes: 70, hand: "s", proposed: "s" },
  { key: "ISS-4", minutes: 100, hand: "s", proposed: "m" },
  { key: "ISS-5", minutes: 90, hand: "l", proposed: "l" },
  { key: "ISS-6", minutes: 200, hand: "unset", proposed: "xl" },
];

test("agreementOf gives each arm every band's count and median, in the ladder's order", () => {
  const held = agreementOf(RUNS);
  assert.deepEqual(Object.keys(held.arms.hand.perBand), COMPLEXITY_NAMES);
  assert.deepEqual(Object.keys(held.arms.proposed.perBand), COMPLEXITY_NAMES);
  assert.deepEqual(held.arms.hand.perBand.s, { n: 2, median: 85 });
  assert.deepEqual(held.arms.hand.perBand.xl, { n: 0, median: null }, "a band no run landed in is a nought and a null, not a nought and a nought");
  assert.deepEqual(held.arms.proposed.perBand.s, { n: 2, median: 65 });
  assert.deepEqual(held.arms.proposed.perBand.m, { n: 1, median: 100 });
  assert.match(held.said.join("\n"), /hand +s +2 +85m/u);
  assert.match(held.said.join("\n"), /proposed +xl +1 +200m/u);
  assert.match(held.said.join("\n"), /hand +xl +0 +—/u, "the dash is the rank's own word for no corpus");
});

test("spearman ranks ties by their mean and answers null under two pairs or with no variance", () => {
  assert.equal(spearman([[0, 10], [1, 20], [2, 30]]), 1);
  assert.equal(spearman([[0, 30], [1, 20], [2, 10]]), -1);
  assert.equal(spearman([[0, 5]]), null);
  assert.equal(spearman([[0, 5], [1, 5]]), null, "no variance in minutes orders nothing");
  assert.equal(spearman([[1, 5], [1, 9]]), null, "no variance in bands either");
  const tied = spearman([[0, 10], [1, 20], [1, 30], [2, 40]]);
  assert.ok(tied > 0.9 && tied < 1, `ties at the middle rank take its mean: ${tied}`);
});

test("both coefficients run over the runs holding a hand band, and the unbanded are counted apart", () => {
  const held = agreementOf(RUNS);
  assert.equal(held.shared, 5, "the population both arms are ranked on");
  assert.equal(held.unset, 1);
  assert.equal(held.arms.hand.n, 5);
  assert.equal(held.arms.proposed.n, 6, "the proposed arm's table still holds every run");
  const banded = RUNS.filter((one) => one.hand !== "unset");
  assert.equal(held.arms.hand.rho, spearman(banded.map((one) => [COMPLEXITY_NAMES.indexOf(one.hand), one.minutes])));
  assert.equal(held.arms.proposed.rho, spearman(banded.map((one) => [COMPLEXITY_NAMES.indexOf(one.proposed), one.minutes])),
    "the proposed arm's coefficient is over the same five runs, not its six");
  assert.equal(held.arms.proposed.rhoAll, spearman(RUNS.map((one) => [COMPLEXITY_NAMES.indexOf(one.proposed), one.minutes])),
    "and its coverage of every run is a second figure, printed apart");
  assert.match(held.said.join("\n"), /1 run\(s\) whose issue holds no hand band, left out of both/u);
  assert.match(held.said.join("\n"), /over every run, the unbanded included/u);
});

test("the closing sentence names the arm whose coefficient is higher, or neither", () => {
  const last = (runs) => agreementOf(runs).said.at(-1);
  assert.match(last(RUNS), /the proposed band ordered minutes more closely/u);
  const flipped = RUNS.map((one) => ({ ...one, hand: one.proposed, proposed: one.hand === "unset" ? "xl" : one.hand }));
  assert.match(last(flipped), /the hand band ordered minutes more closely/u);
  /* The reviewer's three (consult 3, F2): no shared run, constant minutes, and one arm constant against
     the other varied. None may manufacture a comparison; each says the coefficient is unavailable. */
  const unavailable = /no spread|too few/iu;
  assert.match(last([{ key: "a", minutes: 10, hand: "unset", proposed: "m" }]), unavailable, "no shared run");
  assert.match(last([{ key: "a", minutes: 30, hand: "s", proposed: "m" }, { key: "b", minutes: 30, hand: "m", proposed: "l" }]),
    unavailable, "constant minutes");
  assert.match(last([{ key: "a", minutes: 10, hand: "s", proposed: "m" }, { key: "b", minutes: 20, hand: "l", proposed: "m" }]),
    unavailable, "a constant proposed band against varied hand bands");
  const both = agreementOf([{ key: "a", minutes: 10, hand: "s", proposed: "m" }, { key: "b", minutes: 20, hand: "l", proposed: "m" }]);
  assert.equal(both.arms.proposed.rho, null, "the constant arm's coefficient is null, not nought");
  assert.ok(both.arms.hand.rho > 0, "and the varied arm's still stands on its own line");
  assert.match(both.said.join("\n"), /proposed —/u, "the dash is what an unavailable coefficient prints as");
  const flat = [
    { key: "a", minutes: 10, hand: "xl", proposed: "xl" }, { key: "b", minutes: 20, hand: "l", proposed: "l" },
    { key: "c", minutes: 30, hand: "m", proposed: "m" },
  ];
  assert.match(last(flat), /neither ordered minutes/u, "both under nought is neither");
  const same = RUNS.map((one) => ({ ...one, proposed: one.hand === "unset" ? "xl" : one.hand }));
  assert.match(last(same), /neither ordered minutes more closely/u, "equal is neither too");
});

/* The readers a run of the verb is handed, and no writer: a proxy that throws on any other name is
   what proves the verb reaches nothing else, rather than a list of names it promises not to reach. */
const depsOf = (over = {}) => {
  const given = {
    gateway: () => ({ problem: null, values: VALUES, path: "profile.json" }),
    model: () => "cx/gpt-5.6-sol",
    rowOf: async (key) => ({ ...ROW, issueId: key, complexity: key === "ISS-2" ? null : "s" }),
    ask: answering({ band: "m", confidence: 0.8, why: "two files" }),
    log: () => true,
    runs: () => [],
    ...over,
  };
  return new Proxy(given, {
    get(target, name) {
      if (!READERS.includes(name)) throw new Error(`the verb reached \`${String(name)}\`, which is no reader of its`);
      return target[name];
    },
  });
};

const printed = async (rest, deps) => {
  const lines = [];
  const said = mock.method(console, "log", (line) => lines.push(String(line)));
  try {
    await band(rest, deps);
  } finally {
    said.mock.restore();
  }
  return lines.join("\n");
};

test("the verb reaches readers only, so nothing the tracker holds can change", async () => {
  assert.deepEqual([...READERS].sort(), ["ask", "gateway", "log", "model", "rowOf", "runs"]);
  for (const name of READERS) assert.doesNotMatch(name, /write|set|post|comment|record|advance/u);
  await printed(["ISS-457"], depsOf());
});

test("one line per key with the proposed band, the hand band or unset, the confidence and the why", async () => {
  const out = await printed(["ISS-457", "ISS-2"], depsOf());
  assert.match(out, /^ISS-457 {2}proposed m {2}hand s {2}confidence 0\.80 {2}two files$/mu);
  assert.match(out, /^ISS-2 {4}proposed m {2}hand unset {2}confidence 0\.80 {2}two files$/mu);
});

test("--measure asks once per distinct key over the measured runs and prints the agreement lines", async () => {
  const asked = [];
  const runs = () => [{ key: "ISS-1", minutes: 20 }, { key: "ISS-1", minutes: 30 }, { key: "ISS-2", minutes: 90 }];
  const ask = async (values, model, messages) => {
    asked.push(JSON.parse(messages[0].content).key);
    return answering({ band: "m", why: "x" })();
  };
  const out = await printed(["--measure"], depsOf({ runs, ask }));
  assert.deepEqual(asked.sort(), ["ISS-1", "ISS-2"], "one question per issue, however many runs it had");
  assert.match(out, /proposed +m +3 +30m/u, "three runs land in the proposed m");
  assert.match(out, /ordered minutes/u, "and the sentence closes it");
});

test("--json prints the proposals, or the measurement, as one object", async () => {
  const one = JSON.parse(await printed(["ISS-457", "--json"], depsOf()));
  assert.equal(one.proposals[0].key, "ISS-457");
  assert.equal(one.proposals[0].band, "m");
  const runs = () => [{ key: "ISS-1", minutes: 20 }];
  const two = JSON.parse(await printed(["--measure", "--json"], depsOf({ runs })));
  assert.ok(two.arms.hand && two.arms.proposed);
});

test("with no gateway the verb refuses with the consult's own route", async () => {
  const stopped = mock.method(process, "exit", () => { throw new Error("exit"); });
  const errors = [];
  const said = mock.method(console, "error", (line) => errors.push(String(line)));
  try {
    await assert.rejects(band(["ISS-457"], depsOf({
      gateway: () => ({ problem: "no gateway endpoint — `forge doctor --codex-url <endpoint> --codex-key <key>`", values: {}, path: "p" }),
    })));
  } finally {
    stopped.mock.restore();
    said.mock.restore();
  }
  assert.match(errors.join("\n"), /no gateway endpoint — `forge doctor --codex-url/u);
});

test("a model of this model's own family is not refused, and the help says a review is what that is for", async () => {
  const out = await printed(["ISS-457"], depsOf({ model: () => "claude-haiku-4-5-20251001" }));
  assert.match(out, /proposed m/u);
  assert.match(BAND_USAGE, /review/u);
  assert.match(BAND_USAGE, /family/u);
});

test("a key that is not one is refused before any question is spent", async () => {
  const asked = [];
  const stopped = mock.method(process, "exit", () => { throw new Error("exit"); });
  const said = mock.method(console, "error", () => {});
  try {
    await assert.rejects(band(["not-a-key"], depsOf({ ask: async () => { asked.push(1); } })));
  } finally {
    stopped.mock.restore();
    said.mock.restore();
  }
  assert.equal(asked.length, 0);
});
