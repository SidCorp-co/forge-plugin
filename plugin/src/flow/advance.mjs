/* One verb between an agent and a status change: the entry criteria of the next status, checked
   against the issue's record and nothing else. The rule a status is earned by, stage by stage:
   `forge guide contract <status>`. */
import { exclusive, firstLine, flags, pullRepeated, wantsHelp } from "../resolve/flags.mjs";
import { fail } from "../resolve/settings.mjs";
import { usageOf } from "../resolve/visibility.mjs";
import { commentPage, countedShort, creditAfter, cutIn } from "../tracker/comments.mjs";
import { declaredValue, write } from "../tracker/rest.mjs";
import { UNREAD, afterRefused, correctionFor, whyChecked } from "./override.mjs";
import { attachmentNames, evidenceProblem } from "../tracker/evidence.mjs";
import { partsOf, readContract, stageLine } from "../guides/contract.mjs";
import { CLOSES_FROM, PARKS, SHOWS_EVIDENCE } from "./machine.mjs";
import { citedClauses } from "../spec/checked.mjs";
import { Refused, refuse } from "../refusal.mjs";
import { issueOf, post } from "./record/record.mjs";
import { render } from "./record/page.mjs";
import { ANSWERED_BY_COMMENT, PARK_STATUS, SIDE, atLeast, fixReport, payloadOwed, rungFieldsOf, setForm, viewFrom } from "./earned.mjs";
import { laneLines } from "../guides/phases.mjs";
import { undoForm } from "./record/merged.mjs";
import { credentialAhead, deployFor, lookAhead, owedLine, policyFor, targetOf } from "./route.mjs";
import { FIELD, anothersHold, leaseOf, nextLine, renew } from "./lease.mjs";

/* A needs_info park owes the readings only the question shape carries. */
const ASKS_A_QUESTION = "question";
const ASKED_AT = ["open", "confirmed"];

export const USAGE = [
  usageOf("advance"),
  "The next status, its entry criteria checked against the issue's record alone, and either the",
  "transition or every missing item beside the one command that supplies it. What git knew is never",
  "asked again: it was written onto the issue at the step that knew it. What the project is, is read",
  "where it is needed — the release policy, and whether it keeps a requirements tree the issue owes",
  "a clause of.",
  "",
  "  --owed                  what the next status is owed, moving nothing, and the line last left",
  "  --next <line>           the step the status it enters starts on, for whoever comes next",
  "  --to <status>           refused unless that status is the next one; a jump is not advancing",
  "  --park <kind> --why W [--evidence E]...  a park record, then the side status the kind implies",
  "  --drop --why W          park as dropped; refused once the merged mark is set",
  "  --set <status> --why W  the status outright, no entry check read; the reply says so and a",
  "                          correction goes on the record naming the status and the reason",
  "",
  `A park kind: ${PARKS.join("|")}.`,
  "What each status is earned by, rung by rung: `forge advance <ref> --owed` for this issue, and",
  "`forge guide contract <status>` for the rule.",
].join("\n");

/* A plain advance from `released`, whose whole entry criterion is that status, so the page is not
   worth the call. A park or a drop from it is another transition: its kind, its evidence and the
   question a needs_info park owes are all judged against the record, so those read the page. */
const readsTheRecord = (body, given) =>
  !given.set && (body.status !== CLOSES_FROM || Boolean(given.park) || Boolean(given.drop));

const viewOf = async (reference, given) => {
  const { documentId, body } = await issueOf(reference);
  const cited = () => citedClauses(body);
  if (!readsTheRecord(body, given)) return viewFrom(documentId, body, [], null, null, cited);
  const page = await commentPage(documentId);
  /* Only the rehearsal prints the line, so only the rehearsal reads it; and neither read feeds the other. */
  const [deploy, release] = await Promise.all([
    given.owed ? deployFor(body.plan, body.status) : null,
    policyFor(body.plan, body.status),
  ]);
  /* Off `cut`, which sizes the issue: a count nobody here can account for is said and sizes nothing. */
  return {
    ...viewFrom(documentId, body, page.comments, cutIn(page), release, cited, deploy),
    counted: countedShort(page),
  };
};

/* The renew before it is where the line is cleared: the transition is refused before this runs unless the record earns it, and a second lease write would cost three more calls. `said` is what a park adds to the payload; a plain advance sends the status alone and nothing else.
   `soft` is the caller with a record up already, which is one fact and not two: the renewal its own write made a call earlier is not made twice, and the tracker's refusal comes back to it rather than exiting the process, because a second renewal is a second place to exit and exiting there would leave that record claiming a move nothing attempted. */
