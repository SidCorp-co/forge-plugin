/* What a reviewer's reply says, and what a round then makes of it: the count it gives of itself, the findings and their ids, the rulings a recheck answers with, the digest a later request replays instead of the prose, the record a disposition becomes, what is still undecided, what a recheck has to verify, and the per-model score the log is kept as an eval set for. Nothing here opens the file — it is handed rows, which is what keeps the dependency running one way. docs/cli/codex-the-log.md. */
import { ANGLES } from "../codex-api.mjs";
import { HUMAN_REF } from "../../tracker/issues.mjs";
import { jsonlBack, jsonlMark } from "../../hooks/log/hook-log-file.mjs";
import { masked } from "../../hooks/log/hook-log.mjs";
import { fenceMarked } from "../../prose.mjs";
import { pathed } from "../../hooks/shell-spans.mjs";
import { median } from "../../stats/median.mjs";
import { answered, isAnswered, judgedBy, maskedDeep, shortOfWhole, verdictsBy } from "../codex-log.mjs";

/* A row of the older shape folded its composed clause into its note, and `composedAt` says where — read as a whole clause and never as a substring of the author's prose, which "Evidence from recheck r7 supports my rejection" is; the composed form was always clauses joined by the same separator, so the boundary is the format. `authorNote` is what is left for the next write to carry, because carrying the whole would say the earlier recheck's status on the next recheck's row. */
const composedAt = (held) => (held?.from ? (held.note ?? "").split(CLAUSE).indexOf(`from recheck ${held.from}`) : -1);

export const authorNote = (prior) => {
  const at = composedAt(prior);
  return at < 0 ? prior?.note : prior.note.split(CLAUSE).slice(0, at).join(CLAUSE) || undefined;
};

/** What a recheck did to a verdict, composed from the row rather than stored in its note: the note is the author's line and is carried from write to write, so a status folded into it outlives the write it was true of and reads as the next one's — r1 left F1 open, r2 accepted it, and the row said both. Empty for a row of the older shape, which folded it in and would otherwise print it twice. */
export const recheckSaid = (held) => {
  if (!held?.from || composedAt(held) >= 0) return "";
  const stood = held.stood ? Object.entries(held.stood) : [];
  return [
    `from recheck ${held.from}`,
    held.reopened?.length ? `still open: ${held.reopened.join(", ")}` : null,
    stood.length ? `your ruling stands on ${stood.map(([id, ruling]) => `${id} (${ruling})`).join(", ")}` : null,
  ].filter(Boolean).join(CLAUSE);
};

const verdictLine = (held) => {
  const kept = held.kept?.length ? ` (${held.kept.join(", ")})` : "";
  const dropped = held.dropped && Object.keys(held.dropped).length
    ? ` (${Object.entries(held.dropped).map(([id, why]) => (why ? `${id}: ${why}` : id)).join("; ")})`
    : "";
  const said = [held.note, recheckSaid(held)].filter(Boolean).join(" — ");
  return `${held.accepted} accepted${kept}, ${held.rejected} rejected${dropped}${said ? ` — ${said}` : ""}`;
};

const CLAUSE = "; ";
const HISTORY_PAIRS = 3;
const HISTORY_CHARS = 6000;
const INTENT_CHARS = 1500;

const HEADER = /^CODEX:\s*(\d+)\s*findings?(?:\s*\(([^)]*)\))?/im;
const SEVERITY = /(\d+)\s*(blocker|major|minor)/gi;

/* The reply counts itself, so the count can be checked instead of taken on trust — a verdict of
   "3 accepted" against a review that made five findings is two findings nobody decided. */
export const countedIn = (reply) => {
  const found = HEADER.exec(String(reply ?? ""));
  if (!found) return null;
  const held = { total: Number(found[1]) };
  for (const [, many, name] of (found[2] ?? "").matchAll(SEVERITY)) held[name.toLowerCase()] = Number(many);
  return held;
};

