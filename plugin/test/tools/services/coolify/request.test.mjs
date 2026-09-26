/* The verb end to end, against a fake instance this suite runs. What is being asserted is mostly
   what did NOT get sent, so every case reads the server's own record of the requests it received —
   the body among it, because a write's whole point is which bytes arrived. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { projectEntry, projectRoom, tempRoom, ranAsync } from "../../../fixtures.mjs";

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;

/* A value nothing but the token could be, so a case can say the token is absent by saying this is. */
const TOKEN = "coolify-sentinel-token-2f9";

const IN_SCOPE = {
  uuid: "a-in",
  id: 100,
  name: "web",
  environment_id: 10,
  status: "running:unhealthy",
  fqdn: "web.example.com",
  docker_compose_raw: "version: 3",
  manual_webhook_secret_github: "hook-s3cret",
};
const OUTSIDE = { uuid: "a-out", id: 200, name: "theirs", environment_id: 99, status: "running:healthy" };

const ANSWERS = {
  "/version": "4.0.0-beta.1",
  "/teams/current": { id: 3, name: "ours" },
  "/projects": [{ uuid: "p-in", id: 1, name: "ours" }],
  "/projects/p-in/environments": [{ id: 10, uuid: "e-10", name: "production" }],
  "/applications": [IN_SCOPE, OUTSIDE],
  "/applications/a-in": IN_SCOPE,
  "/applications/a-out": OUTSIDE,
  "/applications/a-odd": { uuid: "a-odd", name: "shapeless" },
  "/applications/a-in/envs": [
    { uuid: "v1", key: "DB_PASSWORD", value: "hunter2" },
    { uuid: "v2", key: "DATABASE_URL", value: "postgres://app:hunter2@db.internal:5432/main" },
    { uuid: "v3", key: "NODE_ENV", value: "production" },
  ],
  "/applications/a-in/restart": { message: "restarted" },
  "POST /applications/a-in/envs": { uuid: "v9" },
  "PATCH /applications/a-in/envs": { message: "ok" },
  "/applications/a-in/logs": { logs: `GET /health 200\nupstream called with Bearer ${TOKEN}\nGET / 200` },
  "/deploy": { deployments: [{ deployment_uuid: "d-1" }] },
};

const QUOTED = {
  _REFUSED: [422, (one) => ({ message: `Rejected value: ${one.value}` })],
  _ESCAPED: [422, (one) => ({ message: "invalid", errors: { value: [one.value] } })],
  _ECHOED: [200, (one) => ({ uuid: "v9", message: `set ${one.key} to ${one.value}` })],
  _PARTED: [422, (one) => ({ message: `Rejected password: ${new URL(one.value).password}` })],
};

let server = null;
let home = null;
let work = null;
let asked = [];

before(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url, "http://x");
    const path = url.pathname.replace(/^\/api\/v1/u, "");
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const body = chunks.length ? Buffer.concat(chunks).toString("utf8") : null;
      asked.push({ path, method: request.method, auth: request.headers.authorization, query: url.search, body });
      /* Keyed by method first: one path answers a read and a write, and a write's own answer is
         what the caller sees, so the two cannot share one reply. */
      const named = `${request.method} ${path}`;
      /* The three answers this fixture invents, because a caller's own value reaches an output
         stream by one route only: the platform quoting it back. A refusal that names it, a refusal
         that nests it where the line gets serialized, and an acceptance that repeats it. The key
         carries which, so the value stays free to be a secret. */
      const sent = body ? JSON.parse(body) : null;
      const tail = typeof sent?.key === "string"
        ? Object.keys(QUOTED).find((one) => sent.key.endsWith(one))
        : undefined;
      if (tail) {
        const [code, said] = QUOTED[tail];
        response.writeHead(code, { "Content-Type": "application/json" });
        response.end(JSON.stringify(said(sent)));
        return;
      }
      const which = Object.hasOwn(ANSWERS, named) ? named : path;
      if (!Object.hasOwn(ANSWERS, which)) {
        response.writeHead(404, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ message: `no route ${path}, sent ${request.headers.authorization}` }));
        return;
      }
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(ANSWERS[which]));
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  home = tempRoom("coolify-home-");
  mkdirSync(join(home, "forge"));
  /* Every case here is the saved instance's route, which is not the one a machine that chose
     nothing takes, so this home chooses it as a checkout reaching these commands would have. */
  writeFileSync(join(home, "forge", "config.json"), JSON.stringify({
    coolifyRoute: "instance",
    coolify: { url: `http://127.0.0.1:${server.address().port}`, apiToken: TOKEN },
  }));
  work = projectRoom(tempRoom("coolify-work-"), home, { coolifyPin: { project_uuid: ["p-in"] } });
});

