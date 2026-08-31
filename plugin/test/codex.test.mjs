import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* Imported after XDG_CONFIG_HOME moves, so nothing here can touch the caller's own state file. */
const sandbox = mkdtempSync(join(tmpdir(), "forge-codex-"));
process.env.XDG_CONFIG_HOME = sandbox;
for (const name of ["FORGE_CODEX_PATH_RE", "FORGE_CODEX_DISABLE", "FORGE_CODEX_INSIDE"]) {
  delete process.env[name];
}

const {
  STATE_PATH,
  afterTouch,
  ageOf,
  consultArgs,
  hookRecord,
  pendingIn,
  recordable,
  stopNotice,
} = await import("../src/codex.mjs");
const {
  bundle,
  consume,
  digest,
  gated,
  inside,
  modelBehind,
  needed,
  onlyNeeds,
  profileFrom,
  promptFor,
  withDiffs,
  sameFamily,
} = await import("../src/codex-api.mjs");
const { partition } = await import("../src/resolve/flags.mjs");
const BOOLEANS = ["--bg", "--allow-echo"];
const { answered, countedIn, historyFor, logEntries, pairedLog, startedState, verdictsBy } =
  await import("../src/codex-log.mjs");

/* A `.git` that is a file is what a worktree has, and repoRoot only asks whether it exists. */
const REPO = join(sandbox, "repo");
mkdirSync(join(REPO, "docs"), { recursive: true });
mkdirSync(join(REPO, "src"), { recursive: true });
writeFileSync(join(REPO, ".git"), "gitdir: elsewhere\n");
for (const path of ["docs/PLAN.md", "docs/TWO.md", "src/codex.mjs"]) {
  writeFileSync(join(REPO, path), "x");
}
writeFileSync(join(sandbox, "outside.md"), "secrets");
symlinkSync(join(sandbox, "outside.md"), join(REPO, "docs", "escape.md"));

const PROFILE = [
  "# a gateway profile",
  'export ANTHROPIC_BASE_URL="https://gateway.example.com"',
  "ANTHROPIC_AUTH_TOKEN=sk-secret",
  'ANTHROPIC_DEFAULT_FABLE_MODEL="cx/gpt-5.6-sol"',
  "ANTHROPIC_DEFAULT_OPUS_MODEL=cx/gpt-5.6-terra",
  "not a pair at all",
].join("\n");

const state = () => JSON.parse(readFileSync(STATE_PATH, "utf8"));
const clearState = () => rmSync(STATE_PATH, { force: true });

test("a profile line survives export, quotes and comments", () => {
  const values = profileFrom(PROFILE);
  assert.equal(values.ANTHROPIC_BASE_URL, "https://gateway.example.com");
  assert.equal(values.ANTHROPIC_AUTH_TOKEN, "sk-secret");
  assert.equal(Object.hasOwn(values, "not a pair at all"), false);
});

/* The point of the verb: the slot named on the command line is not the model that answers. */
test("the model slot resolves through the profile, not the flag", () => {
  const values = profileFrom(PROFILE);
  assert.equal(modelBehind(values, "fable"), "cx/gpt-5.6-sol");
  assert.equal(modelBehind(values, "opus"), "cx/gpt-5.6-terra");
  assert.equal(modelBehind(values, "haiku"), null);
  assert.equal(modelBehind(undefined), null);
});

test("a slot resolving to this model's own family is the echo case", () => {
  assert.equal(sameFamily("cx/gpt-5.6-sol"), false);
  assert.equal(sameFamily("claude-fable-5"), true);
  assert.equal(sameFamily("anthropic/Claude-Opus-5"), true);
  assert.equal(sameFamily(null), false);
});

/* Containment has to be physical. `..` is the traversal you can see; a symlink committed inside the
   repository is the one you cannot, and both routes end at `readFileSync`. */
test("a path escapes the repo by neither dots nor a symlink", () => {
  assert.equal(inside(REPO, "docs/PLAN.md"), "docs/PLAN.md");
  assert.equal(inside(REPO, join(REPO, "src/codex.mjs")), "src/codex.mjs");
  assert.equal(inside(REPO, "../outside.md"), null);
  assert.equal(inside(REPO, "docs/escape.md"), null);
  assert.equal(inside(REPO, "docs"), null);
  assert.equal(inside(REPO, "docs/NOPE.md"), null);
});

