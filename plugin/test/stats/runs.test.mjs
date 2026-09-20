/* The three profilers this verb replaces were run once each and thrown away, so nothing held their
   arithmetic to anything. Every row the verb prints is pinned here against a transcript small enough
   to add up by hand. The two tables it cuts a run's time by are `phases.test.mjs`. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { callsIn, shellOf } from "../../src/stats/corpus/transcripts.mjs";
import { classOf } from "../../src/stats/corpus/classes.mjs";
import { slugFor } from "../../src/stats/corpus/corpus.mjs";
import { profileOf, runFrom, unionSeconds } from "../../src/stats/runs.mjs";
import { writeMark } from "../../src/stats/marks/marks.mjs";
import { USAGE } from "../../src/stats/stats.mjs";
import { tempRoom } from "../fixtures.mjs";
import {
  BASE, FORGE, MARKER_TURN, MODELLESS, NOUGHTS, NO_USAGE, OTHER, PROJECT, RESPONSE, SHORT_RESPONSE, SHORT_USAGE,
  ask, asked, at, corpus, result, transcript, use,
} from "./fixture-runs.mjs";

test("every row of a fixture run is what the transcript adds up to", () => {
  const run = ask(corpus());
  assert.equal(run.status, 0, run.stderr);
  const out = run.stdout;
  const has = (line) => assert.ok(out.includes(line), `${line}\n--- printed ---\n${out}`);

  has("1 issue-flow run(s), 2026-09-01 00:00 to 2026-09-01 00:41");
  has("1 transcript(s) skipped as no issue-flow run");
  /* Sixteen calls over 2500s, 1660s of them spent waiting on a tool, so 840s is the model's. */
  has("wall            41.7 min in all, median 41.7/run, longest 41.7");
  has("where it went   27.7 min waiting on a tool (66%), 14 min model (34%)");
  has("calls           median 16/run, 16 in all, 1 never answered");
  has("to first claim  median 0.5 min");
  has("per run         1 gate, 1 test, 1 consult, 1 recheck, 1 verdict, 2 advance (1 of them after a record)");
  has("timeouts        0");
  has("edits           per run edit 0, write 0, edit heredoc 0, edit file 0, edit sed 0 · median chars/call edit 0, write 0, edit heredoc 0, edit file 0, edit sed 0");
  has("ships           1 pass(es), median 1/run, 0 resumed with --from, a push rejected in 0 run(s)");

  /* The ship call opens its own phase and the run stays in it to the close, so the `pgrep` line that
     waits for the release, the reads after it and the refused advance are all the shipping phase's.
     This fixture ends its workspace nowhere and writes nothing it learned, so the phase past the
     shipping one is a nought it can state rather than a bucket holding the tail (ISS-1714).
     The rows are the method's phases, so a figure here names a phase a brief can name (ISS-700). */
  has("0 Project       1      0.2        0        1.0  read 1 0m");
  has("4 Implement     1      4.9        5        3.0  gate 1 2m · test 1 1m · forge record plan 1 0m");
  has("5 Prove         1     25.4       25        4.0  forge codex whole-set 1 15m · forge codex recheck 1 5m"
    + " · forge record verdict 1 0m · forge advance 1 0m");
  has("7 Ship          1     10.8       11        7.0  ship 1 4m · poll 1 0m · forge issue 3 0m · forge advance 1 0m");
  has("8 Clean up      0      0.0        0        0.0  ");
  has("  declare `stats.commands.cleanup` in the .forge.json");

  has("forge codex whole-set           15.0    54%      1");
  has("gate                             2.0     7%      1");
  has("     1  Hold — ISS-nn owes a release note.");
  has("     3  forge issue ISS-99 --full");
  has("    15.0 min  forge codex consult --send bodies plugin/src/stats/runs.mjs");
});

