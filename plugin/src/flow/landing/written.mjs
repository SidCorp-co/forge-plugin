/* The two checkpoints a claim composes rather than moves: the one a build leaves at its push, and
   the one written after the landing by a run that has no push left to leave it at. They sit apart
   from `claim.mjs` because each is the checkpoint's own shape and none of the lease's, and because
   a verb that both composes a record and walks a state table is two files' worth of one name.
   docs/cli/the-checkpoint.md, and docs/cli/the-reconstruction.md for the second. */
import { DERIVED, HAND_WRITTEN, REBUILT_FORM, UNRECOVERABLE } from "./reconstruction.mjs";
import {
  LANDING_BUILDER_OWED, LANDING_DONE, LANDING_HEAD_OWED, LANDING_QA_OWED, LANDING_READY,
  LANDING_RECORDS_OWED, LANDING_STATES, SUPERSEDED, approvedAt, landingAt, notACommit, supersededBy, unjudgedAt,
} from "./checkpoint.mjs";
import { parseAll } from "../record/page.mjs";
import { carriedAtCapture, carriedByLanding } from "../worklog.mjs";
import { fail } from "../../resolve/settings.mjs";
import { sameCommit, shortSha } from "../../tracker/evidence.mjs";
import { commitCarries } from "../../git/carries.mjs";
import { commandAt, valuesOf } from "../machine.mjs";
import { BASELINE_AT, ORDER } from "../earned.mjs";
import { landsAgain, reopenForm } from "../route.mjs";

/* Git licenses this write and the caller's word does not: the one fact it records, that the branch
   this project lands changes on carries the head, is read off refs already in this checkout. Which
   branch that is comes in resolved, the reading being the landing route's own and this file holding
   no policy of its own (ISS-1802). The writer is never the builder, the run reaching for this being
   the one judging the change (ISS-1784); the builder is the one run the claim history names as
   having built it, where it names exactly one (ISS-2608). A finished checkpoint gives way to it,
   and stays on it (ISS-2880). */
