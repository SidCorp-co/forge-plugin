/* ISS-1935: evidence given inside the first `--criterion` block only is the shared block's alone
   (batched-verdict.test.mjs proves that precedence), so a later block that names none is refused —
   correctly. What it must not do is list the file the refused call only planned to upload as if the
   issue already carried it: that file exists nowhere once the whole call is refused, and a run that
   takes the refusal's own advice and cites it by name is refused a second time for citing a ghost. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("refused-verdict-carries").path;

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const UUID = "carries-uuid";
const COMMIT = "43b811e";

const ISSUE = {
  documentId: UUID,
  issueId: "ISS-1935",
  status: "developed",
  title: "a verdict with evidence in its first block only",
  description: "no mark here",
  mergedAt: "2026-09-20T13:49:51.777Z",
  acceptanceCriteria: "1. The first outcome.\n2. The second outcome.",
  attachments: [],
};

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
  },
};

const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());
const ask = (...argv) => ranAsync(FORGE, argv, ENV);

test("a block refused for missing evidence is told what the issue carries, never what this call only planned", async () => {
  const claimed = await ask("claim", "ISS-1935", "--unheld");
  assert.equal(claimed.status, 0, claimed.stderr);

  const room = tempRoom("refused-verdict-carries-files-");
  const path = join(room, "routes-before.txt");
  writeFileSync(path, "the run this evidence would have proved\n");

  const run = await ask("record", "verdict", "ISS-1935", "--commit", COMMIT,
    "--criterion", "1", "--verdict", "pass", "--evidence", path,
    "--criterion", "2", "--verdict", "pass");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /This issue carries no attachment\./u,
    "the issue holds nothing yet, and the refused call uploaded nothing either");
  assert.doesNotMatch(run.stderr, /routes-before\.txt/u,
    "a name this call only planned to upload is not reported as carried");

  /* The refusal's own advice — cite an attachment by name — is one the issue can actually answer,
     so citing the one real name on it (the commit, which a bare citation always satisfies) goes
     through where citing the ghost never could. */
  const named = await ask("record", "verdict", "ISS-1935", "--commit", COMMIT,
    "--criterion", "1", "--verdict", "pass", "--evidence", COMMIT,
    "--criterion", "2", "--verdict", "pass", "--evidence", COMMIT);
  assert.equal(named.status, 0, named.stderr);
});
