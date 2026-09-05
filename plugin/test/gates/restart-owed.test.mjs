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
import { callHook, tempRoom } from "../fixtures.mjs";

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

const answered = (run) => {
  assert.equal(run.status, 0, run.stderr);
  if (!run.stdout.trim()) return { allowed: true };
  const answer = JSON.parse(run.stdout).hookSpecificOutput;
  return { allowed: answer.permissionDecision !== "deny", reason: answer.permissionDecisionReason };
};

/* Each call its own session unless one is named: the gate holds once per file per session, so a
   fixture sharing an id passes the second case for the first case's reason. */
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

test("every file the restart set names is held, whichever entry named it", () => {
  assert.ok(FROZEN.length >= 4, `the set names ${FROZEN.length} thing(s)`);
  for (const one of FROZEN) {
    const held = writes(anExample(one));
    assert.equal(held.allowed, false, `${anExample(one)} is in the restart set and was not held`);
    assert.match(held.reason, new RegExp(`\`${anExample(one).replace(/[.]/gu, "\\.")}\``, "u"),
      `the refusal does not name the file:\n${held.reason}`);
  }
  /* The path a reader would try under the `plugin/skills/` entry, spelled out and through Edit: the
     sweep above proves the entry, this proves the route and the file somebody actually writes. */
  assert.equal(writes(join("plugin", "skills", "forge", "SKILL.md"), { tool_name: "Edit" }).allowed, false);
});

/* The case ISS-320 made true and this gate has to keep true: a gate reaches an open session already,
   so holding a write to one is a round spent on nothing. It fails against any gate reading the
   hooks tree whole, which is what the reading this replaces did. */
test("a gate file passes silently, though it sits under plugin/hooks", () => {
  const path = join("plugin", "hooks", "gates", "bash-guard.mjs");
  assert.ok(path.startsWith(join("plugin", "hooks")), "the case is only worth anything under that tree");
  assert.equal(writes(path).allowed, true, "a gate is chosen per call and owes no restart");
  assert.equal(writes(join("plugin", "hooks", "how", "bash-guard.md")).allowed, true);
  assert.equal(writes(join("plugin", "hooks", "_hook.mjs")).allowed, true);
  assert.equal(writes(join("plugin", "hooks", "entries", "bash-guard.mjs")).allowed, true);
  assert.equal(writes(join("plugin", "src", "checks", "learning.mjs")).allowed, true);
});

