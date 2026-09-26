/* The day's page read by three models, each a role this device names: explore reads one section's
   figures and proposes findings, review keeps the ones those figures support, and the judge reads
   every section's findings and writes the decisions and one line per section. Every figure a reading
   cites is checked here against the figures it was shown, and a reading citing anything else is
   dropped and counted rather than written; what a decision and a section line must carry is
   decisions.mjs's. What a stage that does not run leaves the next one, and why a model's reading sits
   on a page of figures at all: docs/cli/stats-the-reading.md. */
import { readingInput } from "./figures.mjs";
import { decisionOf, routedFiling, sectionLineOf, trimmed } from "./decisions.mjs";
import { ROLES, shownDeep } from "../store.mjs";
import { modelCall } from "../../../wire/model-call.mjs";
import { refusing } from "../../../resolve/settings.mjs";
import {
  DIRECTIONS, EXPLORE_ROLE, EXPLORE_TOOL, JUDGE_ROLE, JUDGE_TOOL, MOST_CANDIDATES, MOST_DECISIONS,
  REVIEW_ROLE, REVIEW_TOOL, TEXT_CHARS,
} from "./roles.mjs";

const tally = () => new Map();
const drop = (dropped, stage, reason) => {
  const key = `${stage}\0${reason}`;
  dropped.set(key, (dropped.get(key) ?? 0) + 1);
};
const droppedList = (dropped) => [...dropped].map(([key, count]) => {
  const [stage, reason] = key.split("\0");
  return { stage, reason, count };
});

/* A stage's call, counted against its role whether it answered or not. */
const asked = async (role, spec, held) => {
  const cost = held.cost[role];
  cost.calls += 1;
  try {
    const answer = await held.call({ endpoint: held.endpoint, model: held.roles[role], ...spec });
    cost.input += answer.spent.input;
    cost.output += answer.spent.output;
    return { input: answer.input };
  } catch (error) {
    cost.failed += 1;
    return { failed: String(error.message).split("\n")[0] };
  }
};

const exploredOf = (input, figures, dropped) => {
  const byKey = new Map(figures.map((one) => [one.key, one]));
  const kept = [];
  for (const one of Array.isArray(input.candidates) ? input.candidates : []) {
    const figure = byKey.get(trimmed(one?.figure));
    const reading = trimmed(one?.reading);
    if (!figure) drop(dropped, "explore", "cited a figure the section does not hold");
    else if (!reading || reading.length > TEXT_CHARS) drop(dropped, "explore", `said nothing, or more than ${TEXT_CHARS} characters`);
    else if (kept.length >= MOST_CANDIDATES) drop(dropped, "explore", `past the ${MOST_CANDIDATES} a section may propose`);
    else kept.push({ figure, reading, direction: DIRECTIONS.includes(one.direction) ? one.direction : "unclear" });
  }
  return kept;
};

const reviewedOf = (input, candidates, dropped) => {
  const ruled = new Map();
  const rejected = [];
  for (const one of Array.isArray(input.dropped) ? input.dropped : []) {
    const at = Number(one?.candidate) - 1;
    const why = trimmed(one?.why);
    if (!candidates[at] || ruled.has(at) || !why) continue;
    ruled.set(at, "dropped");
    rejected.push({ ...candidates[at], why: why.slice(0, TEXT_CHARS) });
    drop(dropped, "review", "the figures it cites do not support it");
  }
  const kept = [];
  for (const one of Array.isArray(input.kept) ? input.kept : []) {
    const at = Number(one?.candidate) - 1;
    if (!candidates[at] || ruled.has(at)) continue;
    ruled.set(at, "kept");
    const reading = trimmed(one?.reading);
    /* A rewording is the review's correction of the claim, so one over the length drops the finding
       rather than letting the uncorrected claim stand in its place. */
    if (reading.length > TEXT_CHARS) drop(dropped, "review", `reworded it past ${TEXT_CHARS} characters`);
    else kept.push({ ...candidates[at], ...(reading ? { reading } : {}) });
  }
  candidates.forEach((_, at) => {
    if (!ruled.has(at)) drop(dropped, "review", "neither kept nor dropped with a reason");
  });
  return { kept, rejected };
};

