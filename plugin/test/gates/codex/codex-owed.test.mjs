import assert from "node:assert/strict";
import test from "node:test";

import { spawnSync } from "node:child_process";
import { mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { answered, callHook, projectEntry, projectRecord, tempRoom } from "../../fixtures.mjs";
import { assertRouteFirst } from "../../fixtures/route-first.mjs";
import { digest } from "../../../src/codex/codex-api.mjs";
import { typed } from "../../../src/hooks/shell-spans.mjs";

const HOOK = new URL("../../../hooks/entries/codex/codex-owed.mjs", import.meta.url).pathname;
const COMMIT_HOOK = new URL("../../../hooks/entries/codex/codex-second.mjs", import.meta.url).pathname;
const room = tempRoom("codex-owed-");
const REPO = join(room, "repo");
mkdirSync(join(room, "forge"), { recursive: true });
spawnSync("git", ["init", "-q", REPO], { cwd: dirname(REPO) });
test.after(() => rmSync(room, { recursive: true, force: true }));

const at = (msAgo) => new Date(Date.now() - msAgo).toISOString();
const lines = (...rows) => `${rows.map((one) => JSON.stringify(one)).join("\n")}\n`;
/* Every fixture that expects a refusal declares the command its own gate is: a door is armed by the
   project's own declaration and by no table of this repository's commands (ISS-1905). */
const GATED = { slug: "fixture", codex: { owed: ["gate"] }, stats: { commands: { gate: "npm run check" } } };

let count = 0;
/* No index is set and no transcript passed: this gate reads the working copy and neither of those,
   and a fixture handing it one would hide the thing that separates it from the commit's reading. */
const gate = ({ command, pending = ["work.mjs"], log = "", project = GATED, env = {}, held, hook = HOOK, stage } = {}) => {
  count += 1;
  writeFileSync(join(REPO, "work.mjs"), held ?? `// ${count}\n`);
  /* The project's keys are this machine's record of the checkout, kept under the configuration
     home these cases hand the hook, which is this room. */
  if (project === null) rmSync(projectEntry(REPO, room), { force: true });
  else projectRecord(REPO, room, project);
  writeFileSync(join(room, "forge", "codex-log.jsonl"), log);
  writeFileSync(
    join(room, "forge", "codex.json"),
    JSON.stringify({ turns: pending ? { [realpathSync(REPO)]: { files: pending, at: Date.now() - 90_000 } } : {} }),
  );
  /* A commit is asked only for what it stages, so the index is each case's to set and never the last one's. */
  spawnSync("git", ["-C", REPO, "read-tree", "--empty"], { cwd: REPO });
  if (stage) spawnSync("git", ["-C", REPO, "add", ...stage], { cwd: REPO });
  const run = callHook(
    hook,
    { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, session_id: `s${count}`, cwd: REPO },
    { ...process.env, HOME: room, XDG_CONFIG_HOME: room, ...env },
  );
  return answered(run);
};
const because = (out) => out?.hookSpecificOutput?.permissionDecisionReason ?? "";

const CLI = new URL("../../../src/cli.mjs", import.meta.url).pathname;
/* The escape the refusal names, run as a caller would run it and never simulated: the record it
   reads is the one the gate just refused over, and the call after it is the same call. */
const dropped = () => spawnSync(process.execPath, [CLI, "codex", "pending", "--drop"],
  { cwd: REPO, encoding: "utf8", env: { ...process.env, HOME: room, XDG_CONFIG_HOME: room } });
const again = (command) => {
  count += 1;
  const run = callHook(
    HOOK,
    { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, session_id: `s${count}`, cwd: REPO },
    { ...process.env, HOME: room, XDG_CONFIG_HOME: room },
  );
  return answered(run);
};

test("a gate the project named waits for the documents it would judge, and says what reads them", () => {
  const out = gate({ command: "npm run check" });
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny", "named in codex.owed, the gate is held");
  assert.match(because(out), /Codex has not read what this call would judge/u);
  assert.match(because(out), /work\.mjs/u);
  assert.match(because(out), /forge codex consult --diff --only blocker,major/u,
    "the same command the commit refusal names, so one reading is asked for and not two");
  assert.match(because(out), /forge codex pending --drop/u, "and the route out that needs no consult");
  assert.match(because(out), /forge hooks --off codex-owed/u, "and the switch a refused session can reach");
  assert.match(because(out), /off for every project and every session on this account until `forge hooks --on codex-owed`/u,
    "which is the account's, with the way back on (ISS-45)");
  assert.doesNotMatch(because(out), /for the session/iu);
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

/* The defect ISS-1905 names: a table of this repository's own commands, reached from a route that
   refuses, denies `npm run check` in every project that adopted the plugin and spelled its gate for
   itself — or never spelled it at all. Without the fix every assertion here refuses. */
test("a door a project named and armed with no command holds nothing", () => {
  const named = { slug: "fixture", codex: { owed: ["gate"] } };
  assert.equal(gate({ command: "npm run check", project: named }), null,
    "this repository's own gate command is no declaration of theirs");
  assert.equal(gate({ command: "node tools/gates.mjs", project: named }), null, "nor is its other spelling");
  for (const wrote of ["", "   ", 42, []]) {
    assert.equal(gate({ command: "npm run check", project: { ...named, stats: { commands: { gate: wrote } } } }), null,
      `\`${JSON.stringify(wrote)}\` is no command, and a value that is no command declares nothing`);
  }
});

test("a project is held at the command it declared and never at this repository's", () => {
  const theirs = { slug: "fixture", codex: { owed: ["gate"] }, stats: { commands: { gate: "make verify" } } };
  assert.match(because(gate({ command: "make verify", project: theirs })),
    /Codex has not read what this call would judge/u, "their own gate command is the door");
  assert.equal(gate({ command: "npm run check", project: theirs }), null,
    "and the command this repository calls its gate is an ordinary call in theirs");
});

test("an unarmed door leaves an armed sibling holding", () => {
  const mixed = { slug: "fixture", codex: { owed: ["gate", "ship"] },
    stats: { commands: { gate: "", ship: "pnpm ship" } } };
  assert.equal(gate({ command: "npm run check", project: mixed }), null, "the door nothing arms holds nothing");
  assert.match(because(gate({ command: "pnpm ship", project: mixed })),
    /Codex has not read what this call would judge/u, "the one armed beside it is untouched");
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
    const out = because(gate({ command: "npm run check", project: { ...GATED, codex: { owed } } }));
    assert.match(out, /is no door this reads/u, `\`${JSON.stringify(owed)}\` was taken for something`);
    assert.match(out, /^Name only doors out of .* in `codex\.owed`, or drop the key/u, "the key is named, in the route");
    assert.match(out, /is a list of the doors a consult is demanded at/u, "and what it holds, after the route");
    assert.match(out, /gate, commit, ship/u, "with what it takes");
    assert.match(out, /until `forge hooks --on codex-owed`/u, "and the switch, as every other refusal names it");
  }
});

test("the tree is where the cd in the same command left the shell, and every tree the line gates in", () => {
  const other = join(room, "other");
  mkdirSync(other, { recursive: true });
  spawnSync("git", ["init", "-q", other], { cwd: dirname(other) });
  writeFileSync(join(other, "make.mjs"), "// b\n");
  projectRecord(other, room,
    { slug: "other", codex: { owed: ["gate"] }, stats: { commands: { gate: "make verify" } } });
  const away = (command) => {
    projectRecord(REPO, room, GATED);
    writeFileSync(join(room, "forge", "codex-log.jsonl"), "");
    writeFileSync(join(room, "forge", "codex.json"),
      JSON.stringify({ turns: { [realpathSync(other)]: { files: ["make.mjs"], at: Date.now() - 90_000 } } }));
    const run = callHook(
      HOOK,
      { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, session_id: "s-away", cwd: REPO },
      { ...process.env, HOME: room, XDG_CONFIG_HOME: room },
    );
    return answered(run);
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

/* A refusal carries the one command that clears it, and this one carried a command that cleared
   nothing: `--drop` took the staged set while the gate refused over the working copy, so under
   `owed: ["gate"]` with nothing staged the escape was unreachable by construction (ISS-392). */
test("the escape this refusal names clears the refusal", () => {
  assert.match(because(gate({ command: "npm run check" })), /forge codex pending --drop/u,
    "the refusal offers it");
  const out = dropped();
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /dropped 1 recorded file\(s\), 1 of which no consult had read/u);
  assert.equal(again("npm run check"), null, "and the call it was offered for goes");
});

/* The drop is of the record and of nothing else: a finding nobody ruled on is this gate's own
   second subject, and an escape that took it with the record would clear a hold it never named. */
test("a finding nobody ruled on survives the drop that clears the unread record", () => {
  const found = { kind: "consult", id: "c7", at: at(300_000), root: realpathSync(REPO), ok: true, files: ["a.mjs"],
    reply: "- **F1 — New — major:** `a.mjs:1` — x." };
  assert.match(because(gate({ command: "npm run check", log: lines(found) })),
    /Codex has not read what this call would judge/u, "the unread record is what it names first");
  assert.equal(dropped().status, 0);
  const after = because(again("npm run check"));
  assert.doesNotMatch(after, /has not read what this call would judge/u, "the hold the escape named is gone");
  assert.match(after, /Consult c7 made F1/u, "and the one it never named is still the gate's");
});

/* AC-07-3-4. Each of the four refusals, read for the order and not the words. */
test("every refusal this gate writes leads with its route", () => {
  const found = { kind: "consult", id: "c9", at: at(300_000), root: realpathSync(REPO), ok: true, files: ["a.mjs"],
    reply: "- **F1 — New — major:** `a.mjs:1` — x." };
  const reasons = {
    unread: because(gate({ command: "npm run check" })),
    unruled: because(gate({ command: "npm run check", pending: null, log: lines(found) })),
    "no tree": because(gate({ command: "cd - && npm run check" })),
    "no door": because(gate({ command: "npm run check", project: { ...GATED, codex: { owed: ["refuse"] } } })),
  };
  for (const [label, reason] of Object.entries(reasons)) assertRouteFirst(reason, label);
});
