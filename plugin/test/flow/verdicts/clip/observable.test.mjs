/* adminhub-api on 3.36.649: core refuses a verdict on a criterion the design classes observable with
   VERDICT_CLIP_REQUIRED unless it cites a WebM or MP4 attached to the issue or says why in its
   `without-clip` line (`clip-citation.ts:clipFault`, REQ-40 BC-4), and `forge record verdict` had no
   flag for that line. It has one now, and a clip given to --evidence goes up as the video it is. */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { projectRoom, ranAsync, tempHome, tempRoom } from "../../../fixtures.mjs";
import { OWN, trackerFor } from "../../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("verdict-observable").path;
const { parseAll } = await import("../../../../src/flow/record/page.mjs");

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const JUDGE = "the-building-run";
const MERGED = "c8c35500000000000000000000000000000000ab";
const AT = "2026-10-31T08:00:00.000Z";

let clock = 0;
const at = () => `2026-10-31T09:${String((clock += 1)).padStart(2, "0")}:00.000Z`;

const ISSUE = {
  documentId: "observable-uuid", issueId: "ISS-31", status: "in_progress", workState: { step: "test" },
  title: "a screen change", description: "here",
  plan: "Screen change: yes.\nSchema coupling: no.\nUser-facing outcome: yes.",
  acceptanceCriteria: "1. The page shows the new total.", mergedAt: AT, mergedCommitSha: MERGED, attachments: [],
  sessionContext: { lease: { holder: JUDGE, renewedAt: new Date().toISOString(), minutes: 60, history: [] } },
};
const state = {
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: true, qa: "builder" } },
  issues: [ISSUE],
  comments: { "observable-uuid": [] },
  answer: {},
};
state.answer.forge_config = () => ({ config: state.config });
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
  if (args.action === "get") return ISSUE;
  if (args.action === "update" || args.action === "transition") return Object.assign(ISSUE, args.data);
  return { documentId: args.documentId, ...(args.data ?? {}) };
};
state.answer.forge_comments = (args) => {
  const held = state.comments["observable-uuid"];
  if (args.action === "list") return { comments: held, returned: held.length, hasMore: false };
  held.push({ documentId: `c-${held.length}`, createdAt: at(), body: args.data?.body });
  return { documentId: `c-${held.length - 1}` };
};
const ROOM = tempRoom("verdict-clip-");
spawnSync("git", ["init", "-q", "-b", "master", ROOM], { cwd: ROOM });
const { tracker, env: ENV } = await trackerFor(state, [ROOM]);
projectRoom(ROOM, ENV.XDG_CONFIG_HOME, OWN);
after(() => tracker.close());
const judge = (...tail) => ranAsync(FORGE, ["record", "verdict", "ISS-31", "--commit", MERGED, "--criterion", "1",
  "--verdict", "pass", ...tail], { ...ENV, FORGE_SESSION_ID: JUDGE }, ROOM);
const latestVerdict = () => state.comments["observable-uuid"].map((one) => one.body)
  .filter((body) => /^## Verdict$/mu.test(body)).flatMap((body) => parseAll(body)).at(-1);

test("--without-clip writes core's without-clip line, why an observable criterion cites no clip", async () => {
  const why = "the page renders server-side and the recorder has no display on this box";
  const run = await judge("--evidence", MERGED, "--without-clip", why);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const record = latestVerdict();
  assert.equal(record?.fields["without-clip"], why, JSON.stringify(record));
  assert.match(state.comments["observable-uuid"].at(-1).body, new RegExp(`^without-clip: ${why}$`, "mu"),
    "and in the block, as the line core reads (`verdict-identity.ts`, SINGLE_FIELDS)");
});

test("a clip given to --evidence goes up as video/webm and the verdict cites it by name", async () => {
  const clip = join(ROOM, "iss-31-c1.webm");
  writeFileSync(clip, Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x00, 0xff, 0xfe]));
  state.calls = [];
  const run = await judge("--evidence", clip);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const upload = (state.calls ?? []).find((one) => /\/attachments$/u.test(one.path ?? "") && one.method === "POST");
  assert.ok(upload, "the clip went up to the issue's attachments");
  assert.match(JSON.stringify(upload.sent ?? upload), /video\/webm/u, JSON.stringify(upload));
  assert.deepEqual(latestVerdict()?.fields.evidence, ["iss-31-c1.webm"]);
});
