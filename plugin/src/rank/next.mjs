/* `forge next` — the open issues this project should work next, ranked and written nowhere. The
   call budget, and why the score is computed on the browse projection: docs/cli/next.md. */
import { bandSpread, weightLines, weightsFrom } from "./weights.mjs";
import { bandsOf, costFor, isWarm, lastLanded, measuredRuns, owesRestart } from "./cost.mjs";
import { chainOf, holdingKeys, ordered, scoreOf, takeableKeys } from "./score.mjs";
import { everyIssue, keysIn, shortOf } from "../tracker/issues.mjs";
import { flags, partition, pullRepeated, wantsHelp } from "../resolve/flags.mjs";
import { asksOf } from "../tracker/issue-shape.mjs";
import { rootFor } from "../stats/transcripts.mjs";
import { markedIn } from "../ladder.mjs";
import { servesIn } from "../goals.mjs";
import { batchesOf } from "./batch.mjs";
import { candidateLines, droppedLine, graphLines, HEAD } from "./print.mjs";
import { carriersOf, graphOf, PROSE_FROM, PROSE_MARKER } from "./prose-edges.mjs";
import { eligibilityOf, heldPaths, pathsNamed } from "./eligible.mjs";
import { fail } from "../resolve/settings.mjs";
import { RELATES, otherOf } from "../tracker/rest.mjs";
import { holdsBack, holdsBackFrom, ordersSaid } from "../flow/earned.mjs";
import { neighboursOf } from "../tracker/filing/neighbours.mjs";
import { scoped } from "../tracker/rpc.mjs";
import { usageOf } from "../resolve/visibility.mjs";

const DEFAULT_COUNT = 5;
const BOOLEAN = ["--json", "--why", "--graph"];

/* Every edge on one issue, kind and all, told apart by whether it still orders: a graph printing
   only what holds back would answer a narrower question than the one the flag asks. One edge is
   read from both its ends, and each end's row carries the status of the other, so the blocker's
   status is named from whichever row is in hand — the two readings agree or the same edge orders on
   one line and not on the other. */
const edgesOn = (key, body, status) =>
  Object.entries(body?.relations ?? {}).flatMap(([which, held]) => (held ?? []).map((edge) => {
    const upstream = which === "blockedBy";
    const blocker = upstream ? edge.otherStatus : status;
    const orders = holdsBackFrom(edge, blocker);
    return {
      edgeId: edge.edgeId ?? null,
      from: upstream ? otherOf(edge) : key,
      to: upstream ? key : otherOf(edge),
      kind: edge.kind ?? "unnamed",
      orders,
      said: orders ? null : ordersSaid(edge, blocker),
    };
  }));

const takeableRows = (rows) => {
  const open = takeableKeys(rows);
  return rows.filter((one) => open.has(one.issueId));
};

/* One edge read from both its ends is one edge, and the tracker's own id is what says so. Where it
   named none, the kind decides: `relates` is the one kind with no direction of its own, arriving in
   one list from either end, so its pair is sorted rather than counted twice. A directed pair keeps
   the ends as read — whether it orders anything today is the blockers' status and not the edge. */
const edgeKey = (edge) => edge.edgeId
  ?? `${(edge.kind === RELATES ? [edge.from, edge.to].sort() : [edge.from, edge.to]).join(" ")} ${edge.kind}`;

/* One reading, the takeable set first and bounded by the same cap the ranking reads under, and in
   the same passes: every body at once is the shape that answered 503 after three backoffs, which
   docs/cli/next.md records. */
const graphRead = async (focus, rows, weights) => {
  const window = focus
    ? rows.filter((one) => String(one.issueId).toUpperCase() === focus)
    : takeableRows(rows).slice(0, weights.readCap);
  if (focus && !window.length) {
    fail(`next: --graph names ${focus}, which is not on this project's tracker.`);
  }
  const status = new Map(window.map((row) => [row.issueId, row.status]));
  const seen = new Set();
  const edges = [];
  for (let at = 0; at < window.length; at += weights.windowCap) {
    const take = window.slice(at, at + weights.windowCap).map((row) => ({ issueId: row.issueId, row }));
    for (const [key, body] of await bodiesFor(take)) {
      for (const edge of edgesOn(key, body, status.get(key))) {
        const held = edgeKey(edge);
        if (seen.has(held)) continue;
        seen.add(held);
        edges.push(edge);
      }
    }
  }
  return { edges, read: window.length };
};

