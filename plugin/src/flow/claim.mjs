/* The pick: the lease a run takes before it writes anything, the reclaim of one a dead run left
   behind, and the park a status that keeps crashing earns. docs/cli/claim.md. */
import { flags, pullRepeated, wantsHelp } from "../resolve/flags.mjs";
import { sessionOf, sessionSourced } from "../resolve/config.mjs";
import { fail } from "../resolve/settings.mjs";
import { usageOf } from "../resolve/visibility.mjs";
import { documentIdOf } from "../tracker/issues.mjs";
import { scoped } from "../tracker/rest.mjs";
import { commentPage, cutIn } from "../tracker/comments.mjs";
import { isCommit, sameCommit, shortSha } from "../tracker/evidence.mjs";
import { rungFieldsOf, viewFrom } from "./earned.mjs";
import { laneLines, openingLines } from "../guides/phases.mjs";
import { partForStatus } from "../guides/served.mjs";
import { kindsHeld, parse } from "./record/page.mjs";
import { parkAs, transitionTo } from "./advance.mjs";
import { OPEN_KEPT, merged, patchFrom, worklogFor, worklogOf, workNow } from "./worklog.mjs";
import {
  ADVISORY,
  LANDING_BUILDER_OWED,
  LANDING_JUDGED,
  LANDING_QA_OWED,
  LANDING_READY,
  LANDING_RECONCILED,
  MINUTES,
  RECLAIMS_BEFORE_PARK,
  SHARED_HOLDER,
  claimRefusal,
  claimed,
  describe,
  historyLine,
  landingLine,
  landingOf,
  landingSaved,
  leaseOf,
  nextLine,
  nothingWorked,
  parkAnswers,
  parksAsCrashed,
  reclaimsOf,
  setLease,
  sharedHolder,
  stateOf,
  takeLease,
  takeRefusal,
} from "./lease.mjs";

const MAX_MINUTES = 24 * 60;
const PARKS_IN = "on_hold";

/* Beside the advisory rather than above the lease line: both are what the run does next, where the lines above are what this write did. A claim opens a phase's work, so the part is the one its status owes. */
/* And the opening above both, because a run handed an issue past `open` redoes the phases behind it otherwise, through the renderer `forge resume` prints so the two cannot say different things about one record. Both printers are exported so a case reads what each verb prints rather than what that renderer returns, a renderer nobody prints passing every case that asks it for lines (ISS-804). */
export const advisory = (status, fields, held, work = null) => {
  for (const line of openingLines(status, held, work)) console.log(line);
  console.log("");
  for (const line of laneLines({ status, fields })) console.log(line);
  console.log(`\n${ADVISORY}`);
  partForStatus(status, (part) => console.log(`\n${part}`));
};

/* The rung the lane is printed at is the effective one — the field, every correction that climbs and the cut rule — so this is the one read this verb makes for something other than the lease, and it is made after the writes and softly: a hard read's own failure exits the process, which would take a claim that had already landed down with it, and a page that does not read back is owed a line and not the claim. Unread, it is read as a cut page is, which is the rung that owes most (docs/cli/the-ladder.md). */
const UNREAD = { plan: null, moved: [], whole: false, complexity: null };

/* The worklog is handed in and not read off the issue, which was fetched before this claim's own write: each route passes what it wrote, the two hand-backs writing none, and a page that did not read back still names the branch. */
const advise = async (documentId, issue, held = null) => {
  const work = workNow(held);
  const page = await commentPage(documentId, true);
  if (page?.refused) {
    console.log(`This issue's comment page did not read back, so no phase is named as passed and the `
      + `lane below is printed at the rung an unread page owes: ${page.refused}`);
    return advisory(issue.status, UNREAD, [], work);
  }
  const view = viewFrom(documentId, issue, page.comments, cutIn(page));
  return advisory(issue.status, rungFieldsOf(view), kindsHeld(view), work);
};

