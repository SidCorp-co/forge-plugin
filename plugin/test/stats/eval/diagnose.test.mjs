/* One case per duty the diagnostic owes: which runs it reads, what travels, what comes back and what
   it refuses to report. The corpus is `fixture-eval.mjs`'s, and the gateway is a stand-in this file
   stands up — the only way to prove what a reading sends and what it does with the answer. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  COMMAND_CHARS, DIAGNOSE_USAGE, LAST, NOT_COMPARABLE, NO_CLOSING, RESULT_CHARS,
  SEPARATOR, TOTAL_CHARS,
  bodyOf, chosenOf, citedIn, digestOf, excerpt, findingsIn, folded, payloadOf, roomFor, setAsked,
} from "../../../src/stats/eval/diagnose.mjs";
import { DIAGNOSTIC, answered, consults } from "../../../src/codex/codex-log.mjs";
import { refusing } from "../../../src/resolve/settings.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { classesFor } from "../../../src/stats/corpus/classes.mjs";
import { runsUnder } from "../../../src/stats/runs.mjs";
import { PROJECT, askStats, corpusOf, runsOf } from "../fixture-eval.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("stats-diagnose-home-");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

/* A stand-in gateway that answers with one reply and keeps what it was sent, so a case can read the
   payload this reading built rather than guess at it. */
const standIn = async (reply) => {
  const { createServer } = await import("node:http");
  const sse = (events) => events.map((one) => `event: ${one.type}\ndata: ${JSON.stringify(one)}\n\n`).join("");
  const sent = [];
  const server = createServer((req, res) => {
    req.setEncoding("utf8");
    req.on("data", (chunk) => sent.push(chunk));
    req.on("end", () => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(sse([
        { type: "message_start", message: { usage: { input_tokens: 1 } } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: reply } },
        { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 1 } },
      ]));
    });
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  return { port: server.address().port, close: () => server.close(), shown: () => sent.join("") };
};

/* Spawned rather than run in this process: the stand-in listens on this event loop, and a blocking
   child would leave it unable to answer the reading it is waiting on. */
const asked = async (reply, argv, { room = corpusOf(4), home = tempRoom("stats-diagnose-run-") } = {}) => {
  const gateway = await standIn(reply);
  mkdirSync(home, { recursive: true });
  writeFileSync(join(home, "proxy.env"), [
    `export ANTHROPIC_BASE_URL="http://127.0.0.1:${gateway.port}"`,
    "ANTHROPIC_AUTH_TOKEN=sk-stand-in",
    'ANTHROPIC_DEFAULT_FABLE_MODEL="cx/gpt-5.6-sol"',
  ].join("\n"));
  const child = spawn(FORGE, ["stats", "diagnose", "--checkout", PROJECT, ...argv], {
    env: { ...process.env, XDG_CONFIG_HOME: home, CLAUDE_PROXY_ENV: join(home, "proxy.env"),
      TMPDIR: room, HOME: tempRoom("stats-diagnose-user-") },
  });
  let out = "";
  let err = "";
  child.stdout.on("data", (one) => { out += one; });
  child.stderr.on("data", (one) => { err += one; });
  const status = await new Promise((done) => child.on("close", done));
  gateway.close();
  return { status, stdout: out, stderr: err, room, home, sent: gateway.shown() };
};

const ONE = [
  "FINDING 1",
  "CITES R1/1",
  "SHOWN the run claimed its issue and the digest holds nothing after it.",
  "INFERRED nothing that the digest does not carry.",
  "",
  "FINDING 2",
  "CITES R9/4",
  "SHOWN a call that is in no run of this set.",
  "INFERRED nothing",
  "",
  "DIAGNOSTIC: 2 findings",
].join("\n");

