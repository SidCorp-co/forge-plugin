/* What an issue's record earns: the contract's flow table, one entry check per status, and the
   record read whole into one object. The verb that spends this is advance.mjs; nothing here
   writes, fetches or reads the repository. What it checks against is the contract's table for that
   status, printed by `forge guide contract`. */
import {
  FINDINGS, SHAPES, TRIAGES, judgedHead, landingMoved, lightens, looksTo, markedCommit, planFlags,
  reviewedHead, sizeReport, unwrap,
} from "./machine.mjs";
import { attachmentNames, evidenceHeld, isCommit } from "../tracker/evidence.mjs";
import { SIZE_LINE, isFix } from "../tracker/issue-shape.mjs";
import { Refused, assemble, criteriaLines, parse } from "./record.mjs";
import { CONTRACT } from "../guides/contract.mjs";
import { waitsForPerson } from "../tracker/project-config.mjs";

/* The contract's flow table in its own order: the sequence is the rule, so listing it is the point. */
export const ORDER = [
  "open", "confirmed", "clarified", "approved", "in_progress", "developed", "tested", "released", "closed",
];

/* The flow table's last column: which phase a status owes, and where its method lives — the
   reference the phase cites, or null where the body itself carries the phase. ISS-18 owns typing
   it; a pointer beats a number nobody can look up. */
export const PHASE = {
  open: ["1 Triage", null],
  confirmed: ["2 Clarify", null],
  clarified: ["3 Plan", null],
  approved: ["4 Implement, to the branch", "verification"],
  in_progress: ["4 Implement, to the review; 5 Prove; then 7's landing", "verification"],
  developed: ["5 Prove", "verification"],
  tested: ["6, 7 Ship", null],
  released: ["7 Ship, the close", null],
  closed: ["none", "learning"],
  dropped: ["none", "learning"],
  reopen: ["1 Triage, of the person's finding", null],
};

export const methodOf = (status) => {
  const held = PHASE[status];
  if (!held) return null;
  return { phase: held[0], reference: held[1] ? `forge guide issue-flow ${held[1]}` : "forge guide issue-flow" };
};

/* Which reader each park kind speaks to, and so which side status it lands in. Every kind in PARKS
   has a row: a park with nowhere to go is a status set from nothing. */
export const PARK_STATUS = {
  question: "needs_info",
  "screen-review": "waiting",
  "destructive-migration": "waiting",
  "release-decision": "waiting",
  "code-review": "waiting",
  "rolled-back": "on_hold",
  "no-way-back": "on_hold",
  unshippable: "on_hold",
  blocked: "on_hold",
  paused: "on_hold",
  crashed: "on_hold",
  dropped: "dropped",
};

export const SIDE = ["needs_info", "waiting", "on_hold"];

export const atLeast = (status, floor) =>
  ORDER.indexOf(status) >= 0 && ORDER.indexOf(status) >= ORDER.indexOf(floor);

/* A verdict may name seven digits where a mark's note names forty, so the shorter one decides. */
export const sameCommit = (one, two) => {
  const [left, right] = [one, two].map((held) => String(held ?? "").trim().toLowerCase());
  if (left.length < 7 || right.length < 7) return false;
  const width = Math.min(left.length, right.length);
  return left.slice(0, width) === right.slice(0, width);
};

/* `parse` resolves the keys and applies none of the shape's rules, so a comment carrying the tag and
   little else — by hand, or through a client no gate sits before — is measured against the write's
   own rules here: every field, the stamp the write reads off the issue, the evidence, the contract.
   A commit that is not one compares equal to a short sha by prefix, which is why the form counts. */
