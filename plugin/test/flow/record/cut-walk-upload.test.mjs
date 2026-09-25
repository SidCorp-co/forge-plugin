/* A comment walk that stops short leaves the names on an issue unreadable, and the two routes that
   put a file up decide it in one place: warned and sent, since no name a caller could choose clears
   a list that cannot be read (ISS-447). Every case spawns the verbs, the upload and the line being
   owed together. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("cut-walk-upload").path;
const { render } = await import("../../../src/flow/record/page.mjs");
const { unreadNames } = await import("../../../src/tracker/evidence.mjs");
const { cutLine } = await import("../../../src/tracker/comments.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const COMMIT = "43b811e";

const judging = {
  documentId: "cut-uuid",
  issueId: "ISS-9",
  status: "testing",
  title: "the change on a thread too long to walk",
  description: "no mark here",
  acceptanceCriteria: "1. The first outcome.",
  mergedAt: "2026-09-05T13:49:51.777Z",
  releaseNotes: { section: "Fixed", userFacing: "it works" },
  attachments: [],
};
/* `walk` is what the list answers with past its rows: a prefix, a read called whole but counted
   above what it handed over, or a plain whole read. */
const WALKS = {
  whole: (rows) => ({ returned: rows.length, hasMore: false }),
  cut: (rows) => ({ returned: rows.length, total: rows.length + 40, hasMore: true, truncatedBy: "cursor" }),
  counted: (rows) => ({ returned: rows.length, total: rows.length + 40, hasMore: false }),
};
const state = { calls: [], issues: [judging], comments: { "cut-uuid": [] }, answer: {}, walk: "whole" };
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
  if (args.action === "update") return Object.assign(judging, args.data);
  return judging;
};
state.answer.forge_comments = (args) => {
  if (args.action === "list") {
    const rows = state.comments[args.filters?.issue] ?? [];
    return { comments: rows, ...WALKS[state.walk](rows) };
  }
  const rows = (state.comments[args.data?.issue] ??= []);
  const id = `comment-${rows.length}`;
  rows.push({ documentId: id, createdAt: `2026-09-05T11:${String(rows.length).padStart(2, "0")}:00.000Z`, body: args.data?.body });
  return { documentId: id };
};
const { tracker, env: ENV } = await trackerFor(state);
after(() => tracker.close());

const sink = createServer((request, response) => {
  request.resume();
  request.on("end", () => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ id: "up", name: "n", url: "/api/attachments/up/download" }));
  });
});
await new Promise((ready) => sink.listen(0, "127.0.0.1", ready));
after(() => sink.close());
state.answer.forge_uploads = (args) =>
  ({ uploadUrl: `http://127.0.0.1:${sink.address().port}/put/${args?.data?.name ?? "unnamed"}` });

const room = tempRoom("cut-walk-upload-files-");
const env = { ...ENV, FORGE_SESSION_ID: "cut-walk-upload-session" };
const ask = (...argv) => ranAsync(FORGE, argv, env);
const uploads = () => state.calls.filter((one) => one.name === "forge_uploads").length;
const posted = () => state.comments["cut-uuid"].length;
const file = (name) => {
  const path = join(room, name);
  writeFileSync(path, `evidence for ${name}\n`);
  return path;
};
/* The line either route prints for a cut walk, as stderr carries it. */
const warned = (stderr) => stderr.split("\n").find((line) => line.startsWith("The names already on ")) ?? null;
/* What the shared function says for this thread at the rows the list hands back, taken before the
   write whose own record would add one. */
const expected = () => {
  const rows = state.comments["cut-uuid"];
  return unreadNames("ISS-9", 0, cutLine(WALKS.cut(rows)));
};

before(async () => {
  state.comments["cut-uuid"].push({
    documentId: "the-mark", createdAt: "2026-09-05T10:00:00.000Z",
    body: `mark_merged target=base — merged to master at ${COMMIT}`,
  }, {
    documentId: "a-verdict", createdAt: "2026-09-05T10:01:00.000Z",
    body: render("verdict", { criterion: "1 — The first outcome.", verdict: "pass", commit: COMMIT, evidence: [COMMIT] }),
  });
  await ask("claim", "ISS-9", "--unheld");
  const claimed = await ask("claim", "ISS-9", "--unheld");
  assert.equal(claimed.status, 0, `the lease every write needs: ${claimed.stderr}`);
});

/* A cut thread holds a session's first write to it once, at the renewal ahead of the first byte: the
   last refusal before a send, so the line saying the file is going up is owed after it and not before. */
test("the one hold a cut thread earns stops the upload before the warning is said", async () => {
  state.walk = "cut";
  const [sent, wrote] = [uploads(), posted()];
  const run = await ask("record", "verdict", "ISS-9", "--criterion", "1", "--verdict", "pass",
    "--commit", COMMIT, "--evidence", file("held-on-a-cut-walk.txt"));
  state.walk = "whole";
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^Hold — re-send the same command\./mu, run.stderr);
  assert.equal(warned(run.stderr), null, "no line claims a send the hold stopped");
  assert.equal(uploads() - sent, 0);
  assert.equal(posted() - wrote, 0);
});

