/* The verb builds the reviewer's scope, the set it reviews and the range it sends, and no unit
   reaches any of them: only a consult that runs proves the reviewer is handed this consult's own
   anchor rather than the tree at HEAD, its own range rather than whatever an aged base now offers,
   and the tree's whole change rather than the turn record's idea of it. Its own file because it
   stands up a gateway, which the rest of the suite does not. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { tempRoom } from "../fixtures.mjs";
import { canonical } from "../../src/resolve/canonical.mjs";

/* A stand-in gateway asks for `git_diff` with no arguments on its first call and answers on its
   second; what the tool returned is on the log row, and its size says which of the two possible
   diffs it got (ISS-51). */
const standIn = async (answerCalls, { tool = true } = {}) => {
  const { createServer } = await import("node:http");
  const sse = (events) => events.map((one) => `event: ${one.type}\ndata: ${JSON.stringify(one)}\n\n`).join("");
  const asked = { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "t1", name: "git_diff" } };
  let call = 0;
  const sent = [];
  const server = createServer((req, res) => {
    req.setEncoding("utf8");
    req.on("data", (chunk) => sent.push(chunk));
    req.on("end", () => {
      call += 1;
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(sse([
        { type: "message_start", message: { usage: { input_tokens: 1 } } },
        ...(tool && call === 1
          ? [asked, { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: "{}" } },
            { type: "content_block_stop", index: 0 }]
          : [{ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: answerCalls } }]),
        { type: "message_delta", delta: { stop_reason: tool && call === 1 ? "tool_use" : "end_turn" }, usage: { output_tokens: 1 } },
      ]));
    });
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  return { port: server.address().port, close: () => server.close(), shown: () => sent.join("") };
};

test("a recheck's reviewer is handed the head its findings were made against, not HEAD", async () => {
  const room = tempRoom("codex-anchor-");
  const home = tempRoom("codex-anchor-home-");
  const git = (...argv) => spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...argv], { encoding: "utf8" });
  spawnSync("git", ["init", "-q", room]);
  writeFileSync(join(room, "judged.txt"), "reviewed\n");
  writeFileSync(join(room, "elsewhere.txt"), "not this consult's business\n");
  git("add", ".");
  git("commit", "-qm", "one");
  const head = git("rev-parse", "HEAD").stdout.trim();
  /* The rechecked file is exactly as the findings were made against it; another file is not, and
     the whole checkout at HEAD is the answer that would carry it in. */
  writeFileSync(join(room, "elsewhere.txt"), `${"a change the recheck is not about\n".repeat(40)}`);

  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "codex-log.jsonl"), `${JSON.stringify({
    kind: "consult", id: "c1", ok: true, root: room, at: "2026-09-04T10:00:00.000Z", head,
    files: ["judged.txt"], send: "diffs",
    reply: "CODEX: 1 findings\n- **F1 — New — major:** `judged.txt:1` — the line is wrong.",
  })}\n`);

  const gateway = await standIn("1. REFUTED — it is fixed.\n\nCODEX: 0 findings");
  writeFileSync(join(home, "proxy.env"), [
    `export ANTHROPIC_BASE_URL="http://127.0.0.1:${gateway.port}"`,
    "ANTHROPIC_AUTH_TOKEN=sk-stand-in",
    'ANTHROPIC_DEFAULT_FABLE_MODEL="cx/gpt-5.6-sol"',
  ].join("\n"));
  /* Spawned rather than spawnSync'd: the stand-in listens on this event loop, and a blocking child
     would leave it unable to answer the consult it is waiting on. */
  const child = spawn(new URL("../../bin/forge", import.meta.url).pathname,
    ["codex", "consult", "--recheck", "--rounds", "2", "judged.txt"],
    { cwd: room, env: { ...process.env, XDG_CONFIG_HOME: home, CLAUDE_PROXY_ENV: join(home, "proxy.env") } });
  child.stdin.end("the fix is in");
  let said = "";
  child.stderr.on("data", (one) => { said += one; });
  child.stdout.resume();
  const status = await new Promise((done) => child.on("close", done));
  gateway.close();
  assert.equal(status, 0, said);
  const rows = readFileSync(join(home, "forge", "codex-log.jsonl"), "utf8")
    .split("\n").filter(Boolean).map((one) => JSON.parse(one));
  const ran = rows.find((one) => one.kind === "consult" && one.id !== "c1" && one.tools?.length);
  assert.ok(ran, "the recheck answered and logged what its reviewer ran");
  assert.deepEqual(ran.tools[0], { name: "git_diff", input: {}, chars: ran.tools[0].chars, error: false });
  assert.equal(
    ran.tools[0].chars,
    `no change against ${head} in the file(s) this consult named`.length,
    "the rechecked file is unmoved since that head, and the answer says so rather than handing over the tree",
  );
});