after(() => server?.close());

const ran = async (...argv) => {
  asked = [];
  const answer = await ranAsync(FORGE, ["coolify", ...argv],
    { ...process.env, XDG_CONFIG_HOME: home, NO_COLOR: "1" }, work);
  return { ...answer, asked };
};

const paths = (answer) => answer.asked.map((one) => one.path);

test("a uuid outside the pin is refused, and its own action path is never asked for", async () => {
  const answer = await ran("app", "restart", "a-out", "--yes");
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /application a-out is outside the pinned project \(p-in\)/u);
  assert.ok(answer.stderr.includes(projectEntry(work, home)), "the refusal does not name the record the pin came from");
  assert.deepEqual(paths(answer).filter((one) => one.includes("a-out/restart")), []);
});

test("a uuid inside the pin reaches its own action path", async () => {
  const answer = await ran("app", "restart", "a-in", "--yes");
  assert.equal(answer.status, 0, answer.stderr);
  assert.ok(paths(answer).includes("/applications/a-in/restart"));
});

test("with nothing pinned every route-index command refuses and names the command that pins one", async () => {
  asked = [];
  const bare = tempRoom("coolify-unpinned-");
  const answer = await ranAsync(FORGE, ["coolify", "app", "list"],
    { ...process.env, XDG_CONFIG_HOME: home }, bare);
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /no project is pinned/u);
  assert.match(answer.stderr, /there is no unscoped mode/u);
  assert.match(answer.stderr, /forge coolify pin --app <name\|uuid>/u);
  assert.match(answer.stderr, /forge coolify pin --project <name\|uuid>/u);
  assert.doesNotMatch(answer.stderr, /\.coolify\.json|write one|"project_uuid"/u);
  assert.deepEqual(asked.map((one) => one.path), [], "an unpinned call sent something");
});

/* The Python CLI's file is what a checkout carried before the pin became this machine's record, and
   one source keeps one answer: a checkout holding only that file is unpinned, and says so. */
test("a .coolify.json in the checkout pins nothing", async () => {
  asked = [];
  const carried = projectRoom(tempRoom("coolify-carried-"), home, { slug: "carried" });
  writeFileSync(join(carried, ".coolify.json"), JSON.stringify({ project_uuid: "p-in" }));
  const answer = await ranAsync(FORGE, ["coolify", "app", "list"],
    { ...process.env, XDG_CONFIG_HOME: home }, carried);
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /no project is pinned/u);
  assert.deepEqual(asked.map((one) => one.path), [], "a call pinned by the file sent something");
});

test("a listing comes back cut to the pin, and says how many it dropped", async () => {
  const answer = await ran("apps", "--json");
  assert.equal(answer.status, 0, answer.stderr);
  const rows = JSON.parse(answer.stdout);
  assert.deepEqual(rows.map((one) => one.uuid), ["a-in"]);
  assert.match(answer.stderr, /1 item\(s\) outside the pinned scope filtered out/u);
});

test("the phantom health half is gone from the answer a caller actually reads", async () => {
  const answer = await ran("apps", "--json");
  assert.equal(JSON.parse(answer.stdout)[0].status, "running");
});

test("one application answers with its projection, and names what it left out", async () => {
  const answer = await ran("app", "get", "a-in", "--json");
  const shown = JSON.parse(answer.stdout);
  assert.equal(shown.docker_compose_raw, undefined);
  assert.equal(shown.name, "web");
  assert.match(answer.stderr, /field\(s\) hidden by the summary — --full for: .*docker_compose_raw/u);
});

