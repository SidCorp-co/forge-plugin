/* The help-reads table `forge stats runs` prints beside the guide-parts table: whose help a run
   read, how many runs read it, and how many went back to it. Read through the printed profile
   rather than through the classifier, because what a slot serves is the CLI's answer and a case
   asking the pattern would agree with itself whatever the CLI does. Its own file because
   runs.test.mjs is at the line cap; the corpus here is its own and no fixture of that file is
   touched. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { slugFor } from "../../../src/stats/corpus/corpus.mjs";
import { tempRoom } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const PROJECT = "/fixture/project";
const BASE = Date.parse("2026-09-01T00:00:00.000Z");
const at = (seconds) => new Date(BASE + seconds * 1000).toISOString();

const use = (id, seconds, command) => JSON.stringify({
  timestamp: at(seconds),
  message: { role: "assistant", content: [{ type: "tool_use", id, name: "Bash", input: { command } }] },
});
const result = (id, seconds, content) => JSON.stringify({
  timestamp: at(seconds),
  message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content, is_error: false }] },
});
const bash = (id, start, command, body = "ok") => [use(id, start, command), result(id, start + 2, body)];
const marker = (key) => JSON.stringify({
  timestamp: at(0), type: "user", message: { role: "user", content: `Skill forge:issue-flow ${key}` },
});

/* Run A reads one verb's help THREE times, so the read-again column is told apart from a count of
   the extra reads: both readings say 1 at two, and only this says 1 at three. */

/* Beside the reads, nine calls carrying the help word that read no help: prose inside a `--why`,
   the slot past a subject where the verb answers a refusal, another program's flag, a verb this CLI
   does not have, a longer word opening with the help word, one the word is glued to a value in, two
   the word is inside a brace expansion of, one a process substitution joins a path onto, and one a
   non-breaking space follows — a brace, a `<(` and every blank but the three a shell splits on each
   end no word, whatever any of them does to a command. One more is a real read on a line a declared
   gate command takes the class of. And one IS a read written into a file, the redirection that is
   not a process substitution ending the word as any operator does. */
const corpus = () => {
  const room = tempRoom("stats-help-");
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), "session-help", "tasks");
  mkdirSync(tasks, { recursive: true });
  writeFileSync(join(tasks, "a0031.output"), [
    marker("ISS-97"),
    ...bash("p1", 10, "./plugin/bin/forge claim ISS-97", "claimed"),
    ...bash("p2", 20, "forge issue -h", "Usage: forge issue"),
    ...bash("p3", 30, "cd /w && ./plugin/bin/forge issue -h | head -5", "Usage: forge issue"),
    ...bash("p4", 40, "forge issue -h 2>&1 | tail -3", "Usage: forge issue"),
    ...bash("p5", 50, "forge record verdict --help", "Usage: forge record verdict"),
    ...bash("p6", 60, 'forge record verdict ISS-97 --why "read forge record verdict -h first"', "recorded"),
    ...bash("p7", 70, "forge guide contract developed -h", "guide: contract takes one part"),
    ...bash("p8", 80, "forge issue ISS-97", "the body"),
    ...bash("p9", 90, "df -h /tmp", "free"),
  ].join("\n"));
  writeFileSync(join(tasks, "a0032.output"), [
    marker("ISS-96"),
    ...bash("q1", 10, "./plugin/bin/forge claim ISS-96", "claimed"),
    ...bash("q2", 20, "forge issue -h", "Usage: forge issue"),
    ...bash("q3", 30, "forge stats runs -h", "Usage: forge stats runs"),
    ...bash("q4", 40, "forge nosuchverb -h", "forge: no such verb"),
    ...bash("q5", 50, "forge issue --help=everything", "issue: expected a --flag"),
    ...bash("q6", 60, "forge issue -h.txt", "issue: expected a --flag"),
    ...bash("q7", 70, "npm run check; forge issue -h", "All 14 gate step(s) passed"),
    ...bash("q8", 80, "forge issue --help{notes}", "issue: expected a --flag"),
    ...bash("q9", 90, "forge issue -h}", "issue: expected a --flag"),
    ...bash("q10", 100, "forge issue --help<(printf x)", "issue: expected a --flag"),
    ...bash("q11", 110, "forge stats runs --help>/tmp/help-output", "Usage: forge stats runs"),
    ...bash("q12", 120, "forge issue --help\u00a0notes", "issue: expected a --flag"),
  ].join("\n"));
  return room;
};

const ask = (room, ...argv) =>
  spawnSync(FORGE, ["stats", "runs", "--checkout", PROJECT, ...argv], {
    encoding: "utf8",
    env: { ...process.env, HOME: room, XDG_CONFIG_HOME: tempRoom("stats-help-home-"), TMPDIR: room },
  });

/* AC-19-8-36. The three columns are the guide-parts table's, so the two read side by side, and the
   share is over the calls to this CLI rather than over every call a run made: a lookup is a lookup
   of one of those. The class table goes on counting a help read under the verb, which is what the
   share is there to qualify — `forge issue` is four calls of which two were lookups. */
test("a verb's help reads are a table of their own, counted only where that verb serves help, with the class table unchanged", () => {
  const room = corpus();
  const said = ask(room);
  assert.equal(said.status, 0, said.stderr);
  const has = (line) => assert.ok(said.stdout.includes(line), `${line}\n--- printed ---\n${said.stdout}`);
  has("help read, by the verb                calls  runs  read again");
  has(`${"forge issue".padEnd(36)}      4     2           1`);
  has(`${"forge stats".padEnd(36)}      2     1           1`);
  has(`${"forge record verdict".padEnd(36)}      1     1           0`);
  has("help reads      7 of 18 call(s) to this CLI (39%), read in 2 of 2 run(s), median 3.5/run over those");
  const json = ask(room, "--json");
  assert.equal(json.status, 0, json.stderr);
  const held = JSON.parse(json.stdout);
  assert.deepEqual(held.helpReads, [
    ["forge issue", { calls: 4, runs: 2, again: 1 }],
    ["forge stats", { calls: 2, runs: 1, again: 1 }],
    ["forge record verdict", { calls: 1, runs: 1, again: 0 }],
  ]);
  assert.deepEqual(held.help, { calls: 7, forgeCalls: 18, share: "39%", runs: 2, perRun: 3.5 });
  const row = (label) => held.byClass.find(([one]) => one === label)?.[1].calls;
  assert.equal(row("forge issue"), 11, "a help read is still a call of the verb in the class table");
  assert.equal(row("forge record verdict"), 2);
  assert.equal(row("forge guide"), 1);
  assert.equal(row("gate"), 1, "and the call a gate command took the class of is counted there");
});
