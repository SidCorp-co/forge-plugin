/* A fold made from a checkout on another project lands on an issue whose key means something else
   there, so what the reply names has to survive being read in that checkout: by the run that made it,
   by the report that run writes, and by whoever reads either afterwards (ISS-2151). Every case is
   spawned through the binary, because the reply and the report are two processes and the name has to
   cross from one to the other. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, projectRoom, ranAsync, tempRoom } from "../fixtures.mjs";
import { OWN } from "../fixtures/own-project.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const TITLE = "a verdict restated between two criteria lands on the earlier one";

const OPEN = { issueId: "ISS-45", documentId: "uuid-45", status: "open", title: "the verdict block parser binds a flag to the block before" };
const HELD = { issueId: "ISS-9", documentId: "uuid-9", status: "in_progress", title: "the issue the run that filed it was working" };

const BODY = [
  "## What happened",
  "",
  "`forge record verdict` wrote a skipped verdict onto the criterion before the one it headed.",
  "",
  "## Why it happens",
  "",
  "`plugin/src/flow/machine/block-order.mjs` takes a restated flag directly after its own criterion.",
  "",
  "## Outcome",
  "",
  "A verdict that could belong to either of two criteria is refused rather than written.",
  "",
  "## Rules",
  "",
  "- A refusal names the two readings.",
  "",
  "## Out of scope",
  "",
  "How verdicts are stored.",
].join("\n");

const state = {
  issues: [OPEN, HELD],
  comments: {},
  calls: [],
  memory: {},
  answer: {
    "forge_projects.list": () => ({
      projects: [
        { id: "1e1c1a1e-0000-4000-8000-0000000000ff", slug: "somewhere-else" },
        { id: "1e1c1a1e-0000-4000-8000-0000000000fe", slug: "forge-plugin" },
      ],
    }),
  },
};
/* The row keeps the lease written to it, so the routed write the report reads is the CLI's own. */
state.answer.forge_issues = (args) => {
  const row = state.issues.find((one) => one.documentId === args.documentId);
  if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
  if (args.action === "get") return row ?? {};
  if (args.action === "update" && row) return Object.assign(row, args.data);
  return { documentId: args.documentId, ...(args.data ?? {}) };
};
/* The thread keeps what is posted to it, so the landed line reads the fold's comment back. */
state.answer.forge_comments = (args) => {
  const held = (state.comments[args.filters?.issue ?? args.data?.issue] ??= []);
  if (args.action === "list") return { comments: held, returned: held.length, hasMore: false };
  const documentId = `comment-${held.length}`;
  held.push({ documentId, createdAt: "2026-10-01T00:01:00.000Z", body: args.data?.body });
  return { documentId, ...(args.data ?? {}) };
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const HOME = tracker.env.XDG_CONFIG_HOME;
const ENV = { ...tracker.env, HOME };
const elsewhere = projectRoom(tempRoom("fold-elsewhere-"), HOME, { slug: "somewhere-else", feedback: { plugin: "bugs" } });
const own = projectRoom(tempRoom("fold-own-"), HOME, OWN);

const nearBoth = () => {
  state.memory = { semantic: [[OPEN.issueId, 0.84]], keyword: [[OPEN.issueId, 0.0608]] };
};

const noted = (room) => {
  const path = join(room, `note-${Math.random().toString(36).slice(2)}.md`);
  writeFileSync(path, `${BODY}\n`);
  return ranAsync(FORGE, ["feedback", path, "--title", TITLE], ENV, room);
};

test("a fold from another project's checkout names its destination with the project, and the report counts it", async () => {
  state.comments = {};
  nearBoth();
  const run = await noted(elsewhere);
  assert.equal(run.status, 0, run.stderr);
  const folded = /^(ISS-45 on forge-plugin) is open, names the same place/mu.exec(run.stdout);
  assert.ok(folded, run.stdout);
  assert.match(run.stdout, /^Comment \S+ is posted on ISS-45 on forge-plugin,/mu, run.stdout);

  const claimed = await ranAsync(FORGE, ["claim", HELD.issueId, "--unheld"], ENV, elsewhere);
  assert.equal(claimed.status, 0, `the lease the routed write needs: ${claimed.stderr}`);
  const routed = await ranAsync(FORGE, ["record", "routed", HELD.issueId, "--what", "a defect in the verdict parser",
    "--to", folded[1]], ENV, elsewhere);
  assert.equal(routed.status, 0, routed.stderr);
  const report = await ranAsync(FORGE, ["resume", HELD.issueId, "--report"], ENV, elsewhere);
  assert.equal(report.status, 0, report.stderr);
  assert.match(report.stdout, /^Plugin defect {2}ISS-45 on forge-plugin$/mu, report.stdout);
  assert.doesNotMatch(report.stdout, /none filed/u);
});

test("a fold from a checkout on the project it files to names the bare key", async () => {
  state.comments = {};
  nearBoth();
  const run = await noted(own);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ISS-45 is open, names the same place/mu, run.stdout);
  assert.match(run.stdout, /^Comment \S+ is posted on ISS-45,/mu, run.stdout);
  assert.doesNotMatch(run.stdout, /on forge-plugin is open/u);
});
