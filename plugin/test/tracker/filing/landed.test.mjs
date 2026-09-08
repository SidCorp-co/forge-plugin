/* The last line of a reply that wrote. Two ladders, and what makes them worth having is the rung
   that stays quiet: a read that could not run must leave a landed write at exit zero, because a
   caller told a write failed sends it again. So every unverified rung is watched as hard as the
   refusal is, and the refusal is watched firing. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempHome } from "../../fixtures.mjs";

const state = { issues: [], comments: {}, calls: [], memory: {}, answer: {} };
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

/* Set before the modules load: `settings()` resolves the endpoint out of this directory once. */
process.env.XDG_CONFIG_HOME = tracker.env.XDG_CONFIG_HOME;
const { commentLanded, issueLanded, sayLanded } = await import("../../../src/tracker/filing/landed.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const room = tempHome("landed").path;

const ISSUE = { issueId: "ISS-800", documentId: "uuid-800", status: "open", title: "the reply of a write names what it wrote" };
const NEAR = { issueId: "ISS-801", documentId: "uuid-801", status: "open", title: "a neighbour that names plugin/src/tracker/filing/route.mjs" };

const before = () => {
  state.issues = [ISSUE, NEAR];
  state.comments = {};
  state.calls = [];
  state.memory = {};
  state.answer = {};
  delete state.mint;
  delete state.key;
};

const lastOf = (text) => text.trimEnd().split("\n").at(-1);

// ---------------------------------------------------------------- the issue ladder

test("an issue read back at the id the create answered with is verified, and the key is the read's", async () => {
  before();
  /* The echo says one key and the stored row another: only a reply reading the row prints ISS-802. */
  state.answer = { forge_issues: () => ({ documentId: "uuid-802", issueId: "ISS-802" }) };
  const landed = await issueLanded({ documentId: "uuid-802", issueId: "ISS-echoed" });
  assert.match(landed.line, /^ISS-802 is filed at uuid-802, read back from the tracker\.$/u);
});

/* Absence is said and never refused: every fake tracker in this tree, and every stub inside a
   suite, answers a create without storing it, so an id that reads back as nothing is as often the
   reader as the write — and a caller told a landed write failed sends it again. */
test("an id that reads back as the empty object is said, and refuses nothing", async () => {
  before();
  state.answer = { forge_issues: (args) => (args.action === "get" ? {} : { documentId: "uuid-803" }) };
  const landed = await issueLanded({ documentId: "uuid-803" });
  assert.match(landed.line, /came back with no issue/u);
  assert.match(landed.line, /Do not send this call again/u);
});

test("a read-back the tool refuses is unverified, and says not to send the call again", async () => {
  before();
  state.answer = { forge_issues: (args) => (args.action === "get" ? { refused: "not your project" } : {}) };
  const landed = await issueLanded({ documentId: "uuid-804" });
  assert.match(landed.line, /uuid-804/u, "the id is named whatever the read did");
  assert.match(landed.line, /the read-back could not run:.*not your project/u);
  assert.match(landed.line, /Do not send this call again/u);
});

test("a read-back whose transport fails is unverified too", async () => {
  before();
  state.answer = { forge_issues: (args) => (args.action === "get" ? { http: 502 } : {}) };
  const landed = await issueLanded({ documentId: "uuid-805" });
  assert.match(landed.line, /the read-back could not run/u);
});

/* A 200 whose body is not a record is what a proxy in front of the tracker answers with, and it is
   the one answer that must not be projected: an empty page built out of HTML reads as the tracker
   saying the row is not there, and the reply of a write that landed would say so. */
test("a read-back answered with something that is not a record is unverified", async () => {
  before();
  state.answer = { forge_issues: (args) => (args.action === "get" ? { notARecord: "<html>502</html>" } : {}) };
  const landed = await issueLanded({ documentId: "uuid-809" });
  assert.match(landed.line, /uuid-809 and the read-back could not run/u);
  assert.match(landed.line, /answered 200 with no record/u, "and what it answered with instead");
  assert.doesNotMatch(landed.line, /came back with no issue/u, "never as the tracker denying the row");
});

test("a comment page answered with something that is not a record is unverified too", async () => {
  before();
  state.answer = { forge_comments: () => ({ notARecord: "<html>502</html>" }) };
  const landed = await commentLanded("uuid-800", { documentId: "c-9" }, "ISS-800");
  assert.match(landed.line, /the read-back could not run/u);
});

/* A refusal is joined with newlines where the tracker names more than one field, and the id sits
   on the first of them: the last physical line would name nothing at all. */
test("a refusal carrying newlines is put on one line, so the id stays on the last one", async () => {
  before();
  state.answer = { forge_issues: (args) => (args.action === "get" ? { refused: "first\nsecond\nthird" } : {}) };
  const landed = await issueLanded({ documentId: "uuid-813" });
  assert.equal(landed.line.split("\n").length, 1, "one line, whatever the tracker sent");
  assert.match(landed.line, /uuid-813 and the read-back could not run:.*first second third\./u);
});

test("a non-empty answer that does not carry the id asked for is unverified, not absence", async () => {
  before();
  state.answer = { forge_issues: () => ({ documentId: "uuid-somethingelse", issueId: "ISS-999" }) };
  const landed = await issueLanded({ documentId: "uuid-806" });
  assert.match(landed.line, /answered about something else/u);
});

test("a create answered with no id reads nothing back at all", async () => {
  before();
  const landed = await issueLanded({ issueId: "ISS-808" });
  assert.match(landed.line, /answered this filing with no id, only the key ISS-808/u);
  assert.equal(state.calls.length, 0, "no read is made for an id that does not exist");
});

// -------------------------------------------------------------- the comment ladder

const page = (comments, hasMore) => ({ comments, returned: comments.length, hasMore });

test("a comment found on its target's page is verified", async () => {
  before();
  state.answer = { forge_comments: () => page([{ documentId: "c-1" }, { documentId: "c-2" }], false) };
  const landed = await commentLanded("uuid-800", { documentId: "c-2" }, "ISS-800");
  assert.equal(landed.line, "Comment c-2 is posted on ISS-800, read back from the tracker.");
});

/* The reader walks the thread, so this is a tracker reporting more behind a page and naming no
   cursor to reach it: absence there is a read that stopped short and never a comment that is gone. */
test("a comment absent from a thread the walk could not finish is unverified, never absent", async () => {
  before();
  state.answer = { forge_comments: () => page([{ documentId: "c-1" }], true) };
  const landed = await commentLanded("uuid-800", { documentId: "c-9" }, "ISS-800");
  assert.match(landed.line, /the thread could not be read to its end/u);
  assert.match(landed.line, /`forge comment uuid-800`/u, "and the read it asks for is one that exists");
  assert.doesNotMatch(landed.line, /forge_comments/u, "the route for it being the verb's own now");
});

/* `hasMore` absent. Reading it as `!hasMore` would be this reader inferring a whole page, so the
   projection carries the silence through as null and every reader of it says unverified. */
test("a page that asserts nothing about its own completeness is unverified too", async () => {
  before();
  state.answer = { forge_comments: () => ({ comments: [{ documentId: "c-1" }], returned: 1, hasMore: null }) };
  const landed = await commentLanded("uuid-800", { documentId: "c-9" }, "ISS-800");
  assert.match(landed.line, /could not be read to its end/u);
});

test("an answer carrying no comments at all asserts nothing either", async () => {
  before();
  state.answer = { forge_comments: () => ({ ok: true, hasMore: null }) };
  const landed = await commentLanded("uuid-800", { documentId: "c-9" }, "ISS-800");
  assert.match(landed.line, /could not be read to its end/u);
});

test("a comment absent from a thread the tracker calls whole is said, and refuses nothing", async () => {
  before();
  state.answer = { forge_comments: () => page([{ documentId: "c-1" }], false) };
  const landed = await commentLanded("uuid-800", { documentId: "c-9" }, "ISS-800");
  assert.match(landed.line, /which the tracker called whole, does not hold it/u);
  assert.match(landed.line, /Do not send this call again/u);
});

test("a comment page the tool refuses is unverified", async () => {
  before();
  state.answer = { forge_comments: () => ({ refused: "no such issue" }) };
  const landed = await commentLanded("uuid-800", { documentId: "c-9" }, "ISS-800");
  assert.match(landed.line, /the read-back could not run:.*no such issue/u);
});

test("a comment answered with no id reads nothing back", async () => {
  before();
  const landed = await commentLanded("uuid-800", { body: "posted" }, "ISS-800");
  assert.match(landed.line, /answered this comment with no id/u);
  assert.equal(state.calls.length, 0);
});

// ------------------------------------------------------------------- what is printed

test("the line goes to stdout on every outcome, and nothing here ends the process", () => {
  const said = [];
  const held = console.log;
  console.log = (line) => said.push(line);
  try {
    sayLanded({ line: "verified" });
    sayLanded({ line: "unverified" });
    assert.deepEqual(said, ["verified", "unverified"]);
  } finally {
    console.log = held;
  }
});

// ----------------------------------------------------------------------- end to end

const BODY = [
  "## What happened",
  "",
  "A filing reply ended with the neighbour block and never named the key it minted.",
  "",
  "## Why it happens",
  "",
  "`plugin/src/tracker/filing/say.mjs` returns before anything reads the answer's own id back.",
  "",
  "## Where",
  "",
  "`plugin/src/tracker/filing/route.mjs`",
  "",
  "## Outcome",
  "",
  "The last line of a reply that wrote names the id it wrote.",
  "",
  "## Rules",
  "",
  "- The reply's last line names the id, read back from the tracker, or the refusal.",
  "",
  "## Out of scope",
  "",
  "The neighbour scoring and the fold threshold.",
].join("\n");

const TITLE = "the last line of a reply that wrote names the id";
const TRAILER = "Nothing above is a refusal: a duplicate filed anyway is one the filer was shown.";

const bodyFile = (text = BODY) => {
  const path = join(room, "body.md");
  writeFileSync(path, `${text}\n`);
  return path;
};

const stores = () => {
  const posted = [];
  state.answer = {
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      if (args.action === "create") {
        const row = { ...args.data, documentId: "uuid-810", issueId: "ISS-810" };
        state.issues = [...state.issues, row];
        return row;
      }
      return state.issues.find((one) => one.documentId === args.documentId) ?? {};
    },
    forge_comments: (args) => {
      if (args.action !== "list") {
        const row = { documentId: `c-${posted.length + 1}`, ...args.data };
        posted.push(row);
        return row;
      }
      return page(posted.filter((one) => one.issue === args.filters?.issue), false);
    },
  };
  return posted;
};

