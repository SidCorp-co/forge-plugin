/* What one consult sends where its set holds a plan or criteria file outside the checkout, read off the
   request a stand-in gateway was handed: the reviewer judged the unbuilt tree because nothing it was
   sent said the files were a proposal (ISS-2500). In this directory because it spawns the CLI against
   a gateway. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { git, projectRecord, tempRoom } from "../../fixtures.mjs";

const PLAN = "## Files touched\n\n- `src/report.mjs` — new\n\n## Steps\n\n1. Write the report. criteria: 1\n";
const CRITERIA = "1. The report names every gap.\n2. The report runs on an empty table.\n";
const CODE = "export const pricing = (n) => n * 2;\n";

const RULE = /WHERE you are given a PROPOSAL section, the files it names are a plan and its acceptance criteria/u;
const ABSENT = /propose to create or change being absent from the checkout is the state they are written against and never a finding/u;
const NOT_A_LIST = /Acceptance criteria, theirs or the issue's, are not a list for you to verify against this tree/u;
const EXISTING = /Use the tools to test what the proposal claims about code the checkout already holds/u;

const standIn = async () => {
  const { createServer } = await import("node:http");
  const bodies = [];
  const sse = (events) => events.map((one) => `event: ${one.type}\ndata: ${JSON.stringify(one)}\n\n`).join("");
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      bodies.push(JSON.parse(raw));
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(sse([
        { type: "message_start", message: { usage: { input_tokens: 1 } } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "CODEX: 0 findings" } },
        { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 1 } },
      ]));
    });
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  return { port: server.address().port, bodies, close: () => server.close() };
};

const textOf = (content) => (typeof content === "string" ? content : content.map((one) => one.text).join(""));

/* `files` maps a name to its text; a name under `out/` is written in a directory no checkout holds. */
const consulted = async (label, files) => {
  const room = tempRoom(`codex-proposal-${label}-`);
  const out = tempRoom(`codex-proposal-${label}-out-`);
  const home = tempRoom(`codex-proposal-${label}-home-`);
  spawnSync("git", ["init", "-q", room], { cwd: room });
  writeFileSync(join(room, "judged.mjs"), "export const one = 1;\n");
  git(room, "add", ".");
  git(room, "commit", "-qm", "one");
  writeFileSync(join(room, "judged.mjs"), "export const one = 2;\n");
  projectRecord(room, home, {});
  mkdirSync(join(home, "forge"), { recursive: true });
  const paths = Object.entries(files).map(([name, text]) => {
    if (!name.startsWith("out/")) return name;
    const at = join(out, name.slice("out/".length));
    writeFileSync(at, text);
    return at;
  });
  const gateway = await standIn();
  writeFileSync(join(home, "proxy.env"), [
    `export ANTHROPIC_BASE_URL="http://127.0.0.1:${gateway.port}"`,
    "ANTHROPIC_AUTH_TOKEN=sk-stand-in",
    'ANTHROPIC_DEFAULT_FABLE_MODEL="cx/gpt-5.6-sol"',
  ].join("\n"));
  const env = { ...process.env, HOME: home, XDG_CONFIG_HOME: home, CLAUDE_PROXY_ENV: join(home, "proxy.env") };
  const child = spawn(new URL("../../../bin/forge", import.meta.url).pathname,
    ["codex", "consult", "--rounds", "1", "--send", "bodies", ...paths], { cwd: room, env });
  child.stdin.end("the intent");
  let said = "";
  child.stderr.on("data", (one) => { said += one; });
  child.stdout.resume();
  const status = await new Promise((done) => child.on("close", done));
  gateway.close();
  const rows = readFileSync(join(home, "forge", "codex-log.jsonl"), "utf8")
    .split("\n").filter(Boolean).map((one) => JSON.parse(one));
  const [body] = gateway.bodies;
  return {
    status,
    said,
    paths,
    room,
    env,
    row: rows.findLast((one) => one.kind === "consult"),
    system: body.system.map((one) => one.text).join(""),
    opening: textOf(body.messages[0].content),
  };
};

const sectionOf = (opening) => opening.split("\n\n---\n\n").find((one) => one.startsWith("PROPOSAL — ")) ?? null;

test("a plan and criteria pair outside the checkout is sent as a proposal, and the row and the line say which", async () => {
  const run = await consulted("pair", { "out/plan.md": PLAN, "out/criteria.md": CRITERIA });
  assert.equal(run.status, 0, run.said);
  const [plan, criteria] = run.paths;
  assert.match(run.system, RULE, "the rule reaches the reviewer's own instructions");
  assert.match(run.system, ABSENT, "absence of the proposed work is no finding");
  assert.match(run.system, NOT_A_LIST, "criteria are not a checklist against the tree");
  assert.match(run.system, EXISTING, "claims about existing code stay the reviewer's to test");
  assert.match(run.system, /reviewing work a coding agent has just done, or proposes to do\./u);
  const section = sectionOf(run.opening);
  assert.ok(section, run.opening);
  assert.ok(section.includes(plan), "the plan is named in the section");
  assert.ok(section.includes(criteria), "the criteria file is named in the section");
  assert.ok(run.said.includes(`2 of them read as a proposal for work not yet done (${plan}, ${criteria})`), run.said);
  assert.deepEqual(run.row.proposal, [plan, criteria]);
});

test("a criteria file a proposal consult read whole is one the criteria write accepts", async () => {
  const run = await consulted("write", { "out/criteria.md": CRITERIA });
  assert.deepEqual(run.row.proposal, run.paths);
  const read = new URL("../../../src/codex/codex-read.mjs", import.meta.url).pathname;
  const asked = spawnSync(process.execPath, ["-e",
    `import(${JSON.stringify(read)}).then((m) => process.stdout.write(JSON.stringify(m.readOrRefuse(${JSON.stringify(run.paths[0])}))))`],
  { cwd: run.room, env: run.env, encoding: "utf8" });
  assert.equal(asked.status, 0, asked.stderr);
  const held = JSON.parse(asked.stdout);
  assert.equal(held.refusal, null, "the read that clears the write is the proposal consult's");
  assert.equal(held.text, CRITERIA);
});

test("a file outside the checkout that is neither a plan nor numbered lines keeps a plain review", async () => {
  const run = await consulted("code", { "out/pricing.mjs": CODE, "out/notes.md": "Some notes.\n\nMore of them.\n" });
  assert.equal(run.status, 0, run.said);
  assert.doesNotMatch(run.system, RULE);
  assert.equal(sectionOf(run.opening), null);
  assert.doesNotMatch(run.said, /read as a proposal/u);
  assert.equal(run.row.proposal, undefined);
});

test("a set mixing a proposal with a file of the checkout names only the proposal", async () => {
  const run = await consulted("mixed", { "out/criteria.md": CRITERIA, "judged.mjs": null });
  assert.match(run.system, RULE);
  const section = sectionOf(run.opening);
  assert.ok(section.includes(run.paths[0]), section);
  assert.ok(!section.includes("judged.mjs"), "the checkout's own file is reviewed as it always was");
  assert.deepEqual(run.row.proposal, [run.paths[0]]);
});

test("a set of the checkout's own files is sent neither the rule nor the section", async () => {
  const run = await consulted("inside", { "judged.mjs": null });
  assert.equal(run.status, 0, run.said);
  assert.doesNotMatch(run.system, /PROPOSAL/u);
  assert.match(run.system, /reviewing work a coding agent has just done\.\n/u);
  assert.equal(sectionOf(run.opening), null);
  assert.equal(run.row.proposal, undefined);
});
