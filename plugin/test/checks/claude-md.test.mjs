import assert from "node:assert/strict";
import test from "node:test";

import { misScoped, overrideMarkers, reviewClaudeMd, statements } from "../../src/checks/claude-md.mjs";

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

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { checkClaims, checkerOwned, claims } from "../../src/checks/claude-md.mjs";

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "cm-claims-"));
  mkdirSync(path.join(root, "scripts"), { recursive: true });
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: { lint: "eslint ." } }));
  writeFileSync(path.join(root, "scripts", "helpful.mjs"), "if (a === '--help') {}\n");
  writeFileSync(path.join(root, "scripts", "mute.mjs"), "run();\n");
  return root;
}

const NONE = {
  missingPaths: [],
  stalePaths: [],
  missingScripts: [],
  missingHelp: [],
  missingTools: [],
  missingRefs: [],
  presentForbidden: [],
  strandedShas: [],
  uncitedIdentifiers: [],
};

test("only backticks and link targets are claims, and a placeholder is not one", () => {
  const found = claims("Run `scripts/a.mjs` and see [docs](docs/b.md); `<slug>`, `@nestjs/*`, prose/path.\n");
  assert.deepEqual(found.paths, ["docs/b.md", "scripts/a.mjs"]);
});

test("shapes that only look like paths are not claimed", () => {
  const text = "`141.11.205.0/24`, `dd/mm/yyyy`, `.spec.ts`, `origin/production`, `codemap/1`, `frontend/.next`\n";
  assert.deepEqual(claims(text).paths, []);
});

test("a missing path and a stale one are separated", () => {
  const root = fixture();
  const found = checkClaims("See `scripts/helpful.mjs` — no, `lib/helpful.mjs`, and [gone](docs/gone.md).\n", root);
  assert.deepEqual(found.stalePaths, ["lib/helpful.mjs"]);
  assert.deepEqual(found.missingPaths, ["docs/gone.md"]);
});

test("an absence claim is read the right way round", () => {
  const root = fixture();
  const text = "There is no `scripts/helpful.mjs` and there must not be one; there is no `scripts/absent.mjs`.\n";
  const found = checkClaims(text, root);
  assert.deepEqual(found.presentForbidden, ["scripts/helpful.mjs"]);
  assert.deepEqual(found.missingPaths, []);
});

test("a tool told to answer -h must be on PATH", () => {
  const root = fixture();
  assert.deepEqual(checkClaims("Ask `node -h` and `definitelynotinstalled9 -h`.\n", root).missingTools, [
    "definitelynotinstalled9",
  ]);
});

test("a path, an npm script and a silent -h are each reported", () => {
  const root = fixture();
  const text = [
    "- `scripts/helpful.mjs -h` has the rest, and `scripts/mute.mjs -h` does not.",
    "- Gates are `npm run lint` and `npm run typecheck`.",
    "- See [gone](docs/gone.md).",
  ].join("\n");
  assert.deepEqual(checkClaims(text, root), {
    ...NONE,
    missingPaths: ["docs/gone.md"],
    missingScripts: ["typecheck"],
    missingHelp: ["scripts/mute.mjs"],
  });
});

test("a -h target that does not resolve is a missing path, not a silent -h", () => {
  const root = fixture();
  const found = checkClaims("Ask `scripts/absent.mjs --help`.\n", root);
  assert.deepEqual(found.missingPaths, ["scripts/absent.mjs"]);
  assert.deepEqual(found.missingHelp, []);
});

test("a clean file reports nothing", () => {
  const root = fixture();
  assert.deepEqual(checkClaims("Run `scripts/helpful.mjs -h`, then `npm run lint`.\n", root), NONE);
});

test("a rule a checker declares is reported where CLAUDE.md explains it", () => {
  const root = fixture();
  mkdirSync(path.join(root, "rules"), { recursive: true });
  writeFileSync(path.join(root, "rules", "tenant-filter.mjs"), 'name: "tenant-filter",\n');
  const text = "# Rules\n\n- `tenant-filter` inspects queries, not designs, so it cannot see a missing filter.\n";
  assert.deepEqual(checkerOwned(text, root), [{ rule: "tenant-filter", line: 3 }]);
  assert.deepEqual(checkerOwned("- `no-such-rule` does a thing that is long enough to be a statement.\n", root), []);
});

import { MAX_CLAUDE_MD_LINES, checkStructure } from "../../src/checks/claude-md.mjs";

test("the line target is the published one, and a short file passes it", () => {
  assert.equal(MAX_CLAUDE_MD_LINES, 200);
  const long = `${"- a rule long enough to count as a statement here.\n".repeat(201)}`;
  assert.equal(checkStructure(long, null).overLineTarget, true);
  assert.equal(checkStructure("- one rule.\n", null).overLineTarget, false);
});

test("emphasis counts as diluted only when nearly every bullet carries it", () => {
  const all = `${"- **a rule.** and its reason.\n".repeat(10)}`;
  assert.equal(checkStructure(all, null).emphasisDiluted, true);
  const two = `${"- **a rule.** and its reason.\n".repeat(2)}${"- a rule. and its reason.\n".repeat(8)}`;
  assert.equal(checkStructure(two, null).emphasisDiluted, false);
});

test("a vague word is a finding, and one quoted as an anti-pattern is not", () => {
  assert.deepEqual(checkStructure("- Use an appropriate timeout here.\n", null).vague, ["appropriate"]);
  assert.deepEqual(checkStructure('- "Appropriate" signals unfinished thinking.\n', null).vague, []);
  assert.deepEqual(checkStructure("- `appropriate` is a word this rule bans.\n", null).vague, []);
});

test("an @import is checked against the tree, and one in backticks is not an import", () => {
  const root = fixture();
  const found = checkStructure("See @scripts/helpful.mjs and @docs/gone.md; `@README` is literal.\n", root);
  assert.deepEqual(found.brokenImports, ["docs/gone.md"]);
});

import { checkerRestated } from "../../src/checks/claude-md.mjs";

const OWNED = "A process started outside the stack script reads production-shaped data and can write it.";

function repo() {
  const root = mkdtempSync(path.join(tmpdir(), "cm-restated-"));
  mkdirSync(path.join(root, "hooks"), { recursive: true });
  return root;
}

test("a CLAUDE.md sentence the code's own comment owns is reported", () => {
  const root = repo();
  writeFileSync(path.join(root, "hooks", "guard.mjs"), `// ${OWNED}\nrun();\n`);
  const [hit, ...rest] = checkerRestated(`# Rules\n\n${OWNED}\n`, root);
  assert.equal(rest.length, 0);
  assert.equal(hit.where, path.join("hooks", "guard.mjs"));
  assert.equal(hit.score, 1);
});

test("`restated: deliberate` on the comment waives the pair", () => {
  const root = repo();
  const waived = "// restated: deliberate — stated for an agent that reads, enforced for one that does not.";
  writeFileSync(path.join(root, "hooks", "guard.mjs"), `${waived}\n// ${OWNED}\nrun();\n`);
  assert.deepEqual(checkerRestated(`# Rules\n\n${OWNED}\n`, root), []);
});
