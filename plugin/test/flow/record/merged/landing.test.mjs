/* The mark of an issue the tracker says lands outside git: the place the change now is, sent as the
   tracker's own `landing`, and no git clause beside it (ISS-2402). End to end against a tracker, beside
   an issue landing in git, so each shape's refusal of the other's flags is watched from both sides. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { git, ranAsync, tempHome, tempRoom } from "../../../fixtures.mjs";
import { trackerFor } from "../../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("record-merged-landing").path;
const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;

const ROOM = tempRoom("record-merged-landing-repo-");
spawnSync("git", ["init", "-q", "-b", "master", ROOM], { cwd: ROOM, encoding: "utf8" });
writeFileSync(join(ROOM, "a.md"), "one\n");
git(ROOM, "add", "-A");
git(ROOM, "commit", "-qm", "the change");
const HEAD = git(ROOM, "rev-parse", "HEAD").stdout.trim();

const PLACE = "https://mowmentbrand.com/products/{classic-baseball-button-jersey,pro-match-soccer-jersey}";

let clock = 0;
const stamped = () => `2026-09-30T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;

const ISSUES = {
  "outside-uuid": { documentId: "outside-uuid", issueId: "ISS-38", status: "in_progress", title: "seven jerseys on the store",
    complexity: "s", landingShape: "outside_git" },
  "git-uuid": { documentId: "git-uuid", issueId: "ISS-99", status: "in_progress", title: "a change in a repository",
    complexity: "s", landingShape: "git" },
};
const byKey = (key) => Object.values(ISSUES).find((one) => one.documentId === key || one.issueId === key);

const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  comments: {},
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: Object.values(ISSUES), returned: 2, hasMore: false };
      if (args.action === "get") return byKey(args.documentId);
      if (args.action === "update") return Object.assign(byKey(args.documentId), args.data);
      if (args.action === "mark_merged") {
        const issue = byKey(args.data.issueId);
        (state.comments[issue.documentId] ??= []).push({ documentId: `mark-${clock + 1}`, createdAt: stamped(),
          authorId: "agent", body: `mark_merged target=${args.data.target} — ${args.data.note}` });
        return Object.assign(issue, { mergedAt: stamped(), mergedLanding: args.data.landing ?? null });
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
await ranAsync(FORGE, ["claim", "ISS-38", "--unheld"], ENV, ROOM);
await ranAsync(FORGE, ["claim", "ISS-99", "--unheld"], ENV, ROOM);

const merged = (ref, ...argv) => ranAsync(FORGE, ["record", "merged", ref, ...argv], ENV, ROOM);
const marks = () => state.calls.filter((one) => one.args.action === "mark_merged");
const fresh = () => {
  state.calls = [];
  for (const one of Object.values(ISSUES)) Object.assign(one, { mergedAt: null, mergedLanding: null });
};

test("an outside-git issue is marked with the landing, which the issue then reads back", async () => {
  fresh();
  const run = await merged("ISS-38", "--landing", PLACE);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(marks().length, 1);
  assert.equal(marks()[0].args.data.landing, PLACE, "sent as the tracker's own landing field");
  assert.equal(ISSUES["outside-uuid"].mergedLanding, PLACE, "and the issue reads back the place given");
  assert.match(run.stdout, /^ISS-38 {2}marked merged outside git, at https:\/\/mowmentbrand\.com/mu);
});

test("an outside-git mark given any git clause or --to is refused before any write, naming --landing", async () => {
  for (const extra of [["--at", HEAD], ["--reviewed", HEAD], ["--judged", HEAD], ["--moved", "nothing"],
    ["--wrote", "a.md"], ["--to", "master"]]) {
    fresh();
    const run = await merged("ISS-38", "--landing", PLACE, ...extra);
    assert.equal(run.status, 1, `${extra[0]}: ${run.stdout}`);
    assert.match(run.stderr, new RegExp(`${extra[0]} is a clause of the git mark and would be dropped unread`, "u"));
    assert.match(run.stderr, /Name the landing:\n {2}forge record merged ISS-38 --landing '</u);
    assert.equal(marks().length, 0, `${extra[0]}: nothing was written`);
  }
});

test("an outside-git mark naming no landing is refused before any write, printing the --landing form", async () => {
  fresh();
  const run = await merged("ISS-38");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /this call names none, so nothing was written\. Name the landing:\n {2}forge record merged ISS-38 --landing '<where the change now is: a URL, a CMS entry, a store resource>'/u);
  assert.equal(marks().length, 0);
});

test("a git issue given --landing is refused before any write, naming the git clauses", async () => {
  fresh();
  const run = await merged("ISS-99", "--landing", PLACE);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /the tracker says ISS-99 lands in git, so its mark names the commit and the heads instead/u);
  assert.match(run.stderr, /forge record merged ISS-99 --at <the sha the change landed at> --reviewed/u);
  assert.equal(marks().length, 0);
});

test("a git issue's mark from its five clauses sends no landing", async () => {
  fresh();
  const run = await merged("ISS-99", "--at", HEAD, "--reviewed", HEAD, "--judged", HEAD, "--wrote", "a.md");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(marks().length, 1);
  assert.equal(Object.hasOwn(marks()[0].args.data, "landing"), false, "the field is not on the request at all");
  assert.match(marks()[0].args.data.note, new RegExp(`^merged to master at ${HEAD}; reviewed head ${HEAD};`, "u"));
});

test("a landing that is blank, too long, on several lines or shaped like a sha is refused before any write", async () => {
  const refused = ["  ", "x".repeat(2001), "https://a.example/one\nhttps://a.example/two", "c8c3550",
    "C8C3550", "c8c3550c1b7e1a3f4d5e6f708192a3b4c5d6e7f8"];
  for (const landing of refused) {
    fresh();
    const run = await merged("ISS-38", "--landing", landing);
    assert.equal(run.status, 1, `${landing.slice(0, 20)}: ${run.stdout}`);
    assert.match(run.stderr, /^--landing takes /mu, landing.slice(0, 20));
    assert.equal(marks().length, 0, `${landing.slice(0, 20)}: nothing was written`);
  }
  for (const landing of ["c8c355", "c8c3550c1b7e1a3f4d5e6f708192a3b4c5d6e7f80", "x".repeat(2000)]) {
    fresh();
    const run = await merged("ISS-38", "--landing", landing);
    assert.equal(run.status, 0, `${landing.slice(0, 20)}: ${run.stdout}${run.stderr}`);
    assert.equal(marks()[0].args.data.landing, landing, "a value no reader takes for a sha is taken");
  }
});