/* The measured shape of ISS-272: a base ref that aged, other runs' landings between it and HEAD, and
   one character budget spread over the wider set until the file the recheck was about went clipped. */
test("a recheck given no file reads the range its consult recorded, not what an aged base now offers", async () => {
  const room = tempRoom("codex-range-");
  const home = tempRoom("codex-range-home-");
  const git = (...argv) => spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...argv], { encoding: "utf8" });
  spawnSync("git", ["init", "-q", room]);
  writeFileSync(join(room, "reviewed.txt"), "reviewed\n");
  git("add", ".");
  git("commit", "-qm", "the branch point");
  const base = git("rev-parse", "HEAD").stdout.trim();

  /* Four landings of another run's, each past the per-file cap, so the whole character budget is
     spent before the rechecked file is reached — it sorts last, and it is the one that went out
     clipped: the recheck was answered on a file it never sent whole. */
  for (const at of [1, 2, 3, 4]) writeFileSync(join(room, `landed-${at}.txt`), "another run's work\n".repeat(5000));
  git("add", ".");
  git("commit", "-qm", "what other runs landed while this branch was out");
  writeFileSync(join(room, "reviewed.txt"), "reviewed, and fixed\n");
  git("add", ".");
  git("commit", "-qm", "this branch's own change");

  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "codex-log.jsonl"), `${JSON.stringify({
    kind: "consult", id: "c1", ok: true, root: room, at: "2026-09-05T10:00:00.000Z",
    files: ["reviewed.txt"], send: "diffs",
    reply: "CODEX: 1 findings\n- **F1 — New — major:** `reviewed.txt:1` — the line is wrong.",
  })}\n`);

  const gateway = await standIn("1. **REFUTED** — it is fixed.\n\nCODEX: 0 findings", { tool: false });
  writeFileSync(join(home, "proxy.env"), [
    `export ANTHROPIC_BASE_URL="http://127.0.0.1:${gateway.port}"`,
    "ANTHROPIC_AUTH_TOKEN=sk-stand-in",
    'ANTHROPIC_DEFAULT_FABLE_MODEL="cx/gpt-5.6-sol"',
  ].join("\n"));
  const child = spawn(new URL("../../bin/forge", import.meta.url).pathname,
    ["codex", "consult", "--recheck", "--diff", "--base", base, "--rounds", "1"],
    { cwd: room, env: { ...process.env, XDG_CONFIG_HOME: home, CLAUDE_PROXY_ENV: join(home, "proxy.env") } });
  child.stdin.end("the fix is in");
  let said = "";
  child.stderr.on("data", (one) => { said += one; });
  child.stdout.resume();
  const status = await new Promise((done) => child.on("close", done));
  gateway.close();
  assert.equal(status, 0, said);

  assert.match(said, /so the 5 file\(s\) changed against/u, "the checkout offers all five: four landings and the one this recheck is about");
  assert.match(
    said,
    /a recheck of c1, so its 1 recorded file\(s\) travel, not the 5 that differ from [0-9a-f]+ now\./u,
    "and the line names the cause: the range widened under the run, so the consult's own range travels instead",
  );
  assert.doesNotMatch(said, /sent clipped/u, "nothing is clipped once the four landings are out of the payload");

  const rows = readFileSync(join(home, "forge", "codex-log.jsonl"), "utf8")
    .split("\n").filter(Boolean).map((one) => JSON.parse(one));
  const ran = rows.find((one) => one.kind === "consult" && one.id !== "c1");
  assert.deepEqual(ran.files, ["reviewed.txt"], "and the row records the judged consult's range, not the five the base now spans");
  assert.deepEqual(ran.sent.map((one) => one.clipped), [false]);
});