/* The open issue a text matches, or why none could be asked; a search that failed is no match. */
const matchOf = async (backlog, text) => {
  if (!backlog.match) return { unchecked: backlog.refused };
  try {
    return { match: await refusing(() => backlog.match(text)) };
  } catch (error) {
    return { unchecked: String(error.message).split("\n")[0] };
  }
};

const routed = (decisions, backlog) => Promise.all(decisions.map(async (one) => (one.action === "file"
  ? routedFiling(one, await matchOf(backlog, `${one.title}: ${one.cause}`)) : one)));

const judgedOf = async (input, held, { sections, backlog, dropped }) => {
  const kept = [];
  for (const one of Array.isArray(input.decisions) ? input.decisions : []) {
    const judged = decisionOf(one, held);
    if (judged.dropped) drop(dropped, "judge", judged.dropped);
    else if (kept.length >= MOST_DECISIONS) drop(dropped, "judge", `past the ${MOST_DECISIONS} decisions a page carries`);
    else kept.push(judged.kept);
  }
  const decisions = await routed(kept, backlog);
  for (const one of Array.isArray(input.sections) ? input.sections : []) {
    const section = sections[trimmed(one?.section)];
    if (!section) {
      drop(dropped, "judge", "named a section the page does not have");
      continue;
    }
    const line = sectionLineOf(one, held.bySection.get(section.id));
    if (line.dropped) drop(dropped, "judge", line.dropped);
    if (section.verdict || section.verdictDropped) continue;
    if (line.line) Object.assign(section, line.line);
    else if (line.verdict) section.verdictDropped = line.verdict;
  }
  /* Nothing to decide is the judge's word only where it proposed nothing: a proposal that failed the
     checks leaves a day the judge thought held something. */
  const proposed = Array.isArray(input.decisions) ? input.decisions.length : 0;
  return { decisions, nothing: proposed === 0 && input.nothing === true };
};

const shownFinding = (one) => ({ figure: one.figure.key, said: one.figure.said, value: one.figure.value, reading: one.reading,
  direction: one.direction, ...(one.open ? { open: one.open.key } : {}) });

/* Each finding the judge will read set beside the open issue its reading matches, where one does:
   what a filing resting on it would duplicate. */
const withOpen = async (findings, backlog) => {
  if (!backlog.match) return;
  await Promise.all(findings.map(async (one) => {
    const { match } = await matchOf(backlog, one.reading);
    if (match) one.open = match;
  }));
};

/* One section through explore and review, or as far as the roles and the gateway let it go. */
const sectionRead = async (section, held) => {
  const read = { id: section.id, title: section.title, input: "figures", findings: [], rejected: [], notes: [] };
  if (!held.roles.explore) return read;
  const explored = await asked("explore", { system: EXPLORE_ROLE, tool: EXPLORE_TOOL,
    data: { section: section.id, title: section.title, figures: section.figures } }, held);
  if (explored.failed) {
    read.notes.push(`explore did not answer: ${explored.failed}`);
    return read;
  }
  const candidates = exploredOf(explored.input, section.figures, held.dropped);
  Object.assign(read, { input: "candidates", findings: candidates });
  if (!held.roles.review || !candidates.length) {
    await withOpen(candidates, held.backlog);
    return read;
  }
  const reviewed = await asked("review", { system: REVIEW_ROLE, tool: REVIEW_TOOL, data: { section: section.id,
    title: section.title, figures: section.figures,
    candidates: candidates.map((one, at) => ({ candidate: at + 1, figure: one.figure.key, reading: one.reading, direction: one.direction })) } }, held);
  if (reviewed.failed) {
    read.notes.push(`review did not answer: ${reviewed.failed}`);
    await withOpen(candidates, held.backlog);
    return read;
  }
  const { kept, rejected } = reviewedOf(reviewed.input, candidates, held.dropped);
  await withOpen(kept, held.backlog);
  return Object.assign(read, { input: "findings", findings: kept, rejected });
};

/* What the judge is sent of a section: its findings as far as they got beside the baselines a verdict
   cites, or its figures, baselines marked, where none was proposed. */
const judgeSection = (read, section) => (read.input === "figures"
  ? { section: read.id, title: read.title, figures: section.figures }
  : { section: read.id, title: read.title, [read.input === "findings" ? "findings" : "unreviewed"]: read.findings.map(shownFinding),
    baselines: section.figures.filter((one) => one.baseline) });