test("--json carries what the screen leaves out", () => {
  const run = ask(corpus(), "--json");
  assert.equal(run.status, 0, run.stderr);
  const held = JSON.parse(run.stdout);
  assert.equal(held.runs, 1);
  assert.equal(held.skipped, 1);
  assert.equal(held.project, PROJECT);
  assert.match(held.root, /claude-\d+\/-fixture-project$/u);
  assert.equal(held.unanswered, 1);
  assert.deepEqual(held.perRun, {
    gate: 1, test: 1, consult: 1, recheck: 1, verdict: 1, advance: 2, advanceAfterRecord: 1,
  });
  assert.deepEqual(
    held.byClass.map(([label]) => label).sort(),
    ["forge advance", "forge claim", "forge codex recheck", "forge codex whole-set", "forge issue",
      "forge record plan", "forge record verdict", "gate", "git", "poll", "read", "ship", "test"],
  );
});

/* A window under --json stopped being JSON on exactly the quiet week the flag exists to diff, and a
   reader diffing two weeks got prose back with a zero exit (ISS-308, criteria 1 and 2). */
test("an empty window is JSON under the flag and prose without it", () => {
  const room = corpus();
  const held = JSON.parse(ask(room, "--since", "1d", "--json").stdout);
  assert.equal(held.runs, 0, "the zero-run profile, not a shape of its own");
  assert.equal(held.from, null);
  assert.equal(held.to, null);
  assert.equal(held.project, PROJECT);
  assert.match(held.root, /claude-\d+\/-fixture-project$/u);
  assert.deepEqual([held.skipped, held.outsideWindow, held.unreadable], [1, 1, 0],
    "and what the reading passed over, which is the whole of why the window is empty");
  assert.equal(held.reach, undefined, "a windowed reading reaches back as far as the flag asked and no further");

  const prose = ask(room, "--since", "1d");
  assert.match(prose.stdout, /No issue-flow run for this project in the last 1d/u,
    "the sentence keeps its shape; only its order with the flag moved");
  assert.match(prose.stdout, /claude-\d+\/-fixture-project {2}2 transcript\(s\)/u,
    "and an empty window still names every place it looked");
});

/* How far the corpus reaches, before any reading is taken off it: a corpus swept an hour ago holds
   as few runs as a young one, and a reading held when the store was deeper is what separates them
   (ISS-1328, criteria 8 and 9). */
test("the whole corpus reports its reach, and a windowed reading reports none", () => {
  const room = corpus();
  const home = tempRoom("stats-reach-home-");
  /* One config home across the calls, where `ask` takes a fresh one: this case is about a reading
     held between two of them. */
  const probe = (...argv) => spawnSync(FORGE, ["stats", "runs", "--checkout", PROJECT, ...argv],
    { encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: home, TMPDIR: room } });

  const silent = probe();
  assert.equal(silent.status, 0, silent.stderr);
  assert.match(silent.stdout, /the corpus reaches back to 2026-09-01 00:00; no reading held for this project records an earlier reach/u,
    silent.stdout);

  const root = join(room, `claude-${process.getuid()}`, slugFor(PROJECT));
  const was = process.env.XDG_CONFIG_HOME;
  try {
    process.env.XDG_CONFIG_HOME = home;
    writeMark({ kind: "runs", mark: 50, at: at(0), root,
      now: { runs: 50, profile: { from: BASE - 24 * 3600 * 1000, to: BASE } } });
  } finally {
    process.env.XDG_CONFIG_HOME = was;
  }
  const said = probe();
  assert.match(said.stdout, /mark 50's reading reached back to 2026-08-31 00:00, so depth this project once read is no longer here/u,
    said.stdout);

  const windowed = probe("--since", "300d");
  assert.equal(windowed.status, 0, windowed.stderr);
  assert.doesNotMatch(windowed.stdout, /the corpus reaches back to/u,
    "the floor of a windowed reading is the flag's selection boundary, so no reach is read off it");
});

test("a window is read off the run's own clock, not the file's", () => {
  const room = corpus();
  const empty = ask(room, "--since", "1d");
  assert.equal(empty.status, 0, empty.stderr);
  assert.match(empty.stdout, /No issue-flow run for this project in the last 1d/u);
  assert.match(empty.stdout, /1 outside the window/u, empty.stdout);
  assert.match(empty.stdout, /name the checkout the runs were worked in with --checkout/u);
});

