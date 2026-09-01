import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* Imported after XDG_CONFIG_HOME moves, so nothing here can touch the caller's own state file. */
const sandbox = mkdtempSync(join(tmpdir(), "forge-codex-"));
process.env.XDG_CONFIG_HOME = sandbox;
delete process.env.FORGE_CODEX_DISABLE;

const {
  STATE_PATH,
  afterTouch,
  ageOf,
  consultArgs,
  hookRecord,
  pendingIn,
  rounds,
} = await import("../src/codex.mjs");
const {
  bundle,
  consume,
  digest,
  inside,
  locate,
  modelBehind,
  profileFrom,
  promptFor,
  withDiffs,
  sameFamily,
} = await import("../src/codex-api.mjs");
const { runTool, scopeFor } = await import("../src/codex-tools.mjs");
const { partition } = await import("../src/resolve/flags.mjs");
const BOOLEANS = ["--allow-echo"];
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

/* Three sources for one pattern, and which answered is printed rather than inferred: the checkout's,
   the account's, then the default. It cannot be asked in process — this checkout is a repository that
   overrides it, which is the whole point of the layer. */
test("the pattern comes from the checkout, else the account, else the default", () => {
  const forge = new URL("../bin/forge", import.meta.url).pathname;
  const shown = ({ repo, user }) => {
    const room = mkdtempSync(join(tmpdir(), "codex-pattern-"));
    const home = mkdtempSync(join(tmpdir(), "codex-pattern-home-"));
    if (repo) writeFileSync(join(room, ".forge.json"), JSON.stringify(repo));
    if (user) {
      mkdirSync(join(home, "forge"), { recursive: true });
      writeFileSync(join(home, "forge", "config.json"), JSON.stringify(user));
    }
    const run = spawnSync(forge, ["codex", "show"], {
      cwd: room,
      encoding: "utf8",
      env: { ...process.env, XDG_CONFIG_HOME: home },
    });
    return (run.stdout.split("\n").find((one) => one.startsWith("records")) ?? "").replace(/\s+/gu, " ");
  };
  const account = { codex: { pathRe: "\\.md$" } };
  assert.equal(shown({}), "records : ^docs/.*\\.md$ \u2190 the built-in default");
  assert.match(shown({ user: account }), /^records : \\\.md\$ \u2190 .*config\.json$/u);
  assert.match(shown({ repo: { codex: { pathRe: "^src/" } }, user: account }), /^records : \^src\/ \u2190 \.forge\.json$/u);
  /* A pattern that does not compile would throw on every write of whatever repository carries it. */
  assert.match(shown({ repo: { codex: { pathRe: "^(" } }, user: account }), /^records : \\\.md\$ \u2190 .*config\.json$/u);
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
  const withIntent = promptFor("renaming the verb", parts, [], { bodies: true });
  assert.match(withIntent, /renaming the verb/);
  assert.match(withIntent, /docs\/A\.md/);
  assert.match(withIntent, /the body/);
  assert.match(promptFor("", parts), /have not described my intent/);
});

/* A file cut short must say so, or the reviewer reasons about an ending that was never sent. */
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

/* A model-initiated read is the one that must not be able to name its way out: the machine holds
   `~/.config/forge/config.json` and a gateway token beside it. A refusal comes back as words,
   because a reviewer that cannot tell "outside" from "you forgot" asks again. */
test("the reviewer reads inside the checkouts under review, and nowhere else", () => {
  const scope = scopeFor(REPO);
  assert.equal(runTool(scope, "read_file", { path: "docs/PLAN.md" }).text.trim(), "x");
  const out = runTool(scope, "read_file", { path: "../outside.md" });
  assert.equal(out.error, true);
  assert.match(out.text, /outside the checkouts under review|not a readable path/u);
  const absolute = runTool(scope, "read_file", { path: join(sandbox, "outside.md") });
  assert.equal(absolute.error, true);
  assert.equal(runTool(scope, "read_file", {}).error, true, "a call with no path is answered, not thrown");
  assert.equal(runTool(scope, "no_such_tool", { path: "docs/PLAN.md" }).error, true);
});

