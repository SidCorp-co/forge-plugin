/* Every verb that parses a window refuses an unreadable one naming the verb and the flag the caller
   typed, one case per pair so a new caller sharing a parser cannot inherit another flag's name.
   `stats models` takes both flags and is the pair proving the verb and the flag travel apart. The
   corpus holds runs, so no verb returns on an empty window before it reads its flags. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { durationOf } from "../../../src/stats/window/duration.mjs";
import { FORGE, PROJECT, corpusOf } from "../fixture-eval.mjs";
import { tempRoom } from "../../fixtures.mjs";

const room = corpusOf(4);

const refusalOf = (argv) => spawnSync(FORGE, [...argv, "--checkout", PROJECT], {
  encoding: "utf8",
  env: { ...process.env, XDG_CONFIG_HOME: tempRoom("window-refusals-home-"), TMPDIR: room,
    HOME: tempRoom("window-refusals-user-") },
});

const PAIRS = [
  { argv: ["stats", "diagnose"], flag: "--since", said: "stats diagnose" },
  { argv: ["stats", "eval"], flag: "--horizon", said: "stats eval" },
  { argv: ["stats", "models"], flag: "--horizon", said: "stats models" },
  { argv: ["stats", "models"], flag: "--since", said: "stats models" },
  { argv: ["stats", "runs"], flag: "--since", said: "stats runs" },
  { argv: ["stats", "waves"], flag: "--since", said: "stats waves" },
  { argv: ["stats", "surface"], flag: "--since", said: "stats surface" },
  { argv: ["codex", "complexity", "--measure"], flag: "--since", said: "forge codex complexity" },
];

/* One case over every pair, so the requirement it proves names one case; the deep comparison
   prints every pair that went wrong rather than stopping at the first. */
test("every verb that parses a window refuses an unreadable one naming the flag the caller typed", () => {
  const said = PAIRS.map(({ argv, flag }) => {
    const refused = refusalOf([...argv, flag, "zzz"]);
    return `${refused.status} ${refused.stderr.trim()}`;
  });
  assert.deepEqual(said, PAIRS.map(({ flag, said: verb }) =>
    `1 ${verb}: ${flag} takes a window like \`3d\`, \`12h\` or \`90m\`, not \`zzz\`.`));
});

test("the shared duration reader will not run without the flag its refusal has to name", () => {
  assert.throws(() => durationOf("3d", "stats eval"), /the verb and the flag/u);
  assert.throws(() => durationOf("3d", undefined, "--since"), /the verb and the flag/u);
  assert.equal(durationOf("3d", "stats eval", "--horizon"), 3 * 86_400_000);
});