test("nothing a caller writes is opened", () => {
  const room = corpus();
  const relative = asked(room, "--checkout", "../elsewhere");
  assert.equal(relative.status, 1);
  assert.match(relative.stderr, /--checkout takes an absolute directory, not `\.\.\/elsewhere`/u);
  assert.match(relative.stderr, /no transcript is opened by name/u);

  /* The name this argument had before one verb answered which project: a stranger, answered by the
     set the verb does take, because nothing but this repository's own history ever typed it. */
  const gone = ask(room, "--project", PROJECT);
  assert.equal(gone.status, 1);
  assert.match(gone.stderr, /No stats runs flag named --project\./u, gone.stderr);
  assert.match(gone.stderr, /--checkout/u, gone.stderr);
  assert.doesNotMatch(gone.stderr, /retired/u, "and no line that knows the old name");

  const window = ask(room, "--since", "last week");
  assert.equal(window.status, 1);
  assert.match(window.stderr, /--since takes a window like `3d`, `12h` or `90m`, not `last week`/u);
});

test("the subject is named, and a wrong one says which there is", () => {
  const asked = spawnSync(FORGE, ["stats", "-h"], {
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: tempRoom("stats-home-") },
  });
  assert.equal(asked.status, 0);
  /* The first line off the verb's own text: a set written here again disagrees with it the first
     time a subject is added, which is the drift this case exists to report. */
  assert.ok(asked.stdout.startsWith(`${USAGE.split("\n")[0]}\n`), asked.stdout);

  const wrong = spawnSync(FORGE, ["stats", "consults"], {
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: tempRoom("stats-home-") },
  });
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr, /no subject named consults. There is: runs/u);
});

/* The classifier is the whole verb: two commands that are one call have to land in one class, and
   prose that mentions a verb has to land in none. Each of these was a wrong row in a hand profile. */
test("one class per shape of work, whatever way it was typed", () => {
  for (const [command, expected] of [
    ["./plugin/bin/forge advance ISS-99", "forge advance"],
    ["cd /w && forge advance ISS-99 2>&1 | tail -2", "forge advance"],
    ["for k in A B; do forge advance $k; done", "forge advance"],
    ["timeout 100 ./plugin/bin/forge stats runs", "forge stats"],
    ["F=./plugin/bin/forge; $F record verdict ISS-99", "shell"],
    ['echo "next: forge record verdict ISS-99" >> /tmp/notes', "shell"],
    ["grep -rn 'forge claim' docs/", "read"],
    ["cat > /tmp/c.md <<'EOF'\n1. forge and the tracker agree\nEOF", "edit file"],
    ["grep -n 'sed -i' docs/cli/stats.md", "read"],
    ["grep -rn 'python3 - <<' plugin/", "read"],
    ["node /w/tools/run.mjs review --done abc1234", "shell"],
    ["cat > /tmp/c.md <<'EOF'\n1. npm run check stays green\nEOF", "edit file"],
    ["forge codex consult --recheck plugin/src/cli.mjs", "forge codex recheck"],
    ["forge codex consult plugin/src/cli.mjs", "forge codex consult"],
    ["forge codex consult --diff --only blocker", "forge codex consult"],
    ["forge codex consult --send diffs plugin/src/cli.mjs", "forge codex consult"],
    ["echo x | forge codex consult --send bodies a.md b.md", "forge codex whole-set"],
    ["forge codex consult --send=bodies a.md", "forge codex whole-set"],
    ["forge guide contract awaiting_release", "forge guide"],
    ['until ! pgrep -f "tools/run.mjs ship"; do sleep 10; done', "poll"],
    ["node /w/tools/run.mjs ship --note x", "ship"],
    ["cd /w && npm run check", "gate"],
    /* Each of these was a call counted as having run what it only carried (ISS-781). */
    ["printf '%s\\n' '; forge close ISS-45'", "shell"],
    ["printf '%s\\n' '; npm run check'", "shell"],
    ["echo a\\;forge close ISS-45", "shell"],
    ["ls -l # ; npm run check", "read"],
    ["git log --format=';'", "git"],
    ["git commit -m 'forge: a subject naming npm run check'", "git"],
    ["pgrep -af 'gates.mjs|npm run check'", "poll"],
    ["grep -rn 'forge claim\\|npm run check' docs/", "read"],
    /* And the two spans that go back to a shell: a runner's body, and a substitution. */
    ["nohup bash -c 'node tools/gates.mjs --wait slot 90 && npm run check' > /tmp/g.log 2>&1 &", "gate"],
    ["code=$(timeout 90 bash -c 'set -a; curl -s x'\"$m\"'; head -c 200 /tmp/p')", "read"],
    ["echo \"head $(git rev-parse --short HEAD)\"", "git"],
    ["'/tmp/forge;close' ISS-45", "shell"],
    ["bash -c 'echo '$(printf x)'; npm run check'", "gate"],
    ["bash -o pipefail -c 'echo ready; npm run check'", "gate"],
    ["bash -c 'echo '$( (printf x) )'; npm run check'", "gate"],
  ]) {
    assert.equal(classOf("Bash", shellOf(command)), expected, command);
  }
  assert.equal(classOf("Read", ""), "read");
  assert.equal(classOf("WebFetch", ""), "webfetch");
});