test("--full prints the whole object, secrets masked all the same", async () => {
  const answer = await ran("app", "get", "a-in", "--json", "--full");
  const shown = JSON.parse(answer.stdout);
  assert.equal(shown.docker_compose_raw, "version: 3");
  assert.equal(shown.manual_webhook_secret_github, "<redacted>");
});

test("an environment listing is masked by default and plain under --reveal", async () => {
  const masked = JSON.parse((await ran("env", "a-in", "--json")).stdout);
  assert.equal(masked.find((one) => one.key === "DB_PASSWORD").value, "<redacted>");
  assert.equal(masked.find((one) => one.key === "DATABASE_URL").value,
    "postgres://app:<redacted>@db.internal:5432/main");
  assert.equal(masked.find((one) => one.key === "NODE_ENV").value, "production");
  const plain = JSON.parse((await ran("env", "a-in", "--json", "--reveal")).stdout);
  assert.equal(plain.find((one) => one.key === "DB_PASSWORD").value, "hunter2");
});

test("--dry-run prints the request it would send and sends nothing to that path", async () => {
  const answer = await ran("deploy", "--uuid", "a-in", "--dry-run");
  assert.equal(answer.status, 0, answer.stderr);
  assert.match(answer.stdout, /^POST http:\/\/127\.0\.0\.1:\d+\/api\/v1\/deploy\?uuid=a-in$/mu);
  assert.deepEqual(paths(answer).filter((one) => one === "/deploy"), []);
});

/* Suppressing the guard's own lookups under --dry-run would switch the guard off exactly where
   somebody is checking that it is on, so they still run and the refusal still comes. */
test("--dry-run still refuses a uuid outside the pin", async () => {
  const answer = await ran("deploy", "--uuid", "a-out", "--dry-run");
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /a-out is outside the pinned project/u);
});

test("a write is refused without --yes, and nothing is sent", async () => {
  const answer = await ran("app", "restart", "a-in");
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /a write is refused/u);
  /* Which of the two deployment scopes the write would have reached: a refusal that says only that
     one was held leaves a caller on the wrong route sure they were about to deploy the other. */
  assert.match(answer.stderr, /it would go to the saved instance, inside the project this checkout pins/u);
  assert.deepEqual(paths(answer).filter((one) => one.includes("/restart")), []);
});

/* A tag spans projects and a deploy acts, so nothing comes back for the pin to cut down. The
   Python CLI warns and sends the request; refusing is the difference. */
test("deploy by tag is refused and names the route the pin can vouch for", async () => {
  const answer = await ran("deploy", "--tag", "web", "--yes");
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /--tag names resources the pin cannot be checked against/u);
  assert.match(answer.stderr, /--uuid/u);
  assert.deepEqual(paths(answer).filter((one) => one === "/deploy"), []);
});

test("a flag the operation does not declare is refused by name, not read and dropped", async () => {
  const answer = await ran("app", "get", "a-in", "--environment", "staging");
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /--environment/u);
  assert.deepEqual(paths(answer).filter((one) => one.includes("a-in")), []);
});

test("the token travels in the request's own header, to the host the configuration names", async () => {
  const answer = await ran("app", "get", "a-in", "--json");
  const sent = answer.asked.find((one) => one.path === "/applications/a-in");
  assert.equal(sent.auth, `Bearer ${TOKEN}`);
  const shown = await ran("deploy", "--uuid", "a-in", "--dry-run");
  assert.match(shown.stdout, new RegExp(`http://127\\.0\\.0\\.1:${server.address().port}/api/v1/deploy`, "u"));
});

test("the token reaches neither stream on a call that worked", async () => {
  const answer = await ran("app", "get", "a-in", "--json", "--full");
  assert.ok(!answer.stdout.includes(TOKEN), "the token is on stdout");
  assert.ok(!answer.stderr.includes(TOKEN), "the token is on stderr");
});

test("the token reaches neither stream on a refusal, nor under --dry-run", async () => {
  for (const argv of [["app", "restart", "a-out", "--yes"], ["deploy", "--uuid", "a-in", "--dry-run"]]) {
    const answer = await ran(...argv);
    assert.ok(!answer.stdout.includes(TOKEN), `the token is on stdout of ${argv.join(" ")}`);
    assert.ok(!answer.stderr.includes(TOKEN), `the token is on stderr of ${argv.join(" ")}`);
  }
});