export const rebuiltCheckpoint = (ref, holder, head,
  { deployment, undeployed, held, landing, holders, lands }) => {
  if (landing && landing.state !== LANDING_DONE) {
    fail(`claim --rebuilt writes a landing checkpoint where there is none or over one that reads `
      + `\`${LANDING_DONE}\`, and ${ref} reads \`${landing.state}\`: a landing under way, whose remaining `
      + `steps are its own and which a reconstruction would write over. Read where the landing is:\n`
      + `  forge resume ${ref}`);
  }
  /* The read above is what the rest of this file goes by, and it answers `null` for a stored block
     whose state it cannot place as well as for no block at all. Those are not one thing here: the
     second is the case this write is for and the first holds evidence a reconstruction would write
     over, having read none of it (ISS-1784). */
  if (!landing && held && typeof held === "object") {
    fail(`claim --rebuilt writes a landing checkpoint where there is none, and ${ref} holds one whose `
      + `state reads \`${held.state || "nothing at all"}\`, which is no state this version knows. A `
      + `reconstruction over it would replace ${Object.keys(held).sort().join(", ")} with what this `
      + `write could not recover. Read what is on it, and settle the state before asking again:\n`
      + `  forge resume ${ref}`);
  }
  /* One statement about the deployment is owed and the write refuses a silence rather than choosing
     for the caller. Whether a change reached a deployment is a fact about the world no checkout can
     read, and an omitted `--deployment` taken as `there is none` would switch off the citation the
     verdict gate spends at `testing` with nothing on the record saying so. The judge holds either
     value: an identity is what it judged against, and its absence is what it judged without
     (ISS-1993). */
  if (deployment && undeployed) {
    fail(`claim --rebuilt takes one statement about the deployment, and this call names an identity `
      + `and says the change reached none. Type whichever is true:\n`
      + `  ${commandAt(REBUILT_FORM(ref, shortSha(head)), "  ")}`);
  }
  if (!deployment && !undeployed) {
    fail(`claim --rebuilt writes the checkpoint a verdict is judged against, and a verdict cites the `
      + `identity it judged: name the deployment, or say the change reached none and the head is `
      + `what its verdicts answer to:\n  ${commandAt(REBUILT_FORM(ref, shortSha(head)), "  ")}`);
  }
  /* Refused for the reason `blockOf` in checkpoint.mjs gives (ISS-2918). */
  if (notACommit(deployment)) {
    fail(`claim --rebuilt --deployment takes the commit the deployment reports serving, of 7 to 40 hex `
      + `digits, and \`${deployment}\` is not one: a verdict cites a commit, so an identity no commit `
      + `can equal leaves every verdict on ${ref} unearnable. Read the commit off the deployment, then:\n`
      + `  ${commandAt(REBUILT_FORM(ref, shortSha(head)), "  ")}`);
  }
  const read = carriedByLanding(head, lands);
  if (!read.carries) {
    fail(`claim --rebuilt writes a checkpoint on a change the branch it lands on already carries, `
      + `and this checkout cannot prove it carries ${shortSha(head)}: ${read.why}.`
      + `${read.from ? ` That branch is ${read.from}.` : ""} The reading is made `
      + `off refs already here, a claim being one of the writes that may not wait on a remote — and `
      + `where the change is genuinely unlanded what is owed is the capture and not this write. `
      + `${read.route ? "Settle the reading, then ask again" : "Ask from a checkout that can read that history"}:\n`
      + (read.route ? `  ${read.route}\n` : "")
      + `  ${commandAt(REBUILT_FORM(ref, shortSha(head)), "  ")}`);
  }
  const built = builderOf(head, landing, holders);
  if (landing) {
    const refused = supersedeRefused(ref, head, deployment, built.builder, landing);
    if (refused) fail(refused);
  }
  /* Absent and not present-and-empty: the write is compared with what the field reads back, and a
     key carrying `undefined` is one this side holds and the record does not (ISS-1993). */
  return {
    state: LANDING_DONE,
    head,
    ...(built.builder ? { builder: built.builder } : {}),
    ...(deployment ? { deployment } : {}),
    files: [],
    [HAND_WRITTEN]: {
      by: holder,
      at: new Date().toISOString(),
      why: `written after the landing, off ${read.ref} — ${read.from} — at ${shortSha(read.tip)} `
        + `carrying ${shortSha(head)}; ${deployment
          ? "the deployment identity is the caller's and not this checkout's reading"
          : "the caller says the change reached no deployment, so the head is the identity its "
            + "verdicts answer to"}${landing ? `; it supersedes ${replacedSaid(landing)}, kept under \`${SUPERSEDED}\`` : ""}`,
      builder: built.said,
      lost: [...(built.builder ? [] : ["builder"]), "branch", "base", "files", "at"],
    },
    ...(landing ? { [SUPERSEDED]: supersededBy(landing) } : {}),
  };
};

const replacedSaid = (landing) => `the landing ${landingAt(landing)}`;

/* Which builder the late write names, and the sentence that says how it knows. At the head the
   checkpoint it replaces already names, a captured builder is that same change's; otherwise the
   history answers where it names one run and declares nothing where it names several or none. */
const builderOf = (head, landing, holders) => {
  if (landing?.builder && sameCommit(head, landing.head)) {
    return { builder: landing.builder, said: `carried from the checkpoint this one supersedes, which `
      + `names it at this same head` };
  }
  if (holders.length === 1) return { builder: holders[0], said: DERIVED(holders[0]) };
  return { builder: null, said: UNRECOVERABLE(holders) };
};

/* Only forward: a head not carrying the one it replaces has the judging rung read an earlier
   deployment than the one serving, and a write saying what is already there records nothing. */
const supersedeRefused = (ref, head, deployment, builder, landing) => {
  const form = `  ${commandAt(REBUILT_FORM(ref, shortSha(head)), "  ")}`;
  if (sameCommit(head, landing.head ?? "")) {
    const sameDeployment = deployment ? sameCommit(deployment, landing.deployment ?? "") : !landing.deployment;
    if (!sameDeployment || landing.deploymentId || (builder ?? null) !== (landing.builder ?? null)) return null;
    return `claim --rebuilt over the \`${LANDING_DONE}\` checkpoint on ${ref} names the head, the `
      + `deployment and the builder it already holds, so it would record nothing the checkpoint does not `
      + `say. Where the deployment it names is wrong, name the one serving:\n${form}`;
  }
  if (!landing.head) return null;
  const read = commitCarries(landing.head, head);
  if (read.carries) return null;
  const why = read.carries === false
    ? `${shortSha(head)} does not carry ${shortSha(landing.head)}, the head of the landing it would `
      + `replace, so the checkpoint would move backwards and the judging rung would read an earlier `
      + `deployment than the one serving`
    : `this checkout cannot say whether ${shortSha(head)} carries ${shortSha(landing.head)}, the head of `
      + `the landing it would replace: ${read.why}`;
  return `claim --rebuilt over the \`${LANDING_DONE}\` checkpoint on ${ref} records a later landing, and ${why}. `
    + `Name the head the later landing put on the branch:\n${form}`;
};

/* The states a capture writes over: its own, and the three builder's turns a new head answers, each
   licensed by `claim` off the records before this is reached. */