test("the runs are the caller's by one of three anchors, and two anchors are refused with both named", async () => {
  assert.deepEqual(setAsked({}), { kind: "count", last: LAST }, "naming none reads the most recent");
  assert.deepEqual(setAsked({ last: "3" }), { kind: "count", last: 3 });
  assert.deepEqual(setAsked({ issues: "ISS-1, ISS-2" }), { kind: "keys", keys: ["ISS-1", "ISS-2"] });
  assert.equal(setAsked({ since: "2d" }).kind, "window");

  await assert.rejects(refusing(async () => setAsked({ last: "3", since: "2d" })),
    /--last 3 and --since 2d name 2 sets of runs, and a reading is taken over one[\s\S]*`forge stats diagnose --last 3`/u,
    "both anchors are named in the refusal, not the one that lost");
  await assert.rejects(refusing(async () => setAsked({ last: "3", since: "2d", issues: "ISS-1" })),
    /--last 3 and --since 2d and --issues ISS-1 name 3 sets/u);
  await assert.rejects(refusing(async () => setAsked({ last: "0" })), /--last takes an integer of 1 or more/u);
  await assert.rejects(refusing(async () => setAsked({ issues: " , " })), /--issues was given no issue key/u);

  /* And the set it could not reach is named rather than left out of the count. */
  const runs = runsOf(4);
  const keyed = chosenOf(runs, { kind: "keys", keys: ["ISS-1", "ISS-404"] });
  assert.deepEqual(keyed.read.map((one) => one.issues), [["ISS-1"]]);
  assert.deepEqual(keyed.notRead,
    [{ named: "ISS-404", why: "no run of this corpus is recorded as having owned it" }]);
  const counted = chosenOf(runs, { kind: "count", last: 9 });
  assert.equal(counted.read.length, 4);
  assert.deepEqual(counted.notRead, [{ named: "9 run(s)", why: "this corpus holds 4" }]);
});

test("a call travels as an excerpt of both ends, so a refusal's own last line is still in it", () => {
  const body = `${"a".repeat(400)}\nHow: \`forge hooks --how learning-gate\``;
  const cut = excerpt(body, 120);
  assert.ok(cut.length < body.length, "it was cut");
  assert.ok(cut.startsWith("aaa"), "the head is there");
  assert.ok(cut.endsWith("How: `forge hooks --how learning-gate`"), "and so is the line that names the rule");
  assert.equal(excerpt("short", 120), "short", "a body under the bound is not touched");
  assert.equal(excerpt(undefined, 10), "");

  /* A transcript is every line a run typed and every line that came back, which is a wider surface
     for a credential than any source file a consult sends — and it leaves this machine. */
  assert.equal(excerpt("curl -H 'Authorization: Bearer sk-0123456789abcdef0123' https://x", 400),
    "curl -H 'Authorization: *** https://x", "a credential in a call does not travel with the digest");
  /* The flag this CLI documents for its own credential, which is a line real transcripts carry. The
     mask did not hold it until this change did, and it is asserted here as well as at the mask
     because this is the caller whose output leaves the machine (ISS-2015). */
  assert.equal(excerpt("forge doctor --codex-key notarealone", 400), "forge doctor --codex-key ***",
    "this CLI's own credential flag does not travel with the digest");
  const long = `${"b".repeat(300)}\nAuthorization: Bearer sk-0123456789abcdef0123`;
  assert.ok(excerpt(long, 120).endsWith("Authorization: ***"),
    "and it is masked before the cut, so a secret split by the bound is not half-masked");
});

