/* The rung reaches the served method: `forge guide` renders a part for the rung it was given and
   ends by saying which rounds that rung buys, and the verbs that act carry the same text for the
   issue in hand. Each case is watched failing on a planted tree or a planted issue, a walker over a
   copy that happens to hold no fence looking exactly like a walker over nothing. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, homeEnv, ranAsync, tempHome, tempRoom } from "../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("rounds").path;

const { contractAnswer, partsOf, readContract } = await import("../../src/guides/contract.mjs");
const { skillGuideAnswer } = await import("../../src/guides/skill-guides.mjs");
const { roundLines, rungRefusal, rungServed } = await import("../../src/guides/rounds.mjs");
const { FEATURE, RUNGS, SPARES } = await import("../../src/ladder.mjs");
const { DEFAULT } = await import("../../src/guides/flow.mjs");
const { render } = await import("../../src/flow/record/page.mjs");

const PLUGIN = new URL("../../", import.meta.url).pathname;
const FORGE = join(PLUGIN, "bin", "forge");
const [TRIVIAL] = RUNGS;
const SCOPED = "one scoped run when a unit of work is finished";
const SLOWER = "never a reason to spend it less often";

const guided = (...argv) => ranAsync(FORGE, ["guide", ...argv], homeEnv("rounds-cli"));
const text = (answer) => answer.lines.join("\n");

/* The body alone: every answer ends with the rounds and then the flow line, so a comparison of two
   rungs' bodies has to drop the tail that is the difference it is not asking about. */
const bodyOf = (answer) =>
  text(answer).split("\nRung `")[0].split("\nNo rung was named")[0].replace(/\s+$/u, "");

test("a part served at a rung below the top ends with the rounds that rung buys", () => {
  const said = text(contractAnswer({ part: "in_progress", rung: TRIVIAL }));
  for (const round of SPARES[TRIVIAL]) {
    assert.ok(said.includes(round), `\`${TRIVIAL}\` buys "${round}" and the part served to it says nothing of it`);
  }
  assert.ok(said.indexOf(SPARES[TRIVIAL][0]) < said.indexOf("Flow "),
    "the rounds sit above the flow line, which is what a served answer ends with");
});

test("the top rung is served none of those lines, and a call naming no rung says which rung it assumed", () => {
  const top = text(contractAnswer({ part: "in_progress", rung: FEATURE }));
  for (const round of SPARES[TRIVIAL]) {
    assert.ok(!top.includes(round), `the top rung is offered "${round}", which is what the rungs below it buy`);
  }
  const unstated = contractAnswer({ part: "in_progress" });
  assert.equal(bodyOf(unstated), bodyOf(contractAnswer({ part: "in_progress", rung: FEATURE })),
    "a call naming no rung is served the top rung's text, the upward rule being what an unstated rung resolves to");
  assert.equal(text(unstated).split("\n").filter((line) => line.startsWith("No rung was named")).length, 1,
    "and one line says so, because a rung nobody was told about is a rung nobody can correct");
});

test("a rung that is no rung is refused before a part is read, on both served surfaces", () => {
  for (const answer of [contractAnswer({ part: "in_progress", rung: "nonesuch" }),
    skillGuideAnswer("issue-flow")({ part: "verification", rung: "nonesuch" })]) {
    assert.match(answer.refusal, /`nonesuch` is no rung/u);
    assert.match(answer.refusal, new RegExp(RUNGS.join(", "), "u"), "naming what this copy does serve");
    assert.equal(answer.lines, undefined, "and no part is served beside the refusal");
  }
});

test("the verb refuses the same and prints no part of the contract", async () => {
  const refused = await guided("contract", "in_progress", "--rung", "nonesuch");
  assert.equal(refused.status, 1, `a rung that is no rung is a refusal:\n${refused.stdout}${refused.stderr}`);
  assert.match(refused.stderr, /`nonesuch` is no rung/u);
  assert.equal(refused.stdout.trim(), "", "and nothing of the contract reaches stdout beside it");
});

/* The reason the rung is an argument rather than a lookup: a guide read that dies on a rate limit
   costs a run the very method it needs to work around one. The room holds no credential at all. */
test("a guide call naming a rung is answered with nothing asked of the tracker", async () => {
  for (const rung of RUNGS) {
    const said = await guided("contract", "in_progress", "--rung", rung);
    assert.equal(said.status, 0, `${rung} was not answered off disk:\n${said.stdout}${said.stderr}`);
    assert.match(said.stdout, new RegExp(`Rung \`${rung}\``, "u"));
  }
});

