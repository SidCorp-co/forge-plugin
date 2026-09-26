/* The reading `finish` takes of a run's scratch before it removes anything: which files hold a copy of
   one of this machine's credentials (ISS-2612). The end-to-end refusal is `finish.test.mjs`'s. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../../../../plugin/test/fixtures.mjs";
import { copiesIn, machineSecrets } from "../../../run/workspace/credential-copies.mjs";

/* This process's own home, set before the first read, holding the machine's values the secrets are
   taken from. */
const HOME = tempRoom("copies-home-");
mkdirSync(join(HOME, "forge"));
writeFileSync(join(HOME, "forge", "config.json"), JSON.stringify({
  url: "https://tracker.example/mcp", token: "a-machine-token-0123456789",
  cloudflare: { accounts: [{ name: "main", accountId: "a-public-account-id-0123456789", apiToken: "a-cloudflare-token-0123456789" }] },
}));
process.env.XDG_CONFIG_HOME = HOME;
process.env.CLAUDE_PROXY_ENV = join(HOME, "no-profile.env");

const SECRET = "a-machine-token-0123456789";

test("every file under the scratch holding a secret is named, however deep, and no other", () => {
  const scratch = tempRoom("copies-");
  mkdirSync(join(scratch, "xdg", "forge"), { recursive: true });
  const config = join(scratch, "xdg", "forge", "config.json");
  writeFileSync(config, JSON.stringify({ token: SECRET }));
  const log = join(scratch, "probe.log");
  writeFileSync(log, `sent with ${SECRET} in a header\n`);
  writeFileSync(join(scratch, "clean.log"), "nothing of the machine's\n");
  assert.deepEqual(copiesIn(scratch, [SECRET]).sort(), [config, log].sort());
});

test("a link is not followed, the file it names being somewhere else's", () => {
  const scratch = tempRoom("copies-link-");
  const elsewhere = join(tempRoom("copies-elsewhere-"), "config.json");
  writeFileSync(elsewhere, JSON.stringify({ token: SECRET }));
  symlinkSync(elsewhere, join(scratch, "linked.json"));
  assert.deepEqual(copiesIn(scratch, [SECRET]), []);
});

test("a scratch that is gone, or a machine holding no secret, names nothing", () => {
  assert.deepEqual(copiesIn(join(tempRoom("copies-gone-"), "absent"), [SECRET]), []);
  const scratch = tempRoom("copies-none-");
  writeFileSync(join(scratch, "any.log"), "anything\n");
  assert.deepEqual(copiesIn(scratch, []), []);
});

test("the secrets are the credentials themselves, not an endpoint or an account id printed beside them", () => {
  const held = machineSecrets();
  assert.ok(held.includes("a-machine-token-0123456789"), held.join(", "));
  assert.ok(held.includes("a-cloudflare-token-0123456789"), held.join(", "));
  assert.ok(!held.includes("a-public-account-id-0123456789"), "an account id is not a credential");
  assert.ok(!held.includes("https://tracker.example/mcp"), "an endpoint is not a credential");
  const scratch = tempRoom("copies-id-");
  writeFileSync(join(scratch, "report.txt"), "account a-public-account-id-0123456789 answered\n");
  assert.deepEqual(copiesIn(scratch, held), [], "a report naming the account is not a copy of its token");
});