test("each run's share of the payload is bounded, and what it could not fit is counted rather than hidden", async () => {
  const runs = runsOf(4);
  const whole = payloadOf(runs);
  assert.deepEqual(whole.map((one) => one.label), ["R1", "R2", "R3", "R4"]);
  for (const one of whole) {
    assert.equal(one.shown, one.calls, "a small corpus fits whole");
    assert.ok(one.calls > 0, "and the calls were read off the transcript, not off the fold");
    assert.match(one.text, /^R\d {2}ISS-\d/u, "the block opens on its own label and the issues it owned");
  }
  /* A budget under one call's cost: the run is still reported, with nothing shown and the count said. */
  const starved = digestOf(runs[0], "R1", 10);
  assert.equal(starved.shown, 0);
  assert.equal(starved.calls, whole[0].calls, "and it still says how many the run holds");
  assert.ok(COMMAND_CHARS > 0 && RESULT_CHARS > 0, "both bounds are the module's and not a case's");

  /* The bound answers for the whole message and not for the blocks alone. */
  /* The arithmetic and not one corpus's luck: every block may fill its share, so the shares plus
     what joins them is what has to be inside the total. A fixture whose blocks happen to be small
     passes a budget that is wrong. */
  for (const total of [400, 900, 4000, TOTAL_CHARS]) {
    assert.ok(roomFor(runs.length, total) * runs.length + SEPARATOR.length * (runs.length - 1) <= total,
      `${runs.length} shares and what joins them are inside ${total}`);
    assert.ok(bodyOf(payloadOf(runs, total)).length <= total, `and this corpus's own body is, at ${total}`);
  }
  await assert.rejects(refusing(async () => payloadOf(runs, 40)),
    /4 run\(s\) will not fit one payload of 40 character\(s\)[\s\S]*Read fewer: `forge stats diagnose --last 2`/u,
    "and a set whose headings alone will not fit is refused by name rather than sent short");
});

test("a finding cites a run of the set and a call inside it, and one that cites neither is left out and counted", async () => {
  const digests = payloadOf(runsOf(2));
  assert.deepEqual(citedIn("R1/1", digests), [{ label: "R1", call: 1, issues: ["ISS-0"], session: "session" }]);
  assert.deepEqual(citedIn("R9/1", digests), [], "a label this set does not hold resolves to nothing");
  assert.deepEqual(citedIn("R1/99", digests), [], "and so does a call number past what that run was shown");
  assert.deepEqual(citedIn("R1/1, R1/1", digests).length, 1, "one call cited twice is one citation");

  const read = findingsIn(ONE, digests);
  assert.equal(read.read, true);
  assert.deepEqual(read.findings.map((one) => one.n), ["1"], "only the one that resolves is reported");
  assert.equal(read.leftOut, 1, "and the other is counted rather than printed");

  const run = await asked(ONE, [], { room: corpusOf(2) });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^1 finding\(s\), each cited to a call above; 1 left out, citing no call of this set$/mu);
  assert.match(run.stdout, /^ {2}1 {2}R1\/1$/mu, "the finding carries the address a reader reaches the call by");
  assert.doesNotMatch(run.stdout, /R9\/4/u, "and the uncitable one is nowhere in what was printed");
});

test("a finding's two halves are printed apart, and the run each cites is reachable in what was read", async () => {
  const run = await asked(ONE, ["--json"], { room: corpusOf(2) });
  assert.equal(run.status, 0, run.stderr);
  const held = JSON.parse(run.stdout);
  assert.deepEqual(Object.keys(held.findings[0]).sort(), ["cites", "inferred", "n", "shown"]);
  assert.equal(held.findings[0].shown, "the run claimed its issue and the digest holds nothing after it.");
  assert.equal(held.findings[0].inferred, "nothing that the digest does not carry.",
    "the closing line is not swept into the last paragraph of the last block");

  /* A paragraph wrapped onto a line that begins with a label this block already filled is prose: read
     as a fresh field it would take the paragraph's place and the finding would print short. */
  const wrapped = findingsIn([
    "FINDING 1",
    "CITES R1/1",
    "SHOWN the run claimed and stopped.",
    "INFERRED the run may have been waiting.",
    "SHOWN is a word this sentence happens to begin with.",
    "",
    "DIAGNOSTIC: 1 findings",
  ].join("\n"), payloadOf(runsOf(2)));
  assert.equal(wrapped.findings[0].shown, "the run claimed and stopped.", "nothing of the first is lost");
  assert.match(wrapped.findings[0].inferred, /^the run may have been waiting\.\nSHOWN is a word/u,
    "and the wrapped line stays with the paragraph it belongs to");
  const cited = held.read.find((one) => one.label === held.findings[0].cites[0].label);
  assert.ok(cited.path.endsWith(".output"), "and the run it cites names the transcript it was read from");
  assert.equal(cited.shown <= cited.calls, true, "with how much of it the reviewer was shown");
});