const both = (key, score) => ({ semantic: [[key, score]], keyword: [[key, 0.0608]] });

test("a filing that lands ends its stdout with the key, read back, and not with the trailer", async () => {
  before();
  stores();
  state.memory = both(NEAR.issueId, 0.72);
  const run = await ranAsync(FORGE, ["new", bodyFile(), "--title", TITLE, "--category", "bug"], tracker.env);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, new RegExp(TRAILER.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
    "the block still prints; what moved is what comes after it");
  assert.equal(lastOf(run.stdout), "ISS-810 is filed at uuid-810, read back from the tracker.");
});

test("a filing the tracker refuses exits non-zero", async () => {
  before();
  state.answer = { forge_issues: (args) => (args.action === "list"
    ? { issues: state.issues, returned: state.issues.length, hasMore: false }
    : (args.action === "create" ? { refused: "title already taken" } : {})) };
  const run = await ranAsync(FORGE, ["new", bodyFile(), "--title", TITLE, "--category", "bug"], tracker.env);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /title already taken/u);
});

test("a filing whose id reads back as nothing stays at exit zero, and says so on the last line", async () => {
  before();
  state.answer = {
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      return args.action === "create" ? { documentId: "uuid-811", issueId: "ISS-811" } : {};
    },
  };
  const run = await ranAsync(FORGE, ["new", bodyFile(), "--title", TITLE, "--category", "bug"], tracker.env);
  assert.equal(run.status, 0, "the tracker took the create; only the read-back came back empty");
  assert.match(lastOf(run.stdout), /uuid-811 and a read of that id came back with no issue/u);
});

