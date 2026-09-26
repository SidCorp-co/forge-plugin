/* The page's reading end to end: the verb, a device made small, and a stand-in gateway that answers
   each stage through the tool it was forced to and keeps what it was sent — the only way to prove
   what travels, how often, and what the page and the terminal then say. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { FORGE } from "../fixture-runs.mjs";
import { daysAgo, device, envOf, runOn } from "./fixture-daily.mjs";
import { slugFor } from "../../../src/stats/corpus/corpus.mjs";
import { contentOf } from "../../../src/stats/daily/store.mjs";

const ROLES = { explore: "cx/explorer", review: "cx/reviewer-max", judge: "cx/judge" };

const answerFor = (body) => {
  const data = JSON.parse(body.messages[0].content);
  if (body.tool_choice.name === "candidates") {
    return { candidates: [{ figure: data.figures[0].key, reading: `the first figure of ${data.section}`, direction: "steady" }] };
  }
  if (body.tool_choice.name === "review") return { kept: [{ candidate: 1 }], dropped: [] };
  return {
    sections: data.sections.map((one) => ({ section: one.section, verdict: "steady", why: `nothing moved in ${one.section}` })),
    decisions: [
      { action: "raise", what: "the effort reading is still owed", figure: "runs.headline.day.runs", command: "ISS-2424" },
      { action: "file", what: "made up", figure: "runs.madeUp", command: "forge new" },
    ],
    nothing: false,
  };
};

/* The gateway: every request kept, each answered with one streamed tool call. */
const standIn = async () => {
  const { createServer } = await import("node:http");
  const seen = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      const body = JSON.parse(raw);
      seen.push(body);
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end([
        { type: "message_start", message: { usage: { input_tokens: 50 } } },
        { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "t", name: body.tool_choice.name } },
        { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify(answerFor(body)) } },
        { type: "content_block_stop", index: 0 },
        { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 5 } },
      ].map((one) => `event: ${one.type}\ndata: ${JSON.stringify(one)}\n\n`).join(""));
    });
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  return { url: `http://127.0.0.1:${server.address().port}`, seen, close: () => server.close() };
};

/* Spawned rather than run in this process: the stand-in listens on this event loop. */
const run = (held, argv, extra = {}) => new Promise((done) => {
  const child = spawn(FORGE, ["stats", "daily", ...argv], { cwd: held.room,
    env: envOf(held, { FORGE_CODEX_DISABLE: "", CLAUDE_PROXY_ENV: join(held.room, "no-profile.env"), ...extra }) });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (one) => { stdout += one; });
  child.stderr.on("data", (one) => { stderr += one; });
  child.on("close", (status) => done({ status, stdout, stderr }));
});

const deviceAt = (gateway, reports = { roles: ROLES }) => device({ days: [daysAgo(1), daysAgo(2)],
  config: { codex: { url: gateway?.url ?? "", key: gateway ? "sk-stand-in" : "" }, reports } });

const pageOf = (held) => readFileSync(join(held.reports, `${daysAgo(1)}.html`), "utf8");

test("a written page opens with the judged Decisions, each section with its line, and the footer with each role's cost", async () => {
  const gateway = await standIn();
  try {
    const held = deviceAt(gateway);
    const written = await run(held, ["--day", daysAgo(1)]);
    assert.equal(written.status, 0, written.stderr);
    const count = (model) => gateway.seen.filter((one) => one.model === model).length;
    assert.deepEqual([count("cx/explorer"), count("cx/reviewer-max"), count("cx/judge")], [6, 6, 1]);
    const page = pageOf(held);
    assert.ok(page.indexOf('<section id="scorecard">') < page.indexOf('<section id="decisions">'), "the scorecard comes first");
    assert.ok(page.indexOf('<section id="decisions">') < page.indexOf("<details"), "the block stands above every drill-down");
    assert.match(page, /<li><strong>raise<\/strong> — the effort reading is still owed<br><span class="note"><span class="figure" title="runs\.headline\.day\.runs">runs, the day: 1<\/span>\. Tile: <a href="#tile-minutesPerClosed">agent minutes per closed issue<\/a>\. Carried out by <code>ISS-2424<\/code>\.<\/span><\/li>/u);
    assert.ok(page.includes('<div class="tile greyed" id="tile-minutesPerClosed">'), "and the tile it links to is on the page");
    assert.doesNotMatch(page.slice(0, page.indexOf("<script")), />[^<]*runs\.headline\.day\.runs/u, "the key is a hover, never page text");
    assert.match(page, /1 reading\(s\) dropped before this page was written: 1 at judge, cited a figure the page does not hold\./u);
    assert.match(page, /<details id="friction"><summary><h2>Friction<\/h2>.*?<\/summary><p class="verdict"><strong>steady<\/strong> — nothing moved in friction<\/p>/u);
    assert.match(page, /What reading this page cost: explore: cx\/explorer, 6 call\(s\), 300 input and 30 output token\(s\); review: cx\/reviewer-max, 6 call\(s\), 300 input and 30 output token\(s\); judge: cx\/judge, 1 call\(s\), 50 input and 5 output token\(s\)\./u);
    assert.ok(written.stdout.startsWith("Scorecard, the day against"), written.stdout);
    assert.ok(written.stdout.includes("\nDecisions:\n1. raise: the effort reading is still owed — runs, the day: 1 — ISS-2424\n"), written.stdout);
    assert.ok(!written.stdout.includes("issue-flow run(s) across"), "the scorecard and the decisions stand in place of the template sentences");
    const sent = JSON.stringify(gateway.seen);
    assert.ok(!sent.includes(held.room), "no path under this device's home travelled");
    assert.ok(!sent.includes("sk-stand-in"), "no credential travelled in a body");
    assert.ok(gateway.seen.every((one) => !("reasoning_effort" in one)), "the effort rides the model id");
    assert.ok(!existsSync(join(held.home, "forge", "codex-log.jsonl")), "the consult log is not written");
  } finally {
    gateway.close();
  }
});