/* A gateway that repeats a request back is how a credential reaches a transcript, and from a
   transcript a review or a comment. The fake does exactly that on this route. */
test("a failure whose body echoes the token back is printed with the token struck out", async () => {
  const answer = await ran("app", "get", "gone");
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /sent Bearer <redacted>/u, "the echoed token was not struck out");
  assert.ok(!answer.stderr.includes(TOKEN), "the echoed token reached stderr");
});

test("what resolved is reported with the token masked and the pin named", async () => {
  const answer = await ran("accounts");
  assert.equal(answer.status, 0, answer.stderr);
  assert.ok(!answer.stdout.includes(TOKEN));
  assert.match(answer.stdout, new RegExp(`${TOKEN.length} chars`, "u"));
  assert.match(answer.stdout, /pinned {4}p-in/u);
  assert.ok(answer.stdout.includes(`← ${projectEntry(work, home)}`), answer.stdout);
});

/* The escape is the defect this exists to prevent, so the case is what says there is none: the two
   spellings somebody would reach for first are refused as flags the operation has not got. */
test("nothing widens an unpinned call — not a flag, and not the one the Python CLI has", async () => {
  const bare = tempRoom("coolify-noescape-");
  for (const flag of ["--all", "--no-project-file", "--project"]) {
    asked = [];
    const answer = await ranAsync(FORGE, ["coolify", "app", "list", flag, "p-in"],
      { ...process.env, XDG_CONFIG_HOME: home }, bare);
    assert.equal(answer.status, 1, `${flag} did not refuse`);
    assert.deepEqual(asked.map((one) => one.path), [], `${flag} sent something`);
  }
});

/* The Python CLI reads these; this one does not, so one decision keeps one source and there is no
   precedence rule for a reader to remember. */
test("a pin in the environment is not a pin", async () => {
  const bare = tempRoom("coolify-envpin-");
  asked = [];
  const answer = await ranAsync(FORGE, ["coolify", "app", "list"], {
    ...process.env,
    XDG_CONFIG_HOME: home,
    COOLIFY_PROJECT_UUID: "p-in",
    COOLIFY_PROJECT: "p-in",
  }, bare);
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /no project is pinned/u);
  assert.deepEqual(asked.map((one) => one.path), []);
});

test("a URL and a token in the environment are not an instance", async () => {
  const empty = tempRoom("coolify-noconfig-");
  const answer = await ranAsync(FORGE, ["coolify", "accounts"], {
    ...process.env,
    XDG_CONFIG_HOME: empty,
    COOLIFY_URL: "https://someone-elses.example.com",
    COOLIFY_TOKEN: "env-token",
    COOLIFY_API_KEY: "env-token",
  }, work);
  assert.match(answer.stdout, /No Coolify instance is configured/u);
  assert.doesNotMatch(answer.stdout, /someone-elses/u);
});

/* A home of this case's own: every other case reads the one the suite saved, and a login writes. */
test("login saves the instance where accounts reads it, and keeps what was under the key already", async () => {
  const fresh = tempRoom("coolify-login-");
  mkdirSync(join(fresh, "forge"));
  writeFileSync(join(fresh, "forge", "config.json"),
    JSON.stringify({ coolify: { note: "a sibling under the same key" }, cloudflare: { accounts: [] } }));
  const saved = await ranAsync(FORGE,
    ["coolify", "login", "--url", "https://coolify.example", "--token", TOKEN],
    { ...process.env, XDG_CONFIG_HOME: fresh }, work);
  assert.equal(saved.status, 0, saved.stderr);
  assert.ok(!saved.stdout.includes(TOKEN), "login echoed the token back");

  const held = JSON.parse(readFileSync(join(fresh, "forge", "config.json"), "utf8"));
  assert.equal(held.coolify.apiToken, TOKEN);
  assert.equal(held.coolify.note, "a sibling under the same key", "the login replaced the whole nested object");
  assert.ok(held.cloudflare, "the login dropped another service's key");
  assert.equal((statSync(join(fresh, "forge", "config.json")).mode & 0o777).toString(8), "600");

  const read = await ranAsync(FORGE, ["coolify", "accounts"], { ...process.env, XDG_CONFIG_HOME: fresh }, work);
  assert.match(read.stdout, /https:\/\/coolify\.example\/api\/v1/u, "the base path was not appended");
  assert.ok(!read.stdout.includes(TOKEN));
});