test("a filing whose read-back could not run stays at exit zero", async () => {
  before();
  state.answer = {
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      return args.action === "create" ? { documentId: "uuid-812", issueId: "ISS-812" } : { http: 503 };
    },
  };
  const run = await ranAsync(FORGE, ["new", bodyFile(), "--title", TITLE, "--category", "bug"], tracker.env);
  assert.equal(run.status, 0, "a write that landed must not answer like one that did not");
  assert.match(lastOf(run.stdout), /Do not send this call again/u);
});

/* End to end because the hazard is the exit code, and only a spawned verb has one. */
test("a filing whose read-back throws stays at exit zero, and the last line still names the id", async () => {
  before();
  state.answer = {
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      return args.action === "create" ? { documentId: "uuid-814", issueId: "ISS-814" } : { envelope: { content: {} } };
    },
  };
  const run = await ranAsync(FORGE, ["new", bodyFile(), "--title", TITLE, "--category", "bug"], tracker.env);
  assert.equal(run.status, 0, run.stderr);
  assert.match(lastOf(run.stdout), /uuid-814/u);
});

const marked = () => bodyFile(`${BODY}\n\nSize: fix.`);

test("a fold ends its stdout with the comment id it posted", async () => {
  before();
  const posted = stores();
  state.memory = both(NEAR.issueId, 0.83);
  const run = await ranAsync(FORGE, ["new", marked(), "--title", TITLE, "--category", "bug"], tracker.env);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(posted.length, 1, "the fold posted, and no issue was filed");
  assert.equal(lastOf(run.stdout), `Comment ${posted[0].documentId} is posted on ${NEAR.issueId}, read back from the tracker.`);
});

