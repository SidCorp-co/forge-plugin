/* The project's own answer, in the CLI's words. A host is told from a secret by the shape of the
   value, because the tracker's field set grows and the run that goes looking for a credential at
   Phase 7 has already lost the criteria it could not judge (ISS-92). */
import assert from "node:assert/strict";
import test from "node:test";

import { NOT_STATED } from "../../src/goals.mjs";
import {
  credentialLeak,
  deployFrom,
  deployed,
  judgementOf,
  landingRoute,
  leakRefusal,
  personOwedForRelease,
  projectRows,
  releaseConflict,
  releaseFrom,
  releaseLine,
  stagingOf,
  unreadFrom,
  waitsForPerson,
} from "../../src/tracker/project-config.mjs";

/* No key in the checkout, which is what every derivation case reads: the override is passed in. */
const NONE = { value: null, from: null };

/* The bindings in the shape the tracker serves them in, read off the wire on projects that have
   both halves configured: the staging half, the production one, the limits the tracker writes
   through a door of its own, and the credentials lifted out of both halves and held once. */
const BINDINGS = {
  live: { url: "https://shop.example.test", apiUrl: "https://api.example.test",
    commitUrl: null, commitPath: null },
  limits: "a budget the tracker holds for this project and no reader here spends",
  preview: {
    url: "https://beta.example.test",
    apiUrl: "https://api-beta.example.test",
    urls: [{ url: "https://beta.example.test/admin", label: "shop" }],
  },
  testCredentials: [{ username: "qa@example.test", password: "correct-horse-battery" }],
};

const HELD = stagingOf(BINDINGS);

const POLICY = releaseFrom({
  baseBranch: "staging",
  liveBranch: "master",
  releaseModel: "promote",
  releaseStrategy: "fast-forward",
  pipelineConfig: { autoProdDeploy: false },
});

/* Judged as rows and not as text: the one report owns the marks and the columns, so what this file
   answers for is which rows there are, what each says and which level it carries. */
const rowsFor = (over) => projectRows({ policy: POLICY, deploy: deployFrom(HELD), ...over });
const lines = (found) => found.map((row) => `${row.label}: ${row.detail}`).join("\n");
const said = (over) => lines(rowsFor(over));

test("a host is every http value the deploy holds, however deeply", () => {
  const found = deployFrom(HELD).urls.map((one) => one.url);
  assert.deepEqual(found, [
    "https://beta.example.test",
    "https://api-beta.example.test",
    "https://beta.example.test/admin",
  ]);
});

test("a host's label is the field that held it, in words rather than the tracker's key", () => {
  const found = deployFrom(HELD).urls.map((one) => one.label);
  assert.deepEqual(found, ["staging", "staging · api url", "staging · urls"],
    "two rows may share a label; the URLs are what distinguish them");
});

/* The two halves of the bindings the staging deploy is not: the production hosts printed under a
   staging heading would be a false reading, and the limits would be withheld as a credential and
   printed by the flag that prints one (ISS-1965). */