export const USAGE = [
  usageOf("claim"),
  "The lease on an issue, in the session field the issue already has: a holder, a renew time, a",
  "duration and the claims before this one. Every payload write the CLI makes renews it, and a read",
  "needs none. Nothing else about a run is remembered anywhere.",
  "",
  `  --minutes <n>   how long the lease runs from now, instead of ${MINUTES}`,
  "  --next <line>   one line, the step whoever comes next starts on; a transition clears it",
  "  --pushed        the branch, head, base and files touched, read from git at this moment",
  "  --review        the last codex consult, its findings and what it owes, read from the log now",
  `  --open <line>   a scratch decision or a dead end, appended; past ${OPEN_KEPT} the oldest is dropped`,
  "  --ready         with --pushed: the landing checkpoint, in state `ready`, from that capture",
  "  --take          the lease at whatever state the checkpoint names your turn",
  "  --judged        the QA turn handed back: the checkpoint moves from `qa-owed` to `judged`",
  "  --reconciled <sha>  the builder's turn handed back: `builder-owed` to `reconciled` at that sha",
  "",
  "--pushed, --review and --open write the worklog beside the lease, which `forge resume` reads",
  "first; neither capture is automatic, since a write from another checkout would name that one.",
  "What the checkpoint holds and which state names whose turn: docs/cli/the-checkpoint.md.",
  "",
  nothingWorked(),
  "",
  ADVISORY,
].join("\n");

const minutesFrom = (raw) => {
  if (raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_MINUTES) {
    fail(`--minutes takes an integer from 1 to ${MAX_MINUTES}, not \`${raw}\`.`);
  }
  return value;
};

/* The crashed park the record ends with: the status it left and when it was written, or nothing. */
const crashedPark = (comments) => {
  const parks = comments
    .map((one) => ({ at: one.createdAt ?? "", record: parse(one.body ?? "") }))
    .filter((one) => one.record?.kind === "park");
  const last = parks.at(-1);
  return last?.record.fields.kind === "crashed"
    ? { left: last.record.fields.left, at: last.at }
    : null;
};

/* A park is a transition, so it clears the line it follows, or this third write would put back what
   the transition just took away. A line this claim asked for survives it: the person resuming reads
   it, and writing it, printing it and taking it away again would be the input dropped. */
export const parkWrite = (lease, next = null) =>
  ({ holder: lease.holder, at: new Date().toISOString(), minutes: lease.minutes, next: next ?? null });

/* The line taken over from is not the line taken on: printing the incoming one as the last
   holder's would say the dead run left a note its successor wrote. A take is a handoff too. */
const HANDOFF = new Set(["reclaim", "take"]);

export const nextLines = (how, left, taken) => [
  HANDOFF.has(how) && left ? `Next, left by the run before: ${left}` : null,
  taken && taken !== left ? `Next: ${taken}` : null,
].filter(Boolean);

/* Off the same capture the worklog took, so the head the checkpoint calls judged is the head the
   review was taken at. The paths and not the count: what the lander compares with what the landing moved
   is a list, and a capture that read no diff is a checkpoint nobody can land — which is why the guard
   below reads the diff and not the head, the pointer being written either way. */
export const readyCheckpoint = (ref, holder, patch, landing) => {
  if (!patch?.head || !patch.base || !patch.touched) {
    fail(`claim --ready writes the checkpoint off the capture --pushed makes, and this one captured `
      + `no change — the line above says why. Capture at the push, before the merge:\n`
      + `  forge claim ${ref} --pushed --ready`);
  }
  if (landing && landing.state !== LANDING_READY) {
    fail(`the landing checkpoint on ${ref} reads \`${landing.state}\`, which is past the build, so `
      + `--ready would write the landing's own reading away. Read where it is:\n  forge resume ${ref}`);
  }
  return {
    state: LANDING_READY,
    builder: holder,
    branch: patch.branch,
    head: patch.head,
    base: patch.base,
    files: String(patch.touched ?? "").split(", ").filter(Boolean),
    at: patch.at,
  };
};

/* The one route out of `qa-owed`, and the reason the state is not a dead end: the judge writes its
   verdicts as any run does and then says the turn is over, which is all this writes. What those
   verdicts have to carry is the contract's at `testing` and not this claim's to re-judge — a judge
   refused here could neither hand back nor be replaced. docs/cli/the-checkpoint.md. */
const handBack = async (documentId, ref, context, holder) => {
  const landing = landingOf(context);
  if (landing?.state !== LANDING_QA_OWED) {
    fail(`claim --judged ends the QA turn, and the landing checkpoint on ${ref} reads `
      + `\`${landing?.state ?? "nothing at all"}\`: the turn is handed back from \`${LANDING_QA_OWED}\` `
      + `and from no other state. Read where the landing is:\n  forge resume ${ref}`);
  }
  /* The same independence `--take` is refused by one move earlier, asked of the same function so the
     two cannot drift: ending the turn writes the judge onto the checkpoint, which a build reaching
     here under its own id would sign as an independent judgement of its own work. */
  const mine = sessionSourced();
  const refused = takeRefusal(ref, landing, holder, leaseOf(context),
    { source: mine.id === holder ? mine.source : null });
  if (refused) fail(refused);
  const saved = await landingSaved(documentId, ref, { state: LANDING_JUDGED, judge: holder });
  console.log(`${ref}  judged: ${landingLine(saved)}`);
  return console.log(`The verdicts on the record are the judgement and the landing takes it from `
    + `here, so nothing more of ${ref} is this run's.`);
};

