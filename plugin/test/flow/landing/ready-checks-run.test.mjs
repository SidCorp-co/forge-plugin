/* Five landings in a row were handed back on a check the project declares for before a landing is
   armed, each red in seconds on the candidate after the ready capture had been taken: the list was
   printed and a run could skip it (ISS-2555). The arming capture runs it now, and refuses on a red. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { tempRoom } from "../../fixtures.mjs";
import { BUILDER, BUILT, CHANGED, checkpoint, declared, field, git, ran } from "./fixture.mjs";

const LOG = join(tempRoom("ready-checks-log-"), "ran.log");
const logged = () => {
  try { return readFileSync(LOG, "utf8"); } catch { return ""; }
};
const note = (word) => `printf '${word}\\n' >> '${LOG}'`;
const HEAD = git(CHANGED, "rev-parse", "HEAD").stdout.trim();

test.beforeEach(() => rmSync(LOG, { force: true }));

test("the arming capture runs every declared check from the checkout's top, in order, and writes ready when all pass", async () => {
  const below = join(CHANGED, "below");
  mkdirSync(below, { recursive: true });
  declared(CHANGED, { ready: { checks: [`printf 'one %s\\n' "$PWD" >> '${LOG}'`, note("two")] } });
  field(null, null);
  const run = await ran(["claim", "ISS-673", "--pushed", "--ready"], BUILDER, below);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const [first, second, ...rest] = logged().split("\n");
  assert.equal(first.replace(/^one /u, ""), git(CHANGED, "rev-parse", "--show-toplevel").stdout.trim(), "run from the top");
  assert.equal(second, "two", "in the declared order");
  assert.deepEqual(rest, [""]);
  assert.equal(checkpoint()?.state, "ready");
  assert.equal(checkpoint()?.head, HEAD);
  const green = run.stdout.split("\n").find((one) => one.startsWith("ready.checks: "));
  assert.match(green ?? "", /^ready\.checks: 2 check\(s\) green at [0-9a-f]{7,}/u, run.stdout);
  assert.ok(green.includes(`\`${note("two")}\``), "the line names the checks that passed");
});

test("a red check refuses the capture, names it with its exit and its last lines, and runs none after it", async () => {
  const red = "echo boom-line; echo tail-line >&2; exit 3";
  declared(CHANGED, { ready: { checks: [note("one"), red, note("three")] } });
  field({ ...BUILT }, null);
  const run = await ran(["claim", "ISS-673", "--pushed", "--ready"], BUILDER, CHANGED);
  assert.notEqual(run.status, 0, run.stdout);
  assert.deepEqual(checkpoint(), BUILT, "the checkpoint stands where it was");
  assert.ok(run.stderr.includes(`\`${red}\` exited 3`), run.stderr);
  assert.match(run.stderr, /^ {2}\| boom-line\n {2}\| tail-line$/mu, run.stderr);
  assert.ok(run.stderr.includes(`\n  ${red}\n  forge claim ISS-673 --pushed --ready`), run.stderr);
  assert.doesNotMatch(logged(), /three/u, "nothing after the red one ran");
  assert.match(logged(), /^one$/mu);
});

test("a project declaring no checks captures with nothing run and nothing said of checks", async () => {
  declared(CHANGED, {});
  field(null, null);
  const run = await ran(["claim", "ISS-673", "--pushed", "--ready"], BUILDER, CHANGED);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(checkpoint()?.state, "ready");
  assert.doesNotMatch(`${run.stdout}${run.stderr}`, /ready\.checks/u);
});

test("a tree holding what the head does not carry is refused before any check runs", async () => {
  const loose = join(CHANGED, "loose.txt");
  writeFileSync(loose, "not committed\n");
  try {
    declared(CHANGED, { ready: { checks: [note("one")] } });
    field(null, null);
    const run = await ran(["claim", "ISS-673", "--pushed", "--ready"], BUILDER, CHANGED);
    assert.notEqual(run.status, 0, run.stdout);
    assert.equal(logged(), "", "no check ran");
    assert.equal(checkpoint(), null);
    assert.match(run.stderr, /loose\.txt/u, run.stderr);
    assert.match(run.stderr, /git add -- <path>\.\.\. && git commit\n {2}forge claim ISS-673 --pushed --ready/u, run.stderr);
  } finally {
    rmSync(loose, { force: true });
  }
});

test("a value the key does not take refuses the arming capture, naming the write that clears it", async () => {
  declared(CHANGED, { ready: { checks: "npm run check:dup" } });
  field({ ...BUILT }, null);
  const run = await ran(["claim", "ISS-673", "--pushed", "--ready"], BUILDER, CHANGED);
  assert.notEqual(run.status, 0, run.stdout);
  assert.deepEqual(checkpoint(), BUILT);
  assert.match(run.stderr, /forge doctor --set ready\.checks=<command>,<command>\n {2}forge claim ISS-673 --pushed --ready/u,
    run.stderr);
});