test("the edits line names each route with its calls and characters, and the ships line counts passes, resumes and rejected pushes", () => {
  const room = tempRoom("stats-routes-");
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), "s", "tasks");
  mkdirSync(tasks, { recursive: true });
  const bash = (id, start, command, body = "ok") => [use(id, start, "Bash", { command }), result(id, start + 2, body)];
  writeFileSync(join(tasks, "a7.output"), [
    JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-99" } }),
    ...bash("r1", 10, "./plugin/bin/forge claim ISS-99", "claimed"),
    use("r2", 20, "Edit", { file_path: "/w/a.mjs", old_string: "abcd", new_string: "abcdef" }), result("r2", 21, "edited"),
    use("r3", 30, "Write", { file_path: "/w/b.md", content: "x".repeat(40) }), result("r3", 31, "written"),
    ...bash("r4", 40, "python3 - <<'EOF'\nprint(1)\nEOF"),
    ...bash("r5", 50, "cat > /w/c.txt <<'EOF'\nhello\nEOF"),
    ...bash("r6", 60, "sed -i 's/a/b/' /w/a.mjs"),
    ...bash("r7", 100, "node /w/tools/run.mjs ship", "stopped at step 6 (push to origin/master): git push origin HEAD:master exited 1. Rejected means the remote moved: rebase, then ship --from 2"),
    ...bash("r8", 200, "node /w/tools/run.mjs ship --from 2", "Released."),
    ...bash("r9", 300, "grep -n Rejected tools/run.mjs", "521: `Rejected means the remote moved: rebase, then ${SELF} ship --from 2`"),
    ...bash("r10", 310, "cat plugin/test/stats/runs.test.mjs", "stopped at step 6 (push to origin/master): git push origin HEAD:master exited 1. Rejected means the remote moved"),
  ].join("\n"));
  const run = ask(room);
  assert.equal(run.status, 0, run.stderr);
  const has = (line) => assert.ok(run.stdout.includes(line), `${line}\n--- printed ---\n${run.stdout}`);
  /* Edit carries old plus new (4 + 6), Write its content (40), and each shell route its own text, newlines counted. */
  has("edits           per run edit 1, write 1, edit heredoc 1, edit file 1, edit sed 1 · median chars/call edit 10, write 40, edit heredoc 30, edit file 32, edit sed 24");
  has("ships           2 pass(es), median 2/run, 1 resumed with --from, a push rejected in 1 run(s)");
  /* A second run: the ship ran in the background, and the refusal is read off its log twice. */
  writeFileSync(join(tasks, "a8.output"), [
    JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-98" } }),
    ...bash("s1", 10, "./plugin/bin/forge claim ISS-98", "claimed"),
    ...bash("s2", 20, "node /w/tools/run.mjs ship > /tmp/iss98-ship.log 2>&1", ""),
    ...bash("s3", 400, "tail -3 /tmp/iss98-ship.log", "stopped at step 6 (push to origin/master): git push origin HEAD:master exited 1. Rejected means the remote moved: rebase"),
    ...bash("s4", 500, "tail -3 /tmp/iss98-ship.log", "stopped at step 6 (push to origin/master): git push origin HEAD:master exited 1. Rejected means the remote moved: rebase"),
  ].join("\n"));
  const both = ask(room);
  assert.equal(both.status, 0, both.stderr);
  assert.ok(both.stdout.includes("ships           3 pass(es), median 1.5/run, 1 resumed with --from, a push rejected in 2 run(s)"),
    `two runs, one rejection each\n--- printed ---\n${both.stdout}`);
});

