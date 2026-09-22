/* `forge codex complexity`: one typed question to the second model, a proposal that is never the field, and
   the measurement that decides whether the proposal is worth reading. Every case here runs against a
   faked gateway and faked readers; the one live run is criterion 23's and is posted on the issue. */
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves, so nothing here can touch the caller's own log. */
const sandbox = tempRoom("forge-codex-complexity-");
process.env.XDG_CONFIG_HOME = sandbox;

const { COMPLEXITY_NAMES, rungFrom } = await import("../../../src/ladder.mjs");
const { consults, isAnswered } = await import("../../../src/codex/codex-log.mjs");
const {
  COMPLEXITY_ROLE, COMPLEXITY_TOOL, COMPLEXITY_USAGE, READERS, agreementOf, askComplexity, complexity, modelOf, readAnswer, spearman, stateOf,
} = await import("../../../src/codex/complexity/complexity.mjs");

const SOURCE = readFileSync(fileURLToPath(new URL("../../../src/codex/complexity/complexity.mjs", import.meta.url)), "utf8");

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
  calls: [{ id: "toolu_1", name: COMPLEXITY_TOOL.name, input }],
});

test("the tool's values are the ladder's five, smallest first, and the module spells none of its own", () => {
  assert.deepEqual(COMPLEXITY_TOOL.input_schema.properties.complexity.enum, COMPLEXITY_NAMES);
  assert.equal(COMPLEXITY_TOOL.input_schema.properties.complexity.enum, COMPLEXITY_NAMES,
    "the enum is the ladder's list itself, so a complexity added there is in the schema with no second edit");
  for (const one of COMPLEXITY_NAMES) {
    assert.doesNotMatch(SOURCE, new RegExp(`["'\`]${one}["'\`]`, "u"), `the module spells \`${one}\` nowhere of its own`);
  }
});

test("the role names each complexity's rung as the ladder gives it, and no minute and no date", () => {
  for (const one of COMPLEXITY_NAMES) {
    assert.match(COMPLEXITY_ROLE, new RegExp(`\\b${one} a ${rungFrom(one)}\\b`, "u"), `${one} is said with its rung`);
  }
  assert.doesNotMatch(COMPLEXITY_ROLE, /minute|\bday|\bage\b|\d{4}-\d{2}/u, "the role carries no cost and no date");
});

test("the state is the key, the title, the category and the body, and nothing dated or already sized", () => {
  const state = stateOf(ROW);
  assert.deepEqual(Object.keys(state).sort(), ["body", "category", "key", "title"]);
  assert.equal(state.key, "ISS-457");
  assert.match(state.body, /A log path was refused\. Filed <date> against 3\.36\.161\./u,
    "a date the body quotes is one marker, and the version beside it is left alone");
  assert.match(COMPLEXITY_ROLE, /<date>/u, "and the role says what the marker stands for");
  assert.match(COMPLEXITY_ROLE, /<complexity>/u);
  /* The reviewer's four fixtures (ISS-2161 consult 2, F1): a dated title, a written date, an age, and
     the complexity a reader once set — each is the answer or the calendar in the state's clothing. */
  const dressed = stateOf({
    ...ROW,
    title: "Since 2026-09-15 the gate refuses a log path",
    description: "Filed September 15, 2026, opened three weeks ago and reopened 2 days ago; current complexity: l. "
      + "A run at 12h read it. Not a date: 3.36.161, ISS-2161, xl-sized is prose, and `xs` alone is a word.",
  });
  assert.equal(dressed.title, "Since <date> the gate refuses a log path");
  assert.match(dressed.body, /^Filed <date>, opened <date> and reopened <date>; current <complexity>\. /u);
  assert.match(dressed.body, /A run at 12h read it\./u, "a bare duration is no age");
  assert.match(dressed.body, /3\.36\.161, ISS-2161, xl-sized is prose, and `xs` alone is a word\./u,
    "a version, a key and a complexity name standing as a word are not a complexity mention");
  /* The seventh consult's fixture: the value quoted, and a written date with no year. */
  const quoted = stateOf({ ...ROW, description: "Current complexity: `l`. Filed September 15. Due 3 October." });
  assert.equal(quoted.body, "Current <complexity>. Filed <date>. Due <date>.");
  const text = JSON.stringify(state);
  for (const leak of ["2026-09", "high", "\"s\"", "lease", "priority", "complexity"]) {
    assert.ok(!text.includes(leak), `the state carries no ${leak}`);
  }
});

