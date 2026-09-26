/* ISS-80: one refused `--evidence` file cost the whole record and stopped the files behind it, so a
   retry resent the batch. Each file goes now, the record waits for all of them, and the refusal says
   what is up and how to cite it. Spawned against a fake tracker that judges the bytes. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("per-file-evidence").path;

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const UUID = "per-file-uuid";
const COMMIT = "43b811e";

const ISSUE = {
  documentId: UUID,
  issueId: "ISS-80",
  status: "developed",
  title: "a verdict citing three files, one of them binary",
  description: "no mark here",
  mergedAt: "2026-09-20T13:49:51.777Z",
  acceptanceCriteria: "1. The first outcome.",
  attachments: [],
};

const sent = [];
const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [ISSUE],
  comments: { [UUID]: [] },
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
      if (args.action === "update") Object.assign(ISSUE, args.data);
      return ISSUE;
    },
    forge_comments: (args) => {
      if (args.action !== "list") return { documentId: "a-comment" };
      return { comments: state.comments[UUID] ?? [], returned: 0, hasMore: false };
    },
    /* A NUL makes the bytes binary, as the live tracker reads them. */
    forge_uploads: (args) => {
      sent.push(args.data.name);
      if (args.part?.bytes?.includes(0)) {
        return { refused: "mime not allowed: application/octet-stream", code: "MIME_NOT_ALLOWED",
          details: { reason: "not-allowed", allowed: { mimes: ["image/png", "text/plain"], anyExtensionIfText: true } } };
      }
      return { id: `up-${sent.length}`, url: `/api/attachments/up-${sent.length}/download` };
    },
  },
};

const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());
const ask = (...argv) => ranAsync(FORGE, argv, ENV);
const written = () => state.calls.filter((one) => one.method !== "GET" && !one.path.endsWith("/attachments")
  && (one.path.endsWith("/comments") || (one.method === "PATCH" && !("sessionContext" in (one.sent ?? {})))));

test("one refused evidence file leaves the rest going up, writes no record, and says how to cite what is up", async () => {
  const claimed = await ask("claim", "ISS-80", "--unheld");
  assert.equal(claimed.status, 0, claimed.stderr);
  const room = tempRoom("per-file-evidence-files-");
  const [first, binary, last] = ["gate-before.log", "capture.bin", "gate-after.log"].map((name) => join(room, name));
  writeFileSync(first, "the gate before\n");
  writeFileSync(binary, Buffer.from([0x89, 0x00, 0x01, 0xff]));
  writeFileSync(last, "the gate after\n");
  const before = written().length;

  const run = await ask("record", "verdict", "ISS-80", "--commit", COMMIT, "--criterion", "1", "--verdict", "pass",
    "--evidence", first, "--evidence", binary, "--evidence", last);

  assert.deepEqual(sent, ["gate-before.log", "capture.bin", "gate-after.log"], "every file was sent");
  assert.equal(run.status, 1, run.stdout);
  assert.equal(written().length, before, "no comment and no field of the record reached the tracker");
  assert.match(run.stderr, /^2 of 3 file\(s\) went up to ISS-80, and 1 was refused:$/mu);
  assert.match(run.stderr, /^ {2}capture\.bin — MIME_NOT_ALLOWED: /mu);
  assert.match(run.stderr, /^The tracker takes image\/png text\/plain, and text under any name\.$/mu);
  assert.match(run.stderr, /^Up already: gate-before\.log, gate-after\.log\./mu);
  assert.match(run.stderr, /^ {2}--evidence gate-before\.log --evidence gate-after\.log$/mu);
  assert.match(run.stderr, /No record was written: nothing of it reached ISS-80\./u);
  assert.doesNotMatch(run.stderr, /were begun before this stopped/u, "every file had its answer, so no stranded line");
});