export const shapeGaps = (kind, record, names = []) => {
  const shape = SHAPES[kind];
  const got = Object.fromEntries(shape.fields.map((field) =>
    [field.flag, field.many ? record.fields[field.flag] ?? [] : record.fields[field.flag]]));
  const gaps = shape.fields
    .filter((field) => {
      const held = got[field.flag];
      if (field.many) return held.length < (field.least ?? 1);
      if (held === undefined) return !field.optional;
      return Boolean(field.oneOf) && !field.oneOf.includes(held);
    })
    .map((field) => `--${field.flag}`);
  for (const field of shape.fields.filter((one) => !one.many)) {
    const held = got[field.flag];
    if (held === undefined) continue;
    if (field.commit && !isCommit(held)) gaps.push(`--${field.flag} \`${held}\`, which is no commit`);
    if (field.criterion && !/^\d+\b/u.test(held)) gaps.push(`--${field.flag} \`${held}\`, which opens with no number`);
  }
  if (shape.stamp && record.fields[shape.stamp.flag] === undefined) gaps.push(`its ${shape.stamp.label} stamp`);
  if (!(record.contract >= 1 && record.contract <= CONTRACT)) {
    return [...gaps, `a contract ${record.contract} record, and this build reads contract 1 to ${CONTRACT}`];
  }
  for (const field of shape.fields.filter((one) => one.evidence)) {
    for (const ref of got[field.flag]) {
      if (!evidenceHeld(ref, names)) gaps.push(`--${field.flag} \`${ref}\`, which is no attachment here, no URL and no commit`);
    }
  }
  const said = shape.check?.(got);
  return said ? [...gaps, said] : gaps;
};

export const criteriaOf = (issue) => {
  try {
    return criteriaLines(unwrap(issue.acceptanceCriteria));
  } catch (error) {
    if (error instanceof Refused) return [];
    throw error;
  }
};

/* Whole first: `dropped` has no checks of its own, so a confirmation carrying the finding and
   nothing else would drop an issue on one line. */
export const dispositionOf = (view) => {
  const held = view.latest?.confirmation;
  if (!held || shapeGaps("confirmation", held.record, view.names ?? []).length) return null;
  const finding = held.record.fields.finding;
  return FINDINGS.includes(finding) && finding !== "holds" ? finding : null;
};

export const nextOf = (status, view) => {
  if (status === "confirmed" && dispositionOf(view)) return "dropped";
  const at = ORDER.indexOf(status);
  return at < 0 || at === ORDER.length - 1 ? null : ORDER[at + 1];
};

export const need = (what, command) => ({ what, command });

/* The park is a look at the evidence either way, which the project's own policy may say it does
   not want: the declaration is the plan's and whether a person is waited for is the project's. */
export const personLooks = (flags, policy = null) =>
  (policy && !waitsForPerson(policy) ? null : looksTo(flags));

/* Every correction, not the latest: the kind does not repeat, so a plan one erases a re-size (ISS-161). */
const sizeOf = (view) => ({
  fix: Boolean(view.fix),
  plan: unwrap(view.issue.plan),
  moved: view.comments
    .map((one) => parse(one.body ?? ""))
    .filter((one) => one?.kind === "correction" && !shapeGaps("correction", one, view.names).length)
    .map((one) => one.fields.moved),
  mark: SIZE_LINE,
  whole: view.whole !== false,
});

export const lightPath = (view, status) => lightens(status, sizeOf(view));
export const fixReport = (view, ref) => sizeReport(sizeOf(view), ref);

const markCall = (documentId) =>
  `forge call forge_issues '{"action":"mark_merged","data":{"issueId":"${documentId}",`
  + `"target":"base","note":"merged to <branch> at <sha>; reviewed head <sha>; judged head <sha>; `
  + `landing moved <the paths of this change the landing moved, or the word nothing>"}}'`;
export const transitionCall = (documentId, status) =>
  `forge call forge_issues '{"action":"transition","documentId":"${documentId}","data":{"status":"${status}"}}'`;

/* The tracker answers this on the edge itself, so the check reads the edge rather than inferring an
   order from the list it arrived in: `relations.blockedBy` carries mentions beside orderings. `kind`
   is the fallback where no such field came, and an edge carrying neither came from somewhere else. */
const gatesDispatch = (edge) =>
  edge.gatesDispatch === undefined ? edge.kind === "blocks" : edge.gatesDispatch === true;

/* The tracker gates on a merged mark and this contract's floor is `developed`, so the status is a
   second and independent test. One exported answer, so no screen can derive a different one. */
export const holdsBack = (edge) => gatesDispatch(edge) && !atLeast(edge.otherStatus, "developed");

/* Named in the refusal: an ordering constraint and a mention read alike on a line of their own. */
const edgeKind = (edge) => (edge.kind ? `a ${edge.kind} edge` : "an edge whose kind the tracker did not name");

