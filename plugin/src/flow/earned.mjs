/* What an issue's record earns: the contract's flow table, one entry check per status, and the
   record read whole into one object. The verb that spends this is advance.mjs; nothing here
   writes, fetches or reads the repository. docs/issue-flow-contract.md holds the tables. */
import {
  FINDINGS,
  Refused,
  SHAPES,
  assemble,
  attachmentNames,
  criteriaLines,
  evidenceHeld,
  parse,
  refuse,
  unwrap,
} from "./record.mjs";

/* The contract's flow table in its own order: the sequence is the rule, so listing it is the point. */
export const ORDER = [
  "open", "confirmed", "clarified", "approved", "in_progress", "developed", "tested", "released", "closed",
];

/* The flow table's last column: which phase a status owes while it is held, and where the method
   for it lives. The path is relative to the plugin root, which is one level above this module in
   the checkout and in the installed copy alike. ISS-18 owns the day this is typed rather than a
   pointer; until then a pointer beats a phase number nobody can look up. */
export const PHASE = {
  open: ["1 Triage", "triage.md"],
  confirmed: ["2 Clarify", "clarify.md"],
  clarified: ["3 Plan", "plan.md"],
  approved: ["4 Implement, to the branch", "verification.md"],
  in_progress: ["4 Implement, to the review and the merge", "verification.md"],
  developed: ["5 Prove", "verification.md"],
  tested: ["6, 7 Ship", "release-note.md"],
  released: ["closing, by a person or the run's end", "release-note.md"],
  closed: ["none", "learning.md"],
  dropped: ["none", "learning.md"],
};

export const methodOf = (status) => {
  const held = PHASE[status];
  return held ? { phase: held[0], reference: `skills/issue-flow/references/${held[1]}` } : null;
};

/* Which reader each park kind speaks to, and so which side status it lands in. Every kind in PARKS
   has a row: a park with nowhere to go would be a status set from nothing. */
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

const MARK = /^mark_merged\b/u;
const AT_SHA = /\bat ([0-9a-f]{7,40})\b/iu;
const HEAD_SHA = /\breviewed head ([0-9a-f]{7,40})\b/iu;
export const atLeast = (status, floor) =>
  ORDER.indexOf(status) >= 0 && ORDER.indexOf(status) >= ORDER.indexOf(floor);

/* A verdict may name seven digits where a mark's note names forty, so the shorter one decides. */
export const sameCommit = (one, two) => {
  const [left, right] = [one, two].map((held) => String(held ?? "").trim().toLowerCase());
  if (left.length < 7 || right.length < 7) return false;
  const width = Math.min(left.length, right.length);
  return left.slice(0, width) === right.slice(0, width);
};

/* mark_merged has no commit field, so the commit lives in the note it writes as `at <sha>`, and
   a squash that changed the hash leaves the head that was reviewed there beside it. */
const lastMark = (comments) => {
  const marks = comments.map((one) => unwrap(one.body)).filter((body) => MARK.test(body));
  return marks.length ? marks.at(-1) : null;
};

export const markedCommit = (comments) => AT_SHA.exec(lastMark(comments) ?? "")?.[1] ?? null;
export const reviewedHead = (comments) => HEAD_SHA.exec(lastMark(comments) ?? "")?.[1] ?? null;

/* `parse` reads the labels a record rendered and applies none of the shape's rules, so a comment
   carrying the tag and little else — written by hand, or through a client no gate sits before —
   is measured against its shape here before it earns anything. */