test("the recorded path set is the default docs one, and is overridable", (t) => {
  assert.equal(recordable("docs/PLAN.md"), true);
  assert.equal(recordable("plugin/src/codex.mjs"), false);
  process.env.FORGE_CODEX_PATH_RE = "\\.md$";
  t.after(() => {
    delete process.env.FORGE_CODEX_PATH_RE;
  });
  assert.equal(recordable("notes/PLAN.md"), true);
});

/* `first` and `added` are different questions: the second new file of a turn is recorded but must
   not repeat the instruction the first one carried. */
test("only the first file of a turn is announced, and a repeat is neither", () => {
  const empty = afterTouch({}, REPO, "docs/A.md");
  assert.deepEqual(empty, { files: ["docs/A.md"], added: true, first: true });
  const held = { turns: { [REPO]: { files: ["docs/A.md"] } } };
  assert.deepEqual(afterTouch(held, REPO, "docs/B.md"), {
    files: ["docs/A.md", "docs/B.md"],
    added: true,
    first: false,
  });
  assert.deepEqual(afterTouch(held, REPO, "docs/A.md"), {
    files: ["docs/A.md"],
    added: false,
    first: false,
  });
});

/* One state file, many checkouts: keyed by root, or two repositories trade files with each other. */
test("a turn is remembered per repository, not per machine", () => {
  const held = { turns: { "/a": { files: ["docs/A.md"] }, "/b": { files: ["docs/B.md"] } } };
  assert.deepEqual(pendingIn(held, "/a"), ["docs/A.md"]);
  assert.deepEqual(pendingIn(held, "/b"), ["docs/B.md"]);
  assert.deepEqual(pendingIn(held, "/c"), []);
  assert.deepEqual(afterTouch(held, "/a", "docs/B.md").files, ["docs/A.md", "docs/B.md"]);
});

test("a missing intent is stated rather than left blank", () => {
  const parts = [{ rel: "docs/A.md", text: "the body" }];
  const withIntent = promptFor("renaming the verb", parts);
  assert.match(withIntent, /renaming the verb/);
  assert.match(withIntent, /docs\/A\.md/);
  assert.match(withIntent, /the body/);
  assert.match(promptFor("", parts), /have not described my intent/);
});

/* It has no tools, so the bytes travel with the prompt — and a file cut short must say so, or the
   reviewer reasons about an ending that was never sent. */
test("a file is sent whole with its hash, and a missing one is named", () => {
  const [whole] = bundle(REPO, ["docs/PLAN.md"]);
  assert.equal(whole.text, "x");
  assert.equal(whole.clipped, false);
  assert.equal(whole.sha, digest("x"));
  const [absent] = bundle(REPO, ["docs/NOPE.md"]);
  assert.equal(absent.text, undefined);
  assert.match(absent.missing, /not a readable file/);
  /* Re-validated at read time, so a symlink out of the repo is refused by the reader too. */
  const [escaped] = bundle(REPO, ["docs/escape.md"]);
  assert.equal(escaped.text, undefined);
});

/* The frames are what the gateway actually sends: CRLF from some proxies, split across chunks at
   arbitrary byte boundaries, and a last frame that may arrive with no blank line after it. */
test("the stream is read across chunk boundaries, CRLF frames and a bare tail", async () => {
  const events = [
    'event: message_start\r\ndata: {"type":"message_start","message":{"usage":{"input_tokens":7}}}\r\n\r\n',
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hel"}}\n\n',
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"lo"}}\r\n\r\n',
    'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":2}}',
  ].join("");
  const bytes = Buffer.from(events, "utf8");
  async function* fragments() {
    for (let at = 0; at < bytes.length; at += 7) yield bytes.subarray(at, at + 7);
  }
  const seen = [];
  const held = await consume(fragments(), (text) => seen.push(text));
  assert.equal(held.text, "Hello");
  assert.deepEqual(seen, ["Hel", "lo"]);
  assert.equal(held.stop, "end_turn");
  assert.deepEqual(held.usage, { input_tokens: 7, output_tokens: 2 });
});

