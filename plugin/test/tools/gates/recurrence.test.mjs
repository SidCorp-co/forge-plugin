/* What a recurring suite-interaction finding reaches, through the real filing route and the real
   transport against a server of this case's own. Ruled 2026-09-09 (ISS-925): such a finding files
   and refuses nothing, and identity is what decides between filing again and commenting. Driven in
   a subprocess so the settings this CLI memoises are that run's own. */
import assert from "node:assert/strict";
import test from "node:test";

import { bodyFor, markerFor, titleFor } from "../../../../tools/gates/recurrence.mjs";
import { DEFAULT_OVERLAP_THRESHOLD } from "../../../hooks/vendor/text-overlap.js";
import { duplicateOf } from "../../../src/tracker/issue-shape.mjs";
import { fakeTracker, ranAsync, shortPage } from "../../fixtures.mjs";

const ROOT = new URL("../../../..", import.meta.url).pathname;
const MODULE = new URL("../../../../tools/gates/recurrence.mjs", import.meta.url).href;

const DRIVER = `import { fileRecurrences } from ${JSON.stringify(MODULE)};
const said = await fileRecurrences(JSON.parse(process.env.RECURRENCE));
console.log(JSON.stringify(said.named.map(({ key, how, why }) => ({ key, how, why }))));
console.error(said.lines.join("\\n"));`;

const FILE = "plugin/test/flow/lease.test.mjs";
const NAME = "a lease is renewed once per command";
const OTHER = { file: FILE, name: "a lease is renewed once per command and again" };

const finding = (over = {}) => ({
  step: "test",
  digest: "a1b2c3d4e5f6",
  at: "2026-09-09T18:00:00.000Z",
  one: { file: FILE, name: NAME, whole: false, inside: [] },
  before: { digest: "a1b2c3d4e5f6", at: "2026-09-09T17:00:00.000Z", file: FILE, name: NAME },
  ...over,
});

const KEY = "ISS-9001";

const openIssue = (one, over = {}) => ({
  documentId: `doc-${one.name.length}`,
  issueId: "ISS-8000",
  title: titleFor(one),
  status: "open",
  ...over,
});

const drove = async (state, found) => {
  const tracker = await fakeTracker(state);
  try {
    const said = await ranAsync(process.execPath, ["--input-type=module", "-e", DRIVER],
      { ...tracker.env, RECURRENCE: JSON.stringify(found) }, ROOT);
    return { ...said, named: JSON.parse(said.stdout.trim().split("\n")[0]) };
  } finally {
    tracker.close();
  }
};

const creates = (state) => (state.calls ?? [])
  .filter((one) => one.method === "POST" && /\/issues$/u.test(one.path)).map((one) => one.sent);

const comments = (state) => (state.calls ?? [])
  .filter((one) => one.method === "POST" && /\/comments$/u.test(one.path)).map((one) => one.sent);

test("a recurrence with nothing open for it is filed as a bug carrying the case, both times and that it passed alone", async () => {
  const state = { issues: [], calls: [], key: KEY };
  const said = await drove(state, [finding()]);
  assert.deepEqual(said.named, [{ key: KEY, how: "filed", why: null }], said.stderr);
  const [sent] = creates(state);
  assert.ok(sent, `no issue was created: ${said.stderr}`);
  assert.equal(sent.category, "bug");
  assert.ok(sent.title.includes(markerFor(finding().one)), sent.title);
  for (const want of ["## What happened", "## Why it happens", "## Outcome", "## Rules",
    "## Out of scope", "## Where", FILE, NAME, "test", "a1b2c3d4e5f6",
    "2026-09-09T18:00:00.000Z", "2026-09-09T17:00:00.000Z", "reproduced alone: no"]) {
    assert.ok(sent.description.includes(want), `${want} is not in the body:\n${sent.description}`);
  }
  assert.match(said.stderr, /filed as ISS-9001/u, said.stderr);
});

