/* Every rule `forge stats models` states, each with a case that fails without it. The attribution is
   proven over made transcripts; the floor and the comparability over rows built here, because the
   population a figure carries is the only input either rule reads. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

import { FLOOR, THIN, WHOLE, cellsOf, comparableIn } from "../../src/stats/model-rows.mjs";
import { comparableLines, modelLines } from "../../src/stats/models.mjs";
import { callsIn, modelRun } from "../../src/stats/corpus/transcripts.mjs";
import { FORGE, OPUS, PROJECT, at, indexIn, result, use } from "./fixture-runs.mjs";
import { UNAVAILABLE } from "../../src/stats/eval/outcomes.mjs";
import { tempRoom } from "../fixtures.mjs";

const SONNET = "claude-sonnet-5";
const SYNTHETIC = "<synthetic>";

const opened = () => JSON.stringify({
  timestamp: at(0),
  type: "user",
  message: { role: "user", content: "Skill forge:issue-flow ISS-99" },
});

/* One call and its answer, so the transcript is a run at all; the models are what each case varies. */
const transcriptOf = (models, command = "forge claim ISS-99") => [
  opened(),
  ...models.map((model, index) => use(`c${index}`, index, "Bash", { command }, model)),
  ...models.map((model, index) => result(`c${index}`, index + 1, "claimed")),
].join("\n");

const modelless = () => [
  opened(),
  JSON.stringify({
    timestamp: at(0),
    message: { role: "assistant", content: [{ type: "tool_use", id: "c0", name: "Bash", input: { command: "forge claim ISS-99" } }] },
  }),
  result("c0", 1, "claimed"),
].join("\n");

const corpus = () => {
  const room = tempRoom("stats-models-");
  indexIn(room, "session-one", "a0001.output", transcriptOf([OPUS, SYNTHETIC, OPUS]));
  indexIn(room, "session-one", "a0002.output", transcriptOf([SYNTHETIC, SYNTHETIC]));
  indexIn(room, "session-one", "a0003.output", transcriptOf([OPUS, SONNET]));
  indexIn(room, "session-one", "a0004.output", modelless());
  indexIn(room, "session-one", "a0005.output",
    transcriptOf([SONNET], "forge claim ISS-99 --pushed --ready"));
  return room;
};

const asked = (room, ...argv) =>
  spawnSync(FORGE, ["stats", "models", "--checkout", PROJECT, ...argv], {
    encoding: "utf8",
    env: { ...process.env, HOME: room, XDG_CONFIG_HOME: tempRoom("stats-models-home-"), TMPDIR: room },
  });

test("a synthetic turn is not a model, and a run two models wrote answers to neither", () => {
  assert.equal(modelRun(callsIn(transcriptOf([OPUS, SYNTHETIC, OPUS])).models), OPUS);
  assert.equal(modelRun(callsIn(transcriptOf([SYNTHETIC, SYNTHETIC])).models), "unattributed");
  assert.equal(modelRun(callsIn(modelless()).models), "unattributed");
  assert.equal(modelRun(callsIn(transcriptOf([OPUS, SONNET])).models), "mixed");
});

test("the model rows add up to the runs the reading counted", () => {
  const run = asked(corpus());
  assert.equal(run.status, 0, run.stderr);
  const out = run.stdout;
  assert.match(out, /^5 issue-flow run\(s\) over 4 model\(s\)/mu);
  /* Five runs over four rows: two arms with a name, the run two models wrote, and the two with no
     model between them — the corpus, and not the part of it a model can be named for. */
  assert.match(out, new RegExp(String.raw`^${OPUS}\s+1\s`, "mu"));
  assert.match(out, /^mixed\s+1\s/mu);
  assert.match(out, /^unattributed\s+2\s/mu);
  assert.equal([...out.matchAll(/^(claude-\S+|mixed|unattributed)\s+\d+\s+\d/gmu)]
    .reduce((sum, found) => sum + Number(found[0].trim().split(/\s+/u)[1]), 0), 5);
});

test("a run that captured the ready checkpoint reached the landing, having called no ship", () => {
  const run = asked(corpus());
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, new RegExp(String.raw`^${SONNET}\s+reached the landing\s+1/1`, "mu"));
  assert.match(run.stdout, new RegExp(String.raw`^${OPUS}\s+reached the landing\s+0/1`, "mu"));
});

test("a run at no rung keeps a row of its own in the cut", () => {
  const run = asked(corpus());
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, new RegExp(String.raw`^${SONNET}\s+unknown/unknown\s+1\s`, "mu"));
});