test("whoami names the instance, the team and the environments the pin resolves to", async () => {
  const answer = await ran("whoami");
  assert.equal(answer.status, 0, answer.stderr);
  assert.match(answer.stdout, /instance {2}http:\/\/127\.0\.0\.1:\d+\/api\/v1/u);
  assert.match(answer.stdout, /scope {5}project p-in, environment ids 10/u);
  assert.ok(answer.stdout.includes(`← ${projectEntry(work, home)}`), answer.stdout);
  assert.match(answer.stdout, /apps {6}1 in scope/u);
  assert.ok(!answer.stdout.includes(TOKEN));
});

test("whoami in an unpinned checkout says so rather than answering broadly", async () => {
  const bare = tempRoom("coolify-whoami-bare-");
  const answer = await ranAsync(FORGE, ["coolify", "whoami"],
    { ...process.env, XDG_CONFIG_HOME: home }, bare);
  assert.match(answer.stdout, /scope {5}none/u);
  assert.match(answer.stdout, /no project is pinned/u);
});

/* The earlier egress cases put the token only in a FAILURE body, so they proved nothing about a
   call that worked. A platform that logs its own inbound requests echoes the header back in a
   perfectly successful answer, and that is the path into a transcript. */
test("a successful answer echoing the token has it struck out on every route", async () => {
  const answer = await ran("logs", "a-in", "--json");
  assert.equal(answer.status, 0, answer.stderr);
  assert.match(answer.stdout, /Bearer <redacted>/u, "the echoed token was not struck out");
  assert.ok(!answer.stdout.includes(TOKEN), "the token reached stdout of a successful call");
});

/* `--reveal` unmasks what the platform calls a secret. It must never unmask ours. */
test("--reveal does not reveal our own credential", async () => {
  const answer = await ran("logs", "a-in", "--json", "--reveal");
  assert.equal(answer.status, 0, answer.stderr);
  assert.ok(!answer.stdout.includes(TOKEN), "--reveal printed the token");
  assert.match(answer.stdout, /Bearer <redacted>/u);
});

test("whoami strikes the token out of what the instance answered", async () => {
  const answer = await ran("whoami");
  assert.ok(!answer.stdout.includes(TOKEN));
});

test("a listing under --dry-run prints its request and does not refuse", async () => {
  const answer = await ran("apps", "--dry-run");
  assert.equal(answer.status, 0, answer.stderr);
  assert.match(answer.stdout, /^GET http:\/\/127\.0\.0\.1:\d+\/api\/v1\/applications$/mu);
  assert.deepEqual(paths(answer).filter((one) => one === "/applications"), []);
});

/* A lookup that answers with an object establishing nothing is not a lookup that found nothing:
   the resource is real, and authorising it would act on the strength of a reading that placed it
   nowhere. End to end, because what matters is that the action route is never reached. */
test("a resource answering without the field that places it never reaches its action route", async () => {
  const answer = await ran("app", "restart", "a-odd", "--yes");
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /answered without the field/u);
  assert.deepEqual(paths(answer).filter((one) => one.includes("a-odd/restart")), []);
});

test("the same resource is refused under --dry-run too", async () => {
  const answer = await ran("deploy", "--uuid", "a-odd", "--dry-run");
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /answered without the field/u);
});

/* Withheld and said, not withheld and silent: "could not be placed" and "belongs to another
   project" are different facts and a reader acts differently on each. */
test("a listing row nothing can place is withheld, and said to be, apart from the ones filtered out", async () => {
  const answer = await ran("apps", "--json");
  assert.equal(answer.status, 0, answer.stderr);
  assert.deepEqual(JSON.parse(answer.stdout).map((one) => one.uuid), ["a-in"]);
  assert.match(answer.stderr, /1 item\(s\) outside the pinned scope filtered out/u);
});

