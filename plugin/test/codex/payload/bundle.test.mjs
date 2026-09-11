/* Whether a bodies pass can carry the set it was given, which is arithmetic over the bundle and
   nothing else, so every case here is a literal. The refusal it feeds is the whole of what a run
   over the cap gets instead of a clipped review, so what it names is asserted and not just that it
   fired: a partition nobody can act on is the silence this replaces wearing a longer sentence. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("forge-codex-payload-");
const { FILE_CHARS, TOTAL_CHARS, bodiesPasses, cannotCarry } =
  await import("../../../src/codex/codex-api.mjs");

const part = (rel, chars) => ({ rel, chars, clipped: false, text: "x", sha: "abc" });
const FITS = [part("plugin/src/a.mjs", 1000), part("tools/b.mjs", 2000)];

test("a set that fits is one pass, and earns no refusal", () => {
  const held = bodiesPasses(FITS);
  assert.equal(held.whole, true);
  assert.deepEqual(held.over, []);
  assert.deepEqual(held.passes, [["plugin/src/a.mjs", "tools/b.mjs"]]);
  assert.equal(cannotCarry(FITS), null, "a set inside the cap was refused");
  assert.equal(cannotCarry([]), null, "an empty set has nothing that does not fit");
});

test("a part with no body occupies none of the budget", () => {
  const held = bodiesPasses([...FITS, { rel: "plugin/src/gone.mjs", missing: "not a readable file" }]);
  assert.equal(held.whole, true);
  assert.deepEqual(held.passes, [["plugin/src/a.mjs", "plugin/src/gone.mjs", "tools/b.mjs"]],
    "a pass orders by directory, so the two of plugin/src travel together");
});

/* Under the per-file cap and six of them over the total: the size that bites a real change is the
   sum, which is what ISS-1101's 25 ordinary files measured. */
const BIG = 70_000;
const OVER = [
  part("plugin/src/one.mjs", BIG), part("plugin/src/two.mjs", BIG), part("plugin/src/three.mjs", BIG),
  part("tools/four.mjs", BIG), part("tools/five.mjs", BIG), part("tools/six.mjs", BIG),
];

test("a set over the total is cut into passes whose union is the set", () => {
  const { over, passes, whole } = bodiesPasses(OVER);

  assert.equal(whole, false);
  assert.deepEqual(over, [], "nothing here is longer than one file may be");
  assert.deepEqual(passes.flat().sort(), OVER.map((one) => one.rel).sort(),
    "the passes are not a partition of the set");
  assert.equal(new Set(passes.flat()).size, OVER.length, "a file is in two passes");
  for (const pass of passes) {
    const carried = pass.reduce((many, rel) => many + OVER.find((one) => one.rel === rel).chars, 0);
    assert.ok(carried <= TOTAL_CHARS, `a pass of ${carried} characters does not fit the cap`);
  }
  assert.deepEqual(passes[0], ["plugin/src/one.mjs", "plugin/src/two.mjs", "plugin/src/three.mjs"],
    "a directory that fits one pass was split across two");
});

test("a directory larger than one pass is the only thing split", () => {
  const given = [
    ...[1, 2, 3, 4, 5].map((one) => part(`plugin/src/${one}.mjs`, BIG)),
    part("tools/six.mjs", 500),
  ];
  const { passes } = bodiesPasses(given);
  assert.deepEqual(passes, [
    ["plugin/src/1.mjs", "plugin/src/2.mjs", "plugin/src/3.mjs", "plugin/src/4.mjs"],
    ["plugin/src/5.mjs", "tools/six.mjs"],
  ]);
});

test("the refusal over the total names every pass as a command, and says what joins them", () => {
  const said = cannotCarry(OVER);

  assert.match(said, /cannot be sent whole/u);
  assert.match(said, /--send bodies plugin\/src\/one\.mjs plugin\/src\/two\.mjs plugin\/src\/three\.mjs/u,
    `the first pass is not a command a run can take:\n${said}`);
  assert.match(said, /--send bodies tools\/four\.mjs tools\/five\.mjs tools\/six\.mjs/u,
    `the second pass is not a command a run can take:\n${said}`);
  assert.match(said, /One run's bodies passes at one clean head count together/u,
    `the refusal names a partition and not what earns the review with it:\n${said}`);
  assert.doesNotMatch(said, /--send diffs/u, "a diffs pass was offered for a file that fits whole");
});

