/* The served surface against the carried indexes, walked whole: every method of the six served
   documents resolves from the words a caller types, every prefix of one is a level that lists the next
   word, the two carried and unserved services are refused by name, and the methods the saved scopes
   cannot reach are the ones named here, so a scope that stops covering a method is a change somebody
   sees. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

import { tempRoom } from "../../../../fixtures.mjs";
import { SCOPES, SERVED_SERVICES, carriedIndex } from "../../../../../src/tools/services/google/surface.mjs";
import { levelText, resolveTyped } from "../../../../../src/tools/services/google/tree.mjs";

const SURFACE = new URL("../../../../../src/tools/services/google/surface.mjs", import.meta.url).href;
const FORGE = new URL("../../../../../bin/forge", import.meta.url).pathname;

const idsOf = (service) => Object.keys(carriedIndex(service).methods);

test("the served services are the six the issue names, each carrying the methods it counted", () => {
  assert.deepEqual(SERVED_SERVICES, ["drive", "sheets", "docs", "gmail", "calendar", "meet"]);
  assert.deepEqual(SERVED_SERVICES.map((one) => idsOf(one).length), [64, 17, 3, 79, 38, 24]);
});

for (const service of SERVED_SERVICES) {
  test(`every ${service} method resolves from its own words to its own id`, () => {
    for (const id of idsOf(service)) {
      const found = resolveTyped([...id.split("."), "--dry-run"]);
      assert.equal(found.id, id);
      assert.deepEqual(found.rest, ["--dry-run"], id);
    }
  });

  test(`every prefix of a ${service} method id is a level whose listing names the next word`, () => {
    for (const id of idsOf(service)) {
      const words = id.split(".");
      for (let length = 1; length < words.length; length += 1) {
        const found = resolveTyped(words.slice(0, length));
        assert.equal(found.level?.id, words.slice(0, length).join("."), id);
        const listed = levelText(found.level);
        const next = words[length];
        const named = length === words.length - 1 ? new RegExp(`^ {2}${next} `, "mu") : new RegExp(`^Resources: .*\\b${next}\\b`, "mu");
        assert.match(listed, named, `${words.slice(0, length).join(".")} lists ${next}`);
      }
    }
  });
}

const typed = (...argv) => spawnSync(FORGE, ["google", ...argv], { encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: tempRoom("google-surface-"), FORGE_GOOGLE_ACCESS_TOKEN: "" } });

test("a chat or admin method is refused with 4, naming its service as carried and not served", () => {
  for (const [service, ...words] of [["chat", "spaces", "list"], ["admin", "users", "list"]]) {
    const answer = typed(service, ...words);
    assert.equal(answer.status, 4, answer.stderr);
    assert.ok(answer.stderr.includes(`${service} is carried and not served`), answer.stderr);
  }
});

/* Gmail's settings writes and its permanent deletes ask a scope past `gmail.modify`, and Drive's app list one
   past `drive`: each answers 403 and the scope hint rather than being refused here. */
const PAST_THE_SCOPE = (id, entry) => (id.startsWith("gmail.users.settings.") && entry.http !== "GET")
  || ["gmail.users.messages.batchDelete", "gmail.users.messages.delete", "gmail.users.threads.delete", "drive.apps.list"].includes(id);

test("a service account's scope covers every served method but the few named as past it", () => {
  for (const service of SERVED_SERVICES) {
    for (const id of idsOf(service)) {
      const entry = carriedIndex(service).methods[id];
      const covered = SCOPES[service].full.some((one) => (entry.scopes ?? []).includes(one));
      assert.equal(covered, !PAST_THE_SCOPE(id, entry), `${id} accepts ${entry.scopes?.join(" ")}`);
    }
  }
});

test("a method a helper calls that the carried index no longer holds is refused by name with 4", () => {
  const script = `import { methodById } from ${JSON.stringify(SURFACE)};
methodById("drive.files.vanished");`;
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" });
  assert.equal(run.status, 4, run.stderr);
  assert.match(run.stderr, /`drive\.files\.vanished` is called by a helper, and the carried drive document no longer holds it/u);
});