export const blockersOwed = ({ issue }) =>
  (issue.relations?.blockedBy ?? [])
    .filter(holdsBack)
    .map((one) =>
      need(
        `${one.otherDisplayId} gates this by ${edgeKind(one)} and is ${one.otherStatus}, which is not yet developed`,
        `forge advance ${one.otherDisplayId}`,
      ),
    );

/* One shape, four answers: absent, rewritten, present but not a whole payload, or there to be read.
   A rewritten record is named as itself rather than as the fields it appears to lack: the write
   supplied them, and a list of flags to re-supply sends the author back to a command that worked. */
export const payloadOwed = (view, kind, what, ask) => {
  const held = view.latest[kind];
  if (!held) return [need(what, ask)];
  if (held.record.rewritten) {
    return [need(
      `the ${kind} on the record was rewritten by the project's prose pipeline, so no key of this `
        + `shape reads back from it; write it again on this build, which sends the payload in a `
        + `fenced block the rewrite copies as written`,
      ask,
    )];
  }
  const gaps = shapeGaps(kind, held.record, view.names);
  return gaps.length
    ? [need(`the ${kind} on the record is not a whole payload: it lacks ${gaps.join(", ")}`, ask)]
    : [];
};

const reviewOwed = (view, ref) => {
  const merged = markedCommit(view.comments);
  const reviewed = reviewedHead(view.comments);
  const ask = `forge record review ${ref} --reviewer codex --commit ${merged ?? "<sha>"} `
    + `--outcome approved --finding "F1 accepted"`;
  const owed = payloadOwed(view, "review", "no code review of the head that landed", ask);
  if (owed.length) return owed;
  const held = view.latest.review.record.fields;
  const judged = held.commit;
  if (held.outcome !== "approved") return [need(`the latest review of ${judged} says ${held.outcome}`, ask)];
  const landed = merged && sameCommit(judged, merged);
  if (merged && !landed && !(reviewed && sameCommit(judged, reviewed))) {
    return [need(
      `the review judged ${judged}, and the mark names ${merged}` + (reviewed ? ` from head ${reviewed}` : ""),
      ask,
    )];
  }
  return [];
};

/* Both verdict shortfalls fold here, so neither drifts into the other's shape (ISS-297): several
   criteria are one item and one write, shared flags before the first --criterion `blocksIn` splits on. */
const askOne = (ref, number, commit) =>
  `forge record verdict ${ref} --criterion ${number} --verdict pass --commit ${commit} `
  + `--evidence <attachment|url|sha>`;
const askAll = (ref, numbers, commit) =>
  `forge record verdict ${ref} --commit ${commit} --evidence <attachment|url|sha>`
  + numbers.map((number) => ` --criterion ${number} --verdict pass`).join("");
const foldVerdicts = (ref, numbers, commit, one, many) =>
  (numbers.length > 1
    ? [need(many(numbers.join(", ")), askAll(ref, numbers, commit))]
    : numbers.map((number) => need(one(number), askOne(ref, number, commit))));

/* One item for the set: fourteen copies of one path list is what a run reads past. */
const equivalenceOwed = (view, ref, judged, moved, numbers) => {
  const at = `the verdict${numbers.length > 1 ? "s" : ""} on criterion ${numbers.join(", ")}`;
  if (moved === null) {
    return need(
      `${at} judged ${judged}, which the mark names as the judged head, and the mark says nothing `
        + `about what the landing moved, so nothing says those verdicts survived it`,
      markCall(view.documentId),
    );
  }
  return need(
    `the landing moved ${moved.join(", ")}, which this change touched, so ${at} judged ${judged} `
      + `and the evidence was taken before those paths moved`,
    `forge record verdict ${ref} --criterion <n> --verdict pass --commit ${markedCommit(view.comments)} `
      + `--evidence <attachment|url|sha>`,
  );
};

/* A landing brings other people's commits and leaves this change's own diff alone, so a verdict
   judged before it judged the code that landed; the review's recheck at the landed head guards the
   tree they sit on. The note carries the predicate because git is asked where it can answer (ISS-156). */
