import assert from "node:assert/strict";
import test from "node:test";

import { misScoped, overrideMarkers, reviewClaudeMd, statements } from "../src/claude-md.mjs";

const GUIDES = [
  {
    slug: "deploy-safety",
    body: "## Deploy safety\n\nA page that returns 200 proves nothing about whether your change works.\n",
  },
  { slug: "writing-an-issue", body: "An issue carries an outcome and the business rules it must hold.\n" },
];

const RESTATES = "- **Verify real behaviour.** A page that returns 200 proves nothing about a change.\n";

test("a heading, a table row and a fenced block are not prose", () => {
  const text = "# Rules\n\n| a | b |\n\n```\nA page that returns 200 proves nothing about the change.\n```\n";
  assert.deepEqual(statements(text), []);
});

test("each bullet is its own unit, so a finding points at one rule", () => {
  const text = "- The first rule is long enough to be measured at all.\n- The second rule is also long enough to be measured.\n";
  assert.deepEqual(
    statements(text).map(([span]) => span.start),
    [1, 2],
  );
});

test("a wrapped bullet is one unit and joins without a doubled space", () => {
  const [[span, sentence]] = statements("- The rule wraps across\n  two source lines here.\n");
  assert.deepEqual([span.start, span.end], [1, 2]);
  assert.equal(sentence, "The rule wraps across two source lines here.");
});

test("a restatement of a guide is reported, guide first", () => {
  const { overlaps } = reviewClaudeMd(RESTATES, GUIDES);
  assert.equal(overlaps.length, 1);
  assert.equal(overlaps[0].slug, "deploy-safety");
  assert.equal(overlaps[0].line, 1);
  assert.ok(overlaps[0].score >= 0.25);
});

test("a declared override on the same block sanctions the pair", () => {
  const declared = `${RESTATES.trimEnd()} overrides: deploy-safety — staging has no page to open.\n`;
  const review = reviewClaudeMd(declared, GUIDES);
  assert.deepEqual(review.overlaps, []);
  assert.deepEqual(review.overrides, [
    { line: 1, slug: "deploy-safety", reason: "staging has no page to open.", known: true },
  ]);
});

test("an override on another block does not sanction this one", () => {
  const elsewhere = `${RESTATES}\n- Something else entirely. overrides: deploy-safety — a reason.\n`;
  assert.equal(reviewClaudeMd(elsewhere, GUIDES).overlaps.length, 1);
});

test("an override naming no guide is marked unknown", () => {
  const review = reviewClaudeMd("- A rule. overrides: no-such-guide — a reason.\n", GUIDES);
  assert.deepEqual(review.overrides, [
    { line: 1, slug: "no-such-guide", reason: "a reason.", known: false },
  ]);
});

test("a marker with no reason is not a marker", () => {
  assert.deepEqual(overrideMarkers("- A rule. overrides: deploy-safety\n"), []);
  assert.deepEqual(overrideMarkers("- A rule. overrides: deploy-safety —\n"), []);
});

test("a foreign tool namespace scopes a global guide; forge's own does not", () => {
  const guides = [
    { slug: "agent-setup", body: "Call mcp__forge__forge_issues to file one." },
    { slug: "integration-acme", body: "Call mcp__acme__list_products, then mcp__acme__get_product." },
  ];
  assert.deepEqual(misScoped(guides), [{ slug: "integration-acme", evidence: ["acme"] }]);
});

test("guides given as data reach no network, and an empty body is not a crash", () => {
  assert.deepEqual(reviewClaudeMd("", [{ slug: "a" }]), {
    overlaps: [],
    overrides: [],
    misScoped: [],
  });
});

test("a marker inside a fence is an example, not a declaration", () => {
  const text = "Say it like this:\n\n```\noverrides: no-such-guide — an example in the docs.\n```\n";
  assert.deepEqual(overrideMarkers(text), []);
  assert.deepEqual(reviewClaudeMd(text, GUIDES).overrides, []);
});