test("a streamed error is raised, not returned as an answer", async () => {
  async function* frames() {
    yield Buffer.from('data: {"type":"error","error":{"message":"overloaded"}}\n\n', "utf8");
  }
  await assert.rejects(() => consume(frames(), () => {}), /overloaded/);
});

/* A list with no age reads as this turn's work however old it is. */
test("pending work is dated in words", () => {
  const now = Date.parse("2026-08-31T12:00:00.000Z");
  assert.equal(ageOf(undefined), "at an unknown time");
  assert.equal(ageOf(now - 10_000, now), "just now");
  assert.equal(ageOf(now - 5 * 60_000, now), "5 minute(s) ago");
  assert.equal(ageOf(now - 3 * 3_600_000, now), "3 hour(s) ago");
  assert.equal(ageOf(now - 5 * 86_400_000, now), "5 day(s) ago");
});

/* A verdict is a separate record; replaying advice without what was done with it made resolved /
   still open a guess. */
test("a verdict is joined back to the consult it scored", () => {
  const entries = [
    { kind: "consult", id: "aa", ok: true, root: "/a", at: "1", files: ["x"], intent: "i", reply: "r" },
    { kind: "verdict", of: "aa", accepted: 2, rejected: 1, note: "kept the blocker" },
  ];
  assert.equal(verdictsBy(entries).get("aa").accepted, 2);
  assert.match(historyFor(entries, "/a")[0].verdict, /2 accepted, 1 rejected — kept the blocker/);
});

test("prior exchanges replay this repository's answered consults, with the intent judged", () => {
  const entries = [
    { kind: "consult", ok: true, root: "/a", at: "1", files: ["x"], intent: "first go", reply: "first" },
    { kind: "consult", ok: false, root: "/a", at: "2", files: ["y"], error: "boom" },
    { kind: "consult", ok: true, root: "/b", at: "3", files: ["z"], reply: "elsewhere" },
    { kind: "consult", ok: true, root: "/a", at: "4", files: ["w"], reply: "second" },
  ];
  const held = historyFor(entries, "/a");
  assert.deepEqual(held.map((one) => one.reply), ["first", "second"]);
  assert.equal(held[0].intent, "first go");
  assert.equal(held[1].intent, "(none given)");
  assert.deepEqual(historyFor(entries, "/a", 1).map((one) => one.reply), ["second"]);
  assert.deepEqual(historyFor(entries, "/c"), []);
});

/* A verdict against an error entry would read as "3 accepted" on a gateway timeout. */
test("only an answered consult can carry a verdict", () => {
  const entries = [
    { kind: "consult", ok: true, reply: "said something" },
    { kind: "consult", ok: false, error: "timed out" },
    { kind: "consult", ok: true, reply: "" },
  ];
  assert.deepEqual(answered(entries).map((one) => one.reply), ["said something"]);
});

/* A served path is read with the caller's own permissions, so the reviewer must not be able to name
   its way out — and a refusal is reported, or it cannot tell "outside" from "you forgot". */
test("a NEED is honoured only inside the repo, once, and refusals come back", () => {
  const asked = [
    "NEED: docs/TWO.md",
    "NEED: docs/TWO.md",
    "NEED: ../outside.md",
    "NEED: docs/escape.md",
    "NEED: docs/PLAN.md",
  ].join("\n");
  const { wanted, refused } = needed(asked, REPO, ["docs/PLAN.md"]);
  assert.deepEqual(wanted, ["docs/TWO.md"]);
  assert.equal(refused.length, 4);
  assert.match(refused.join(" "), /outside this repository/);
  assert.deepEqual(needed("nothing asked", REPO, []), { wanted: [], refused: [] });
});

/* A reply that is only NEED lines is a request; one that carries findings is the answer, whatever
   stray line came with it. */
test("a request is told apart from an answer", () => {
  assert.equal(onlyNeeds("NEED: a.md\nNEED: b.md"), true);
  assert.equal(onlyNeeds("NEED: a.md\n\n## Tech Lead\n- blocker"), false);
  assert.equal(onlyNeeds("## Tech Lead"), false);
  assert.equal(onlyNeeds(""), false);
});