/* Masked here and not in `logEntries`, which stays raw at 322ms against this seat's 2ms (ISS-266): this projection opens the next request, and an exchange older than the write-side mask holds whatever the reviewed file held. Before the clips and never after, a shape a clip cuts in half matching no pattern; and over the pick rather than the stored entry, whose `sent` bodies cost double to mask and leave by no route here. A field added below and not to the pick reads undefined, which is the loud way to get this wrong. The ones sharing a file go last so they are read last: a consult on bash-guard carried three about cli.mjs, because recency was the only order. */
export const historyFor = (entries, root, pairs = HISTORY_PAIRS, rels = []) => {
  const scored = verdictsBy(entries);
  const own = answered(entries).filter((one) => one.root === root);
  const near = judgedBy(entries, root, rels).slice(-pairs);
  const room = pairs - near.length;
  const far = room > 0 ? own.filter((one) => !near.includes(one)).slice(-room) : [];
  return [...far, ...near]
    .sort((a, b) => own.indexOf(a) - own.indexOf(b))
    .map((one) => {
      const ruled = scored.get(one.id ?? one.at);
      const held = ruled ? maskedDeep(ruled) : null;
      const said = maskedDeep({
        at: one.at,
        files: one.files ?? [],
        intent: one.intent ?? "(none given)",
        reply: one.reply ?? "",
      });
      return {
        at: said.at,
        files: said.files,
        intent: said.intent.slice(0, INTENT_CHARS),
        verdict: held ? verdictLine(held) : null,
        reply: digestOf(said.reply, held),
      };
    });
};

/* Whose review it is, spelled as the prompt spells it, is all that may stand in front of a ruling or ahead
   of the block. `Previous answer: REFUTED; my ruling is CANNOT TELL` is why prose may not. */
