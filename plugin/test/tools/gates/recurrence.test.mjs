/* What a recurring suite-interaction finding reaches, through the real filing route and the real
   transport against a server of this case's own. Ruled 2026-09-09 (ISS-925): such a finding files
   and refuses nothing, and identity is what decides between filing again and commenting. Driven in
   a subprocess so the settings this CLI memoises are that run's own. */
import assert from "node:assert/strict";
import test from "node:test";
import { bodyFor, markerFor, passMarkerFor, passTitleFor, titleFor } from "../../../../tools/gates/recurrence.mjs";
import { DEFAULT_OVERLAP_THRESHOLD } from "../../../hooks/vendor/text-overlap.js";
import { duplicateOf } from "../../../src/tracker/issue-shape.mjs";
import { fakeTracker, projectRecord, ranAsync, shortPage } from "../../fixtures.mjs";
import { OWN } from "../../fixtures/own-project.mjs";

const ROOT = new URL("../../../..", import.meta.url).pathname;
const MODULE = new URL("../../../../tools/gates/recurrence.mjs", import.meta.url).href;

const DRIVER = `import { fileRecurrences, reachedBy } from ${JSON.stringify(MODULE)};
const found = JSON.parse(process.env.RECURRENCE);
const said = await fileRecurrences(found);
console.log(JSON.stringify(said.named.map(({ key, how, why }) => ({ key, how, why }))));
console.log(JSON.stringify(found.map((one) => reachedBy(said.named, one))));
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
  /* The filing is project-scoped and the driver stands in this checkout, so this machine's record of
     this project goes under the configuration home that fixture hands the child. */
  projectRecord(ROOT, tracker.env.XDG_CONFIG_HOME, OWN);
  try {
    const said = await ranAsync(process.execPath, ["--input-type=module", "-e", DRIVER],
      { ...tracker.env, RECURRENCE: JSON.stringify(found) }, ROOT);
    const [named, reached] = said.stdout.trim().split("\n");
    return { ...said, named: JSON.parse(named), reached: JSON.parse(reached) };
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

/* Asserted through the order the calls arrived in rather than through their count: a filing sent
   before its lookup would file beside a row it had not read. */
test("two findings cost one lookup and one filing, the filing coming after the lookup", async () => {
  const state = { issues: [], calls: [], key: KEY };
  const said = await drove(state, [finding(), OTHER_FINDING()]);
  assert.equal(said.named.length, 2, said.stderr);
  const sent = creates(state);
  assert.equal(sent.length, 1, JSON.stringify(sent.map((one) => one.title)));
  const order = (state.calls ?? []).flatMap((each) =>
    (/\/issues\/search$/u.test(each.path) ? ["looked"]
      : each.method === "POST" && /\/issues$/u.test(each.path) ? ["filed"] : []));
  assert.deepEqual(order, ["looked", "filed"],
    JSON.stringify(state.calls.map((each) => `${each.method} ${each.path}`)));
});

/* One cause reddening twenty-seven cases filed twenty-seven rows, all of one pass, and the run that
   filed them could see they arrived together (ISS-2251). The grouping key is the step and the
   content, never the text of the cases, and the per-case marker the row lists is not replaced. */

const OTHER_FINDING = () => finding({ one: { ...OTHER, whole: false, inside: [] } });

const groupIssue = (over = {}) => ({
  documentId: "doc-group",
  issueId: "ISS-8000",
  title: passTitleFor([finding()]),
  status: "open",
  ...over,
});

test("a pass of two findings files one issue carrying both cases and both per-case markers", async () => {
  const state = { issues: [], calls: [], key: KEY };
  const said = await drove(state, [finding(), OTHER_FINDING()]);
  assert.deepEqual(said.named,
    [{ key: KEY, how: "filed", why: null }, { key: KEY, how: "filed", why: null }], said.stderr);
  const sent = creates(state);
  assert.equal(sent.length, 1, JSON.stringify(sent.map((one) => one.title)));
  assert.ok(sent[0].title.includes(passMarkerFor(finding())), sent[0].title);
  for (const want of [NAME, OTHER.name, FILE, "a1b2c3d4e5f6",
    markerFor(finding().one), markerFor(OTHER)]) {
    assert.ok(sent[0].description.includes(want), `${want} is not in the body:\n${sent[0].description}`);
  }
});

test("the verdict block names the one issue a grouped pass reached beside every case of it", async () => {
  const state = { issues: [groupIssue()], calls: [], key: KEY };
  const said = await drove(state, [finding(), OTHER_FINDING()]);
  assert.deepEqual(said.reached, ["  → ISS-8000, commented", "  → ISS-8000, commented"], said.stderr);
});

/* The membership drifts as a cause is partly fixed, and the row it drifted from is still the row:
   keying on the cases would file a second one on the run after the first case was mended. */
test("a later pass at the same step and content comments on the row an earlier one filed", async () => {
  const state = { issues: [groupIssue()], calls: [], key: KEY };
  const said = await drove(state, [finding(), OTHER_FINDING()]);
  assert.deepEqual(said.named,
    [{ key: "ISS-8000", how: "commented", why: null }, { key: "ISS-8000", how: "commented", why: null }],
    said.stderr);
  assert.equal(creates(state).length, 0, JSON.stringify(creates(state)));
  assert.equal(comments(state).length, 1, JSON.stringify(comments(state)));
  assert.ok(comments(state)[0].body.includes(markerFor(OTHER)), comments(state)[0].body);
});

test("a case with no issue of its own comments on the grouped row for its step and content", async () => {
  const state = { issues: [groupIssue()], calls: [], key: KEY };
  const said = await drove(state, [finding()]);
  assert.deepEqual(said.named, [{ key: "ISS-8000", how: "commented", why: null }], said.stderr);
  assert.equal(creates(state).length, 0, JSON.stringify(creates(state)));
});

test("a case whose own issue is settled reaches the grouped row rather than filing a second time", async () => {
  const one = finding().one;
  const state = { calls: [], key: KEY, issues: [
    openIssue(one, { documentId: "doc-closed", issueId: "ISS-8001", status: "closed" }),
    groupIssue({ issueId: "ISS-8002" }),
  ] };
  const said = await drove(state, [finding()]);
  assert.deepEqual(said.named, [{ key: "ISS-8002", how: "commented", why: null }], said.stderr);
  assert.equal(creates(state).length, 0, JSON.stringify(creates(state)));
});

/* The case's own row first and the pass's behind it: a case with a home belongs there, and only a
   case with none belongs with the pass it was attributed in. */
test("a case with a live issue of its own comments there and not on the grouped row", async () => {
  const one = finding().one;
  const state = { calls: [], key: KEY, issues: [openIssue(one), groupIssue({ issueId: "ISS-8002" })] };
  const said = await drove(state, [finding()]);
  assert.deepEqual(said.named, [{ key: "ISS-8000", how: "commented", why: null }], said.stderr);
  assert.equal(creates(state).length, 0, JSON.stringify(creates(state)));
});

test("a pass whose grouped row somebody closed is filed again, and the body names the settled one", async () => {
  const state = { issues: [groupIssue({ issueId: "ISS-8003", status: "closed" })], calls: [], key: KEY };
  const said = await drove(state, [finding(), OTHER_FINDING()]);
  assert.deepEqual(said.named.map((each) => each.key), [KEY, KEY], said.stderr);
  const [sent] = creates(state);
  assert.ok(sent.description.includes("An earlier issue this finding reaches, ISS-8003, is `closed`"),
    sent.description);
  assert.ok(!sent.description.includes("this same case"), sent.description);
});

test("a pass of two whose lookup does not come back whole files nothing", async () => {
  const state = { calls: [], key: KEY, issues: [], answer: { forge_issues: shortPage([], 5) } };
  const said = await drove(state, [finding(), OTHER_FINDING()]);
  assert.deepEqual(said.named.map((each) => each.key), [null, null], said.stderr);
  assert.equal(creates(state).length, 0, JSON.stringify(creates(state)));
});

test("a pass of two that could not be filed says why, once", async () => {
  const state = { calls: [], key: KEY, issues: [], answer: { forge_issues: shortPage([], 5) } };
  const said = await drove(state, [finding(), OTHER_FINDING()]);
  assert.match(said.named[0].why, /did not come back whole/u);
  assert.equal(said.stderr.match(/the filing could not be made:/gu)?.length, 1, said.stderr);
});

test("a pass of two that could not be filed prints the command that files it by hand", async () => {
  const state = { calls: [], key: KEY, issues: [], answer: { forge_issues: shortPage([], 5) } };
  const said = await drove(state, [finding(), OTHER_FINDING()]);
  assert.ok(said.stderr.includes(`forge new - --title ${JSON.stringify(passTitleFor([finding()]))}`),
    said.stderr);
  assert.ok(said.stderr.includes("--category bug"), said.stderr);
});
