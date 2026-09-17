/* The release method is text, and text is what a later edit quietly loses. Each rule below is one
   the issue that commissioned the skill named as load-bearing, so a body that no longer carries it
   is a release agent running on less than it was given — which nothing else in this tree would
   notice. */
import assert from "node:assert/strict";
import test from "node:test";

import { servedBody } from "../../../src/guides/skill-guides.mjs";

const SLUG = "release-flow";
const DEFAULT = "default";
const SCREEN = "screen";

const body = (flow = DEFAULT) => {
  const text = servedBody(SLUG, undefined, flow);
  assert.ok(text, `${SLUG} serves no method under the ${flow} flow`);
  return text;
};

/* Each row is a rule the method may not lose, and the criterion of ISS-1521 that owes it. */
const RULES = [
  ["7 · repair is forward and the account says so", /repairs? forward/iu],
  ["9 · a confirmed cause is one of the grades", /confirmed cause/iu],
  ["9 · a leading hypothesis is one of the grades", /leading hypothesis/iu],
  ["9 · an unresolved uncertainty is one of the grades", /unresolved uncertainty/iu],
  ["10 · every true grade appears together", /carries every one of them that is true/u],
  ["11 · health and identity are two readings", /Two observations, never one/u],
  ["13 · production's identity is decided, not read", /whether production serves the release that landed/u],
  ["14 · the decision is not equality with staging", /not literal equality with the identity staging reported/u],
  ["26 · judging the change is not reading the deployment", /A judgement of the change is not a reading of the deployment/u],
  ["15 · the repair loop runs inside this job", /Land the fix\. Promote it\. Deploy it\. Verify it\./u],
  ["16 · the bound on elapsed time", /elapsed since the code reached the production branch/iu],
  ["16 · the bound on evidence of progress", /Time since the last evidence of progress/u],
  ["16 · the bound on regression", /Health that passed before an attempt and fails after it/u],
  ["17 · time remaining is not a reason", /never on its own a reason to continue/u],
  ["18 · handover on a missing permission", /A permission you do not have/u],
  ["18 · handover on an undeterminable state", /A state you cannot determine/u],
  ["18 · handover on causes of equal weight", /Several causes of equal weight/u],
  ["18 · handover on a person's decision", /A decision that is a person's to make/u],
  ["19 · a failed production reading hands over", /A failed production observation is a handover, not a close/u],
  ["20 · the handoff names its next owner", /Who owns it next/u],
  ["20 · the handoff names what it observed", /The deployment state and the identity you observed/u],
  ["20 · the handoff names the outstanding act", /The act still outstanding/u],
  ["20 · the handoff names the fallback", /The fallback/u],
  ["21 · the account opens on the situation", /The situation\./u],
  ["21 · the account carries the evidence", /The evidence observed\./u],
  ["21 · the account grades its diagnosis", /The diagnosis, graded\./u],
  ["21 · each action names the alternative it beat", /The actions, each with the alternative it beat\./u],
  ["21 · the account ends on what a person does", /What a person should do next\./u],
  ["22 · a log is quoted, not tailed", /quote the part you chose/u],
  ["23 · each step reads its position back", /reads its own position back before it acts/u],
  ["24 · no language is preferred", /Write in whatever language fits where it will be read/u],
];

test("the served method carries every rule the issue named load-bearing", () => {
  const text = body();
  for (const [said, pattern] of RULES) {
    assert.match(text, pattern, `the release method lost: ${said}`);
  }
});

/* A pattern that also matches the issue method is matching the register both are written in rather
   than the rule, and would go on passing over a body with the rule cut out of it. */
test("no rule's pattern is loose enough to match the issue method instead", () => {
  const other = servedBody("issue-flow", undefined, DEFAULT);
  for (const [said, pattern] of RULES) {
    assert.doesNotMatch(other, pattern, `${said} matches prose, not the rule it stands for`);
  }
});

test("the method offers no way back, under either flow", () => {
  for (const flow of [DEFAULT, SCREEN]) {
    assert.doesNotMatch(body(flow), /\brolls? back\b|\brollback\b|\brolling back\b/iu,
      `the ${flow} copy of the release method offers a rollback, and the systems it drives have none`);
  }
});

/* Banned as a phrase, which is why it may appear exactly where the ban is stated and nowhere else:
   a ban nobody can read is not one, and a second occurrence is the method using what it forbids. */
test("the banned phrase appears once, inside the code span that forbids it", () => {
  const text = body();
  const found = [...text.matchAll(/root cause/giu)];
  assert.equal(found.length, 1, "the method uses the phrase it bans, or has stopped naming it");
  assert.match(text, /Never write `root cause`/u, "the one occurrence is the ban itself, in a code span");
});

test("no sentence of the method prescribes a language to write in", () => {
  assert.doesNotMatch(body(), /\bin (?:English|Vietnamese)\b|tiếng Việt/iu);
});

test("both flows serve the same method, so neither is offered less", () => {
  assert.equal(body(SCREEN), body(DEFAULT));
});