test("a held page's reading is read back by a later open and by --json with no call, and --force reads again", async () => {
  const gateway = await standIn();
  try {
    const held = deviceAt(gateway);
    const unwritten = await run(held, ["--day", daysAgo(1), "--json"]);
    assert.equal(gateway.seen.length, 0, "--json over a day with no page asks no model");
    assert.match(JSON.parse(unwritten.stdout).judgement.why, new RegExp(`no page is written for ${daysAgo(1)}`, "u"));
    assert.equal((await run(held, ["--day", daysAgo(1)])).status, 0);
    const asked = gateway.seen.length;
    const again = await run(held, ["--day", daysAgo(1)]);
    assert.ok(again.stdout.includes("\nDecisions:\n1. raise:"), again.stdout);
    /* A run landing on the day after the page was written: --json still prints what the reading read. */
    const later = join(held.room, ".claude", "projects", slugFor(held.checkout), "session-later", "subagents");
    mkdirSync(later, { recursive: true });
    writeFileSync(join(later, "agent-later.jsonl"), `${runOn(daysAgo(1))}\n`);
    const printed = JSON.parse((await run(held, ["--day", daysAgo(1), "--json"])).stdout);
    assert.equal(gateway.seen.length, asked, "neither the open nor --json asked again");
    assert.deepEqual(printed, contentOf(pageOf(held)), "the held content whole, not fresh figures beside an old reading");
    assert.equal(printed.runs.headline.day.runs, 1);
    assert.deepEqual(printed.judgement.decisions.map((one) => [one.action, one.figure.key, one.command]), [["raise", "runs.headline.day.runs", "ISS-2424"]]);
    assert.equal(printed.judgement.sections.runs.verdict, "steady");
    assert.equal(printed.judgement.cost.judge.calls, 1);
    assert.equal((await run(held, ["--day", daysAgo(1), "--force"])).status, 0);
    assert.equal(gateway.seen.length, asked * 2, "--force read the page again");
  } finally {
    gateway.close();
  }
});

test("with no gateway, or the variable standing codex down, the page is written whole and one line says why", async () => {
  const held = deviceAt(null);
  const written = await run(held, ["--day", daysAgo(1)]);
  assert.equal(written.status, 0, written.stderr);
  assert.match(pageOf(held), /<section id="decisions"><p class="missing">No decisions: no model read this page: the gateway has no gateway endpoint and no credential for it/u);
  assert.match(pageOf(held), /<details id="runs"><summary><h2>Runs<\/h2>/u, "every figure is still on the page");
  assert.match(written.stdout, /^Scorecard, the day against[\s\S]*\nNo decisions: no model read this page/u);
  const gateway = await standIn();
  try {
    const off = deviceAt(gateway);
    assert.equal((await run(off, ["--day", daysAgo(1)], { FORGE_CODEX_DISABLE: "1" })).status, 0);
    assert.equal(gateway.seen.length, 0);
    assert.match(pageOf(off), /No decisions: FORGE_CODEX_DISABLE=1 stood the page&#39;s reading down/u);
  } finally {
    gateway.close();
  }
});

test("a reports table names the directory by dir, and a member or role nothing reads is refused by its full name while the page is written", async () => {
  const gateway = await standIn();
  try {
    for (const [reports, named] of [[{ roles: ROLES, colour: "red" }, "reports.colour"],
      [{ roles: { ...ROLES, summarise: "cx/x" } }, "reports.roles.summarise"], [{ roles: { ...ROLES, judge: 7 } }, "reports.roles.judge"],
      [{ roles: { ...ROLES, review: " " } }, "reports.roles.review"]]) {
      const held = deviceAt(gateway, reports);
      const written = await run(held, ["--day", daysAgo(1)]);
      assert.equal(written.status, 0, written.stderr);
      assert.ok(pageOf(held).includes(`No decisions: \`${named}\` in `), named);
    }
    assert.equal(gateway.seen.length, 0, "a refused table asks no model");
    const held = deviceAt(gateway, { dir: "/nowhere-relative-is-refused" });
    const elsewhere = join(held.room, "pages");
    writeFileSync(join(held.home, "forge", "config.json"), JSON.stringify({ reports: { dir: elsewhere } }));
    assert.equal((await run(held, ["--day", daysAgo(1)])).status, 0);
    assert.ok(existsSync(join(elsewhere, `${daysAgo(1)}.html`)), "the table's dir is where the page went");
    writeFileSync(join(held.home, "forge", "config.json"), JSON.stringify({ reports: { dir: "pages" } }));
    const refused = await run(held, ["--day", daysAgo(1)]);
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /`reports\.dir` in .* is an absolute directory, not `"pages"`/u);
  } finally {
    gateway.close();
  }
});
