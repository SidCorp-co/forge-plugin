/* A missing field proposed and written, end to end: `forge new` and `forge issue --propose` spawned
   against a tracker that keeps what it is sent and a gateway that answers each question with the one
   call a case scripts. What is watched is what reaches the tracker — the update, the correction — and
   the reply's lines, in the order a filer reads them. */
import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { projectRecord, projectRoom, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { OWN, trackerFor } from "../../fixtures/own-project.mjs";
import { fakeGateway } from "../../fixtures/model/gateway.mjs";

process.env.XDG_CONFIG_HOME = tempHome("proposed-fields").path;

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const TITLE = "a missing field is proposed where the gap starts";
const BODY = [
  "## Outcome", "", "A filing that names no field is given one by the model the project names.", "",
  "## Rules", "", "- A field the filer gave always wins.", "",
  "## Out of scope", "", "Anything the tracker does on its own.",
].join("\n");
const SCALE = { critical: "stops every run", high: "a lost turn or a failed landing", medium: "friction with a way round", low: "wording and cosmetics" };

const state = {
  calls: [],
  comments: {},
  issues: [],
  answer: {
    forge_issues: (args) => {
      if (args.action === "list") return { issues: [...state.issues], returned: state.issues.length, hasMore: false };
      if (args.action === "create") {
        const made = { documentId: `made-${state.issues.length + 1}`, issueId: `ISS-${900 + state.issues.length}`, ...args.data };
        state.issues.push(made);
        return { ...made };
      }
      const held = state.issues.find((one) => one.documentId === args.documentId);
      if (args.action === "get") return held ? { ...held } : {};
      if (args.action === "update" && held) {
        /* Acknowledged whole and applied in part, which is the answer a read-back exists for. */
        const kept = Object.entries(args.data ?? {}).filter(([key]) => key !== state.drops);
        return { ...Object.assign(held, Object.fromEntries(kept)) };
      }
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    forge_comments: (args) => {
      if (args.action !== "list") {
        if (state.refusesComments) return { refused: state.refusesComments };
        const one = { documentId: `c-${state.calls.length}`, createdAt: new Date().toISOString(), authorId: "agent", body: args.data.body };
        (state.comments[args.data.issue] ??= []).push(one);
        return { documentId: one.documentId };
      }
      const held = state.comments[args.filters?.issue] ?? [];
      return { comments: held, returned: held.length, hasMore: false };
    },
  },
};

const { tracker, env, room: CHECKOUT } = await trackerFor(state);
const gateway = await fakeGateway({
  complexity: { complexity: "m", confidence: 0.8, why: "two modules and a document travel with it" },
  priority: { priority: "high", confidence: 0.6, why: "a filing left unranked loses its place in the order" },
});
test.after(async () => {
  await gateway.close();
  await tracker.close();
});

/* The machine's half: the gateway the questions go to, and no profile of the developer's to fall back on. */
const HOME = env.XDG_CONFIG_HOME;
const machine = join(HOME, "forge", "config.json");
const withGateway = (url) => writeFileSync(machine, JSON.stringify({
  ...JSON.parse(readFileSync(machine, "utf8")), codex: url ? { url, key: "k" } : {},
}));
const ENV = { ...env, CLAUDE_PROXY_ENV: join(tempRoom("no-profile-"), "none.env") };

const recorded = (keys) => projectRecord(CHECKOUT, HOME, { ...OWN, ...keys });
const MODELS = { codex: { ...OWN.codex, complexityModel: "cx/luna-test", priorityModel: "cx/astra-test" }, priorities: SCALE };

const bodyAt = () => {
  const path = join(tempRoom("proposed-body-"), "body.md");
  writeFileSync(path, BODY);
  return path;
};
const filed = (...argv) => ranAsync(FORGE, ["new", bodyAt(), "--title", TITLE, "--category", "feature", ...argv], ENV, CHECKOUT);

const fresh = () => {
  state.calls = [];
  state.issues = [];
  state.comments = {};
  state.refusesComments = null;
  state.drops = null;
  gateway.sent.length = 0;
};
const updates = () => state.calls.filter((one) => one.name === "forge_issues" && one.args.action === "update"
  && one.args.data?.sessionContext === undefined).map((one) => one.args.data);
const corrections = () => Object.values(state.comments).flat().map((one) => one.body).filter((one) => /forge-record: correction/u.test(one));

test("a filing naming neither field is given both, each by the model the project names, with the model on the record and in the reply", async () => {
  fresh();
  recorded(MODELS);
  withGateway(gateway.url);
  const run = await filed();
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(updates(), [{ priority: "high", complexity: "m" }], "one update carries both proposals");
  assert.deepEqual(gateway.sent.map((one) => one.model).sort(), ["cx/astra-test", "cx/luna-test"], "each field asked of its own model");
  const [correction] = corrections();
  assert.match(correction, /priority set to `high`, complexity set to `m` by a proposal/u);
  assert.match(correction, /priority high by cx\/astra-test \(confidence 0\.60\) — a filing left unranked loses its place/u,
    "the correction names the model, its confidence and its sentence");
  assert.match(correction, /complexity m by cx\/luna-test \(confidence 0\.80\) — two modules and a document/u);
  const lines = run.stdout.split("\n");
  const proposed = lines.findIndex((one) => /^priority high proposed by cx\/astra-test/u.test(one));
  const landed = lines.findIndex((one) => /is filed at made-1/u.test(one));
  assert.ok(proposed >= 0 && landed > proposed, `the proposal lines come before the id line, which stays last:\n${run.stdout}`);
  assert.match(run.stdout, /^complexity m proposed by cx\/luna-test \(confidence 0\.80\) and written\.$/mu);
});

test("the priority question carries the project's own scale, and a field the filer gave is asked for by nobody", async () => {
  fresh();
  recorded(MODELS);
  withGateway(gateway.url);
  const run = await filed("--complexity", "xs");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(gateway.sent.map((one) => one.tool_choice?.name), ["priority"], "only the absent field is asked");
  const [asked] = gateway.sent;
  const role = asked.system.map((one) => one.text).join("\n");
  assert.match(role, /- high: a lost turn or a failed landing/u, "the level's text is the project's");
  assert.deepEqual(asked.tools[0].input_schema.properties.priority.enum, ["critical", "high", "medium", "low"]);
  assert.equal(state.issues[0].complexity, "xs", "the filer's complexity stands as typed");
  assert.deepEqual(updates(), [{ priority: "high" }]);
});

test("where the project names no model, nothing is asked and the reply names the setting for each field left unset", async () => {
  fresh();
  recorded({});
  withGateway(gateway.url);
  const run = await filed();
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(gateway.sent.length, 0);
  assert.deepEqual(updates(), [], "no field written");
  assert.match(run.stdout, /^priority left unset: this project's record names no `codex\.priorityModel`\. `forge doctor --set codex\.priorityModel=<model>` turns its proposal on\.$/mu);
  assert.match(run.stdout, /^complexity left unset: this project's record names no `codex\.complexityModel`\. `forge doctor --set codex\.complexityModel=<model>` turns its proposal on\.$/mu);
});

test("a proposal that fails files the issue with that field unset and prints the command that asks again", async () => {
  fresh();
  recorded({ codex: { ...OWN.codex, complexityModel: "cx/luna-test" } });
  withGateway(null);
  const run = await filed("--priority", "low");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(state.issues.length, 1, "the issue is filed");
  assert.equal(state.issues[0].complexity, undefined, "with no complexity");
  assert.match(run.stdout, /^complexity left unset: the proposal by cx\/luna-test failed — there is no gateway to send it to/mu);
  assert.match(run.stdout, /Propose it again: forge issue ISS-900 --propose$/mu);
  assert.match(run.stdout.trim().split("\n").at(-1), /ISS-900 is filed at made-1/u, "and the id line is still the last");
});

test("--propose writes only the field an issue lacks, and leaves the one it holds as it was", async () => {
  fresh();
  recorded(MODELS);
  withGateway(gateway.url);
  state.issues.push({ documentId: "held-1", issueId: "ISS-50", status: "open", title: TITLE, description: BODY,
    category: "feature", priority: "critical", complexity: null });
  const run = await ranAsync(FORGE, ["issue", "ISS-50", "--propose"], ENV, CHECKOUT);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(gateway.sent.map((one) => one.tool_choice?.name), ["complexity"]);
  assert.deepEqual(updates(), [{ complexity: "m" }]);
  assert.equal(state.issues[0].priority, "critical", "the priority the tracker held is untouched");
  const again = await ranAsync(FORGE, ["issue", "ISS-50", "--propose"], ENV, CHECKOUT);
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /ISS-50 holds priority critical and complexity m\. A proposal fills only an absent field/u);
  assert.equal(gateway.sent.length, 1, "and a second call asks nothing");
});

/* The verb ISS-2161 built reads its standing model where the filing does, so one key answers for both. */
test("forge codex complexity asks the model the project's record names, and writes nothing", async () => {
  fresh();
  recorded(MODELS);
  withGateway(gateway.url);
  state.issues.push({ documentId: "held-2", issueId: "ISS-51", status: "open", title: TITLE, description: BODY, category: "feature" });
  const run = await ranAsync(FORGE, ["codex", "complexity", "ISS-51"], ENV, CHECKOUT);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(gateway.sent.map((one) => one.model), ["cx/luna-test"]);
  assert.match(run.stdout, /ISS-51\s+proposed m/u);
  assert.deepEqual(updates(), [], "the verb still writes no field");
});

/* Two writes, and the second can be refused after the first landed: the field then stands, and the reply
   says so rather than calling it unwritten, with the correction's body and the call that posts it. */
test("a correction refused after the field landed says the field stands, and hands back the body to post", async () => {
  fresh();
  recorded({ codex: { ...OWN.codex, complexityModel: "cx/luna-test" } });
  withGateway(gateway.url);
  state.refusesComments = "SERVICE_UNAVAILABLE: the comment store is down";
  const run = await filed("--priority", "low");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(state.issues[0].complexity, "m", "the field the update carried stands");
  assert.match(run.stdout, /^complexity m proposed by cx\/luna-test \(confidence 0\.80\) and written\.$/mu);
  assert.match(run.stdout, /The field\(s\) above were written and the correction naming their model was not: .*the comment store is down/u);
  assert.match(run.stdout, /forge comment made-1 -/u, "with the call that posts it");
  assert.match(run.stdout, /complexity m by cx\/luna-test \(confidence 0\.80\) — two modules/u, "and the body it would have posted");
  assert.doesNotMatch(run.stdout, /were not written/u);
  assert.match(run.stdout.trim().split("\n").at(-1), /ISS-900 is filed at made-1/u);
});

/* One update carries both proposals, and the tracker can keep one and not the other: the one that read
   back stands with a correction of its own, and only the other is the failure, with the call that asks
   again — which then asks for that one alone. */
test("an update the tracker applied in part leaves the landed field recorded and names the other as the failure", async () => {
  fresh();
  recorded(MODELS);
  withGateway(gateway.url);
  state.drops = "complexity";
  const run = await filed();
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(state.issues[0].priority, "high", "the priority the tracker kept stands");
  const [correction] = corrections();
  assert.match(correction, /moved: priority set to `high` by a proposal$/mu, "and its correction names it alone");
  assert.doesNotMatch(correction, /complexity m by/u);
  assert.match(run.stdout, /^priority high proposed by cx\/astra-test \(confidence 0\.60\) and written\.$/mu);
  assert.match(run.stdout, /^complexity left unset: the proposal by cx\/luna-test failed — the tracker did not read it back as written — .*Propose it again: forge issue ISS-900 --propose$/mu);
  assert.match(run.stdout.trim().split("\n").at(-1), /ISS-900 is filed at made-1/u);
});

/* A note on this plugin's backlog, filed from the plugin's own checkout, takes the filing's step: its
   record is the one that decides, and a note carries no field flag, so both are asked. */
const NOTE = [
  "## What happened", "", "A filing from a run came back with no priority and no complexity.", "",
  "## Why it happens", "", "The note route asked nothing of the model the project names.", "",
  "## Outcome", "", "A note is given both fields by the model the project names.", "",
  "## Rules", "", "- A proposal fills only an absent field.", "",
  "## Out of scope", "", "The weights the rank reads.",
].join("\n");
const noteAt = () => {
  const path = join(tempRoom("proposed-note-"), "note.md");
  writeFileSync(path, NOTE);
  return path;
};

test("a feedback note filed from the plugin's own checkout is given both fields, with the correction naming each model", async () => {
  fresh();
  recorded(MODELS);
  withGateway(gateway.url);
  const run = await ranAsync(FORGE, ["feedback", noteAt(), "--title", TITLE], ENV, CHECKOUT);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(updates(), [{ priority: "high", complexity: "m" }]);
  const [correction] = corrections();
  assert.match(correction, /priority high by cx\/astra-test \(confidence 0\.60\) — a filing left unranked loses its place/u);
  assert.match(correction, /complexity m by cx\/luna-test \(confidence 0\.80\) — two modules and a document/u);
  const lines = run.stdout.split("\n");
  const landed = lines.findIndex((one) => /ISS-900 is filed at made-1/u.test(one));
  for (const said of [/^priority high proposed by cx\/astra-test \(confidence 0\.60\) and written\.$/u,
    /^complexity m proposed by cx\/luna-test \(confidence 0\.80\) and written\.$/u]) {
    const at = lines.findIndex((one) => said.test(one));
    assert.ok(at >= 0 && at < landed, `${said} is said before the id line:\n${run.stdout}`);
  }
  assert.match(run.stdout.trim().split("\n").at(-1), /ISS-900 is filed at made-1/u, "the id line stays last");
});

test("a feedback note filed from another project's checkout asks nothing and names where the call that asks is run", async () => {
  fresh();
  withGateway(gateway.url);
  const other = projectRoom(tempRoom("proposed-other-"), HOME, { slug: "somewhere-else", codex: { complexityModel: "cx/luna-test" } });
  const run = await ranAsync(FORGE, ["feedback", noteAt(), "--title", TITLE], ENV, other);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(gateway.sent.length, 0, "that checkout's model decides nothing on this backlog");
  assert.deepEqual(updates(), []);
  assert.match(run.stdout, /^priority and complexity left unset: this filing is on forge-plugin, whose record decides a proposal, and this checkout reads another project's\. From a checkout of forge-plugin: forge issue ISS-900 --propose$/mu);
});
