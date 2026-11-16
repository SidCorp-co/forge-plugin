/* The gate is a decision, so it is exercised the way Claude Code calls it: the event on stdin and
   the permission decision on stdout. The set it reads is `FROZEN`, so the cases are driven off
   `FROZEN` too — a list typed here again would keep passing after the set narrowed under it. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { FROZEN } from "../../src/tools/plugin-copy.mjs";
import { appendedLine } from "../../src/refusal.mjs";
import { assertRouteFirst } from "../fixtures/route-first.mjs";
import { callHook, escaped, neutralRoom, pathed, tempRoom } from "../fixtures.mjs";

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const HOOK = join(PLUGIN, "hooks", "entries", "restart-owed.mjs");
const CLI = join(PLUGIN, "src", "cli.mjs");
const NAME = JSON.parse(readFileSync(join(PLUGIN, ".claude-plugin", "plugin.json"), "utf8")).name;

/* A checkout of this plugin, since that is what makes a path repository-relative at all: the gate
   reads the root back off the marketplace entry the copy chooser answers with. */
const checkout = (() => {
  const room = tempRoom("restart-owed-");
  mkdirSync(join(room, ".claude-plugin"), { recursive: true });
  writeFileSync(join(room, ".claude-plugin", "marketplace.json"),
    JSON.stringify({ plugins: [{ name: NAME, source: "./plugin" }] }));
  return room;
})();

/* Both a fresh config directory and a fresh temp root: the log is written to the first and the
   once-per-file stamp to the second, and a suite that skips either runs on the developer's own. */
const room = tempRoom("restart-owed-state-");
const ENV = { ...process.env, XDG_CONFIG_HOME: join(room, "config"), TMPDIR: join(room, "tmp") };
mkdirSync(ENV.TMPDIR, { recursive: true });

/* `taught` is the teaching the write went ahead with; nothing this gate says denies a write. */
const answered = (run) => {
  assert.equal(run.status, 0, run.stderr);
  if (!run.stdout.trim()) return { allowed: true, taught: false };
  const answer = JSON.parse(run.stdout).hookSpecificOutput;
  return { allowed: answer.permissionDecision !== "deny", taught: Boolean(answer.additionalContext), reason: answer.additionalContext ?? answer.permissionDecisionReason };
};

/* Each call its own session unless one is named: the gate teaches once per file per session, so a
   fixture sharing an id stays silent on the second case for the first case's reason. */
const ask = (event, session = randomUUID()) => answered(callHook(HOOK, { session_id: session, ...event }, ENV));

const writes = (path, event = {}) =>
  ask({ tool_name: "Write", tool_input: { file_path: join(checkout, path) }, cwd: checkout, ...event });

const runs = (command) => ask({ tool_name: "Bash", tool_input: { command }, cwd: checkout });

const logged = () => {
  try {
    return readFileSync(join(ENV.XDG_CONFIG_HOME, "forge", "hook-log.jsonl"), "utf8")
      .split("\n").filter(Boolean).map((one) => JSON.parse(one));
  } catch {
    return [];
  }
};

/* One file per entry of the set, the directories given one below them: a set that narrows takes
   its case with it, and a set that grows arrives here without one. */
const anExample = (one) => (one.endsWith("/") ? `${one}example/a.md` : one);

test("every file the restart set names is taught and let through, whichever entry named it", () => {
  assert.ok(FROZEN.length >= 4, `the set names ${FROZEN.length} thing(s)`);
  for (const one of FROZEN) {
    const held = writes(anExample(one));
    assert.equal(held.allowed, true, `${anExample(one)} was refused, and a restart-set write is taught`);
    assert.equal(held.taught, true, `${anExample(one)} is in the restart set and was not taught`);
    assert.match(held.reason, new RegExp(`\`${escaped(anExample(one))}\``, "u"),
      `the teaching does not name the file:\n${held.reason}`);
  }
  /* The path a reader would try under the `plugin/skills/` entry, spelled out and through Edit: the
     sweep above proves the entry, this proves the route and the file somebody actually writes. */
  assert.equal(writes(join("plugin", "skills", "forge", "SKILL.md"), { tool_name: "Edit" }).taught, true);
});