test("the reading says it is not comparable and votes on nothing, and carries no disposition, shift or floor", async () => {
  const run = await asked(ONE, [], { room: corpusOf(2) });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.includes(NOT_COMPARABLE), true, "beside the findings, not in a topic");
  assert.match(run.stdout.split("\n")[1], /^this is a diagnostic and not a measurement/u,
    "and before them: a reader who stops at the first screen has still been told");

  const machine = await asked(ONE, ["--json"], { room: corpusOf(2) });
  const held = JSON.parse(machine.stdout);
  assert.equal(held.notComparable, NOT_COMPARABLE, "a consumer reading only the machine form is told too");
  /* The words `improved` and `declined` are in the statement, which is where they belong: it says
     nothing votes on them. What must be absent is a field carrying one. */
  const keyed = (one) => (one && typeof one === "object"
    ? Object.entries(one).flatMap(([key, value]) => [key, ...keyed(value)])
    : []);
  const keys = new Set(keyed(held));
  for (const field of ["disposition", "floor", "shift", "past", "better", "angles", "verdict"]) {
    assert.equal(keys.has(field), false, `the reading carries a ${field}`);
  }
  const outside = JSON.stringify({ ...held, notComparable: "" });
  for (const word of ["improved", "declined", "not evaluable", "not distinguishable"]) {
    assert.equal(outside.includes(word), false, `a disposition reached the reading as ${word}`);
  }
});

test("a reply closing on its count and naming nothing found nothing, and one closing on no count is unread", async () => {
  const digests = payloadOf(runsOf(2));
  const empty = findingsIn("I read them and found nothing wrong.\n\nDIAGNOSTIC: 0 findings", digests);
  assert.deepEqual(empty, { read: true, findings: [], leftOut: 0 }, "a closing line and no block is a reading");
  const loose = findingsIn("I read them and found nothing wrong.", digests);
  assert.deepEqual(loose, { read: false, why: NO_CLOSING, findings: [], leftOut: 0 },
    "no closing line is not that reading, and the reason travels");

  /* The count is reconciled against the blocks, because the shape this exists to refuse is a footer
     naming findings over a reply whose openers this reader did not recognise: read as a reading it
     is a clean corpus arrived at by the parser failing. */
  const bare = findingsIn("DIAGNOSTIC: 1 findings", digests);
  assert.equal(bare.read, false, "a count over no block at all is not a reading");
  assert.match(bare.why, /names 1 finding\(s\) and 0 block\(s\)/u);
  const wrong = findingsIn(["Issue 1: the run looked odd.", "", "DIAGNOSTIC: 1 findings"].join("\n"), digests);
  assert.equal(wrong.read, false, "nor a count over an opener this reader does not hold");
  const caveat = findingsIn("DIAGNOSTIC: 0 findings — this answer is incomplete", digests);
  assert.deepEqual(caveat, { read: false, why: NO_CLOSING, findings: [], leftOut: 0 },
    "a footer carrying a caveat after its count closed nothing either");
  const after = findingsIn(["DIAGNOSTIC: 0 findings", "", "One more thought:"].join("\n"), digests);
  assert.deepEqual(after, { read: false, why: NO_CLOSING, findings: [], leftOut: 0 },
    "and a footer with a reply going on past it did not close anything");

  const run = await asked("They all look fine to me.", [], { room: corpusOf(2) });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, new RegExp(`the reply is unread — ${NO_CLOSING}`, "u"));
  assert.doesNotMatch(run.stdout, /0 finding\(s\)/u, "an unread reply is not reported as one that found nothing");

  const found = await asked("DIAGNOSTIC: 0 findings", [], { room: corpusOf(2) });
  assert.match(found.stdout, /^0 finding\(s\), each cited to a call above$/mu,
    "and a reply that closes on the line and names none is reported as a reading that found nothing");
});