const CAPTURED_OVER = new Set([LANDING_READY, LANDING_HEAD_OWED, LANDING_RECORDS_OWED, LANDING_BUILDER_OWED]);

/* What every other state names instead, one way out apiece, since a refusal naming only the resume
   sends a run to read what this one already knew (ISS-2406). `done` is read on its own below. */
const OUT_OF = {
  [LANDING_QA_OWED]: (ref) => `the turn is the judge's, and it ends with the judge's own hand-back, `
    + `after which the state names whose turn is next:\n  forge claim ${ref} --judged`,
};

const readyRefused = (ref, landing) => {
  const said = `the landing checkpoint on ${ref} reads \`${landing.state}\``;
  const own = OUT_OF[landing.state];
  if (own) return `${said}: ${own(ref, landing)}`;
  if (LANDING_STATES[landing.state]?.turn === "lander") {
    return `${said}, a landing in flight whose next move is the lander's, so --ready would write its `
      + `reading away. A turn it hands back to the builder is named where it stands:\n  forge resume ${ref}`;
  }
  return `${said}, which is past the build, so --ready would write the landing's own reading away. `
    + `Read where it is:\n  forge resume ${ref}`;
};

/* The commits a checkpoint names for the change it landed, any of which a records turn's review may
   have read it at and none of which a later landing merges again: the release, the reconciled
   candidate, the candidate and the branch's head. */
const landedOf = (landing) => [...new Set([landing.intended, landing.reconciled, landing.candidate,
  landing.head].filter(Boolean))];

/** The two routes a second landing of one issue takes out of a finished checkpoint, spelled once for
 *  every refusal that meets `done` at a status that is no rebuild (ISS-2526): a repair already on the
 *  branch is recorded over it, and one still to land starts with the reopen and its own capture. */
export const SECOND_LANDING = (ref, then = "") =>
  `Where the fix already reached the branch it lands on, record that landing over this one, which `
  + `keeps this one readable:\n  ${commandAt(REBUILT_FORM(ref, "<the sha the branch carries>"), "  ")}\n`
  + `Where a finding sends the change back, reopen it, then capture the fix:\n  ${reopenForm(ref)}\n`
  + `  forge claim ${ref} --pushed --ready${then}`;

/* A finished landing gives way to a second one of the same issue, and never a landing in flight: the
   license is the issue's status, which says the change is being built again, and the head has to be
   one that landing did not already merge. The capture then starts the second landing whole, the
   first one's state table being over rather than moved (ISS-2073), and keeps the first under
   `superseded`, the verdicts taken at it being read against its identity (ISS-2526). */
const againRefused = (ref, head, landing, status) => {
  const said = `the landing checkpoint on ${ref} reads \`${LANDING_DONE}\`, a landing that has ended`;
  if (!landsAgain(status)) {
    return `${said}, and ${ref} stands at \`${status || "no status"}\`, which is no rebuild: a second `
      + `landing begins only once the issue goes back to be built again, so --ready here would write `
      + `the finished landing's reading away. ${SECOND_LANDING(ref)}`;
  }
  if (!landedOf(landing).some((one) => sameCommit(one, head))) return null;
  return `${said}, and --ready captures ${shortSha(head)} for a second landing, which is a commit the `
    + `first one already carries, so landing it again merges nothing. Commit the fix on top of it, `
    + `push it, then ask again:\n  forge claim ${ref} --pushed --ready`;
};

/* A landing moves the status on from the one a build stands at and from no earlier one, so a capture
   taken before it arms a merge whose status nothing can then move, and a resume reads a phase this
   checkpoint calls over (ISS-2604). Off the flow's own order: a status it does not place, a reopen or
   a park, is left to the checks that read it. */
const unbuiltRefusal = (ref, status) => {
  const at = ORDER.indexOf(status);
  const built = ORDER.indexOf(BASELINE_AT);
  if (at < 0 || at >= built) return null;
  return `claim --ready arms the landing of a built change, and ${ref} stands at \`${status}\`, `
    + `before \`${BASELINE_AT}\`, the status a build stands at: the landing could move no status of `
    + `it, and a resume would name a phase this checkpoint says is over. Advance it, then capture `
    + `again:\n${ORDER.slice(at + 1, built + 1).map((to) => `  forge advance ${ref} --to ${to}\n`).join("")}`
    + `  forge claim ${ref} --pushed --ready`;
};

/* The opening both refusals of a head the landing branch already holds share. */
const ALREADY = (head) => `claim --ready arms the landing of a change the branch it lands on does `
  + `not carry yet, and that branch already carries ${shortSha(head)}`;

