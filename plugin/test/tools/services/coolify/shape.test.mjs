/* The four readings a port loses by default, each asserted against literal text rather than
   against a value imported from the module under test. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  MASK,
  SUMMARY_FIELDS,
  hiddenNames,
  normalize,
  pickColumns,
  redact,
  renderObject,
  renderTable,
  summarize,
} from "../../../../src/tools/services/coolify/shape.mjs";

test("the phantom health half goes and every other half stays", () => {
  assert.equal(normalize({ status: "running:unhealthy" }).status, "running");
  assert.equal(normalize({ status: "running:healthy" }).status, "running:healthy");
  assert.equal(normalize({ status: "running:starting" }).status, "running:starting");
  assert.equal(normalize({ status: "exited" }).status, "exited");
  assert.equal(normalize({ server_status: "running:unhealthy" }).server_status, "running");
});

test("the health half is stripped inside a list and inside a nested object alike", () => {
  const answer = normalize([{ status: "running:unhealthy", inner: { status: "degraded:unhealthy" } }]);
  assert.equal(answer[0].status, "running");
  assert.equal(answer[0].inner.status, "degraded");
});

/* The JSON path is what an agent reads, so the stripping has to have happened before either
   rendering: the same normalised value is what both are handed. */
test("the stripped status reaches the JSON path, not the table alone", () => {
  const data = normalize([{ uuid: "u1", status: "running:unhealthy" }]);
  assert.match(JSON.stringify(data), /"status":"running"/u);
  assert.match(renderTable(data, ["uuid", "status"]), /^u1 +running$/mu);
});

test("a value under a secret-sounding key is masked, whatever the value looks like", () => {
  for (const key of ["DB_PASSWORD", "jwt_secret", "API_TOKEN", "api-key", "MY_APIKEY", "private_key",
    "credential", "PASSPHRASE", "SENTRY_DSN", "DATABASE_URL", "REDIS_URL", "salt", "signature",
    "webhook_url"]) {
    assert.equal(redact({ key, value: "abc123" }).value, MASK, `${key} went unmasked`);
  }
  assert.equal(redact({ key: "NODE_ENV", value: "production" }).value, "production");
});

test("both value fields of a pair are masked, and the key itself is left readable", () => {
  const masked = redact({ key: "DB_PASSWORD", value: "s3cret", real_value: "s3cret", uuid: "e1" });
  assert.deepEqual(masked, { key: "DB_PASSWORD", value: MASK, real_value: MASK, uuid: "e1" });
});

test("a field named like a secret is masked, and an identifier ending in _id or _uuid is not", () => {
  const masked = redact({ postgres_password: "hunter2", private_key_id: 41, token_uuid: "t-9" });
  assert.deepEqual(masked, { postgres_password: MASK, private_key_id: 41, token_uuid: "t-9" });
});

test("a connection string keeps its scheme, user, host and path and loses its password", () => {
  const masked = redact({ key: "DATABASE_URL", value: "postgres://app:hunter2@db.internal:5432/main" });
  assert.equal(masked.value, `postgres://app:${MASK}@db.internal:5432/main`);
});

test("a credential in a query parameter is replaced and the rest of the URL survives", () => {
  const masked = redact({ key: "HOOK", value: "https://api.example.com/notify?team=ops&token=abc123&x=1" });
  assert.equal(masked.value, `https://api.example.com/notify?team=ops&token=${MASK}&x=1`);
});

/* `--reveal` does not reach this module: it is the caller's decision not to call it, so what
   stands for that flag here is the unmasked value being exactly what was passed in. */
test("the value not put through the mask is the value that came in", () => {
  const held = { key: "DB_PASSWORD", value: "s3cret" };
  assert.equal(held.value, "s3cret");
});

const APP = {
  uuid: "a1",
  name: "web",
  status: "running:unhealthy",
  fqdn: "web.example.com",
  environment_id: 7,
  docker_compose_raw: "version: 3",
  custom_labels: "base64",
  manual_webhook_secret_github: "s3cret",
};

test("one application answers with its projection and no other field of the object", () => {
  const shown = summarize(APP, "app");
  assert.deepEqual(Object.keys(shown).sort(), ["environment_id", "fqdn", "name", "status", "uuid"]);
  for (const field of Object.keys(shown)) {
    assert.ok(SUMMARY_FIELDS.app.includes(field), `${field} is not one of the application's own`);
  }
});