test("the hook records a document once, and announces only the first", () => {
  clearState();
  const first = hookRecord({}, [join(REPO, "docs", "PLAN.md")]);
  assert.match(first, /forge codex consult/);
  assert.match(first, /docs\/PLAN\.md/);
  assert.deepEqual(pendingIn(state(), REPO), ["docs/PLAN.md"]);

  assert.equal(hookRecord({}, [join(REPO, "docs", "PLAN.md")]), null);
  assert.deepEqual(pendingIn(state(), REPO), ["docs/PLAN.md"]);

  assert.equal(hookRecord({}, [join(REPO, "docs", "TWO.md")]), null);
  assert.deepEqual(pendingIn(state(), REPO), ["docs/PLAN.md", "docs/TWO.md"]);
  clearState();
});

test("a path the filter does not cover, or no repository at all, is not recorded", () => {
  clearState();
  assert.equal(hookRecord({}, [join(REPO, "src", "codex.mjs")]), null);
  assert.equal(hookRecord({}, [join(sandbox, "outside.md")]), null);
  assert.equal(existsSync(STATE_PATH), false);
});

test("the disable switch silences both halves", (t) => {
  clearState();
  process.env.FORGE_CODEX_DISABLE = "1";
  t.after(() => {
    delete process.env.FORGE_CODEX_DISABLE;
    clearState();
  });
  assert.equal(hookRecord({}, [join(REPO, "docs", "PLAN.md")]), null);
  assert.equal(stopNotice(), null);
});

/* An unpaired start is a consult that died; a paired one is replaced by what it answered. */
test("the log pairs a start with its result on the id", () => {
  const entries = [
    { kind: "started", id: "aa", at: "A", files: ["docs/A.md"] },
    { kind: "consult", id: "aa", at: "A", ok: true, reply: "x" },
    { kind: "started", id: "bb", at: "B", files: ["docs/B.md"] },
  ];
  assert.deepEqual(pairedLog(entries).map((one) => `${one.kind}:${one.id}`), ["consult:aa", "started:bb"]);
});

test("a start inside the budget reads as running, past it as lost", () => {
  const at = "2026-08-31T08:00:00.000Z";
  const base = Date.parse(at);
  assert.match(startedState({ at }, base + 30_000), /running for 30s/);
  assert.match(startedState({ at }, base + 1_000_000), /never reported back/);
});

test("nothing consulted yet reads as an empty log, never a throw", () => {
  assert.deepEqual(logEntries(), []);
});

/* The gate is what lets one call be streamed live and the next be suppressed: an answer flows from
   the first characters, a request never appears at all. */
test("an answer streams from its first characters and a request never shows", () => {
  const shown = [];
  const answer = gated((text) => shown.push(text));
  for (const piece of ["## ", "Tech", " Lead\n", "- blocker"]) answer(piece);
  assert.equal(shown.join(""), "## Tech Lead\n- blocker");

  const request = [];
  const asking = gated((text) => request.push(text));
  for (const piece of ["NEE", "D: docs/A.md\n", "NEED: docs/B.md"]) asking(piece);
  assert.deepEqual(request, []);
});

test("a leading newline does not fool the gate", () => {
  const shown = [];
  const asking = gated((text) => shown.push(text));
  asking("\nNEED: docs/A.md\n");
  assert.deepEqual(shown, []);
});

/* The precision mechanism: a finding about code this turn did not touch is the class of noise that
   crowds out the real ones, so an unchanged file is labelled context and not subject. */
test("a diff is attached per file, and an unchanged one says so", () => {
  const parts = withDiffs(REPO, bundle(REPO, ["docs/PLAN.md"]), "HEAD");
  /* The sandbox has a `.git` file rather than a repository, so git refuses and that is reported
     rather than passed off as "nothing changed". */
  assert.ok(parts[0].diff.error || parts[0].diff.untracked || parts[0].diff.unchanged);
});

