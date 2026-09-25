/* Which project a key is resolved in, and what the resolving costs. The gate aims at the project the
   command will act on rather than at the session's, and that aim is a global setter — so which
   checkout each command start stands in decides both which issues are judged and what may be
   remembered between them. The cases about what counts as a write are `./targets.test.mjs`.

   Both suites run the gate through `./gate.mjs`. */
import assert from "node:assert/strict";
import test from "node:test";

import { OWN } from "../../../fixtures/own-project.mjs";
import { pathed, projectRoom, tempRoom } from "../../../fixtures.mjs";
import { HOME, UUID, because, comment, edgeWrite, gate, issueCalls, owed, raw, state, whole }
  from "./gate.mjs";

/* ISS-1190. Every key resolved under the session's own project, so a command run in a second
   checkout was held on a stranger's thread and the write it was about went unguarded. Two checkouts
   carrying one key and different comments is the shape that tells the two readings apart. */
const OWN_ID = "1e1c1a1e-0000-4000-8000-0000000000ff";
const OTHER_ID = "1e1c1a1e-0000-4000-8000-00000000beef";
const OTHER_SLUG = "second-checkout";
const OTHER_DOC = "7c2f4b21-0ac4-4a1e-9f52-2d1c0a5f6e33";
const OWN_SLUG = OWN.slug;

const SECOND = projectRoom(tempRoom("second-checkout-"), HOME.path, { slug: OTHER_SLUG });
const NOWHERE_AT_ALL = tempRoom("names-no-project-");

/* Both checkouts answer, and the second one's ISS-29 is a different document with a thread of its
   own. The own project keeps the fixture's default rows, so every case above this is unmoved. */
const BOTH = {
  "forge_projects.list": () => ({ projects: [{ id: OWN_ID, slug: OWN_SLUG }, { id: OTHER_ID, slug: OTHER_SLUG }] }),
  forge_issues: (args) => {
    if (args.action !== "list") return {};
    const rows = args.project === OTHER_ID
      ? [{ issueId: "ISS-29", documentId: OTHER_DOC }]
      : state.issues;
    return { issues: rows, returned: rows.length, hasMore: false };
  },
};
const twoProjects = () => {
  state.answer = BOTH;
};
const oneProject = () => {
  delete state.answer;
};

test("a write in a second checkout is held on that checkout's own thread for the key it names", async () => {
  twoProjects();
  owed({
    [UUID]: [comment("own", "the thread of the project this session stands in")],
    [OTHER_DOC]: [comment("second", "the thread of the checkout the command runs in")],
  });
  state.calls = [];
  const run = await gate(`cd ${pathed(SECOND)} && ${edgeWrite()}`);
  assert.equal(run.out.hookSpecificOutput.permissionDecision, "deny");
  assert.ok(because(run).includes("the thread of the checkout the command runs in"),
    "the hold quotes the comments of the project the command will act on");
  assert.ok(!because(run).includes("the thread of the project this session stands in"),
    "and never a stranger's, which is what teaches a reader that the quotations are noise");
  assert.deepEqual([...new Set(issueCalls(0).map((one) => one.slug))], [OTHER_SLUG],
    "every issue lookup the gate made carried the second checkout's project");
  oneProject();
});

test("a command whose directory names no project draws no lookup and refuses nothing", async () => {
  twoProjects();
  whole({ [UUID]: [comment("own", "unread and unquoted")] });
  state.calls = [];
  const run = await gate(`cd ${pathed(NOWHERE_AT_ALL)} && ${edgeWrite()}`);
  assert.equal(run.out, null, "a hold on no evidence is worse than no hold");
  assert.equal(run.status, 0);
  assert.deepEqual(issueCalls(0), [], "and no issue is looked up under a project nobody named");
  oneProject();
});

/* This gate's own answer to a directory no reading can settle, where codex-second's is a refusal:
   the command start aims at no project, so it is dropped rather than resolved in the event's cwd
   (ISS-1455). */
test("a write behind `cd -` draws no lookup and refuses nothing", async () => {
  twoProjects();
  whole({ [UUID]: [comment("own", "unread and unquoted")] });
  state.calls = [];
  const run = await gate(`cd - && ${edgeWrite()}`);
  assert.equal(run.out, null, "the event's own project is not the one `cd -` lands in");
  assert.equal(run.status, 0);
  assert.deepEqual(issueCalls(0), [], "and no issue is looked up under a project nobody named");
  oneProject();
});