const verdictsOwed = (view, ref) => {
  const merged = markedCommit(view.comments);
  const judged = judgedHead(view.comments);
  const moved = judged ? landingMoved(view.comments) : null;
  const stands = Boolean(judged) && moved?.length === 0;
  const ask = (number) => askOne(ref, number, merged ?? "<sha>");
  const out = foldVerdicts(
    ref,
    view.owed,
    merged ?? "<sha>",
    (number) => `criterion ${number} has no verdict`,
    (listed) => `criteria ${listed} have no verdict`,
  );
  const atJudged = [];
  for (const [number, { record }] of [...view.verdicts].sort((a, b) => a[0] - b[0])) {
    const held = record.fields;
    const gaps = shapeGaps("verdict", record, view.names);
    if (gaps.length) out.push(need(`the verdict on criterion ${number} lacks ${gaps.join(", ")}`, ask(number)));
    else if (held.verdict === "fail") out.push(need(`criterion ${number} failed its verdict`, ask(number)));
    else if (!merged || sameCommit(held.commit, merged)) continue;
    else if (judged && sameCommit(held.commit, judged)) {
      if (!stands) atJudged.push(number);
    } else {
      out.push(need(`the verdict on criterion ${number} judged ${held.commit}, and the merged commit is ${merged}`, ask(number)));
    }
  }
  if (atJudged.length) out.push(equivalenceOwed(view, ref, judged, moved, atJudged));
  /* A verdict the reader could key by nothing is named as itself: an item naming the criterion it
     does not carry is the shortfall a rewrite invented, and no command supplies it. */
  for (const one of view.unreadable ?? []) {
    out.push(need(
      `a verdict written ${one.at.slice(0, 16)} names no criterion this build can read`
        + `${one.record.rewritten ? ", because the prose pipeline rewrote its keys" : ""}`,
      ask("<n>"),
    ));
  }
  return out;
};

/* One reopen, one finding, one triage, matched by the reopen each was written at: routed on the
   latest instead, a second look would be ruled on by the ruling on the first. The count is the
   tracker's, so a tracker that never raises it leaves every record at reopen zero and the pair is
   whichever was written — which is what a first reopen owes anyway. */
export const atThisReopen = (view, kind) => {
  const count = String(view.issue.reopenCount ?? 0);
  const held = (view.repeated?.[kind] ?? []).filter((one) => one.record.fields.reopen === count);
  return held.length ? held.at(-1) : null;
};

/* A reopen sends the judging back to its start: a wrong-test triage moves the criteria and no commit
   with them, so every verdict on the record still names the merged commit and would pass again. */
const judgedSince = (view, ref) => {
  const held = atThisReopen(view, "triage");
  const outcome = held?.record.fields.outcome;
  if (!outcome || outcome === TRIAGES[2]) return [];
  /* Only the criteria the issue still has: a wrong-test correction may drop or renumber the one
     that was wrong, and a verdict asked for on a number the field no longer holds is refused at the
     write, which would leave the issue unable to reach `tested` at all. */
  const current = new Set(view.criteria.map((one) => one.number));
  const stale = [...view.verdicts]
    .filter(([number, one]) => current.has(number) && one.at <= held.at)
    .sort((a, b) => a[0] - b[0])
    .map(([number]) => number);
  /* No commit to read: whatever answers the finding has no sha on the record yet. */
  return foldVerdicts(
    ref,
    stale,
    "<sha>",
    (number) => `the verdict on criterion ${number} was written before this reopen's triage, and a reopen judges again`,
    (listed) => `the verdicts on criteria ${listed} were written before this reopen's triage, and a reopen judges again`,
  );
};

/* One entry check per status, each answering with what the record lacks and the write that supplies
   it. Nothing here reads the repository: what git knows was written on at the step that knew it. */