export const readyCheckpoint = (ref, holder, patch, landing, status) => {
  const unbuilt = unbuiltRefusal(ref, status);
  if (unbuilt) fail(unbuilt);
  /* A head that is its own base on the landing branch's line reads alike just cut and landed by a
     fast-forward, so the route out of each is named and the caller, who knows which, takes one: the
     capture the empty-set refusal below asks for is one the second has no push left to take (ISS-2451). */
  if (patch?.head && patch.base === patch.head && carriedAtCapture(patch)) {
    fail(`${ALREADY(patch.head)}, with nothing of this branch's own behind it — what a branch just cut `
      + `and a branch landed by a fast-forward both read. Where this branch's commits are already on `
      + `that branch, the landing happened outside the checkpoint and is written after the fact:\n`
      + `  ${commandAt(REBUILT_FORM(ref, shortSha(patch.head)), "  ")}\n`
      + `Where the branch was just cut, commit the change, push it, then capture again:\n`
      + `  forge claim ${ref} --pushed --ready`);
  }
  if (!patch?.head || !patch.base || !patch.touched) {
    fail(`claim --ready writes the checkpoint off the capture --pushed makes, and this one captured `
      + `no change — the \`--pushed\` line below says why. Capture at the push, before the merge:\n`
      + `  forge claim ${ref} --pushed --ready`);
  }
  /* A head merged into the landing branch captures its own files, so the empty set above lets it through and this is what refuses it (ISS-1862). */
  if (carriedAtCapture(patch)) {
    fail(`${ALREADY(patch.head)}, so no landing is left to arm. A change `
      + `that landed outside the checkpoint is written after the fact:\n`
      + `  ${commandAt(REBUILT_FORM(ref, shortSha(patch.head)), "  ")}`);
  }
  if (landing?.state === LANDING_DONE) {
    const refused = againRefused(ref, patch.head, landing, status);
    if (refused) fail(refused);
  } else if (landing && !CAPTURED_OVER.has(landing.state)) fail(readyRefused(ref, landing));
  /* A capture over a builder's turn is the same landing captured again, so it carries the list on. */
  const kept = landing?.state === LANDING_DONE ? supersededBy(landing) : landing?.[SUPERSEDED] ?? [];
  return {
    state: LANDING_READY,
    builder: holder,
    branch: patch.branch,
    head: patch.head,
    base: patch.base,
    files: String(patch.touched ?? "").split(", ").filter(Boolean),
    at: patch.at,
    ...(kept.length ? { [SUPERSEDED]: kept } : {}),
  };
};

/* What the capture says of itself in the refusal below; `--landed` out of the same state says its own. */
const CAPTURE_SAID = (ref, head) => ({
  out: `claim --ready out of \`${LANDING_HEAD_OWED}\` captures ${shortSha(head)}`,
  why: "the landing merges the head this write names, so it takes a head a review approved and no other",
  again: `forge claim ${ref} --pushed --ready`,
});

/** What refuses the capture out of `head-owed`, or null: the head it takes is one the records judged.
 *  The latest review has to be an approved one of that head, and where the builder is this project's
 *  judge every criterion's latest verdict has to judge that head and not fail — a verdict at the head
 *  the landing handed back describes the commit whose gate went red, and carried to the new one it
 *  would read as a judgement nobody made. Under an independent judge the verdicts are that judge's,
 *  written against a candidate after this capture, so none is asked for here. `view` is `viewFrom`'s. */
export const recaptureRefusal = (ref, head, { latest, verdicts, criteria }, independent, said = CAPTURE_SAID(ref, head)) => {
  const review = latest.review?.record.fields ?? null;
  const ask = `forge record review ${ref} --reviewer codex --commit ${shortSha(head)} `
    + `--outcome ${valuesOf("review", "outcome")}`;
  const { out, why, again } = said;
  if (!approvedAt(head, latest)) {
    const held = review?.commit
      ? `the latest review on ${ref} judged ${shortSha(review.commit)} and says ${review.outcome ?? "nothing"}`
      : `${ref} carries no review`;
    return `${out}, and ${held}: ${why}. Review ${shortSha(head)}, then ask again:\n  ${ask}\n`
      + `  ${again}`;
  }
  if (independent) return null;
  const unjudged = unjudgedAt(head, { verdicts, criteria });
  if (!unjudged.length) return null;
  const at = unjudged.map((number) => {
    const held = verdicts.get(number)?.record.fields;
    return held?.commit ? `${number} at ${shortSha(held.commit)} (${held.verdict})` : `${number} unjudged`;
  });
  return `${out}, and this project's judge is the run that built it, whose verdicts on criterion `
    + `${at.join(", ")} do not pass that head. Judge ${shortSha(head)}, then ask again:\n`
    + `  forge record verdict ${ref} --commit ${shortSha(head)} --evidence <attachment|url|sha> `
    + `--verdict ${valuesOf("verdict", "verdict")}` + unjudged.map((number) => ` --criterion ${number}`).join("")
    + `\n  ${again}`;
};