test("the gate declares no set of its own, so a narrowed set narrows it", () => {
  const text = readFileSync(join(PLUGIN, "hooks", "gates", "restart-owed.mjs"), "utf8");
  assert.match(text, /freezesSession/u, "the gate does not spend the shared reading");
  assert.doesNotMatch(text.replace(/^\s*[/*].*$/gmu, ""), /"plugin\/(?:hooks|skills|agents)/u,
    "the gate names a guarded path itself, and a set narrowed elsewhere would leave it behind");
});

test("through the shell a write shape beside the name holds, and a read of it does not", () => {
  assert.equal(runs("sed -i s/a/b/ plugin/hooks/gate.mjs").allowed, false);
  assert.equal(runs("cp new.json plugin/hooks/hooks.json").allowed, false);
  assert.equal(runs("printf x > plugin/hooks/gate.mjs").allowed, false);
  assert.equal(runs("cat plugin/hooks/gate.mjs").allowed, true, "reading one is not writing it");
  assert.equal(runs("grep -n dispatch plugin/hooks/gate.mjs | head -3").allowed, true);
  assert.equal(runs("echo 'do not touch plugin/hooks/gate.mjs today'").allowed, true,
    "a path inside a sentence is prose");
});

/* The bare token a command spells is not where the write lands: read as one, a command that walks
   out of the checkout first refuses the file it left behind, which is not the file it writes. */
test("a command that leaves the checkout writes elsewhere, whatever the path is spelled", () => {
  const elsewhere = tempRoom("left-the-checkout-");
  assert.equal(runs(`cd ${elsewhere} && printf x > plugin/hooks/hooks.json`).allowed, true,
    "the write lands outside any checkout of this plugin, so there is nothing to hold");
  assert.equal(runs("cd plugin && printf x > hooks/hooks.json").allowed, false,
    "and a move inside the checkout still lands on the frozen file");
});

test("a write outside a checkout of this plugin is nothing to hold", () => {
  const elsewhere = tempRoom("not-a-checkout-");
  assert.equal(
    ask({ tool_name: "Write", tool_input: { file_path: join(elsewhere, "plugin", "hooks", "hooks.json") }, cwd: elsewhere }).allowed,
    true,
  );
});

test("the refusal states the rule and gives one action, and the page it names answers", () => {
  const held = writes(join("plugin", "hooks", "hooks.json"));
  assert.match(held.reason, /reaches a session only at its next start/u, held.reason);
  assert.match(held.reason, /every open session runs the old copy until then/u, held.reason);
  assert.match(held.reason, /Do this: say in one line why no live home fits/u, held.reason);
  assert.match(held.reason, /How: `forge hooks --how restart-owed`$/u, held.reason);

  const page = spawnSync(process.execPath, [CLI, "hooks", "--how", "restart-owed"], { encoding: "utf8", env: ENV });
  assert.equal(page.status, 0, page.stderr);
  assert.equal(page.stdout.trimEnd(),
    readFileSync(join(PLUGIN, "hooks", "how", "restart-owed.md"), "utf8").trimEnd());
});

test("the switch reaches this gate by name, and says which event it is registered on", () => {
  const off = spawnSync(process.execPath, [CLI, "hooks", "--off", "restart-owed"], { encoding: "utf8", env: ENV });
  assert.equal(off.status, 0, off.stderr);
  assert.match(off.stdout, /restart-owed \(PreToolUse\) is now off/u, off.stdout);
  const on = spawnSync(process.execPath, [CLI, "hooks", "--on", "restart-owed"], { encoding: "utf8", env: ENV });
  assert.match(on.stdout, /restart-owed \(PreToolUse\) is now on/u, on.stdout);
});

test("held once per file per session, and the answer is logged once", () => {
  const session = `once-${Date.now()}`;
  const path = join("plugin", "hooks", "link-cli.mjs");
  const event = { tool_name: "Write", tool_input: { file_path: join(checkout, path) }, cwd: checkout, transcript_path: "" };
  assert.equal(ask(event, session).allowed, false, "the first write is held");
  assert.equal(ask(event, session).allowed, true, "the re-send passes without a second question");
  assert.equal(ask(event, session).allowed, true, "and so does every write after it");

  const notes = logged().filter((one) => one.decision === "note" && one.target === path);
  assert.equal(notes.length, 1, `${notes.length} note(s) for one answer: ${JSON.stringify(notes)}`);
  assert.equal(notes[0].hook, "restart-owed");
  assert.equal(notes[0].reason, "no line given", "a transcript that carries no line says so rather than nothing");
});

test("the note carries the line the transcript holds, under the name the release step reads", () => {
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

  assert.equal(ask(event, session).allowed, false);
  assert.equal(ask(event, session).allowed, true);
  const note = logged().filter((one) => one.decision === "note" && one.target === path).at(-1);
  assert.ok(note, `no note against ${path}: ${JSON.stringify(logged())}`);
  assert.equal(note.reason, said);
});

test("doctor names the restart set, read from the one place the release step reads it", () => {
  const run = spawnSync(process.execPath, [CLI, "doctor"], { encoding: "utf8", env: ENV, cwd: checkout });
  const said = new RegExp(`restart set\\s+${FROZEN.join(", ").replace(/[/.]/gu, "\\$&")}`, "u");
  assert.match(run.stdout, said, `doctor does not print the set:\n${run.stdout}`);
  assert.match(run.stdout, /a session keeps these as of its start/u, run.stdout);
});
