/* Every matching row is in hand before anything prints, so the cut this verb makes is the printed one and the offset that moves it is printed too; 450 rows against a route serving them whole (ISS-1150). */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, projectRecord, ranAsync } from "../../fixtures.mjs";
import { OWN } from "../../fixtures/own-project.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../../..", import.meta.url).pathname;
const COUNT = 450;

const at = (number) => ({
  issueId: `ISS-${number}`,
  documentId: `u-${number}`,
  status: "open",
  priority: "medium",
  title: `issue ${number} of the backlog`,
  createdAt: new Date(Date.UTC(2026, 0, 1) + number * 1000).toISOString(),
});

/* One priority and a rising stamp, so the rank the verb prints in is the fixture's own order. */
const BACKLOG = Array.from({ length: COUNT }, (one, index) => at(index + 1));

const state = { issues: BACKLOG, comments: {}, calls: [], answer: {} };
const tracker = await fakeTracker(state);

/* Every call here runs from this checkout, whose project is this machine's record of it now:
   the record goes under the one configuration home the children are handed. */
const ENV = { ...tracker.env, HOME: tracker.env.XDG_CONFIG_HOME };
projectRecord(new URL("../../../../", import.meta.url).pathname, tracker.env.XDG_CONFIG_HOME,
  OWN);
test.after(() => tracker.close());

const ran = (argv) => ranAsync(FORGE, argv, ENV, ROOT, null);
const keysIn = (text) => text.split("\n").map((line) => /^(ISS-\d+)\s/u.exec(line)?.[1]).filter(Boolean);
const footerOf = (text) => text.split("\n").at(-2)?.trim() ?? "";

test("a page past the first is reached by offset, and the footer says the call that reaches it", async () => {
  const first = await ran(["issue"]);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(keysIn(first.stdout).length, 200);
  assert.match(first.stdout, /200 of 450 issue\(s\)/u);
  assert.match(first.stdout, /The 250 behind this page are the tail of the order above, and this call prints the next page of them:/u,
    "250 behind and 200 in a page: the call prints the next page of the tail and not the whole of it");
  assert.equal(footerOf(first.stdout), "forge issue --offset 200");

  const second = await ran(["issue", "--offset", "200"]);
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(keysIn(second.stdout), BACKLOG.slice(200, 400).map((one) => one.issueId));
  assert.match(second.stdout, /201 to 400 of 450 issue\(s\)/u);
  assert.equal(footerOf(second.stdout), "forge issue --offset 400");
});

test("the last page names no next call, because there is none", async () => {
  const last = await ran(["issue", "--offset", "400"]);
  assert.deepEqual(keysIn(last.stdout), BACKLOG.slice(400).map((one) => one.issueId));
  assert.match(last.stdout, /401 to 450 of 450 issue\(s\) over \d+ page\(s\), which is every row matching this ask\./u);
  assert.doesNotMatch(last.stdout, /--offset 450/u);
});

/* A caller walking pages stops on an empty one, so an error there makes the ordinary loop look like a failure. */
test("an offset past the last row answers empty and successfully, saying the walk ended", async () => {
  const past = await ran(["issue", "--offset", "450"]);
  assert.equal(past.status, 0, past.stderr);
  assert.deepEqual(keysIn(past.stdout), []);
  assert.match(past.stdout, /Nothing at offset 450: 450 issue\(s\) match this ask over \d+ page\(s\), the last of them at offset 449/u);

  const none = await ran(["issue", "--search", "nothing here matches this", "--offset", "1"]);
  assert.equal(none.status, 0, none.stderr);
  assert.match(none.stdout, /Nothing at offset 1: nothing matches this ask at all/u);
  assert.doesNotMatch(none.stdout, /last of them at offset/u, "an empty set has no last row to name");
});

test("a walk by offset reads every row once and no row twice", async () => {
  const read = [];
  for (let offset = 0; offset < COUNT + 200; offset += 200) {
    const page = await ran(["issue", "--offset", String(offset)]);
    read.push(...keysIn(page.stdout));
  }
  assert.equal(read.length, COUNT, "the walk read a different number of rows than the set holds");
  assert.equal(new Set(read).size, COUNT, "a key came back on two pages");
  assert.deepEqual(read, BACKLOG.map((one) => one.issueId));
});

/* A footer naming only the offset would send a reader to the unfiltered backlog. */
test("the next call carries the filters this one was given, quoted where a shell would split them", async () => {
  const found = await ran(["issue", "--search", "of the"]);
  assert.equal(found.status, 0, found.stderr);
  assert.equal(footerOf(found.stdout), "forge issue --search 'of the' --offset 200");
});

test("the limit keeps its ceiling, and the offset takes none", async () => {
  const over = await ran(["issue", "--limit", "201"]);
  assert.equal(over.status, 1);
  assert.match(over.stderr, /--limit takes an integer from 1 to 200/u);

  const under = await ran(["issue", "--offset", "-1"]);
  assert.equal(under.status, 1);
  assert.match(under.stderr, /--offset takes an integer from 0 up/u);
});

/* Each call of this verb hands the parser its own text, so one's flag is refused as that call's (ISS-932). */
test("an offset beside a key is refused as the list call's flag", async () => {
  const beside = await ran(["issue", "ISS-3", "--offset", "3"]);
  assert.equal(beside.status, 1);
  assert.match(beside.stderr, /--offset belongs to another call of this verb/u);
});
