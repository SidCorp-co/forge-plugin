/* The note the merged mark carries, fitted to the room the tracker gives it: what it keeps, what it
   leaves out, and the two notes it refuses rather than fit, each with the write that clears it. The
   composer is text in and text out, so only the correction its refusal prints is run as a verb. */
import assert from "node:assert/strict";
import test from "node:test";

import { git, ranAsync, tempHome, tempRoom } from "../../../fixtures.mjs";
import { trackerFor } from "../../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("record-merged-fitted").path;
const { markNote } = await import("../../../../src/flow/record/merged.mjs");
const { landingMoved, landingWrote, markedCommit } = await import("../../../../src/flow/record/judged/mark-read.mjs");
const { capsOf, lengthOf } = await import("../../../../src/tracker/field-write.mjs");

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const AT = "a".repeat(40);
const REVIEWED = "b".repeat(40);
const JUDGED = REVIEWED;

const ROOM = tempRoom("record-merged-fitted-");
git(ROOM, "init", "-q", "-b", "master");
const ISSUE = { documentId: "fitted-uuid", issueId: "ISS-99", status: "in_progress", title: "a change that grew", complexity: "s" };
const state = {
  config: { baseBranch: "master" },
  comments: {},
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: [ISSUE], returned: 1, hasMore: false };
      if (args.action === "update") return Object.assign(ISSUE, args.data);
      return ISSUE;
    },
    forge_comments: (args) => {
      const held = (state.comments[args.data?.issue ?? args.filters?.issue] ??= []);
      if (args.action === "list") return { comments: held, returned: held.length, hasMore: false };
      held.push({ documentId: `c-${held.length}`, createdAt: "2026-09-08T10:00:00.000Z", authorId: "agent", body: args.data.body });
      return { documentId: `c-${held.length - 1}` };
    },
  },
};
const { tracker, env: ENV } = await trackerFor(state, [ROOM]);
test.after(() => tracker.close());
await ranAsync(FORGE, ["claim", "ISS-99", "--unheld"], ENV, ROOM);

/* ISS-730's fixture, and the shape ISS-673 landed with: 119 paths whose whole list is some 4700 code
   points, of which the plan names the last 90. The note cannot carry them all, and what it keeps is
   chosen rather than cut — every path the plan does not name is what `developed` reads. */
const CASES = Array.from({ length: 119 },
  (_, at) => `plugin/src/flow/record/case-${String(at).padStart(3, "0")}.mjs`);
const OWED = CASES.slice(0, 29);
const PLANNED = CASES.slice(29).join("\n");
const fixture = (over = {}) =>
  markNote({ branch: "master", at: AT, reviewed: REVIEWED, judged: JUDGED, moved: [], wrote: CASES,
    named: PLANNED, ref: "ISS-99", ...over });

test("a change of 119 paths composes a note the tracker takes, and says what it left out", () => {
  const note = fixture();
  const room = capsOf().note.self;
  assert.equal(room, 2000, "the room is the route table's own cap for the field, and no other number");
  assert.ok(lengthOf(note) <= room, `the note is ${lengthOf(note)} code points:\n${note}`);
  const mark = [{ documentId: "m", createdAt: "2026-09-08T10:00:00.000Z", body: `mark_merged — ${note}` }];
  const kept = landingWrote({ comments: mark });
  assert.match(note, new RegExp(`holds ${kept.length} of this change's 119 paths and leaves out `
    + `${119 - kept.length} the plan names`, "u"), "the clause standing in for the rest counts both halves");
  assert.match(note, /whole list is the diff of the judged head above against its base/u,
    "and says where the whole list is read from, the note being no longer the record of it");
  assert.deepEqual(landingMoved({ comments: mark }), [], "while the other path clause reads as it was written");
  assert.equal(markedCommit({ comments: mark }), AT, "and no word of that clause is taken for a sha");
});

test("every path the plan does not name is in the clause, and the ones it names fill the rest", () => {
  const note = fixture();
  const kept = landingWrote({ comments: [{ documentId: "m", createdAt: "2026-09-08T10:00:00.000Z", body: `mark_merged — ${note}` }] });
  assert.deepEqual(kept.slice(0, OWED.length), OWED,
    "the 29 the plan names nowhere go in first, or `developed` would pass a change that grew");
  assert.ok(kept.length > OWED.length, "and what room is left goes to the ones it does name");
  assert.ok(kept.every((one) => CASES.includes(one)), "every one of them still a path and none of them cut");
});

