/* `forge spec proofs` spawned in a checkout of its own, against a tracker fixture: what is under test
   is what reaches the terminal, the exit it ends on, which configuration it read and what it leaves
   on disk, none of which a call to the reading can show. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { proofProblems } from "../../src/spec/claims/proof.mjs";
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

/* Every file under a directory with its bytes and its time, so a run that wrote anything — a new
   file, a changed one, one touched and left equal — reads as a difference. */
const snapshot = (dir) => {
  const held = {};
  const walk = (at) => {
    for (const one of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, one.name);
      if (one.isDirectory()) walk(path);
      else held[relative(dir, path)] = `${statSync(path).mtimeMs} ${readFileSync(path, "base64")}`;
    }
  };
  walk(dir);
  return held;
};

/* R-19's two bases, as the spec gate is handed them in proof-cases.test.mjs. */
const gateRead = (room) => (path, from = "") => {
  for (const one of [join(room, dirname(from), path), join(room, path)]) {
    if (existsSync(one)) return readFileSync(one, "utf8");
  }
  return null;
};

test("forge spec proofs reads each Proof line as the spec gate does, at every read, and leaves nothing on disk", async () => {
  const QUOTED = 'says "hi" back';
  const rows = (beside) => [
    criterion("AC-01-1-1", `tests/quoted.test.mjs "${QUOTED}"`),
    criterion("AC-01-1-2", `tests/quoted.test.mjs "${QUOTED}"`),
    criterion("AC-01-1-3", `../../../tests/${beside}.test.mjs "case 0"`),
  ];
  const room = checkout("parity", { rows: rows("small") });
  put(room, "tests/quoted.test.mjs", `test('${QUOTED}', () => {});\n`);
  const tree = "docs/requirements/srs/fr-01-x.md";
  const documents = () => [{ file: tree, text: readFileSync(join(room, tree), "utf8") }];
  assert.deepEqual(proofProblems(documents(), gateRead(room)), [], "the spec gate accepts every Proof line of the fixture");
  assert.notEqual(/"([^"]*)"/u.exec(`"${QUOTED}"`)[1], QUOTED, "and a parser taking the first quoted span would misread the name");
  const before = { room: snapshot(room), home: snapshot(HOME) };
  const first = await proofs(room, "--json");
  assert.equal(first.status, 0, first.stderr);
  const read = JSON.parse(first.stdout);
  assert.deepEqual(read.shared.cases, [{ path: "tests/quoted.test.mjs", name: QUOTED, criteria: ["AC-01-1-1", "AC-01-1-2"] }]);
  assert.deepEqual(read.unnamed.files.map((one) => one.path), ["tests/deep/big.test.mjs", "tests/a.test.mjs"],
    "the path written from the document's own directory names tests/small.test.mjs, as the gate resolved it");
  assert.deepEqual(snapshot(room), before.room, "the run left the checkout as it found it");
  assert.deepEqual(snapshot(HOME), before.home, "and the configuration home as it found it");
  put(room, tree, `## UC-01-1 — A use case\n\nRev: 1\n\n${rows("deep/big").join("")}`);
  const second = JSON.parse((await proofs(room, "--json")).stdout);
  assert.deepEqual(second.unnamed.files.map((one) => one.path), ["tests/small.test.mjs", "tests/a.test.mjs"],
    "a second read after the tree moved reads the tree it moved to");
});