const ANGLE_NAMES = Object.values(ANGLES).map((one) => one.split(" — ")[0].replace(/[/\\^$*+?.()|[\]{}]/gu, "\\$&")).join("|");
const ANGLE_RUN = `(?:${ANGLE_NAMES})(?:[ \t]*[/&+,][ \t]*(?:${ANGLE_NAMES}))*`;
const ANGLE_LABEL = new RegExp(`^${ANGLE_RUN}$`, "iu");
const LABEL = /^ {0,3}(?:#{1,6}[ \t]+|\*\*)([^*\n]+?)(?:\*\*)?[ \t]*$/u;
const isLabel = (line) => {
  const found = LABEL.exec(line);
  return Boolean(found) && ANGLE_LABEL.test(found[1].trim());
};

/* The word at the head of a numbered line at column zero, behind emphasis, the finding's id and that name.
   The whole-bold-run shape read 257 of 931 logged rechecks; this reads 926. docs/cli/codex-the-round.md. */
const RULING_LINE = new RegExp(`^(\\d+)\\.[ \t]+\\**[ \t]*(?:${ANGLE_RUN}[ \t]*[—–:][ \t]*)?`
  + `\\**[ \t]*(?:F\\d+\\b\\**[ \t]*[—–\\-:.]*[ \t]*)?\\**[ \t]*(CONFIRMED|REFUTED|CANNOT TELL)\\b`, "iu");

/* A reply quoting an example of a ruling is showing one, not making one: a fenced `1. F1 - REFUTED`
   under a real `1. **CONFIRMED**` would close what that answer left open. */
const unfenced = (reply) => fenceMarked(reply).map((one) => (one.fenced ? "" : one.line)).join("\n");

/* The answers are the block the reply opens with, after any heading: excluding the ways a reply can *show*
   a ruling — fenced, nested, indented, disclaimed — does not terminate, whereas a place does. 870 of 931
   logged rechecks opened with the ruling, 11 more with the angle's heading, none with prose in front. */
const rulingBlock = (reply) => {
  const lines = unfenced(reply).split("\n");
  let at = 0;
  while (at < lines.length && (!lines[at].trim() || isLabel(lines[at]))) at += 1;
  /* The block opens with a ruling or there is none: skipping on to find one lost an indented disclaimer. */
  if (at >= lines.length || !RULING_LINE.test(lines[at])) return [];
  const held = [];
  for (; at < lines.length; at += 1) {
    if (RULING_LINE.test(lines[at])) held.push(lines[at]);
    else if (lines[at].trim() && !/^[ \t]/u.test(lines[at])) break;
  }
  return held;
};

export const rulingsIn = (reply) =>
  rulingBlock(reply).map((line) => {
    const [, n, ruling] = RULING_LINE.exec(line);
    return { n: Number(n), ruling: ruling.toUpperCase(), line };
  });

/* The rulings and the numbered findings, each with what became of it — not the prose around them.
   The gateway cached none of 108 replays, so every call paid for the whole reply three times over. */

export const digestOf = (reply, held = null) => {
  const findings = numbered(reply);
  const rulings = rulingsIn(reply);
  const counted = countedIn(reply);
  if (!findings.length && !rulings.length && !counted) return String(reply ?? "").slice(0, HISTORY_CHARS);
  return [
    ...rulings.map((one) => one.line.trim().slice(0, FINDING_CHARS)),
    `CODEX: ${counted ? counted.total : findings.length} findings`,
    ...findings.map((one) => {
      const did = outcomeOf(held, one.id);
      return `- ${one.id} — ${one.text}${did ? ` → ${did}` : ""}`;
    }),
  ].join("\n").slice(0, HISTORY_CHARS);
};

/* A finding's bullet names a severity; a verdict on a risk names its ruling, whatever else its head
   says, and a resolved one is not re-asked. Anchored to a file the round is about, or unanchored. */
const FINDING = /^\s*[-*]\s+\*\*([^*]*\b(?:blocker|major|minor)\b[^*]*)\*\*\s*(.+)$/gimu;
const RULING = /\b(?:resolved|confirmed|refuted|cannot tell)\b/iu;
const ANCHOR = /`([^`:\s]+):\d+(?:-\d+)?`/u;
/* `ISS-45/body:12` is a `path:line` this anchor matches and no file list holds, tracker text being in
   no checkout: filtered by paths it would be a finding dropped whole rather than one placed elsewhere. */
const onTracker = (anchored) => HUMAN_REF.test(String(anchored).split("/")[0]);
const FINDING_CHARS = 900;

const ID = /^\s*F(\d+)\b\s*[—-]?\s*/u;

const INDENTED = /^[ \t]+\S/u;
const OWN_BULLET = new RegExp(FINDING.source, "u");

/* Indentation is where a v3 finding's clauses end, and a bullet naming a severity is its own finding at
   whatever indent. One blank line inside the block is a layout a reviewer writes; two is a section break. */
const clausesAfter = (reply, from) => {
  const held = [];
  let gap = 0;
  for (const line of reply.slice(from).split("\n").slice(1)) {
    if (!line.trim()) {
      gap += 1;
      if (gap > 1) break;
      continue;
    }
    if (!INDENTED.test(line) || OWN_BULLET.test(line)) break;
    if (gap && held.length) held.push("");
    gap = 0;
    held.push(line.trim());
  }
  return held.length ? `\n${held.join("\n")}` : "";
};

/* Each finding with its id, `F<n>` as the reply numbered it or by its place in the whole reply where it did not — before any file filter, so a recheck on one file keeps the ids a verdict was given against. `head` is the bullet alone, because a Fix clause naming a second path is not where this finding lives. An empty list is no list — it says the caller named none, never that none may be cited — and it is what a consult given only issue keys records: read as a range admitting no path, it dropped every finding anchored to one, which is most of what a reviewer told to read the checkout writes. A reply that counts itself at zero made no findings, so nothing here is given a positional id: the severity words are the ones the prompt puts in front of the reviewer, and a summary bullet echoing them to say none was found was read as one for fourteen of 4409 logged replies, every one of which then had a verdict written against an id nobody raised (ISS-352, ISS-651, ISS-707, ISS-1532, ISS-1665). An id the reviewer wrote itself still stands, whatever the count says, because that is the model numbering a finding and not this parser inventing one. No predicate over the label's prose is attempted: two of the fourteen negate in Vietnamese and one, `Blocker floor is developed`, negates nothing at all. */
export const numbered = (reply, files = null) => {
  const whole = String(reply ?? "");
  const none = countedIn(whole)?.total === 0;
  const seen = new Set();
  return [...whole.matchAll(FINDING)]
    .filter(([, kind]) => !RULING.test(kind))
    .map((found, at) => {
      const own = ID.exec(found[1]);
      if (!own && none) return null;
      const head = `${found[1].replace(ID, "").replace(/:\s*$/u, "")}: ${found[2]}`;
      return {
        id: `F${own ? own[1] : at + 1}`,
        head,
        text: `${head}${clausesAfter(whole, found.index + found[0].length)}`.slice(0, FINDING_CHARS),
      };
    })
    .filter((one) => one && !seen.has(one.id) && seen.add(one.id))
    .filter((one) => {
      const found = files?.length ? ANCHOR.exec(one.head) : null;
      return !found || onTracker(found[1]) || files.includes(found[1]);
    });
};

export const findingsIn = (reply, files = null) => numbered(reply, files).map((one) => one.text);

/* `--accepted F1,F3 --rejected F2=why`, by id and never by count: 185 accepted to 14 rejected was the count form saying nothing. An id the reply never gave, or one given to both sides, is refused: a verdict is what the next consult reads "still open" from. A comma opens a new entry only where an id follows, so a reason may contain one. */
const NEXT = /,(?=\s*F\d+\b)/u;
const spelled = (raw) => {
  const out = new Map();
  for (const one of String(raw ?? "").split(NEXT).map((part) => part.trim()).filter(Boolean)) {
    const [id, ...why] = one.split("=");
    out.set(id.trim(), { id: id.trim(), why: why.join("=").trim() });
  }
  return [...out.values()];
};
const isCount = (raw) => raw !== undefined && /^\d+$/u.test(String(raw).trim());

export const verdictRecord = (last, { accepted, rejected, note }, prior = null) => {
  const at = new Date().toISOString();
  /* A write that names no note keeps the one already recorded: a second ruling is about findings, and dropping the line about the consult is the same silent replacement a recheck made (ISS-1881). */
  const said = note ?? authorNote(prior);
  const base = { kind: "verdict", at, of: last.id ?? last.at, files: last.files, ...(said ? { note: said } : {}) };
  const known = numbered(last.reply).map((one) => one.id);
  const made = known.length ? `it made ${known.join(", ")}` : "it made no findings";
  if (isCount(accepted) || isCount(rejected)) {
    return { problem: `a verdict names findings, not counts — --accepted F1,F3 --rejected F2=why; consult ${base.of}: ${made}.` };
  }
  if (accepted === undefined && rejected === undefined) {
    if (known.length) return { problem: `consult ${base.of} made ${known.join(", ")}: say which you accepted and which you rejected.` };
    return { record: { ...base, accepted: 0, rejected: 0, kept: [], dropped: {} }, undecided: 0 };
  }
  const kept = spelled(accepted);
  const dropped = spelled(rejected);
  for (const { id } of [...kept, ...dropped]) {
    if (!known.includes(id)) return { problem: `consult ${base.of} made no finding ${id}; it made ${known.join(", ") || "none"}.` };
  }
  const twice = kept.map((one) => one.id).filter((id) => dropped.some((one) => one.id === id));
  if (twice.length) return { problem: `${twice.join(", ")} cannot be both accepted and rejected.` };
  const record = { ...base, ...joined(prior, kept, dropped, known.length) };
  return { record, undecided: undecidedIn(known, record).length };
};

/* What was done with one finding, when the verdict named it; the note otherwise. */
export const outcomeOf = (held, id) => {
  if (!held) return null;
  if (held.dropped && id in held.dropped) return `rejected${held.dropped[id] ? ` — ${held.dropped[id]}` : ""}`;
  if (held.kept?.includes(id)) return "accepted";
  return held.note ?? null;
};

/* What the resolved set kept out of the judged consult's findings, or null: the gate filters findings
   by no set, so a narrower one leaves the two disagreeing over whether one exists (ISS-1873). `why`
   withholds the consult's own set as a route where it selects a newer consult or reprints this. */
const leftOutOf = (entries, root, judged, reply, kept, ruled) => {
  const held = new Set(kept.map((one) => one.id));
  const out = numbered(reply).filter((one) => !held.has(one.id));
  if (!out.length) return null;
  const of = judged.id ?? judged.at;
  const files = judged.files ?? [];
  const lands = files.length ? judgedBy(entries, root, files).at(-1) : null;
  const reaches = new Set(numbered(reply, files).map((one) => one.id));
  const why = !files.length ? `consult ${of} recorded no set of its own to recheck over`
    : lands !== judged ? `a recheck over ${of}'s own set lands on consult ${lands.id ?? lands.at} instead`
    : out.every((one) => reaches.has(one.id)) ? null
    : `${of}'s own set leaves that finding out too, it being anchored on a file that consult never recorded`;
  return {
    of,
    made: out.map((one) => `${one.id} on ${ANCHOR.exec(one.head)?.[1] ?? "a file it did not name"}`),
    owed: undecidedIn(out.map((one) => one.id), ruled),
    route: why ? null : files,
    why,
  };
};

