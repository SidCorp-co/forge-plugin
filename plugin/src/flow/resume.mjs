/* One command that re-mints an issue's context. ISS-26's shell died mid-review and its successor
   read the run's state out of a file written outside the repository, because nothing typed could
   hold it. This writes nothing, takes no lease, and reads only the record (ISS-44). */

import { flags, wantsHelp } from "../resolve/flags.mjs";
import { fail } from "../resolve/settings.mjs";
import { usageOf } from "../resolve/visibility.mjs";
import { commentPage, cutLine } from "../tracker/comments.mjs";
import { Refused, issueOf } from "./record.mjs";
import { viewFrom } from "./earned.mjs";
import { shortfall } from "./advance.mjs";
import { owedLine, policyFor } from "./route.mjs";
import { worklogLines } from "./worklog.mjs";
import { briefOf } from "./brief.mjs";

export const USAGE = [
  usageOf("resume"),
  "The whole context of one issue on one screen, re-minted from the record and the worklog beside",
  "its lease: the status and the phase it owes, the plan, every criterion with its verdict mark, the",
  "last confirmation, decision and correction, the worklog, the parks and blockers, the command the",
  "next status is owed, and where the method for that phase is written.",
  "",
  "  --json    the same assembled object, for a tool rather than a reader",
  "",
  "It writes nothing and needs no lease, so anyone may read any issue. It reads the comments to",
  "assemble the record, and shows the typed kinds rather than the bodies, so it is no delivery of",
  "them: a write held for want of one is cleared by the write's own refusal, which carries them.",
  "",
  "A fact a successor needed and did not find here belongs on the record or in the worklog, never in",
  "this verb: `forge claim <ref> --pushed --review --open \"<line>\"` and `--next` are where it goes.",
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
  return [`${one.state}: session ${one.holder} (${one.agent}, pid ${one.pid}), renewed `
    + `${one.renewedAt.slice(0, 16)} for ${one.minutes} minute(s), ${one.claims} claim(s) on the record`];
};

/* Two answers assembled with the record, never worked out here: whether the edge holds the status
   back, which is the answer the shortfall below acted on, and whether its blocker is far enough
   along. A line that inferred either from the edge's kind would contradict that shortfall the first
   time the tracker gated an edge it had called something else. */
export const edgeSaid = (one) => {
  if (one.gates) return "holding this issue back now";
  return one.satisfied ? "satisfied" : "not an edge the tracker gates dispatch on";
};

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

const print = (brief, view, ref) => {
  console.log(`${ref}  ${brief.status}${brief.phase ? `  —  phase owed: ${brief.phase}` : ""}`
    + `${brief.reopens ? `  —  reopened ${brief.reopens} time(s)` : ""}`);
  block("Lease", held(brief));
  block("Plan", planLines(brief, ref));
  block("Criteria", brief.criteria.map((one) => `${one.mark.padEnd(10)} ${one.number}. ${one.text}`));
  block("Record", Object.entries(brief.latest).map(([kind, one]) => `${kind.padEnd(13)} ${one.said}  (${one.at})`));
  block("Worklog", worklogLines(brief.worklog, brief.next));
  block("Parks and blockers", parks(brief));
  owed(brief, view, ref);
  if (brief.reference) console.log(`\nThe method for this phase: ${brief.reference}`);
  console.log(`\nRead: ${brief.comments.length} comment(s) on this issue`
    + `${brief.comments.length ? `, latest ${brief.comments.at(-1).at}` : ""}.`);
  if (view.cut) console.log(`${view.cut} This brief was minted from those rows and from no others.`);
};

const run = async (argv) => {
  if (!argv.length || wantsHelp(argv)) return console.log(USAGE);
  const [ref, ...rest] = argv;
  if (ref.startsWith("--")) fail(`resume takes the issue first. ${usageOf("resume")}`);
  const given = flags(rest, "resume", ["--json"]);
  for (const one of Object.keys(given)) if (one !== "json") fail(`resume takes no --${one}. Flags: --json`);
  const { documentId, body } = await issueOf(ref);
  const page = await commentPage(documentId);
  const view = viewFrom(documentId, body, page.comments, page.hasMore ? cutLine(page) : null, await policyFor(body.plan, body.status));
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