const { shownOf } = await import("../../src/codex/codex-set.mjs");

/* A diff git refused is the one absence that is not an answer, and dropping on it clears a real
   deletion from the record before any reviewer has seen it. The unit reaches it; no room can. */
test("a part whose diff git refused is kept, where one with no diff at all is not", () => {
  const gone = { rel: "src/gone.mjs", missing: "not a readable file", diff: { untracked: true } };
  const failed = { rel: "src/doomed.mjs", missing: "not a readable file", diff: { error: "git diff failed" } };
  const held = shownOf("/nowhere", [gone, failed], "HEAD");
  assert.deepEqual(held.empty, ["src/gone.mjs"], "only the one git answered about is dropped");
  assert.deepEqual(held.parts.map((one) => one.rel), ["src/doomed.mjs"], "and the refused diff travels with its error");
  assert.equal(held.said.length, 1);
  assert.match(held.said[0], /src\/gone\.mjs/u);
  assert.doesNotMatch(held.said[0], /doomed/u, "which no line calls absent");
});

const PATTERN = "^(src|test|ignored)/.*\\.mjs$";

/* A room whose tree and whose turn record disagree in every way they can: a path the pattern excludes,
   one git ignores, one that was written and deleted, one committed and untouched, one deleted from the
   index, and a symbolic link with nothing under it. */
const disagreeing = (label) => {
  const room = tempRoom(label);
  const home = tempRoom(`${label}home-`);
  const git = (...argv) => spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...argv], { encoding: "utf8" });
  spawnSync("git", ["init", "-q", room]);
  mkdirSync(join(room, "src"), { recursive: true });
  mkdirSync(join(room, "test"), { recursive: true });
  mkdirSync(join(room, "ignored"), { recursive: true });
  writeFileSync(join(room, ".gitignore"), "ignored/\n/--draft*\n");
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ codex: { pathRe: PATTERN } }));
  writeFileSync(join(room, "src/thing.mjs"), "export const one = 1;\n");
  writeFileSync(join(room, "test/thing.test.mjs"), "assert.equal(one, 1);\n");
  writeFileSync(join(room, "src/settled.mjs"), "export const settled = true;\n");
  writeFileSync(join(room, "doomed.txt"), "this file is about to go\n");
  git("add", ".");
  git("commit", "-qm", "the base");
  return { room, home, git };
};

const seedRecord = (home, root, files) => {
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "codex.json"), JSON.stringify({ turns: { [root]: { files, at: Date.now() } } }));
};

const gatewayAt = (home, port) => writeFileSync(join(home, "proxy.env"), [
  `export ANTHROPIC_BASE_URL="http://127.0.0.1:${port}"`,
  "ANTHROPIC_AUTH_TOKEN=sk-stand-in",
  'ANTHROPIC_DEFAULT_FABLE_MODEL="cx/gpt-5.6-sol"',
].join("\n"));

const consulted = async (room, home, argv) => {
  const child = spawn(new URL("../../bin/forge", import.meta.url).pathname, ["codex", "consult", ...argv],
    { cwd: room, env: { ...process.env, XDG_CONFIG_HOME: home, CLAUDE_PROXY_ENV: join(home, "proxy.env") } });
  child.stdin.end("the intent");
  let said = "";
  child.stderr.on("data", (one) => { said += one; });
  child.stdout.resume();
  const status = await new Promise((done) => child.on("close", done));
  return { status, said };
};

/* Closed in a `finally`, because a stand-in left listening on a failed assertion holds the event loop
   open and the run hangs instead of reporting which case failed. */
const withGateway = async (home, body) => {
  const gateway = await standIn("CODEX: 0 findings", { tool: false });
  gatewayAt(home, gateway.port);
  try {
    return await body(gateway);
  } finally {
    gateway.close();
  }
};

const logRows = (home) => readFileSync(join(home, "forge", "codex-log.jsonl"), "utf8")
  .split("\n").filter(Boolean).map((one) => JSON.parse(one));