/* A follow-up round rules on the last consult's findings about these files — another file's would
   clear this one unread. Six open rounds each found a narrower nit; asked to confirm, one converges. */
export const recheckPlan = (entries, root, rels) => {
  const judged = judgedBy(entries, root, rels).at(-1);
  if (!judged) return null;
  /* The other half of what a request carries out of stored entries; `historyFor` above has the seat's reason, and `judged` stays as stored because its coverage fields are read here and never sent. */
  const ruled = verdictsBy(entries).get(judged.id ?? judged.at);
  const held = ruled ? maskedDeep(ruled) : null;
  const reply = masked(judged.reply);
  const findings = numbered(reply, rels);
  return {
    judged,
    ids: findings.map((one) => one.id),
    outside: leftOutOf(entries, root, judged, reply, findings, ruled),
    /* The defect, with the legend: "re-verify" drew CONFIRMED for a fix that held, then REFUTED. */
    risks: findings.map((one) => {
      const did = outcomeOf(held, one.id);
      return `Your earlier finding ${one.id} still stands in the tree as it is now — ${one.text}.${
        did ? ` What I then did: ${did.slice(0, FINDING_CHARS)}` : ""} (CONFIRMED = the defect is still there; REFUTED = it is fixed, or was never real.)`;
    }),
  };
};

