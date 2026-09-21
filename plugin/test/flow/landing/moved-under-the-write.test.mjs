/* The checkpoint a caller read its eligibility off, asked again at the write. `landingSaved` rereads
   the field and judges the move against the table alone, which cannot tell a checkpoint that stood
   still from one somebody replaced with another the table would also allow — and the release that
   finishes a `ready` checkpoint reads state and branch a request earlier than it writes (ISS-1654). */
import assert from "node:assert/strict";
import test from "node:test";

import { projectRoom, tempHome, tempRoom } from "../../fixtures.mjs";
import { OWN, trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("landing-moved-under").path;
/* Away from this checkout, whose git directory names the run this suite is written under: a
   checkout of its own names none, and its project is a record beside the machine's own keys
   rather than a file in the tree. */
const AWAY = projectRoom(tempRoom("landing-moved-under-away-"), process.env.XDG_CONFIG_HOME, OWN);
process.chdir(AWAY);
const HOLDER = "iss-673-abcdef12";
process.env.FORGE_SESSION_ID = HOLDER;

const UUID = "landing-uuid";
const REF = "ISS-673";
const AT = "2026-09-07T12:00:00.000Z";

const built = (over = {}) => ({
  state: "ready",
  builder: HOLDER,
  branch: "iss-673",
  head: "9e24c2af0000000000000000000000000000abcd",
  base: "c4890050000000000000000000000000000dcba",
  files: ["plugin/src/flow/lease.mjs"],
  at: AT,
  ...over,
});

const lease = { holder: HOLDER, agent: "a-test-agent", pid: "4242",
  renewedAt: new Date().toISOString(), minutes: 60, next: null, history: [] };

/** The read the caller decides on, then whatever this case says the field holds by the write. */
let swap = null;
let reads = 0;

const state = {
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [{ documentId: UUID, issueId: REF, status: "developed", title: "one flow: the landing",
    description: "no mark here", sessionContext: { landing: built(), lease } }],
  comments: { [UUID]: [] },
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      const [row] = state.issues;
      if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
      if (args.action === "get") {
        reads += 1;
        if (swap && reads > 1) row.sessionContext = { ...row.sessionContext, landing: swap };
        return row;
      }
      if (args.action === "update") state.issues[0] = { ...row, ...(args.data ?? {}) };
      return state.issues[0];
    },
    forge_comments: (args) => (args.action === "list" ? { comments: [], returned: 0, hasMore: false } : {}),
  },
};

const { tracker, env: ENV } = await trackerFor(state, [AWAY]);
Object.assign(process.env, ENV);
test.after(() => tracker.close());

const { landingSaved, readContext } = await import("../../../src/flow/lease.mjs");
const { landingMoved, landingOf } = await import("../../../src/flow/landing/checkpoint.mjs");
const { Refusal, refusing } = await import("../../../src/resolve/settings.mjs");

const writing = async (moved) => {
  swap = moved;
  reads = 0;
  state.issues[0].sessionContext = { landing: built(), lease };
  const was = landingOf(await readContext(UUID));
  try {
    await refusing(() => landingSaved(UUID, REF, { state: "done" }, { was }));
    return null;
  } catch (error) {
    if (error instanceof Refusal) return error.message;
    throw error;
  }
};

test("a checkpoint replaced between the read and the write is refused, naming what moved", async () => {
  const said = await writing(built({ branch: "iss-999" }));
  assert.match(said ?? "", /moved between the read this write was decided on and the write/u, String(said));
  assert.match(said ?? "", /branch reads `iss-999` and not `iss-673`/u, String(said));
  assert.equal(landingOf(state.issues[0].sessionContext).state, "ready",
    "the write landed over a checkpoint this caller never read");
});

/* The state the table would let through on its own: `marked` names `done` as a successor, so nothing
   but this guard separates a release finishing what it read from one finishing somebody else's. */
test("a checkpoint moved to a state the table would allow the move from is refused too", async () => {
  const said = await writing(built({ state: "marked" }));
  assert.match(said ?? "", /state reads `marked` and not `ready`/u, String(said));
  assert.equal(landingOf(state.issues[0].sessionContext).state, "marked",
    "a state the caller did not read was written over");
});

test("a checkpoint that stood still takes the write", async () => {
  assert.equal(await writing(null), null, "the guard refused a field nothing moved");
  assert.equal(landingOf(state.issues[0].sessionContext).state, "done",
    "the write did not land on a checkpoint that stood still");
});

test("the reading itself is the three fields eligibility was read on", () => {
  const was = landingOf({ landing: built() });
  assert.equal(landingMoved(was, was), null, "a checkpoint compared with itself reads as moved");
  assert.equal(landingMoved(null, landingOf({ landing: built() })), null, "no read is no claim");
  assert.match(landingMoved(was, null) ?? "", /no checkpoint on it any more/u,
    "a checkpoint that was cleared reads as unmoved");
  assert.equal(landingMoved(was, landingOf({ landing: built({ at: "2027-01-01T00:00:00.000Z" }) })), null,
    "a field eligibility was never read on refuses the write");
  for (const [name, value] of [["state", "marked"], ["branch", "iss-999"], ["head", "0".repeat(40)]]) {
    assert.match(landingMoved(was, landingOf({ landing: built({ [name]: value }) })) ?? "",
      new RegExp(`${name} reads`, "u"), `${name} moved and the guard said nothing`);
  }
});
