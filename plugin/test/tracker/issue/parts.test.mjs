/* The parts predicate alone: ISS-336's cases are four paragraphs long and shape.test.mjs has no
   budget left. The six the narrowing must not move stay there, beside the reader they assert on. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

const home = tempHome("issue-parts");
process.env.XDG_CONFIG_HOME = home.path;
const { partsIn } = await import("../../../src/tracker/issue-shape.mjs");

/* The four bodies refused on 2026-09-05, the renamed noun put back. The first is exact, ISS-332's
   Outcome paragraph with `a guide` read back as `a guide part`; the other three are reconstructions,
   the noun where ISS-336's comment says it stood. `iss-336-drafts.txt` on the issue is those four. */
const DRAFTS = [
  "Before a write lands on a file in the restart set — through Edit, Write, or a shell command carrying a write shape and that path — the gate holds once, per file per session, with one message: this file reaches a session only at its next start, and every open session runs the old copy until then; say in one line why no other home fits — a rule with a checker belongs under `plugin/src/` where the CLI serves it live, method text in a guide part (`forge guide <skill> <section>`), a reason in `docs/cli/`; then re-send. A re-send with the line passes; the line is kept in the hook log so the ship's restart step can print it beside the file. The gate holds writes only — a read of a guarded path is not a write (ISS-302's lesson) — and the check that decides membership is the same reader the ship's step and `forge doctor` use, so when ISS-320 and ISS-321 narrow the set, the gate narrows with them without a change of its own.",
  'On 2026-09-05 `forge new` refused a feature body with the parent-of-parts hold: it read one line as naming three issues as this issue\'s parts, wanted them filed as issues, and cleared with "file each part on its own, and confirm this one as the first of them". The line cross-referenced ISS-302, ISS-320 and ISS-321 and contained the phrase "a guide part".',
  "Each skill under `plugin/skills/` is a stub: the frontmatter Claude Code needs for discovery, the trigger, and one line naming `forge guide <skill>`. The body and each reference are guide parts under `plugin/guides/skills/<skill>.md`, served version-matched by `forge guide <skill> [<section>]` through the registry seam ISS-321 landed, so a change to a skill's text is live in every open session and owes no restart. The hunk on ISS-322's thread is what wires the seam.",
  "After ISS-321's trim the skills still carry prose that is neither a rule nor a route. `plugin/guides/skills/forge/guide.md` spends six figures (3,895 characters, 153 against 4,202, 4,078, 6,602 against 1,700) to justify two rules that each fit one line: pass a path when the file exists and never create one to pass, and read one part of one body before the whole. `references/verification.md` carries the measurement ISS-290 was filed on (1,191 gate runs over 97 flow runs, five a run, 1.3 after a ship) beside the rule it justifies.",
];

test("a parts word beside two keys it does not govern is a cross-reference and no split", () => {
  for (const draft of DRAFTS) {
    assert.equal(partsIn(draft), null,
      `held as a parent filing: ${draft.slice(0, 60)}…`);
  }
  assert.equal(partsIn("ISS-158 covers the read-first gate in part, ISS-160 and ISS-162 cover "
    + "the write, and ISS-171 is the same body filed twice."), null,
    "the sixth hold on the record: a review paragraph enumerating keys, qualified with `in part`");
});

const SPLITS = [
  "Parts: ISS-48 and ISS-58 are the halves of it.",
  "Its parts are ISS-48 and ISS-58.",
  "Children: ISS-48, ISS-58.",
  "This consists of ISS-48 and ISS-58.",
  "This is made up of ISS-48 and ISS-58.",
  "Sub-issues: ISS-48, ISS-58.",
  "Sub-issues: **ISS-48** and **ISS-58**.",
  "Parts: `ISS-48` and `ISS-58`.",
  "**Parts:** ISS-48 and ISS-58.",
  "**Parts**: ISS-48 and ISS-58.",
  "This is split into ISS-48 (the parser) and ISS-58 (the renderer).",
  "Its parts are ISS-48 (the read) and ISS-58 (the write).",
  "This is split into ISS-48 (the parser, as ISS-99 asked) and ISS-58.",
];

test("every phrase still holds the keys it governs, whatever reaches them", () => {
  for (const line of SPLITS) {
    assert.deepEqual(partsIn(line)?.keys, ["ISS-48", "ISS-58"], `no split read off: ${line}`);
  }
  assert.deepEqual(partsIn("This one is split into ISS-48, ISS-58 and ISS-63.")?.keys,
    ["ISS-48", "ISS-58", "ISS-63"], "and a list of three is three parts");
});

test("a label may stand between the keys, but not where a bare part reached them", () => {
  assert.equal(partsIn("method text in a guide part ISS-302 (the lesson) and ISS-320 narrow it."), null,
    "the label is what carries a cross-reference across two keys, so a bare part owes a connective");
  assert.equal(partsIn("This is split into ISS-48 and (unrelated reference) ISS-58."), null,
    "and a parenthetical standing where the next part should is no label of the one before it");
});

test("the phrase that governs need not be the first on the line", () => {
  assert.deepEqual(partsIn("The parts of the plan, and its parts are ISS-48 and ISS-58.")?.keys,
    ["ISS-48", "ISS-58"], "stopping at the first occurrence would read this as a cross-reference");
});