/* Planted, because no part this copy ships carries a rung fence: a case driven by the shipped
   contract alone passes while `contractAnswer` still hands back the part's raw text. */
const plantedContract = () => {
  const root = tempRoom("rounds-contract-");
  const dir = join(root, "guides", "contract", DEFAULT);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "01-the-contract.md"), "# The contract\n\n**Contract 1.** The opening.\n");
  writeFileSync(join(dir, "02-approved.md"),
    "### `approved` — the stage\n\nWhat every rung owes.\n\n<!-- forge:when rung feature -->\nWhat only the top rung owes.\n<!-- forge:end -->\n");
  return root;
};

test("a part fenced on the rung is served to the rung it names and to no other", () => {
  const root = plantedContract();
  const served = (rung) => text(contractAnswer({ part: "approved", rung, root }));
  assert.ok(served(FEATURE).includes("What only the top rung owes."),
    "the top rung is served the block its own fence names");
  assert.ok(!served(TRIVIAL).includes("What only the top rung owes."),
    "and a lighter rung is served the part without it — absent, not annotated");
  assert.ok(served(TRIVIAL).includes("What every rung owes."), "the unfenced half standing at both");
  assert.ok(!served(TRIVIAL).includes("forge:when"), "and no marker reaches a reader at either");
});

/* Every part this copy ships holds no fence, so the two rungs' bodies are equal — which is the
   invariant behind a served body surviving the rendering `contractAnswer` now does. */
test("a contract part holding no fence is served byte for byte as it was written", () => {
  const written = partsOf(readContract());
  assert.ok(written.length > 10, `the contract holds ${written.length} part(s), so this asserted almost nothing`);
  for (const part of written) {
    const [key] = part.keys;
    assert.equal(bodyOf(contractAnswer({ part: key })), part.text,
      `${key} is served as something other than the text on disk, and it holds no fence to make it so`);
    assert.equal(bodyOf(contractAnswer({ part: key, rung: TRIVIAL })), part.text,
      `${key} is served differently at a lighter rung and holds no fence to make it so`);
  }
});

test("the gate demand a lighter rung does not buy is absent from the text it is served", () => {
  const served = (rung) => text(skillGuideAnswer("issue-flow")({ part: "verification", rung }));
  assert.ok(served(FEATURE).includes(SCOPED), "the top rung still owes the run per unit of work");
  assert.ok(!served(TRIVIAL).includes(SCOPED), "and a lighter rung is not shown a round its ceiling refuses");
  assert.ok(served(FEATURE).includes(SLOWER) && !served(TRIVIAL).includes(SLOWER),
    "the sentence answering a slow gate with `spend it no less often` goes with the demand it defends");
  assert.ok(served(TRIVIAL).includes("the only whole run the work owes"),
    "what every rung owes standing at both, the fence taking the demand and not the paragraph");
  assert.ok(served(TRIVIAL).includes("gate-review skill"),
    "and the route to a gate too slow stands at every rung, which is not a round anything buys");
});

test("the rounds have one spelling, and no text this copy serves holds a second", () => {
  const served = readdirSync(join(PLUGIN, "guides"), { recursive: true, withFileTypes: true })
    .filter((one) => one.isFile() && one.name.endsWith(".md"))
    .map((one) => join(one.parentPath ?? one.path, one.name));
  assert.ok(served.length > 20, `${served.length} served file(s) were read, so this asserted almost nothing`);
  const restating = [];
  for (const file of served) {
    const held = readFileSync(file, "utf8");
    for (const round of Object.values(SPARES).flat()) {
      if (held.includes(round)) restating.push(`${file}: ${round}`);
    }
  }
  assert.deepEqual(restating, [], "a served text restates a round `SPARES` already spells, which is "
    + "the second copy this change exists to remove: cut it, and let the tail carry it");
});

test("the rung a caller names decides nothing else about the answer", () => {
  assert.equal(rungServed("nonesuch"), FEATURE);
  assert.equal(rungServed(TRIVIAL), TRIVIAL);
  assert.equal(rungRefusal(null), null, "a call naming no rung is not a refusal");
  assert.deepEqual(roundLines(FEATURE).filter((line) => SPARES[TRIVIAL].includes(line.trim())), []);
});

/* And the other half: the verbs that act carry the part for the act, so the rung they carry has to
   be the effective one the lane is printed at rather than the complexity field it starts from. */