/* The host issues several calls in one turn and they run at once. Summed, their durations exceed
   the wall clock they shared, which reported more waiting than the run took. */
test("waits that overlap are counted once against the wall clock", () => {
  assert.equal(unionSeconds([]), 0);
  assert.equal(unionSeconds([{ at: 0, endedAt: 10_000 }, { at: 4000, endedAt: 8000 }]), 10);
  assert.equal(unionSeconds([{ at: 0, endedAt: 4000 }, { at: 6000, endedAt: 9000 }]), 7);
  assert.equal(unionSeconds([{ at: 6000, endedAt: 9000 }, { at: 0, endedAt: 4000 }]), 7);

  const room = tempRoom("stats-overlap-");
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), "s", "tasks");
  mkdirSync(tasks, { recursive: true });
  writeFileSync(join(tasks, "a1.output"), [
    JSON.stringify({ timestamp: at(0), message: { role: "user", content: "run the issue-flow skill" } }),
    JSON.stringify({
      timestamp: at(0),
      message: { role: "assistant", content: [
        { type: "tool_use", id: "p1", name: "Bash", input: { command: "cd /w && npm run check" } },
        { type: "tool_use", id: "p2", name: "Bash", input: { command: "node --test plugin/test" } },
      ] },
    }),
    result("p1", 600, "passed"),
    result("p2", 600, "ok"),
  ].join("\n"));
  const held = JSON.parse(ask(room, "--json").stdout);
  assert.equal(held.waitMinutes, 10, "the two shared one ten-minute wall interval");
  assert.equal(held.toolMinutes, 20, "and each spent ten tool-minutes of its own");
  assert.equal(held.modelMinutes, 0);
});

/* Six of the listing's top ten rows were not refusals: the word `refused` inside an issue body, a
   `-h` read, a grep that matched nothing, a test's failure line. And a `forge` command prints its
   provenance banner before it refuses, so the row that did name a refusal named the banner. */
