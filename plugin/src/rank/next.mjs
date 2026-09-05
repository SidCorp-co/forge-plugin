/* `forge next` — the open issues this project should work next, ranked and written nowhere. The
   call budget, and why the score is computed on the browse projection: docs/cli/next.md. */
import { bandSpread, weightLines, weightsFrom } from "./weights.mjs";
import { bandsOf, costFor, isWarm, lastLanded, measuredRuns, owesRestart, rootFor } from "./cost.mjs";
import { chainOf, openKeys, ordered, scoreOf } from "./score.mjs";
import { everyIssue, keysIn, shortOf } from "../tracker/issues.mjs";
import { flags, partition, pullRepeated, wantsHelp } from "../resolve/flags.mjs";
import { isFix, placeIn, seedFor } from "../tracker/issue-shape.mjs";
import { batchesOf } from "./batch.mjs";
import { candidateLines, droppedLine, HEAD } from "./print.mjs";
import { carriersOf, graphOf } from "../tools/deps.mjs";
import { eligibilityOf, heldPaths, pathsNamed } from "./eligible.mjs";
import { fail } from "../resolve/settings.mjs";
import { neighboursOf } from "../tracker/neighbours.mjs";
import { scoped } from "../tracker/rpc.mjs";
import { unknownFlag } from "../suggest.mjs";
import { usageOf } from "../resolve/visibility.mjs";

const DEFAULT_COUNT = 5;
const BOOLEAN = ["--json", "--why"];

export const usageLines = (weights) => [
  usageOf("next"),
  "The open issues this project should work next, ranked off what the tracker already holds, and",
  "nothing written. Eligibility first, then the score, then the batches that ride together.",
  "",
  "  --count n        how many candidates print; 5 unless you say otherwise",
  "  --why            the breakdown per issue, one line of weights and one of signals",
  "  --json           the whole table, for whatever dispatches on it",
  "  --holding ISS-nn an issue a run already holds; a candidate naming a file its plan names is set",
  "                   aside, and the line says which file and which issue",
  "  --project dir    the checkout whose past runs the cost column is read off; the working",
  "                   directory unless you say otherwise",
  "",
  ...weightLines(weights),
  "",
  "The rank is advice. Whoever dispatches reads the breakdown and may take a lower-ranked issue for",
  "a reason the metadata cannot carry; that choice, and the rank it overrode, belong on the record.",
];

const countFrom = (raw) => {
  if (raw === undefined) return DEFAULT_COUNT;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) fail(`next: --count takes a whole number of issues, not \`${raw}\`.`);
  return value;
};

/* Every prose edge, resolved to keys, in both directions: one reading of blocked-by, deps.mjs's. */
const edgesFrom = (carried, universe) => {
  const blocks = new Map();
  const blockedBy = new Map();
  const add = (map, from, to) => map.set(from, [...(map.get(from) ?? []), to]);
  for (const claim of graphOf(carried.issues, universe).claims) {
    add(blocks, claim.from, claim.to);
    add(blockedBy, claim.to, claim.from);
  }
  return { blocks, blockedBy };
};

const withRelations = (blocks, blockedBy, body) => {
  for (const other of body?.relations?.blockedBy ?? []) {
    const [key] = keysIn(other?.issueId ?? other);
    if (!key) continue;
    blockedBy.set(body.issueId, [...(blockedBy.get(body.issueId) ?? []), key]);
    blocks.set(key, [...(blocks.get(key) ?? []), body.issueId]);
  }
};

/* The window read whole: wide enough that the one weight a body decides cannot promote a row from
   outside it, and never wider than the table's own cap. */
const windowOf = (ranked, count, weights) => {
  const floor = (ranked[count - 1]?.score.total ?? 0) - bandSpread(weights);
  const within = ranked.filter((one) => one.score.total >= floor).length;
  return ranked.slice(0, Math.min(weights.windowCap, Math.max(count * 3, within)));
};

