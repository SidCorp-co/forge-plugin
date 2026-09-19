/* What a recheck says about the findings its own file set left out. The narrower set dropped the
   judged consult's findings and the sentence then claimed the CONSULT had found nothing, while the
   commit gate went on refusing for the same unruled F1 (ISS-1873). */
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

  const empty = recheckOwed(recheckPlan([{ ...JUDGED, reply: "CODEX: 0 findings" }], "/a", ["a.mjs"]), ["a.mjs"]);
  assert.match(empty, /read this set whole and found nothing/u, "a consult that made no findings still gets the coverage sentence");
  assert.equal(recheckMissed(recheckPlan([JUDGED], "/a", ["a.mjs", "docs/FORGE-CLI.md"])), null, "every finding inside the set: nothing left out");
});

/* One finding inside the set and one outside: the recheck runs, and says what it does not reach. */
test("a recheck that does go ahead names the finding its set does not reach", () => {
  const both = { ...JUDGED, reply: `${JUDGED.reply}\n- **New — major:** \`a.mjs:3\` — the lock is released by path.` };
  const plan = recheckPlan([both], "/a", ["a.mjs"]);
  assert.deepEqual(plan.ids, ["F2"], "only the finding this set holds is verified");
  assert.equal(recheckOwed(plan, ["a.mjs"]), null, "there is something to recheck, so nothing is refused");
  assert.match(recheckMissed(plan), /also made F1 on docs\/FORGE-CLI\.md/u);
  assert.match(recheckMissed(plan), /--recheck a\.mjs docs\/FORGE-CLI\.md/u, "and names the same route");
});