const usageLines = (weights) => [
  usageOf("next"),
  "The open issues this project should work next, ranked off what the tracker already holds, and",
  "nothing written. The rank is advice: docs/cli/next.md.",
  "",
  "  --count n        how many candidates print; 5 unless you say otherwise",
  "  --why            the breakdown per issue: weights, signals, and the goal its body serves",
  "  --json           the whole table, for whatever dispatches on it",
  "  --graph [ISS-nn] the edges this ranking reads instead of the ranking: every edge the tracker",
  "                   holds on the issues read here, and under a heading of its own the claims only",
  "                   a body makes, which gate nothing. One issue, or the takeable set",
  "  --holding ISS-nn an issue a run already holds; a candidate naming a file its plan names is set",
  "                   aside, and the line says which file and which issue",
  "  --checkout dir   the tree whose past runs the cost column is read off; the working",
  "                   directory unless you say otherwise",
  "",
  ...weightLines(weights),
];

const countFrom = (raw) => {
  if (raw === undefined) return DEFAULT_COUNT;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) fail(`next: --count takes a whole number of issues, not \`${raw}\`.`);
  return value;
};

/* Every prose edge, resolved to keys, in both directions: one reading of blocked-by, deps.mjs's. A
   phrase that resolved to no title travels with them — a blocker named and not found is evidence,
   and dropping it silently reads exactly like a body that claimed nothing. */
const edgesFrom = (carried, universe) => {
  const blocks = new Map();
  const blockedBy = new Map();
  const named = new Map();
  const add = (map, from, to) => map.set(from, [...(map.get(from) ?? []), to]);
  const read = graphOf(carried.issues, universe);
  for (const claim of read.claims) {
    add(blocks, claim.from, claim.to);
    add(blockedBy, claim.to, claim.from);
  }
  for (const miss of read.unresolved.filter((one) => one.asBlocker)) {
    add(named, miss.from, { phrase: miss.phrase });
  }
  return { blocks, blockedBy, named, unresolved: read.unresolved };
};

/* The edge as the tracker returns it — `otherDisplayId` and the ordering flag beside it, the shape
   flow/earned.mjs reads — and only the ones that order: `relations.blockedBy` carries mentions too,
   and counting a mention as a blocker would leave an issue nobody can dispatch. */
const withRelations = (blocks, blockedBy, body) => {
  let found = 0;
  for (const edge of body?.relations?.blockedBy ?? []) {
    const [key] = keysIn(edge?.otherDisplayId ?? edge?.issueId ?? edge);
    if (!key || !holdsBack(edge)) continue;
    found += 1;
    blockedBy.set(body.issueId, [...(blockedBy.get(body.issueId) ?? []), key]);
    blocks.set(key, [...(blocks.get(key) ?? []), body.issueId]);
  }
  return found;
};

const bodiesFor = async (window) =>
  new Map(await Promise.all(window.map(async (one) => [
    one.issueId,
    /* The edges are named because the ordering reads them; the attachments are not, and this runs
       once per candidate, so the route nobody asked for would be paid for a window at a time. */
    await scoped("forge_issues", { action: "get", documentId: one.row.documentId, fields: ["relations"] }),
  ])));

/** How many eligible candidates the printing can need: a batch absorbs members, so `count` batches
 *  can consume `count` times the cap before the last head is settled. */
export const wanted = (count, weights) => count * weights.batchCap;

/** Whether the size bound holds over what is still unread. A body's own size is the one weight it
 *  decides, so an unread row can climb by the band's spread and no further, and the read stops when
 *  the best it could reach cannot beat the last candidate the printing can need. It bounds nothing
 *  about a blocking relation, which only a body carries and which raises whatever it names by the
 *  whole chain behind it — so a read that has already met one keeps going rather than pretending
 *  the next body holds none. What it can never cover is a relation in a body nobody opened, and
 *  that is what `settled` is for: the two answers are separate because they certify different
 *  things, and one word for both would claim the stronger. */
export const bounded = (eligible, unread, count, weights, edges = 0) => {
  if (!unread.length) return true;
  if (edges) return false;
  const needed = wanted(count, weights);
  if (eligible.length < needed) return false;
  const floor = eligible[needed - 1].score.total;
  return (unread[0]?.score.total ?? -Infinity) + bandSpread(weights) <= floor;
};