/* The case ISS-320 made true and this gate has to keep true: a gate reaches an open session already,
   so holding a write to one is a round spent on nothing. It fails against any gate reading the
   hooks tree whole, which is what the reading this replaces did. */
test("a gate file passes silently, though it sits under plugin/hooks", () => {
  const path = join("plugin", "hooks", "gates", "bash-guard.mjs");
  assert.ok(path.startsWith(join("plugin", "hooks")), "the case is only worth anything under that tree");
  assert.equal(writes(path).taught, false, "a gate is chosen per call and owes no restart");
  assert.equal(writes(join("plugin", "hooks", "how", "bash-guard.md")).taught, false);
  assert.equal(writes(join("plugin", "hooks", "_hook.mjs")).taught, false);
  assert.equal(writes(join("plugin", "hooks", "entries", "bash-guard.mjs")).taught, false);
  assert.equal(writes(join("plugin", "src", "checks", "learning.mjs")).taught, false);
});

test("the gate declares no set of its own, so a narrowed set narrows it", () => {
  const text = readFileSync(join(PLUGIN, "hooks", "gates", "restart-owed.mjs"), "utf8");
  assert.match(text, /freezesSession/u, "the gate does not spend the shared reading");
  assert.doesNotMatch(text.replace(/^\s*[/*].*$/gmu, ""), /"plugin\/(?:hooks|skills|agents)/u,
    "the gate names a guarded path itself, and a set narrowed elsewhere would leave it behind");
});

test("through the shell a write shape beside the name is taught, and a read of it is not", () => {
  assert.equal(runs("sed -i s/a/b/ plugin/hooks/gate.mjs").taught, true);
  assert.equal(runs("cp new.json plugin/hooks/hooks.json").taught, true);
  assert.equal(runs("printf x > plugin/hooks/gate.mjs").taught, true);
  assert.equal(runs("cat plugin/hooks/gate.mjs").taught, false, "reading one is not writing it");
  assert.equal(runs("grep -n dispatch plugin/hooks/gate.mjs | head -3").taught, false);
  assert.equal(runs("echo 'do not touch plugin/hooks/gate.mjs today'").taught, false,
    "a path inside a sentence is prose");
});

/* The bare token a command spells is not where the write lands: read as one, a command that walks
   out of the checkout first refuses the file it left behind, which is not the file it writes. */
test("a command that leaves the checkout writes elsewhere, whatever the path is spelled", () => {
  const elsewhere = tempRoom("left-the-checkout-");
  assert.equal(runs(`cd ${pathed(elsewhere)} && printf x > plugin/hooks/hooks.json`).taught, false,
    "the write lands outside any checkout of this plugin, so there is nothing to teach");
  assert.equal(runs("cd plugin && printf x > hooks/hooks.json").taught, true,
    "and a move inside the checkout still lands on the frozen file");
});

test("a write outside a checkout of this plugin is nothing to teach", () => {
  const elsewhere = tempRoom("not-a-checkout-");
  assert.equal(
    ask({ tool_name: "Write", tool_input: { file_path: join(elsewhere, "plugin", "hooks", "hooks.json") }, cwd: elsewhere }).taught,
    false,
  );
});

test("the teaching states the rule, gives one action and the recorded reason, and the page it names answers", () => {
  const held = writes(join("plugin", "hooks", "hooks.json"));
  assert.match(held.reason, /reaches a session only at its next start/u, held.reason);
  assert.match(held.reason, /every open session runs the old copy until then/u, held.reason);
  assert.match(held.reason, /^Say in one line why no live home fits/u, held.reason);
  assert.match(held.reason, /Recorded as the reason, which the release prints beside the file: no line given/u, held.reason);
  const last = held.reason.trim().split("\n").findLast((line) => line.trim() && !appendedLine(line));
  assert.equal(last, "How: `forge hooks --how restart-owed`", held.reason);

  const page = spawnSync(process.execPath, [CLI, "hooks", "--how", "restart-owed"], { cwd: neutralRoom(), encoding: "utf8", env: ENV });
  assert.equal(page.status, 0, page.stderr);
  assert.equal(page.stdout.trimEnd(),
    readFileSync(join(PLUGIN, "hooks", "how", "restart-owed.md"), "utf8").trimEnd(),
    "a gate that only teaches prints its page alone");
});

test("the switch reaches this gate by name, and says which event it is registered on", () => {
  const off = spawnSync(process.execPath, [CLI, "hooks", "--off", "restart-owed"], { cwd: neutralRoom(), encoding: "utf8", env: ENV });
  assert.equal(off.status, 0, off.stderr);
  assert.match(off.stdout, /restart-owed \(PreToolUse\) is now off/u, off.stdout);
  const on = spawnSync(process.execPath, [CLI, "hooks", "--on", "restart-owed"], { cwd: neutralRoom(), encoding: "utf8", env: ENV });
  assert.match(on.stdout, /restart-owed \(PreToolUse\) is now on/u, on.stdout);
});

test("taught once per file per session, and a write with no line is logged once", () => {
  const session = `once-${Date.now()}`;
  const path = join("plugin", "hooks", "link-cli.mjs");
  const event = { tool_name: "Write", tool_input: { file_path: join(checkout, path) }, cwd: checkout, transcript_path: "" };
  const first = ask(event, session);
  assert.deepEqual([first.allowed, first.taught], [true, true], "the first write goes ahead, taught");
  assert.equal(ask(event, session).taught, false, "the next write passes without a second teaching");
  assert.equal(ask(event, session).taught, false, "and so does every write after it");

  const notes = logged().filter((one) => one.decision === "note" && one.target === path && one.session === session);
  assert.equal(notes.length, 1, `${notes.length} note(s) for one answer: ${JSON.stringify(notes)}`);
  assert.equal(notes[0].hook, "restart-owed");
  assert.equal(notes[0].reason, "no line given", "a transcript that carries no line says so rather than nothing");
});

test("the note carries the line said before the write, under the name the release step reads, and the teaching prints it", () => {
  const session = `line-${Date.now()}`;
  const path = join("plugin", "agents", "runner.md");
  const said = "a role is dispatched from the registration a session read at start.";
  const transcript = join(room, `${session}.jsonl`);
  const now = new Date().toISOString();
  writeFileSync(transcript, `${[
    JSON.stringify({ type: "user", promptSource: "typed", timestamp: now }),
    JSON.stringify({ type: "assistant", timestamp: now, message: { content: [{ type: "text", text: said }, { type: "tool_use", name: "Write" }] } }),
  ].join("\n")}\n`);
  const event = { tool_name: "Write", tool_input: { file_path: join(checkout, path) }, cwd: checkout, transcript_path: transcript };

  const taught = ask(event, session);
  assert.equal(taught.taught, true);
  assert.match(taught.reason, new RegExp(escaped(`"${said}"`), "u"), taught.reason);
  assert.equal(ask(event, session).taught, false);
  const note = logged().filter((one) => one.decision === "note" && one.target === path).at(-1);
  assert.ok(note, `no note against ${path}: ${JSON.stringify(logged())}`);
  assert.equal(note.reason, said);
});

/* A transcript as the host writes one: one content block per record, so the call the gate is judging
   is its own record and carries no text at all. A record built with both in it would pass the reading
   this replaces. */
const AT = new Date().toISOString();
const spoke = (text) => ({ type: "assistant", timestamp: AT, message: { content: [{ type: "text", text }] } });
const resent = () => ({ type: "assistant", timestamp: AT, message: { content: [{ type: "tool_use", name: "Write", input: {} }] } });
const heldIt = () => ({ type: "user", timestamp: AT, message: { content: [{ type: "tool_result" }] } });

const wrote = (path, records) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${records.map((one) => JSON.stringify(one)).join("\n")}\n`);
  return path;
};

const noteOn = (path) => logged().filter((one) => one.decision === "note" && one.target === path).at(-1);

/* The whole of this issue: the event a delegated run's write arrives on names the session that
   dispatched it, in both `session_id` and `transcript_path`, and names the run only in `agent_id`.
   Without the resolver this reads the dispatcher's sentence, which is about another issue. */
test("a delegated run's note carries that run's own line, not the dispatching session's", () => {
  const session = `delegated-${Date.now()}`;
  const agent = "a1b2c3d4e5f6a7b8c";
  const path = join("plugin", "skills", "delegated", "SKILL.md");
  const elsewhere = "ISS-333 is shipping through its own changed script, and the lock is live.";
  const line = "a role is dispatched from the registration a session read at start.";
  const parent = wrote(join(room, `${session}.jsonl`), [{ type: "user", promptSource: "typed", timestamp: AT }, spoke(elsewhere)]);
  wrote(join(room, session, "subagents", `agent-${agent}.jsonl`), [heldIt(), spoke(line), resent()]);

  const event = { tool_name: "Write", tool_input: { file_path: join(checkout, path) }, cwd: checkout, transcript_path: parent, agent_id: agent };
  assert.equal(ask(event, session).taught, true, "the first write is taught");
  assert.equal(noteOn(path)?.reason, line, `the note does not carry the run's own line: ${JSON.stringify(noteOn(path))}`);
});

test("a delegated run whose own transcript is not there says so rather than borrowing one", () => {
  const session = `no-transcript-${Date.now()}`;
  const path = join("plugin", "skills", "unreadable", "SKILL.md");
  const elsewhere = "**ISS-1429 closed — forge 3.36.82.** `forge claim --judged` now accepts an issue.";
  const parent = wrote(join(room, `${session}.jsonl`), [{ type: "user", promptSource: "typed", timestamp: AT }, spoke(elsewhere)]);

  const event = { tool_name: "Write", tool_input: { file_path: join(checkout, path) }, cwd: checkout, transcript_path: parent, agent_id: "anothertranscript" };
  assert.equal(ask(event, session).taught, true);
  assert.equal(noteOn(path)?.reason, "no line given", "an empty reason is visibly empty; a borrowed one reads as a stated one");
});

test("the line the teaching asked for, said before the next write, replaces the one recorded", () => {
  const session = `re-sent-${Date.now()}`;
  const path = join("plugin", "skills", "own-session", "SKILL.md");
  const line = "no live home fits: the registration is what a session reads at start.";
  const transcript = join(room, `${session}.jsonl`);
  const event = { tool_name: "Write", tool_input: { file_path: join(checkout, path) }, cwd: checkout, transcript_path: transcript };
  wrote(transcript, [heldIt(), resent()]);
  assert.equal(ask(event, session).taught, true);
  assert.equal(noteOn(path)?.reason, "no line given");
  wrote(transcript, [heldIt(), resent(), heldIt(), spoke(line), resent()]);
  assert.equal(ask(event, session).taught, false);
  assert.equal(noteOn(path)?.reason, line);
});

test("the walk stops at a tool's answer, so what the run said before it is not the reason", () => {
  const session = `before-the-hold-${Date.now()}`;
  const path = join("plugin", "skills", "before-the-hold", "SKILL.md");
  const before = "Now the stub, which must carry the could-not-load announcement itself.";
  const transcript = wrote(join(room, `${session}.jsonl`), [spoke(before), heldIt(), resent()]);

  const event = { tool_name: "Write", tool_input: { file_path: join(checkout, path) }, cwd: checkout, transcript_path: transcript };
  assert.equal(ask(event, session).taught, true);
  assert.equal(noteOn(path)?.reason, "no line given", "a tool's answer sits between the write and anything said before it");
});

test("doctor names the restart set, read from the one place the release step reads it", () => {
  const run = spawnSync(process.execPath, [CLI, "doctor"], { encoding: "utf8", env: ENV, cwd: checkout });
  const said = new RegExp(`restart set\\s+${escaped(FROZEN.join(", "))}`, "u");
  assert.match(run.stdout, said, `doctor does not print the set:\n${run.stdout}`);
  assert.match(run.stdout, /a session keeps these as of its start/u, run.stdout);
});

/* AC-07-3-4. One teaching, reached by the tool route and by the shell's. */
test("every teaching this gate writes leads with its route", () => {
  assertRouteFirst(writes(join("plugin", "hooks", "hooks.json")).reason, "a tool write");
  assertRouteFirst(runs("echo x > plugin/hooks/hooks.json").reason, "a shell write");
});