export const recheckRisks = (entries, root, rels) => recheckPlan(entries, root, rels)?.risks ?? [];

/** The range a recheck sends where no file was named: the judged consult's own, narrowed out of what an aged base now offers and never widened past it; null where nothing drops. docs/cli/codex-the-consult.md. */
export const recheckRange = (plan, rels) => {
  const judged = plan?.judged?.files;
  if (!judged?.length) return null;
  const kept = rels.filter((rel) => judged.includes(rel));
  return kept.length && kept.length < rels.length ? kept : null;
};

/* Six and a count in the sentence keeps a refusal readable; the command carries every path, since a pass over six of thirty earns nothing while looking as though it did — `pathed` for both ways a path is unreadable back. */
const SHOWN = 6;
const listed = (rels) => {
  const shown = rels.slice(0, SHOWN).map(pathed).join(" ");
  return rels.length > SHOWN ? `${shown} and ${rels.length - SHOWN} more` : shown;
};

const some = (items) => (items.length > SHOWN
  ? `${items.slice(0, SHOWN).join(", ")} and ${items.length - SHOWN} more`
  : items.join(", "));

const missedRoute = (out) => (out.route
  ? `Do this: \`echo "<what you were doing>" | forge codex consult --recheck ${out.route.map(pathed).join(" ")}\``
    + ` — the set ${out.of} was given, which is where its findings are anchored.`
  : `${out.why}, so rule it where the gate names: \`${verdictForm(out.of)}\`.`);

/** What a recheck that does go ahead still does not reach, or null where no disposition is owed. Never
 *  a wider recheck: this round logs a consult of its own, which is then the one a wider set selects. */