const stageOf = (roles, role, from) => (roles[role]
  ? { model: roles[role] }
  : { skipped: `\`reports.roles.${role}\` in ${from} names no model` });

/** The reading of a page that did not happen, and why, in the shape of one that did. */
export const unjudged = (why) => ({ why, judged: false, stages: {}, sections: {}, decisions: [], nothing: false, dropped: [], cost: {} });

/** Why nothing may be asked at all, or null: the three causes that stop every stage alike. */
export const blockedBy = ({ disabled, gateway, roles }) => {
  if (disabled) return "FORGE_CODEX_DISABLE=1 stood the page's reading down, so no model read it";
  if (roles.refused) return roles.refused;
  if (!ROLES.some((role) => roles.roles[role])) return `\`reports.roles\` in ${roles.from} names no model, so no model read this page`;
  if (gateway.problem) return `no model read this page: the gateway has ${gateway.problem}`;
  return null;
};

/* The keys the page names, and every open issue a finding matched, each with its status and priority
   as the backlog holds them, null where it could not be asked. */
const offeredIssues = (issues, reads, backlog) => {
  const held = new Map(issues.map((one) => [one.key, one]));
  for (const read of reads) {
    for (const one of read.findings) {
      if (one.open && !held.has(one.open.key)) {
        held.set(one.open.key, { key: one.open.key, title: one.open.title, where: `the open issue matching a finding of ${read.title}` });
      }
    }
  }
  /* A matched title is the tracker's text, masked as the page's own strings are before any stage reads it. */
  return shownDeep([...held.values()].map((one) => ({ ...one, status: null, priority: null, ...(backlog.issue?.(one.key) ?? {}) })), []);
};

/** The page's reading: every section explored and reviewed as the roles allow, then judged once.
 *  `call` stands in for the model call and `backlog` for the plugin's backlog in the suite; nothing here throws. */
export const judgeDay = async (content, { roles, gateway, disabled = false, call = modelCall, now = Date.now(),
  backlog = { refused: "no backlog was asked" } }) => {
  const blocked = blockedBy({ disabled, gateway, roles });
  if (blocked) return unjudged(blocked);
  const given = roles.roles;
  const input = readingInput(content);
  const held = {
    roles: given, call, backlog, dropped: tally(),
    endpoint: { url: gateway.values.ANTHROPIC_BASE_URL, key: gateway.values.ANTHROPIC_AUTH_TOKEN },
    cost: Object.fromEntries(ROLES.filter((role) => given[role]).map((role) => [role, { model: given[role], calls: 0, failed: 0, input: 0, output: 0 }])),
  };
  const reads = await Promise.all(input.sections.map((section) => sectionRead(section, held)));
  const sections = Object.fromEntries(reads.map((read) => [read.id, read]));
  const stages = Object.fromEntries(ROLES.map((role) => [role, stageOf(given, role, roles.from)]));
  if (given.review && !given.explore) stages.review = { skipped: "explore names no model, so review had no candidates to read" };
  let judged = { decisions: [], nothing: false };
  let why = null;
  if (given.judge) {
    const issues = offeredIssues(input.issues, reads, backlog);
    const answer = await asked("judge", { system: JUDGE_ROLE, tool: JUDGE_TOOL, data: {
      sections: reads.map((read, at) => judgeSection(read, input.sections[at])), issues } }, held);
    if (answer.failed) why = `the judge did not answer: ${answer.failed}`;
    else {
      judged = await judgedOf(answer.input, {
        figures: new Map(input.sections.flatMap((section) => section.figures).map((one) => [one.key, one])),
        bySection: new Map(input.sections.map((section) => [section.id, new Map(section.figures.map((one) => [one.key, one]))])),
        keys: new Set(issues.map((one) => one.key)),
        issues: new Map(issues.map((one) => [one.key, one])),
      }, { sections, backlog, dropped: held.dropped });
    }
  }
  return {
    why, at: new Date(now).toISOString(), stages, sections,
    decisions: judged.decisions, nothing: judged.nothing,
    judged: Boolean(given.judge) && !why,
    dropped: droppedList(held.dropped),
    cost: held.cost,
  };
};