/* One account configures one reviewer, so a file named in another checkout is reviewable — and
   naming it widens what the model may read to that checkout, not to the machine. */
test("a file named in another checkout is located, and widens the scope to it", () => {
  const other = join(sandbox, "other");
  mkdirSync(join(other, "src"), { recursive: true });
  writeFileSync(join(other, ".git"), "gitdir: elsewhere\n");
  const file = join(other, "src", "far.mjs");
  writeFileSync(file, "export const far = 1;\n");
  assert.equal(locate(REPO, file).rel, file, "absolute, because it is not this repository's");
  assert.equal(locate(REPO, "docs/PLAN.md").rel, "docs/PLAN.md");
  assert.equal(locate(REPO, join(sandbox, "nothing-here.md")), null);
  const sent = bundle(REPO, [file]);
  assert.match(sent[0].text, /export const far/u);
  const scope = scopeFor(REPO, [file]);
  assert.match(runTool(scope, "read_file", { path: file }).text, /export const far/u);
  assert.equal(runTool(scopeFor(REPO), "read_file", { path: file }).error, true, "unnamed, unreadable");
});

/* The tool call arrives as a start frame and its arguments as partial JSON, so the loop has to
   assemble them: a call whose input never parsed would otherwise reach the executor as a string. */
/* `"input": null` parses to null, and a default only covers undefined — so this threw out of the
   loop and failed the whole consult, where the reviewer could have answered a refusal instead. */
test("a tool call whose arguments are not an object is refused, not thrown", async () => {
  const scope = scopeFor(REPO);
  for (const given of [null, "nope", 7, ["docs/PLAN.md"]]) {
    const held = runTool(scope, "read_file", given);
    assert.equal(held.error, true, `${JSON.stringify(given)} threw or was accepted`);
    assert.match(held.text, /needs a `path`/u);
  }
  const frames = [
    'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"c1","name":"read_file","input":{}}}',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"null"}}',
    'data: {"type":"content_block_stop","index":0}',
  ];
  async function* streamed() {
    yield Buffer.from(`${frames.join("\n\n")}\n\n`, "utf8");
  }
  const held = await consume(streamed(), () => {});
  assert.deepEqual(held.calls[0].input, {}, "and it never reaches the executor as null either");
});

test("a streamed tool call is assembled from its frames", async () => {
  const frames = [
    'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"call_1","name":"read_file","input":{}}}',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"path\\":"}}',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"\\"docs/PLAN.md\\"}"}}',
    'data: {"type":"content_block_stop","index":0}',
    'data: {"type":"content_block_delta","index":1,"delta":{"type":"thinking_delta","thinking":"weighing"}}',
    'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}',
  ];
  async function* streamed() {
    yield Buffer.from(`${frames.join("\n\n")}\n\n`, "utf8");
  }
  const held = await consume(streamed(), () => {});
  assert.deepEqual(held.calls, [{ id: "call_1", name: "read_file", input: { path: "docs/PLAN.md" } }]);
  assert.equal(held.stop, "tool_use");
  assert.equal(held.thought, "weighing".length, "thinking is counted, not printed");
});

/* A read-only tool that spawns git puts a model-chosen string next to git's own options, and
   `--output=` there writes a file. The refusal is what proves it never reaches git at all. */
test("a base that is an option is refused rather than handed to git", () => {
  const written = join(sandbox, "written-by-git-diff");
  const out = runTool(scopeFor(REPO), "git_diff", { path: "docs/PLAN.md", base: `--output=${written}` });
  assert.equal(out.error, true);
  assert.match(out.text, /is not a ref/u);
  assert.equal(existsSync(written), false, "git ran with a model-chosen option");
});

/* `codex.rounds` is what the account is billed, so the loop cannot leave the cap to the gateway:
   the last call is served no tools, and tool calls in its answer are reported, not run. */
