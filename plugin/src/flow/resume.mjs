/* One command that re-mints an issue's context. ISS-26's shell died mid-review and its successor
   read the run's state out of a file written outside the repository, because nothing typed could
   hold it. This writes nothing, takes no lease, and reads only the record (ISS-44). */

import { flags, wantsHelp } from "../resolve/flags.mjs";
import { fail } from "../resolve/settings.mjs";
import { usageOf } from "../resolve/visibility.mjs";
import { commentPage, cutIn } from "../tracker/comments.mjs";
import { citedClauses } from "../spec/checked.mjs";
import { Refused } from "../refusal.mjs";
import { issueOf, recordReport } from "./record/record.mjs";
import { sizeOf, viewFrom } from "./earned.mjs";
import { READ_OFF_THE_RECORD, indexLines, phaseIndex } from "../guides/phases.mjs";
import { shortfall } from "./advance.mjs";
import { owedLine, policyFor } from "./route.mjs";
import { worklogLines } from "./worklog.mjs";
import { briefOf } from "./brief.mjs";
import { SHARED_HOLDER, landingLine, landingTurn } from "./lease.mjs";
import { atMinute, heldSaid } from "./machine.mjs";

export const USAGE = [
  usageOf("resume"),
  "The whole context of one issue on one screen, re-minted from the record and the worklog beside",
  "its lease: the status and the phase it owes, the plan, every criterion with its verdict mark, the",
  "last confirmation, decision and correction, the worklog, the parks and blockers, the command the",
  "next status is owed, and where the method for that phase is written.",
  "",
  "  --json    the same assembled object, for a tool rather than a reader",
  "  --report  every record whole instead of this brief: the latest of each kind that can only be",
  "            current and every one of a kind that repeats, which `forge record -h` names, the",
  "            latest verdict per criterion with its evidence, the plan, and what is owed",
  "",
  "It writes nothing and needs no lease, so anyone may read any issue. A fact a successor needed and",
  "did not find here belongs on the record or in the worklog: docs/cli/resume.md.",
].join("\n");

const PLAN_LINES = 12;

/* Bounded, because a brief is one screen and a plan is a document: the pointer is the whole of it,
   and a resuming run that needs more than the shape asks for it by name. */
const planLines = (brief, ref) => {
  const lines = (brief.plan ?? "").split("\n").filter((one) => one.trim());
  if (lines.length <= PLAN_LINES) return lines;
  return [...lines.slice(0, PLAN_LINES), `… ${lines.length - PLAN_LINES} more: forge issue ${ref} --fields plan`];
};

const block = (heading, lines) => {
  if (!lines.length) return;
  console.log(`\n${heading}`);
  for (const line of lines) console.log(`  ${line}`);
};

const held = (brief) => {
  const one = brief.lease;
  if (!one) return [];
  return [
    `${one.state}: session ${one.holder} (${one.agent}, pid ${one.pid}), renewed `
    + `${atMinute(one.renewedAt)} for ${one.minutes} minute(s), ${one.claims} claim(s) on the record`,
    ...(one.holderShared ? [SHARED_HOLDER] : []),
    /* Through the readers the refusals use, so this and `--take` cannot say different things. */
    ...(brief.landing
      ? [landingLine(brief.landing), `  whose turn: ${landingTurn(brief.landing) ?? "nobody's — the state names none"}`]
      : []),
  ];
};

/* Both answers come with the record: inferring either from the edge's kind would contradict the
   shortfall below the first time the tracker gated an edge it had called something else. */
export const edgeSaid = (one) => {
  if (one.gates) return "holding this issue back now";
  return one.satisfied ? "satisfied" : "not an edge the tracker gates dispatch on";
};

/* Under the headlines, because it is what qualifies them: the correction on the line above is one
   of five, and a reader who takes it for the whole record judges against text four others moved. */
const records = (brief) => [
  ...Object.entries(brief.latest).map(([kind, one]) => `${kind.padEnd(13)} ${one.said}  (${one.at})`),
  ...(Object.keys(brief.repeated).length
    ? [`${"repeated".padEnd(13)} ${Object.entries(brief.repeated)
      .map(([kind, held]) => heldSaid(kind, held)).join(", ")}  (forge resume ${brief.ref} --report)`]
    : []),
];