/* The other route out, and the same shape as the hand-back above: the state, then the independence,
   then one write. What is its own is the sha — the builder is owed the turn because the landing's
   merge moved a path this change owns, so what it has to say is which candidate it read, and the
   candidate the checkpoint names is what proves that rather than the run's word for it. Seven digits
   or forty, because seven is what the landing's own stop prints; the checkpoint's own string is
   stored, since that is the one the promotion compares. docs/cli/the-checkpoint.md. */
const reconcile = async (documentId, ref, context, holder, given) => {
  const landing = landingOf(context);
  if (landing?.state !== LANDING_BUILDER_OWED) {
    fail(`claim --reconciled ends the builder's turn, and the landing checkpoint on ${ref} reads `
      + `\`${landing?.state ?? "nothing at all"}\`: the turn is handed back from `
      + `\`${LANDING_BUILDER_OWED}\` and from no other state. Read where the landing is:\n`
      + `  forge resume ${ref}`);
  }
  if (!isCommit(given)) {
    fail(`claim --reconciled takes the sha of the candidate the landing built, of 7 to 40 hex `
      + `digits, and \`${given}\` is not one. The checkpoint names it:\n  forge resume ${ref}`);
  }
  if (!sameCommit(given, landing.candidate)) {
    fail(`the checkpoint on ${ref} names the candidate `
      + `${shortSha(landing.candidate) || "nothing at all"} and this reconciliation names `
      + `${shortSha(given)}. The branch came back because the landing's merge moved `
      + `${landing.moved || "a path of this change"}, so what is owed is a reading of that candidate `
      + `and nothing else is accepted for it:\n  forge claim ${ref} --reconciled ${landing.candidate}`);
  }
  /* The same independence `--judged` asks of the same function, so the two hand-backs cannot come to
     disagree about who may write one: at this state it is the builder the checkpoint names, and a
     wave's shared id is not proof of being it where the write would replace a live lease. */
  const mine = sessionSourced();
  const refused = takeRefusal(ref, landing, holder, leaseOf(context),
    { source: mine.id === holder ? mine.source : null });
  if (refused) fail(refused);
  const saved = await landingSaved(documentId, ref,
    { state: LANDING_RECONCILED, reconciled: landing.candidate });
  console.log(`${ref}  reconciled: ${landingLine(saved)}`);
  return console.log(`The candidate ${shortSha(landing.candidate)} is what this run says it read, `
    + `and the landing promotes that commit and no other, so nothing more of ${ref} is this run's.`);
};

/* The turn is read before anything is written, because this is the one claim that may take a live
   lease: a take the state does not name is refused and no field is touched. */
const takeTurn = async (documentId, ref, issue, context, { holder, minutes, line, patch }) => {
  const landing = landingOf(context);
  const left = leaseOf(context)?.next ?? null;
  const taken = await takeLease(documentId, ref, context, { holder, minutes, line, patch, status: issue.status });
  console.log(`${ref}  take: ${describe(taken)}`);
  console.log(landingLine(landing));
  for (const one of nextLines("take", left, taken.next)) console.log(one);
  return taken;
};

/* The acknowledgement is the third write, and a run can die before it: on an issue already parked,
   the record names the status it left and the history it answered is answered from there. */
const answerPark = async (documentId, ref, context, line) => {
  const lease = leaseOf(context);
  const { comments } = await commentPage(documentId);
  const park = crashedPark(comments);
  if (!park || !parkAnswers(lease, park.left, park.at)) return false;
  await setLease(documentId, claimed(context, { ...parkWrite(lease, line), how: "parked", status: park.left }), ref);
  console.log(`${ref} is parked as crashed for what it did at ${park.left}, and its history now says so.`);
  return true;
};

/* Three writes for one park, and the last says the park was answered: a run that dies between them
   leaves the park owed, so the record is written again only where it did not land. */
