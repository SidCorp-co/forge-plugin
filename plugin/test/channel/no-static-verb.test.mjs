/* A skill sentence naming a verb outlives the verb, and a run holding a rule with no verb satisfies
   it with the nearest verb that works. So the destination is rendered by the CLI off the project's
   key, and no text shipped into a session names it: docs/cli/withholding-a-verb.md is the rule. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const TREES = ["plugin/skills", "plugin/guides"];
const VERB = /forge feedback/gu;

const walk = (dir, at) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((one) =>
    (one.isDirectory()
      ? walk(join(dir, one.name), `${at}/${one.name}`)
      : [{ rel: `${at}/${one.name}`, text: readFileSync(join(dir, one.name), "utf8") }]));

const named = (files) => files.flatMap(({ rel, text }) =>
  text.split("\n").flatMap((line, at) => ([...line.matchAll(VERB)].length ? [`${rel}:${at + 1}`] : [])));

const shipped = TREES.flatMap((tree) => walk(join(ROOT, tree), tree));

test("no text this plugin ships into a session names the destination verb", () => {
  assert.ok(shipped.length > 20, `the walk reached ${shipped.length} files, which is not these trees`);
  assert.deepEqual(named(shipped), [], "the CLI renders the destination off the project's key");
});

test("and the walk that says so would catch one", () => {
  const planted = [{ rel: "plugin/guides/v1/made-up.md", text: "one line\nfile it with `forge feedback`\n" }];
  assert.deepEqual(named(planted), ["plugin/guides/v1/made-up.md:2"], "the selector matches nothing otherwise");
});