test("what travels is a digest of the calls, and the role forbids a score before a word of it", async () => {
  const run = await asked(ONE, [], { room: corpusOf(2) });
  assert.equal(run.status, 0, run.stderr);
  const body = JSON.parse(run.sent);
  assert.match(body.system[0].text, /THIS IS A DIAGNOSTIC AND NOT A MEASUREMENT/u);
  assert.match(body.system[0].text, /DIAGNOSTIC: <n> findings/u, "and the contract the reader parses back");
  assert.match(body.messages[0].content, /^R1 {2}ISS-0/u, "the payload opens on the label a finding cites");
  assert.match(body.messages[0].content, /forge claim ISS-0/u, "and carries what the call ran");
  assert.equal(run.stdout.includes("excerpted, not read"), true,
    "the screen says the reviewer was shown excerpts and never a transcript whole");
});

test("a call that is not a shell command travels as what it asked for, not as its tool's name", () => {
  const room = tempRoom("stats-diagnose-tools-");
  const tasks = join(room, `claude-${process.getuid()}`, "-fixture-project", "session", "tasks");
  mkdirSync(tasks, { recursive: true });
  const at = (s) => new Date(Date.parse("2026-09-01T00:00:00.000Z") + s * 1000).toISOString();
  const use = (id, s, name, input) => JSON.stringify({ timestamp: at(s),
    message: { role: "assistant", content: [{ type: "tool_use", id, name, input }] } });
  const back = (id, s, body) => JSON.stringify({ timestamp: at(s),
    message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: body }] } });
  writeFileSync(join(tasks, "a0000.output"), [
    JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-7" } }),
    use("c1", 1, "Bash", { command: "forge claim ISS-7" }),
    back("c1", 2, "ISS-7  claim: session iss-7 (agent, pid 1), renewed for 30 minute(s)"),
    use("c2", 3, "Read", { file_path: "/w/plugin/src/wrong-one.mjs" }),
    back("c2", 4, "the file"),
    use("c3", 5, "Edit", { file_path: "/w/plugin/src/wrong-one.mjs",
      old_string: "const bound = 10;", new_string: "const bound = 1000;" }),
    back("c3", 6, "edited"),
    use("c4", 7, "Write", { file_path: "/w/notes.md", content: "PGPASSWORD=notarealone" }),
    back("c4", 8, "written"),
    use("c5", 9, "Grep", { path: "/w/plugin/src", pattern: "deprecatedAPI" }),
    back("c5", 10, "No matches found"),
    use("c6", 11, "Grep", { path: "/w/plugin/src", pattern: "anotherThing" }),
    back("c6", 12, "No matches found"),
  ].join("\n"));
  const runs = runsUnder(join(room, `claude-${process.getuid()}`, "-fixture-project"), null).runs;
  const [text] = payloadOf(runs).map((one) => one.text);
  assert.match(text, /Read: \/w\/plugin\/src\/wrong-one\.mjs/u,
    "a read names the file it read, so the wrong file and the right one are not the same two characters");
  assert.match(text, /Edit: \/w\/plugin\/src\/wrong-one\.mjs\n- const bound = 10;\n\+ const bound = 1000;/u,
    "and an edit carries both sides of what it changed");
  assert.match(text, /Write: \/w\/notes\.md\nPGPASSWORD=\*\*\*/u,
    "and what a write wrote, through the same mask");
  assert.match(text, /Bash: forge claim ISS-7/u, "a shell call is unchanged by any of it");
  /* Two searches of one directory for different things: read as alternatives rather than as parts,
     the place won and both calls came out the same with identical results beside them. */
  assert.match(text, /Grep: deprecatedAPI\n\/w\/plugin\/src/u);
  assert.match(text, /Grep: anotherThing\n\/w\/plugin\/src/u,
    "a call carrying both a pattern and a place carries both");
});

/* The corpus is folded under the checkout's own class table, and the digest was parsed under the
   built-in one: a project that has said what its gate is had its gate travel as a shell call beside
   a run profile that called it a gate. */
