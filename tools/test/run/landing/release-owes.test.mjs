/* What a release owes the repository once its copy is installed, taken by the landing as the ship
   takes it: the batch reading where the volume since the mark calls for one, the newest gate figure,
   and the ladder's backstop for each change it landed. A landing that grew its own step table ran
   none of the three and read as nothing owed, which is how 64,629 changed lines went unread (ISS-2735). */
import assert from "node:assert/strict";
import test from "node:test";

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import {
  JUDGED_GATE, KEY, NEXT_BRANCH, NEXT_KEY, NEXT_OWNED, forgetInstall, git, installedAt, judging, landingRan, ready,
  seeded, state, tracker, world,
} from "./fixture.mjs";

const { readingTitle } = await import("../../../../plugin/src/git/reviewed.mjs");

test.after(() => tracker.close());

/* One changed line is two in a numstat, so a volume of one is crossed by any change under the path,
   and the path is the one the world holds: a declared path the tree lacks counts nothing. Read once
   per process, so every case here shares it. */
const OWED = { review: { lines: 1, paths: ["plugin/src"] } };

const creates = () => state.calls.filter((one) => one.name === "forge_issues" && one.args.action === "create");

test("a landing past the review volume files the batch reading after its install, beside the gate figure and the member's rung", async () => {
  const { work, head, base } = world({ base: "other", project: OWED });
  git(work, "update-ref", "refs/forge/reviewed", base);
  seeded({ landing: ready(head, base) });
  /* A rung with a ceiling, since a feature has none and its backstop is silent by design. */
  state.issues[0].complexity = "s";
  const said = await landingRan([KEY], work);
  const filed = creates();
  assert.equal(filed.length, 1, `the reading was not filed exactly once:\n${said}`);
  assert.equal(filed[0].args.data.category, "review", "a reading filed as a feature reads as work somebody owes");
  assert.ok(filed[0].args.data.title.includes(`${base.slice(0, 7)}..`), `the title opens at no mark: ${filed[0].args.data.title}`);
  assert.match(said, new RegExp(`a review of ${base.slice(0, 7)}\\.\\.HEAD is owed`, "u"), said);
  const key = state.issues.at(-1).issueId;
  assert.ok(said.includes(`filed ${key}`), said);
  assert.ok(said.includes(`Work ${key}. Use the Skill tool: skill forge:issue-flow, args ${key}.`), said);
  /* The fixture's gate keeps no timing record, so each figure is its reader's own word for none. */
  assert.match(said, /^ {2}the gate: this release's own left no record of what it took/mu, `no gate line after the install:\n${said}`);
  assert.match(said, /whose newest line may be another run's: no run is recorded/u, `no series line after the install:\n${said}`);
  assert.match(said, new RegExp(`${KEY} is a \`fix\` and landed 1 file\\(s\\) and 2 changed line\\(s\\), `
    + "against that rung's ceiling of 15 and 500", "u"), `no ladder backstop for the member:\n${said}`);
});

test("a landing whose owed reading already has an issue names it and files none", async () => {
  const { work, head, base } = world({ base: "other", project: OWED });
  git(work, "update-ref", "refs/forge/reviewed", base);
  seeded({ landing: ready(head, base) });
  state.issues.push({ documentId: "held-reading", issueId: "ISS-501", status: "in_progress",
    title: readingTitle(base, head), createdAt: new Date().toISOString(), sessionContext: {} });
  const said = await landingRan([KEY], work);
  assert.equal(creates().length, 0, `a second row was filed for one mark:\n${said}`);
  assert.match(said, /ISS-501 is in_progress for this mark already, so nothing was filed/u, said);
});

/* Each member over its own commits: the candidate holds both changes, two files and three lines,
   and a backstop measuring that would hold each change to the other's lines as well. */
test("a batch landing holds each member to its own rung over its own commits, never the candidate's", async () => {
  const { work, head, next, base } = world({ base: "other", second: true, project: OWED });
  git(work, "update-ref", "refs/forge/reviewed", base);
  seeded({ landing: ready(head, base), next: ready(next, base, { branch: NEXT_BRANCH, files: [NEXT_OWNED] }) });
  for (const one of state.issues) one.complexity = "s";
  const said = await landingRan([KEY, NEXT_KEY], work);
  assert.match(said, new RegExp(`${KEY} is a \`fix\` and landed 1 file\\(s\\) and 2 changed line\\(s\\),`, "u"), said);
  assert.match(said, new RegExp(`${NEXT_KEY} is a \`fix\` and landed 1 file\\(s\\) and 1 changed line\\(s\\),`, "u"), said);
  assert.doesNotMatch(said, /landed 2 file\(s\)/u, `a member was measured over the candidate:\n${said}`);
});

/* The landing's gate runs in a room of its own, and the series it would be read against is every
   worktree's: a sibling's full gate standing newest there is not this release's cost (ISS-594). The
   judged gate records its steps' seconds as three more than they took, so its own figure is 3s. */
test("a landing prints the gate it ran over its candidate as its own, and a sibling's newer line as the series'", async () => {
  const { work, head, base } = world({ base: "other", gate: JUDGED_GATE });
  judging([]);
  const ledger = join(work, ".git", "gate-ledger");
  mkdirSync(ledger, { recursive: true });
  appendFileSync(join(ledger, "runs"), `${new Date(Date.now() + 60_000).toISOString()} 188s 14/14\n`);
  seeded({ landing: ready(head, base) });
  const said = await landingRan([KEY], work);
  assert.match(said, /^ {2}the gate: this release's own took 3s$/mu, `the landing's own gate figure is not its gate line:\n${said}`);
  assert.match(said, /^ {2}the series every worktree of this checkout appends to, whose newest line may be another run's: 188s over 14 of 14 step\(s\)/mu,
    `the sibling's figure is not printed as the series':\n${said}`);
  assert.doesNotMatch(said, /the gate: 188s/u, `a sibling's figure is credited to this release:\n${said}`);
});

/* Resumed at its install, a landing runs no gate in that pass, so nothing it could print is its own. */
test("a landing resumed past its gate says it ran none, and credits the series to nobody", async () => {
  const { work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base) });
  installedAt("9.9.9");
  const refused = await landingRan([KEY], work);
  assert.match(refused, /would put the older copy in the cache/u, refused);
  forgetInstall();
  const said = await landingRan([KEY], work);
  assert.match(said, /^ {2}the gate: this pass ran no gate of its own, so no figure below is this release's$/mu,
    `a resume past the gate is not said to have run none:\n${said}`);
  assert.doesNotMatch(said, /the gate: this release's own/u, `a gate this pass never ran is credited to it:\n${said}`);
});