test("the production binding and the limits are no part of the staging deploy", () => {
  const found = deployFrom(HELD);
  assert.deepEqual(found.urls.map((one) => one.url).filter((url) => url.includes("shop.example")), [],
    "the live host reaches no row of the staging deploy");
  assert.deepEqual(found.withheld.filter((one) => one.value === BINDINGS.limits), [],
    "and the limits reach neither the withheld list nor the flag that prints it");
  assert.equal(credentialLeak({ body: BINDINGS.limits }, found), null);
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

test("everything that is not a host is withheld, named and not valued", () => {
  const { withheld } = deployFrom(HELD);
  assert.deepEqual(withheld.map((one) => one.label),
    ["staging · urls · label", "test credentials · username", "test credentials · password"],
    "a benign label lands here too: a false `present` is an annoyance, a printed password is not");
  assert.deepEqual(withheld.map((one) => one.value), ["shop", "qa@example.test", "correct-horse-battery"]);
});

/* The retired shape declared a prose field and the reading sorted a leaf into it. The bindings carry
   no such key on any project, so prose anywhere in them is withheld like every other non-host: a
   reading that kept the list would hand every caller an array that can never fill (ISS-1965). */
test("prose the bindings hold is withheld, and the reading carries no list for it", () => {
  const found = deployFrom({ notes: "a test account reaches the storefront only" });
  assert.deepEqual(found.withheld.map((one) => one.label), ["notes"]);
  assert.equal("notes" in found, false, "and no key of the reading invites a caller to look for one");
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
  const found = deployFrom(stagingOf({ preview: { url: "https://beta.example.test/shop" } }));
  assert.deepEqual(found.urls, [{ label: "staging", url: "https://beta.example.test/shop" }]);
  assert.deepEqual(found.withheld, []);
});

test("a deploy with nothing on it is not one", () => {
  assert.equal(deployed(deployFrom(stagingOf({ preview: null, testCredentials: [] }))), false);
  assert.equal(deployed(deployFrom(stagingOf({ ...BINDINGS, preview: null, testCredentials: [] }))), false,
    "a project that has a production binding and limits and no staging half has no staging deploy");
  assert.equal(deployed(deployFrom(undefined)), false);
  assert.equal(deployed(deployFrom(HELD)), true);
});

test("the rows name the branches and the deploy decision, each with its source", () => {
  const out = said({});
  assert.match(out, /^release model: promote — the release moves code from the staging branch to the live branch {2}← the tracker's project config$/mu);
  assert.match(out, /^staging branch: staging {2}← the tracker's project config$/mu);
  assert.match(out, /^live branch: master {2}← the tracker's project config$/mu);
  assert.match(out, /^release strategy: fast-forward {2}← the tracker's project config$/mu);
  assert.match(out, /^production deploy: a person's — /mu);
  assert.doesNotMatch(out, /deploys on push/u, "a project that waits for a person is told nothing more");
  assert.doesNotMatch(out, /project id/u, "the id is the endpoint block's, one report having one row for it");
});

/* The wording is the finding, not decoration: read as the host deploying on push, this line sent
   three runs to verify a build that predated their own landing (ISS-393). */
test("the flag is reported as what it decides, and where it is set the line says what it does not", () => {
  const out = said({ policy: { ...POLICY, autoProd: true } });
  assert.match(out, /^production deploy: automatic — /mu);
  assert.match(out, /^: and nothing here says the host deploys on push: /mu,
    "on a row of its own with no label, which is how the one report prints a continuation");
  assert.match(out, /`awaiting_release` asks the verification to name the deployment that built the commit/u);
  assert.doesNotMatch(out, /deploys on its own/u, "the sentence the reading came from is gone");
});

/* The shape this repository is, and the reading the 43 issues resting at the deploying rung were
   refused on: a project that declares no release step has its policy read, so nothing here is a
   failure of the report and no branch it does not have is asked for. */
test("a project with no release step prints the model and leaves no conflict to resolve", () => {
  const policy = releaseFrom({ baseBranch: "master", releaseModel: "none",
    pipelineConfig: { autoProdDeploy: true } });
  const rows = projectRows({ policy, deploy: null, landing: NONE });
  assert.match(lines(rows), /^release model: none — there is no release step, so a change that has landed and been verified is out {2}← the tracker's project config$/mu);
  assert.doesNotMatch(lines(rows), /live branch/u,
    "the branch the promoting model has is no row where there is no promotion");
  assert.doesNotMatch(lines(rows), /release strategy/u);
  assert.deepEqual(rows.filter((row) => row.level === "miss"), [],
    "and a policy that reads is no failure of the report");
});

test("a project that declares no model is noted rather than read as one, and an unknown value is quoted", () => {
  const rowsOf = (releaseModel) => projectRows({ policy: releaseFrom({ baseBranch: "master",
    releaseModel, pipelineConfig: { autoProdDeploy: false } }), deploy: null, landing: NONE });
  const staging = projectRows({ policy: releaseFrom({ releaseModel: "none",
    pipelineConfig: { autoProdDeploy: true } }), deploy: null, landing: NONE })
    .find((row) => row.label === "staging branch");
  assert.match(staging.detail, /^unset on the project — nothing says which branch a change lands on/u,
    "an unset staging branch costs a merged mark its note and no release anything: the park is the model's");
  assert.doesNotMatch(staging.detail, /park/u);
  const undeclared = rowsOf(undefined).find((row) => row.label === "release model");
  assert.equal(undeclared.level, "note", "a project that has decided nothing is not a report failure");
  assert.match(undeclared.detail, /^unset on the project — the park before awaiting_release stands until one of none, promote, publish is declared/u);
  const unknown = rowsOf("hand-carried").find((row) => row.label === "release model");
  assert.match(unknown.detail, /^`hand-carried`, which is no model this CLI knows/u,
    "and a word this CLI cannot read is printed rather than treated as silence");
});

test("the report withholds a credential and names the one command that prints it", () => {
  const out = said({});
  assert.match(out, /^test credentials: present, forge doctor --credentials$/mu);
  assert.match(out, /^held, not printed: staging · urls · label, test credentials · username, test credentials · password$/mu);
  assert.doesNotMatch(out, /correct-horse-battery/u, "the value is the thing the flag is for");
  assert.doesNotMatch(out, /qa@example\.test/u);
});

test("the flag prints the values, and nothing else moves", () => {
  const out = said({ credentials: true });
  assert.match(out, /^test credentials · password: correct-horse-battery$/mu);
  assert.match(out, /^test credentials · username: qa@example\.test$/mu);
  assert.doesNotMatch(out, /held, not printed/u);
  assert.match(out, /^test credentials: below, printed once$/mu,
    "and the summary stops pointing at the flag the caller just used");
  assert.match(out, /^staging: https:\/\/beta\.example\.test$/mu);
});

/* Phase 0 is told to read *present* or *none*, so a project with no deploy owes the line too: with
   it absent this state and one the tracker never answered for read alike (ISS-477). */
test("a project with no deploy is told so, ends on the credential line, and invents no host", () => {
  const out = said({ deploy: deployFrom(null) });
  assert.match(out, /^staging deploy: none on record while the staging branch is named, /mu);
  assert.match(out, /no route that writes one\ntest credentials: none$/mu,
    "the credential row ends the deploy rows here as it does where a deploy is configured");
  assert.equal(rowsFor({ deploy: deployFrom(null) })
    .find((row) => row.label === "staging deploy").level, "note", "and a deploy nobody set is no failure");
  assert.doesNotMatch(out, /https?:\/\//u);
});

test("a checkout naming no project is said rather than defaulted", () => {
  const out = lines(projectRows({ policy: null, deploy: null }));
  assert.match(out, /^release policy: this checkout names no project, so there is no release policy to read/mu);
  assert.doesNotMatch(out, /staging branch/u);
  assert.doesNotMatch(out, /test credentials/u,
    "an unanswered call is not a decision, so *none* is not said on its behalf: that silence is "
    + "what a run tells apart from the `none` the case above earns");
});

/* A report printing `not stated` for a call that was refused tells a developer the project decided
   nothing, which is the one thing this report exists to tell apart from a read that did not
   happen (ISS-1663). */
test("a config read that failed is told apart from a checkout that names no project", () => {
  const out = lines(projectRows({ policy: unreadFrom("Forge answered 503\nno available server"), deploy: null }));
  assert.match(out, /^release policy: the project config could not be read, so nothing below it was read rather than declared: Forge answered 503$/mu,
    "the sentence the transport handed back travels to the row, first line only");
  assert.doesNotMatch(out, /names no project/u, "and it is not the slugless checkout's row");
  assert.doesNotMatch(out, /not stated/u, "nothing derived off an unread policy is printed at all");
  assert.doesNotMatch(out, /staging branch/u);
  assert.equal(projectRows({ policy: unreadFrom("gone"), deploy: null })[0].level, "miss",
    "a read that did not happen is a failure of the report, not a note about the project");
});

/* Every reader the fix leaves alone, held to the same answer across the three states, because the
   new value is truthy where `null` was falsy and a `policy &&` guard is exactly what that moves. */
test("the readers that do not decide on the difference answer the same across all three states", () => {
  const unread = unreadFrom("Forge answered 503");
  for (const [name, read] of [
    ["landingRoute", (policy) => landingRoute(policy, NONE).value],
    ["waitsForPerson", waitsForPerson],
    ["releaseLine", releaseLine],
    ["releaseConflict", releaseConflict],
    ["the staging read", (policy) => policy?.staging ?? null],
    ["judgementOf", judgementOf],
  ]) {
    assert.deepEqual(read(unread), read(null),
      `${name} answers one thing for a checkout with no project and another for a read that failed`);
  }
  assert.equal(landingRoute(POLICY, NONE).value, "after-merge", "and a config that answers is untouched");
  assert.equal(waitsForPerson(POLICY), false);
  assert.deepEqual(releaseLine(POLICY), ["promotion", "to master, a person's, owed"]);
  assert.equal(releaseConflict(POLICY), null);
  assert.equal(judgementOf(POLICY), NOT_STATED);
});

test("a payload carrying a credential names the field it sits in and the credential it is", () => {
  const deploy = deployFrom(HELD);
  const found = credentialLeak({ body: `logged in with correct-horse-battery` }, deploy);
  assert.deepEqual(found, { field: "body", credential: "test credentials · password" });
  assert.match(leakRefusal(found, "The payload"), /forge doctor --credentials/u);
});

/* The edge of the guarantee, asserted rather than described: below the length it is whole-field
   only, and a claim wider than that is one the guard cannot keep. */
test("a short credential is refused where a field is it, quoting and spacing aside", () => {
  const deploy = deployFrom(stagingOf({ testCredentials: [{ username: "admin" }] }));
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
  assert.equal(credentialLeak({ body: "correct-horse-battery" },
    deployFrom(stagingOf({ preview: { url: "https://x.test" }, testCredentials: [] }))), null);
  assert.equal(credentialLeak({ body: "correct-horse-battery" }, null), null,
    "a read this CLI could not make refuses nothing: that refusal would have no route out");
});

test("a credential nested anywhere in a payload is found, and the field says where", () => {
  const found = credentialLeak({ data: { fields: ["ok", "correct-horse-battery"] } }, deployFrom(HELD));
  assert.equal(found.field, "data.fields.1");
});


/* Where the merge sits is derived and not asked for again: the project already told the tracker what
   its release is and whether production deploys on its own, which is what decides it. */
test("the landing route comes off the release model and the auto-deploy flag, and a key overrides it", () => {
  const model = (releaseModel, autoProdDeploy) =>
    landingRoute(releaseFrom({ baseBranch: "master", releaseModel, pipelineConfig: { autoProdDeploy } }), NONE).value;
  assert.equal(model("none", true), "before-merge",
    "no release step and an automatic production deploy means the push is the deploy, so the candidate is judged before it");
  assert.equal(model("publish", true), "before-merge", "and a publication nobody has to ask for is the same push");
  assert.equal(model("none", false), "after-merge", "a release nothing automates is landed and then judged");
  assert.equal(model("publish", false), "after-merge");
  assert.equal(landingRoute(POLICY, NONE).value, "after-merge", "a promotion lands on staging and judges there");
  assert.equal(landingRoute(releaseFrom({}), NONE).value, NOT_STATED,
    "a record declaring no model is discovered, never defaulted to a route it did not choose");
  assert.equal(model("hand-carried", true), NOT_STATED,
    "and a model this CLI does not know derives nothing either, a route read off a word nothing understands being a guess");
  const key = { value: "before-merge", from: ".forge.json" };
  assert.deepEqual(landingRoute(POLICY, key), key, "the project's own key outranks what is derived, and says so");
});

test("the independent-judgement line is the tracker record's, and no checkout key moves it", () => {
  const qa = (held) => judgementOf(releaseFrom({ pipelineConfig: { qa: held } }));
  assert.equal(qa("independent"), "independent");
  assert.equal(qa("builder"), "builder");
  assert.equal(qa(undefined), NOT_STATED, "unanswered is discovered and recorded, not read as either");
  assert.equal(qa("yes"), NOT_STATED, "and a value the field does not take is unanswered, never the stricter one");
});

test("the report prints both lines, the route with the source it was read from", () => {
  const out = said({ landing: NONE });
  assert.match(out, /^where the merge sits: after-merge {2}← the tracker's project config$/mu);
  assert.match(out, /^independent judgement: not stated between developed and testing {2}← the tracker's project config$/mu);
  assert.match(said({ landing: { value: "before-merge", from: ".forge.json" } }),
    /^where the merge sits: before-merge {2}← \.forge\.json$/mu);
});

/* What a person still owes before an issue at the deploying rung may close, over every shape a
   policy has. Read as the reason and not as a flag, because both callers print it: the landing says
   why it stopped at the rung and the report says why the close is not the run's (ISS-1147). */
test("what a person owes before the close is the policy's own answer, and silence is a person's", () => {
  const owed = (over) => personOwedForRelease(releaseFrom({ baseBranch: "staging", ...over }));
  const model = (releaseModel, autoProdDeploy, over = {}) =>
    owed({ releaseModel, pipelineConfig: { autoProdDeploy }, ...over });
  assert.equal(model("none", false), null,
    "a project declaring no release step owes nobody an act at the rung: the change that landed is out (G-11)");
  assert.equal(model("none", true), null, "and the automatic-deploy flag decides nothing there either");
  assert.equal(model("publish", true), null,
    "a publication the project makes without being asked was the release, and nobody owes an act");
  assert.equal(model("promote", true, { liveBranch: "master" }), null,
    "and so does a promotion the project makes without being asked");
  assert.match(model("publish", false),
    /^the release is an act on this project's live deploy binding, and nothing here says it has been made$/u,
    "a publication nothing automates is somebody's act, and the live branch decides none of it");
  assert.match(model("promote", false, { liveBranch: "master" }),
    /^the promotion from staging to master is a person's$/u,
    "a promotion no flag makes automatic is a person's, named by the branches it moves between");
  assert.match(model("promote", false, { liveBranch: "master", releaseStrategy: "fast-forward" }),
    /^the promotion from staging to master, by fast-forward, is a person's$/u,
    "and the strategy is named where the project declared one, that being how the move is made");
  assert.match(model("promote", false, { baseBranch: null, liveBranch: "master" }),
    /^the promotion to master is a person's$/u,
    "with no base branch declared the sentence names the one branch there is, rather than defaulting the other");
  /* The one the twelve stranded issues would have been closed by, had the read been optimistic. */
  assert.match(personOwedForRelease(null),
    /this checkout names no project, so nothing here says a release happened/u,
    "a checkout with no project to read one for owes a person, never an automatic release");
  assert.match(personOwedForRelease(unreadFrom("Forge answered 503\nno available server")),
    /^the project config could not be read, so nothing here says a release happened: Forge answered 503$/u,
    "and a read that did not happen says so, with the tracker's own sentence on it");
  assert.match(owed({ pipelineConfig: { autoProdDeploy: true } }),
    /^this project declares no release model, so nothing here says what a release is or whose act it would be/u,
    "a project that declared nothing keeps a person in the loop, a null model not being a waiver");
  assert.match(model("hand-carried", true),
    /^this project declares the release model `hand-carried`, which this CLI does not know/u,
    "and a model this CLI cannot read names the value rather than reading it as none");
  assert.match(model("promote", true),
    /^the live branch is unset under a model that promotes to it, so nothing says where a release lands/u,
    "the one model with a branch to name owes a person while it is unnamed");
});

/* Every reader of a policy that reads, over every model and both settings of the flag: the cases
   above each pin one reader's interesting rows, and a reader wrong in one combination alone passed
   them all (consult 60f1bb F1). */
test("every reader of a read policy answers one way per model and flag", () => {
  const REVIEWED = ["review", "none, by project config"];
  const rows = [
    ["none", true, { route: "before-merge", waits: false, line: REVIEWED, owed: null }],
    ["none", false, { route: "after-merge", waits: false, line: REVIEWED, owed: null }],
    ["publish", true, { route: "before-merge", waits: false, line: REVIEWED, owed: null }],
    ["publish", false, { route: "after-merge", waits: true, line: null, owed: /live deploy binding/u }],
    ["promote", true, { route: "after-merge", waits: false, line: ["promotion", "to live, automatic"], owed: null }],
    ["promote", false, { route: "after-merge", waits: false,
      line: ["promotion", "to live, a person's, owed"], owed: /^the promotion from master to live is a person's$/u }],
  ];
  for (const [releaseModel, autoProdDeploy, want] of rows) {
    const policy = releaseFrom({
      baseBranch: "master",
      releaseModel,
      ...(releaseModel === "promote" ? { liveBranch: "live" } : {}),
      pipelineConfig: { autoProdDeploy },
    });
    const where = `${releaseModel}, deploying ${autoProdDeploy ? "on its own" : "by hand"}`;
    assert.equal(landingRoute(policy, NONE).value, want.route, `landingRoute: ${where}`);
    assert.equal(waitsForPerson(policy), want.waits, `waitsForPerson: ${where}`);
    assert.deepEqual(releaseLine(policy), want.line, `releaseLine: ${where}`);
    assert.equal(releaseConflict(policy), null, `releaseConflict: ${where}`);
    if (want.owed) assert.match(personOwedForRelease(policy), want.owed, `personOwedForRelease: ${where}`);
    else assert.equal(personOwedForRelease(policy), null, `personOwedForRelease: ${where}`);
  }
});

/* The declaration the tracker states and this is the reader of: the live branch is served non-null
   only under the promoting model and is read under no other, so a row carrying one anyway moves
   nothing. A test asserting what a reader does not read is the only shape that holds that. */
test("the live branch is read under the promoting model and under no other", () => {
  for (const releaseModel of ["none", "publish"]) {
    const carried = { baseBranch: "master", releaseModel, liveBranch: "live", releaseStrategy: "merge" };
    const bare = { baseBranch: "master", releaseModel };
    for (const autoProdDeploy of [true, false]) {
      const policy = (over) => releaseFrom({ ...over, pipelineConfig: { autoProdDeploy } });
      for (const [name, read] of [
        ["personOwedForRelease", personOwedForRelease],
        ["waitsForPerson", waitsForPerson],
        ["releaseLine", releaseLine],
        ["releaseConflict", releaseConflict],
        ["landingRoute", (held) => landingRoute(held, NONE).value],
      ]) {
        assert.deepEqual(read(policy(carried)), read(policy(bare)),
          `${name} answers ${releaseModel} differently for a row that carries a live branch`);
      }
    }
  }
});

test("a readable promoting policy waits for no person's screen review, and an unreadable one does", () => {
  assert.equal(waitsForPerson(POLICY), false,
    "the promotion is itself the act a person takes, so nothing is owed a look before it");
  assert.equal(waitsForPerson(releaseFrom({ baseBranch: "staging", releaseModel: "promote" })), true,
    "while the branch it promotes to is unnamed, the fail-safe stands");
  assert.equal(waitsForPerson(releaseFrom({ baseBranch: "master", releaseModel: "none",
    pipelineConfig: { autoProdDeploy: false } })), false,
    "a project with no release step leaves no moment before one at which a person could be shown anything");
  assert.equal(waitsForPerson(releaseFrom({ baseBranch: "master", releaseModel: "publish",
    pipelineConfig: { autoProdDeploy: false } })), true,
    "and a publication somebody makes by hand is shown to them first");
});

test("the derived line on a verification is the model's own, and the rung's conflict names what was not declared", () => {
  assert.deepEqual(releaseLine(POLICY), ["promotion", "to master, a person's, owed"]);
  assert.deepEqual(releaseLine(releaseFrom({ baseBranch: "staging", liveBranch: "master",
    releaseModel: "promote", pipelineConfig: { autoProdDeploy: true } })),
  ["promotion", "to master, automatic"]);
  assert.deepEqual(releaseLine(releaseFrom({ baseBranch: "master", releaseModel: "none" })),
    ["review", "none, by project config"], "no release step is no review either");
  assert.equal(releaseLine(releaseFrom({ baseBranch: "master", releaseModel: "publish" })), null,
    "a publication nobody automated stamps nothing: what it owes is said where the rung says it");
  assert.match(releaseConflict(releaseFrom({ baseBranch: "master",
    pipelineConfig: { autoProdDeploy: true } })),
  /^production deploys are automatic and this project declares no release model/u);
  assert.equal(releaseConflict(releaseFrom({ baseBranch: "master", releaseModel: "none",
    pipelineConfig: { autoProdDeploy: true } })), null,
  "and a project whose model is read carries no conflict to report");
});