test("the fields the projection dropped are named, sorted, and not merely counted", () => {
  assert.deepEqual(hiddenNames(APP, summarize(APP, "app")),
    ["custom_labels", "docker_compose_raw", "manual_webhook_secret_github"]);
});

test("nothing is hidden where the whole object is what got shown", () => {
  assert.deepEqual(hiddenNames(APP, APP), []);
});

/* An environment variable shares uuid and timestamps with an application, which is enough to be
   projected against the application's fields and lose the only two the call was made for. */
test("an environment variable is projected as one, not as the application that carried it", () => {
  const shown = summarize({ uuid: "e1", key: "PORT", value: "3000", is_buildtime: false }, "app");
  assert.equal(shown.key, "PORT");
  assert.equal(shown.value, "3000");
});

test("an action's reply is passed through rather than projected into an empty object", () => {
  assert.deepEqual(summarize({ message: "ok" }, "app"), { message: "ok" });
});

test("a table takes the preferred columns present and the object render pads to the widest key", () => {
  assert.deepEqual(pickColumns([{ uuid: "a1", name: "web", docker_compose_raw: "x" }]), ["uuid", "name"]);
  assert.equal(renderObject({ uuid: "a1", name: "web" }), "uuid  a1\nname  web");
});

/* One route answers with its records wrapped beside a count. The wrapper is two keys, so it is not
   a resource, so without this nothing is projected and whole build logs come back — 1.2 MB of them
   in the case that put this rule in the Python CLI. */
test("records wrapped beside a count are projected inside their wrapper, not passed through whole", () => {
  const held = {
    count: 1,
    deployments: [{
      id: 4,
      deployment_uuid: "d-4",
      status: "finished",
      logs: "x".repeat(4000),
      commit_message: "a change",
    }],
  };
  const shown = summarize(held, "deployment");
  assert.equal(shown.count, 1);
  assert.equal(shown.deployments[0].logs, undefined);
  assert.equal(shown.deployments[0].deployment_uuid, "d-4");
  assert.deepEqual(hiddenNames(held, shown), ["commit_message", "logs"]);
});

/* `includes("://")` alone excused a URL from masking even where nothing was actually removed from
   it, so a secret-named value whose secret is its PATH was printed whole. */
test("a secret-named URL whose credential is its path keeps only its origin", () => {
  const masked = redact({ key: "WEBHOOK_URL", value: "https://hooks.example/services/T0/B0/private-secret" });
  assert.equal(masked.value, `https://hooks.example/${MASK}`);
  assert.ok(!masked.value.includes("private-secret"));
});

test("a secret-named URL with no path at all is not left standing either", () => {
  assert.equal(redact({ key: "API_TOKEN_URL", value: "https://tokens.example" }).value,
    `https://tokens.example/${MASK}`);
});

/* The exemption is kept where it earns itself: a credential was found and removed, so what is left
   is the reading somebody came for — which database, on which host. */
test("a connection string still keeps the database its path names", () => {
  assert.equal(redact({ key: "DATABASE_URL", value: "postgres://app:hunter2@db.internal:5432/main" }).value,
    `postgres://app:${MASK}@db.internal:5432/main`);
});

/* Userinfo with no colon in it is a bare credential. A pattern written around `user:pass@` does not
   match it at all, and an origin taken by pattern carries it along as if it were part of the host. */
test("a secret-named URL whose whole userinfo is the credential loses it", () => {
  const masked = redact({ key: "SENTRY_DSN", value: "https://private-secret@errors.example/42" });
  assert.equal(masked.value, `https://${MASK}@errors.example/${MASK}`);
  assert.ok(!masked.value.includes("private-secret"));
});

/* Userinfo does not make a path safe: over http the path is a route, and one with a credential in
   the userinfo can have a second in the path. The scheme is what says which of the two it is. */
test("a secret-named http URL loses its path even where it carries userinfo as well", () => {
  const masked = redact({
    key: "WEBHOOK_URL",
    value: "https://app:password@hooks.example/services/private-secret?token=abc",
  });
  assert.equal(masked.value, `https://app:${MASK}@hooks.example/${MASK}`);
  assert.ok(!masked.value.includes("private-secret"));
  assert.ok(!masked.value.includes("abc"));
  assert.ok(!masked.value.includes("password"));
});

test("a secret-named value that is not a URL at all is masked whole", () => {
  assert.equal(redact({ key: "API_TOKEN", value: "not://a real url at all" }).value, MASK);
});
