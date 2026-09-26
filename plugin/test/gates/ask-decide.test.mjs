/* The gate is exercised the way Claude Code calls it: the event on stdin, the answer on stdout, a
   project of its own under a config home of its own, transcripts under a home of its own, and a
   stand-in gateway that plays the judge and counts every time it was asked. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";

import { answered, callHookAsync, projectRoom, tempRoom } from "../fixtures.mjs";
import { OWNER_OVERRIDES } from "../fixtures/asks-overrides.mjs";
import { slugFor } from "../../src/stats/corpus/corpus.mjs";

const HOOK = new URL("../../hooks/entries/ask-decide.mjs", import.meta.url).pathname;
const REPORT = "Where should the weekly report go? [reversible: move the report file back to where it was]";
const OPTIONS = [{ label: "A file on this device (Recommended)", description: "Written under the reports folder." },
  { label: "A page on the tracker", description: "Read in the browser." }];
const PRECEDENT = { question: "Where should each day's report go?", header: "Delivery", options: OPTIONS };

/* A stand-in judge: every request is kept, and the answer is the `decide` call the case hands it. */
const standIn = async (decide) => {
  const asked = [];
  const sse = (events) => events.map((one) => `event: ${one.type}\ndata: ${JSON.stringify(one)}\n\n`).join("");
  const server = createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      asked.push(JSON.parse(body));
      if (decide === null) {
        res.writeHead(500);
        return res.end("the gateway is down");
      }
      res.writeHead(200, { "content-type": "text/event-stream" });
      return res.end(sse([
        { type: "message_start", message: { usage: { input_tokens: 1 } } },
        { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "j1", name: "decide" } },
        { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify(decide(asked.at(-1))) } },
        { type: "content_block_stop", index: 0 },
        { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 1 } },
      ]));
    });
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  return { port: server.address().port, asked, close: () => { server.close(); server.closeAllConnections(); } };
};

/* The judge a case wants most: follow the first owner precedent it was shown, to the option that
   precedent's answer names. */
const follows = (request) => {
  const input = JSON.parse(request.messages[0].content);
  return { questions: input.questions.map((one) => {
    const precedent = one.precedents.find((each) => each.kind === "owner answer");
    return { question: one.question, verdict: "decide", option: precedent.answer, precedent: precedent.id,
      precedentsAgree: true, reason: "the owner chose this for the daily report." };
  }) };
};

const answeredLine = (id, question, answer) => JSON.stringify({
  type: "user", timestamp: "2026-09-24T08:00:00.000Z",
  message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: "answered" }] },
  toolUseResult: { questions: [question], answers: { [question.question]: answer } },
});

/** One project, its config home, its home with transcripts, and the gateway profile. */
const project = async (keys, { precedents = [[PRECEDENT, OPTIONS[0].label]], decide = follows, within = null } = {}) => {
  const config = within?.config ?? tempRoom("ask-decide-config-");
  const home = within?.home ?? tempRoom("ask-decide-home-");
  const repo = realpathSync(tempRoom("ask-decide-repo-"));
  projectRoom(repo, config, keys);
  const store = join(home, ".claude", "projects", slugFor(repo));
  mkdirSync(store, { recursive: true });
  writeFileSync(join(store, "s1.jsonl"),
    precedents.map(([question, answer], at) => `${answeredLine(`toolu_old${at}`, question, answer)}\n`).join(""));
  const gateway = await standIn(decide);
  writeFileSync(join(home, "proxy.env"), [`ANTHROPIC_BASE_URL="http://127.0.0.1:${gateway.port}"`,
    "ANTHROPIC_AUTH_TOKEN=sk-stand-in", 'ANTHROPIC_DEFAULT_FABLE_MODEL="cx/judge"', 'ANTHROPIC_DEFAULT_OPUS_MODEL="cx/judge"'].join("\n"));
  const env = { ...process.env, XDG_CONFIG_HOME: config, HOME: home, CLAUDE_PROXY_ENV: join(home, "proxy.env"),
    TMPDIR: tempRoom("ask-decide-tmp-") };
  delete env.FORGE_URL;
  delete env.FORGE_TOKEN;
  const room = join(config, "forge", "projects", repo.split("/").at(-1), "asks");
  return { repo, env, gateway, room, store, config, home };
};

const ask = (held, questions, extra = {}) => callHookAsync(HOOK, {
  hook_event_name: "PreToolUse", session_id: extra.session ?? "s-ask", tool_use_id: extra.id ?? "toolu_new",
  cwd: held.repo, tool_name: "AskUserQuestion", tool_input: { questions },
}, held.env, held.repo).then((run) => answered(run)?.hookSpecificOutput ?? null);

const reportQuestion = (text = REPORT) => ({ question: text, header: "Delivery", options: OPTIONS, multiSelect: false });
const log = (held) => (existsSync(join(held.room, "decided.jsonl"))
  ? readFileSync(join(held.room, "decided.jsonl"), "utf8").split("\n").filter(Boolean).map((one) => JSON.parse(one)) : []);