const CLIMBED = render("correction", { moved: "Rung: trivial -> feature", why: "the work turned out larger" });

/* One run per issue, each holding its own lease: the part is delivered once per phase per run, so
   three claims under one id would read a suppressed delivery as a rung-blind one. */
const runFor = (key) => `run-${key.toLowerCase()}`;

const issue = (key, complexity) => ({
  documentId: `uuid-${key}`, issueId: key, status: "open", title: `${key} title`,
  description: "what it is", complexity,
  sessionContext: { lease: { holder: runFor(key), agent: "a-test-agent", pid: "4242",
    renewedAt: new Date().toISOString(), minutes: 30, next: null, history: [] } },
});

const state = {
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  issues: [issue("ISS-3001", "xs"), issue("ISS-3002", "m"), issue("ISS-3003", "xs"), issue("ISS-3004", "xs")],
  comments: { "uuid-ISS-3003": [{ documentId: "c-1", createdAt: "2026-09-11T00:00:00.000Z", authorId: "agent", body: CLIMBED }] },
  minted: 0,
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      const held = state.issues.find((one) => one.documentId === args.documentId);
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      if (args.action === "update") Object.assign(held, args.data);
      if (args.action === "transition") Object.assign(held, { status: args.data.status });
      return held;
    },
    forge_comments: (args) => {
      const key = args.filters?.issue ?? args.data?.issue;
      if (args.action === "list") {
        const rows = state.comments[key] ?? [];
        return { comments: rows, returned: rows.length, limit: rows.length, hasMore: false };
      }
      const row = { documentId: `c-${state.minted += 1}`, createdAt: new Date().toISOString(), ...args.data };
      (state.comments[key] ??= []).push(row);
      return row;
    },
  },
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const env = (who) => ({ ...tracker.env, AI_AGENT: "a-test-agent", CLAUDE_PID: "4242",
  FORGE_SESSION_ID: who, FORGE_CODEX_DISABLE: "1" });

const claimed = (ref) => ranAsync(FORGE, ["claim", ref], env(runFor(ref)));

test("the part a claim prints carries the rounds the issue's own rung buys", async () => {
  const light = await claimed("ISS-3001");
  assert.equal(light.status, 0, `the claim did not land:\n${light.stdout}${light.stderr}`);
  for (const round of SPARES[TRIVIAL]) {
    assert.ok(light.stdout.includes(round),
      `an \`xs\` issue is claimed and the phase part says nothing of "${round}"`);
  }
});

test("and the top rung is claimed with none of them", async () => {
  const heavy = await claimed("ISS-3002");
  assert.equal(heavy.status, 0, `the claim did not land:\n${heavy.stdout}${heavy.stderr}`);
  for (const round of SPARES[TRIVIAL]) {
    assert.ok(!heavy.stdout.includes(round), `an \`m\` issue is offered "${round}"`);
  }
});

/* The rung is read off the record and not the field, which is the whole reason the lane and the part
   are printed at one answer: a climbed `xs` shown the lighter rounds would spend a ceiling it lost. */
test("an issue corrected upward is claimed at the rung it climbed to", async () => {
  /* Twice: the correction is a comment this session has not been shown, and the first write is held
     back until it has been. The second is the claim, and the rung it prints is what this asks. */
  await claimed("ISS-3003");
  const climbed = await claimed("ISS-3003");
  assert.equal(climbed.status, 0, `the claim did not land:\n${climbed.stdout}${climbed.stderr}`);
  assert.match(climbed.stdout, /Lane at `feature`/u, "the lane reads the correction");
  for (const round of SPARES[TRIVIAL]) {
    assert.ok(!climbed.stdout.includes(round),
      `a climbed \`xs\` is offered "${round}", so the part read the field the lane did not`);
  }
});

test("a record write carries the same part the guide verb answers for that phase at that rung", async () => {
  const wrote = await ranAsync(FORGE, ["record", "confirmation", "ISS-3004", "--where", "a.mjs:1",
    "--is", "what it is in the code's own terms", "--finding", "holds"], env(runFor("ISS-3004")));
  assert.equal(wrote.status, 0, `the record did not land:\n${wrote.stdout}${wrote.stderr}`);
  const served = await guided("issue-flow", "1", "--rung", TRIVIAL);
  assert.equal(served.status, 0, `the phase did not serve:\n${served.stdout}${served.stderr}`);
  assert.ok(wrote.stderr.includes(served.stdout.trim()),
    "the part a record write prints is the guide verb's own answer for that phase at that rung");
});
