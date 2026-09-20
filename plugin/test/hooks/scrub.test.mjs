import assert from "node:assert/strict";
import test from "node:test";

import { scrubbed } from "../../src/hooks/log/scrub.mjs";

/* A Coolify token reached a session transcript through a redaction that missed one nesting level.
   These are the shapes that read as a credential without knowing the service. */
test("a credential is masked before it is written down", () => {
  assert.equal(scrubbed("coolify login --token 7|abc123def456"), "coolify login --token ***");
  assert.equal(scrubbed("forge x --api-key sk-live-1 y"), "forge x --api-key *** y");
  assert.match(scrubbed('curl -H "Authorization: Bearer abcdefghij"'), /Authorization: \*\*\*/u);
  const env = scrubbed("COOLIFY_TOKEN=7|abcdefghijklmnopqrstuvwxyz0123456789 forge x");
  assert.equal(env, "COOLIFY_TOKEN=*** forge x", "the name reads; only the value goes");
  assert.match(scrubbed("auth eyJhbGciOiJIUzI1NiJ9.eyJhIjoxfQ.sig"), /auth \*\*\*/u);
  assert.match(scrubbed("token ghp_abcdefghijklmnopqrstuv"), /token \*\*\*/u);
});

/* The four shapes above read as credentials by their value. These read as credentials by their
   name, and the log is not private: `forge hooks` prints it back into a session, so an unmasked
   secret here is one a later model request carries. */
test("a credential named as one is masked whatever its value looks like", () => {
  assert.equal(scrubbed("COOLIFY_TOKEN=9|Xk3mQp7 forge x"), "COOLIFY_TOKEN=*** forge x");
  assert.equal(scrubbed("export FORGE_SECRET=notarealone && forge x"), "export FORGE_SECRET=*** && forge x");
  assert.equal(scrubbed("PGPASSWORD=notarealone psql -h db"), "PGPASSWORD=*** psql -h db");
  assert.match(scrubbed("psql postgres://app:notarealone@db:5432/f"), /postgres:\/\/app:\*\*\*@db/u);
  assert.match(scrubbed('curl -d \'{"password":"notarealone"}\' https://db'), /"password":"\*\*\*"/u);
});

/* A name-based rule masks these too, so each case here carries no name a rule would read: without
   one, only the value's own shape stands between it and the log. The token rule was covered by a
   fixture the name rule now catches first, which is how a rule goes quietly untested. */
test("a value shaped like a credential is masked with nothing beside it to say so", () => {
  assert.match(scrubbed("forge x 7|abcdefghijklmnopqrstuvwxyz0123456789"), /forge x \*\*\*/u);
  assert.match(scrubbed("send Bearer abcdefghijklmnop"), /send Bearer \*\*\*/u);
});

/* Masking to the next space left most of a phrase behind, and what survives is printed back into a
   session. A quoted value goes whole. */
test("a quoted credential is masked past its spaces", () => {
  assert.equal(scrubbed("PASSWORD='not a real one' psql -h db"), "PASSWORD=*** psql -h db");
  assert.equal(scrubbed('forge x --token "not a real one" y'), "forge x --token *** y");
});

test("what is not a credential survives, and a long line is cut", () => {
  const query = "forge cloudflare dns f699ca3c1fae884abd0c47f2e5ff1622 --name cp.musetools.com";
  assert.equal(scrubbed(query), query, "a zone id and a hostname are what the log is read for");
  const long = scrubbed("x".repeat(400));
  assert.equal(long.length, 221, "220 kept plus the ellipsis");
  assert.ok(long.endsWith("…"));
});
