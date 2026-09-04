/* The project's own answer, in the CLI's words. A host is told from a secret by the shape of the
   value, because the tracker's field set grows and the run that goes looking for a credential at
   Phase 7 has already lost the criteria it could not judge (ISS-92). */
import assert from "node:assert/strict";
import test from "node:test";

import {
  briefLines,
  briefSources,
  credentialLeak,
  deployFrom,
  deployed,
  digestsFor,
  leakRefusal,
  projectLines,
  releaseFrom,
  staleIn,
} from "../../src/tracker/project-config.mjs";

const HELD = {
  stagingUrl: "https://beta.example.test",
  stagingApiUrl: "https://api-beta.example.test",
  testingUrls: ["https://beta.example.test/admin", { label: "shop", url: "https://shop.example.test" }],
  testCredentials: [{ username: "qa@example.test", password: "correct-horse-battery" }],
  notes: "A test account reaches the storefront only.",
};

const POLICY = releaseFrom({
  baseBranch: "staging",
  productionBranch: "master",
  pipelineConfig: { autoProdDeploy: false },
});

const said = (over) => projectLines({ id: "an-id", policy: POLICY, deploy: deployFrom(HELD), ...over }).join("\n");

test("a host is every http value the deploy holds, however deeply", () => {
  const found = deployFrom(HELD).urls.map((one) => one.url);
  assert.deepEqual(found, [
    "https://beta.example.test",
    "https://api-beta.example.test",
    "https://beta.example.test/admin",
    "https://shop.example.test",
  ]);
});

test("a host's label is the field that held it, in words rather than the tracker's key", () => {
  const found = deployFrom(HELD).urls.map((one) => one.label);
  assert.deepEqual(found, ["staging url", "staging api url", "testing urls", "testing urls"],
    "two rows may share a label; the URLs are what distinguish them");
});

/* The label a string beside a host reads as is the shape this got wrong once: `testCredentials`
   holding a login URL is the tracker's documented shape, and the password sat beside it. */
test("a string beside a host is withheld, never promoted to that host's label", () => {
  const found = deployFrom({
    testCredentials: [{ username: "qa@x.test", password: "hunter2hunter2", loginUrl: "https://x.test/in" }],
  });
  assert.deepEqual(found.urls, [{ label: "test credentials · login url", url: "https://x.test/in" }]);
  assert.deepEqual(found.withheld.map((one) => one.value), ["qa@x.test", "hunter2hunter2"]);
  assert.equal(credentialLeak({ body: "signed in with hunter2hunter2" }, found).credential,
    "test credentials · password", "and the write guard sees what the printer withheld");
});

test("everything that is neither a host nor the notes is withheld, named and not valued", () => {
  const { withheld, notes } = deployFrom(HELD);
  assert.deepEqual(withheld.map((one) => one.label),
    ["testing urls · label", "test credentials · username", "test credentials · password"],
    "a benign label lands here too: a false `present` is an annoyance, a printed password is not");
  assert.deepEqual(notes, [HELD.notes]);
  assert.deepEqual(withheld.map((one) => one.value), ["shop", "qa@example.test", "correct-horse-battery"]);
});

test("a label the deploy holds is not read from the deploy's own prose", () => {
  const { withheld } = deployFrom({ testCredentials: [{ notes: "a secret in the wrong field" }] });
  assert.deepEqual(withheld.map((one) => one.label), ["test credentials · notes"],
    "only the top-level notes field is prose the schema forbids a secret in");
});

/* Being a URL is not being safe to print: the second version of this printed a password sitting in
   a URL's user-info and a signed token in its query, and removed both from the guard's reach. */
test("a host carrying a secret is shown trimmed, and the whole value stays a credential", () => {
  const found = deployFrom({
    loginUrl: "https://qa:hunter2@beta.example.test/in",
    signed: "https://beta.example.test/x?token=abcdefghijklmnop",
  });
  assert.deepEqual(found.urls, [
    { label: "login url", url: "https://beta.example.test/in" },
    { label: "signed", url: "https://beta.example.test/x" },
  ]);
  assert.deepEqual(found.withheld.map((one) => one.label), ["login url", "signed"]);
  assert.equal(credentialLeak({ body: "https://qa:hunter2@beta.example.test/in" }, found).credential, "login url");
  assert.equal(credentialLeak({ body: "https://beta.example.test/in" }, found), null,
    "the printed form is citable, or the refusal it earns has no way out");
});

test("a host carrying nothing is printed whole and withheld from nothing", () => {
  const found = deployFrom({ stagingUrl: "https://beta.example.test/shop" });
  assert.deepEqual(found.urls, [{ label: "staging url", url: "https://beta.example.test/shop" }]);
  assert.deepEqual(found.withheld, []);
});

test("a deploy with nothing on it is not one", () => {
  assert.equal(deployed(deployFrom({ stagingUrl: null, testingUrls: [], testCredentials: [] })), false);
  assert.equal(deployed(deployFrom(undefined)), false);
  assert.equal(deployed(deployFrom(HELD)), true);
});

