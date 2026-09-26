/* What a recheck says about the findings its own set left out: the narrower set dropped them and the
   sentence then claimed the CONSULT found nothing, while the gate refused for the same F1 (ISS-1873). */
import assert from "node:assert/strict";
import test from "node:test";
import { tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves, so anything reading the real log path reads a sandbox. */
const sandbox = tempRoom("forge-codex-log-recheck-");
process.env.XDG_CONFIG_HOME = sandbox;

const {
  recheckMissed,
  recheckOwed,
  recheckPlan,
} = await import("../../../src/codex/log/replies.mjs");

const JUDGED = {
  kind: "consult", id: "c55", ok: true, root: "/a", at: "1", head: "38cac7b7",
  files: ["a.mjs", "docs/FORGE-CLI.md"], send: "bodies",
  sent: [{ rel: "a.mjs", chars: 9, clipped: false }, { rel: "docs/FORGE-CLI.md", chars: 9, clipped: false }],
  reply: "CODEX: 1 findings\n- **New — minor:** `docs/FORGE-CLI.md:12` — the row names a flag that is gone.",
};

test("a set that excluded the judged consult's findings says so and names what reaches them", () => {
  const narrow = recheckOwed(recheckPlan([JUDGED], "/a", ["a.mjs"]), ["a.mjs"]);
  assert.equal(/found nothing/u.test(narrow), false, "the consult found something, and this set is not where");
  assert.match(narrow, /consult c55 made F1 on docs\/FORGE-CLI\.md/u, "the finding by the id its consult gave it, beside the file it is anchored on");
  assert.match(narrow, /othing says what became of F1/u, "and that it is the one a commit gate refuses for");
  assert.match(narrow, /--recheck a\.mjs docs\/FORGE-CLI\.md/u, "with the set that reaches it");

  /* `judgedBy` takes the LAST consult sharing ANY of the files, so a wider set can select a newer one. */
  const newer = { kind: "consult", id: "c77", ok: true, root: "/a", at: "2", files: ["docs/FORGE-CLI.md"], send: "bodies", reply: "CODEX: 0 findings" };
  const shadowed = recheckOwed(recheckPlan([JUDGED, newer], "/a", ["a.mjs"]), ["a.mjs"]);
  assert.equal(/--recheck/u.test(shadowed), false, "a route landing on c77 is no route to c55's finding");
  assert.match(shadowed, /lands on consult c77 instead/u);
  assert.match(shadowed, /forge codex verdict --of c55/u, "so the disposition is written where the gate names");

  const ruled = recheckOwed(recheckPlan([JUDGED, { kind: "verdict", of: "c55", kept: ["F1"], dropped: {} }], "/a", ["a.mjs"]), ["a.mjs"]);
  assert.equal(/othing says what became of/u.test(ruled), false, "a finding the author ruled on is no gate obligation");
  assert.match(ruled, /already carries your ruling/u);

  /* A reviewer reads beyond what it was sent, so a finding can be anchored where no route reaches. */
  const elsewhere = { ...JUDGED, reply: "CODEX: 1 findings\n- **New — major:** `tools/run.mjs:1` — the lock is released by path." };
  const unreachable = recheckOwed(recheckPlan([elsewhere], "/a", ["a.mjs"]), ["a.mjs"]);
  assert.equal(/--recheck/u.test(unreachable), false, "a route that leaves the finding out again is no route");
  assert.match(unreachable, /anchored on a file that consult never recorded/u);
  assert.match(unreachable, /forge codex verdict --of c55/u);

  const empty = recheckOwed(recheckPlan([{ ...JUDGED, reply: "CODEX: 0 findings" }], "/a", ["a.mjs"]), ["a.mjs"]);
  assert.match(empty, /read this set whole/u, "a consult that made no findings still gets the coverage sentence");
  assert.equal(recheckMissed(recheckPlan([JUDGED], "/a", ["a.mjs", "docs/FORGE-CLI.md"])), null, "every finding inside the set: nothing left out");
});

/* One finding inside the set and one outside: the recheck runs, and says what it does not reach. */
test("a recheck that does go ahead names the finding its set does not reach", () => {
  const both = { ...JUDGED, reply: `${JUDGED.reply}\n- **New — major:** \`a.mjs:3\` — the lock is released by path.` };
  const plan = recheckPlan([both], "/a", ["a.mjs"]);
  assert.deepEqual(plan.ids, ["F2"], "only the finding this set holds is verified");
  assert.equal(recheckOwed(plan, ["a.mjs"]), null, "there is something to recheck, so nothing is refused");
  assert.match(recheckMissed(plan), /also made F1 on docs\/FORGE-CLI\.md/u);
  /* This round writes a consult of its own over these files, so a wider recheck answers that one. */
  assert.equal(/--recheck/u.test(recheckMissed(plan)), false, "a route this very round invalidates is not offered");
  assert.match(recheckMissed(plan), /forge codex verdict --of c55/u);
  const settled = recheckPlan([both, { kind: "verdict", of: "c55", kept: ["F1"], dropped: {} }], "/a", ["a.mjs"]);
  assert.equal(recheckMissed(settled), null, "a finding already disposed of holds no gate, so it is not named mid-round");
  const answered = { kind: "consult", id: "c99", ok: true, root: "/a", at: "3", files: ["a.mjs"], send: "bodies", reply: "CODEX: 0 findings" };
  assert.equal(recheckPlan([both, answered], "/a", ["a.mjs", "docs/FORGE-CLI.md"]).judged.id, "c99",
    "which is what a wider recheck would then answer, and why the route was withheld");
});

/* A plan or criteria file lies outside the checkout, so its consult records the real path and the
   reviewer anchors on the name it would write: the two have to meet, or every correction costs a
   fresh whole consult (ISS-2336). */
const OUT = "/tmp/run-9/scratch/criteria.md";
const PLAN = "/tmp/run-9/scratch/plan.md";
const outside = (reply, files = [PLAN, OUT]) => ({
  kind: "consult", id: "o1", ok: true, root: "/a", at: "1", files, send: "bodies",
  sent: files.map((rel) => ({ rel, chars: 9, clipped: false })), reply,
});

test("a recheck over a file outside the checkout reaches the findings anchored on its bare name or its tail", () => {
  const judged = outside("CODEX: 3 findings\n- **New — major:** `criteria.md:4` — two outcomes on one line.\n"
    + "- **New — minor:** `scratch/criteria.md:1` — the clause is cited without its revision.\n"
    + "- **New — minor:** `plan.md:2` — a step names no criterion.");
  const plan = recheckPlan([judged], "/a", [OUT]);
  assert.deepEqual(plan.ids, ["F1", "F2"], "the bare name and the path tail both resolve to the one recorded file");
  assert.match(plan.risks[0], /Your earlier finding F1 .*two outcomes on one line/u, "and each goes to the reviewer as a risk");
  assert.match(plan.risks[1], /Your earlier finding F2 .*without its revision/u);
  assert.equal(recheckOwed(plan, [OUT]), null, "so the recheck has something to verify and is not refused");
  assert.match(recheckMissed(plan, [OUT]), /also made F3 on plan\.md/u, "the finding on the file this set left out is still named");
});

test("a tail two recorded files share is no one's, even where the recheck names only one of them", () => {
  const other = "/tmp/run-7/criteria.md";
  const judged = outside("CODEX: 1 findings\n- **New — major:** `criteria.md:4` — two outcomes on one line.", [OUT, other]);
  const plan = recheckPlan([judged], "/a", [OUT]);
  assert.deepEqual(plan.ids, [], "attributed to neither file");
  const said = recheckOwed(plan, [OUT]);
  assert.match(said, /made F1 on criteria\.md, and this set holds no such file — it holds \/tmp\/run-9\/scratch\/criteria\.md/u,
    "the refusal names the anchor it looked for and the files the set holds");
  assert.match(said, /anchored on a file that consult never recorded — it recorded \/tmp\/run-9\/scratch\/criteria\.md \/tmp\/run-7\/criteria\.md/u);
  assert.match(said, /forge codex verdict --of o1/u, "and the route out is the verdict");
});

test("an anchor naming no recorded file stays out, and a relative path is matched whole", () => {
  const stray = outside("CODEX: 1 findings\n- **New — major:** `notes.md:4` — the lock is released by path.");
  const said = recheckOwed(recheckPlan([stray], "/a", [OUT]), [OUT]);
  assert.match(said, /made F1 on notes\.md, and this set holds no such file — it holds \/tmp\/run-9\/scratch\/criteria\.md/u);
  assert.match(said, /forge codex verdict --of o1/u);
  assert.equal(/--recheck/u.test(said), false, "no recheck reaches it, so none is offered");

  const inside = { ...JUDGED, reply: "CODEX: 1 findings\n- **New — minor:** `FORGE-CLI.md:12` — the row names a flag that is gone." };
  const bare = recheckPlan([inside], "/a", ["docs/FORGE-CLI.md"]);
  assert.deepEqual(bare.ids, [], "a bare name inside the checkout is not resolved to docs/FORGE-CLI.md");
  assert.deepEqual(recheckPlan([JUDGED], "/a", ["docs/FORGE-CLI.md"]).ids, ["F1"], "the exact relative path still matches");
});

test("a file the recheck adds is not handed a finding the consult anchored on a file it never recorded", () => {
  const notes = "/tmp/run-9/scratch/notes.md";
  const judged = outside("CODEX: 1 findings\n- **New — major:** `notes.md:4` — the lock is released by path.", [OUT]);
  const plan = recheckPlan([judged], "/a", [OUT, notes]);
  assert.deepEqual(plan.ids, [], "notes.md was never in the consult's set, so the recheck's copy of it does not reach F1");
  assert.match(recheckOwed(plan, [OUT, notes]), /forge codex verdict --of o1/u);
});
