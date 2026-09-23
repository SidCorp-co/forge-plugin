/* `--owed` beside a park or a drop: the move asked before it is made, which until ISS-12 was refused,
   so the only way to learn what a drop did was to drop — and a dry run dropped ISS-3 for real. */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("park-rehearsal").path;

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

let clock = 0;
const at = () => `2026-09-02T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body) => ({ documentId: `comment-${clock + 1}`, createdAt: at(), authorId: "agent", body });

const issue = (number, status, extra = {}) => ({
  documentId: `issue-${number}`,
  issueId: `ISS-${number}`,
  status,
  title: `the issue at ${status}`,
  description: "no mark here",
  ...extra,
});
const PARKING = issue(71, "confirmed");
const LANDED = issue(72, "developed");
const DROPPING = issue(73, "approved");
const MERGED = issue(74, "approved", { mergedAt: "2026-09-01T09:00:00.000Z" });

const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [PARKING, LANDED, DROPPING, MERGED],
  comments: {},
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      const found = state.issues.find((one) => one.documentId === args.documentId);
      if (args.action === "get") return found ?? {};
      if (args.action === "update" && found) return Object.assign(found, args.data);
      if (args.action === "transition" && found) {
        found.status = args.data.status;
        return { ...found };
      }
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    forge_comments: (args) => {
      if (args.action !== "list") {
        const one = comment(args.data.body.replace(/^⟦[^⟧]*⟧\n|\n⟦[^⟧]*⟧$/gu, ""));
        (state.comments[args.data.issue] ??= []).push(one);
        return { documentId: one.documentId };
      }
      const held = state.comments[args.filters?.issue] ?? [];
      return { comments: held, returned: held.length, hasMore: false };
    },
  },
};
const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());
for (const one of state.issues) await ranAsync(FORGE, ["claim", one.issueId, "--unheld"], ENV);

const advance = (...argv) => ranAsync(FORGE, ["advance", ...argv], ENV);
/* Every write a park or a drop could make: the move, the record, and the lease field an update carries. */
const writes = () => state.calls.filter((one) => one.args.action === "transition"
  || one.args.action === "update" || (one.name === "forge_comments" && one.args.action === "create")).length;
const RECORD = /The park record, posted [^\n]*:\n\n/u;
const rehearsed = (stdout) => stdout.split(RECORD)[1];
const lastBody = (reference) => state.comments[reference].at(-1).body;
const PARK = ["--park", "screen-review", "--why", "the new column has to be looked at", "--evidence", "c8c3550"];

test("a park rehearsed prints what it would send and writes nothing", async () => {
  const before = writes();
  const run = await advance("ISS-71", "--owed", ...PARK);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(writes(), before, "no transition, no comment and no lease write went to the tracker");
  assert.equal(PARKING.status, "confirmed");
  assert.match(run.stdout, /^ {2}ISS-71 {2}confirmed -> waiting$/mu, "the status it leaves and the one it enters");
  assert.match(run.stdout, /^ {2}reason: the new column has to be looked at$/mu, "the reason the move sends");
  assert.match(run.stdout, /^ {2}waitingKind: needs_decision$/mu, "and the kind the tracker demands beside it");
});

test("a park rehearsed prints the record the park then posts, byte for byte", async () => {
  const shown = rehearsed((await advance("ISS-71", "--owed", ...PARK)).stdout);
  const run = await advance("ISS-71", ...PARK);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(shown, `${lastBody("issue-71")}\n`);
});

test("a park the real move refuses is rehearsed as refused, in the real refusal's words, exiting zero", async () => {
  Object.assign(PARKING, { status: "confirmed" });
  const bare = ["--park", "code-review", "--why", "read the diff"];
  const before = writes();
  const run = await advance("ISS-71", "--owed", ...bare);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(writes(), before);
  const real = await advance("ISS-71", ...bare);
  assert.equal(real.status, 1, real.stdout);
  assert.match(run.stdout, /the code-review park of ISS-71 would be refused\./u);
  assert.ok(run.stdout.includes(real.stderr.trim()), `${run.stdout}\n---\n${real.stderr}`);
});

test("a drop the real move refuses is rehearsed as refused, in the real refusal's words, exiting zero", async () => {
  for (const reference of ["ISS-72", "ISS-74"]) {
    const before = writes();
    const run = await advance(reference, "--owed", "--drop", "--why", "nobody wants it");
    assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
    assert.equal(writes(), before, reference);
    const real = await advance(reference, "--drop", "--why", "nobody wants it");
    assert.equal(real.status, 1, real.stdout);
    assert.match(run.stdout, new RegExp(`the drop of ${reference} would be refused\\.`, "u"));
    assert.ok(run.stdout.includes(real.stderr.trim()), `${run.stdout}\n---\n${real.stderr}`);
  }
});

test("a drop the real move takes is rehearsed as the dropped park record and the side status it enters", async () => {
  const before = writes();
  const run = await advance("ISS-73", "--owed", "--drop", "--why", "nobody wants it");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(writes(), before);
  assert.match(run.stdout, /^ {2}ISS-73 {2}approved -> dropped$/mu);
  const shown = rehearsed(run.stdout);
  assert.match(shown, /kind: dropped/u);
  const real = await advance("ISS-73", "--drop", "--why", "nobody wants it");
  assert.equal(real.status, 0, `${real.stdout}${real.stderr}`);
  assert.equal(shown, `${lastBody("issue-73")}\n`);
});

test("--owed beside --set or --reopen is still refused, naming the park and the drop it rehearses", async () => {
  for (const form of [["--set", "open", "--why", "w"], ["--reopen", "--why", "w"]]) {
    const run = await advance("ISS-71", "--owed", ...form);
    assert.equal(run.status, 1, form.join(" "));
    assert.match(run.stderr, /--owed rehearses a park or a drop/u, run.stderr);
  }
});