test("a command that moves nowhere is resolved in the event's own directory", async () => {
  twoProjects();
  owed({
    [UUID]: [comment("own", "the thread of the project this session stands in")],
    [OTHER_DOC]: [comment("second", "the thread of the checkout the command runs in")],
  });
  state.calls = [];
  const run = await gate(edgeWrite());
  assert.equal(run.out.hookSpecificOutput.permissionDecision, "deny");
  assert.ok(because(run).includes("the thread of the project this session stands in"));
  assert.deepEqual([...new Set(issueCalls(0).map((one) => one.slug))], [OWN_SLUG],
    "the event's own directory is the project, exactly as it was before this rule");
  oneProject();
});

/* ISS-1458. The gate walked a key once per command start and deduped on the documentId after, so
   `forge record plan ISS-45 … && forge advance ISS-45` paid the walk twice — and at three command
   starts the walks overran the ten seconds `hooks.json` registers for the line, which kills the gate
   and lands the tracker write with nothing judging it. */
test("a key several command starts name is walked once, however many name it", async () => {
  whole({});
  const walks = async (starts) => {
    state.calls = [];
    assert.equal((await gate(Array.from({ length: starts }, () => edgeWrite()).join(" && "))).out, null);
    return issueCalls(0).length;
  };
  const once = await walks(1);
  assert.ok(once > 0, "one command start walks the key it names");
  for (const starts of [2, 3, 4]) {
    assert.equal(await walks(starts), once, `${starts} command starts naming one key walk it once`);
  }
});

/* The other half of the same defect: the walks one call does make waited on each other. The raw
   surface is where one group names two keys, a verb naming at most one. */
test("two keys one call names are walked together, never one after the other", async () => {
  whole({});
  state.holds = [];
  state.hold = 150;
  const run = await raw({ action: "archive", documentId: "ISS-29", data: { issueId: "ISS-30" } },
    { session: "probe-together" });
  delete state.hold;
  assert.equal(run.out, null, "neither issue owes a thread, so this is about the walks and not the answer");
  const held = state.holds.filter((one) => /\/issues$/u.test(one.path));
  assert.ok(held.length >= 2, `both keys were walked, and ${held.length} request(s) went out`);
  assert.ok(held.some((one) => held.some((two) =>
    one !== two && one.opened < two.answered && two.opened < one.answered)),
  "two walks were in flight at once, which the serial form never is");
});

/* Why the walk is remembered under the project and not under the key alone: `useProject` is global,
   two command starts can stand in two checkouts, and one key text there is two issues. */
test("one key text in two checkouts is two issues, and both are judged", async () => {
  twoProjects();
  owed({
    [UUID]: [comment("own", "the thread of the project this session stands in")],
    [OTHER_DOC]: [comment("second", "the thread of the checkout the command runs in")],
  });
  state.calls = [];
  const run = await gate(`${edgeWrite()} && cd ${pathed(SECOND)} && ${edgeWrite()}`);
  assert.equal(run.out.hookSpecificOutput.permissionDecision, "deny");
  assert.ok(because(run).includes("the thread of the project this session stands in"));
  assert.ok(because(run).includes("the thread of the checkout the command runs in"),
    "a walk remembered under the key alone would drop this one and leave its write unjudged");
  assert.deepEqual([...new Set(issueCalls(0).map((one) => one.slug))], [OWN_SLUG, OTHER_SLUG]);
  oneProject();
});

/* Codex's own finding on this change: the walks going out together put the tracker's own order in
   front of the command's. A key that is simply not there answers, and one whose request fails does
   not — so the second key's transport failure would have exited from inside the first key's wait,
   and the command would have been refused for the wrong one. The walk is soft for this reason, and
   the refusal is taken in the order the refs came. */
test("two keys that both fail are refused for the first of them, not the first to answer", async () => {
  let asked = 0;
  state.answer = {
    forge_issues: (args) => {
      if (args.action !== "list") return {};
      asked += 1;
      return asked === 2
        ? { refused: "the tracker will not answer this one" }
        : { issues: [], returned: 0, hasMore: false };
    },
  };
  const run = await raw({ action: "archive", documentId: "ISS-29", data: { issueId: "ISS-30" } },
    { session: "probe-both-fail", skipped: ["issue-read-first"] });
  delete state.answer;
  assert.match(run.stderr, /ISS-29 is not on this project's tracker/u,
    "the first ref named is the one the command is refused for");
  assert.doesNotMatch(run.stderr, /the tracker will not answer this one/u,
    "and the second ref's failure, which the tracker answered first, does not take its place");
});