test("unset, off and an unknown mode each leave the call alone and write nothing under the project's state", async () => {
  for (const keys of [{}, { asks: { mode: "off" } }, { asks: { mode: "sometimes" } }]) {
    const held = await project(keys);
    const said = await ask(held, [reportQuestion()]);
    held.gateway.close();
    assert.equal(said, null, `${JSON.stringify(keys)} answers nothing`);
    assert.equal(existsSync(held.room), false, `${JSON.stringify(keys)} writes nothing: no layer, no log`);
    assert.equal(held.gateway.asked.length, 0, "and asks no judge");
  }
});

test("a declared question the judge decides from precedent is allowed with the chosen label as its answer", async () => {
  const held = await project({ asks: { mode: "decide" } });
  const said = await ask(held, [reportQuestion()]);
  held.gateway.close();
  assert.equal(said?.permissionDecision, "allow", JSON.stringify(log(held)));
  assert.deepEqual(said.updatedInput.answers, { [REPORT]: OPTIONS[0].label });
  assert.deepEqual(said.updatedInput.questions, [reportQuestion()], "the questions travel unchanged");
});

test("the decided answer carries a note naming the precedent followed and the declared reversal", async () => {
  const held = await project({ asks: { mode: "decide" } });
  const said = await ask(held, [reportQuestion()]);
  held.gateway.close();
  const note = said.updatedInput.annotations[REPORT].notes;
  assert.match(note, /following the owner's answer of 2026-09-24 to "Where should each day's report go\?"/u);
  assert.match(note, /Undo: move the report file back to where it was\./u);
  assert.match(note, /decided\.jsonl/u, "and where the owner reviews it");
});

test("each outcome is one line in the project's log, with option, reason, precedent and reversal", async () => {
  const held = await project({ asks: { mode: "decide" } });
  await ask(held, [reportQuestion()], { id: "toolu_logged" });
  await ask(held, [{ question: "Which colour for the chart? [reversible: pick again]", header: "Colour",
    options: [{ label: "Red" }, { label: "Blue" }] }], { id: "toolu_passed" });
  held.gateway.close();
  const [decided, passed] = log(held);
  assert.equal(decided.outcome, "decided");
  assert.equal(decided.toolUseId, "toolu_logged");
  assert.deepEqual(Object.keys(decided.questions[0]).sort(), ["option", "precedent", "question", "reason", "reversal"]);
  assert.equal(decided.questions[0].option, OPTIONS[0].label);
  assert.equal(decided.questions[0].reversal, "move the report file back to where it was");
  assert.equal(decided.questions[0].precedent.question, PRECEDENT.question);
  assert.equal(decided.questions[0].reason, "the owner chose this for the daily report.");
  assert.equal(passed.outcome, "owner");
  assert.match(passed.reason, /no close owner precedent/u, "a pass carries its reason");
});

test("an undeclared question reaches the owner, and the session is told the form once per session", async () => {
  const held = await project({ asks: { mode: "decide" } });
  const plain = reportQuestion("Where should the weekly report go?");
  const first = await ask(held, [plain], { session: "s-teach" });
  const second = await ask(held, [plain], { session: "s-teach" });
  held.gateway.close();
  assert.equal(first.permissionDecision, undefined, "nothing is decided");
  assert.equal(first.updatedInput, undefined);
  assert.match(first.additionalContext, /\[reversible: <the one command or correction that undoes the choice>\]/u);
  assert.equal(second, null, "the second time it says nothing");
  assert.equal(held.gateway.asked.length, 0);
});

test("the owner's seven documented overrides reach the owner even when each declares a reversal", async () => {
  const held = await project({ asks: { mode: "decide" } },
    { precedents: OWNER_OVERRIDES.map((one) => [one, one.owner]) });
  for (const one of OWNER_OVERRIDES) {
    const declared = { ...one, question: `${one.question} [reversible: pick the other option]` };
    const said = await ask(held, [declared], { id: `toolu_${one.at}` });
    assert.equal(said?.permissionDecision, undefined, `"${one.question}" is never decided`);
  }
  held.gateway.close();
  assert.equal(held.gateway.asked.length, 0, "no judge was asked about any of them");
});

test("a question with no close precedent reaches the owner without the judge being asked", async () => {
  const held = await project({ asks: { mode: "decide" } }, { precedents: [] });
  const said = await ask(held, [reportQuestion()]);
  held.gateway.close();
  assert.equal(said, null, JSON.stringify(said));
  assert.equal(held.gateway.asked.length, 0);
});

test("a judge that cannot be reached, or that names what it was not offered, leaves the question with the owner", async () => {
  const cases = [null, () => ({ questions: [{ question: REPORT, verdict: "decide", option: "Somewhere else", precedent: "toolu_old0#0", precedentsAgree: true, reason: "r" }] }),
    () => ({ questions: [{ question: REPORT, verdict: "decide", option: OPTIONS[0].label, precedent: "invented", precedentsAgree: true, reason: "r" }] }),
    () => ({ questions: [{ question: REPORT, verdict: "owner", precedentsAgree: true, reason: "new ground" }] })];
  for (const decide of cases) {
    const held = await project({ asks: { mode: "decide" } }, { decide });
    const said = await ask(held, [reportQuestion()]);
    held.gateway.close();
    assert.equal(held.gateway.asked.length, 1, "the judge was asked");
    assert.equal(said, null, "and the owner answers");
    assert.equal(log(held).at(-1).outcome, "owner");
  }
});

test("a call of several questions reaches the owner whole unless every one is decided", async () => {
  const other = { question: "Where should the monthly report go? [reversible: move it back]", header: "Delivery", options: OPTIONS };
  const held = await project({ asks: { mode: "decide" } }, {
    decide: (request) => {
      const input = JSON.parse(request.messages[0].content);
      const [first, second] = input.questions;
      return { questions: [
        { question: first.question, verdict: "decide", option: OPTIONS[0].label, precedent: first.precedents[0].id, precedentsAgree: true, reason: "r" },
        { question: second.question, verdict: "owner", precedentsAgree: true, reason: "not this one" },
      ] };
    },
  });
  const said = await ask(held, [reportQuestion(), other]);
  held.gateway.close();
  assert.equal(said, null, "no answer map with a gap in it");
});

test("the judge is sent each question's options, recommendation, reversal, the goals, and its dated precedents", async () => {
  const held = await project({ asks: { mode: "decide" } });
  await ask(held, [reportQuestion()]);
  held.gateway.close();
  const request = held.gateway.asked[0];
  assert.equal(request.tool_choice.name, "decide", "the judge answers through the typed tool");
  const input = JSON.parse(request.messages[0].content);
  assert.ok(input.goals.none, "the goals, or why there are none: this suite reaches no tracker");
  const [one] = input.questions;
  assert.equal(one.reversal, "move the report file back to where it was");
  assert.deepEqual(one.options.map((each) => each.recommended), [true, false]);
  const [precedent] = one.precedents;
  assert.equal(precedent.date, "2026-09-24T08:00:00.000Z");
  assert.equal(precedent.answer, OPTIONS[0].label);
  assert.equal(precedent.matchedRecommendation, true);
});

test("a question this gate decided never joins the layer when the transcript holding it is read", async () => {
  const held = await project({ asks: { mode: "decide" } });
  await ask(held, [reportQuestion()], { id: "toolu_self" });
  /* The host writes the gate's own answer into the transcript as if the owner had given it. */
  writeFileSync(join(held.store, "s2.jsonl"), `${answeredLine("toolu_self", reportQuestion(), OPTIONS[0].label)}\n`);
  await ask(held, [reportQuestion()], { id: "toolu_next" });
  held.gateway.close();
  const ids = readFileSync(join(held.room, "precedents.jsonl"), "utf8").split("\n").filter(Boolean).map((one) => JSON.parse(one).id);
  assert.equal(ids.includes("toolu_self#0"), false);
  assert.ok(ids.includes("toolu_old0#0"), "while the owner's own answer is there");
});

test("one project's layer is never read for another project's question", async () => {
  const first = await project({ asks: { mode: "decide" } });
  await ask(first, [reportQuestion()]);
  first.gateway.close();
  /* One machine, one config home, one host store: only the checkout differs. */
  const second = await project({ asks: { mode: "decide" } }, { precedents: [], within: first });
  const said = await ask(second, [reportQuestion()]);
  second.gateway.close();
  assert.equal(said, null, "the second project has no precedent of its own, whatever the first holds");
  assert.equal(second.gateway.asked.length, 0);
  assert.ok(existsSync(join(first.room, "precedents.jsonl")), "the first project's layer is there to be misread");
  assert.notEqual(dirname(first.room), dirname(second.room));
});

test("a precedent layer not read to its end, or a decision log that cannot be read, leaves the question with the owner", async () => {
  const unread = await project({ asks: { mode: "decide" } });
  symlinkSync(join(unread.store, "vanished.target"), join(unread.store, "s9.jsonl"));
  assert.equal(await ask(unread, [reportQuestion()]), null);
  unread.gateway.close();
  assert.equal(unread.gateway.asked.length, 0);
  assert.match(log(unread).at(-1).reason, /not yet read to the end/u);
  const torn = await project({ asks: { mode: "decide" } });
  mkdirSync(torn.room, { recursive: true });
  writeFileSync(join(torn.room, "decided.jsonl"), '{"outcome":"decided","toolUseId":"toolu_self"\n');
  assert.equal(await ask(torn, [reportQuestion()]), null);
  torn.gateway.close();
  assert.equal(torn.gateway.asked.length, 0);
  assert.equal(existsSync(join(torn.room, "precedents.jsonl")), false, "and no transcript is read past it");
});
