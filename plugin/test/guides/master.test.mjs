/* The master's page is a map from a question to a command, so what it owes is that every command it
   routes to is one this copy serves and that it names no flag: a verb describes its own flags, and a
   flag copied here goes stale on the verb's clock rather than the page's (ISS-2592). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { flat, tempRoom } from "../fixtures.mjs";

const { DEFAULT, SCREEN, servedFor } = await import("../../src/guides/flow.mjs");
const { skillGuideAnswer, skillGuideSlugs } = await import("../../src/guides/skill-guides.mjs");
const { roundLines } = await import("../../src/guides/rounds.mjs");
const { VERB_NAMES } = await import("../../src/resolve/visibility.mjs");
const { localRows, localSlugs } = await import("../../src/guides/guides.mjs");
const { SAYS } = await import("../../src/stats/stats.mjs");
const { SUBJECT_SLUGS } = await import("../../src/tools/services/doctor/subjects.mjs");

const PLUGIN = new URL("../../", import.meta.url).pathname;
const FORGE = join(PLUGIN, "bin", "forge");
const HELP = "`forge <verb> -h`";

/* The subjects a verb takes as its second word, each read off the table that verb answers from. */
const SUBJECTS = {
  stats: () => Object.keys(SAYS),
  doctor: () => SUBJECT_SLUGS,
  guide: () => ["contract", ...skillGuideSlugs(PLUGIN)],
};

const cli = (...argv) => {
  const run = spawnSync(FORGE, argv, { encoding: "utf8", cwd: tempRoom("master-guide-") });
  assert.equal(run.status, 0, `\`forge ${argv.join(" ")}\` exited ${run.status}: ${run.stderr}`);
  return run.stdout;
};

/* What the page says, without the lines the verb appends to every page it serves. */
const pageOf = (served) => {
  const tail = new Set([...roundLines(null), ...servedFor(DEFAULT), ...servedFor(SCREEN)].filter(Boolean));
  return served.split("\n").filter((line) => !tail.has(line))
    .join("\n").trim();
};

const answered = (flow) => skillGuideAnswer("master", PLUGIN, flow)().lines.join("\n");

/** Every `forge …` span naming a command this copy does not serve, down to the subject where the verb takes one. */
export const unservedRoutes = (text) => [...text.matchAll(/`forge ([^`]+)`/gu)]
  .map(([span, inside]) => ({ span, words: inside.trim().split(/\s+/u) }))
  .filter(({ span }) => span !== HELP)
  .filter(({ words: [verb, subject] }) => !VERB_NAMES.includes(verb)
    || (subject !== undefined && SUBJECTS[verb] !== undefined && !SUBJECTS[verb]().includes(subject)))
  .map(({ span }) => span);

/** Every flag the text carries, the one help sentence aside. */
export const flagsIn = (text) =>
  [...text.replaceAll(HELP, "").matchAll(/(?:^|[\s`(])(--?[A-Za-z][\w-]*)/gu)].map((one) => one[1]);

const ROUTES = [
  ["What this wave should take", "forge next"],
  ["What is finished and nobody is judging", "forge next"],
  ["Why a candidate was left out", "forge next"],
  ["What blocks what", "forge next"],
  ["Whether an issue is already open twice", "forge alike"],
  ["What a dispatched run is owed that it has no way to look up", "forge brief"],
  ["Where a wave stands, asked of its headline", "forge resume"],
  ["How its waves went", "forge stats waves"],
  ["Where its time and spend went", "forge stats daily"],
  ["Why one run went wrong", "forge stats diagnose"],
  ["What resolves on this box", "forge doctor"],
  ["What the board holds at each status", "forge doctor project"],
  ["What the method says", "forge guide dispatch"],
  ["Whether this box is refusing work", "forge-runner status"],
];

const bulletsOf = (page) => page.split(/\n(?=- )/u).filter((one) => one.startsWith("- ")).map(flat);

test("criterion 1: forge guide master is served under both flows, each ending on the flow it was rendered for", () => {
  const served = cli("guide", "master");
  assert.match(served, /^# Master: /u, "the default flow serves the page");
  assert.equal(served.trim().split("\n").at(-1), servedFor(DEFAULT)[0]);
  assert.equal(answered(SCREEN).split("\n").at(-1), servedFor(SCREEN)[0]);
  assert.equal(pageOf(answered(SCREEN)), pageOf(answered(DEFAULT)), "the map does not move with the flow");
});

test("criteria 2 to 9: each question is routed to the command that answers it", () => {
  const bullets = bulletsOf(pageOf(cli("guide", "master")));
  for (const [question, command] of ROUTES) {
    const bullet = bullets.find((one) => one.startsWith(`- ${question}`));
    assert.ok(bullet, `no line of the page asks: ${question}`);
    assert.equal(/`([^`]+)`/u.exec(bullet)?.[1], command, `${question} is routed elsewhere: ${bullet}`);
  }
  const filing = bullets.find((one) => one.startsWith("- How to file against this CLI"));
  assert.match(filing ?? "", /the closing line of this CLI's own help/u,
    "criterion 8: filing is routed to the line the CLI renders off the project's key, never to a verb named here");
  const runner = bullets.find((one) => one.includes("`forge-runner status`"));
  assert.match(runner, /the runner's own\s+verb, which ships with the runner and not with this CLI/u,
    "criterion 9: the runner's verb is named as the runner's");
});

test("criteria 10, 11 and 16: the page carries no flag but the one sentence naming where flags are read", () => {
  const page = pageOf(cli("guide", "master"));
  assert.ok(page.includes(`it: ${HELP}`), "criterion 11: the page does not say where a verb's flags are read");
  assert.deepEqual(flagsIn(page), [], "criterion 10");
  assert.deepEqual(flagsIn(`See ${HELP}, and \`forge next --why\` and a bare --checkout and -x.`),
    ["--why", "--checkout", "-x"], "criterion 16: a flag in a span, in prose and a short one are each caught");
  assert.deepEqual(flagsIn("A day-by-day read and a list:\n- one item"), [], "a hyphenated word and a bullet are no flag");
});

test("criterion 12: the caveat on forge stats waves is said", () => {
  const page = flat(pageOf(cli("guide", "master")));
  assert.match(page, /`forge stats waves` counts by checkout, not by master/u);
  assert.match(page, /any of them that wrote a wave or fold record is read as a dispatcher/u,
    "the sessions whose waves are counted are the ones that wrote a wave or fold record");
  assert.match(page, /The count of sessions it opens with is every session it opened/u,
    "and the count the header prints is every session opened, not the dispatchers");
});

/* The bare verb reads the tracker's own pages beside these, so the half this copy answers is read directly. */
test("criterion 13: the bare listing offers the master page", () => {
  assert.ok(localSlugs().includes("master"), "the listing leaves the page out");
  assert.ok(localRows().some((row) => row.startsWith("master\n  ")), "and prints no row for it");
});

test("criterion 15: every command the page routes to is served, down to the subject", () => {
  assert.deepEqual(unservedRoutes(pageOf(cli("guide", "master"))), []);
  const planted = "`forge nosuch` `forge stats nonexistent` `forge doctor nonexistent` `forge guide nonexistent`"
    + " `forge stats waves` `forge guide dispatch` `forge doctor project` `forge resume` " + HELP;
  assert.deepEqual(unservedRoutes(planted),
    ["`forge nosuch`", "`forge stats nonexistent`", "`forge doctor nonexistent`", "`forge guide nonexistent`"]);
});
