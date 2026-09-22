/* What the closing rung asks of a project whose production deploy is the project's own key rather
   than the tracker's flag (ISS-2190). The refusals themselves are entry-checks.test.mjs's; what is
   judged here is that the key reaches them — the reader tests `view.release?.autoProd` alone, so a
   key resolved anywhere but inside the policy would leave this rung reading the level it moved off. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("release-switch").path;
const { render } = await import("../../../src/flow/record/page.mjs");
const { deployedOwed, viewFrom } = await import("../../../src/flow/earned.mjs");
const { releaseFrom } = await import("../../../src/tracker/project-config.mjs");

const NOTE = "merged to master at 43b811e; reviewed head 43b811e; judged head 43b811e; "
  + "landing moved nothing; landing wrote nothing";

let clock = 0;
const at = () => `2026-09-02T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body) => ({ createdAt: at(), authorId: "agent", body });

/* A verification asserting a deploy and naming none: the shape the rung refuses where production is
   automatic and takes where it is a person's. */
const ASSERTED = [
  comment(`mark_merged target=base — ${NOTE}`),
  comment(render("verification", { where: "https://app.example", commit: "43b811e", evidence: ["43b811e"] })),
];

const owed = (autoProdDeploy, release) => deployedOwed(
  viewFrom("the-uuid", { attachments: [{ name: "run.txt" }], releaseNotes: { section: "Fixed" } },
    ASSERTED, null,
    releaseFrom({ baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy } },
      { value: release, from: "the project's own record" })),
  "ISS-3",
);

test("a project declaring it releases on its own owes the deploy proof, whatever the tracker's flag says", () => {
  const refused = owed(false, "auto");
  assert.equal(refused.length, 1, "the local key is what the rung reads, and it says nobody is asked");
  assert.match(refused[0].what, /a sha names no deployment/u);
});

test("a project declaring a person's look owes no deploy proof, whatever the tracker's flag says", () => {
  assert.deepEqual(owed(true, "manual"), [],
    "the rung asks for the proof because nobody is asked, and here somebody is");
});
