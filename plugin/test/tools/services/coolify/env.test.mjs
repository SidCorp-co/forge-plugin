/* The `env` group of the tracker route (ISS-47): list reads masked, set reads its value off stdin or
   a file and never off argv, delete and set are writes, and every refusal ends naming the route.
   Spawned, because what is judged is what a developer reads on each stream and which requests left —
   the value a write sends reaching the wire, and no value reaching the output. */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, projectRoom, ranAsync, tempRoom } from "../../../fixtures.mjs";
import { OWN } from "../../../fixtures/own-keys.mjs";

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;

const ENV_ROWS = [{ key: "DATABASE_URL", value: "********" }, { key: "API_KEY", value: "********" }];

const state = {
  answer: {
    forge_coolify: (args) => {
      if (args.action === "env") return state.envList ?? { data: ENV_ROWS };
      if (args.action === "env_set") return state.envSet ?? { key: args.key, value: "********" };
      if (args.action === "env_delete") return { deleted: true, key: args.key };
      return {};
    },
  },
};

const tracker = await fakeTracker(state);
after(() => tracker.close());

const home = tracker.env.XDG_CONFIG_HOME;
const bare = projectRoom(tempRoom("coolify-env-cwd-"), home, { slug: OWN.slug });

/* The default route answers here: no instance saved, no pin, so `coolify` is the tracker's. */
const ran = async (argv, stdin = "") => {
  state.calls = [];
  const answer = await ranAsync(FORGE, ["coolify", ...argv], tracker.env, bare, stdin);
  return { ...answer, calls: state.calls ?? [] };
};

const coolifyCall = (run, action) => run.calls.find((one) => one.name === "forge_coolify" && one.args.action === action);

test("env list renders every key with its value masked, as core sent them", async () => {
  const run = await ran(["env", "list", "--json"]);
  assert.equal(run.status, 0, run.stderr);
  const rows = JSON.parse(run.stdout);
  assert.deepEqual(rows.map((one) => one.key), ["DATABASE_URL", "API_KEY"]);
  assert.ok(rows.every((one) => one.value === "********"), "a value arrived unmasked");
  assert.ok(coolifyCall(run, "env").args.integrationId === undefined, "no binding was narrowed to without a flag");
});

test("env set reads the value from stdin and sends it on the wire, masked nowhere in it", async () => {
  const run = await ran(["env", "set", "DATABASE_URL", "--yes"], "postgres://u:p@h/db\n");
  assert.equal(run.status, 0, run.stderr);
  const sent = coolifyCall(run, "env_set");
  assert.equal(sent.args.key, "DATABASE_URL");
  assert.equal(sent.args.value, "postgres://u:p@h/db", "the trailing newline echo adds is dropped and nothing else");
  assert.doesNotMatch(run.stdout, /postgres:\/\/u:p@h\/db/u, "the value set is not echoed back to the terminal");
});

test("env set reads the value from --value-file", async () => {
  const file = join(bare, "secret.txt");
  writeFileSync(file, "from-a-file\n");
  const run = await ran(["env", "set", "API_KEY", "--value-file", file, "--yes"]);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(coolifyCall(run, "env_set").args.value, "from-a-file");
});

test("env set refuses a value on the command line, naming stdin and --value-file and why", async () => {
  for (const argv of [["env", "set", "KEY", "sekret", "--yes"], ["env", "set", "KEY", "--value", "sekret", "--yes"]]) {
    const run = await ran(argv);
    assert.equal(run.status, 1, `${argv.join(" ")}: ${run.stdout}`);
    assert.match(run.stderr, /shell history/u);
    assert.match(run.stderr, /value-file/u);
    assert.match(run.stderr, /\| forge coolify env set KEY --yes/u, "it points at stdin");
    assert.equal(coolifyCall(run, "env_set"), undefined, "nothing was sent");
  }
});

test("env set and env delete are refused without --yes, before anything is sent", async () => {
  for (const name of ["set", "delete"]) {
    const run = await ran(["env", name, "DATABASE_URL"]);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /: a write is/u, `${name} did not print the consent refusal`);
    assert.match(run.stderr, /it would go to this project's own binding on the tracker/u);
    assert.deepEqual(run.calls, [], `${name} sent a request on its way to the refusal`);
  }
});