test("the call cap is the loop's, and a tool call past it is refused not served", async () => {
  const asked = [];
  const stub = async (values, model, messages, held) => {
    asked.push((held.tools ?? []).length);
    return {
      text: "answered",
      calls: [{ id: `call_${asked.length}`, name: "read_file", input: { path: "docs/PLAN.md" } }],
      usage: {},
      stop: "tool_use",
      thought: 0,
    };
  };
  /* The cap is named here rather than taken from the config: this is about the loop keeping it. */
  const held = await rounds({}, "m", "go", scopeFor(REPO), () => {}, stub, { cap: 4 });
  assert.equal(held.calls, 4, "the cap it was given, and not one more");
  assert.equal(asked.length, 4);
  assert.equal(asked.at(-1), 0, "the last call is served no tools");
  assert.equal(held.tools.length, 3, "the tool call answering the capped request is not run");
  assert.match(held.refused.at(-1), /past the call cap/u);
});

/* Reading for ten calls and never answering is a failed consult, not a short one: returned, it
   would be logged as a review, spend the advice and clear the files it never reviewed. */
test("a capped reply that is only tool calls is a failure, not an answer", async () => {
  const stub = async () => ({
    text: "",
    calls: [{ id: "call_x", name: "grep", input: { pattern: "x" } }],
    usage: {},
    stop: "tool_use",
    thought: 0,
  });
  await assert.rejects(
    () => rounds({}, "m", "go", scopeFor(REPO), () => {}, stub, { cap: 2 }),
    /never answered/u,
  );
});

/* The caller decides what a turn is, because only the hook can see one. Told once, a repository is
   not told again until the next turn — and an unanswered list no longer answers for the silence. */
const teller = () => {
  const said = new Set();
  return (turn) => (root) => {
    const key = `${root}\0${turn}`;
    if (said.has(key)) return true;
    said.add(key);
    return false;
  };
};

test("the hook records a document once, and tells a repository once per turn", () => {
  clearState();
  const told = teller();
  const first = hookRecord({}, [join(REPO, "docs", "PLAN.md")], told("t1"));
  assert.match(first, /forge codex consult/);
  assert.match(first, /docs\/PLAN\.md/);
  assert.deepEqual(pendingIn(state(), REPO), ["docs/PLAN.md"]);

  assert.equal(hookRecord({}, [join(REPO, "docs", "PLAN.md")], told("t1")), null, "recorded already");
  assert.equal(hookRecord({}, [join(REPO, "docs", "TWO.md")], told("t1")), null, "told already");
  assert.deepEqual(pendingIn(state(), REPO), ["docs/PLAN.md", "docs/TWO.md"]);

  writeFileSync(join(REPO, "docs", "THREE.md"), "x");
  const later = hookRecord({}, [join(REPO, "docs", "THREE.md")], told("t2"));
  assert.match(later, /docs\/THREE\.md/, "a new turn is told, with two files still pending");
  clearState();
});

/* Two checkouts, one state file: a hook firing in each at the same moment must not write what it
   read, and each is told for itself. */
test("a second repository is told for itself, and neither loses the other's list", () => {
  clearState();
  const other = join(sandbox, "repo-two");
  mkdirSync(join(other, "docs"), { recursive: true });
  writeFileSync(join(other, ".git"), "gitdir: elsewhere\n");
  writeFileSync(join(other, "docs", "PLAN.md"), "x");
  const told = teller();
  assert.match(hookRecord({}, [join(REPO, "docs", "PLAN.md")], told("t1")), /docs\/PLAN\.md/);
  assert.match(hookRecord({}, [join(other, "docs", "PLAN.md")], told("t1")), /docs\/PLAN\.md/);
  assert.deepEqual(pendingIn(state(), REPO), ["docs/PLAN.md"]);
  assert.deepEqual(pendingIn(state(), other), ["docs/PLAN.md"]);
  clearState();
});

test("a path the filter does not cover, or no repository at all, is not recorded", () => {
  clearState();
  assert.equal(hookRecord({}, [join(REPO, "src", "codex.mjs")]), null);
  assert.equal(hookRecord({}, [join(sandbox, "outside.md")]), null);
  assert.equal(existsSync(STATE_PATH), false);
});