test("the digest is parsed under the checkout's own classes, not the built-in ones", () => {
  const room = tempRoom("stats-diagnose-classes-");
  const tasks = join(room, `claude-${process.getuid()}`, "-fixture-project", "session", "tasks");
  mkdirSync(tasks, { recursive: true });
  const at = (s) => new Date(Date.parse("2026-09-01T00:00:00.000Z") + s * 1000).toISOString();
  const use = (id, s, command) => JSON.stringify({ timestamp: at(s),
    message: { role: "assistant", content: [{ type: "tool_use", id, name: "Bash", input: { command } }] } });
  const back = (id, s, body) => JSON.stringify({ timestamp: at(s),
    message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: body }] } });
  writeFileSync(join(tasks, "a0000.output"), [
    JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-8" } }),
    use("c1", 1, "forge claim ISS-8"),
    back("c1", 2, "ISS-8  claim: session iss-8 (agent, pid 1), renewed for 30 minute(s)"),
    use("c2", 3, "./verify"),
    back("c2", 4, "all green"),
    use("c3", 5, "npm run check"),
    back("c3", 6, "all green"),
  ].join("\n"));
  const root = join(room, `claude-${process.getuid()}`, "-fixture-project");
  const declared = classesFor({ gate: "./verify" });
  const runs = runsUnder(root, null, declared).runs;
  const [own] = payloadOf(runs, TOTAL_CHARS, "stats diagnose", declared).map((one) => one.text);
  assert.match(own, /\[gate\] Bash: \.\/verify/u, "what this checkout calls its gate travels as its gate");
  assert.doesNotMatch(own, /\[gate\] Bash: npm run check/u,
    "and a command the checkout replaced does not, however the built-in table reads it");
  const built = payloadOf(runs, TOTAL_CHARS).map((one) => one.text)[0];
  assert.match(built, /\[gate\] Bash: npm run check/u, "which is exactly what the built-in table says");
});

/* A transcript the corpus walk could not open is evidence this reading lost, and it is lost whether
   or not the set the caller named came out full. The count was read by `runsUnder` and dropped by
   this caller, so a reading over two readable runs beside an unopenable file printed as a reading of
   two runs and nothing else — which is a clean corpus with a hole in it. */
