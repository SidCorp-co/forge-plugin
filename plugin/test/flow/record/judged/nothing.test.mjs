/* `--judged nothing`, end to end against a tracker (ISS-1960): the word a builder writes where no
   verdict has judged a head yet, which the note says in words, every reader takes for no head, and
   the verb refuses where the page carries a verdict. The checkout is real because `landing moved` is
   git's reading, taken from the reviewed head where no judged head is named. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { escaped, git, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("record-merged-unjudged").path;
const { judgedHead, landingMoved, lastMark } = await import("../../../src/flow/record/merged.mjs");
const { movedBetween } = await import("../../../src/git/moved.mjs");
const { render } = await import("../../../src/flow/record/page.mjs");
const { judgedOwed, viewFrom } = await import("../../../src/flow/earned.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

/* The change is reviewed at one head, then moves a file of its own before it lands, so the reading
   from the reviewed head and the reading from the landed head's parent differ. */
const ROOM = tempRoom("record-merged-unjudged-repo-");
spawnSync("git", ["init", "-q", "-b", "master", ROOM], { cwd: ROOM, encoding: "utf8" });
const wrote = (files) => {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(ROOM, path)), { recursive: true });
    writeFileSync(join(ROOM, path), text);
  }
  git(ROOM, "add", "-A");
  git(ROOM, "commit", "-qm", Object.keys(files).join(" "));
  return git(ROOM, "rev-parse", "HEAD").stdout.trim();
};
wrote({ "docs/a.md": "zero\n", "docs/b.md": "zero\n" });
const REVIEWED = wrote({ "docs/a.md": "one\n", "docs/b.md": "one\n" });
const OTHER = wrote({ "docs/a.md": "two\n" });
const AT = wrote({ "neighbour.md": "one\n" });
const CHANGE = ["docs/a.md", "docs/b.md"];

const ISSUE = {
  documentId: "unjudged-uuid",
  issueId: "ISS-98",
  status: "in_progress",
  title: "a change whose judgement is another run's",
  description: "the builder writes no verdict",
  complexity: "s",
  acceptanceCriteria: "1. The first.\n2. The second.",
};

let clock = 0;
const stamped = () => `2026-09-28T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  comments: {},
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: [ISSUE], returned: 1, hasMore: false };
      if (args.action === "get") return ISSUE;
      if (args.action === "update") return Object.assign(ISSUE, args.data);
      if (args.action === "mark_merged") {
        (state.comments[args.data.issueId] ??= []).push({ documentId: `mark-${clock + 1}`, createdAt: stamped(),
          authorId: "agent", body: `mark_merged target=${args.data.target} — ${args.data.note}` });
        return { ...ISSUE, mergedAt: stamped() };
      }
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    forge_comments: (args) => {
      if (args.action !== "list") {
        const one = { documentId: `c-${clock + 1}`, createdAt: stamped(), authorId: "agent", body: args.data.body };
        (state.comments[args.data.issue] ??= []).push(one);
        return { documentId: one.documentId };
      }
      const held = state.comments[args.filters?.issue] ?? [];
      return { comments: held, returned: held.length, hasMore: false };
    },
  },
};
const { tracker, env: ENV } = await trackerFor(state, [ROOM]);
test.after(() => tracker.close());
await ranAsync(FORGE, ["claim", "ISS-98", "--unheld"], ENV, ROOM);

const marked = (...argv) => ranAsync(FORGE, ["record", "merged", "ISS-98", ...argv], ENV, ROOM);
const page = () => state.comments[ISSUE.documentId] ?? [];
const marks = () => page().filter((one) => one.body.startsWith("mark_merged"));
const verdict = (number, commit) => ({
  documentId: `v-${number}-${commit.slice(0, 7)}`,
  createdAt: stamped(),
  authorId: "agent",
  body: render("verdict", { criterion: `${number} — text`, verdict: "pass", commit, evidence: ["run.txt"] }),
});
const unjudged = (judged = "nothing") =>
  marked("--at", AT, "--reviewed", REVIEWED, "--judged", judged, "--wrote", CHANGE.join(", "));

test("--judged nothing writes the mark on a page with no verdict, and the note says so in words", async () => {
  state.comments[ISSUE.documentId] = [];
  const run = await unjudged();
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const note = lastMark(page());
  assert.match(note, /; judged head nothing — no verdict has judged any head yet; landing moved /u, note);
  assert.equal(judgedHead(page()), null, "and the reader of the head finds none there");
});

test("with no judged head, landing moved is git's reading between the reviewed head and --at", async () => {
  state.comments[ISSUE.documentId] = [];
  const run = await unjudged();
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const read = movedBetween(ROOM, REVIEWED, AT, CHANGE);
  assert.deepEqual(read, ["docs/a.md"], "the fixture moves one path of the change after the review");
  assert.deepEqual(landingMoved(page()), read);
  assert.match(run.stdout, new RegExp(`git's reading between ${escaped(REVIEWED)} and ${escaped(AT)}: docs/a\\.md\\.`, "u"), run.stdout);
});

