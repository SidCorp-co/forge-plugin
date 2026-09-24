/* `forge stats surface`: the texts walked, the count endpoint as the only source of a token, what
   repeats across the texts, and the guide-part reads priced at the text measured. The texts and the
   endpoint are stood in for here, a local server in the endpoint's place: the walk itself spawns
   every help name there is, which cli-help.test.mjs already pays for once. */
import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { GUIDE, HELP, surfaceNodes } from "../../src/stats/surface/nodes.mjs";
import { counterFor } from "../../src/stats/surface/count.mjs";
import {
  pricedParts, printSurface, repetitionOf, surfaceLines, surfaceReading,
} from "../../src/stats/surface/surface.mjs";
import { slugFor } from "../../src/stats/corpus/corpus.mjs";
import { tempRoom } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
process.env.XDG_CONFIG_HOME = tempRoom("surface-home-");

const node = (name, kind = HELP, keys = []) => ({ kind, name, argv: [name], keys });
/* Each stand-in text is its own name's entry here, so a case says what was read by naming it. */
const reading = (texts) => ({
  nodes: async () => Object.keys(texts).map((name) => node(name, name.startsWith("guide ") ? GUIDE : HELP,
    name.startsWith("guide ") ? [name.slice("guide ".length)] : [])),
  read: async ([name]) => ({ text: texts[name] }),
  parts: () => ({ flow: "default", runs: 0, priced: [], unpriced: { reads: 0, parts: [] } }),
});

/* Answers a text's token count as its count of words, which no byte count reproduces, and records
   every request so a case can say what was sent. A text named in `failing` is answered 500. */
const endpoint = async ({ failing = [], limited = 0 } = {}) => {
  const asked = [];
  let refusals = limited;
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      const sent = JSON.parse(body);
      asked.push({ url: request.url, headers: request.headers, sent });
      const text = sent.messages[0].content;
      if (refusals > 0) {
        refusals -= 1;
        response.writeHead(429, { "retry-after": "7" });
        return response.end("{}");
      }
      if (failing.includes(text)) {
        response.writeHead(500, { "content-type": "application/json" });
        return response.end(JSON.stringify({ error: { message: "overloaded" } }));
      }
      response.writeHead(200, { "content-type": "application/json" });
      return response.end(JSON.stringify({ input_tokens: text.split(/\s+/u).filter(Boolean).length }));
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { asked, origin, settings: () => ({ key: "sk-test", origin }), close: () => server.close() };
};

const TEXTS = {
  "forge a -h": "Usage: forge a\nshared line one here\nshared line two here",
  "forge b -h": "Usage: forge b [--x]\nshared line one here\nshared line two here",
  "guide skill ref": "A reference of five words",
};

test("the walk holds every help name and every guide part this copy serves, one node a contract part", async () => {
  const nodes = await surfaceNodes();
  const names = nodes.map((one) => one.name);
  for (const name of ["forge -h", "forge record verdict -h", "forge stats surface -h", "forge doctor copy -h",
    "forge guide contract", "forge guide contract approved", "forge guide issue-flow", "forge guide issue-flow verification"]) {
    assert.ok(names.includes(name), `${name} is not walked`);
  }
  assert.equal(new Set(names).size, names.length, "and no text is walked twice");
  const closing = nodes.find((one) => one.keys?.includes("contract dropped"));
  assert.ok(closing?.keys.includes("contract closed"), "one part answering two keys is one node carrying both");
  assert.ok(nodes.every((one) => one.kind === HELP || one.kind === GUIDE));
});

test("each row carries its characters, and without --model every token figure is not measured and nothing is sent", async () => {
  const served = await endpoint();
  const held = await surfaceReading({}, { ...reading(TEXTS), settings: served.settings });
  served.close();
  assert.deepEqual(held.texts.map((one) => [one.name, one.chars, one.tokens]),
    Object.entries(TEXTS).map(([name, text]) => [name, text.length, null]));
  assert.equal(held.tokens, null);
  assert.match(held.unmeasured, /--model <id>/u);
  assert.equal(served.asked.length, 0, "no request went to the count endpoint");
  const said = surfaceLines(held).join("\n");
  assert.match(said, /tokens {6}not measured: no --model was named/u);
  assert.doesNotMatch(said.split("\n").filter((line) => line.startsWith("  forge")).join("\n"), /\d+$/mu,
    "and no text row ends in a token number");
});