test("the refusals listing is what this plugin refused, keyed on the line that names the rule", () => {
  const room = tempRoom("stats-refusals-");
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), "s", "tasks");
  mkdirSync(tasks, { recursive: true });
  const BANNER = "forge_issues -> project forge-plugin (from .forge.json), prose as written";
  const bad = (id, start, command, body) =>
    [use(id, start, "Bash", { command }), result(id, start + 1, body, true)];
  writeFileSync(join(tasks, "a6.output"), [
    JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-97" } }),
    use("f1", 10, "Bash", { command: "./plugin/bin/forge claim ISS-97" }), result("f1", 11, "claimed"),
    /* The banner comes first and names no rule; the refusal after it does. */
    ...bad("f2", 20, "forge advance ISS-97", `${BANNER}\nHold — ISS-97 owes a release note.`),
    /* The tracker writes a tool's refusal with the rule on the NEXT line, and a transport's inline. */
    ...bad("f3", 30, "forge comment ISS-97 /tmp/c.md", `${BANNER}\nforge_comments refused:\ndata.body: Too big: expected string to have <=500 characters`),
    ...bad("f4", 40, "forge issues --status open", `Forge refused: {"code":-32001,"message":"token expired"}`),
    /* The second of the two openers, which names the rule on the line it opens. */
    ...bad("f5", 50, "git add -A", "Refused. git add -A stages everything in the tree.\n\nInstead: name the paths.\n\nHow: `forge hooks --how bash-guard`"),
    /* A chained read printed a refusal it was reading about before the command that met one. */
    ...bad("f6", 60, "cat notes.md && forge advance ISS-97", "Hold — a quoted refusal somebody wrote down.\n\n---\n" + `${BANNER}\nHold — ISS-97 is not yours to advance.`),
    /* Three non-zero exits this plugin refused nothing about. */
    ...bad("f7", 70, "grep -rn nothing docs/", ""),
    ...bad("f8", 80, "node --test plugin/test/a.test.mjs", "# fail 1\nExit code 1"),
    ...bad("f9", 90, "cd /w && npm run check", "Gate failed: lint\nExit code 1"),
    /* A gate that denies on neither opener is still a gate: the `How:` line it ends on is what says
       so, and the rule is named on the first line because the denial is the whole result. */
    ...bad("f12", 55, "git commit -m x", "Codex has not read what this commit stages.\n\nDo this: consult it.\n\nHow: `forge hooks --how codex-second`"),
    /* The same line quoted by a document that goes on printing after it is not a refusal met. */
    use("f13", 57, "Bash", { command: "cat plugin/hooks/how/codex-second.md" }),
    result("f13", 58, "How: `forge hooks --how codex-second`\n\nand the page continues past it."),
    /* A marked line beats a verb sentence wherever each sits, because a marked refusal quotes the
       lines it was refused over and those read as verb sentences. The cost is this body: the
       `guide:` refusal is the one the call met and the row is the quoted mark above it. */
    ...bad("f11", 95, "cat notes.md && forge guide nothing", "Hold — a mark quoted from a comment.\n\nguide: one slug, not `nothing`."),
    /* And a read that exited zero carrying the word, which is what filed 178 rows under `{`. */
    use("f10", 100, "Bash", { command: "forge issue ISS-97 --full" }),
    result("f10", 101, '{\n  "description": "the write is refused when the body is empty"\n}'),
  ].join("\n"));
  const run = ask(room);
  assert.equal(run.status, 0, run.stderr);
  const out = run.stdout;
  const has = (line) => assert.ok(out.includes(line), `${line}\n--- printed ---\n${out}`);
  const hasnt = (line) => assert.ok(!out.includes(line), `still listed: ${line}\n--- printed ---\n${out}`);

  has("     1  Hold — ISS-nn owes a release note.");
  has("     1  data.body: Too big: expected string to have <=500 characters");
  has('     1  {"code":-32001,"message":"token expired"}');
  has("     1  Refused. git add -A stages everything in the tree.");
  has("     1  Hold — ISS-nn is not yours to advance.");
  hasnt(BANNER);
  hasnt("  Exit code 1");
  hasnt("forge_comments refused:");
  hasnt("the write is refused when the body is empty");
  assert.ok(!/ {5}1 {2}Hold — a quoted refusal/u.test(out),
    `the quoted refusal beat the one the call met\n--- printed ---\n${out}`);
  has("     1  Hold — a mark quoted from a comment.");
  hasnt("guide: one slug, not `nothing`.");
  has("     1  Codex has not read what this commit stages.");
  hasnt("and the page continues past it.");

  /* The three that refused nothing are counted by class instead, and none of them is listed. */
  has("other errors    3 non-zero exit(s) refused by no rule of this plugin: read 1, test 1, gate 1");
});

/* The shape is the host's: a record it changes must cost this reading one transcript, said out
   loud, rather than the corpus. */
test("a record this reading cannot parse costs it that transcript and says so", () => {
  const room = corpus();
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), "session-one", "tasks");
  writeFileSync(join(tasks, "a0003.output"), [
    JSON.stringify({ timestamp: at(0), message: { role: "user", content: "the issue-flow skill" } }),
    JSON.stringify({
      timestamp: at(1),
      message: { role: "assistant", content: [{ type: "tool_use", id: "b1", name: 7, input: { command: null } }] },
    }),
    result("b1", 2, "answered"),
  ].join("\n"));
  const run = ask(room);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /2 issue-flow run\(s\)/u, run.stdout);
  assert.match(run.stdout, /1 transcript\(s\) skipped as no issue-flow run/u, run.stdout);
});

/* A filter silently dropped is a measurement that is materially false, and the parser this verb
   reaches for keeps any valued flag it is handed. */
test("a flag this verb does not have is refused rather than ignored", () => {
  const wrong = ask(corpus(), "--sincee", "1d");
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr, /No stats runs flag named --sincee/u, wrong.stderr);
  assert.match(wrong.stderr, /Did you mean: --since/u, wrong.stderr);
});