test("the disable switch silences the record", (t) => {
  clearState();
  process.env.FORGE_CODEX_DISABLE = "1";
  t.after(() => {
    delete process.env.FORGE_CODEX_DISABLE;
    clearState();
  });
  assert.equal(hookRecord({}, [join(REPO, "docs", "PLAN.md")]), null);
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

/* Measured over a fixture with two planted defects: sending the diff alone found both in one call,
   where sending every body cost four calls and eleven re-reads for the same answer. */
test("the payload sends the diff and not the body, unless asked", () => {
  const parts = [{ rel: "a.mjs", text: "the whole body", chars: 14, diff: { text: "@@ -1 +1 @@", clipped: false } }];
  const lean = promptFor("intent", parts);
  assert.equal(lean.includes("the whole body"), false, "the body is a read_file away");
  assert.match(lean, /@@ -1 \+1 @@/, "the change still travels");
  assert.match(lean, /14 chars/, "the size, so it can judge whether to read");
  assert.match(lean, /Read it with read_file/);
  assert.match(promptFor("intent", parts, [], { bodies: true }), /the whole body/);
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
  const held = partition(["a.mjs", "--diff", "--only", "blocker,major", "b.mjs", "--allow-echo"], BOOLEANS);
  assert.deepEqual(held.positionals, ["a.mjs", "b.mjs"]);
  assert.deepEqual(held.flagArgv, ["--diff", "--only", "blocker,major", "--allow-echo"]);
  const bare = partition(["--allow-echo", "x.mjs"], BOOLEANS);
  assert.deepEqual(bare.positionals, ["x.mjs"]);
  assert.deepEqual(bare.flagArgv, ["--allow-echo"]);
});

/* Removed rather than ignored: the flag was documented, and a habit outlives the code. `fail` exits
   rather than throwing, so the exit is what gets caught and the message is read off console.error. */
test("--bg is refused by name", () => {
  const stopped = mock.method(process, "exit", () => {
    throw new Error("exited");
  });
  const said = mock.method(console, "error", () => {});
  try {
    assert.throws(() => consultArgs(["a.mjs", "--bg"]), /exited/);
    assert.match(String(said.mock.calls[0].arguments[0]), /--bg is gone/);
  } finally {
    stopped.mock.restore();
    said.mock.restore();
  }
});

/* Both are per-consult: the cap because a review's worth of rounds is not a property of the
   repository, and the payload because a consult on a file outside any checkout has nothing to read
   with. An unknown value is refused rather than sent on. */
test("the cap and the payload mode are the consult's own", () => {
  assert.equal(consultArgs([]).cap, undefined, "unset means the config, then the default");
  assert.equal(consultArgs(["--rounds", "3"]).cap, 3);
  assert.equal(consultArgs([]).bodies, false, "diffs by default, because it can read");
  assert.equal(consultArgs(["--send", "bodies"]).bodies, true);
});

test("a command line becomes a request in one place", () => {
  const plain = consultArgs(["a.mjs", "b.mjs"]);
  assert.deepEqual(plain.named, ["a.mjs", "b.mjs"]);
  assert.equal(plain.base, null);
  assert.deepEqual(plain.risks, []);

  const shaped = consultArgs([
    "a.mjs", "--diff", "--verify", "it races", "--only", "blocker,major", "--verify", "it leaks", "--allow-echo",
  ]);
  assert.deepEqual(shaped.named, ["a.mjs"]);
  assert.deepEqual(shaped.risks, ["it races", "it leaks"]);
  assert.deepEqual(shaped.only, ["blocker", "major"]);
  assert.equal(shaped.base, "HEAD");
  assert.equal(shaped.allowEcho, true);

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

/* Refused in sid-erp twice over: the CLI read `-h` as a filename, and the order gate refused the line
   as a consult — so the one command that says what to type was the one that could not be run. */
test("asking an action what to type prints the usage", () => {
  const forge = new URL("../bin/forge", import.meta.url).pathname;
  for (const argv of [["codex", "consult", "-h"], ["codex", "verdict", "--help"], ["codex", "-h"]]) {
    const run = spawnSync(forge, argv, { encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), "codex-help-")) } });
    assert.equal(run.status, 0, `${argv.join(" ")}: ${run.stderr}`);
    assert.match(`${run.stdout}${run.stderr}`, /Usage: forge codex <consult\|verdict\|pending\|show\|log>/u);
  }
});