const recordNow = (home, root) => JSON.parse(readFileSync(join(home, "forge", "codex.json"), "utf8")).turns[root].files;

test("a diff consult reviews the tree's own change, tests and deletions included, and says what of the turn record it left out", async () => {
  const { room, git } = disagreeing("codex-set-");
  const { home } = disagreeing("codex-set-spare-");
  const root = canonical(room);
  writeFileSync(join(room, "src/thing.mjs"), "export const one = 2;\n");
  writeFileSync(join(room, "test/thing.test.mjs"), "assert.equal(one, 2);\n");
  writeFileSync(join(room, "ignored/work.mjs"), "export const hidden = true;\n");
  writeFileSync(join(room, "ignored/a name with spaces.mjs"), "export const awkward = true;\n");
  /* At the root, so the path itself opens with the hyphen this CLI's parser would eat: one inside
     `ignored/` opens with an `i` and proves nothing about it. */
  writeFileSync(join(room, "--draft.mjs"), "export const flagShaped = true;\n");
  writeFileSync(join(room, "--draft name.mjs"), "export const both = true;\n");
  writeFileSync(join(room, "ignored/it's.mjs"), "export const apostrophe = true;\n");
  symlinkSync(join(room, "nowhere.mjs"), join(room, "src/dangling.mjs"));
  git("rm", "-q", "doomed.txt");
  seedRecord(home, root, ["src/thing.mjs", "src/gone.mjs", "ignored/work.mjs",
    "ignored/a name with spaces.mjs", "--draft.mjs", "--draft name.mjs", "ignored/it's.mjs", "src/settled.mjs"]);

  const { status, said, shown } = await withGateway(home, async (gateway) => {
    const ran = await consulted(room, home, ["--diff", "--rounds", "1"]);
    return { ...ran, shown: gateway.shown() };
  });
  assert.equal(status, 0, said);

  const set = ["doomed.txt", "src/dangling.mjs", "src/thing.mjs", "test/thing.test.mjs"];
  assert.match(said, /nothing named, so the 4 file\(s\) changed against HEAD/u, "the tree's list decides, not the record's");
  for (const rel of set) assert.ok(shown.includes(`### ${rel}`), `${rel} reached the reviewer`);
  assert.deepEqual(logRows(home).find((one) => one.kind === "consult" && one.ok).files, set,
    "and the log records the set that was reviewed, tests and the deletion included");

  assert.match(said, /src\/gone\.mjs\. Out of the review, out of the log and out of the record/u, "the phantom is named as absent");
  assert.match(said, /git ignores[\s\S]*forge codex consult --diff ignored\/work\.mjs 'ignored\/a name with spaces\.mjs' \.\/--draft\.mjs '\.\/--draft name\.mjs' 'ignored\/it'\\''s\.mjs'/u,
    "the ignored paths are named as ignored, with a command a shell and this CLI's own parser both read back");
  assert.match(said, /src\/settled\.mjs\. The tree does not change them against HEAD/u, "and the unchanged one as unchanged");
  assert.ok(shown.includes("deleted file mode"), "the deletion travels as its diff");
  assert.ok(!shown.includes("### src/gone.mjs"), "and the phantom travels in no form at all");

  const left = recordNow(home, root);
  assert.ok(!left.includes("src/gone.mjs"), "the phantom leaves the turn record");
  assert.deepEqual(left, ["ignored/work.mjs", "ignored/a name with spaces.mjs", "--draft.mjs",
    "--draft name.mjs", "ignored/it's.mjs", "src/settled.mjs"], "and nothing else does but what was reviewed");
});