/* The correction is the one `developed` asks for in any case, and it is what makes the note fit:
   named there, those paths are ones the composer may leave out. */
test("a note whose unnamed paths alone overrun it is refused, with the correction that clears them", async () => {
  const UNPLANNED = "the plan names none of them";
  let said = "";
  assert.throws(() => fixture({ named: UNPLANNED }), (error) => {
    assert.match(error.message, /over the 2000 the tracker takes with only the 119 path\(s\) the plan/u);
    assert.match(error.message, /none of them may be left out: nothing was written/u);
    assert.match(error.message, /forge record correction ISS-99 --corrects plan --moved "the change also wrote /u);
    said = error.message;
    return true;
  });
  const budget = capsOf("forge_comments").recordField.self;
  const forms = said.split("\n").map((line) => line.trim()).filter((line) => line.startsWith("forge record correction"));
  const moveds = forms.map((line) => /--moved "([^"]*)"/u.exec(line)[1]);
  assert.ok(forms.length > 1, `the paths are split, not printed as one value:\n${said}`);
  assert.match(said, new RegExp(`\\n {2}${forms.length} corrections, one per line, each \`--moved\` within the ${budget} code points`, "u"));
  for (const moved of moveds) assert.ok(lengthOf(moved) <= budget, `${lengthOf(moved)} code points: ${moved}`);
  const named = moveds.flatMap((moved) => moved.replace(/^the change also wrote /u, "").split(", "));
  assert.deepEqual(named, CASES, "every path named once, in the order the landing wrote them");
  const run = await ranAsync(FORGE, ["record", "correction", "ISS-99", "--corrects", "plan",
    "--moved", moveds[0], "--why", "the plan named none of them"], ENV, ROOM);
  assert.equal(run.status, 0, `one printed command passes the correction verb's own screening:\n${run.stderr}`);
  assert.ok(lengthOf(fixture({ named: [UNPLANNED, ...moveds].join("\n") })) <= capsOf().note.self,
    "and once the corrections stand, the mark they cleared fits the note");
  assert.ok(lengthOf(fixture({ named: "", wrote: CASES })) <= capsOf().note.self,
    "while a change with no plan at all is read against nothing, so the note may leave any of them out");
});

test("the clause a landing moved is never shortened, and the note that cannot hold it is refused", () => {
  assert.throws(() => fixture({ moved: CASES, named: PLANNED }), (error) => {
    assert.match(error.message, /with the shortest written path in it and no other/u);
    assert.match(error.message, /`landing moved` clause: nothing was written/u);
    assert.match(error.message, /Name the directory those paths are under\./u);
    return true;
  });
});

/* Paths are not one length, and the fitting is measured and not counted: a long one first would
   otherwise refuse a note a short one fits in, and a long one in the middle would end the fill with
   room to spare. */
test("a path the room cannot take is passed over, and the ones it can take go in", () => {
  const wide = `plugin/src/flow/record/${"w".repeat(400)}.mjs`;
  const thin = ["plugin/src/flow/record/thin-one.mjs", "plugin/src/flow/record/thin-two.mjs"];
  const filler = Array.from({ length: 30 },
    (_, one) => `docs/moved/${String(one).padStart(3, "0")}-${"m".repeat(30)}.md`);
  const wrote = [wide, ...thin];
  const note = markNote({ branch: "master", at: AT, reviewed: REVIEWED, judged: JUDGED,
    moved: filler, wrote, named: wrote.join("\n"), ref: "ISS-99" });
  assert.ok(lengthOf(note) <= capsOf().note.self, `${lengthOf(note)} code points:\n${note}`);
  const kept = landingWrote({ comments: [{ documentId: "m", createdAt: "2026-09-08T10:00:00.000Z", body: `mark_merged — ${note}` }] });
  assert.deepEqual(kept, thin, "the two the room takes, and neither of them the first path given");
  assert.match(note, /holds 2 of this change's 3 paths and leaves out 1 the plan names/u);
  assert.deepEqual(landingMoved({ comments: [{ documentId: "m", createdAt: "2026-09-08T10:00:00.000Z", body: `mark_merged — ${note}` }] }),
    filler, "while every path the landing moved is still named, that clause being the one never shortened");
});