test("without the key every token figure is not measured, the key's flag is named, and nothing is sent", async () => {
  const served = await endpoint();
  const held = await surfaceReading({ model: "claude-x" }, { ...reading(TEXTS), settings: () => ({ key: null, origin: served.origin }) });
  served.close();
  assert.match(held.unmeasured, /holds no key for Anthropic's count endpoint.*forge doctor --anthropic-key <key>/u);
  assert.equal(held.tokens, null);
  assert.equal(held.repeated.tokens, null);
  assert.equal(served.asked.length, 0);
});

test("a counted row is the endpoint's input_tokens for that text under the named model, and the total is their sum", async () => {
  const served = await endpoint();
  const held = await surfaceReading({ model: "claude-x" }, { ...reading(TEXTS), settings: served.settings });
  served.close();
  assert.deepEqual(held.texts.map((one) => one.tokens), [11, 12, 5]);
  assert.equal(held.tokens, 28);
  assert.equal(held.model, "claude-x");
  assert.equal(held.origin, served.origin);
  const first = served.asked[0];
  assert.equal(first.url, "/v1/messages/count_tokens");
  assert.equal(first.headers["x-api-key"], "sk-test");
  assert.equal(first.headers["anthropic-version"], "2023-06-01");
  assert.equal(first.sent.model, "claude-x");
  assert.ok(Object.values(TEXTS).includes(first.sent.messages[0].content));
  assert.match(surfaceLines(held).join("\n"), new RegExp(`tokens {6}28 in all, counted against claude-x at ${served.origin}`, "u"));
});

test("a text whose count failed prints no number, and the total is not measured with how many failed and why", async () => {
  const served = await endpoint({ failing: [TEXTS["forge b -h"]] });
  const held = await surfaceReading({ model: "claude-x" }, { ...reading(TEXTS), settings: served.settings });
  served.close();
  assert.equal(held.texts[1].tokens, null);
  assert.equal(held.texts[0].tokens, 11);
  assert.equal(held.tokens, null);
  assert.equal(held.unmeasured, "1 of 3 text(s) could not be counted, first forge b -h: "
    + "the count endpoint answered 500: overloaded");
  assert.match(surfaceLines(held).join("\n"), new RegExp(`not measured in all: .*every other figure counted against claude-x at ${served.origin}`, "u"),
    "and the figures that were counted still name what counted them");
});

test("a repetition count that failed says why beside the figure, and the total it did not touch stands", async () => {
  const served = await endpoint({ failing: ["shared line one here\nshared line two here", "shared line two here\nshared line one here"] });
  const held = await surfaceReading({ model: "claude-x" }, { ...reading(TEXTS), settings: served.settings });
  served.close();
  assert.equal(held.tokens, 28);
  assert.equal(held.repeated.tokens, null);
  assert.match(surfaceLines(held).join("\n"),
    /not measured tokens: the count endpoint answered 500: overloaded/u);
});

test("a body that never arrives is that text's count not taken, and every other text's count stands", async () => {
  const count = counterFor({ model: "claude-x", key: "sk-test", origin: "http://stand.in",
    fetchImpl: async () => ({ status: 200, ok: true, headers: new Map(), text: async () => { throw new Error("body dropped"); } }) });
  assert.deepEqual(await count("a text"), { unmeasured: "the count endpoint gave no answer: body dropped" });
});

test("a rate-limited count waits what the endpoint said and is asked again", async () => {
  const served = await endpoint({ limited: 1 });
  const waited = [];
  const count = counterFor({ model: "claude-x", key: "sk-test", origin: served.origin, waits: async (seconds) => { waited.push(seconds); } });
  const answer = await count("three words here");
  served.close();
  assert.deepEqual(answer, { tokens: 3 });
  assert.deepEqual(waited, [7]);
});

test("what repeats is the lines two texts both print, their printings past the first, and those printings counted", async () => {
  const served = await endpoint();
  const held = await surfaceReading({ model: "claude-x" }, { ...reading(TEXTS), settings: served.settings });
  served.close();
  assert.deepEqual({ lines: held.repeated.lines, beyond: held.repeated.beyond, chars: held.repeated.chars },
    { lines: 2, beyond: 2, chars: "shared line one here".length + "shared line two here".length });
  assert.equal(held.repeated.tokens, 8, "the two printings past the first, sent as one text");
  assert.ok(served.asked.some((one) => one.sent.messages[0].content === "shared line one here\nshared line two here"
    || one.sent.messages[0].content === "shared line two here\nshared line one here"));
});

test("a block copied into a second text raises the repetition, and a text added raises the total", async () => {
  const served = await endpoint();
  const measure = (texts) => surfaceReading({ model: "claude-x" }, { ...reading(texts), settings: served.settings });
  const before = await measure(TEXTS);
  const copied = await measure({ ...TEXTS, "guide skill ref": `${TEXTS["guide skill ref"]}\nshared line one here\nshared line two here` });
  const added = await measure({ ...TEXTS, "forge c -h": "Usage: forge c and nothing else" });
  served.close();
  assert.ok(copied.repeated.beyond > before.repeated.beyond, "the copied block is repetition");
  assert.ok(copied.repeated.chars > before.repeated.chars);
  assert.ok(copied.repeated.tokens > before.repeated.tokens);
  assert.ok(added.tokens > before.tokens, "the added text is in the total");
  assert.equal(repetitionOf([{ text: "one line here" }, { text: "another line" }]).lines, 0, "and two unlike texts repeat nothing");
});

test("a read is priced at the text measured under its flow, by every key its part answers, and the rest counted unpriced", () => {
  const texts = [
    { kind: GUIDE, name: "forge guide issue-flow verification", keys: ["issue-flow verification"], tokens: 100 },
    { kind: GUIDE, name: "forge guide contract closed", keys: ["contract closed", "contract dropped"], tokens: 10 },
    { kind: HELP, name: "forge record -h", keys: [], tokens: 50 },
  ];
  const { priced, unpriced } = pricedParts([
    ["issue-flow verification (default)", { calls: 5, runs: 3, again: 1 }],
    ["contract dropped (default)", { calls: 2, runs: 2, again: 0 }],
    ["issue-flow verification (lean)", { calls: 4, runs: 4, again: 0 }],
    ["issue-flow 4 (default)", { calls: 3, runs: 3, again: 0 }],
    ["(index) (flow unread)", { calls: 6, runs: 6, again: 0 }],
  ], texts, "default");
  assert.deepEqual(priced.map(({ key, calls, runs, again, perCall, spent, spentAgain }) =>
    [key, calls, runs, again, perCall, spent, spentAgain]), [
    ["issue-flow verification", 5, 3, 1, 100, 500, 200],
    ["contract dropped", 2, 2, 0, 10, 20, 0],
  ]);
  assert.equal(unpriced.reads, 13);
  assert.deepEqual(unpriced.parts.map(([key]) => key),
    ["issue-flow verification (lean)", "issue-flow 4 (default)", "(index) (flow unread)"]);
});

const transcript = (lines) => lines.map((one) => JSON.stringify(one)).join("\n");
const at = (seconds) => new Date(Date.parse("2026-09-01T00:00:00.000Z") + seconds * 1000).toISOString();
const bash = (id, seconds, command, content) => [
  { timestamp: at(seconds), message: { role: "assistant", content: [{ type: "tool_use", id, name: "Bash", input: { command } }] } },
  { timestamp: at(seconds + 1), message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content, is_error: false }] } },
];