test("an earlier attribution recorded before the field existed is said to be unrecorded, never guessed", async () => {
  const state = { issues: [], calls: [], key: KEY };
  const before = { digest: "a1b2c3d4e5f6", file: FILE, name: NAME };
  const said = await drove(state, [finding({ before })]);
  assert.equal(said.named[0].key, KEY, said.stderr);
  const [sent] = creates(state);
  assert.ok(sent.description.includes("the attribution before it: not recorded, the row predating the field"),
    sent.description);
});

test("the body is a function of the finding alone, so nothing of the machine it ran on reaches it", async () => {
  const state = { issues: [], calls: [], key: KEY };
  await drove(state, [finding()]);
  const [sent] = creates(state);
  assert.equal(sent.description, bodyFor({ ...finding(), settled: null }));
  assert.ok(!/(?:^|[\s(`])\/[a-z]/u.test(sent.description),
    `an absolute path reached the body:\n${sent.description}`);
});

test("a second recurrence of one case comments on that case's issue and files nothing", async () => {
  const one = finding().one;
  const state = { issues: [openIssue(one)], calls: [], key: KEY };
  const said = await drove(state, [finding()]);
  assert.deepEqual(said.named, [{ key: "ISS-8000", how: "commented", why: null }], said.stderr);
  assert.equal(creates(state).length, 0, JSON.stringify(creates(state)));
  const [sent] = comments(state);
  assert.ok(sent.body.includes("failed in the suite and passed alone again"), sent.body);
  assert.ok(sent.body.includes("2026-09-09T18:00:00.000Z"), sent.body);
});

/* Containment of the marker is equality of the identity, which is what the brackets are for: the
   shorter name is inside the longer one and the marker carrying it is not. */
test("a case whose name is a prefix of another's in the same file reaches its own issue", async () => {
  const state = { issues: [openIssue(OTHER)], calls: [], key: KEY };
  const said = await drove(state, [finding()]);
  assert.deepEqual(said.named, [{ key: KEY, how: "filed", why: null }], said.stderr);
  assert.equal(comments(state).length, 0, JSON.stringify(comments(state)));
});

/* Why `duplicates: false` is not an optimisation: every finding's title is this one template and a
   digest, and a digest is no content word, so any two of them read as the same filing. Measured
   here rather than remembered, because the day it stops being true is the day the flag can go. */
test("two findings' titles read as one another to the duplicate check, which is why it is off", () => {
  const mine = { title: titleFor(finding().one), body: "" };
  const theirs = [{ issueId: "ISS-8000", title: titleFor(OTHER) }];
  const found = duplicateOf(mine, theirs);
  assert.ok(found && found.score >= DEFAULT_OVERLAP_THRESHOLD,
    `two distinct findings no longer collide, at ${JSON.stringify(found)}`);
});

test("a finding whose title reads like a live issue for another case is filed all the same", async () => {
  const state = { issues: [openIssue(OTHER)], calls: [], key: KEY };
  const said = await drove(state, [finding()]);
  assert.equal(said.named[0].how, "filed", said.stderr);
  assert.ok(creates(state)[0].title.includes(markerFor(finding().one)), creates(state)[0].title);
});

test("a recurrence whose issue somebody closed is filed again, and the body names the settled one", async () => {
  const one = finding().one;
  for (const status of ["closed", "dropped"]) {
    const state = { issues: [openIssue(one, { status, issueId: "ISS-8001" })], calls: [], key: KEY };
    const said = await drove(state, [finding()]);
    assert.deepEqual(said.named, [{ key: KEY, how: "filed", why: null }], said.stderr);
    const [sent] = creates(state);
    assert.ok(sent.description.includes(`ISS-8001, is \`${status}\``), sent.description);
  }
});

test("an issue that will not take the comment leaves a reason and the command that files by hand", async () => {
  const one = finding().one;
  const state = { issues: [openIssue(one)], calls: [], key: KEY,
    answer: { forge_comments: () => ({ refused: "Error: the comment was not accepted" }) } };
  const said = await drove(state, [finding()]);
  assert.equal(said.named[0].key, null, said.stderr);
  assert.match(said.named[0].why, /ISS-8000 would not take a comment/u);
  assert.match(said.stderr, /the filing could not be made: ISS-8000 would not take a comment/u, said.stderr);
  assert.match(said.stderr, /file it by hand, the body being the block below: forge new - --title /u, said.stderr);
  assert.ok(said.stderr.includes(`--category bug`), said.stderr);
});

/* A case closed once and filed again carries the marker twice, and only one of the two is where the
   next attribution belongs. Order is the route's, so the live one is chosen and not found. */
test("a case with a closed issue and a live one beside it comments on the live one", async () => {
  const one = finding().one;
  const state = { calls: [], key: KEY, issues: [
    openIssue(one, { documentId: "doc-closed", issueId: "ISS-8001", status: "closed" }),
    openIssue(one, { documentId: "doc-live", issueId: "ISS-8002", status: "in_progress" }),
  ] };
  const said = await drove(state, [finding()]);
  assert.deepEqual(said.named, [{ key: "ISS-8002", how: "commented", why: null }], said.stderr);
  assert.equal(creates(state).length, 0, JSON.stringify(creates(state)));
});

/* One page is not the backlog: the lookup is asserted to page, because a lookup that reads the
   first page and stops files a second issue for a case that already has one on every run after. */
test("the lookup pages to the end, so a match past the first page is still found", async () => {
  const one = finding().one;
  const state = { calls: [], key: KEY, page: 1, issues: [
    { documentId: "doc-other", issueId: "ISS-8003", title: titleFor(OTHER), status: "open",
      description: `an issue of its own that happens to quote ${markerFor(one)}` },
    openIssue(one, { documentId: "doc-live", issueId: "ISS-8002" }),
  ] };
  const said = await drove(state, [finding()]);
  const asked = (state.calls ?? []).filter((each) => /\/issues\/search$/u.test(each.path));
  assert.ok(asked.length > 1, `the lookup read one page and stopped: ${JSON.stringify(asked)}`);
  assert.ok(asked.some((each) => each.query.offset === "1"),
    `no page past the first was asked for: ${JSON.stringify(asked.map((each) => each.query))}`);
  assert.deepEqual(said.named, [{ key: "ISS-8002", how: "commented", why: null }], said.stderr);
  assert.equal(creates(state).length, 0, JSON.stringify(creates(state)));
});

// A reading that could not finish is a ceiling and not an absence, so nothing is filed against it.
test("a lookup that does not come back whole files nothing, says so, and refuses nothing", async () => {
  const state = { calls: [], key: KEY, issues: [],
    answer: { forge_issues: shortPage([], 5) } };
  const said = await drove(state, [finding()]);
  assert.equal(said.named[0].key, null, said.stderr);
  assert.match(said.named[0].why, /did not come back whole/u);
  assert.equal(creates(state).length, 0, JSON.stringify(creates(state)));
  assert.equal(said.status, 0, said.stderr);
  assert.match(said.stderr, /file it by hand, the body being the block below: forge new - --title /u, said.stderr);
});

/* One at a time, asserted through the order the calls arrived in rather than through their count:
   run together, the second finding's lookup could not see what the first one filed. */
test("two findings are filed one at a time, the second's lookup coming after the first's filing", async () => {
  const state = { issues: [], calls: [], key: KEY };
  const said = await drove(state, [finding(), finding({ one: { ...OTHER, whole: false, inside: [] } })]);
  assert.equal(said.named.length, 2, said.stderr);
  const sent = creates(state);
  assert.equal(sent.length, 2, JSON.stringify(sent.map((one) => one.title)));
  assert.notEqual(sent[0].title, sent[1].title);
  const order = (state.calls ?? []).flatMap((each, at) =>
    (/\/issues\/search$/u.test(each.path) ? [["looked", at]]
      : each.method === "POST" && /\/issues$/u.test(each.path) ? [["filed", at]] : []));
  assert.deepEqual(order.map(([what]) => what), ["looked", "filed", "looked", "filed"],
    JSON.stringify(state.calls.map((each) => `${each.method} ${each.path}`)));
});