const parks = (brief) => [
  ...(brief.park ? [`parked: ${brief.park.said}  (${brief.park.at})`] : []),
  ...brief.blockers.map((one) => `${one.kind ?? "unnamed"} ${one.ref}, which is ${one.status} — ${edgeSaid(one)}`),
];

/* The one owed list, printed by the same two functions `advance --owed` prints it with: a second
   copy would drift, and this is the line a resuming run acts on. The refusal is printed whole here
   rather than by its first line, because a brief is what a run reads when it has lost the thread. */
const owed = (brief, view, ref) => {
  console.log("");
  if (brief.owed.refused) console.log(brief.owed.refused);
  else if (brief.owed.missing.length) shortfall(ref, view, brief.owed);
  else {
    console.log(owedLine(view, ref, brief.owed));
    if (brief.owed.resumed) console.log("  (it resumes where its park left it)");
  }
  if (brief.ahead) console.log(`\n${brief.ahead}`);
};

/* Ahead of the body, the brief and every other block, because a run handed an issue past `open`
   redoes the phases behind it otherwise — this issue's own run replayed two of them (ISS-673). */
const opening = (brief, view) => {
  const index = phaseIndex({ status: brief.status, size: sizeOf(view) });
  /* Silent where none is owed: the header carries the phase, this says what to do with the rest. */
  if (!index.first) return;
  console.log(READ_OFF_THE_RECORD);
  /* One per line, because a phase's own name carries commas and a joined list reads as more. */
  for (const one of index.passed.filter((row) => row.cites)) {
    console.log(`  passed: ${one.phase}  —  ${one.cites}`);
  }
};

const print = (brief, view, ref) => {
  console.log(`${ref}  ${brief.status}${brief.phase ? `  —  phase owed: ${brief.phase}` : ""}`
    + `${brief.reopens ? `  —  reopened ${brief.reopens} time(s)` : ""}`);
  opening(brief, view);
  block("Lease", held(brief));
  block("Plan", planLines(brief, ref));
  block("Criteria", brief.criteria.map((one) => `${one.mark.padEnd(10)} ${one.number}. ${one.text}`));
  block("Record", records(brief));
  block("Worklog", worklogLines(brief.worklog, brief.next));
  block("Parks and blockers", parks(brief));
  owed(brief, view, ref);
  if (brief.reference) console.log(`\nThe method for this phase: ${brief.reference}`);
  console.log(`\nRead: ${brief.comments.length} comment(s) on this issue`
    + `${brief.comments.length ? `, latest ${brief.comments.at(-1).at}` : ""}.`);
  if (view.cut) console.log(`${view.cut} This brief was minted from those rows and from no others.`);
};

/* Here because the guide registry answers off disk and stays offline, and `flow/` is at its
   ten-file ceiling; this verb already assembles the view a cut is read from. */
export const indexFor = async (slug, ref) => {
  const { documentId, body } = await issueOf(ref);
  const page = await commentPage(documentId);
  const view = viewFrom(documentId, body, page.comments, cutIn(page));
  return indexLines(slug, ref, phaseIndex({ status: body.status, size: sizeOf(view) }));
};

const run = async (argv) => {
  if (!argv.length || wantsHelp(argv)) return console.log(USAGE);
  const [ref, ...rest] = argv;
  if (ref.startsWith("--")) fail(`resume takes the issue first. ${usageOf("resume")}`);
  const given = flags(rest, "resume", ["--json", "--report"], { usage: USAGE });
  if (given.report && given.json) fail("resume: --report and --json are separate readings. Ask for one.");
  if (given.report) return recordReport(ref);
  const { documentId, body } = await issueOf(ref);
  const page = await commentPage(documentId);
  const view = viewFrom(documentId, body, page.comments, cutIn(page), await policyFor(body.plan, body.status), () => citedClauses(body));
  const brief = briefOf(view, ref);
  return given.json ? console.log(JSON.stringify(brief, null, 2)) : print(brief, view, ref);
};

export const resume = async (argv) => {
  try {
    await run(argv);
  } catch (error) {
    if (error instanceof Refused) fail(error.message);
    throw error;
  }
};
resume.answersHelp = true;