test("a transcript this reading could not parse is said, beside a set that came out full", async () => {
  const room = corpusOf(2);
  const tasks = join(room, `claude-${process.getuid()}`, "-fixture-project", "session", "tasks");
  const gone = join(tasks, "a0099.output");
  writeFileSync(gone, "{}\n");
  chmodSync(gone, 0o000);
  const run = await asked(ONE, ["--json", "--last", "2"], { room });
  chmodSync(gone, 0o600);
  assert.equal(run.status, 0, run.stderr);
  const held = JSON.parse(run.stdout);
  assert.equal(held.read.length, 2, "the set the caller asked for came out full");
  assert.deepEqual(held.notRead.map((one) => one.why), ["this reading could not parse them"]);
  assert.match(held.notRead[0].named, /^1 transcript\(s\) under \//u, "with the count and where they are");

  const screen = await asked(ONE, ["--last", "2"], { room: (() => {
    const second = corpusOf(2);
    const held2 = join(second, `claude-${process.getuid()}`, "-fixture-project", "session", "tasks", "a0099.output");
    writeFileSync(held2, "{}\n");
    chmodSync(held2, 0o000);
    return second;
  })() });
  assert.match(screen.stdout, /^not read$/mu, "and the screen says it too, under its own heading");
  assert.match(screen.stdout, /1 transcript\(s\) under .* — this reading could not parse them/u);
});

test("the model call is logged under a kind no consult reader admits", async () => {
  const run = await asked(ONE, [], { room: corpusOf(2) });
  assert.equal(run.status, 0, run.stderr);
  const rows = readFileSync(join(run.home, "forge", "codex-log.jsonl"), "utf8")
    .split("\n").filter(Boolean).map((one) => JSON.parse(one));
  assert.equal(rows.length, 1, "one row for one reading");
  assert.equal(rows[0].kind, DIAGNOSTIC);
  assert.deepEqual(consults(rows), [], "which the consult reader does not hold");
  assert.deepEqual(answered(rows), [], "nor the one every figure of `forge codex eval` is counted over");
  assert.equal(rows[0].ok, true, "and the row still says the call was answered");
  assert.deepEqual(rows[0].runs.map((one) => one.label), ["R1", "R2"], "and which runs it was taken over");
});

test("nothing of this reading reaches the eval, its --json or a mark", () => {
  const source = (rel) => readFileSync(new URL(`../../../src/stats/${rel}`, import.meta.url), "utf8");
  for (const rel of ["eval/eval.mjs", "eval/angles.mjs", "marks/marks.mjs"]) {
    assert.doesNotMatch(source(rel), /diagnose/u, `${rel} reaches the diagnostic`);
  }
  const room = corpusOf(9);
  const held = askStats(room, ["eval", "--checkout", PROJECT, "--size", "3", "--json"]);
  assert.equal(held.status, 0, held.stderr);
  const printed = JSON.parse(held.stdout);
  for (const key of ["diagnostic", "notComparable", "findings"]) {
    assert.equal(Object.hasOwn(printed, key), false, `the eval's reading carries ${key}`);
  }
  const screen = askStats(room, ["eval", "--checkout", PROJECT, "--size", "3", "--angles", "wall"]);
  assert.equal(screen.stdout.includes(NOT_COMPARABLE), false,
    "and the angle screen says nothing this reading says: two readings, two screens");
});

test("the statement in help is folded from the statement itself, not written beside it", () => {
  assert.equal(folded(NOT_COMPARABLE, 96).join(" "), NOT_COMPARABLE, "every word and no other");
  for (const line of folded(NOT_COMPARABLE, 96)) assert.ok(line.length <= 96, line);
  assert.equal(DIAGNOSE_USAGE.includes(folded(NOT_COMPARABLE, 96)[0]), true,
    "and the help prints what the constant says");
});

test("a set with no run in it answers in the reading's own keys, sent or not", async () => {
  const named = await asked(ONE, ["--json", "--issues", "ISS-404"], { room: corpusOf(2) });
  assert.equal(named.status, 0, named.stderr);
  const held = JSON.parse(named.stdout);
  assert.deepEqual([held.sent, held.replyRead, held.read, held.findings], [false, false, [], []]);
  assert.deepEqual(held.notRead,
    [{ named: "ISS-404", why: "no run of this corpus is recorded as having owned it" }],
    "and the key it could not reach is still identifiable in the machine form");
  assert.equal(held.notComparable, NOT_COMPARABLE);

  /* An empty corpus AND keys the caller named: the two were answered by branches of their own, so
     the keys were replaced by the corpus root and neither was identifiable — and which names could
     not be read is the half of AC-19-8-43 a caller can get nowhere else. */
  const nowhere = await asked(ONE, ["--json", "--issues", "ISS-404,ISS-405"],
    { room: tempRoom("stats-diagnose-empty-") });
  assert.equal(nowhere.status, 0, nowhere.stderr);
  const none = JSON.parse(nowhere.stdout);
  assert.equal(none.sent, false, "an empty corpus parses as one object too");
  assert.deepEqual(none.notRead.slice(0, 2).map((one) => one.named), ["ISS-404", "ISS-405"],
    "and both keys are still named, with the empty corpus said beside them rather than instead");
  assert.match(none.notRead.at(-1).why, /no issue-flow run is under it/u);

  const screen = await asked(ONE, ["--issues", "ISS-404"], { room: corpusOf(2) });
  assert.match(screen.stdout, /nothing was sent and nothing was read$/mu,
    "and the screen says a reply was never asked for rather than reporting one");
  assert.equal(screen.sent === undefined || !screen.sent.includes("ISS-404"), true);
});