test("no pair of arms clears the floor, and the reading says so rather than leaving the block out", () => {
  const run = asked(corpus());
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /what this reading compares/u);
  assert.match(run.stdout, new RegExp(`no pair of models reaches ${FLOOR} observation\\(s\\)`, "u"));
});

const nowCorpus = () => {
  const room = tempRoom("stats-models-window-");
  indexIn(room, "session-one", "a0001.output", transcriptOf([OPUS]));
  indexIn(room, "session-one", "a0002.output",
    transcriptOf([SONNET]).replaceAll(at(0), new Date().toISOString()).replaceAll(at(1), new Date().toISOString()));
  return room;
};

test("a window narrows what is reported and never the corpus the pairing is resolved over", () => {
  const room = nowCorpus();
  const whole = JSON.parse(asked(room, "--json").stdout);
  assert.equal(whole.corpus, 2);
  assert.equal(whole.runs, 2);
  const windowed = JSON.parse(asked(room, "--json", "--since", "1d").stdout);
  assert.equal(windowed.runs, 1, "the window is what gets reported");
  assert.equal(windowed.corpus, 2, "and the whole corpus is still what a ruling is paired against");
});

const spendOver = (over, unrecognised = []) =>
  ({ over, unrecognised, wall: 1, tool: 1, calls: 1, gate: 1, consult: 1, recheck: 1 });
const rowOver = (model, over, got = [], unrecognised = []) =>
  ({ model, runs: over, spend: spendOver(over, unrecognised), got });
const cellOver = (model, cell, over, got = []) =>
  ({ cell, model, runs: over, spend: spendOver(over), got });
const reading = (models, cut = []) => ({
  models,
  cut,
  comparable: comparableIn(cellsOf(models, cut)),
  read: { horizon: 86_400_000, now: 0 },
});

test("a figure under ten observations of its own carries thin, and one at ten does not", () => {
  const nine = modelLines(reading([rowOver("nine", FLOOR - 1)])).join("\n");
  assert.match(nine, new RegExp(`^nine\\s+${FLOOR - 1}\\b.*\\b${THIN}$`, "mu"));
  const ten = modelLines(reading([rowOver("ten", FLOOR)])).join("\n");
  assert.doesNotMatch(ten, new RegExp(`^ten\\b.*\\b${THIN}$`, "mu"));
});

test("a figure whose population is empty prints unavailable in place of a count", () => {
  const held = reading([rowOver("one", FLOOR, [{ name: "reopened", count: null, over: 0 }])]);
  const printed = modelLines(held).join("\n");
  assert.match(printed, new RegExp(`^one\\s+reopened\\s+${UNAVAILABLE}`, "mu"));
});

test("a cell is compared on what it delivered and not on its minutes alone", () => {
  const delivered = (count) => [{ name: "corrected after the run", count, over: FLOOR }];
  const cut = [cellOver("left", "fix/s", FLOOR, delivered(1)), cellOver("right", "fix/s", FLOOR, delivered(8))];
  const models = [rowOver("left", FLOOR, delivered(1)), rowOver("right", FLOOR, delivered(8))];
  const held = comparableIn(cellsOf(models, cut));
  assert.ok(held.some((one) => one.cell === "fix/s" && one.figure === "corrected after the run"),
    "the cell's delivery figure is comparable, so a dispatcher reads more than its minutes there");
  const printed = modelLines(reading(models, cut), true).join("\n");
  assert.match(printed, /^left\s+fix\/s\s+corrected after the run\s+1\/10$/mu);
  assert.match(printed, /^right\s+fix\/s\s+corrected after the run\s+8\/10$/mu);
});

test("an accounting row keeps every figure it counted and is never a side of a comparison", () => {
  const models = ["mixed", "unattributed", "named"].map((model) => rowOver(model, FLOOR));
  const held = comparableIn(cellsOf(models, []));
  assert.equal(held.length, 0, "three rows at the floor and no pair, because two of them name no model");
  const printed = modelLines(reading(models, [])).join("\n");
  for (const model of ["mixed", "unattributed", "named"]) {
    assert.match(printed, new RegExp(`^${model}\\s+${FLOOR}\\s`, "mu"), `${model} keeps its row`);
  }
});

test("an arm with runs to spare is thin in a cell it barely entered", () => {
  const models = [rowOver("left", 12), rowOver("right", 12)];
  const cut = ["left", "right"].map((model) => cellOver(model, "fix/s", 2));
  const held = comparableIn(cellsOf(models, cut));
  assert.ok(held.some((one) => one.cell === WHOLE && one.figure === "wall"),
    "both arms clear the floor over the whole reading");
  assert.equal(held.filter((one) => one.cell === "fix/s").length, 0,
    "and neither clears it inside the cell, whatever the arm's total is");
});

