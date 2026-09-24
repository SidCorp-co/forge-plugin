/* The pick: the lease a run takes before it writes anything, the reclaim of one a dead run left
   behind, and the park a status that keeps crashing earns. docs/cli/claim.md. */
import { flags, pullRepeated, wantsHelp } from "../resolve/flags.mjs";
import { MINTED, sessionOf, sessionSourced } from "../resolve/config.mjs";
import { fail } from "../resolve/settings.mjs";
import { usageOf } from "../resolve/visibility.mjs";
import { documentIdOf } from "../tracker/issues.mjs";
import { scoped } from "../tracker/rest.mjs";
import { judgementOf, landsOn, releasePolicy } from "../tracker/project-config.mjs";
import { INDEPENDENT } from "./qa/verdicts.mjs";
import { commentPage, cutIn, mustBeShown } from "../tracker/comments.mjs";
import { isCommit, sameCommit, shortSha } from "../tracker/evidence.mjs";
import { rungOf } from "../ladder.mjs";
import { namedIn, rungFieldsOf, viewFrom } from "./earned.mjs";
import { scopeFrom } from "./record/plan-scope.mjs";
import { laneLines, openingLines, workLines } from "../guides/phases.mjs";
import { partForStatus } from "../guides/served.mjs";
import { kindsHeld, parse } from "./record/page.mjs";
import { parkAs, transitionTo } from "./advance.mjs";
import { buildsAt } from "./earned.mjs";
import { OPEN_KEPT, droppedHead, merged, patchFrom, saidWritten, worklogFor, worklogOf, workNow } from "./worklog.mjs";
import {
  LANDING_BUILDER_OWED,
  LANDING_HEAD_OWED,
  LANDING_JUDGED,
  LANDING_MARKED,
  LANDING_QA_OWED,
  LANDING_RECONCILED,
  LANDING_RECORDS_OWED,
  LANDING,
  landingLine,
  takeRoute,
  landingOf,
} from "./landing/checkpoint.mjs";
import { REBUILT_FORM, handWrittenOf, holdersOf } from "./landing/reconstruction.mjs";
import { readyCheckpoint, rebuiltCheckpoint, recaptureRefusal, reworkRefusal } from "./landing/written.mjs";
import { finishLanded } from "./landing/landed.mjs";
import {
  MECHANISM,
  MINUTES,
  MINUTES_ASKS,
  RECLAIM,
  STOPPED,
  UNHELD,
  anybodysAt,
  LAPSE_FRESH,
  LAPSE_UNORDERED,
  claimRefusal,
  claimed,
  describe,
  expiryOf,
  freeRefusal,
  heldBy,
  landingSaved,
  lapseUnproven,
  leaseOf,
  nextLeft,
  nextLine,
  nothingWorked,
  oweRelease,
  readContext,
  reclaimRefusal,
  setLease,
  stateOf,
  takeableFree,
  writeRefusal, HANDED,
  unheldRefusal,
} from "./lease.mjs";
import {
  RECLAIMS_BEFORE_PARK, historyLine, parkAnswers, parksAsCrashed, reclaimsOf,
} from "./lease/crash-park.mjs";
import { takeLease, takeRefusal } from "./lease/takeover.mjs";
import { SHARED_HOLDER, handedOn, handedSaid, notHandedHere, sharedHolder } from "./lease/dispatched.mjs";
import { holderGoneSaid, workUnder } from "./lease/holder.mjs";
import { workingRefusal } from "./lease/working.mjs";
import { bandWith, straddleSaid, straddles, unplaceable } from "../wire/shared-clock.mjs";

const MAX_MINUTES = 24 * 60;
const PARKS_IN = "on_hold";