export const transitionTo = async (view, status, ref, { note = "", next = null, said = null, soft = false } = {}) => {
  if (!soft) await renew(view.documentId, ref, next);
  const answer = await write("forge_issues",
    { action: "transition", documentId: view.documentId, data: { status, ...(said ?? {}) } }, undefined, soft);
  /* Soft is for the caller that has already written something: the tracker's own refusal exits the process, and one route needs it back to say what its record left behind. */
  if (answer?.refused) return answer.refused;
  const held = answer?.status ?? answer?.issue?.status;
  if (held && held !== status) refuse(`The transition answered with status ${held}, not ${status}. Nothing to rely on.`);
  console.log(`${ref}  ${view.issue.status} -> ${status}${note}`);
  return null;
};

/* Every park kind landing in `waiting` asks a person to decide, so the kind the tracker demands is
   derived; one that waited on a thing would need a row of its own. */
const WAITING = "waiting";
const waitsFor = (status) => (status === WAITING ? { waitingKind: "needs_decision" } : {});

/* The two writes of one park: the typed `why` travels with the move, which the tracker refuses
   without one (ISS-157), and the status goes first so a refused move leaves no record to disagree
   with it — except at `ANSWERED_BY_COMMENT`, where the record has to go first. What that order
   costs, said by the one route both writers of it spend: a move refused after the record went up
   leaves a page reading as a status the issue does not hold, and the transition's own refusal says
   nothing about the record above it. */
const movedAfterRecord = async (view, ref, status, move) => {
  /* The record's write renewed the lease, so the move does not renew it again — but a handoff between the two is still a handoff, and the move must not be the write that learns it. Asked rather than asserted, and asked softly, because a read that exits here reports a transport and never the record standing above it. */
  const held = await anothersHold(view.documentId, ref);
  if (held) {
    refuse(`the record for ${status} went up and the move was not attempted. ${held.said}\n`
      + (held.unknown
        ? `Whether ${ref} is still this run's could not be read, so nothing was sent to the status. `
          + `Read the lease and make the move, or say on the record that it did not happen:\n  ${setForm(ref, status)}\n`
        : `${ref} changed hands between the two writes, so no write of yours may set its status. `
          + `Take the issue back and move it, or say on the record that it did not happen:\n  forge claim ${ref} --take\n`)
      + `  forge record correction ${ref} --moved "the record above claims ${status}, which was not `
      + `attempted" --why <w>`);
  }
  const refused = await move(true);
  if (!refused) return;
  /* A dropped write is not a rejected one: the transport says so itself, and a message naming the old status either way would send a run to correct a move that may have landed. */
  if (afterRefused(refused).unknown) {
    refuse(`the record for ${status} went up and the move neither landed nor failed cleanly. ${refused}\n`
      + `Read ${ref}'s status before writing anything else — the record above claims ${status}, and `
      + `whether the issue holds it is what decides which of these two is owed:\n`
      + `  forge issue ${ref} --fields status\n  ${setForm(ref, status)}`);
  }
  refuse(`${ref} is still ${view.issue.status}: the record for ${status} went up and the move was `
    + `refused. ${refused}\nThe page above now reads as a status this issue does not hold. `
    + `Move it with the command that was refused, or say on the record that it did not move:\n`
    + `  ${setForm(ref, status)}\n  forge record correction ${ref} `
    + `--moved "the record above claims ${status}, which the move was refused" --why <w>`);
};

/* A move into a side status, with the announcement the tracker writes for it credited in the same breath, for the reason `markMerged` states. It asks softly because it has a record up already, which is the one fact `transitionTo` reads that flag for. */
const moveTo = async (view, ref, status, { note = "", said, credit }, soft = false) => {
  const refused = await transitionTo(view, status, ref, { note, said, soft });
  if (refused) return refused;
  await creditAfter(credit, [{ ref, documentId: view.documentId }]);
  return null;
};

export const parkAs = async (view, ref, kind, why, evidence = [], left = null) => {
  const status = PARK_STATUS[kind];
  const body = render("park", { kind, why, evidence }, left ?? view.issue.status);
  const move = (soft = false) =>
    moveTo(view, ref, status, { said: { reason: why, ...waitsFor(status) }, credit: "the park's transition" }, soft);
  if (status === ANSWERED_BY_COMMENT) {
    await post(view.documentId, body, { ref });
    await movedAfterRecord(view, ref, status, move);
    return;
  }
  await move();
  try {
    await post(view.documentId, body, { ref, renewed: true });
  }
  catch (error) {
    /* A record written now would stamp the side status as the one it left. The body goes back on
       stdin: a quoted argument would end on the apostrophes and newlines it holds. */
    refuse(`${ref} moved to ${status} and its park record did not go up: ${error.message}\n`
      + `Nothing on the page now says where it left, and \`forge record park\` would stamp `
      + `${status} as that status. Put this body up as it stands:\n\n`
      + `forge comment ${view.documentId} - <<'FORGE_PARK_RECORD'\n${body}\nFORGE_PARK_RECORD`);
  }
};