test("anchoring, named risks and a severity floor each reach the prompt", () => {
  const parts = [{ rel: "a.mjs", text: "code", diff: { text: "@@ -1 +1 @@", clipped: false } }];
  /* Anchoring is derived: parts without a diff cannot be anchored to anything. */
  const noDiff = promptFor("intent", [{ rel: "a.mjs", text: "code" }]);
  assert.equal(/ANCHOR EVERY FINDING/.test(noDiff), false);
  assert.equal(/VERIFY THESE/.test(noDiff), false);

  const shaped = promptFor("intent", parts, [], {
    risks: ["the lock is missing", "the read races"],
    only: ["blocker", "major"],
  });
  assert.match(shaped, /ANCHOR EVERY FINDING/);
  assert.match(shaped, /PRE-EXISTING/);
  assert.match(shaped, /1\. the lock is missing/);
  assert.match(shaped, /2\. the read races/);
  assert.match(shaped, /ONLY BLOCKER and MAJOR/);
  assert.match(shaped, /CHANGED THIS TURN/);
  /* The verification list changes the closing instruction, or it would be answered last. */
  assert.match(shaped, /Answer the verification list first/);
});

test("an unchanged file is offered as context and excluded from review", () => {
  const parts = [
    { rel: "a.mjs", text: "code", diff: { unchanged: true } },
    { rel: "b.mjs", text: "code", diff: { untracked: true } },
  ];
  const held = promptFor("intent", parts, []);
  assert.match(held, /UNCHANGED this turn — context only\. Do not review it\./);
  assert.match(held, /NEW FILE/);
});

/* Found by running it: splitting on "starts with --" read a flag's value as a file path and hid it
   from the parser, so `--diff --only major` reported that --diff had no value. */
test("a flag's value is never mistaken for a file", () => {
  const held = partition(["a.mjs", "--diff", "--only", "blocker,major", "b.mjs", "--bg"], BOOLEANS);
  assert.deepEqual(held.positionals, ["a.mjs", "b.mjs"]);
  assert.deepEqual(held.flagArgv, ["--diff", "--only", "blocker,major", "--bg"]);
  const bare = partition(["--bg", "x.mjs"], BOOLEANS);
  assert.deepEqual(bare.positionals, ["x.mjs"]);
  assert.deepEqual(bare.flagArgv, ["--bg"]);
});

test("a command line becomes a request in one place", () => {
  const plain = consultArgs(["a.mjs", "b.mjs"]);
  assert.deepEqual(plain.named, ["a.mjs", "b.mjs"]);
  assert.equal(plain.base, null);
  assert.deepEqual(plain.risks, []);

  const shaped = consultArgs([
    "a.mjs", "--diff", "--verify", "it races", "--only", "blocker,major", "--verify", "it leaks", "--bg",
  ]);
  assert.deepEqual(shaped.named, ["a.mjs"]);
  assert.deepEqual(shaped.risks, ["it races", "it leaks"]);
  assert.deepEqual(shaped.only, ["blocker", "major"]);
  assert.equal(shaped.base, "HEAD");
  assert.equal(shaped.bg, true);
  assert.equal(shaped.allowEcho, false);

  /* Asking what to diff against is asking for the diff, so --base implies it rather than being
     silently dropped. */
  assert.equal(consultArgs(["--diff", "--base", "main"]).base, "main");
  assert.equal(consultArgs(["--base", "main"]).base, "main");
  assert.equal(consultArgs(["a.mjs"]).base, null);
});

/* A verdict typed by hand against a review nobody counted is accounting by vibes. */
test("a review counts itself, and a malformed header counts as nothing", () => {
  const held = countedIn("CODEX: 5 findings (1 blocker, 3 major, 1 minor)\n\n## Tech Lead");
  assert.deepEqual(held, { total: 5, blocker: 1, major: 3, minor: 1 });
  assert.deepEqual(countedIn("CODEX: 0 findings"), { total: 0 });
  assert.deepEqual(countedIn("CODEX: 2 findings (2 major)"), { total: 2, major: 2 });
  assert.equal(countedIn("## Tech Lead\n- blocker: something"), null);
  assert.equal(countedIn(undefined), null);
});

test.after(() => rmSync(sandbox, { recursive: true, force: true }));