export const shapeGaps = (kind, record, names = []) => {
  const shape = SHAPES[kind];
  const got = Object.fromEntries(shape.fields.map((field) => {
    const held = record.fields[field.label];
    if (field.many) return [field.flag, held ? String(held).split("; ") : []];
    return [field.flag, held];
  }));
  const gaps = shape.fields
    .filter((field) => {
      const held = got[field.flag];
      if (field.many) return held.length < (field.least ?? 1);
      if (held === undefined) return !field.optional;
      return Boolean(field.oneOf) && !field.oneOf.includes(held);
    })
    .map((field) => `--${field.flag}`);
  /* A written record had its evidence checked against the issue; one read back is checked again,
     because the comment may have come from a hand or a client no check sits in front of. */
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

export const dispositionOf = (latest) => {
  const finding = latest.confirmation?.record.fields.Finding;
  return FINDINGS.includes(finding) && finding !== "holds" ? finding : null;
};

export const nextOf = (status, latest) => {
  if (status === "confirmed" && dispositionOf(latest)) return "dropped";
  const at = ORDER.indexOf(status);
  return at < 0 || at === ORDER.length - 1 ? null : ORDER[at + 1];
};

const need = (what, command) => ({ what, command });

/* The two declarations the plan owes, and the wording this verb reads them in: the contract asks
   the plan to state both and fixes no phrasing, so the refusal below carries the one it accepts. */
const SCREEN = /screen change:\s*(yes|no)\b/iu;
const SCHEMA = /schema coupling:\s*(yes|no)\b/iu;
export const planFlags = (plan) => ({
  screen: SCREEN.exec(plan)?.[1]?.toLowerCase() ?? null,
  schema: SCHEMA.exec(plan)?.[1]?.toLowerCase() ?? null,
});
const markCall = (documentId) =>
  `forge call forge_issues '{"action":"mark_merged","data":{"issueId":"${documentId}",`
  + `"target":"base","note":"merged to <branch> at <sha>; reviewed head <sha>"}}'`;
export const transitionCall = (documentId, status) =>
  `forge call forge_issues '{"action":"transition","documentId":"${documentId}","data":{"status":"${status}"}}'`;

const blockersOwed = ({ issue }) =>
  (issue.relations?.blockedBy ?? [])
    .filter((one) => !atLeast(one.otherStatus, "developed"))
    .map((one) =>
      need(
        `${one.otherDisplayId} blocks this and is ${one.otherStatus}, which is not yet developed`,
        `forge advance ${one.otherDisplayId}`,
      ),
    );

/* One shape, three answers: absent, present but not a whole payload, or there to be read. */
export const payloadOwed = (view, kind, what, ask) => {
  const held = view.latest[kind];
  if (!held) return [need(what, ask)];
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
  const judged = held["Head judged"];
  if (held.Outcome !== "approved") return [need(`the latest review of ${judged} says ${held.Outcome}`, ask)];
  const landed = merged && sameCommit(judged, merged);
  if (merged && !landed && !(reviewed && sameCommit(judged, reviewed))) {
    return [need(
      `the review judged ${judged}, and the mark names ${merged}` + (reviewed ? ` from head ${reviewed}` : ""),
      ask,
    )];
  }
  return [];
};

const verdictsOwed = (view, ref) => {
  const merged = markedCommit(view.comments);
  const ask = (number) =>
    `forge record verdict ${ref} --criterion ${number} --verdict pass --commit ${merged ?? "<sha>"} `
    + `--evidence <attachment|url|sha>`;
  const out = view.owed.map((number) => need(`criterion ${number} has no verdict`, ask(number)));
  for (const [number, { record }] of [...view.verdicts].sort((a, b) => a[0] - b[0])) {
    const held = record.fields;
    const gaps = shapeGaps("verdict", record, view.names);
    if (gaps.length) out.push(need(`the verdict on criterion ${number} lacks ${gaps.join(", ")}`, ask(number)));
    else if (held.Verdict === "fail") out.push(need(`criterion ${number} failed its verdict`, ask(number)));
    else if (merged && !sameCommit(held.Commit, merged)) {
      out.push(need(`the verdict on criterion ${number} judged ${held.Commit}, and the merged commit is ${merged}`, ask(number)));
    }
  }
  return out;
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
    payloadOwed(
      view,
      "decision",
      "no decision record: each reading decided with its assumption and undo, or an explicit none",
      `forge record decision ${ref} --decision "reading | assumption | undo"`,
    ),
  approved: (view, ref) => {
    const out = [];
    const plan = unwrap(view.issue.plan);
    const flags = planFlags(plan);
    if (!plan) out.push(need("the plan field is empty", `forge plan ${ref} <plan.md>`));
    else if (!flags.screen || !flags.schema) {
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
    const out = verdictsOwed(view, ref);
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
    if (!view.issue.releaseNotes?.section) {
      out.push(need("no release note and no withholding either", `forge record note ${ref} --section Added --user "<what the reporter sees>"`));
    }
    if (planFlags(unwrap(view.issue.plan)).screen === "yes" && !answered(view, "screen-review")) {
      out.push(need(
        "the plan declares a screen change, and no person has answered since it was parked for review",
        `forge advance ${ref} --park screen-review --why "<why>" --evidence <attachment|url|sha>`,
      ));
    }
    return out;
  },
  closed: () => [],
  dropped: () => [],
};
/* The whole record in one object, so every check reads fields rather than fetching. */
export const viewFrom = (documentId, issue, comments, whole = true) => {
  const criteria = criteriaOf(issue);
  const names = attachmentNames(issue, comments);
  return { documentId, issue, comments, criteria, names, whole, ...assemble(comments, criteria) };
};
const parkRecord = (comments, kind = null) => {
  const found = comments
    .map((one) => ({ comment: one, record: parse(one.body ?? "") }))
    .filter((one) => one.record?.kind === "park" && (!kind || one.record.fields.Kind === kind));
  return found.length ? found.at(-1) : null;
};

/* A screen is the change a deploy does not undo for whoever already read it, so the contract asks
   a person: a comment the tracker did not mark as an agent's, later than the park that asked. */
const answered = (view, kind) => {
  const asked = parkRecord(view.comments, kind);
  return Boolean(asked) && view.comments.some(
    (one) => one.isAi === false && (one.createdAt ?? "") > (asked.comment.createdAt ?? ""),
  );
};

/* A park is a checkpoint with a person at it: the reply that resumes it is a comment by somebody
/* A park is a checkpoint with a person at it: the reply that resumes it is a comment by somebody
   other than whoever parked the issue. A hold nobody was asked to answer resumes by hand. */
const resumeOwed = (view, held) => {
  const kind = held.record.fields.Kind;
  const left = held.record.fields["Status left"];
  const since = held.comment.createdAt ?? "";
  const replied = view.comments.some(
    (one) => (one.createdAt ?? "") > since && one.authorId && one.authorId !== held.comment.authorId,
  );
  if (view.issue.status === "on_hold") {
    if (kind !== "blocked") {
      return [need(`the hold is kind ${kind}, which a person lifts`, transitionCall(view.documentId, left))];
    }
    return blockersOwed(view);
  }
  return replied
    ? []
    : [need(
      `the park is kind ${kind} and nobody has answered it since ${since.slice(0, 16)}`,
      transitionCall(view.documentId, left),
    )];
};

export const targetOf = (view, ref) => {
  const status = view.issue.status;
  const held = SIDE.includes(status) ? parkRecord(view.comments) : null;
  if (SIDE.includes(status)) {
    if (!held) {
      refuse(`${ref} is ${status} with no park record, so nothing says where it came from. `
        + `Write one (forge record park ${ref} --kind <kind> --why "<why>") or transition by hand:\n  ${transitionCall(view.documentId, "<status>")}`);
    }
    const left = held.record.fields["Status left"];
    if (!ORDER.includes(left)) {
      refuse(`the park record on ${ref} names \`${left}\` as the status it left, which is no step of the flow. `
        + `Transition by hand:\n  ${transitionCall(view.documentId, "<status>")}`);
    }
    return { next: left, missing: resumeOwed(view, held), resumed: true };
  }
  const next = nextOf(status, view.latest);
  if (!next) {
    refuse(`${ref} is ${status}; nothing advances from it. A reopen is a person's word:\n  ${transitionCall(view.documentId, "reopen")}`);
  }
  return { next, missing: CHECKS[next](view, ref), resumed: false };
};