const bodiesFor = async (window) =>
  new Map(await Promise.all(window.map(async (one) => [
    one.issueId,
    await scoped("forge_issues", { action: "get", documentId: one.row.documentId }),
  ])));

const heldFrom = async (keys, rows) => {
  const plans = await Promise.all(keys.map(async (key) => {
    const row = rows.find((one) => String(one.issueId).toUpperCase() === key.toUpperCase());
    if (!row) fail(`next: --holding names ${key}, which is not on this project's tracker.`);
    const held = await scoped("forge_issues", { action: "get", documentId: row.documentId, fields: ["plan"] });
    return { issueId: row.issueId, plan: held?.plan ?? "" };
  }));
  return heldPaths(plans);
};

/* The chain a landing frees, each path rendered from the head to where it ends. */
const chainsUnder = (key, blocks, open, seen = new Set()) => {
  const out = [];
  for (const one of blocks.get(key) ?? []) {
    if (seen.has(one) || !open.has(one)) continue;
    const deeper = chainsUnder(one, blocks, open, new Set([...seen, one]));
    out.push(...(deeper.length ? deeper.map((path) => [one, ...path]) : [[one]]));
  }
  return out;
};

const nearFor = async (head, bodies, live, weights) => {
  const body = bodies.get(head.issueId);
  const filing = { title: head.row.title, body: body?.description ?? "", kind: head.row.category ?? null };
  const beside = await neighboursOf(
    { seed: seedFor(filing), place: placeIn(filing.body) },
    live,
  );
  return new Map(beside.suggestions
    .filter((one) => one.score !== null && one.score >= weights.similarity && one.issueId !== head.issueId)
    .map((one) => [one.issueId, one.score]));
};

const jsonOf = (batches, dropped, weights, from) => ({
  weights,
  weightsFrom: from,
  candidates: batches.map((batch) => ({
    issueId: batch.head.issueId,
    title: batch.head.row.title,
    score: batch.head.score.total,
    parts: Object.fromEntries(batch.head.score.parts.map(([name, said, points]) => [name, { said, points }])),
    band: batch.head.score.band,
    bandFrom: batch.head.score.bandFrom,
    priority: batch.head.row.priority ?? null,
    kind: batch.head.row.category ?? null,
    cost: batch.head.cost,
    restart: batch.head.restart,
    warm: batch.head.warm,
    unblocks: batch.chains,
    batch: batch.members.map((one) => ({ issueId: one.issueId, how: one.how, why: one.said })),
    related: batch.aside.map((one) => ({ issueId: one.issueId, how: one.how, why: one.said })),
  })),
  dropped: dropped.map((one) => ({ issueId: one.issueId, soft: one.soft, reason: one.reason })),
});