test("an answer outside the ladder is refused with the set named, and a missing call too", () => {
  const outside = readAnswer([{ id: "t", name: COMPLEXITY_TOOL.name, input: { complexity: "huge", why: "x" } }]);
  assert.match(outside.refused, /`huge`/u);
  assert.ok(outside.refused.includes(COMPLEXITY_NAMES.join(", ")), "the set is named in the refusal");
  assert.equal(outside.proposed, undefined, "and no proposal is made from it");
  assert.match(readAnswer([]).refused, /no `complexity` call/u);
  assert.match(readAnswer([{ id: "t", name: "grep", input: {} }]).refused, /no `complexity` call/u);
});

test("a confidence is carried as the model gave it, and the module compares it to nothing", () => {
  assert.equal(readAnswer([{ id: "t", name: COMPLEXITY_TOOL.name, input: { complexity: "m", confidence: 0.31, why: "x" } }]).confidence, 0.31);
  assert.equal(readAnswer([{ id: "t", name: COMPLEXITY_TOOL.name, input: { complexity: "m", why: "x" } }]).confidence, null,
    "a confidence not given is null, not nought");
  assert.doesNotMatch(SOURCE, /confidence\s*(?:[<>]=?|[!=]==?)/u, "no comparison on it anywhere in the module");
});

