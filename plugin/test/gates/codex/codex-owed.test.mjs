import assert from "node:assert/strict";
import test from "node:test";

import { spawnSync } from "node:child_process";
import { mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { callHook, tempRoom } from "../../fixtures.mjs";
import { digest } from "../../../src/codex/codex-api.mjs";
import { typed } from "../../../src/hooks/shell-spans.mjs";

const HOOK = new URL("../../../hooks/entries/codex/codex-owed.mjs", import.meta.url).pathname;
const COMMIT_HOOK = new URL("../../../hooks/entries/codex/codex-second.mjs", import.meta.url).pathname;
const room = tempRoom("codex-owed-");
const REPO = join(room, "repo");
mkdirSync(join(room, "forge"), { recursive: true });
spawnSync("git", ["init", "-q", REPO]);
test.after(() => rmSync(room, { recursive: true, force: true }));

const at = (msAgo) => new Date(Date.now() - msAgo).toISOString();
const lines = (...rows) => `${rows.map((one) => JSON.stringify(one)).join("\n")}\n`;
const GATED = { slug: "fixture", codex: { owed: ["gate"] } };

let count = 0;
/* No index is set and no transcript passed: this gate reads the working copy and neither of those,
   and a fixture handing it one would hide the thing that separates it from the commit's reading. */
const gate = ({ command, pending = ["work.mjs"], log = "", project = GATED, env = {}, held, hook = HOOK, stage } = {}) => {
  count += 1;
  writeFileSync(join(REPO, "work.mjs"), held ?? `// ${count}\n`);
  if (project === null) rmSync(join(REPO, ".forge.json"), { force: true });
  else writeFileSync(join(REPO, ".forge.json"), JSON.stringify(project));
  writeFileSync(join(room, "forge", "codex-log.jsonl"), log);
  writeFileSync(
    join(room, "forge", "codex.json"),
    JSON.stringify({ turns: pending ? { [realpathSync(REPO)]: { files: pending, at: Date.now() - 90_000 } } : {} }),
  );
  /* A commit is asked only for what it stages, so the index is each case's to set and never the last one's. */
  spawnSync("git", ["-C", REPO, "read-tree", "--empty"]);
  if (stage) spawnSync("git", ["-C", REPO, "add", ...stage]);
  const run = callHook(
    hook,
    { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, session_id: `s${count}`, cwd: REPO },
    { ...process.env, XDG_CONFIG_HOME: room, ...env },
  );
  return run.stdout.trim() ? JSON.parse(run.stdout) : null;
};
const because = (out) => out?.hookSpecificOutput?.permissionDecisionReason ?? "";

test("a gate the project named waits for the documents it would judge, and says what reads them", () => {
  const out = gate({ command: "npm run check" });
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny", "named in codex.owed, the gate is held");
  assert.match(because(out), /Codex has not read what this call would judge/u);
  assert.match(because(out), /work\.mjs/u);
  assert.match(because(out), /forge codex consult --diff --only blocker,major/u,
    "the same command the commit refusal names, so one reading is asked for and not two");
  assert.match(because(out), /forge codex pending --drop/u, "and the route out that needs no consult");
  assert.match(because(out), /forge hooks --off codex-owed/u, "and the switch a refused session can reach");
});

test("a door the project did not name holds nothing, and the key absent holds only the commit", () => {
  assert.equal(gate({ command: "node tools/run.mjs ship" }), null, "`ship` is not in this project's list");
  assert.equal(gate({ command: "ls -la" }), null, "and a call that is no door at all");
  assert.equal(gate({ command: "npm run check", project: { slug: "fixture", codex: { owed: [] } } }), null,
    "an empty list is the off switch and is not the absent key");
  assert.equal(gate({ command: "npm run check", project: { slug: "fixture" } }), null,
    "absent, the gate holds nothing — a plugin's hooks reach trees whose owners never asked for this");
  assert.equal(gate({ command: "npm run check", project: null }), null, "and a tree with no project file at all");
  const kept = gate({ command: "git commit -m x", project: { slug: "fixture" }, hook: COMMIT_HOOK, stage: ["work.mjs"] });
  assert.equal(kept?.hookSpecificOutput?.permissionDecision, "deny",
    "absent, the commit still asks: that is what this plugin did before the key, and no installation moves");
});

test("the commit door is the same key, so a project naming only the gate is not asked twice", () => {
  assert.equal(gate({ command: "git commit -m x", hook: COMMIT_HOOK, stage: ["work.mjs"] }), null,
    "`owed: [gate]` takes the demand off the commit; the gate ahead of it made it");
  const both = gate({ command: "git commit -m x", project: { slug: "fixture", codex: { owed: ["gate", "commit"] } }, hook: COMMIT_HOOK, stage: ["work.mjs"] });
  assert.equal(both?.hookSpecificOutput?.permissionDecision, "deny", "and naming both keeps the commit as the backstop");
});

/* A door nobody named is still a door: what the key turns off is the demand, never this gate's own
   ability to say it cannot read which tree the command closes over. */
test("a commit whose tree cannot be read is refused whatever the shell's project named", () => {
  const out = because(gate({ command: "cd - && git commit -m x", hook: COMMIT_HOOK, stage: ["work.mjs"] }));
  assert.match(out, /cannot be read from the command/u,
    "read under this project's `owed: [gate]`, the commit would have gone through under another tree's policy");
  assert.match(out, /cd <path> && git commit/u, "and the refusal says how to name the tree");
});

/* The same unknown destination at this door: a `cd -` ahead of the gate would otherwise run it over
   a tree nobody could name, and under `owed: ["gate"]` nothing else would ask afterwards. */
test("a call whose tree cannot be read is refused where this project asks at that door, and nowhere else", () => {
  const out = because(gate({ command: "cd - && npm run check" }));
  assert.match(out, /cannot be read from the command/u, "the gate would have run over a tree nobody named");
  assert.match(out, /cd <path> && <the command>/u, "and the refusal says how to name it");
  assert.equal(gate({ command: "cd - && npm run check", project: { slug: "fixture" } }), null,
    "a project that names no such door is asked nothing, unreadable destination or not");
  assert.equal(gate({ command: "cd - && ls -la" }), null, "and a call that is no door of theirs either way");
});

/* The user's sentence as a checker: ask once, at the gate, and the commit after it goes through. */
test("a consult read and ruled before the gate clears the gate and the commit alike", () => {
  const text = "// the bytes that went up\n";
  const read = { kind: "consult", id: "c1", ok: true, root: realpathSync(REPO), at: at(300_000),
    reply: "no blocker found", files: ["work.mjs"],
    sent: [{ rel: "work.mjs", sha: digest(text), chars: text.length, clipped: false }] };
  assert.equal(gate({ command: "npm run check", held: text, log: lines(read) }), null, "the gate goes");
  assert.equal(gate({ command: "git commit -m x", held: text, log: lines(read), hook: COMMIT_HOOK,
    stage: ["work.mjs"], project: { slug: "fixture", codex: { owed: ["gate", "commit"] } } }), null,
    "and the commit after it goes normally, even where the project keeps that door, off the same record");
});

test("a finding nobody ruled on holds the gate, with the disposition that closes it", () => {
  const found = { kind: "consult", id: "c9", at: at(300_000), root: realpathSync(REPO), ok: true, files: ["a.mjs"],
    reply: "- **F1 — New — major:** `a.mjs:1` — x." };
  const out = because(gate({ command: "npm run check", pending: null, log: lines(found) }));
  assert.match(out, /Consult c9 made F1 on a\.mjs; nothing says what became of F1/u);
  assert.match(out, /forge codex verdict --of c9 --accepted/u);
});

test("a value the key does not take is refused with the key named, and nothing is guessed", () => {
  for (const owed of [["refuse"], "gate", [1]]) {
    const out = because(gate({ command: "npm run check", project: { slug: "fixture", codex: { owed } } }));
    assert.match(out, /is no door this reads/u, `\`${JSON.stringify(owed)}\` was taken for something`);
    assert.match(out, /`codex\.owed` in \.forge\.json is a list of the doors/u, "the key is named");
    assert.match(out, /gate, commit, ship/u, "with what it takes");
  }
});

test("the tree is where the cd in the same command left the shell, and every tree the line gates in", () => {
  const other = join(room, "other");
  mkdirSync(other, { recursive: true });
  spawnSync("git", ["init", "-q", other]);
  writeFileSync(join(other, "make.mjs"), "// b\n");
  writeFileSync(join(other, ".forge.json"),
    JSON.stringify({ slug: "other", codex: { owed: ["gate"] }, stats: { commands: { gate: "make verify" } } }));
  const away = (command) => {
    writeFileSync(join(REPO, ".forge.json"), JSON.stringify(GATED));
    writeFileSync(join(room, "forge", "codex-log.jsonl"), "");
    writeFileSync(join(room, "forge", "codex.json"),
      JSON.stringify({ turns: { [realpathSync(other)]: { files: ["make.mjs"], at: Date.now() - 90_000 } } }));
    const run = callHook(
      HOOK,
      { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, session_id: "s-away", cwd: REPO },
      { ...process.env, XDG_CONFIG_HOME: room },
    );
    return run.stdout.trim() ? JSON.parse(run.stdout) : null;
  };
  const moved = because(away(`cd ${other} && make verify`));
  assert.match(moved, /make\.mjs/u, "classed against the tree it left, `make verify` is no gate of anybody's");
  assert.ok(moved.includes(`cd ${typed(realpathSync(other))} && echo`),
    "and a relative name run from the tree the call left reaches another project's file of that name, or none");
  assert.match(because(away(`npm run check && cd ${other} && make verify`)), /make\.mjs/u,
    "the first tree's record is clean and the second would be judged anyway");
  assert.equal(gate({ command: `cd ${other} && make verify` }), null,
    "and this tree's own record does not answer for a call that gates somewhere else");
});

test("the review switched off takes this with it", () => {
  assert.equal(gate({ command: "npm run check", env: { FORGE_CODEX_DISABLE: "1" } }), null);
});