export const recheckMissed = (plan) => {
  const out = plan?.outside;
  if (!out?.owed.length) return null;
  return `consult ${out.of} also made ${some(out.made)}, which this set does not hold, so this recheck`
    + ` does not reach ${some(out.owed)}. This round logs a consult of its own over these files, which a`
    + ` wider recheck would then answer instead, so rule it where the gate names: \`${verdictForm(out.of)}\`.`;
};

/** Why a recheck has nothing to verify and which pass does earn the review, or null where it has.
 *  Three unlike situations shared one sentence naming no route, so it travelled by hand (ISS-51). */
export const recheckOwed = (plan, rels) => {
  if (plan?.risks.length) return null;
  const read = `Do this: \`echo "<what you were doing>" | forge codex consult --send bodies ${rels.map(pathed).join(" ")}\``;
  if (!plan) {
    return `--recheck answers an earlier consult's findings, and no consult in the log has answered on ${listed(rels)}.\n`
      + `${read} — the read of the whole set is the pass a review is earned by, and a recheck follows one of its findings.`;
  }
  const of = plan.judged.id ?? plan.judged.at;
  /* Ahead of the coverage sentences, each of which claims the CONSULT found nothing (ISS-1873). */
  if (plan.outside) {
    return `consult ${of} made ${some(plan.outside.made)}, and this set holds no such file, so this`
      + ` recheck has nothing of its findings to verify.${plan.outside.owed.length
        ? ` Nothing says what became of ${some(plan.outside.owed)}, which is what a commit gate refuses for.`
        : " Every one of them already carries your ruling."}\n${missedRoute(plan.outside)}`;
  }
  // `plan.judged` is the last consult sharing ANY of these files, which is why a shortfall is likely.
  const { unread, part, whole } = shortOfWhole(plan.judged, rels);
  if (whole) {
    return `consult ${of} read this set whole and found nothing${plan.judged.head ? `, taken at ${plan.judged.head}` : ""}: `
      + "that is the whole-set read a review is earned by, and a recheck has nothing to verify against it. It read a "
      + "working tree, so the head is where the pass was taken and not what it read.\n"
      + `${read} — only where the tree has moved since, which this cannot see and you can.`;
  }
  const short = unread.length
    ? ` It read ${listed(plan.judged.files ?? [])}, so ${listed(unread)} ${unread.length === 1 ? "was" : "were"} not among them.`
    : "";
  const cut = part.length ? ` It carried no whole body for ${listed(part)}, so that much of the set is unread.` : "";
  return `consult ${of} is the last answered one on these files and it found nothing, so there is nothing to recheck.${short}${cut}\n`
    + `${read} — the read of the whole set is what earns the review; a recheck follows a finding and nothing else.`;
};
/* Whose word a disposition is, per finding: an id a verdict named and no recheck's write claimed is the
   author's, and the contract gives it the last word. A count-form verdict names none, so it protects none. */
const authorRuled = (prior, id) =>
  Boolean(prior) && !(prior.auto ?? []).includes(id)
  && Boolean(prior.kept?.includes(id) || id in (prior.dropped ?? {}));

const ruledAs = (prior, id) => (prior?.kept?.includes(id) ? "accepted" : "rejected");