test("a verdict citing a file on a cut walk sends it and writes the record rather than refusing", async () => {
  state.walk = "cut";
  const [sent, wrote, said] = [uploads(), posted(), expected()];
  const run = await ask("record", "verdict", "ISS-9", "--criterion", "1", "--verdict", "pass",
    "--commit", COMMIT, "--evidence", file("verdict-on-a-cut-walk.txt"));
  state.walk = "whole";
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stderr, /would put a file up/u, "the old refusal is gone");
  assert.equal(uploads() - sent, 1, "the file went up");
  assert.equal(posted() - wrote, 1, "and the record was written");
  assert.match(state.comments["cut-uuid"].at(-1).body, /^evidence: verdict-on-a-cut-walk\.txt$/mu,
    "citing the name the file went up under");
  assert.equal(warned(run.stderr), said, "said in the words the shared function gives");
});

test("a verification citing a file on a cut walk sends it and writes the record", async () => {
  state.walk = "cut";
  const [sent, wrote, said] = [uploads(), posted(), expected()];
  const run = await ask("record", "verification", "ISS-9", "--where", "the installed plugin",
    "--commit", COMMIT, "--evidence", file("verification-on-a-cut-walk.txt"));
  state.walk = "whole";
  assert.equal(run.status, 0, run.stderr);
  assert.equal(uploads() - sent, 1, "the file went up");
  assert.equal(posted() - wrote, 1, "and the record was written");
  assert.match(state.comments["cut-uuid"].at(-1).body, /^evidence: verification-on-a-cut-walk\.txt$/mu);
  assert.equal(warned(run.stderr), said);
});

/* The same condition, the same line: `forge attach` and a record verb on one cut thread print it
   byte for byte, which is what one function behind both gives and two copies would not keep. */
test("attach and a record verb print the one warning for the one cut walk, and attach still sends", async () => {
  state.walk = "cut";
  const sent = uploads();
  const attached = await ask("attach", "issue", "ISS-9", file("attached-on-a-cut-walk.txt"));
  const recorded = await ask("record", "verdict", "ISS-9", "--criterion", "1", "--verdict", "pass",
    "--commit", COMMIT, "--evidence", file("recorded-on-a-cut-walk.txt"));
  state.walk = "whole";
  assert.equal(attached.status, 0, attached.stderr);
  assert.equal(recorded.status, 0, recorded.stderr);
  assert.equal(uploads() - sent, 2, "both files went up");
  assert.ok(warned(attached.stderr), `attach warned: ${attached.stderr}`);
  assert.match(warned(attached.stderr), /resolves to two documents/u, "naming what a duplicate costs");
  assert.match(warned(attached.stderr), /without the tracker ever calling the read complete/u, "and the cut");
  assert.equal(warned(recorded.stderr), warned(attached.stderr));
});

/* A rung writing two kinds in one call plans the first kind's upload before the second reads its
   names; that pending name is no name read off the issue, so the one line said is attach's own. */
test("a two-kind rung on a cut walk says the one warning attach says, counting no pending upload", async () => {
  state.walk = "cut";
  const sent = uploads();
  const attached = await ask("attach", "issue", "ISS-9", file("attached-before-a-rung.txt"));
  const rung = await ask("record", "verdict", "ISS-9", "--criterion", "1", "--verdict", "pass",
    "--commit", COMMIT, "--evidence", file("rung-verdict.txt"),
    "--also", "verification", "--where", "the installed plugin", "--commit", COMMIT,
    "--evidence", file("rung-verification.txt"));
  state.walk = "whole";
  assert.equal(rung.status, 0, rung.stderr);
  assert.equal(uploads() - sent, 3, "the attached file and both of the rung's");
  const lines = rung.stderr.split("\n").filter((line) => line.startsWith("The names already on "));
  assert.deepEqual(lines, [warned(attached.stderr)], "one line, byte for byte the one attach printed");
});

/* Said where the uploads go and not where the plan is made: a write refused after the plan never
   sent anything, so a line saying it did would be a lie told on the one call nothing went up. */
test("a record refused for another reason on a cut walk says nothing was sent and sends nothing", async () => {
  state.walk = "cut";
  const [sent, wrote] = [uploads(), posted()];
  const run = await ask("record", "verdict", "ISS-9", "--criterion", "9", "--verdict", "pass",
    "--commit", COMMIT, "--evidence", file("refused-on-a-cut-walk.txt"));
  state.walk = "whole";
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /ISS-9 has no criterion 9/u, "refused for the criterion it names");
  assert.equal(warned(run.stderr), null, "and no line claims a send");
  assert.equal(uploads() - sent, 0);
  assert.equal(posted() - wrote, 0);
});

/* A read the tracker called whole has handed over every name it is going to, whatever its count
   says, so neither route has anything to warn about there (ISS-841's split, kept one layer down). */
test("a walk called whole but counted above its rows warns from neither route", async () => {
  state.walk = "counted";
  const attached = await ask("attach", "issue", "ISS-9", file("attached-on-a-counted-walk.txt"));
  const recorded = await ask("record", "verdict", "ISS-9", "--criterion", "1", "--verdict", "pass",
    "--commit", COMMIT, "--evidence", file("recorded-on-a-counted-walk.txt"));
  state.walk = "whole";
  assert.equal(attached.status, 0, attached.stderr);
  assert.equal(recorded.status, 0, recorded.stderr);
  assert.equal(warned(attached.stderr), null, attached.stderr);
  assert.equal(warned(recorded.stderr), null, recorded.stderr);
});