export const CHECKS = {
  confirmed: (view, ref) =>
    payloadOwed(
      view,
      "confirmation",
      "no confirmation: where you looked, what the issue is in the code's own terms, and the finding",
      `forge record confirmation ${ref} --where <where> --is "<what it is>" --finding holds`,
    ),
  clarified: (view, ref) =>
    (lightPath(view, "clarified") ? [] : payloadOwed(
      view,
      "decision",
      "no decision record: each reading decided with its assumption and undo, or an explicit none",
      `forge record decision ${ref} --decision "reading | assumption | undo"`,
    )),
  approved: (view, ref) => {
    const out = [];
    const plan = unwrap(view.issue.plan);
    const flags = planFlags(plan);
    /* Absent, the declarations read `no` in every reader downstream, so a fix defaults nothing here. */
    const asks = !lightPath(view, "approved");
    if (asks && !plan) out.push(need("the plan field is empty", `forge plan ${ref} <plan.md>`));
    else if (asks && (!flags.screen || !flags.schema)) {
      out.push(need(
        "the plan declares neither `Screen change: yes|no` nor `Schema coupling: yes|no`, and the "
          + "two decide what the ship steps owe",
        `forge plan ${ref} <plan.md>, with both lines in it`,
      ));
    }
    if (!view.criteria.length) {
      out.push(need("the criteria field holds no numbered line `N. outcome`", `forge record criteria ${ref} <criteria.md>`));
    }
    return out;
  },
  in_progress: (view, ref) => {
    const baseline = payloadOwed(
      view,
      "baseline",
      "no baseline: the gate, what it already reports and the commit it ran at",
      `forge record baseline ${ref} --gate "<command>" --result "<what already fails>" --commit <sha>`,
    );
    return [...blockersOwed(view), ...baseline];
  },
  developed: (view, ref) => {
    const out = [];
    if (!view.issue.mergedAt) out.push(need("no merged mark, so nothing says the change landed", markCall(view.documentId)));
    else if (!markedCommit(view.comments)) {
      out.push(need("the merged mark names no commit; its note carries it as `at <sha>`", markCall(view.documentId)));
    }
    return [...out, ...reviewOwed(view, ref)];
  },
  tested: (view, ref) => {
    if (!view.criteria.length) {
      return [need("the criteria field holds no numbered line, so there is nothing to judge", `forge record criteria ${ref} <criteria.md>`)];
    }
    const out = [...verdictsOwed(view, ref), ...judgedSince(view, ref)];
    if (planFlags(unwrap(view.issue.plan)).schema === "yes" && !view.names.length) {
      out.push(need(
        "the plan declares schema coupling, and no attachment carries the migration risk classification",
        `forge attach issue ${ref} <classification>`,
      ));
    }
    return out;
  },
  released: (view, ref) => {
    const out = payloadOwed(
      view,
      "verification",
      "no verification: where the change now runs, at which commit, and the evidence",
      `forge record verification ${ref} --where "<where it runs>" --commit <sha> --evidence <attachment|url|sha>`,
    );
    if (!view.issue.releaseNotes?.section && !lightPath(view, "released")) {
      out.push(need("no release note and no withholding either", `forge record note ${ref} --section Added --user "<what the reporter sees>"`));
    }
    const declared = personLooks(planFlags(unwrap(view.issue.plan)), view.release);
    if (declared && !answered(view, "screen-review")) {
      out.push(need(
        `the plan declares ${declared}, and no person has answered since it was parked for review`,
        `forge advance ${ref} --park screen-review --why "<why>" --evidence <attachment|url|sha>`,
      ));
    }
    return out;
  },
  closed: () => [],
  dropped: () => [],
};
/* The whole record in one object, so every check reads fields rather than fetching. */
export const viewFrom = (documentId, issue, comments, cut = null, release = null) => {
  const criteria = criteriaOf(issue);
  const names = attachmentNames(issue, comments);
  const fix = isFix(issue.description);
  return { documentId, issue, comments, criteria, names, cut, whole: !cut, release, fix, ...assemble(comments, criteria) };
};
export const parkRecord = (view, wanted = () => true) => {
  const found = view.comments
    .map((one) => ({ comment: one, record: parse(one.body ?? "") }))
    .filter((one) => one.record?.kind === "park" && wanted(one.record.fields.kind))
    .filter((one) => !shapeGaps("park", one.record, view.names).length);
  return found.length ? found.at(-1) : null;
};

/* A screen is the change a deploy does not undo for whoever already read it, so a person answers: a
   comment from a token that is not a device's, later than the park. An agent on a person's PAT can. */
export const answered = (view, kind) => {
  const asked = parkRecord(view, (one) => one === kind);
  return Boolean(asked) && view.comments.some(
    (one) => !one.authorDeviceId && (one.createdAt ?? "") > (asked.comment.createdAt ?? ""),
  );
};