/* A recheck's rulings are the verdict on what it re-verified: REFUTED is a finding the tree no longer shows. 37 consults with findings closed with nothing recorded, and 10 of them had a recheck that said exactly what became of each. The n-th ruling answers the n-th risk, whatever else the reply says; a CONFIRMED one stays open, and the caller's own verdict overrides this one. A ruling the author already made is not the recheck's to move: it goes to `stood`, where the reviewer's word sits beside the author's rather than over it, because a confirmation is the reviewer standing by its finding and never the author withdrawing a rejection, and deriving the whole verdict from the recheck took a rejection and its reason off the record (ISS-1881). One that moved nothing still writes, so the log says it ran and what it said. */
export const verdictFromRulings = (plan, offset, reply, recheckId, prior = null) => {
  const rulings = new Map();
  /* The block asks the reviewer to lead with the rulings, so a number repeated later is an echo of one. */
  for (const one of rulingsIn(reply)) if (!rulings.has(one.n)) rulings.set(one.n, one.ruling);
  const kept = [];
  const open = [];
  const stood = [];
  plan.ids.forEach((id, at) => {
    const ruling = rulings.get(offset + at + 1);
    if (ruling !== "REFUTED" && ruling !== "CONFIRMED" && ruling !== "CANNOT TELL") return;
    if (authorRuled(prior, id)) stood.push([id, ruling]);
    else if (ruling === "REFUTED") kept.push(id);
    else open.push(id);
  });
  if (!kept.length && !open.length && !stood.length) return null;
  const of = plan.judged.id ?? plan.judged.at;
  const held = joined(prior, kept.map((id) => ({ id })), open.map((id) => ({ id, reopen: true })), numbered(plan.judged.reply).length, true);
  const moved = Boolean(kept.length || open.length);
  return {
    record: {
      kind: "verdict", at: new Date().toISOString(), of, files: plan.judged.files, ...held,
      from: recheckId, ...(stood.length ? { stood: Object.fromEntries(stood) } : {}),
      ...(authorNote(prior) ? { note: authorNote(prior) } : {}),
    },
    said: [
      moved
        ? `verdict on ${of} recorded from recheck ${recheckId} — accepted: ${kept.join(", ") || "none"}`
          + `${open.length ? `; still open: ${open.join(", ")}` : ""}.`
        : `recheck ${recheckId} moved no ruling on consult ${of}, and the verdict on it stands as you wrote it.`,
      stood.length
        ? `Your ruling stands on ${stood.map(([id, ruling]) => `${id} (${ruledAs(prior, id)}, and the recheck said ${ruling})`).join(", ")}`
          + `, because a recheck does not rewrite one. Settle it yourself: \`${verdictForm(of)}\`.`
        : `\`forge codex verdict --of ${of}\` overrides it.`,
    ].join(" "),
  };
};

const NUMBERED = /^ {0,3}\d+\.[ \t]+\S/u;

/** Why a recheck recorded nothing, naming the recheck itself — the one place that id is printed, so a run
 *  ruling by hand stops writing a placeholder for it (ISS-1681). Three reasons, because a line that ruled
 *  nothing, a reply that numbered nothing and a numbering the risks ahead of the list shifted are three
 *  different next moves. */
export const rulingsUnread = (plan, offset, reply, recheckId) => {
  const ruled = rulingsIn(reply);
  const of = plan.judged.id ?? plan.judged.at;
  const said = new Set(ruled.map((one) => one.line.trim()));
  const unread = unfenced(reply).split("\n").filter((line) => NUMBERED.test(line))
    .map((line) => line.trim()).filter((line) => !said.has(line));
  const ids = plan.ids.join(", ");
  const why = unread.length
    ? `\`${unread[0].slice(0, FINDING_CHARS)}\` is not an answer the reader could take: an answer opens the`
      + " reply and carries CONFIRMED, REFUTED or CANNOT TELL at its head"
    : ruled.length
      ? `it numbered rulings ${ruled.map((one) => one.n).join(", ")}, and ${ids} answer ${offset + 1} to ${offset + plan.ids.length}`
      : "its reply numbered no line at all";
  return `recheck ${recheckId} ruled on none of ${ids} of consult ${of}: ${why}.\n`
    + `Rule on them yourself: \`${verdictForm(of)}\`.`;
};

/* Added to the prior record, never over it; the newer word wins, and a reopened finding leaves both sides.
   `auto` marks the ids a recheck's own write decided, which is how the next writer tells them from the author's. */