/* One walk, one prose-edge read, one body per candidate in the window, two searches per head. */
export const next = async (argv) => {
  const { value: weights, from, refusal } = weightsFrom();
  if (refusal) fail(`next: ${refusal}`);
  if (wantsHelp(argv)) return console.log(usageLines(weights).join("\n"));
  const { values: holding, rest } = pullRepeated(argv, "--holding", "next");
  const { positionals, flagArgv } = partition(rest, BOOLEAN);
  if (positionals.length) fail(`next: \`${positionals[0]}\` names no flag, and this verb takes no argument of its own.`);
  const wrong = unknownFlag("next", flagArgv, { usage: usageOf("next"), hidden: ["--holding"] });
  if (wrong) fail(wrong);
  const asked = flags(flagArgv, "next", BOOLEAN);
  const count = countFrom(asked.count);
  const [read, carried] = await Promise.all([everyIssue(), carriersOf()]);
  const said = shortOf(read, "The set this rank is computed over");
  if (said) console.error(`warning: ${said}\nSo an issue outside it is neither ranked nor named as dropped.`);
  const rows = read.rows;
  const { blocks, blockedBy } = edgesFrom(carried, rows);

  const open = openKeys(rows);
  const statusOf = new Map(rows.map((one) => [one.issueId, String(one.status ?? "")]));
  const takeable = rows.filter((one) => open.has(one.issueId));
  const preScored = ordered(takeable.map((row) => ({
    issueId: row.issueId,
    row,
    score: scoreOf(row, { weights, chain: chainOf(row.issueId, blocks, open) }),
  })));
  const window = windowOf(preScored, count, weights);
  const [bodies, held] = await Promise.all([
    bodiesFor(window),
    heldFrom(holding.flatMap((one) => keysIn(one)), rows),
  ]);
  for (const one of window) withRelations(blocks, blockedBy, { ...bodies.get(one.issueId), issueId: one.issueId });
  const runs = measuredRuns(rootFor(asked.project ?? process.cwd()));
  const bands = bandsOf(rows);
  const landed = lastLanded(rows);
  const warmPaths = landed ? pathsNamed((await scoped("forge_issues", {
    action: "get", documentId: landed.documentId, fields: ["description"] }))?.description ?? "") : [];
  const judged = window.map((one) => {
    const body = bodies.get(one.issueId);
    const text = body?.description ?? "";
    const score = scoreOf(one.row, {
      weights,
      chain: chainOf(one.issueId, blocks, open),
      fix: isFix(text),
    });
    const blockers = (blockedBy.get(one.issueId) ?? [])
      .map((key) => ({ issueId: key, status: statusOf.get(key) ?? "unknown" }));
    const verdict = eligibilityOf(one.row, { blockers, lease: body?.sessionContext, body: text, held });
    const warm = isWarm(text, warmPaths) ? (pathsNamed(text)[0] ?? "the tree") : null;
    return {
      ...one,
      score,
      body: text,
      relates: (body?.relations?.relates ?? []).flatMap((other) => keysIn(other?.issueId ?? other)),
      cost: costFor(score.band, runs, bands),
      restart: owesRestart(text),
      warm,
      ...verdict,
    };
  });
  const eligible = ordered(judged.filter((one) => one.eligible));
  const dropped = judged.filter((one) => !one.eligible);
  const live = eligible.map((one) => ({ documentId: one.row.documentId, issueId: one.issueId, title: one.row.title }));
  const paths = new Map(judged.map((one) => [one.issueId, pathsNamed(one.body)]));
  const heads = eligible.slice(0, count);
  const near = new Map(await Promise.all(heads.map(async (head) => [head.issueId, await nearFor(head, bodies, live, weights)])));
  const batched = batchesOf(eligible, {
    relates: new Map(judged.map((one) => [one.issueId, one.relates])),
    near,
    paths,
  }, weights).slice(0, count);
  /* An aside a reader will meet as a head of its own is the same issue printed twice. */
  const shown = new Set(batched.map((batch) => batch.head.issueId));
  const batches = batched.map((batch) => ({
    ...batch,
    aside: batch.aside.filter((one) => !shown.has(one.issueId)),
    chains: chainsUnder(batch.head.issueId, blocks, open),
  }));
  if (asked.json) return console.log(JSON.stringify(jsonOf(batches, dropped, weights, from), null, 2));
  if (!batches.length) {
    console.log(`Nothing is eligible: ${takeable.length} issue(s) could be taken and every one was dropped.`);
  } else {
    console.log(HEAD);
    for (const batch of batches) for (const line of candidateLines(batch, { why: Boolean(asked.why) })) console.log(line);
  }
  if (dropped.length) {
    console.log(`\nleft out — ${dropped.length} of the ${window.length} candidate(s) read whole:`);
    for (const one of dropped) console.log(droppedLine(one));
  }
  return console.log(`\n${eligible.length} eligible of ${takeable.length} takeable, ${rows.length} on the`
    + ` backlog. Weights from ${from}; nothing was written.`);
};

next.answersHelp = true;
