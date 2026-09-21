/* The checkpoint nobody captured. The window the capture is taken in closes at the merge, so the
   only honest record after it is a statement that it is one — and the whole worth of that statement
   is the line between a builder nobody wrote down and a builder nobody can write down. A claim
   history naming one holder answers the question itself, and a declaration there is a guess in the
   other direction, which is the fabrication the key exists to stop (ISS-2045). */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("landing-reconstruction").path;
const { landingLine, landingOf } = await import("../../../src/flow/landing/checkpoint.mjs");
const { builderProblem, handWrittenOf, holdersOf, rebuiltSaid } =
  await import("../../../src/flow/landing/reconstruction.mjs");
const { briefOf } = await import("../../../src/flow/brief.mjs");
const { viewFrom } = await import("../../../src/flow/earned.mjs");
const { render } = await import("../../../src/flow/record/page.mjs");
const { releaseFrom } = await import("../../../src/tracker/project-config.mjs");

const HEAD = "7f5f7cd30000000000000000000000000000ab12";
const DEPLOYED = "9e24c2af00000000000000000000000000000cde";
const REBUILDER = "the-rebuilding-session";
const BLOCK = { by: REBUILDER, at: "2026-09-21T08:00:00.000Z", why: "written after the landing",
  builder: "four holders appear across this issue's history and none of them is the builder",
  lost: ["base", "files"] };
const REBUILT = { state: "done", head: HEAD, deployment: DEPLOYED, handWritten: BLOCK };

test("a checkpoint read back off the issue keeps its hand-written block rather than dropping it", () => {
  const read = landingOf({ landing: REBUILT });
  assert.deepEqual(read.handWritten, BLOCK, "every key the block declares survives the read");
  assert.equal(read.builder, undefined, "and the builder it could not recover is still not there");
  assert.equal(landingOf({ landing: { state: "ready", builder: "one", head: HEAD } }).handWritten, undefined,
    "a captured checkpoint gains no block from being read");
});

test("a block nobody signed declares nothing, and a key it never named is not read back as one", () => {
  assert.equal(handWrittenOf({ handWritten: { why: "because" } }), null);
  assert.equal(handWrittenOf({ handWritten: "a sentence" }), null);
  assert.equal(handWrittenOf({ handWritten: [BLOCK] }), null);
  assert.equal(handWrittenOf({ handWritten: { by: REBUILDER, forged: "yes" } }).forged, undefined);
  assert.deepEqual(handWrittenOf({ handWritten: { by: REBUILDER, lost: ["", "  ", "at"] } }).lost, ["at"]);
});

test("a builder the claim history answers for on its own is derived rather than declared unrecoverable", () => {
  const builds = (status) => status !== "developed";
  const alone = holdersOf({ lease: { holder: "the-judging-run", history: [
    { holder: "the-only-run", status: "in_progress" }, { holder: "the-judging-run", status: "developed" },
  ] } }, builds);
  assert.deepEqual(alone, ["the-only-run"],
    "the run that claimed to judge is no candidate for having built it, and every run asking has claimed");
  const why = builderProblem(landingOf({ landing: REBUILT }), alone);
  assert.match(why, /exactly one run that held it while the change was being built, `the-only-run`/u, "the refusal names the holder it derived");
  assert.match(why, /derived and not declared/u);
  assert.match(why, /naming `the-only-run` as the builder/u, "and names the write that clears it");
});

test("a block declaring nothing about the builder is refused as a builder nobody wrote down", () => {
  const bare = { ...BLOCK };
  delete bare.builder;
  const why = builderProblem(landingOf({ landing: { ...REBUILT, handWritten: bare } }), ["one", "two"]);
  assert.match(why, /says nothing about the builder/u);
  assert.equal(builderProblem(landingOf({ landing: REBUILT }), ["one", "two"]), null,
    "while the same checkpoint saying why stands, on a history that cannot answer");
});

test("a reconstruction is disclosed on the checkpoint line and on every verdict read back against it", () => {
  const line = landingLine(landingOf({ landing: { ...REBUILT, branch: "iss-1119", files: ["one.mjs"] } }));
  assert.match(line, /built by nobody the record can name/u);
  assert.match(line, /rebuilt by hand by the-rebuilding-session on 2026-09-21T08:00:00\.000Z/u);
  assert.match(line, /recovered no base, files/u);
  assert.equal(rebuiltSaid(landingOf({ landing: { state: "ready", builder: "one", head: HEAD } })), "",
    "and a captured checkpoint is disclosed as nothing at all");

  const verdict = { criterion: "1 — text", verdict: "pass", commit: HEAD, evidence: [DEPLOYED],
    judge: "the-judging-session" };
  const release = releaseFrom({ baseBranch: "master", releaseModel: "publish",
    pipelineConfig: { autoProdDeploy: true, qa: "independent" } });
  const issue = { acceptanceCriteria: "1. The first outcome.", plan: "Screen change: no.",
    attachments: [], sessionContext: { landing: REBUILT } };
  const comments = [{ createdAt: "2026-09-21T09:00:00.000Z", authorId: "agent",
    body: render("verdict", [verdict]) }];
  const brief = briefOf(viewFrom("the-uuid", issue, comments, null, release));
  assert.match(brief.criteria[0].judgedAgainst, /^a checkpoint rebuilt by hand by the-rebuilding-session/u,
    "a reader who asked for the verdict is told what it was judged against");
});