/* An environment write is the one request this verb sends with a password in it, so these cases ask
   the two questions that pair: the instance receives the caller's own bytes, and no stream shows
   them. A masking that reached the payload would pass the second and fail the first. */
const SECRET = "postgres://app:hunter2@db.internal:5432/main";

const wroteTo = (answer, method) =>
  answer.asked.find((one) => one.path === "/applications/a-in/envs" && one.method === method);

test("a confirmed environment write arrives as its own method carrying the caller's exact bytes", async () => {
  for (const [command, method] of [["create", "POST"], ["update", "PATCH"]]) {
    const answer = await ran("app", "env", command, "a-in", "--key", "DATABASE_URL", "--value", SECRET, "--yes");
    assert.equal(answer.status, 0, answer.stderr);
    const sent = wroteTo(answer, method);
    assert.ok(sent, `${command} sent no ${method} to the env path`);
    assert.deepEqual(JSON.parse(sent.body), { key: "DATABASE_URL", value: SECRET });
  }
});

test("an environment write is refused without --yes, and names its own preview rather than the other's", async () => {
  for (const command of ["create", "update"]) {
    const answer = await ran("app", "env", command, "a-in", "--key", "NODE_ENV", "--value", "staging");
    assert.equal(answer.status, 1);
    assert.match(answer.stderr, new RegExp(`forge coolify app env ${command} --dry-run`, "u"));
    assert.deepEqual(paths(answer).filter((one) => one === "/applications/a-in/envs"), []);
  }
});

test("an environment write under --dry-run prints its call with the secret masked, and sends nothing", async () => {
  const answer = await ran("app", "env", "create", "a-in", "--key", "DATABASE_URL", "--value", SECRET, "--dry-run");
  assert.equal(answer.status, 0, answer.stderr);
  assert.match(answer.stdout, /^POST http:\/\/127\.0\.0\.1:\d+\/api\/v1\/applications\/a-in\/envs$/mu);
  assert.ok(!answer.stdout.includes("hunter2"), "the password reached stdout");
  assert.match(answer.stdout, /postgres:\/\/app:<redacted>@db\.internal:5432\/main/u);
  assert.deepEqual(paths(answer).filter((one) => one === "/applications/a-in/envs"), []);
});

test("--reveal prints the value a write would carry as it stands, and still not our own token", async () => {
  const answer = await ran("app", "env", "create", "a-in", "--key", "DATABASE_URL", "--value", SECRET, "--dry-run", "--reveal");
  assert.equal(answer.status, 0, answer.stderr);
  assert.ok(answer.stdout.includes(SECRET), "--reveal did not print the value as it stands");
  assert.ok(!answer.stdout.includes(TOKEN), "the token is on stdout");
  assert.ok(!answer.stderr.includes(TOKEN), "the token is on stderr");
});

test("a uuid outside the pin is refused before an environment write reaches its own path", async () => {
  const answer = await ran("app", "env", "create", "a-out", "--key", "NODE_ENV", "--value", "staging", "--yes");
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /a-out is outside the pinned project/u);
  assert.deepEqual(paths(answer).filter((one) => one === "/applications/a-out/envs"), []);
});

/* The other direction of the same rule. Everything above asks what leaves this machine; this asks
   what comes back, because the platform's own words are printed and a rejection quotes what it
   rejected. */
test("a write the platform refuses does not print the value back, and does under --reveal", async () => {
  const refused = await ran("app", "env", "create", "a-in", "--key", "DB_PASSWORD_REFUSED", "--value", "hunter2", "--yes");
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /HTTP 422/u);
  assert.match(refused.stderr, /Rejected value: <redacted>/u);
  assert.ok(!refused.stderr.includes("hunter2"), "the value reached stderr");
  assert.ok(!refused.stdout.includes("hunter2"), "the value reached stdout");

  const shown = await ran("app", "env", "create", "a-in", "--key", "DB_PASSWORD_REFUSED", "--value", "hunter2", "--yes", "--reveal");
  assert.equal(shown.status, 1);
  assert.match(shown.stderr, /Rejected value: hunter2/u);
  assert.ok(!shown.stderr.includes(TOKEN), "the token is on stderr");
});