test("one askComplexity call logs one complexity row, and the consult readers count none of it", async () => {
  const rows = [];
  const held = await askComplexity(VALUES, "cx/gpt-5.6-sol", ROW, {
    effort: "low", ask: answering({ complexity: "m", confidence: 0.7, why: "two files" }), log: rows.push.bind(rows),
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "complexity");
  assert.equal(rows[0].key, "ISS-457");
  assert.equal(rows[0].proposed, "m");
  assert.equal(rows[0].model, "cx/gpt-5.6-sol");
  assert.ok(rows[0].ok);
  assert.deepEqual(consults(rows), [], "`consults()` counts no complexity row");
  assert.equal(isAnswered(rows[0]), false, "and `isAnswered()` holds none answered");
  assert.equal(held.proposed, "m");
  assert.equal(held.tracker, "s", "the tracker's complexity rides beside the proposal for the line and the measure");
});

test("a refused answer is logged as the row's own refusal and a thrown call as failed", async () => {
  const rows = [];
  const refused = await askComplexity(VALUES, "cx/x", ROW, { ask: answering({ complexity: "huge", why: "x" }), log: rows.push.bind(rows) });
  assert.match(refused.refused, /`huge`/u);
  assert.match(rows[0].refused, /`huge`/u);
  assert.ok(rows[0].ok, "the gateway answered; it is the answer that is refused");
  const failed = await askComplexity(VALUES, "cx/x", ROW, {
    ask: async () => { throw new Error("gateway answered 503: down"); }, log: rows.push.bind(rows),
  });
  assert.match(failed.refused, /503/u);
  assert.equal(rows[1].ok, false);
  assert.match(rows[1].error, /503/u);
});

/* The first luna measurement hung for good: one socket to the gateway dead on its ninth retransmit, and
   the question on it had no deadline, so the batch and the run behind it waited forever. The consult
   gives its calls one clock; a question gets one of its own, and a caller's own signal is kept. */
test("every question travels with a deadline of its own, and a caller's signal is kept", async () => {
  const seen = [];
  const ask = async (values, model, messages, held) => { seen.push(held.signal); return answering({ complexity: "m", why: "x" })(); };
  await askComplexity(VALUES, "cx/x", ROW, { ask, log: () => true });
  assert.ok(seen[0] instanceof AbortSignal, "a question with no signal given still travels with one");
  assert.equal(seen[0].aborted, false);
  const own = AbortSignal.abort(new Error("the caller's own"));
  await askComplexity(VALUES, "cx/x", ROW, { ask, log: () => true, signal: own });
  assert.equal(seen[1], own, "a signal the caller gave is the one that travels");
});

/* Six runs, one with no complexity on the tracker. Worked by hand for the sentence case: over the five
   that hold one, the tracker's order ranks minutes at 0.21 and the proposed order at 0.87, so the proposed
   arm wins here and the swapped fixture below makes the tracker arm win. */
const RUNS = [
  { key: "ISS-1", minutes: 20, tracker: "xs", proposed: "xs" },
  { key: "ISS-2", minutes: 60, tracker: "m", proposed: "s" },
  { key: "ISS-3", minutes: 70, tracker: "s", proposed: "s" },
  { key: "ISS-4", minutes: 100, tracker: "s", proposed: "m" },
  { key: "ISS-5", minutes: 90, tracker: "l", proposed: "l" },
  { key: "ISS-6", minutes: 200, tracker: "unset", proposed: "xl" },
];

test("agreementOf gives each arm every complexity's count and median, in the ladder's order", () => {
  const held = agreementOf(RUNS);
  assert.deepEqual(Object.keys(held.arms.tracker.perName), COMPLEXITY_NAMES);
  assert.deepEqual(Object.keys(held.arms.proposed.perName), COMPLEXITY_NAMES);
  assert.deepEqual(held.arms.tracker.perName.s, { n: 2, median: 85 });
  assert.deepEqual(held.arms.tracker.perName.xl, { n: 0, median: null }, "a complexity no run landed in is a nought and a null, not a nought and a nought");
  assert.deepEqual(held.arms.proposed.perName.s, { n: 2, median: 65 });
  assert.deepEqual(held.arms.proposed.perName.m, { n: 1, median: 100 });
  assert.match(held.said.join("\n"), /tracker +s +2 +85m/u);
  assert.match(held.said.join("\n"), /proposed +xl +1 +200m/u);
  assert.match(held.said.join("\n"), /tracker +xl +0 +—/u, "the dash is the rank's own word for no corpus");
});

test("spearman ranks ties by their mean and answers null under two pairs or with no variance", () => {
  assert.equal(spearman([[0, 10], [1, 20], [2, 30]]), 1);
  assert.equal(spearman([[0, 30], [1, 20], [2, 10]]), -1);
  assert.equal(spearman([[0, 5]]), null);
  assert.equal(spearman([[0, 5], [1, 5]]), null, "no variance in minutes orders nothing");
  assert.equal(spearman([[1, 5], [1, 9]]), null, "no variance in complexities either");
  const tied = spearman([[0, 10], [1, 20], [1, 30], [2, 40]]);
  assert.ok(tied > 0.9 && tied < 1, `ties at the middle rank take its mean: ${tied}`);
});

test("both coefficients run over the runs holding a complexity on the tracker, and the rest are counted apart", () => {
  const held = agreementOf(RUNS);
  assert.equal(held.shared, 5, "the population both arms are ranked on");
  assert.equal(held.unset, 1);
  assert.equal(held.arms.tracker.n, 5);
  assert.equal(held.arms.proposed.n, 6, "the proposed arm's table still holds every run");
  const withValue = RUNS.filter((one) => one.tracker !== "unset");
  assert.equal(held.arms.tracker.rho, spearman(withValue.map((one) => [COMPLEXITY_NAMES.indexOf(one.tracker), one.minutes])));
  assert.equal(held.arms.proposed.rho, spearman(withValue.map((one) => [COMPLEXITY_NAMES.indexOf(one.proposed), one.minutes])),
    "the proposed arm's coefficient is over the same five runs, not its six");
  assert.equal(held.arms.proposed.rhoAll, spearman(RUNS.map((one) => [COMPLEXITY_NAMES.indexOf(one.proposed), one.minutes])),
    "and its coverage of every run is a second figure, printed apart");
  assert.match(held.said.join("\n"), /1 run\(s\) whose issue holds none, left out of both/u);
  assert.match(held.said.join("\n"), /over every run, the unset included/u);
});

test("the closing sentence names the arm whose coefficient is higher, or neither", () => {
  const last = (runs) => agreementOf(runs).said.at(-1);
  assert.match(last(RUNS), /the proposed complexity ordered minutes more closely/u);
  const flipped = RUNS.map((one) => ({ ...one, tracker: one.proposed, proposed: one.tracker === "unset" ? "xl" : one.tracker }));
  assert.match(last(flipped), /the tracker's complexity ordered minutes more closely/u);
  /* The reviewer's three (consult 3, F2): no shared run, constant minutes, and one arm constant against
     the other varied. None may manufacture a comparison; each says the coefficient is unavailable. */
  const unavailable = /no spread|too few/iu;
  assert.match(last([{ key: "a", minutes: 10, tracker: "unset", proposed: "m" }]), unavailable, "no shared run");
  assert.match(last([{ key: "a", minutes: 30, tracker: "s", proposed: "m" }, { key: "b", minutes: 30, tracker: "m", proposed: "l" }]),
    unavailable, "constant minutes");
  assert.match(last([{ key: "a", minutes: 10, tracker: "s", proposed: "m" }, { key: "b", minutes: 20, tracker: "l", proposed: "m" }]),
    unavailable, "a constant proposed complexity against varied tracker complexities");
  /* Two coefficients apart in the third decimal print the same figure, and a sentence saying one arm
     ordered minutes more closely "(0.35 against 0.35)" is refuted by its own parenthesis. The comparison
     is made on the figure printed, so what the sentence claims is what the reader can check. */
  const close = [
    { key: "a", minutes: 35, tracker: "l", proposed: "s" }, { key: "b", minutes: 45, tracker: "m", proposed: "m" },
    { key: "c", minutes: 10, tracker: "s", proposed: "m" }, { key: "d", minutes: 25, tracker: "l", proposed: "xl" },
    { key: "e", minutes: 20, tracker: "xs", proposed: "s" }, { key: "f", minutes: 10, tracker: "s", proposed: "xs" },
    { key: "g", minutes: 15, tracker: "l", proposed: "xs" },
  ];
  const { tracker, proposed } = agreementOf(close).arms;
  assert.notEqual(tracker.rho, proposed.rho, "the fixture must differ in the raw coefficient");
  assert.equal(tracker.rho.toFixed(2), proposed.rho.toFixed(2), "and print the same figure");
  assert.match(last(close), /^Equal at \d\.\d\d, so neither/u);
  const both = agreementOf([{ key: "a", minutes: 10, tracker: "s", proposed: "m" }, { key: "b", minutes: 20, tracker: "l", proposed: "m" }]);
  assert.equal(both.arms.proposed.rho, null, "the constant arm's coefficient is null, not nought");
  assert.ok(both.arms.tracker.rho > 0, "and the varied arm's still stands on its own line");
  assert.match(both.said.join("\n"), /proposed —/u, "the dash is what an unavailable coefficient prints as");
  const flat = [
    { key: "a", minutes: 10, tracker: "xl", proposed: "xl" }, { key: "b", minutes: 20, tracker: "l", proposed: "l" },
    { key: "c", minutes: 30, tracker: "m", proposed: "m" },
  ];
  assert.match(last(flat), /neither ordered minutes/u, "both under nought is neither");
  const same = RUNS.map((one) => ({ ...one, proposed: one.tracker === "unset" ? "xl" : one.tracker }));
  assert.match(last(same), /neither ordered minutes more closely/u, "equal is neither too");
});

/* The readers a run of the verb is handed, and no writer: a proxy that throws on any other name is
   what proves the verb reaches nothing else, rather than a list of names it promises not to reach. */
const depsOf = (over = {}) => {
  const given = {
    gateway: () => ({ problem: null, values: VALUES, path: "profile.json" }),
    model: (values, effort, asked) => asked ?? "cx/gpt-5.6-sol",
    rowOf: async (key) => ({ ...ROW, issueId: key, complexity: key === "ISS-2" ? null : "s" }),
    ask: answering({ complexity: "m", confidence: 0.8, why: "two files" }),
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
    await complexity(rest, deps);
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

test("one line per key with the proposed complexity, the tracker's or unset, the confidence and the why", async () => {
  const out = await printed(["ISS-457", "ISS-2"], depsOf());
  assert.match(out, /^ISS-457 {2}proposed m {2}tracker s {2}confidence 0\.80 {2}two files$/mu);
  assert.match(out, /^ISS-2 {4}proposed m {2}tracker unset {2}confidence 0\.80 {2}two files$/mu);
});

test("--measure asks once per distinct key over the measured runs and prints the agreement lines", async () => {
  const asked = [];
  const runs = () => [{ key: "ISS-1", minutes: 20 }, { key: "ISS-1", minutes: 30 }, { key: "ISS-2", minutes: 90 }];
  const ask = async (values, model, messages) => {
    asked.push(JSON.parse(messages[0].content).key);
    return answering({ complexity: "m", why: "x" })();
  };
  const out = await printed(["--measure"], depsOf({ runs, ask }));
  assert.deepEqual(asked.sort(), ["ISS-1", "ISS-2"], "one question per issue, however many runs it had");
  assert.match(out, /proposed +m +3 +30m/u, "three runs land in the proposed m");
  assert.match(out, /ordered minutes/u, "and the sentence closes it");
});

/* A corpus outlives its issues: a run whose issue the tracker no longer holds is one refused row in
   a measurement that stands, not a thrown read that ends a half-hour of questions with nothing said.
   The map is keyed by the key asked, which is the one the runs join on. */
test("a key the tracker lacks is one refused proposal and the rest of the measure stands", async () => {
  const runs = () => [{ key: "ISS-1", minutes: 20 }, { key: "ISS-9", minutes: 30 }, { key: "ISS-2", minutes: 90 }];
  const rowOf = async (key) => {
    if (key === "ISS-9") throw new Error("ISS-9 names no issue of this tracker");
    return { ...ROW, issueId: key, complexity: "s" };
  };
  const out = await printed(["--measure"], depsOf({ runs, rowOf }));
  assert.match(out, /1 run\(s\) left out, their question refused/u);
  assert.match(out, /proposed +m +2 +55m/u, "the two answered runs are measured");
  /* Consult 8, F1: a row the tracker would not give was no question sent, so it is no question paid for —
     counted in the per-question line, three missing issues beside two ten-second answers would read as
     five questions at a median of nought. */
  assert.match(out, /over 2 question\(s\)/u, "the lookup that failed was never a question");
});

test("--json prints the proposals, or the measurement, as one object", async () => {
  const one = JSON.parse(await printed(["ISS-457", "--json"], depsOf()));
  assert.equal(one.proposals[0].key, "ISS-457");
  assert.equal(one.proposals[0].proposed, "m");
  const runs = () => [{ key: "ISS-1", minutes: 20 }];
  const two = JSON.parse(await printed(["--measure", "--json"], depsOf({ runs })));
  assert.ok(two.arms.tracker && two.arms.proposed);
});

test("with no gateway the verb refuses with the consult's own route", async () => {
  const stopped = mock.method(process, "exit", () => { throw new Error("exit"); });
  const errors = [];
  const said = mock.method(console, "error", (line) => errors.push(String(line)));
  try {
    await assert.rejects(complexity(["ISS-457"], depsOf({
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
  assert.match(COMPLEXITY_USAGE, /review/u);
  assert.match(COMPLEXITY_USAGE, /family/u);
});

test("a key that is not one is refused before any question is spent", async () => {
  const asked = [];
  const stopped = mock.method(process, "exit", () => { throw new Error("exit"); });
  const said = mock.method(console, "error", () => {});
  try {
    await assert.rejects(complexity(["not-a-key"], depsOf({ ask: async () => { asked.push(1); } })));
  } finally {
    stopped.mock.restore();
    said.mock.restore();
  }
  assert.equal(asked.length, 0);
});

/* The classifier's model is its own and not the reviewer's: a closed-set question is what a lower
   model answers as well, and which one is the eval's to decide, so the verb takes a model by id or by
   the profile's slot and the machine config names the standing one. `modelOf` is the one reader. */
test("--model takes a gateway id as it is, and a slot through the profile", () => {
  const values = { ANTHROPIC_DEFAULT_HAIKU_MODEL: "cx/gpt-5.6-luna", ANTHROPIC_DEFAULT_OPUS_MODEL: "cx/gpt-5.6-terra" };
  assert.equal(modelOf(values, "medium", "cx/gpt-5.6-luna"), "cx/gpt-5.6-luna", "an id with a slash travels as typed");
  assert.equal(modelOf(values, "medium", "haiku"), "cx/gpt-5.6-luna", "a bare word is a slot of the profile");
  assert.equal(modelOf(values, "medium", "OPUS"), "cx/gpt-5.6-terra", "whatever its case");
});

test("a slot the profile has not got is refused naming the slots it has", () => {
  const values = { ANTHROPIC_DEFAULT_HAIKU_MODEL: "cx/gpt-5.6-luna", ANTHROPIC_DEFAULT_OPUS_MODEL: "cx/gpt-5.6-terra" };
  const stopped = mock.method(process, "exit", () => { throw new Error("exit"); });
  const errors = [];
  const said = mock.method(console, "error", (line) => errors.push(String(line)));
  try {
    assert.throws(() => modelOf(values, "medium", "pluto"), /exit/u);
  } finally {
    stopped.mock.restore();
    said.mock.restore();
  }
  assert.match(errors.join("\n"), /`pluto`/u);
  assert.match(errors.join("\n"), /haiku, opus/u, "the slots the profile holds, by name");
});

test("with no --model the machine's codex.complexityModel answers, and absent that the consult's own model", () => {
  /* The sandbox holds no codex.model, so the consult's slot is the plugin's default, `fable`. */
  const values = { ANTHROPIC_DEFAULT_HAIKU_MODEL: "cx/gpt-5.6-luna", ANTHROPIC_DEFAULT_FABLE_MODEL: "cx/gpt-6-astra-high" };
  assert.equal(modelOf(values, "medium", undefined, { complexityModel: "haiku" }), "cx/gpt-5.6-luna", "the key, as a slot");
  assert.equal(modelOf(values, "medium", undefined, { complexityModel: "cx/gpt-5.6-terra" }), "cx/gpt-5.6-terra", "or as an id");
  assert.equal(modelOf(values, "medium", undefined, {}), "cx/gpt-6-astra-high",
    "no key: the consult's rung table and slot, which is what the verb did before the key existed");
  assert.equal(modelOf(values, "medium", "cx/gpt-5.6-terra", { complexityModel: "haiku" }), "cx/gpt-5.6-terra", "the flag wins over the key");
});

test("the verb passes --model through and prints which model answered", async () => {
  const askedOf = [];
  const ask = async (values, model) => { askedOf.push(model); return answering({ complexity: "m", why: "x" })(); };
  const out = await printed(["ISS-457", "--model", "cx/gpt-5.6-luna"], depsOf({ ask }));
  assert.deepEqual(askedOf, ["cx/gpt-5.6-luna"]);
  const json = JSON.parse(await printed(["ISS-457", "--model", "cx/gpt-5.6-luna", "--json"], depsOf({ ask })));
  assert.equal(json.model, "cx/gpt-5.6-luna");
  assert.match(out, /proposed m/u);
});

/* The eval's other two figures: how often the proposal is the complexity the tracker holds, and what one
   question costs, so two models are compared on what they get right and what they spend. */
test("the measure prints agreement with the tracker and the per-question cost", async () => {
  const runs = () => [{ key: "ISS-1", minutes: 20 }, { key: "ISS-2", minutes: 90 }, { key: "ISS-3", minutes: 50 }];
  const rowOf = async (key) => ({ ...ROW, issueId: key, complexity: { "ISS-1": "s", "ISS-2": "l", "ISS-3": "s" }[key] });
  /* Keyed on the issue and not on a counter, so the text run and the JSON run below read the same answers. */
  const ask = async (values, model, messages) => {
    const key = JSON.parse(messages[0].content).key;
    const tokens = { "ISS-1": 1000, "ISS-2": 2000, "ISS-3": 3000 }[key];
    return { text: "", stop: "tool_use", thought: null, usage: { input_tokens: tokens, output_tokens: 40 },
      calls: [{ id: "t", name: COMPLEXITY_TOOL.name, input: { complexity: key === "ISS-2" ? "l" : "m", why: "x" } }] };
  };
  const out = await printed(["--measure"], depsOf({ runs, rowOf, ask }));
  assert.match(out, /Agreement with the tracker on the 3 shared run\(s\): 1 of 3\./u, "ISS-2 alone agrees");
  assert.match(out, /Per question: median \d+(\.\d+)?s, median 2000 input tokens, over 3 question\(s\)\./u);
  const json = JSON.parse(await printed(["--measure", "--json"], depsOf({ runs, rowOf, ask })));
  assert.equal(json.agreement.agreed, 1);
  assert.equal(json.agreement.of, 3);
  assert.equal(json.cost.medianInputTokens, 2000);
  assert.equal(json.cost.questions, 3);
});