const heldFrom = async (keys, rows) => {
  const plans = await Promise.all(keys.map(async (key) => {
    const row = rows.find((one) => String(one.issueId).toUpperCase() === key.toUpperCase());
    if (!row) fail(`next: --holding names ${key}, which is not on this project's tracker.`);
    const held = await scoped("forge_issues", { action: "get", documentId: row.documentId, fields: ["plan"] });
    return { issueId: row.issueId, plan: held?.plan ?? "" };
  }));
  return heldPaths(plans);
};

const pathsFrom = (key, blocks, alive, seen = new Set()) => {
  const out = [];
  for (const one of blocks.get(key) ?? []) {
    if (seen.has(one) || !alive.has(one)) continue;
    const deeper = pathsFrom(one, blocks, alive, new Set([...seen, one]));
    out.push(...(deeper.length ? deeper.map((path) => [one, ...path]) : [[one]]));
  }
  return out;
};

/** What a landing frees, told apart from what it merely reaches. Only an issue this one blocks and
 *  nothing else still holding is eligible when it lands; one with a second blocker names it, and
 *  what lies deeper waits for the wave in front of it and is shown as the chain it is. */
export const waveUnder = (key, { blocks, blockedBy, alive }) => {
  const direct = (blocks.get(key) ?? []).filter((one) => alive.has(one) && one !== key);
  const others = (one) => (blockedBy.get(one) ?? [])
    .filter((other) => other !== key && alive.has(other));
  return {
    frees: direct.filter((one) => !others(one).length),
    waiting: direct.filter((one) => others(one).length).map((one) => ({ issueId: one, on: others(one) })),
    behind: pathsFrom(key, blocks, alive).filter((path) => path.length > 1),
  };
};

/* The head an earlier batch promotes cannot be known before that batch is formed, so the search is
   the head's own — and the heads a batch does not move are asked for together, which is the common
   case and the difference between one round trip and one per head. */
const searcher = (heads, ask) => {
  const held = new Map(heads.map((head) => [head.issueId, ask(head)]));
  return (head) => {
    if (!held.has(head.issueId)) held.set(head.issueId, ask(head));
    return held.get(head.issueId);
  };
};

const nearFor = async (head, bodies, live, weights) => {
  const body = bodies.get(head.issueId);
  const filing = { title: head.row.title, body: body?.description ?? "", kind: head.row.category ?? null };
  const beside = await neighboursOf(asksOf(filing), live);
  return new Map(beside.suggestions
    .filter((one) => one.score !== null && one.score >= weights.similarity && one.issueId !== head.issueId)
    .map((one) => [one.issueId, one.score]));
};

const jsonOf = (batches, dropped, weights, from, read) => ({
  weights,
  weightsFrom: from,
  read,
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
    unblocks: batch.wave,
    batch: batch.members.map((one) => ({ issueId: one.issueId, how: one.how, why: one.said })),
    related: batch.aside.map((one) => ({ issueId: one.issueId, how: one.how, why: one.said })),
  })),
  dropped: dropped.map((one) => ({ issueId: one.issueId, soft: one.soft, reason: one.reason })),
});

/* The claims a body makes that the tracker does not hold, and only a `blocks` edge answers one: a
   `relates` edge on the same pair orders nothing, so matching it would retire the claim for free. */
const onlyInProse = (claims, edges) => {
  const held = new Set(edges.filter((edge) => edge.kind !== RELATES).map((edge) => `${edge.from} ${edge.to}`));
  return claims.filter((claim) => !held.has(`${claim.from} ${claim.to}`));
};

const printedGraph = async (focus, read, carried, weights) => {
  const { edges, read: covered } = await graphRead(focus, read.rows, weights);
  const prose = graphOf(carried.issues, read.rows);
  const claims = onlyInProse(prose.claims, edges).filter((one) => !focus || one.from === focus || one.to === focus);
  const unresolved = focus ? prose.unresolved.filter((one) => one.from === focus) : prose.unresolved;
  const said = focus
    ? `${focus} read whole; ${prose.carriers} issue(s) on the backlog carry the sentence`
      + ` "${PROSE_MARKER}" (${PROSE_FROM}).`
    : `${covered} of ${read.rows.length} issue(s) read whole, takeable first and capped at`
      + ` readCap ${weights.readCap}; an edge on an issue outside that reading is not here.`;
  return console.log(graphLines({ edges, claims, unresolved, said, verbose: Boolean(focus) }).join("\n"));
};