const typedCall = (id, at, name, input) =>
  JSON.stringify({ timestamp: new Date(at * 1000).toISOString(), message: { content: [{ type: "tool_use", id, name, input }] } });
const gotBack = (id, at) =>
  JSON.stringify({ timestamp: new Date(at * 1000).toISOString(), message: { content: [{ type: "tool_result", tool_use_id: id, content: "x" }] } });

/* The class no one call carries: a poll spread over turns is a read repeated, and `bash-guard.mjs`
   refuses that shape off the same function — a `.err` neither file names, so both read it from one
   home. What the profiler counts and what the gate refuses cannot drift apart on one side. */
test("a read of a log typed again is a poll, and the first read of it is not", () => {
  const typed = [
    ["a", "tail -50 /tmp/ship.log"],
    ["b", "tail -50 /tmp/ship.log"],
    ["c", "grep err /tmp/ship.log"],
    ["d", "echo checking"],
    ["e", "grep err /tmp/ship.log"],
    ["f", "npm test"],
    ["g", "grep err /tmp/ship.log"],
    ["h", "cat /tmp/build.err"],
    ["i", "cat /tmp/build.err"],
  ];
  const whole = typed
    .flatMap(([id, command], at) => [typedCall(id, at * 2 + 1, "Bash", { command }), gotBack(id, at * 2 + 2)])
    .join("\n");
  assert.deepEqual(
    callsIn(whole).calls.map((one) => one.class),
    ["read", "poll", "read", "shell", "poll", "test", "read", "read", "poll"],
  );
});

/* The gate clears its memory when it refuses, so the read past a refusal is one it allows. This counts
   the same way or the recovery it offers would be counted as the waste it was offered instead of. */
test("the third of three identical reads is the recovery, and is no more a poll than the first was", () => {
  const typed = ["tail -f /tmp/gate.log", "tail -f /tmp/gate.log", "tail -f /tmp/gate.log",
    "tail -f /tmp/gate.log", "tail -f /tmp/gate.log"];
  const whole = typed
    .flatMap((command, at) => [typedCall(`p${at}`, at * 2 + 1, "Bash", { command }), gotBack(`p${at}`, at * 2 + 2)])
    .join("\n");
  const classes = callsIn(whole).calls.map((one) => one.class);
  assert.deepEqual(classes, ["read", "poll", "read", "poll", "read"]);
  assert.equal(
    classes.filter((one) => one === "poll").length,
    2,
    "five identical reads meet the gate twice, so they count twice: one class here is one refusal there",
  );
});

/* The second read of a log is where the rejection first appears, because the first one caught the
   ship mid-push. Promoting that read to `poll` says the turn was wasted, never that its body was:
   with the fixture where both reads carry the rejection, dropping the promoted one changes no count,
   which is why this run's first read carries none (F5 of the review on ISS-490). */
test("a push rejection that only the repeated read of the log carries is still counted", () => {
  const room = tempRoom("stats-late-rejection-");
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), "s", "tasks");
  mkdirSync(tasks, { recursive: true });
  const bash = (id, start, command, body = "ok") => [use(id, start, "Bash", { command }), result(id, start + 2, body)];
  const rejected = "stopped at step 6 (push to origin/master): git push origin HEAD:master exited 1. "
    + "Rejected means the remote moved: rebase, then ship --from 2";
  writeFileSync(join(tasks, "a9.output"), [
    JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-98" } }),
    ...bash("t1", 10, "./plugin/bin/forge claim ISS-98", "claimed"),
    ...bash("t2", 20, "node /w/tools/run.mjs ship > /tmp/iss98-ship.log 2>&1", ""),
    ...bash("t3", 300, "tail -3 /tmp/iss98-ship.log", "step 5 (gate): npm run check ..."),
    ...bash("t4", 400, "tail -3 /tmp/iss98-ship.log", rejected),
  ].join("\n"));
  const said = ask(room);
  assert.equal(said.status, 0, said.stderr);
  assert.match(said.stdout, /a push rejected in 1 run\(s\)/u, said.stdout);
});