/* A quote in a secret is what separates striking the parts from striking the finished line: the
   line re-escapes it, and a replacement made afterwards no longer matches what it is looking for. */
test("a value quoted inside a refusal's own details is struck however the line escapes it", async () => {
  const answer = await ran("app", "env", "create", "a-in", "--key", "DB_PASSWORD_ESCAPED", "--value", 'alpha"beta', "--yes");
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /HTTP 422/u);
  assert.ok(!answer.stderr.includes("alpha"), "the value reached stderr, escaped or not");
});

/* The answer is the third direction. A write the platform accepts can repeat what it was given, and
   the structural rule cannot see that: it hides a field by its name, and this one is `message`. */
test("a write the platform accepts does not print the value back, and does under --reveal", async () => {
  const quiet = await ran("app", "env", "create", "a-in", "--key", "DB_PASSWORD_ECHOED", "--value", "hunter2", "--yes", "--full");
  assert.equal(quiet.status, 0, quiet.stderr);
  assert.match(quiet.stdout, /set DB_PASSWORD_ECHOED to <redacted>/u);
  assert.ok(!quiet.stdout.includes("hunter2"), "the value reached stdout");

  const shown = await ran("app", "env", "create", "a-in", "--key", "DB_PASSWORD_ECHOED", "--value", "hunter2", "--yes", "--full", "--reveal");
  assert.equal(shown.status, 0, shown.stderr);
  assert.match(shown.stdout, /set DB_PASSWORD_ECHOED to hunter2/u);
  assert.ok(!shown.stdout.includes(TOKEN), "the token is on stdout");
});

/* A connection string is the case this whole surface was asked for, and it is the one where the
   value sent and the secret inside it are different strings: the preview keeps the host readable,
   so what the rule hid is the password alone, and that is what a platform names when it refuses. */
test("a refusal naming only the password inside a connection string is struck of that password", async () => {
  const answer = await ran("app", "env", "create", "a-in", "--key", "DATABASE_URL_PARTED", "--value", SECRET, "--yes");
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /Rejected password: <redacted>/u);
  assert.ok(!answer.stderr.includes("hunter2"), "the password reached stderr");
  assert.deepEqual(JSON.parse(wroteTo(answer, "POST").body), { key: "DATABASE_URL_PARTED", value: SECRET });

  const shown = await ran("app", "env", "create", "a-in", "--key", "DATABASE_URL_PARTED", "--value", SECRET, "--yes", "--reveal");
  assert.match(shown.stderr, /Rejected password: hunter2/u);
});

/* The same value with its scheme in capitals. A parser hands back a normalized copy — the scheme
   lowercased, a default port dropped — so anything that worked out what was hidden by reading the
   masked copy against the plain one would find nothing here and say nothing about it. */
test("a connection string whose scheme is capitalised is struck of its password all the same", async () => {
  const shouted = SECRET.replace("postgres://", "POSTGRES://");
  const answer = await ran("app", "env", "create", "a-in", "--key", "DATABASE_URL_PARTED", "--value", shouted, "--yes");
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /Rejected password: <redacted>/u);
  assert.ok(!answer.stderr.includes("hunter2"), "the password reached stderr");
  assert.deepEqual(JSON.parse(wroteTo(answer, "POST").body), { key: "DATABASE_URL_PARTED", value: shouted });
});

/* A connection string can carry a password with no user beside it. The masking drops that pair from
   the line with no name to hang a mask on, so nothing about the line says a credential was there —
   which is exactly the reading a rule that reports off the user alone would make. */
test("a connection string carrying a password and no user is struck of that password", async () => {
  const only = "redis://:hunter2@redis.internal:6379/0";
  const answer = await ran("app", "env", "create", "a-in", "--key", "REDIS_URL_PARTED", "--value", only, "--yes");
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /Rejected password: <redacted>/u);
  assert.ok(!answer.stderr.includes("hunter2"), "the password reached stderr");
  assert.deepEqual(JSON.parse(wroteTo(answer, "POST").body), { key: "REDIS_URL_PARTED", value: only });
});
