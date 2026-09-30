/* What a verdict, a review and a verification of an issue landing outside git name what they judged by:
   the landing the tracker's mark holds, read off it where the flag is absent, and never a commit
   (ISS-2402). End to end, beside an issue landing in git, and the baseline whose commit stays asked. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { git, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("record-landing").path;
const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

const ROOM = tempRoom("record-landing-repo-");
spawnSync("git", ["init", "-q", "-b", "master", ROOM], { cwd: ROOM, encoding: "utf8" });
writeFileSync(join(ROOM, "control.md"), "the control folder\n");
git(ROOM, "add", "-A");
git(ROOM, "commit", "-qm", "the control folder");
const HEAD = git(ROOM, "rev-parse", "HEAD").stdout.trim();

const PLACE = "https://mowmentbrand.com/products/{classic-baseball-button-jersey,pro-match-soccer-jersey}";
const LIVE = "https://mowmentbrand.com/products/pro-match-soccer-jersey";

let clock = 0;
const stamped = () => `2026-09-30T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const CRITERIA = "1. The seven jerseys show on the storefront.\n2. The catalogue lists them.";
const outside = (documentId, issueId) => ({ documentId, issueId, status: "in_progress", complexity: "s",
  title: "seven jerseys on the store", acceptanceCriteria: CRITERIA, landingShape: "outside_git",
  mergedAt: "2026-09-30T09:00:00.000Z", mergedLanding: PLACE });
const ISSUES = {
  "outside-uuid": outside("outside-uuid", "ISS-38"),
  "resume-uuid": outside("resume-uuid", "ISS-40"),
  "git-uuid": { documentId: "git-uuid", issueId: "ISS-99", status: "in_progress", complexity: "s",
    title: "a change in a repository", acceptanceCriteria: CRITERIA, landingShape: "git" },
};
const byKey = (key) => Object.values(ISSUES).find((one) => one.documentId === key || one.issueId === key);
const markComment = () => ({ documentId: `mark-${clock + 1}`, createdAt: stamped(), authorId: "agent",
  body: `mark_merged target=base — landed outside git, at the place this mark's landing names\n`
    + `this mark names where the work landed outside git: \`merged_landing\` holds ${PLACE}.` });

const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  comments: { "outside-uuid": [markComment()], "resume-uuid": [markComment()] },
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: Object.values(ISSUES), returned: 3, hasMore: false };
      if (args.action === "get") return byKey(args.documentId);
      if (args.action === "update") return Object.assign(byKey(args.documentId), args.data);
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    forge_comments: (args) => {
      if (args.action !== "list") {
        const one = { documentId: `c-${clock + 1}`, createdAt: stamped(), authorId: "agent", authorDeviceId: "d",
          body: args.data.body };
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
for (const ref of ["ISS-38", "ISS-40", "ISS-99"]) await ranAsync(FORGE, ["claim", ref, "--unheld"], ENV, ROOM);

const forge = (...argv) => ranAsync(FORGE, argv, ENV, ROOM);
const posted = (documentId) => (state.comments[documentId] ?? []).filter((one) => one.documentId.startsWith("c-"));
const lastPosted = (documentId) => posted(documentId).at(-1)?.body ?? "";

const KINDS = {
  verdict: ["--criterion", "1", "--verdict", "pass", "--evidence", LIVE],
  review: ["--reviewer", "codex", "--outcome", "approved", "--finding", "F1 accepted"],
  verification: ["--where", "mowmentbrand.com", "--evidence", LIVE],
};

test("each of the three kinds, given neither flag, is written with the landing read off the mark", async () => {
  for (const [kind, argv] of Object.entries(KINDS)) {
    const before = posted("outside-uuid").length;
    const run = await forge("record", kind, "ISS-38", ...argv);
    assert.equal(run.status, 0, `${kind}: ${run.stdout}${run.stderr}`);
    assert.match(run.stderr, /--landing https:\/\/mowmentbrand\.com\/products\/\{classic-baseball-button-jersey,pro-match-soccer-jersey\}, from the merged mark's landing\./u,
      `${kind}: says where the value came from`);
    assert.equal(posted("outside-uuid").length, before + 1, `${kind}: one record went up`);
    const body = lastPosted("outside-uuid");
    assert.ok(body.includes(`landing: ${PLACE}`), `${kind}: the record holds the place verbatim`);
    assert.doesNotMatch(body, /^commit: /mu, `${kind}: and no commit`);
  }
});

test("each of the three kinds given --commit, or --contains, on such an issue is refused naming --landing", async () => {
  const cases = [["verdict", ["--commit", HEAD]], ["review", ["--commit", HEAD]], ["verification", ["--commit", HEAD]],
    ["verification", ["--contains", HEAD]]];
  for (const [kind, extra] of cases) {
    const before = posted("outside-uuid").length;
    const run = await forge("record", kind, "ISS-38", ...KINDS[kind], ...extra);
    assert.equal(run.status, 1, `${kind} ${extra[0]}: ${run.stdout}`);
    assert.match(run.stderr, new RegExp(`record ${kind}: ${extra[0]} names a commit, and the tracker says this issue lands outside git`, "u"));
    assert.match(run.stderr, /Nothing was sent\..*\n {2}--landing '<where the change now is>'/u);
    assert.equal(posted("outside-uuid").length, before, `${kind} ${extra[0]}: nothing was written`);
  }
});

test("each of the three kinds given --landing on a git issue is refused naming --commit", async () => {
  for (const [kind, argv] of Object.entries(KINDS)) {
    const run = await forge("record", kind, "ISS-99", ...argv, "--landing", PLACE);
    assert.equal(run.status, 1, `${kind}: ${run.stdout}`);
    assert.match(run.stderr, new RegExp(`record ${kind}: --landing names a place a change landed outside git, and the tracker says this issue lands in git`, "u"));
    assert.match(run.stderr, /\n {2}--commit <sha>/u);
    assert.deepEqual(posted("git-uuid"), [], `${kind}: nothing was written`);
  }
});

test("the baseline of such an issue still takes and asks for its commit", async () => {
  const bare = await forge("record", "baseline", "ISS-38", "--gate", "none", "--result", "nothing fails", "--scope", "whole");
  assert.equal(bare.status, 1, bare.stdout);
  assert.match(bare.stderr, /record baseline needs --commit \(commit\), and no merged mark on this issue names one/u);
  const run = await forge("record", "baseline", "ISS-38", "--gate", "none", "--result", "nothing fails",
    "--commit", HEAD, "--scope", "whole");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.ok(lastPosted("outside-uuid").includes(`commit: ${HEAD}`), "the commit the gate ran at, as asked");
});

test("a record written with a landing shows it under its own key, and resume names the mark's landing", async () => {
  const shown = posted("outside-uuid").filter((one) => /^landing: /mu.test(one.body));
  assert.ok(shown.length >= 3, "each of the three kinds' records carries it");
  for (const one of shown) {
    assert.ok(one.body.split("\n").includes(`landing: ${PLACE}`), "the place verbatim, under its own key");
    assert.doesNotMatch(one.body, /^commit: /mu, "and never under the key a commit is read from");
  }
  const run = await forge("resume", "ISS-40");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /a merged mark at 2026-09-30T09:00, landed outside git at https:\/\/mowmentbrand\.com\/products\/\{classic/u);
});

test("the four kinds' help describes --landing and the shape it applies under", async () => {
  for (const kind of ["merged", "verdict", "review", "verification"]) {
    const run = await forge("record", kind, "-h");
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /--landing L/u, `${kind}: on its row`);
    assert.match(run.stdout, /outside git/u, `${kind}: and when it applies`);
  }
});
