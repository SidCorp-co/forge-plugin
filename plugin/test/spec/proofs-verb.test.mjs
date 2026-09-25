/* `forge spec proofs` spawned in a checkout of its own, against a tracker fixture: what is under test
   is what reaches the terminal, the exit it ends on and which configuration it read, none of which a
   call to the reading can show. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { fakeTracker, projectRoom, ranAsync, tempRoom } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const OPEN = "ISS-7";
const CLOSED = "ISS-8";
const escape = (key) => `none yet — ${key}`;
const TESTS = { root: "tests", pattern: "*.test.mjs" };

const criterion = (id, proof) =>
  `- **${id}** · Rev: 1 · Proof: ${proof}\n  WHEN a case is named THEN the checker SHALL read it.\n`;
const cases = (count) => Array.from({ length: count }, (_, at) => `test("case ${at}", () => {});\n`).join("");

const state = {
  issues: [
    { documentId: "00000001-2222-4222-8222-222222222222", issueId: OPEN, status: "open", title: OPEN },
    { documentId: "00000002-2222-4222-8222-222222222222", issueId: CLOSED, status: "closed", title: CLOSED },
  ],
  comments: {},
  answer: {
    forge_issues: (args) => (args.action === "list" && state.refuses ? { refused: state.refuses } : undefined),
  },
  refuses: null,
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());
const HOME = tracker.env.XDG_CONFIG_HOME;

const put = (room, path, text) => {
  mkdirSync(dirname(join(room, path)), { recursive: true });
  writeFileSync(join(room, path), text);
};

const checkout = (name, { tests = TESTS, rows = null } = {}) => {
  const room = projectRoom(tempRoom(`spec-proofs-${name}-`), HOME, { slug: "forge-plugin", ...(tests ? { tests } : {}) });
  put(room, "docs/requirements/srs/fr-01-x.md", `## UC-01-1 — A use case\n\nRev: 1\n\n${(rows ?? [
    criterion("AC-01-1-1", 'tests/a.test.mjs "case 0"'),
    criterion("AC-01-1-2", 'tests/a.test.mjs "case 0"'),
    criterion("AC-01-1-3", escape(OPEN)),
    criterion("AC-01-1-4", escape(CLOSED)),
  ]).join("")}`);
  put(room, "tests/a.test.mjs", cases(1));
  put(room, "tests/deep/big.test.mjs", cases(4));
  put(room, "tests/small.test.mjs", cases(2));
  put(room, "tests/helper.mjs", cases(9));
  return room;
};

const proofs = (room, ...argv) => ranAsync(FORGE, ["spec", "proofs", ...argv], tracker.env, room);

test("forge spec proofs lists the unproven criteria with the key each names and whether it is still open", async () => {
  state.refuses = null;
  const run = await proofs(checkout("unproven"));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ {2}docs\/requirements\/srs\/fr-01-x\.md:9 +AC-01-1-3 +ISS-7 +open, still owes the case$/mu, run.stdout);
  assert.match(run.stdout, /^ {2}docs\/requirements\/srs\/fr-01-x\.md:11 +AC-01-1-4 +ISS-8 +closed, owes nothing now$/mu, run.stdout);
});

test("an issue list the tracker refused leaves every status unread and the verb exits 0", async () => {
  state.refuses = "the list route is down";
  const run = await proofs(checkout("refused"));
  state.refuses = null;
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ {2}statuses unread: the tracker refused the issue list/mu, run.stdout);
  assert.match(run.stdout, /AC-01-1-3 +ISS-7 +status unread$/mu, run.stdout);
  assert.match(run.stdout, /AC-01-1-4 +ISS-8 +status unread$/mu, run.stdout);
});

test("the unnamed list is the declared test files no Proof names, most lines first with their case counts", async () => {
  const run = await proofs(checkout("unnamed"));
  assert.equal(run.status, 0, run.stderr);
  const section = run.stdout.split("\n\n").find((one) => one.startsWith("Unnamed test files:"));
  const rows = section.split("\n").slice(1).map((one) => one.trim().split(/ {2,}/u));
  assert.deepEqual(rows, [["tests/deep/big.test.mjs", "4 line(s), 4 case(s)"], ["tests/small.test.mjs", "2 line(s), 2 case(s)"]]);
});

test("each list opens with its count", async () => {
  const run = await proofs(checkout("counts"));
  assert.match(run.stdout, /^Unproven criteria: 2$/mu, run.stdout);
  assert.match(run.stdout, /^Unnamed test files: 2 of 3 under tests named \*\.test\.mjs, most lines first$/mu, run.stdout);
  assert.match(run.stdout, /^Shared cases: 1$/mu, run.stdout);
  assert.match(run.stdout, /^ {2}tests\/a\.test\.mjs "case 0" {2}AC-01-1-1, AC-01-1-2$/mu, run.stdout);
});

test("--json prints one object with one member per list, each carrying its count", async () => {
  const run = await proofs(checkout("json"), "--json");
  assert.equal(run.status, 0, run.stderr);
  const held = JSON.parse(run.stdout);
  assert.deepEqual(Object.keys(held).sort(), ["proofs", "shared", "unnamed", "unproven"]);
  assert.deepEqual([held.unproven.count, held.unnamed.count, held.shared.count], [2, 2, 1]);
  assert.deepEqual(held.unnamed.files.map((one) => one.path), ["tests/deep/big.test.mjs", "tests/small.test.mjs"]);
  assert.deepEqual(held.shared.cases[0].criteria, ["AC-01-1-1", "AC-01-1-2"]);
});

test("a project that set no test root is told the call that sets it, and still gets the other two lists", async () => {
  const run = await proofs(checkout("unset", { tests: null }));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^Unnamed test files: not read — tests\.root and tests\.pattern not set in .*: forge doctor --set tests\.root=<path>, forge doctor --set tests\.pattern=<pattern>$/mu, run.stdout);
  assert.match(run.stdout, /^Unproven criteria: 2$/mu, run.stdout);
  assert.match(run.stdout, /^Shared cases: 1$/mu, run.stdout);
  const half = await proofs(checkout("half", { tests: { root: "tests" } }));
  assert.match(half.stdout, /^Unnamed test files: not read — tests\.pattern not set in .*: forge doctor --set tests\.pattern=<pattern>$/mu, half.stdout);
});

test("a tree no criterion of which carries a Proof prints one line and no list", async () => {
  const room = checkout("bare", { rows: ["Nothing proved here.\n"] });
  const run = await proofs(room);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, "No criterion under docs/requirements/ carries a Proof line, so there is nothing to read backwards.\n");
});

test("forge doctor --set refuses a test pattern holding a slash", async () => {
  const room = checkout("pattern");
  const run = await ranAsync(FORGE, ["doctor", "--set", "tests.pattern=unit/*.test.mjs"], tracker.env, room);
  assert.notEqual(run.status, 0, run.stdout);
  assert.match(run.stderr, /`tests\.pattern` in .* is a file-name pattern with no slash in it/u, run.stderr);
});

test("forge doctor --set refuses a test root that is absolute or leaves the checkout", async () => {
  const room = checkout("root");
  for (const root of ["/abs/tests", "../elsewhere", "tests/../.."]) {
    const run = await ranAsync(FORGE, ["doctor", "--set", `tests.root=${root}`], tracker.env, room);
    assert.notEqual(run.status, 0, `${root}: ${run.stdout}`);
    assert.match(run.stderr, /`tests\.root` in .* is a directory relative to the checkout that stays inside it/u, run.stderr);
  }
});

test("a test root that is a link out of the checkout is reported unread, and nothing outside it is listed", async () => {
  const outside = tempRoom("spec-proofs-outside-");
  put(outside, "stray.test.mjs", cases(3));
  const room = checkout("linked", { tests: { root: "linked", pattern: "*.test.mjs" } });
  symlinkSync(outside, join(room, "linked"));
  const run = await proofs(room);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^Unnamed test files: not read — tests\.root names linked, which is no directory inside /mu, run.stdout);
  assert.ok(!run.stdout.includes("stray.test.mjs"), run.stdout);
});