test("--dry-run prints PUT and DELETE with the key in the path and the body, the value masked", async () => {
  const put = await ran(["env", "set", "DATABASE_URL", "--dry-run"], "a-real-secret");
  assert.equal(put.status, 0, put.stderr);
  assert.match(put.stdout, /PUT \/api\/projects\/<projectId>\/integrations\/coolify\/env\/DATABASE_URL/u);
  assert.match(put.stdout, /"value": "\*{8}"/u, "the value is masked in the preview");
  assert.doesNotMatch(put.stdout, /a-real-secret/u, "and the secret itself is kept out of it");
  assert.deepEqual(put.calls, [], "a preview sends nothing");
  const del = await ran(["env", "delete", "DATABASE_URL", "--dry-run"]);
  assert.equal(del.status, 0, del.stderr);
  assert.match(del.stdout, /DELETE \/api\/projects\/<projectId>\/integrations\/coolify\/env\/DATABASE_URL/u);
  assert.deepEqual(del.calls, []);
});

test("--redeploy sets redeploy true in the body of a set and a delete", async () => {
  const set = await ran(["env", "set", "DATABASE_URL", "--redeploy", "--yes"], "v");
  assert.equal(coolifyCall(set, "env_set").args.redeploy, true, "set");
  const del = await ran(["env", "delete", "DATABASE_URL", "--redeploy", "--yes"]);
  assert.equal(coolifyCall(del, "env_delete").args.redeploy, true, "delete");
});

test("--integration and --resource map to integrationId and resourceUuid on every action", async () => {
  const list = await ran(["env", "list", "--integration", "i1", "--resource", "r1"]);
  assert.equal(coolifyCall(list, "env").args.integrationId, "i1");
  assert.equal(coolifyCall(list, "env").args.resourceUuid, "r1");
  const set = await ran(["env", "set", "DATABASE_URL", "--integration", "i1", "--resource", "r1", "--yes"], "v");
  assert.equal(coolifyCall(set, "env_set").args.integrationId, "i1");
  assert.equal(coolifyCall(set, "env_set").args.resourceUuid, "r1");
});

test("a core refusal of the write is relayed in core's own words and names the route answering", async () => {
  state.envSet = { refused: "deploys.run is required to write env on this project", code: "FORBIDDEN" };
  const run = await ran(["env", "set", "DATABASE_URL", "--yes"], "v");
  state.envSet = null;
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^FORBIDDEN: deploys.run is required to write env on this project$/mu);
  assert.match(run.stderr, /route answering: tracker, this project's own binding on the tracker/u);
  assert.match(run.stderr.trimEnd().split("\n").at(-1), /forge doctor --coolify-route instance/u,
    "and the route lines are last, so a reader of the tail sees them");
});

test("an empty env listing keeps [] and exit 0 and names the route answering on stderr", async () => {
  state.envList = { data: [] };
  const run = await ran(["env", "list", "--json"]);
  state.envList = null;
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), []);
  assert.match(run.stderr, /^coolify env list: the tracker route answered with nothing\.$/mu);
  assert.match(run.stderr, /route answering: tracker/u);
});

test("coolify env -h and coolify env set -h both answer with the group's own usage", async () => {
  for (const argv of [["env", "-h"], ["env", "set", "-h"], ["env", "list", "-h"]]) {
    const run = await ran(argv);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /^Usage: forge coolify env <list \| set KEY \| delete KEY>/u, argv.join(" "));
  }
});

test("a config holding a saved instance still never sends env over the instance route", async () => {
  /* The instance route's own `env` is an alias to `app env list` and is a different command: this one
     is the tracker's, and a machine on the instance route does not answer it (ISS-47). */
  const at = join(home, "forge", "config.json");
  const held = JSON.parse(readFileSync(at, "utf8"));
  writeFileSync(at, JSON.stringify({ ...held, coolifyRoute: "instance" }));
  const run = await ran(["env", "set", "DATABASE_URL", "--yes"], "v");
  writeFileSync(at, JSON.stringify(held));
  assert.equal(run.status, 1, run.stdout);
  assert.equal(coolifyCall(run, "env_set"), undefined, "nothing reached the tracker's env door");
});