test("the report names the branches, the deploy decision and the id, each with its source", () => {
  const out = said({});
  assert.match(out, /^project id: an-id {2}← the slug in \.forge\.json$/mu);
  assert.match(out, /^staging branch: staging {2}← the tracker's project config$/mu);
  assert.match(out, /^production branch: master {2}← the tracker's project config$/mu);
  assert.match(out, /^production deploys on its own: no {2}← the tracker's project config$/mu);
});

test("the report withholds a credential and names the one command that prints it", () => {
  const out = said({});
  assert.match(out, /^ {2}test credentials: present, forge project --credentials$/mu);
  assert.match(out, /^ {2}held, not printed: testing urls · label, test credentials · username, test credentials · password$/mu);
  assert.doesNotMatch(out, /correct-horse-battery/u, "the value is the thing the flag is for");
  assert.doesNotMatch(out, /qa@example\.test/u);
  assert.match(out, /^ {2}notes: A test account reaches the storefront only\.$/mu);
});

test("the flag prints the values, and nothing else moves", () => {
  const out = said({ credentials: true });
  assert.match(out, /^ {2}test credentials · password: correct-horse-battery$/mu);
  assert.match(out, /^ {2}test credentials · username: qa@example\.test$/mu);
  assert.doesNotMatch(out, /held, not printed/u);
  assert.match(out, /^ {2}test credentials: below, printed once$/mu,
    "and the summary stops pointing at the flag the caller just used");
  assert.match(out, /^ {2}staging url: https:\/\/beta\.example\.test$/mu);
});

test("a project with no deploy is told so, and no host is invented", () => {
  const out = projectLines({ id: "an-id", policy: POLICY, deploy: deployFrom(null) }).join("\n");
  assert.match(out, /^staging deploy: none configured$/mu);
  assert.doesNotMatch(out, /https?:\/\//u);
  assert.doesNotMatch(out, /test credentials/u);
});

test("a config that did not answer is said rather than defaulted", () => {
  const out = projectLines({ id: "an-id", policy: null, deploy: null }).join("\n");
  assert.match(out, /^release policy: the project config did not answer$/mu);
  assert.doesNotMatch(out, /staging branch/u);
});

test("a payload carrying a credential names the field it sits in and the credential it is", () => {
  const deploy = deployFrom(HELD);
  const found = credentialLeak({ body: `logged in with correct-horse-battery` }, deploy);
  assert.deepEqual(found, { field: "body", credential: "test credentials · password" });
  assert.match(leakRefusal(found, "The payload"), /forge project --credentials/u);
});

/* The edge of the guarantee, asserted rather than described: below the length it is whole-field
   only, and a claim wider than that is one the guard cannot keep. */
test("a short credential is refused where a field is it, quoting and spacing aside", () => {
  const deploy = deployFrom({ testCredentials: [{ username: "admin" }] });
  const named = { field: "user", credential: "test credentials · username" };
  assert.deepEqual(credentialLeak({ user: " admin " }, deploy), named);
  assert.deepEqual(credentialLeak({ user: `"admin"` }, deploy), named);
  assert.deepEqual(credentialLeak({ user: "`admin`," }, deploy), named);
  assert.equal(credentialLeak({ body: "the admin screen renders" }, deploy), null,
    "a gate refusing every payload with the word admin in it is one nobody gets past");
  assert.equal(credentialLeak({ body: "use `admin` for testing" }, deploy), null,
    "so a short value inside prose passes, which is the edge the refusal and the doc both state");
});

test("a credential long enough to be one is refused inside prose, without an edge to state", () => {
  const deploy = deployFrom({ testCredentials: [{ password: "hunter2hunter2" }] });
  assert.equal(credentialLeak({ body: "signed in (hunter2hunter2) and it rendered" }, deploy).credential,
    "test credentials · password");
});

test("a payload holding no credential passes, and so does one on a project holding none", () => {
  assert.equal(credentialLeak({ body: "nothing secret here" }, deployFrom(HELD)), null);
  assert.equal(credentialLeak({ body: "correct-horse-battery" }, deployFrom({ stagingUrl: "https://x.test" })), null);
  assert.equal(credentialLeak({ body: "correct-horse-battery" }, null), null,
    "a read this CLI could not make refuses nothing: that refusal would have no route out");
});

test("a credential nested anywhere in a payload is found, and the field says where", () => {
  const found = credentialLeak({ data: { fields: ["ok", "correct-horse-battery"] } }, deployFrom(HELD));
  assert.equal(found.field, "data.fields.1");
});

/* The brief's own half. `CLAUDE.md` and `README.md` are this repository's, which is what the verb
   resolves a source against, so the digests below are real reads and not a stubbed hash. */
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
  assert.match(said, /# The map/u);
});

test("a moved source is named, with the command that refreshes the lines citing it", () => {
  const said = briefLines(entry({ metadata: { digests: { "CLAUDE.md": "0000000000000000" } } })).join("\n");
  assert.match(said, /^ {2}stale: CLAUDE\.md — moved since the brief was read\./mu);
  assert.match(said, /forge project --refresh <brief\.md>/u);
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
  assert.match(said, /forge project --refresh <brief\.md>/u);
});

test("a store that would not answer is not printed as an absence", () => {
  const said = briefLines({ refused: "this credential may not read the store" }).join("\n");
  assert.match(said, /this is not an absence — this credential may not read the store/u);
  assert.doesNotMatch(said, /none stored/u,
    "a run that took a refusal for an absence would write over a brief it never saw");
  assert.deepEqual(briefLines(null), [], "and a checkout with no project says nothing at all");
});