test("a figure over many pairs of few runs is many observations of few runs, and is not compared", () => {
  /* The shape the real corpus printed: three runs on one arm, one of which owned forty-one issues,
     so the pair figures cleared a floor asked of the pairs alone. */
  const models = ["left", "right"].map((model) =>
    ({ model, runs: 3, spend: spendOver(3), got: [{ name: "parked or dropped", count: 41, over: 41 }] }));
  const held = comparableIn(cellsOf(models, []));
  assert.equal(held.length, 0, "forty-one observations of three runs is three observations of the model");
  const printed = modelLines(reading(models, [])).join("\n");
  assert.match(printed, /^left\s+parked or dropped\s+41\/41\s+thin$/mu);
});

test("a figure's own runs qualify it, so nine unread threads do not lend the tenth their count", () => {
  const behind = (runs) => [{ name: "parked or dropped", count: 1, over: 41, runs }];
  const alone = ["left", "right"].map((model) => rowOver(model, FLOOR, behind(1)));
  assert.equal(comparableIn(cellsOf(alone, [])).filter((one) => one.figure === "parked or dropped").length, 0,
    "forty-one pairs one run wrote is one run, whatever the nine beside it did");
  assert.ok(comparableIn(cellsOf(alone, [])).some((one) => one.figure === "wall"),
    "and the spend figures, which every one of the ten runs stands in, still compare");
  assert.match(modelLines(reading(alone, [])).join("\n"), /^left\s+parked or dropped\s+1\/41\s+thin$/mu);

  const spread = ["left", "right"].map((model) => rowOver(model, FLOOR, behind(FLOOR)));
  assert.equal(comparableIn(cellsOf(spread, [])).filter((one) => one.figure === "parked or dropped").length, 1,
    "the same forty-one pairs over ten runs is ten observations of the model");
});

test("an outcome figure is compared on its own population and not on the arm's run count", () => {
  const models = ["left", "right"].map((model) =>
    rowOver(model, 12,
      [{ name: "reopened", count: 0, over: 1 }, { name: "parked or dropped", count: 1, over: FLOOR }]));
  const held = comparableIn(cellsOf(models, []));
  assert.equal(held.filter((one) => one.figure === "reopened").length, 0);
  assert.equal(held.filter((one) => one.figure === "parked or dropped").length, 1);
});

test("the pairs that clear the floor are named, figure by figure", () => {
  const models = [rowOver("left", FLOOR), rowOver("right", FLOOR), rowOver("thin-one", 1)];
  const comparable = comparableIn(cellsOf(models, []));
  const printed = comparableLines(comparable, models.length, true).join("\n");
  assert.match(printed, /^\s+all\s+wall\s+left with right$/mu);
  assert.doesNotMatch(printed, /thin-one/u);
});

test("an empty window answers a reader asking for JSON in JSON", () => {
  const run = asked(corpus(), "--json", "--since", "1d");
  assert.equal(run.status, 0, run.stderr);
  const held = JSON.parse(run.stdout);
  assert.equal(held.runs, 0);
  assert.equal(held.corpus, 5, "and the corpus behind the empty window is still counted");
  assert.deepEqual([held.models, held.cut, held.comparable], [[], [], []]);
});

test("a class this reading never recognised prints the word and is compared on nothing", () => {
  const printed = asked(corpus()).stdout;
  assert.match(printed, new RegExp(String.raw`^${OPUS}\s+1\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+unrecognised`, "mu"));
  const models = ["left", "right"].map((model) => rowOver(model, FLOOR, [], ["gate"]));
  const held = comparableIn(cellsOf(models, []));
  assert.equal(held.filter((one) => one.figure === "gate").length, 0, "a gate nobody measured is no evidence");
  assert.ok(held.some((one) => one.figure === "wall"), "and the figures that were measured still compare");
});

test("every cut row the spend table printed has all of its delivery figures printed too", () => {
  const delivered = ["reached the landing", "reopened", "parked or dropped"]
    .map((name) => ({ name, count: 1, over: FLOOR }));
  const cut = Array.from({ length: 12 }, (_, at) => cellOver("arm", `fix/c${at}`, FLOOR, delivered));
  const printed = modelLines({ ...reading([], cut), cut }, false).join("\n");
  const spent = [...printed.matchAll(/^arm\s+(fix\/c\d+)\s+\d+\s+[\d.]/gmu)].map((one) => one[1]);
  assert.equal(spent.length, 10, "the cap is the rows, and it is the same cap on both tables");
  for (const cell of spent) {
    for (const one of delivered) {
      assert.match(printed, new RegExp(String.raw`^arm\s+${cell}\s+${one.name}\s`, "mu"),
        `${cell} lost ${one.name}`);
    }
  }
});