const park = async (view, ref, kind, why, evidence) => {
  const to = PARK_STATUS[kind];
  if (!to) refuse(`--park takes one of ${Object.keys(PARK_STATUS).join(", ")}, not \`${kind}\`.`);
  if (to === ANSWERED_BY_COMMENT && !ASKED_AT.includes(view.issue.status)) {
    refuse(`a question goes to the reporter, and ${ref} is ${view.issue.status}: the readings it would `
      + `offer are the triage ones. Ask from ${ASKED_AT.join(" or ")}, or park for a reviewer instead.`);
  }
  if (to === "dropped" && atLeast(view.issue.status, "developed")) {
    refuse(`${ref} is ${view.issue.status}, and dropped means no code landed. Revert first, then drop `
      + `from approved:\n  ${setForm(ref, "approved")}`);
  }
  if (to === "dropped" && view.issue.mergedAt) {
    refuse(`${ref} was marked merged at ${view.issue.mergedAt}, and dropped means no code landed. `
      + `Revert the commit, clear the mark, then drop from approved:\n  ${undoForm(ref)}`);
  }
  if (kind === ASKS_A_QUESTION) {
    const owed = payloadOwed(
      view,
      "question",
      "a needs_info park is a question: two or more readings, each with the outcome it produces",
      `forge record question ${ref} --reading "<reading -> outcome>" --reading "<reading -> outcome>"`,
    );
    if (owed.length) refuse(`${owed[0].what}. Write it first:\n  ${owed[0].command}`);
  }
  if (SHOWS_EVIDENCE.includes(kind) && !evidence.length) {
    refuse(`a ${kind} park names what the reviewer is to look at:\n`
      + `  forge advance ${ref} --park ${kind} --why "<why>" --evidence <attachment|url|sha>`);
  }
  const bad = evidence.length ? evidenceProblem(evidence, attachmentNames(view.issue, view.comments)) : null;
  if (bad) refuse(bad);
  await parkAs(view, ref, kind, why, evidence);
};

/* A named target is checked rather than obeyed: the only legal one is where the route says the
   issue goes, which for a reopen is wherever its triage decided. */
export const checkTarget = (to, next, view, ref) => {
  if (!to || to === next) return;
  if (SIDE.includes(to)) refuse(`${to} is a side status, which a park reaches: forge advance ${ref} --park <kind> --why "<why>".`);
  refuse(`${ref} is ${view.issue.status} and ${next} is next, not ${to}. A jump past a status is refused.`);
};

/* Printed under the shortfall and under "the record earns it" alike, because the point of it is
   that a run reads it before the status it belongs to is the one being asked for. */
const sayAhead = (view, ref, next) => {
  const report = fixReport(view, ref);
  if (report) console.log(`\n${report}`);
  console.log("");
  for (const line of laneLines({ status: view.issue.status, fields: rungFieldsOf(view) })) console.log(line);
  const shortly = credentialAhead(view, ref);
  if (shortly) console.log(`\n${shortly}`);
  const said = lookAhead(view, ref);
  if (said) console.log(`\n${said}`);
  console.log(`\n${stageLine(next, partsOf(readContract()))}`);
};

/* Every entry criterion is a presence check, so a shortfall off a read that stopped short is only ever longer than the true one:
   judged rather than refused (ISS-131), and naming no end, the envelope never saying which rows the read missed (ISS-697).
   The two reads part on what a second record would do, so one sentence cannot advise both (ISS-841): a walk that ended short holds a prefix
   and a record written into it lands past the end that walk never reached, while rows the tracker called whole are the rows the next read hands back. */
const EARNED = "What the rows read earn, they earn, and anything they say is owed ";
const cutSays = (said, ref) =>
  `${said} ${EARNED}may be a record past that prefix, so this shortfall is a ceiling and not a `
  + "count. Once the thread, read where it is whole, shows the record that earns the status, "
  + `\`forge advance ${ref} --set <status> --why "<why>"\` puts that status on with no entry check `
  + "read and a correction saying so.";
const countSays = (said) =>
  `${said} ${EARNED}is owed on rows the tracker called whole, so write it again for this status: a `
  + "record written now is in the rows the next read hands back.";

export const shortfall = (ref, view, held) => {
  console.log(owedLine(view, ref, held));
  for (const one of held.missing) console.log(`\n  ${one.what}\n    ${one.command}`);
};