test("the rung table names the record it read each rung off, so a verb that reads the tracker cannot be mistaken for it", () => {
  const run = ask(corpus());
  assert.equal(run.status, 0, run.stderr);
  const rungs = run.stdout.slice(run.stdout.indexOf("rung "));
  assert.match(rungs, /the run's own record/u,
    "this verb asks the tracker nothing, so the rung here is whatever the run recorded and nothing else");
});

test("usage is counted once per response, and a record carrying none is counted as one carrying none", () => {
  assert.deepEqual(callsIn(transcript()).spent,
    { input: 10, cacheCreate: 100, cacheRead: 1200, output: 50, requests: 2, unmeasured: 18 },
    "two requests billed, and the sixteen call records and two deliberate ones that carry no usage counted apart");
  const spentIn = (...lines) => callsIn(lines.join("\n")).spent;
  const one = spentIn(...RESPONSE);
  assert.deepEqual([one.requests, one.cacheRead], [1, 1200],
    "one response written as three records is one request billed once, not three");
  const marked = spentIn(MARKER_TURN);
  assert.deepEqual([marked.requests, marked.unmeasured, marked.cacheRead], [0, 0, 0],
    "a turn no model generated is no request, and no record of one either");
  assert.deepEqual([spentIn(NOUGHTS).requests, spentIn(NOUGHTS).cacheRead], [1, 0],
    "four noughts is a measurement and not the absence of one");
  const short = spentIn(NO_USAGE, SHORT_USAGE);
  assert.deepEqual([short.requests, short.unmeasured], [0, 2],
    "no usage object, and one missing a price, are each a record carrying no measurement");
});

test("a run carrying no measurement is in no token median and in no token denominator", () => {
  const measured = runFrom("/p", "one", transcript());
  const none = runFrom("/p", "two", OTHER);
  assert.deepEqual([none.tokens.requests, none.tokens.unmeasured], [0, 1],
    "the second run's one assistant record carries no usage, so it holds no measured request");
  const held = profileOf([measured, none]).tokens;
  assert.deepEqual([held.runs, held.unmeasuredRuns, held.requests, held.unmeasured], [1, 1, 2, 19],
    "one run holds the measurements, the other is counted apart, and every record that carried none is named");
  assert.deepEqual(held.perRun, { input: 10, cacheCreate: 100, cacheRead: 1200, output: 50 },
    "the median is over the run that was billed, so the unbilled one does not halve it");
  assert.deepEqual(held.perRequest, { input: 5, cacheCreate: 50, cacheRead: 600, output: 25 },
    "and the divisor is that run's own requests, the numerator and the denominator being one population");
});

test("the token lines print the three readings, each over the population it names", () => {
  const run = ask(corpus());
  assert.equal(run.status, 0, run.stderr);
  const has = (line) => assert.ok(run.stdout.includes(line), `${line}\n--- printed ---\n${run.stdout}`);
  has("tokens          median/run 1.2k cache read, 100 cache written, 50 out, 10 in, "
    + "over 1 run(s) holding a measured request and 0 holding none");
  has("in all          1.2k cache read, 100 cache written, 50 out, 10 in, "
    + "over 2 measured request(s), and 18 record(s) carried no measurement");
  has("per request     600 cache read, 50 cache written, 25 out, 5 in");
});

test("what the API billed is read off the usage alone, whichever record of a response carries it", () => {
  const spentIn = (...lines) => callsIn(lines.join("\n")).spent;
  const first = spentIn(SHORT_RESPONSE, RESPONSE[0]);
  const second = spentIn(RESPONSE[0], SHORT_RESPONSE);
  assert.deepEqual([first.requests, first.cacheRead, first.unmeasured], [1, 1200, 1],
    "a record missing a price does not reserve the id of the response it belongs to");
  assert.deepEqual(first, second, "so the two read the same in either order");
  const modelless = spentIn(MODELLESS);
  assert.deepEqual([modelless.requests, modelless.cacheRead], [1, 3],
    "a record the host named no model on was billed, and the attribution's guard is not the usage's");
  assert.equal(spentIn(MARKER_TURN).requests, 0, "while a turn no model generated is still no request");
});