test("a file longer than one file may be is named apart, with the diff that is the most of it", () => {
  const given = [part("docs/long.md", FILE_CHARS + 1), part("plugin/src/a.mjs", 10)];
  const { over, passes, whole } = bodiesPasses(given);

  assert.equal(whole, false, "a set holding a file no pass carries read as whole");
  assert.deepEqual(over, ["docs/long.md"]);
  assert.deepEqual(passes, [["plugin/src/a.mjs"]], "the oversize file was packed into a pass anyway");

  const said = cannotCarry(given);
  assert.match(said, new RegExp(`docs/long\\.md is ${FILE_CHARS + 1} characters`, "u"),
    `the refusal does not say how long the file it cannot carry is:\n${said}`);
  assert.match(said, /forge codex consult --send diffs docs\/long\.md/u,
    `no route is offered for the file no pass holds:\n${said}`);
  assert.match(said, /forge codex consult --send bodies plugin\/src\/a\.mjs/u,
    `the rest of the set has no pass printed, so a run taking every command here misses it:\n${said}`);
  assert.doesNotMatch(said, /read them as \d+ passes/u,
    `a one-pass remainder was described as a partition:\n${said}`);
});

/* The refusal reaching the verb, which no unit over the arithmetic proves: what matters is that it
   lands before the gateway is opened and before the log is written, so a run over the cap pays for
   nothing. The profile points at a port nothing listens on — a consult that got that far would say
   so, and none of these do. */
const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

const repoOf = (name, each) => {
  const room = tempRoom(name);
  const home = tempRoom(`${name}home-`);
  spawnSync("git", ["init", "-q", room]);
  mkdirSync(join(room, "src"), { recursive: true });
  for (const [rel, chars] of each) writeFileSync(join(room, rel), "x".repeat(chars));
  spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", "add", "."]);
  spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "one"]);
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "proxy.env"), [
    'export ANTHROPIC_BASE_URL="http://127.0.0.1:1"',
    "ANTHROPIC_AUTH_TOKEN=sk-stand-in",
    'ANTHROPIC_DEFAULT_FABLE_MODEL="cx/gpt-5.6-sol"',
  ].join("\n"));
  return { room, home };
};

const consulted = ({ room, home }, argv) => spawnSync(FORGE, ["codex", "consult", ...argv], {
  cwd: room, encoding: "utf8", input: "what I was doing", timeout: 60_000,
  env: { ...process.env, XDG_CONFIG_HOME: home, CLAUDE_PROXY_ENV: join(home, "proxy.env") },
});

test("a bodies pass over a set the cap cannot carry is refused, and costs the run nothing", () => {
  const held = repoOf("codex-refuse-", [["src/one.mjs", BIG], ["src/two.mjs", BIG], ["src/three.mjs", BIG],
    ["src/four.mjs", BIG], ["src/five.mjs", BIG]]);
  const run = consulted(held, ["--send", "bodies", "src/one.mjs", "src/two.mjs", "src/three.mjs",
    "src/four.mjs", "src/five.mjs"]);

  assert.equal(run.status, 1, `the pass was sent:\n${run.stderr}`);
  assert.match(run.stderr, /codex: this set cannot be sent whole/u, run.stderr);
  assert.match(run.stderr, /--send bodies src\/one\.mjs/u, `no pass to take is printed:\n${run.stderr}`);
  assert.doesNotMatch(run.stderr, /sent clipped/u, "the clipped notice stood in for the refusal");
  assert.doesNotMatch(run.stderr, /call 1 of/u, "the gateway was reached before the set was judged");
  assert.equal(existsSync(join(held.home, "forge", "codex-log.jsonl")), false,
    "a consult that never happened was written to the log");
});

test("a bodies pass the cap carries whole is sent, with nothing new said about it", () => {
  const held = repoOf("codex-fits-", [["src/one.mjs", 40], ["src/two.mjs", 40]]);
  const run = consulted(held, ["--send", "bodies", "src/one.mjs", "src/two.mjs"]);

  assert.doesNotMatch(run.stderr, /cannot be sent whole/u, `a set inside the cap was refused:\n${run.stderr}`);
  assert.match(run.stderr, /codex: 2 file\(s\) to review/u, run.stderr);
  const log = join(held.home, "forge", "codex-log.jsonl");
  assert.match(readFileSync(log, "utf8"), /"kind":"started"/u,
    "the consult did not reach the call it then failed at");
});