test("a consult given a file reviews that file, whatever the tree and the record hold", async () => {
  const { room, git } = disagreeing("codex-named-");
  const { home } = disagreeing("codex-named-spare-");
  writeFileSync(join(room, "src/thing.mjs"), "export const one = 2;\n");
  writeFileSync(join(room, "test/thing.test.mjs"), "assert.equal(one, 2);\n");
  git("rm", "-q", "doomed.txt");
  seedRecord(home, canonical(room), ["src/gone.mjs", "src/settled.mjs"]);

  const { status, said } = await withGateway(home, () => consulted(room, home, ["--diff", "--rounds", "1", "src/thing.mjs"]));
  assert.equal(status, 0, said);
  assert.deepEqual(logRows(home).find((one) => one.kind === "consult" && one.ok).files, ["src/thing.mjs"]);
  assert.doesNotMatch(said, /nothing named/u, "a path the caller typed is their range and is never widened");
  assert.match(said, /src\/gone\.mjs\. Out of the review, out of the log and out of the record/u,
    "the phantom is dropped on this route too, where nothing else ever read the record (ISS-952)");
  assert.deepEqual(recordNow(home, canonical(room)), ["src/settled.mjs"],
    "and a record path the tree does hold is neither classified nor cleared");
});

test("a path that is not in the tree and has no diff reaches neither the reviewer nor the log, and leaves the turn record", async () => {
  const { room } = disagreeing("codex-phantom-");
  const { home } = disagreeing("codex-phantom-spare-");
  seedRecord(home, canonical(room), ["src/gone.mjs"]);

  const { status, said, shown } = await withGateway(home, async (gateway) => {
    const ran = await consulted(room, home, ["--diff", "--rounds", "1"]);
    return { ...ran, shown: gateway.shown() };
  });
  assert.equal(status, 1, "a consult with nothing to show is refused rather than billed");
  assert.match(said, /every path it was offered is absent from the tree/u);
  assert.equal(shown.length, 0, "and the reviewer was never called");
  assert.deepEqual(recordNow(home, canonical(room)), [], "the phantom leaves the record even where the consult refused");
});

/* The consult that collects no diff at all cannot tell a phantom from a deletion by absence, and
   clearing on that reading would lose a real change from the record before the reviewer answered. */
test("a consult with no base keeps a tracked deletion the record holds, and drops only the phantom beside it", async () => {
  const { room, git } = disagreeing("codex-nobase-");
  const { home } = disagreeing("codex-nobase-spare-");
  git("rm", "-q", "doomed.txt");
  seedRecord(home, canonical(room), ["doomed.txt", "src/gone.mjs", "src/settled.mjs"]);

  const { status, said, shown } = await withGateway(home, async (gateway) => {
    const ran = await consulted(room, home, ["--rounds", "1"]);
    return { ...ran, shown: gateway.shown() };
  });
  assert.equal(status, 0, said);
  assert.match(said, /1 file\(s\) offered are deleted from the tree and travel with no diff[\s\S]*doomed\.txt/u);
  assert.match(said, /src\/gone\.mjs\. Not reviewed, not recorded/u, "and the phantom beside it is the one that goes");
  assert.ok(shown.includes("### doomed.txt"), "the deletion still reaches the reviewer");
  assert.deepEqual(logRows(home).find((one) => one.kind === "consult" && one.ok).files, ["doomed.txt", "src/settled.mjs"]);
  assert.deepEqual(recordNow(home, canonical(room)), [], "and only the phantom left the record on absence alone");
});

/* The one route the tree must not decide: a recheck is about one consult's findings, so the file they
   are about has to travel even where the tree no longer differs in it and something else does. */
test("a recheck reaches the file its findings are about, whatever else the tree has dirty", async () => {
  const room = tempRoom("codex-recheck-set-");
  const home = tempRoom("codex-recheck-set-home-");
  const git = (...argv) => spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...argv], { encoding: "utf8" });
  spawnSync("git", ["init", "-q", room]);
  writeFileSync(join(room, "judged.txt"), "reviewed, and fixed\n");
  writeFileSync(join(room, "elsewhere.txt"), "not this recheck's business\n");
  git("add", ".");
  git("commit", "-qm", "the fix, committed");
  const head = git("rev-parse", "HEAD").stdout.trim();
  writeFileSync(join(room, "elsewhere.txt"), "another file, dirty and nothing to do with it\n");

  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "codex-log.jsonl"), `${JSON.stringify({
    kind: "consult", id: "c1", ok: true, root: canonical(room), at: "2026-09-08T10:00:00.000Z", head,
    files: ["judged.txt"], send: "diffs",
    reply: "CODEX: 1 findings\n- **F1 — New — major:** `judged.txt:1` — the line is wrong.",
  })}\n`);
  seedRecord(home, canonical(room), ["judged.txt"]);

  const { status, said, shown } = await withGateway(home, async (gateway) => {
    const ran = await consulted(room, home, ["--recheck", "--diff", "--rounds", "1"]);
    return { ...ran, shown: gateway.shown() };
  });
  assert.equal(status, 0, said);
  assert.match(said, /a recheck answers[\s\S]*name files to decide it yourself/u, "the record decides a recheck's set, and says so");
  assert.ok(shown.includes("judged.txt:1"), "the finding being rechecked reached the reviewer");
  assert.ok(!shown.includes("### elsewhere.txt"), "and the unrelated dirt did not");
});