const candidateOf = (landing) => (landing.candidate ? shortSha(landing.candidate) : "<the candidate's sha>");

/* The reconciliation stays the route for a candidate the builder answers for, so every refusal of the
   other route names it too: a builder reading one route refused should not have to find the second. */
const ANSWER_SAID = (ref, head, landing) => ({
  out: `claim --ready out of \`${LANDING_BUILDER_OWED}\` captures ${shortSha(head)} as the answer to `
    + `the candidate ${candidateOf(landing)}`,
  why: "the landing builds its candidate again from the head this write names, so it takes a head a "
    + "review approved and no other",
  again: `forge claim ${ref} --pushed --ready\nWhere the candidate is answered for as it stands, the `
    + `reading is the answer instead:\n  forge claim ${ref} --reconciled ${candidateOf(landing)}`,
});

/** What refuses the capture out of `builder-owed`, or null. The reading found the candidate wrong,
 *  so the answer is a head of the builder's own and never the one that candidate was built from,
 *  which would build the same candidate again; past that it is held to what the capture out of
 *  `head-owed` asks. `view` is `viewFrom`'s. */
export const answerRefusal = (ref, head, landing, view, independent) => {
  const said = ANSWER_SAID(ref, head, landing);
  if (sameCommit(head, landing.head)) {
    return `${said.out}, which is the head that candidate was built from, so capturing it again `
      + `answers nothing the reading found. Where the candidate is answered for as it stands, say so; `
      + `where it is wrong, commit the answer, review that head${independent ? "" : " and judge it"}, `
      + `push it, then capture it:\n  forge claim ${ref} --reconciled ${candidateOf(landing)}\n`
      + `  forge claim ${ref} --pushed --ready`;
  }
  return recaptureRefusal(ref, head, view, independent, said);
};

const reviewsOf = (comments) => comments
  .flatMap((one) => parseAll(one.body ?? "").map((record) => ({ at: one.createdAt ?? "", record })))
  .filter((one) => one.record.kind === "review")
  .sort((a, b) => a.at.localeCompare(b.at));

const REWORK_SAID = (ref, head) => ({
  out: `claim --ready out of \`${LANDING_RECORDS_OWED}\` captures ${shortSha(head)} for a second landing`,
  why: "the landing merges the head this write names, so it takes a head a review approved and no other",
  again: `forge claim ${ref} --pushed --ready`,
});

/** What refuses the capture out of `records-owed`, or null. The turn goes back to the build only
 *  where its review found the landed change short: the latest review of any commit the checkpoint
 *  names for that change says `changes-requested`. The head it takes is none of those commits, a
 *  second landing of one merging nothing, and is held to what the capture out of `head-owed` asks.
 *  `view` is `viewFrom`'s. */
export const reworkRefusal = (ref, head, landing, view, independent) => {
  const landed = landedOf(landing);
  const said = REWORK_SAID(ref, head);
  if (landed.some((one) => sameCommit(one, head))) {
    return `${said.out}, which is a commit the first landing already carries, so landing it again `
      + `merges nothing. Commit the fix on top of it, review that head`
      + `${independent ? "" : " and judge it"}, push it, then ask again:\n  ${said.again}`;
  }
  const asked = reviewsOf(view.comments ?? [])
    .filter((one) => landed.some((sha) => sameCommit(one.record.fields.commit, sha)))
    .at(-1)?.record.fields ?? null;
  if (asked?.outcome !== "changes-requested") {
    const held = asked
      ? `the latest review of the landed change, at ${shortSha(asked.commit)}, says ${asked.outcome ?? "nothing"}`
      : `no review on ${ref} reads the landed change at ${landed.map(shortSha).join(", ")}`;
    return `${said.out}, and ${held}: a records turn goes back to the build only where its review `
      + `found the landed change short. Where the records are written, hand the turn back:\n`
      + `  forge claim ${ref} --recorded\n`
      + `Where the landed change is short, say so at the commit that landed, then ask again:\n`
      + `  forge record review ${ref} --reviewer codex --commit ${shortSha(landed[0])} --outcome changes-requested\n`
      + `  ${said.again}`;
  }
  return recaptureRefusal(ref, head, view, independent, said);
};