test("the guide parts a corpus run read print beside what each read cost", async () => {
  const project = "/fixture/surface";
  const room = tempRoom("surface-corpus-");
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(project), "session-s", "tasks");
  mkdirSync(tasks, { recursive: true });
  const part = "the part\n\nFlow default, which this project runs; `forge doctor` names its source.";
  writeFileSync(join(tasks, "a0001.output"), transcript([
    { timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-9" } },
    ...bash("c1", 10, "forge claim ISS-9", "claimed"),
    ...bash("c2", 20, "forge guide skill ref", part),
    ...bash("c3", 30, "forge guide skill ref", part),
  ]));
  const kept = { HOME: process.env.HOME, TMPDIR: process.env.TMPDIR };
  Object.assign(process.env, { HOME: room, TMPDIR: room });
  const served = await endpoint();
  /* The stand-in join left out, so the reading's own is what reads the corpus above. */
  const held = await surfaceReading({ model: "claude-x", checkout: project }, { ...reading(TEXTS), parts: undefined, settings: served.settings });
  served.close();
  Object.assign(process.env, kept);
  assert.equal(held.parts.runs, 1);
  assert.deepEqual(held.parts.priced.map(({ key, calls, runs, again, perCall, spent, spentAgain }) =>
    [key, calls, runs, again, perCall, spent, spentAgain]), [["skill ref", 2, 1, 1, 5, 10, 5]]);
  assert.match(surfaceLines(held).join("\n"), /skill ref\s+2\s+1\s+1\s+5\s+10\s+5/u);
});

test("--json prints the whole reading, with null for every figure not measured", async () => {
  const printed = [];
  const log = console.log;
  console.log = (line) => printed.push(line);
  try {
    await printSurface(["--json"], { ...reading(TEXTS), settings: () => ({ key: null, origin: "https://api.anthropic.com" }) });
  } finally {
    console.log = log;
  }
  const held = JSON.parse(printed.join("\n"));
  assert.equal(held.model, null);
  assert.equal(held.origin, null);
  assert.equal(held.tokens, null);
  assert.equal(held.repeated.tokens, null);
  assert.deepEqual(held.texts.map((one) => one.tokens), [null, null, null]);
  assert.equal(held.texts.length, 3);
  assert.equal(held.parts.flow, "default");
});

/* Read in a process of its own, the configuration being read once a process. */
const settingsUnder = (config) => {
  const home = tempRoom("surface-settings-");
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "config.json"), JSON.stringify(config));
  const count = new URL("../../src/stats/surface/count.mjs", import.meta.url).href;
  const run = spawnSync(process.execPath, ["--input-type=module", "-e",
    `const { countSettings } = await import(${JSON.stringify(count)}); console.log(JSON.stringify(countSettings()));`],
  { encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: home } });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
};

test("the key and the origin are this machine's saved anthropic store, Anthropic's own origin where none is saved", () => {
  assert.deepEqual(settingsUnder({ anthropic: { key: "sk-saved", url: "https://count.example/" } }),
    { key: "sk-saved", origin: "https://count.example" });
  assert.deepEqual(settingsUnder({ anthropic: { key: "sk-saved" } }), { key: "sk-saved", origin: "https://api.anthropic.com" });
  assert.deepEqual(settingsUnder({}), { key: null, origin: "https://api.anthropic.com" });
});

test("a flag the subject has not got is refused before anything is walked", () => {
  const run = spawnSync(FORGE, ["stats", "surface", "--modle", "x"], { encoding: "utf8" });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--modle/u);
});