test("a verdict under a mark that judged nothing is owed again at the merged commit", async () => {
  state.comments[ISSUE.documentId] = [];
  assert.equal((await unjudged()).status, 0);
  const issue = { ...ISSUE, mergedAt: "2026-09-28T11:00:00.000Z", attachments: [{ name: "run.txt" }] };
  const owed = judgedOwed(viewFrom(ISSUE.documentId, issue, [...page(), verdict(1, REVIEWED)]), "ISS-98")
    .map((one) => one.what);
  assert.ok(owed.includes(`the verdict on criterion 1 judged ${REVIEWED}, and the merged commit is ${AT}`),
    owed.join("\n"));
  assert.ok(owed.includes("criterion 2 has no verdict"), owed.join("\n"));
});

test("--judged nothing on a page carrying verdicts is refused, naming every head they judged", async () => {
  state.comments[ISSUE.documentId] = [verdict(1, REVIEWED), verdict(2, OTHER)];
  const run = await unjudged();
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, new RegExp(`verdicts judged at ${escaped(REVIEWED)}, ${escaped(OTHER)}, so nothing was written`, "u"),
    run.stderr);
  assert.match(run.stderr, new RegExp(`^ {2}forge record merged ISS-98 .*--judged ${escaped(REVIEWED)}`, "mu"),
    `the refusal carries the command that clears it:\n${run.stderr}`);
  assert.deepEqual(marks(), [], "and no mark was written");
  const again = await unjudged(REVIEWED);
  assert.equal(again.status, 0, `the head it names clears it, whatever other heads verdicts judged:\n${again.stderr}`);
});

test("--judged <sha> writes that head and reads landing moved from it", async () => {
  state.comments[ISSUE.documentId] = [];
  const run = await unjudged(OTHER);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(lastMark(page()), new RegExp(`; judged head ${escaped(OTHER)}; `, "u"));
  assert.equal(judgedHead(page()), OTHER);
  assert.deepEqual(landingMoved(page()), movedBetween(ROOM, OTHER, AT, CHANGE));
  assert.deepEqual(landingMoved(page()), [], "the only commit after that head moves a neighbour");
});

test("a --judged that is neither a sha nor the word is refused naming both forms", async () => {
  state.comments[ISSUE.documentId] = [];
  const run = await unjudged("none");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, new RegExp(escaped("--judged takes the head the verdicts judged as 7 to 40 hex digits, "
    + "or the word `nothing` where no verdict has judged any head yet, not `none`."), "u"), run.stderr);
  assert.deepEqual(marks(), []);
});

test("the kind's -h says --judged takes the word, and what the clause reads back as", async () => {
  const run = await ranAsync(FORGE, ["record", "merged", "-h"], ENV, ROOM);
  const said = run.stdout.replace(/\s+/gu, " ");
  assert.ok(said.includes("--judged also takes the word `nothing`, where no verdict has judged any head yet: "
    + "the note says so in words, every reader of the clause takes it for no head"), run.stdout);
});