test("a fold whose comment write the tracker refuses exits non-zero", async () => {
  before();
  state.memory = both(NEAR.issueId, 0.83);
  state.answer = { forge_comments: (args) => (args.action === "list" ? page([], false) : { refused: "comment too long" }) };
  const run = await ranAsync(FORGE, ["new", marked(), "--title", TITLE, "--category", "bug"], tracker.env);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /comment too long/u);
});

test("forge comment ends its stdout with the comment id it posted", async () => {
  before();
  stores();
  const env = { ...tracker.env, FORGE_SESSION_ID: "landed-into" };
  const run = await ranAsync(FORGE, ["comment", ISSUE.issueId, bodyFile(), "--title", TITLE], env);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(lastOf(run.stdout), `Comment c-1 is posted on ${ISSUE.issueId}, read back from the tracker.`);
});

/* The three sightings this issue was filed for. The gate refuses once and credits what it
   delivered, so the re-send writes — and the first call is non-zero with nothing sent. */
test("a comment held by the read-before-write gate exits non-zero and sends no create", async () => {
  before();
  stores();
  state.comments = { [ISSUE.documentId]: [{ documentId: "c-old", body: "read me first", createdAt: "2026-09-01T00:00:00Z" }] };
  state.answer = { forge_comments: (args) => {
    if (args.action === "list") return page(state.comments[args.filters?.issue] ?? [], false);
    const row = { documentId: "c-new", ...args.data };
    state.comments = { ...state.comments, [args.data.issue]: [...(state.comments[args.data.issue] ?? []), row] };
    return row;
  } };
  const env = { ...tracker.env, FORGE_SESSION_ID: "landed-held" };
  const argv = ["comment", ISSUE.issueId, bodyFile(), "--title", TITLE];
  const held = await ranAsync(FORGE, argv, env);
  assert.equal(held.status, 1, "the gate refuses the first call");
  assert.equal(state.calls.filter((one) => one.name === "forge_comments" && one.args.action === "create").length, 0);
  const again = await ranAsync(FORGE, argv, env);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(state.calls.filter((one) => one.name === "forge_comments" && one.args.action === "create").length, 1);
});

// -------------------------------------------------------------------- forge feedback

const NOTE = [
  "## What happened",
  "",
  "The reply of a note said nothing about what it wrote.",
  "",
  "## Why it happens",
  "",
  "`plugin/src/tools/feedback.mjs` hands the answer straight back without reading its id.",
  "",
  "## Outcome",
  "",
  "A note's reply ends with the id it wrote.",
  "",
  "## Rules",
  "",
  "- The last line names the id or the refusal.",
  "",
  "## Out of scope",
  "",
  "The neighbour scoring.",
  "",
  "## Where",
  "",
  "`plugin/src/tracker/filing/route.mjs`",
  "",
  "Size: fix.",
].join("\n");

const noted = (...argv) => {
  const path = join(room, "note.md");
  writeFileSync(path, `${NOTE}\n`);
  return ranAsync(FORGE, ["feedback", path, "--title", TITLE, ...argv], tracker.env);
};

test("a note that files ends its stdout with the key it created", async () => {
  before();
  stores();
  const run = await noted();
  assert.equal(run.status, 0, run.stderr);
  assert.equal(lastOf(run.stdout), "ISS-810 is filed at uuid-810, read back from the tracker.");
});

test("a note that folds ends its stdout with the comment id it posted", async () => {
  before();
  const posted = stores();
  state.memory = both(NEAR.issueId, 0.83);
  const run = await noted();
  assert.equal(run.status, 0, run.stderr);
  assert.equal(posted.length, 1);
  assert.equal(lastOf(run.stdout), `Comment ${posted[0].documentId} is posted on ${NEAR.issueId}, read back from the tracker.`);
});

/* A shared title is not a shared subject, and the note it swallowed was the finding: the fold a
   note still takes is the neighbour above, measured, and its reply is the case before this (ISS-334). */
test("a note whose title is already open is filed anyway, and its last line names the key", async () => {
  before();
  state.issues = [{ ...ISSUE, title: TITLE }, NEAR];
  const posted = stores();
  state.issues = [{ ...ISSUE, title: TITLE }, NEAR];
  const run = await noted();
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /is open on forge-plugin under this title/u);
  assert.equal(posted.length, 0, "and nothing is posted on the issue that happens to share the title");
  assert.equal(lastOf(run.stdout), "ISS-810 is filed at uuid-810, read back from the tracker.");
});