/* Two absences git alone can produce, and both are changes: a rename's source, which rename-aware
   `--name-only` names nowhere, and a tree whose whole change is deletions, which every part reading
   `missing` made look like a tree that had not moved. */
test("a rename travels as both its ends, and a deletion-only change travels as its diffs", async () => {
  const { room, git } = disagreeing("codex-rename-");
  const { home } = disagreeing("codex-rename-spare-");
  git("mv", "src/thing.mjs", "src/renamed.mjs");
  seedRecord(home, canonical(room), ["src/thing.mjs"]);

  const first = await withGateway(home, async (gateway) => {
    const ran = await consulted(room, home, ["--diff", "--rounds", "1"]);
    return { ...ran, shown: gateway.shown() };
  });
  assert.equal(first.status, 0, first.said);
  assert.match(first.said, /nothing named, so the 2 file\(s\) changed against HEAD: src\/renamed\.mjs, src\/thing\.mjs\./u);
  assert.doesNotMatch(first.said, /src\/thing\.mjs\. Out of the review/u, "the rename's source is a deletion, not a phantom");
  assert.ok(first.shown.includes("deleted file mode"), "and its deletion is what travels for it");
  assert.deepEqual(recordNow(home, canonical(room)), [], "it left the record as a file this consult reviewed");

  const { room: bare } = disagreeing("codex-onlydel-");
  const { home: barehome } = disagreeing("codex-onlydel-spare-");
  spawnSync("git", ["-C", bare, "-c", "user.email=t@t", "-c", "user.name=t", "rm", "-q", "doomed.txt"]);
  const second = await withGateway(barehome, async (gateway) => {
    const ran = await consulted(bare, barehome, ["--diff", "--rounds", "1"]);
    return { ...ran, shown: gateway.shown() };
  });
  assert.equal(second.status, 0, second.said);
  assert.doesNotMatch(second.said, /nothing differs from HEAD, so this recheck carries no diff/u,
    "a tree whose only change is a deletion has moved");
  assert.ok(second.shown.includes("deleted file mode"), "so the deletion travels as a diff and not as a body");
});

test("the turn record travels where nothing differs from the base, and says so both ways", async () => {
  const { room } = disagreeing("codex-settled-");
  const { home } = disagreeing("codex-settled-spare-");
  seedRecord(home, canonical(room), ["src/settled.mjs"]);

  const { first, second } = await withGateway(home, async () => {
    const one = await consulted(room, home, ["--diff", "--rounds", "1"]);
    seedRecord(home, canonical(room), ["src/settled.mjs"]);
    return { first: one, second: await consulted(room, home, ["--rounds", "1"]) };
  });
  assert.equal(first.status, 0, first.said);
  assert.match(first.said, /nothing differs from HEAD, so the 1 file\(s\) this turn's record holds travel instead/u);
  assert.match(first.said, /holds only what `\^\(src\|test\|ignored\)/u, "the pattern the record is kept on is named");
  assert.match(first.said, /--base HEAD~1` reviews that commit whole/u, "and the route to the commit just made");
  assert.equal(second.status, 0, second.said);
  assert.match(second.said, /1 file\(s\) from this turn's record, which holds only what `\^\(src\|test\|ignored\)/u);
  assert.match(second.said, /Pass --diff for the tree's own list/u, "with no base, the record is the only set there is");
});