/* The status set with nothing earning it, judged against what `declaredValue` declares and against nothing else, with the reply and the correction saying no check read it. A side status is reached with the payload the tracker demands of one, so `--set` writes what a park writes and skips only the entry checks. */
const setStatus = async (view, ref, status, why) => {
  const said = whyChecked("advance --set", why);
  const near = declaredValue("forge_issues", "status", status);
  if (near) refuse(`${near} That set is what the route table declares this tracker takes. Nothing was sent.`);
  const moved = `the status set to \`${status}\` by \`forge advance --set\`, from `
    + `\`${view.issue.status}\`, with no entry check read`;
  const move = async (soft = false) => {
    const refused = await moveTo(view, ref, status,
      { note: "  (set, unearned)", said: { reason: said, ...waitsFor(status) }, credit: "the set transition" }, soft);
    if (refused) return refused;
    console.log(UNREAD);
    return null;
  };
  if (status === ANSWERED_BY_COMMENT) {
    await correctionFor(view.documentId, ref, moved, said, { done: false });
    return movedAfterRecord(view, ref, status, move);
  }
  await move();
  return correctionFor(view.documentId, ref, moved, said);
};

export const nextHeld = (view) => leaseOf(view.issue?.[FIELD])?.next ?? null;

const readFlags = (rest) => {
  const pulled = pullRepeated(rest, "--evidence", "advance", { usage: USAGE });
  const given = flags(pulled.rest, "advance", ["--owed", "--drop"], { usage: USAGE });
  const evidence = pulled.values;
  const [wrote] = exclusive(given, ["park", "drop", "set"], "advance",
    "forms: a drop is the park kind `dropped`, and --set names the status outright; a park goes where its kind says");
  const writes = wrote !== undefined;
  if (writes && given.owed) refuse("--owed moves nothing, and --park, --drop and --set write. Ask for one.");
  if (writes && given.to) refuse("--to names the status to advance to; --set and a park each say where they go.");
  if (writes && !given.why) refuse(`--${wrote} needs --why: `
    + "the reason is what the record carries about it.");
  if (given.why && !writes) refuse("--why belongs to --park, --drop or --set; nothing else here takes a reason.");
  if (evidence.length && !writes) refuse("--evidence belongs to the park record; a check reads the evidence already on the issue.");
  const asked = given.next !== undefined;
  if (asked && given.owed) refuse("--owed moves nothing and --next is a write. Ask for one.");
  if (asked && writes) refuse("a park says what it waits for in --why; the claim that resumes it sets --next.");
  return { ...given, evidence, next: nextLine(given.next) };
};

const run = async (argv, readAs) => {
  if (!argv.length || wantsHelp(argv)) return console.log(USAGE);
  const [ref, ...rest] = argv;
  if (ref.startsWith("--")) refuse(`advance takes the issue first. ${firstLine(USAGE)}`);
  const given = readFlags(rest);
  const view = await viewOf(ref, given);
  const left = nextHeld(view);
  if (given.owed && left) console.log(`Next, as the last write left it: ${left}`);
  if (!view.whole) console.log(cutSays(view.cut, ref));
  if (view.counted) console.log(countSays(view.counted));
  if (given.set) return setStatus(view, ref, given.set, given.why);
  if (given.park || given.drop) {
    return park(view, ref, given.park ?? "dropped", given.why, given.evidence);
  }
  const { next, missing, resumed, park: routed } = targetOf(view, ref);
  checkTarget(given.to, next, view, ref);
  if (missing.length) {
    shortfall(ref, view, { next, missing });
    /* Asked what is owed, the answer is the answer; asked to move, the same list is a refusal. */
    if (!given.owed) return fail(`${missing.length} item(s) owed before ${next}.`);
    return sayAhead(view, ref, next);
  }
  if (given.owed) {
    console.log(owedLine(view, ref, { next, missing }));
    return sayAhead(view, ref, next);
  }
  /* The triage that puts the expectation outside the specification writes its park here, because a
     park is a record and a status and the route decided both from the triage the record holds. */
  if (routed) return parkAs(view, ref, routed.kind, routed.why, [], routed.left);
  /* Both notes, where a form resumed a park: what moved it and what was typed to move it are two
     facts, and dropping either leaves the line answering a question nobody asked. */
  const note = `${resumed ? "  (resumed where its park left it)" : ""}`
    + `${readAs ? `  (read as ${readAs} ${ref})` : ""}`;
  return transitionTo(view, next, ref, { note, next: given.next ?? null });
};

export const advance = async (argv, { readAs = null } = {}) => {
  try {
    await run(argv, readAs);
  } catch (error) {
    if (error instanceof Refused) fail(error.message);
    throw error;
  }
};
advance.answersHelp = true;