/** What the caller typed, checked before the first call: this verb's one positional is legal only
 *  beside `--graph`. */
const askedIn = (argv, usage) => {
  const { values: holding, rest } = pullRepeated(argv, "--holding", "next", { usage });
  const { positionals, flagArgv } = partition(rest, BOOLEAN, { verb: "next", usage });
  const asked = flags(flagArgv, "next", BOOLEAN, { usage });
  if (positionals.length && !asked.graph) {
    fail(`next: \`${positionals[0]}\` names no flag, and this verb takes no argument of its own`
      + " except the one issue --graph may be narrowed to.");
  }
  if (positionals.length > 1) fail(`next: --graph narrows to one issue, not \`${positionals.join(" ")}\`.`);
  return { asked, holding, focus: positionals[0]?.toUpperCase() ?? null };
};

/* One walk, one prose-edge read, one body per candidate in the window, two searches per head. */
export const next = async (argv) => {
  const { value: weights, from, refusal } = weightsFrom();
  if (refusal) fail(`next: ${refusal}`);
  const usage = usageLines(weights).join("\n");
  if (wantsHelp(argv)) return console.log(usage);
  const { asked, holding, focus } = askedIn(argv, usage);
  const count = countFrom(asked.count);
  const [read, carried] = await Promise.all([everyIssue(), carriersOf(weights.windowCap)]);
  if (asked.graph) return printedGraph(focus, read, carried, weights);
  const said = shortOf(read, "The set this rank is computed over");
  if (said) console.error(`warning: ${said}\nSo an issue outside it is neither ranked nor named as dropped.`);
  /* Cut independently of the walk above: an edge it did not reach is a candidate called eligible on
     an absence nobody established, which is the one wrong answer this verb can give in silence. */
  const carrierSaid = shortOf(carried.read, "The set of issues claiming an edge");
  if (carrierSaid) {
    console.error(`warning: ${carrierSaid}\nSo a candidate below may be blocked by an edge this`
      + " reading never saw, and eligible here means only that no blocker was found.");
  }
  const rows = read.rows;
  const { blocks, blockedBy, named, unresolved } = edgesFrom(carried, rows);

  const alive = holdingKeys(rows);
  const statusOf = new Map(rows.map((one) => [one.issueId, String(one.status ?? "")]));
  const takeable = takeableRows(rows);
  const preScored = ordered(takeable.map((row) => ({
    issueId: row.issueId,
    row,
    score: scoreOf(row, { weights, chain: chainOf(row.issueId, blocks, alive) }),
  })));
  const held = await heldFrom(holding.flatMap((one) => keysIn(one)), rows);
  const runs = measuredRuns(rootFor(asked.checkout ?? process.cwd()));
  const bands = bandsOf(rows);
  const landed = lastLanded(rows);
  const warmPaths = landed ? pathsNamed((await scoped("forge_issues", {
    action: "get", documentId: landed.documentId, fields: ["description"] }))?.description ?? "") : [];
  /* The mark is read when the body lands, not in `judge`: `judge` is re-run over the whole read
     prefix on every pass — up to five of them under the caps below — and the body does not change
     between them. It rides on the body's own entry, having no life without it. */
  const bodies = new Map();
  const judge = (one) => {
    const body = bodies.get(one.issueId);
    const text = body?.description ?? "";
    const read = bodies.has(one.issueId);
    const score = scoreOf(one.row, {
      weights,
      chain: chainOf(one.issueId, blocks, alive),
      read,
      marked: body?.marked ?? null,
    });
    const blockers = (blockedBy.get(one.issueId) ?? []).map((key) =>
      ({ otherDisplayId: key, otherStatus: statusOf.get(key) ?? "unknown", kind: "blocks" }));
    const verdict = eligibilityOf(one.row, {
      blockers,
      unresolved: named.get(one.issueId) ?? [],
      lease: body?.sessionContext,
      body: read ? text : null,
      held,
    });
    return {
      ...one,
      score,
      body: text,
      read,
      relates: (body?.relations?.relates ?? []).flatMap((other) => keysIn(other?.issueId ?? other)),
      cost: costFor(score.band, runs, bands),
      serves: body?.serves ?? [],
      restart: owesRestart(text),
      warm: isWarm(text, warmPaths) ? (pathsNamed(text)[0] ?? "the tree") : null,
      ...verdict,
    };
  };
  /* Read a pass at a time and stop when the bodies settle the order: a fixed window truncates the
     candidate a body would have promoted, and one whose whole width is dropped by a filter reports
     nothing eligible while eligible issues sit below it. */
  let judged = [];
  let cursor = 0;
  let edges = 0;
  for (;;) {
    judged = ordered(preScored.slice(0, cursor).map(judge));
    const unread = preScored.slice(cursor);
    if (bounded(judged.filter((one) => one.eligible), unread, count, weights, edges)) break;
    if (cursor >= weights.readCap) break;
    const take = unread.slice(0, Math.min(weights.windowCap, weights.readCap - cursor));
    if (!take.length) break;
    for (const [key, body] of await bodiesFor(take)) {
      bodies.set(key, { ...body, marked: markedIn(body?.description ?? ""),
        serves: servesIn(body?.description ?? "") });
    }
    for (const one of take) {
      edges += withRelations(blocks, blockedBy, { ...bodies.get(one.issueId), issueId: one.issueId });
    }
    cursor += take.length;
  }
  const eligible = judged.filter((one) => one.eligible);
  const dropped = judged.filter((one) => !one.eligible);
  const live = eligible.map((one) => ({ documentId: one.row.documentId, issueId: one.issueId, title: one.row.title }));
  const paths = new Map(judged.map((one) => [one.issueId, pathsNamed(one.body)]));
  const batched = await batchesOf(eligible, {
    relates: new Map(judged.map((one) => [one.issueId, one.relates])),
    nearOf: searcher(eligible.slice(0, count), (head) => nearFor(head, bodies, live, weights)),
    paths,
  }, weights, count);
  /* An aside a reader will meet as a head of its own is the same issue printed twice. */
  const shown = new Set(batched.map((batch) => batch.head.issueId));
  const batches = batched.map((batch) => ({
    ...batch,
    aside: batch.aside.filter((one) => !shown.has(one.issueId)).slice(0, weights.batchCap),
    wave: waveUnder(batch.head.issueId, { blocks, blockedBy, alive }),
  }));
  /* Said before either branch, and carried in the json as a field: an order the budget cut is not
     one a machine may treat as settled, and a warning only the human form prints hides it. */
  const unread = preScored.slice(cursor);
  const holds = bounded(eligible, unread, count, weights, edges);
  const readSaid = {
    unresolvedEdges: unresolved.length,
    judged: cursor,
    takeable: preScored.length,
    settled: !unread.length,
    bounded: holds,
    relationsSeen: edges,
    readCap: weights.readCap,
  };
  if (!holds) {
    console.error(`warning: this order is not bounded — ${cursor} of ${preScored.length} takeable`
      + ` issue(s) were read whole${edges
        ? `, and ${edges} of them declared a blocking relation, which no bound over the unread ones`
          + " survives: an issue further down could be holding up work nothing here counted"
        : ", and the read stopped at readCap before the rest could be ruled out"}. Raise \`rank.readCap\``
      + " in this project's own settings, which `forge doctor` names, or narrow the ask.");
  }
  if (asked.json) return console.log(JSON.stringify(jsonOf(batches, dropped, weights, from, readSaid), null, 2));
  if (!batches.length) {
    console.log(`Nothing is eligible: ${takeable.length} issue(s) could be taken and every one was dropped.`);
  } else {
    console.log(HEAD);
    for (const batch of batches) for (const line of candidateLines(batch, { why: Boolean(asked.why) })) console.log(line);
  }
  if (dropped.length) {
    console.log(`\nleft out — ${dropped.length} of the ${judged.length} candidate(s) judged:`);
    for (const one of dropped) console.log(droppedLine(one));
  }
  if (unresolved.length) {
    console.log(`\n${unresolved.length} dependency phrase(s) in a body matched no title. A phrase`
      + " naming this issue's own blocker leaves it out and says so above; `forge next --graph` prints"
      + " them all, apart from the edges the tracker holds.");
  }
  if (unread.length && holds) {
    console.log(`\nRead whole: the top ${cursor} of ${preScored.length} takeable. The rest scored on the`
      + " listing alone, and none could reach this order at the band's own spread — but a body among"
      + " them declaring a blocking relation would, and this reading did not open them.");
  }
  return console.log(`\n${eligible.length} eligible of ${takeable.length} takeable, ${rows.length} on the`
    + ` backlog. Weights from ${from}; nothing was written.`);
};

next.answersHelp = true;
