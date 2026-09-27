/* What a release owes the repository once its copy is installed, taken by the landing as the ship
   takes it: the batch reading where the volume since the mark calls for one, the newest gate figure,
   and the ladder's backstop for each change it landed. A landing that grew its own step table ran
   none of the three and read as nothing owed, which is how 64,629 changed lines went unread (ISS-2735). */
import assert from "node:assert/strict";
import test from "node:test";

import {
  KEY, NEXT_BRANCH, NEXT_KEY, NEXT_OWNED, git, landingRan, ready, seeded, state, tracker, world,
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
  /* The fixture's gate keeps no timing record, so the figure is the reader's own word for none. */
  assert.match(said, /^ {2}the gate: no run is recorded/mu, `no gate figure after the install:\n${said}`);
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
