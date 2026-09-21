/* The one kind no entry check may ask for and every reader reads, held to being present where a run
   could have an answer, absent where it could not, and free: docs/cli/record-the-unwritten.md. */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("route-unasked").path;
const { render } = await import("../../../src/flow/record/page.mjs");
const { ORDER, viewFrom } = await import("../../../src/flow/earned.mjs");
const { owedBlock, owedIn, unaskedLines } = await import("../../../src/flow/route.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const CRITERIA = "1. The first outcome.\n2. The second outcome.";

let clock = 0;
const at = () => `2026-09-04T09:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const recorded = (kind, fields) => ({ createdAt: at(), authorId: "agent", body: render(kind, fields) });
const view = (status, comments = []) =>
  viewFrom("the-uuid", { status, acceptanceCriteria: CRITERIA }, comments);

const ROUTED = recorded("routed", { what: "the gate reads a checkout's mtime as a write", to: "ISS-80, filed" });
const NONE = recorded("routed", { none: "nothing outside this issue came up" });

const ASKED_AT = ["in_progress", "developed", "testing"];

test("a run that could have met something beside this issue is asked whether it did", () => {
  for (const status of ASKED_AT) {
    const said = unaskedLines(view(status), "ISS-3").join("\n");
    assert.match(said, /met anything that is not this issue's/u, status);
  }
});

test("the same answer carries a write for each way of answering it", () => {
  const said = unaskedLines(view("in_progress"), "ISS-3");
  assert.match(said.join("\n"), /^ {4}forge record routed ISS-3 --what "<what was found>" --to "<where it went>"$/mu,
    "the routing itself");
  assert.match(said.join("\n"), /^ {4}forge record routed ISS-3 --none "<why there was nothing>"$/mu,
    "and the answer of a run that met nothing, which is a record and not a silence");
});

test("a routed record of either sort ends the asking", () => {
  for (const held of [ROUTED, NONE]) {
    assert.deepEqual(unaskedLines(view("developed", [held]), "ISS-3"), [],
      "what was found and where it went, or the reason there was nothing: either is an answer");
  }
});

test("nothing is asked of a rung where no run could yet have an answer, or where the issue is over", () => {
  for (const status of ORDER.filter((one) => !ASKED_AT.includes(one))) {
    assert.deepEqual(unaskedLines(view(status), "ISS-3"), [], status);
  }
});

test("the prompt moves no count and earns no status", () => {
  const without = view("in_progress");
  const with_ = view("in_progress", [NONE]);
  assert.equal(owedIn(with_, "ISS-3").missing.length, owedIn(without, "ISS-3").missing.length,
    "the same items are owed either way");
  assert.equal(owedBlock(with_, "ISS-3", owedIn(with_, "ISS-3"))[0],
    owedBlock(without, "ISS-3", owedIn(without, "ISS-3"))[0],
    "and the line that counts them is the same line");
});

const working = {
  documentId: "working-uuid",
  issueId: "ISS-7",
  status: "in_progress",
  title: "a change being written",
  acceptanceCriteria: CRITERIA,
  plan: "## Files touched\n\na.mjs\n",
};
const project = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [working],
  comments: { "working-uuid": [] },
  answer: {
    forge_config: () => ({ config: project.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: project.issues, returned: 1, hasMore: false };
      if (args.action === "get") return working;
      if (args.action === "update") return Object.assign(working, args.data);
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
  },
};
const { tracker, env: ENV } = await trackerFor(project);
test.after(() => tracker.close());

const inSession = (name) => ({ ...ENV, FORGE_SESSION_ID: name });
const listed = () => project.calls.filter((one) =>
  one.name === "forge_comments" && one.args.action === "list").length;
const promptIn = (text) => text.split("\n").filter((one) => /routed|not this issue's/u.test(one)).join("\n");

/* Three surfaces, one text: a second composition of the same parts is a fourth wording of one
   answer, and a run reading two of them would have to decide which it is held to. */
test("the three surfaces that print what is owed print this in the same words", async () => {
  /* The write goes first and under the session that took the lease: its trailer is said once per
     session, so a session already told this would write and say nothing. */
  const mine = inSession("unasked-write");
  await ranAsync(FORGE, ["claim", "ISS-7", "--unheld"], mine);
  const wrote = await ranAsync(FORGE, ["record", "correction", "ISS-7",
    "--moved", "a file the plan does not name", "--why", "the read went wider"], mine);
  assert.equal(wrote.status, 0, wrote.stderr);
  const asked = promptIn(wrote.stderr);
  assert.ok(asked.trim(), `the line a record write ends on carries it: ${wrote.stderr}`);

  const owed = await ranAsync(FORGE, ["advance", "ISS-7", "--owed"], inSession("unasked-owed"));
  assert.equal(owed.status, 0, owed.stderr);
  assert.equal(promptIn(owed.stdout), asked, "advance --owed, character for character");

  const brief = await ranAsync(FORGE, ["resume", "ISS-7"], inSession("unasked-resume"));
  assert.equal(promptIn(brief.stdout), asked, "and resume, character for character");
});

test("a page the read could not finish is asked nothing, a routing past the cut disproving the claim", () => {
  const cut = viewFrom("the-uuid", { status: "in_progress", acceptanceCriteria: CRITERIA }, [], { read: 200, of: 431 });
  assert.deepEqual(unaskedLines(cut, "ISS-3"), [],
    "the block says what the record does not hold, which a partial read cannot know");
});

/* The rung the close is taken from reads no page for a plain move, so a block asked for there would
   claim the record holds no routing over a page nothing walked — and buying the claim with a read
   puts a thread too long to walk in front of the close. The span stops below it instead. */
test("the rung the close is taken from is asked nothing, and its rehearsal still reads no page", async () => {
  Object.assign(working, { status: "awaiting_release" });
  project.comments["working-uuid"] = [];
  const before = listed();
  const owed = await ranAsync(FORGE, ["advance", "ISS-7", "--owed"], inSession("unasked-end-owed"));
  assert.equal(owed.status, 0, owed.stderr);
  assert.equal(promptIn(owed.stdout), "", `nothing is asked at this rung: ${owed.stdout}`);
  assert.equal(listed(), before, "and no page was fetched to say so");
});