const parkCrashed = async (documentId, ref, issue, context, line) => {
  const status = issue.status;
  const lease = leaseOf(context);
  const why = `${reclaimsOf(lease, status)} reclaims of ${status}, so the status and not the run is `
    + `where this dies. Claims at ${status}: ${historyLine(lease, status)}`;
  const view = { documentId, issue };
  const { comments } = await commentPage(documentId);
  const written = crashedPark(comments);
  const stands = written?.left === status && parkAnswers(lease, status, written.at);
  if (stands) await transitionTo(view, PARKS_IN, ref);
  else await parkAs(view, ref, "crashed", why);
  await setLease(documentId, claimed(context, { ...parkWrite(lease, line), how: "parked", status }), ref);
  console.log(`${ref} kept crashing at ${status}. The lease is yours and the issue is a person's.`);
};

export const claim = async (argv) => {
  if (!argv.length || wantsHelp(argv)) return console.log(USAGE);
  const [ref, ...rest] = argv;
  if (ref.startsWith("--")) fail(`claim takes the issue first. ${usageOf("claim")}`);
  const pulled = pullRepeated(rest, "--open", "claim", { usage: USAGE });
  const given = flags(pulled.rest, "claim", ["--pushed", "--review", "--ready", "--take", "--judged"],
    { usage: USAGE });
  const turns = ["ready", "take", "judged", "reconciled"].filter((one) => given[one]);
  if (turns.length > 1) {
    fail(`claim takes one of --ready, --take and --judged and this one takes `
      + `${turns.map((one) => `--${one}`).join(" and ")}: each is a different turn's own move. To end `
      + `this build:\n  forge claim ${ref} --pushed --ready`);
  }
  if (given.ready && !given.pushed) {
    fail(`claim --ready writes the checkpoint off the capture --pushed makes, so the two are typed `
      + `together:\n  forge claim ${ref} --pushed --ready`);
  }
  const asked = minutesFrom(given.minutes);
  const line = nextLine(given.next);
  const patch = patchFrom({ pushed: given.pushed, review: given.review, open: pulled.values });
  const documentId = await documentIdOf(ref);
  const issue = await scoped("forge_issues", { action: "get", documentId, fields: ["sessionContext", "status", "complexity", "plan"] });
  const context = issue?.sessionContext ?? null;
  const lease = leaseOf(context);
  const mine = sessionSourced();
  const holder = sessionOf();
  const state = stateOf(lease, holder);
  const minutes = asked ?? (lease && lease.holder === holder ? lease.minutes : MINUTES);
  const worklog = worklogOf(context);
  if (given.take) {
    const took = await takeTurn(documentId, ref, issue, context, { holder, minutes, line, patch });
    if (sharedHolder(took, mine)) console.log(SHARED_HOLDER);
    return advise(documentId, issue, merged(worklog, patch).worklog);
  }
  if (given.judged) {
    await handBack(documentId, ref, context, holder);
    return advise(documentId, issue, worklog);
  }
  if (given.reconciled) {
    await reconcile(documentId, ref, context, holder, given.reconciled);
    return advise(documentId, issue, worklog);
  }
  if (state === "live") fail(claimRefusal(ref, lease));
  const left = lease?.next ?? null;
  const how = { free: "claim", expired: "reclaim", mine: null, lapsed: null }[state];
  const checkpoint = given.ready ? readyCheckpoint(ref, holder, patch, landingOf(context)) : null;
  const next = claimed(context, {
    holder, at: new Date().toISOString(), minutes, next: line, worklog: worklogFor(context, patch), how, status: issue.status,
    landing: checkpoint ?? undefined,
  });
  await setLease(documentId, next, ref);
  const taken = leaseOf(next);
  console.log(`${ref}  ${how ?? "renewed"}: ${describe(taken)}`);
  if (checkpoint) console.log(`${landingLine(checkpoint)} — taken from here by \`forge claim ${ref} --take\`.`);
  for (const one of nextLines(how, left, taken.next)) console.log(one);
  /* Beside the lease it is about, and above every route out of here: a claim that answers a park
     returns below, and the run would take the lease without being told what it matched on. */
  if (sharedHolder(taken, mine)) console.log(SHARED_HOLDER);
  /* Decided after the write, so what decides is the history this claim has just added to. */
  if (issue.status === PARKS_IN) {
    if (await answerPark(documentId, ref, next, line)) return undefined;
  } else if (parksAsCrashed(taken, issue.status)) {
    return parkCrashed(documentId, ref, issue, next, line);
  }
  if (how === "reclaim") {
    console.log(`Reclaim ${reclaimsOf(taken, issue.status)} of ${issue.status}: `
      + `the one after ${RECLAIMS_BEFORE_PARK} parks the issue as crashed.`);
  }
  return advise(documentId, issue, worklogOf(next));
};
claim.answersHelp = true;
