/* The brief's own half: what a line of it names as its source, what a digest claims to have
   checked, and what the report says of one that moved. `CLAUDE.md` and `README.md` are this
   repository's, which is what the verb resolves a source against, so the digests below are real
   reads and not a stubbed hash. */
import assert from "node:assert/strict";
import test from "node:test";

import { briefLines, briefSources, digestsFor, staleIn, unhashable }
  from "../../../src/tracker/knowledge/brief.mjs";

const LINE = (source) => `Test and lint: \`npm run check\`, which is the gate.  ← ${source}`;

test("only what a line names after the mark is a source, and a path it merely cites is not", () => {
  const body = [
    "# The map",
    "Layout: `plugin/src/commands.mjs` dispatches, `plugin/src/cli.mjs` is the entry.  ← `README.md`",
    LINE("`CLAUDE.md`, and `tools/gates.mjs` for the rest"),
    "Prose language: not stated.",
  ].join("\n");
  assert.deepEqual(briefSources(body), ["CLAUDE.md", "README.md", "tools/gates.mjs"],
    "a brief maps the tree, so a path outside the source tail would call it stale every release");
});

test("a line naming no source contributes nothing, which is the brief's own rule as a mechanism", () => {
  assert.deepEqual(briefSources("Prose language: *not stated*.\nBuild: none."), []);
  assert.deepEqual(digestsFor("Prose language: *not stated*."), {},
    "a line nobody can check is a line no digest should claim to have checked");
});

test("a source that does not resolve is kept as unresolved rather than dropped", () => {
  assert.deepEqual(digestsFor(LINE("`docs/nothing-is-here.md`")), { "docs/nothing-is-here.md": null },
    "dropped, it would reach no reader, and a brief naming only these would report as naming none");
  assert.deepEqual(Object.keys(digestsFor(LINE("`CLAUDE.md`"))), ["CLAUDE.md"]);
  assert.deepEqual(staleIn(digestsFor(LINE("`docs/nothing-is-here.md`"))),
    { gone: ["docs/nothing-is-here.md"], moved: [] });
});

test("a digest that still matches is not stale, and one that does not names the file", () => {
  const held = digestsFor(LINE("`CLAUDE.md`"));
  assert.deepEqual(staleIn(held), { gone: [], moved: [] });
  assert.deepEqual(staleIn({ ...held, "CLAUDE.md": "0000000000000000" }),
    { gone: [], moved: ["CLAUDE.md"] });
});

test("a source the checkout no longer holds is gone, which is not the same as moved", () => {
  assert.deepEqual(staleIn({ "docs/was-here.md": "0000000000000000" }),
    { gone: ["docs/was-here.md"], moved: [] });
});

const entry = (over = {}) => ({
  entry: {
    updatedAt: "2026-09-05T08:00:00.000Z",
    body: "# The map\n",
    metadata: { digests: digestsFor(LINE("`CLAUDE.md`")) },
    ...over,
  },
});

test("a brief whose every source still matches prints with no stale line", () => {
  const said = briefLines(entry()).join("\n");
  assert.match(said, /^project brief {2}← the knowledge store, slug project-brief, written 2026-09-05$/mu);
  assert.doesNotMatch(said, /stale:|gone:/u);
  assert.match(said, /^1 {2}# The map$/mu);
});

/* The offset is not one number to document: this block puts three to six rows over the body and the
   store's own read puts nine, so the numbers the flag counts are printed where the flag is used. */
test("the body carries the numbers --line counts, and the rows above it carry none", () => {
  const said = briefLines(entry({ body: "# The map\n\nBuild: none.\n" }));
  assert.deepEqual(said.slice(-4), ["1  # The map", "2  ", "3  Build: none.", "4  "]);
  assert.match(said[0], /^project brief {2}← the knowledge store/u);
});

/* The route it prints is the narrow one: a stale line sends a run to a whole-file write it will
   decline to make beside a live session, and a route nobody takes leaves the brief stale. */
test("a moved source is named, with the two writes that close one line rather than the file", () => {
  const said = briefLines(entry({ metadata: { digests: { "CLAUDE.md": "0000000000000000" } } }));
  const stale = said.filter((one) => /stale:/u.test(one)).join("\n");
  assert.match(stale, /^ {2}stale: CLAUDE\.md — moved since the brief was read\./mu);
  assert.match(stale, /forge doctor --confirm <source>/u);
  assert.match(stale, /forge doctor --line <n> <text> --was <the line as it stands>/u);
  assert.doesNotMatch(stale, /--refresh/u, "the stale line's own route, and no other line's");
});

test("a brief naming only sources this checkout lacks reports them, not silence", () => {
  const said = briefLines(entry({ metadata: { digests: { "docs/was-here.md": null } } })).join("\n");
  assert.match(said, /^ {2}gone: docs\/was-here\.md/mu);
  assert.doesNotMatch(said, /no line of this brief names a source/u);
});

test("a brief carrying no digests says so rather than reading as one nothing has moved under", () => {
  const said = briefLines(entry({ metadata: {} })).join("\n");
  assert.match(said, /no line of this brief names a source/u);
  assert.doesNotMatch(said, /stale:/u);
});

test("an absent brief names the command that writes one", () => {
  const said = briefLines({ entry: null }).join("\n");
  assert.match(said, /^project brief: none stored/mu);
  assert.match(said, /forge doctor --refresh <brief\.md>/u);
});

test("a store that would not answer is not printed as an absence", () => {
  const said = briefLines({ refused: "this credential may not read the store" }).join("\n");
  assert.match(said, /this is not an absence — this credential may not read the store/u);
  assert.doesNotMatch(said, /none stored/u,
    "a run that took a refusal for an absence would write over a brief it never saw");
  assert.deepEqual(briefLines(null), [], "and a checkout with no project says nothing at all");
});

/* The hole a review confirmed and this closes: the path reader's grammar wants an extension it
   knows and a bare filename inside a span, so a source it does not take was silently untracked. */
test("a source the path reader took nothing from is named rather than dropped in silence", () => {
  const body = [
    LINE("`CLAUDE.md`, and `node tools/gates.mjs -h` for the rest"),
    LINE("`Makefile`"),
    LINE("`forge doctor`"),
    "Layout: `plugin/src/cli.mjs` is the entry.  ← `README.md`",
  ].join("\n");
  assert.deepEqual(unhashable(body), ["`Makefile`", "`forge doctor`"],
    "a span the reader took a path from is hashed, and one it took nothing from is said");
  assert.deepEqual(unhashable("Build: none.  ← `README.md`"), [],
    "and a brief whose every source resolved says nothing");
});