const joined = (prior, kept, dropped, total, auto = false) => {
  const said = new Set([...kept, ...dropped].map((one) => one.id));
  const keptAll = [...(prior?.kept ?? []).filter((id) => !said.has(id)), ...kept.map((one) => one.id)];
  const droppedAll = {
    ...Object.fromEntries(Object.entries(prior?.dropped ?? {}).filter(([id]) => !said.has(id))),
    ...Object.fromEntries(dropped.filter((one) => !one.reopen).map((one) => [one.id, one.why ?? ""])),
  };
  /* A count-form prior decided every id it never named; only what a recheck reopens is open again. Its totals are carried for `log --score`, the rejected side first and the accepted side capped so the two never exceed the findings made: a count cannot say which of its ids a later word moved. */
  const counted = Boolean(prior && (prior.counted || (!prior.kept && !prior.dropped)));
  const reopened = [...(prior?.reopened ?? []).filter((id) => !said.has(id)), ...dropped.filter((one) => one.reopen).map((one) => one.id)];
  const autoAll = [...(prior?.auto ?? []).filter((id) => !said.has(id)), ...(auto ? [...said] : [])];
  const rejected = counted ? Math.max(prior.rejected ?? 0, Object.keys(droppedAll).length) : Object.keys(droppedAll).length;
  return {
    accepted: counted ? Math.max(keptAll.length, Math.min(prior.accepted ?? 0, total - rejected)) : keptAll.length,
    rejected,
    kept: keptAll,
    dropped: droppedAll,
    ...(counted ? { counted } : {}),
    ...(reopened.length ? { reopened } : {}),
    ...(autoAll.length ? { auto: autoAll } : {}),
  };
};

/* The ids a verdict has not decided: a recheck's leaves CONFIRMED and CANNOT TELL open, and the gate
   is about decisions, not records. A count-form verdict from before ids decided everything at once. */
export const undecidedIn = (ids, held) => {
  if (!held) return ids;
  if (held.counted) return ids.filter((id) => held.reopened?.includes(id));
  if (!held.kept && !held.dropped) return [];
  return ids.filter((id) => !held.kept?.includes(id) && !(id in (held.dropped ?? {})));
};

export const verdictForm = (id) => `forge codex verdict --of ${id} --accepted <ids> --rejected <id>=<why>`;

/* For the commit gate, with the one command that clears it: two gates print that line in sentences of their own and the flags are the same flags in both. A later consult that found nothing does not answer for an earlier one's findings. */
export const unverdicted = (bytes, root) => {
  const scored = new Map();
  for (const one of jsonlBack(bytes, [jsonlMark("root", root), jsonlMark("kind", "verdict")])) {
    if (one.kind === "verdict") {
      if (one.of && !scored.has(one.of)) scored.set(one.of, one);
      continue;
    }
    if (!isAnswered(one) || one.root !== root) continue;
    const ids = numbered(one.reply).map((held) => held.id);
    if (!ids.length) continue;
    const id = one.id ?? one.at;
    const open = undecidedIn(ids, scored.get(id));
    return open.length ? { id, ids, open, files: one.files ?? [], at: one.at } : null;
  }
  return null;
};


/* The eval the log exists for: what each model found, what the caller kept, cached over every input
   token. The channel is part of the key and an unrecorded one is a value of its own: a row written
   before the effort moved onto the model states an effort the gateway never read, and grouping it
   with one written after would score two treatments as one. Where the model carried the effort its
   id already says which, so the level is not repeated in the key. */
export const modelKey = (one) => {
  const via = one.effortVia ?? "unrecorded";
  const level = via !== "model" && one.effort ? ` @${one.effort}` : "";
  return `${one.model ?? one.slot ?? "?"}${level} via ${via}`;
};

export const scoreOf = (entries) => {
  const scored = verdictsBy(entries);
  const rows = new Map();
  for (const one of answered(entries)) {
    const key = modelKey(one);
    const row = rows.get(key) ?? { model: key, consults: 0, findings: 0, zero: 0, accepted: 0, rejected: 0, seconds: [], cached: 0, input: 0 };
    const counted = countedIn(one.reply);
    row.consults += 1;
    if (counted) {
      row.findings += counted.total;
      if (counted.total === 0) row.zero += 1;
    }
    const held = scored.get(one.id ?? one.at);
    if (held) {
      row.accepted += held.accepted ?? 0;
      row.rejected += held.rejected ?? 0;
    }
    if (one.ms !== undefined) row.seconds.push(Math.round(one.ms / 1000));
    const usage = one.usage ?? {};
    row.cached += usage.cache_read_input_tokens ?? 0;
    row.input += (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
    rows.set(key, row);
  }
  return [...rows.values()].map((row) => ({ ...row, median: median(row.seconds) ?? 0, seconds: undefined }));
};