/* Beside the advisory rather than above the lease line: both are what the run does next, where the lines above are what this write did. A claim opens a phase's work, so the part is the one its status owes. */
/* And the opening above both, because a run handed an issue past `open` redoes the phases behind it otherwise, through the renderer `forge resume` prints so the two cannot say different things about one record. Both printers are exported so a case reads what each verb prints rather than what that renderer returns, a renderer nobody prints passing every case that asks it for lines (ISS-804). */
export const advisory = (status, fields, held, work = null) => {
  for (const line of openingLines(status, held, work)) console.log(line);
  console.log("");
  for (const line of laneLines({ status, fields })) console.log(line);
  console.log(`\n${MECHANISM} ${heldBy()}`);
  partForStatus(status, (part) => console.log(`\n${part}`), rungOf(fields));
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
  scopeFrom(issue.status, issue.issueId, namedIn(view));
  return advisory(issue.status, rungFieldsOf(view), kindsHeld(view), work);
};

export const USAGE = [
  usageOf("claim"),
  "The lease on an issue, in the session field it already has: a holder, a renew time, a",
  "duration and the claims before this one. Nothing else of a run is remembered.",
  "",
  `  --minutes <n>   how long the lease runs from now, instead of ${MINUTES}`,
  `  ${STOPPED}       a lapse, or work in this tree: the run the lease established stopped`,
  `  ${UNHELD}        no run is on it: take it anyway`,
  "  --next <line>   one line, the step whoever comes next starts on; a transition clears it",
  "  --pushed        the branch, head, base and files touched, off git now",
  "  --review        the last codex consult, its findings and what it owes, off the log",
  `  --open <line>   a scratch decision or a dead end, appended; past ${OPEN_KEPT} the oldest goes`,
  "  --ready         with --pushed: `ready`, from `head-owed`, `records-owed` too",
  "  --take          the lease where the checkpoint names your turn",
  "  --judged        the QA turn handed back, from `qa-owed` or from none, and the lease with it",
  "  --reconciled <sha>  the builder's turn handed back, from `builder-owed` at that sha",
  "  --recorded      the records turn handed back, from `records-owed`",
  "  --landed        the landing over, from `ready` or `head-owed`: base has the head",
  "  --rebuilt sha --deployment id|--undeployed  a late checkpoint",
  "",
  "--pushed, --review and --open write the worklog beside the lease, which `forge resume` reads",
  "first; no capture is automatic. What a checkpoint holds: docs/cli/the-checkpoint.md.",
  "",
  nothingWorked(),
  "",
  MINUTES_ASKS,
  "",
  MECHANISM,
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
  ({ holder: lease.holder, minutes: lease.minutes, next: next ?? null });

/* The line taken over from is not the line taken on: printing the incoming one as the last
   holder's would say the dead run left a note its successor wrote. A take is a handoff too, and so
   is a claim on a field that lost its holder and kept the line. */
export const HANDOFF = new Set(["reclaim", "take", "handed", "unheld"]);

/* The word a claim's grant line prints under, by the state of the lease it found; a state naming none
   prints RENEWED. The eval joins a run to its issue by these words and no others, so the suite holds
   every one of them to the list that join counts. */
export const RENEWED = "renewed";
export const howsFor = ({ unheld, handed }) => ({ free: unheld ? "unheld" : "claim", live: HANDED,
  expired: RECLAIM, gone: handed ? HANDED : RECLAIM, mine: null, lapsed: null });

export const nextLines = (how, left, taken) => [
  HANDOFF.has(how) && left ? `Next, left by the run before: ${left}` : null,
  taken && taken !== left ? `Next: ${taken}` : null,
].filter(Boolean);

/* Off the same capture the worklog took, so the head the checkpoint calls judged is the head the review was
   taken at. The paths and not the count: what the lander compares with what the landing moved is a list, and
   a capture that read no diff is a checkpoint nobody can land, which is why the guard reads the diff. */
/* The hand-back of a judge whose verdicts came before any landing, the ordinary case wherever a deployment is judged rather than a merge: there is no checkpoint, so there is no turn to move and none is written, and the lease is the whole of what such a judge is holding. The lease is read here because no landing write follows to read it, and a caller holding nothing is owed the claim that takes the issue rather than a release that would free another run's (ISS-1429). */
const handBackUnlanded = async (documentId, ref, status, context, holder) => {
  const lease = leaseOf(context);
  const state = stateOf(lease, holder);
  if (state === "free") fail(freeRefusal(ref, status, context));
  if (state !== "mine" && state !== "lapsed") fail(writeRefusal(state, ref, lease));
  /* The one arm that queues the give-back having written nothing before it, so the settling write skips the check every other write of this process has already spent (ISS-1715). */
  await mustBeShown([{ ref, documentId }]);
  oweRelease(documentId, ref);
  console.log(`${ref}  judged: no landing checkpoint, so no turn was moved and none was written.`);
  return console.log(`The verdicts on the record are the judgement, so nothing more of ${ref} is `
    + `this run's. The lease goes back as this call ends, and the run after it claims with no wait.`);
};

/* The one route out of `qa-owed`, and the reason the state is not a dead end: the judge writes its
   verdicts as any run does and then says the turn is over, which is all this writes. What those
   verdicts have to carry is the contract's at `testing` and not this claim's to re-judge — a judge
   refused here could neither hand back nor be replaced. docs/cli/the-checkpoint.md. */
const handBack = async (documentId, ref, status, context, holder) => {
  const landing = landingOf(context);
  if (!landing) return handBackUnlanded(documentId, ref, status, context, holder);
  if (landing.state !== LANDING_QA_OWED) {
    fail(`claim --judged ends the QA turn, and the landing checkpoint on ${ref} reads `
      + `\`${landing.state}\`: the turn is handed back from \`${LANDING_QA_OWED}\` `
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
  oweRelease(documentId, ref);
  console.log(`${ref}  judged: ${landingLine(saved)}`);
  return console.log(`The verdicts on the record are the judgement, so nothing more of ${ref} is `
    + `this run's. The lease goes back as this call ends, and the landing takes it from here:\n`
    + `  ${takeRoute(ref)}`);
};

/* The other route out, the same shape as the hand-back above. What is its own is the sha: the
   candidate the checkpoint names proves which one was read rather than the run's word for it. Seven
   digits or forty, the checkpoint's own string stored, since the promotion compares that. */
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
  /* After the independence check and not before it: the push this names is the builder's own to
     make, and a run the state does not license is owed whose turn it is. docs/cli/the-takeover.md. */
  const gone = droppedHead(landing.branch, landing.head);
  if (gone?.dropped) {
    fail(`${landing.branch} no longer carries ${shortSha(landing.head)}, the head this landing was `
      + `judged at: in this checkout that branch stands at ${shortSha(gone.tip)}, which does not `
      + `reach it. What lands is the judged head, so moving the branch changes nothing the landing `
      + `merges and orphans the commit it fetches. Put that head back, from whichever tree holds it, `
      + `then read the branch here again — this refusal is off the ref below and a push made in `
      + `another checkout leaves it saying what it says now:\n`
      + `  git push --force-with-lease=${landing.branch}:${gone.tip} origin `
      + `${landing.head}:refs/heads/${landing.branch}\n`
      + `  git fetch origin ${landing.branch}\n`
      + `  forge claim ${ref} --reconciled ${landing.candidate}`);
  }
  const saved = await landingSaved(documentId, ref,
    { state: LANDING_RECONCILED, reconciled: landing.candidate });
  console.log(`${ref}  reconciled: ${landingLine(saved)}`);
  return console.log(`The candidate ${shortSha(landing.candidate)} is what this run says it read, `
    + `and the landing promotes that commit and no other, so nothing more of ${ref} is this run's. `
    + `The landing takes it from here:\n  ${takeRoute(ref)}`);
};

/* The two states a records turn returns to, written out one apiece rather than composed, because the
   table that reads which states a verb writes reads the source for the state's own spelling and a
   name assembled at run time is a state it cannot see. The `owed` field is cleared with the move: it
   answers where this turn came from and nothing once the turn is over. */
const RETURNS = {
  [LANDING_MARKED]: { state: LANDING_MARKED, owed: "" },
  [LANDING_JUDGED]: { state: LANDING_JUDGED, owed: "" },
};

/* The third route out, the same shape as the two above. It reads no record back — a hand-back its own
   holder could be refused is a state nobody can leave — so an empty one is the walk's. the-turn.md. */
const handRecords = async (documentId, ref, context, holder) => {
  const landing = landingOf(context);
  if (landing?.state !== LANDING_RECORDS_OWED) {
    fail(`claim --recorded ends the builder's records turn, and the landing checkpoint on ${ref} `
      + `reads \`${landing?.state ?? "nothing at all"}\`: the turn is handed back from `
      + `\`${LANDING_RECORDS_OWED}\` and from no other state. Read where the landing is:\n`
      + `  forge resume ${ref}`);
  }
  const back = RETURNS[landing.owed];
  if (!back) {
    fail(`the checkpoint on ${ref} reads \`${LANDING_RECORDS_OWED}\` and names `
      + `\`${landing.owed || "nothing at all"}\` as the state the turn came from, which is not one `
      + `a landing hands records back from. Read where the landing is:\n  forge resume ${ref}`);
  }
  /* The lander that offered this turn still holds the lease it wrote the offer under, so state alone
     would let it take the turn back before the builder had answered a thing. */
  const mine = sessionSourced();
  const refused = takeRefusal(ref, landing, holder, leaseOf(context),
    { source: mine.id === holder ? mine.source : null });
  if (refused) fail(refused);
  const saved = await landingSaved(documentId, ref, back);
  console.log(`${ref}  recorded: ${landingLine(saved)}`);
  return console.log(`The records this turn was handed back for are on the issue, so nothing more `
    + `of ${ref} is this run's. The landing takes it from here:\n  ${takeRoute(ref)}`);
};

/* The turn is read before anything is written, because this is the one claim that may take a live
   lease: a take the state does not name is refused and no field is touched. */
const takeTurn = async (documentId, ref, issue, context, { holder, source, minutes, line, patch }) => {
  const landing = landingOf(context);
  const left = leaseOf(context)?.next ?? null;
  const taken = await takeLease(documentId, ref, context, { holder, minutes, line, patch, status: issue.status });
  console.log(`${ref}  take: ${describe(taken, source)}`);
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
  await setLease(documentId, claimed(context, { ...parkWrite(lease, line), how: "parked", status: park.left }), ref,
    () => context);
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
  /* Read again: both branches above renew the lease, so the context this call arrived with is a value the field no longer holds. Building the acknowledgement on it would write the renewal back out of the record, and conditioning it on that value is a refusal this run earns against itself. And judged again on what came back, because a read is not a claim: a run that took the issue while this one was transitioning would otherwise have its own holder written back to it under a precondition that matches, and be told the lease is somebody else's. */
  const held = await readContext(documentId);
  const now = leaseOf(held);
  const state = stateOf(now, sessionOf());
  if (state !== "mine" && state !== "lapsed") fail(writeRefusal(state, ref, now));
  await setLease(documentId,
    claimed(held, { ...parkWrite(now, line), how: "parked", status }), ref, () => held);
  console.log(`${ref} kept crashing at ${status}. The lease is yours and the issue is a person's.`);
};

export const claim = async (argv) => {
  if (!argv.length || wantsHelp(argv)) return console.log(USAGE);
  const [ref, ...rest] = argv;
  if (ref.startsWith("--")) fail(`claim takes the issue first. ${usageOf("claim")}`);
  const pulled = pullRepeated(rest, "--open", "claim", { usage: USAGE });
  const given = flags(pulled.rest, "claim",
    ["--pushed", "--review", "--ready", "--take", "--judged", "--recorded", "--landed", "--undeployed",
      STOPPED, UNHELD],
    { usage: USAGE });
  /* Read where it is written or refused where it is not: both say what the checkpoint `--rebuilt`
     writes holds about the deployment, and a call writing no checkpoint has nowhere to put either
     (ISS-1993). */
  const aboutDeployment = ["deployment", "undeployed"].filter((one) => given[one]);
  if (aboutDeployment.length && !given.rebuilt) {
    fail(`claim ${aboutDeployment.map((one) => `--${one}`).join(" and ")} says what the checkpoint `
      + `--rebuilt writes holds about the deployment, and this call writes no checkpoint: the two `
      + `are typed together:\n  ${REBUILT_FORM(ref, "<the sha the branch carries>", "\n  ")}`);
  }
  const turns = ["ready", "take", "judged", "reconciled", "recorded", "landed", "rebuilt"]
    .filter((one) => given[one]);
  if (turns.length > 1) {
    fail(`claim takes one of --ready, --take, --judged, --reconciled, --recorded, --landed and --rebuilt and this one takes `
      + `${turns.map((one) => `--${one}`).join(" and ")}: each is a different turn's own move. To end `
      + `this build:\n  forge claim ${ref} --pushed --ready`);
  }
  if (given.ready && !given.pushed) {
    fail(`claim --ready writes the checkpoint off the capture --pushed makes, so the two are typed `
      + `together:\n  forge claim ${ref} --pushed --ready`);
  }
  const asked = minutesFrom(given.minutes);
  const line = nextLine(given.next);
  const patch = await patchFrom({ pushed: given.pushed, review: given.review, open: pulled.values });
  const documentId = await documentIdOf(ref);
  const issue = await scoped("forge_issues", { action: "get", documentId, fields: [] });
  const context = issue?.sessionContext ?? null;
  const lease = leaseOf(context);
  const mine = sessionSourced();
  const holder = sessionOf();
  const source = mine.id === holder ? mine.source : MINTED;
  const state = stateOf(lease, holder, undefined, { asserted: given.stopped });
  const minutes = asked ?? (lease && lease.holder === holder ? lease.minutes : MINUTES);
  const worklog = worklogOf(context);
  /* Above every route out of here, including the five turns below, because what each of the two qualifies is the state those routes read and a claim told afterwards has already been answered on it: the band is the moment the two clocks cannot order, and the work standing in the lease's own tree is the thing no state of the record reports. That work is also the half of the gone reading `--stopped` settles, read into the state above: a flag that cleared only this refusal would leave the caller at a live lease it has no route to (ISS-1903). */
  const band = bandWith(lease?.slack);
  const expiry = lease ? expiryOf(lease) : 0;
  const anybodys = lease ? anybodysAt(lease) : 0;
  const working = lease ? workUnder(lease) ?? [] : [];
  if (lease) {
    const untold = unplaceable(lease.slack)
      ?? (straddles(expiry, band) ? straddleSaid(`the expiry of the lease on ${ref}`, expiry, band) : null);
    if (untold) console.error(untold);
  }
  if (working.length && !given.stopped) fail(workingRefusal(ref, lease, working));
  if (given.take) {
    const took = await takeTurn(documentId, ref, issue, context, { holder, source, minutes, line, patch });
    if (sharedHolder(took, mine)) console.log(SHARED_HOLDER);
    return advise(documentId, issue, merged(worklog, patch).worklog);
  }
  if (given.judged) {
    await handBack(documentId, ref, issue.status, context, holder);
    return advise(documentId, issue, worklog);
  }
  if (given.reconciled) {
    await reconcile(documentId, ref, context, holder, given.reconciled);
    return advise(documentId, issue, worklog);
  }
  if (given.recorded) {
    await handRecords(documentId, ref, context, holder);
    return advise(documentId, issue, worklog);
  }
  if (given.landed) {
    await finishLanded(documentId, ref, issue, context);
    return advise(documentId, issue, worklog);
  }
  /* The issue's own key and never the caller's spelling of it: `documentIdOf` takes a uuid too, and
     a run refused for how it typed the reference is refused by nothing on the record (codex F1). */
  const key = issue.issueId ?? ref;
  const handed = handedOn(key, context, issue.status, holder);
  /* Read once for both refusals below: where the checkpoint names this caller's turn, `--take` is
     open and is the route that asserts nothing about the run being taken from (ISS-1600). */
  const mineHere = sessionSourced();
  const landingHere = landingOf(context);
  const takeOpen = landingHere && !takeRefusal(ref, landingHere, holder, lease,
    { source: mineHere.id === holder ? mineHere.source : null, taking: true })
    ? takeRoute(ref)
    : null;
  if (state === "live" && !handed) {
    fail(claimRefusal(ref, lease, notHandedHere(ref, key, context, issue.status, holder), takeOpen));
  }
  /* The anomaly and not the flag: a field with no lease in it, at a status only a run's own writes reach. Named here so the refusal and the word the history keeps cannot come to disagree about which claim was the anomalous one. A field a write gave the lease back in is none of the readings that anomaly stands for — one write emptied it on purpose and said so — so it is an ordinary claim wherever the issue stands (ISS-1617). */
  const unheld = state === "free" && !takeableFree(issue.status, context);
  if (unheld && !given.unheld) {
    fail(unheldRefusal(ref, issue.status,
      { next: nextLeft(context), work: workLines(workNow(worklog)) }));
  }
  /* One reading, two sentences: the first owns the lapse the record can tell is fresh and the second only the lapse read as stale that cannot be ruled fresh, which is the direction that takes an issue off a working run (ISS-1212). */
  const unproven = state === "expired" && !given.stopped && !handed ? lapseUnproven(lease, { band }) : "";
  if (unproven === LAPSE_FRESH) fail(reclaimRefusal(ref, lease, undefined, takeOpen));
  if (unproven === LAPSE_UNORDERED) {
    fail(`${straddleSaid(`the moment the lease on ${ref} becomes anybody's`, anybodys, band)} `
      + `Until then this reclaim would take the issue off ${describe(lease)}. Where you have `
      + `established that run stopped, say so:\n  forge claim ${ref} ${STOPPED}`);
  }
  /* Before the write and after every refusal of the lease, so a caller the lease turns away is told that first; a capture that read no head is `readyCheckpoint`'s to refuse. */
  if (given.ready && patch?.head && [LANDING_HEAD_OWED, LANDING_RECORDS_OWED].includes(landingHere?.state)) {
    const view = viewFrom(documentId, issue, (await commentPage(documentId)).comments ?? []);
    const independent = judgementOf(await releasePolicy()) === INDEPENDENT;
    const refused = landingHere.state === LANDING_HEAD_OWED
      ? recaptureRefusal(ref, patch.head, view, independent)
      : reworkRefusal(ref, patch.head, landingHere, view, independent);
    if (refused) fail(refused);
  }
  /* Off the remnant where there is no lease to read it from, so the flag that clears the refusal is not the way to lose the one line the refusal just printed. */
  const left = lease?.next ?? nextLeft(context);
  /* A gone holder is a reclaim like any other, so the park counting reclaims of one status keeps counting the runs that died there — except where the record already calls the take a handoff, the dispatcher that exited being the one holder whose going is not a crash of this issue's (ISS-919). */
  const how = howsFor({ unheld, handed })[state];
  const checkpoint = given.ready
    ? readyCheckpoint(ref, holder, patch, landingOf(context))
    : (given.rebuilt
      ? rebuiltCheckpoint(ref, holder, given.rebuilt, {
        deployment: given.deployment,
        undeployed: given.undeployed,
        held: context?.[LANDING] ?? null,
        landing: landingOf(context),
        holders: holdersOf(context, buildsAt),
        lands: landsOn(await releasePolicy()),
      })
      : null);
  const next = claimed(context, {
    holder, minutes, next: line, worklog: worklogFor(context, patch), how, status: issue.status,
    landing: checkpoint ?? undefined,
  });
  await setLease(documentId, next, ref, () => context);
  saidWritten(patch);
  const taken = leaseOf(next);
  console.log(`${ref}  ${how ?? RENEWED}: ${describe(taken, source)}`);
  if (state === "live") console.log(handedSaid(ref, lease));
  if (state === "gone") console.log(holderGoneSaid(lease, undefined, { asserted: given.stopped }));
  if (checkpoint) console.log(`${landingLine(checkpoint)} — taken from here by \`${takeRoute(ref)}\`.`);
  /* Off the block the write itself composed rather than a second reading of the same refs, so the
     line this run reads and the account a later one reads back are one sentence (ISS-1802). */
  const account = handWrittenOf(checkpoint)?.why;
  if (account) console.log(`What licensed it: ${account}.`);
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
  if (how === RECLAIM) {
    console.log(`Reclaim ${reclaimsOf(taken, issue.status)} of ${issue.status}: `
      + `the one after ${RECLAIMS_BEFORE_PARK} parks the issue as crashed.`);
  }
  return advise(documentId, issue, worklogOf(next));
};
claim.answersHelp = true;
