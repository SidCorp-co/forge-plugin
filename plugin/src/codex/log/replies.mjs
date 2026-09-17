/* What a reviewer's reply says, and what a round then makes of it: the count it gives of itself, the findings and their ids, the rulings a recheck answers with, the digest a later request replays instead of the prose, the record a disposition becomes, what is still undecided, what a recheck has to verify, and the per-model score the log is kept as an eval set for. Nothing here opens the file — it is handed rows, which is what keeps the dependency running one way. docs/cli/codex-the-log.md. */
import { HUMAN_REF } from "../../tracker/issues.mjs";
import { jsonlBack, jsonlMark } from "../../hooks/log/hook-log-file.mjs";
import { masked } from "../../hooks/log/hook-log.mjs";
import { pathed } from "../../hooks/shell-spans.mjs";
import { median } from "../../stats/median.mjs";
import { answered, isAnswered, judgedBy, maskedDeep, shortOfWhole, verdictsBy } from "../codex-log.mjs";

const verdictLine = (held) => {
  const kept = held.kept?.length ? ` (${held.kept.join(", ")})` : "";
  const dropped = held.dropped && Object.keys(held.dropped).length
    ? ` (${Object.entries(held.dropped).map(([id, why]) => (why ? `${id}: ${why}` : id)).join("; ")})`
    : "";
  return `${held.accepted} accepted${kept}, ${held.rejected} rejected${dropped}${held.note ? ` — ${held.note}` : ""}`;
};

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

/* The word at the head of a line the reply numbered, behind emphasis and the finding's own id but never
   behind prose: a whole-bold-run wrapper was a shape the prompt never asked for and seven replies answered
   outside it (ISS-1336, ISS-1681), while closing a finding on a word only `the earlier answer was REFUTED`
   reaches would be worse than the silence that replaced. docs/cli/codex-the-round.md. */
const RULING_LINE = /^[ \t]*(\d+)\.[ \t]+\**[ \t]*(?:F\d+\b\**[ \t]*[—–\-:.]*[ \t]*)?\**[ \t]*(CONFIRMED|REFUTED|CANNOT TELL)\b.*$/gimu;

/* A reply quoting an example of a ruling is showing one, not making one, and the grammar cannot tell
   them apart: a fenced `1. F1 - REFUTED` under a real `1. **CONFIRMED**` would close what was left open. */
const FENCE = /^[ \t]*(`{3,}|~{3,})(.*)$/u;
const unfenced = (reply) => {
  let open = null;
  return String(reply ?? "").split("\n").map((line) => {
    const found = FENCE.exec(line);
    /* A markdown example of a fence opens with a longer run than the one it shows, so only a run of the
       opener's own character, at least as long and carrying nothing after it, closes what it opened. */
    if (found && !open) open = found[1];
    else if (found && open && found[1][0] === open[0] && found[1].length >= open.length && !found[2].trim()) open = null;
    else if (!open) return line;
    return "";
  }).join("\n");
};

export const rulingsIn = (reply) =>
  [...unfenced(reply).matchAll(RULING_LINE)].map(([line, n, ruling]) => ({ n: Number(n), ruling: ruling.toUpperCase(), line }));

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
  const base = { kind: "verdict", at, of: last.id ?? last.at, files: last.files, ...(note ? { note } : {}) };
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

/* A follow-up round rules on the last consult's findings about these files — another file's would
   clear this one unread. Six open rounds each found a narrower nit; asked to confirm, one converges. */
export const recheckPlan = (entries, root, rels) => {
  const judged = judgedBy(entries, root, rels).at(-1);
  if (!judged) return null;
  /* The other half of what a request carries out of stored entries; `historyFor` above has the seat's reason, and `judged` stays as stored because its coverage fields are read here and never sent. */
  const ruled = verdictsBy(entries).get(judged.id ?? judged.at);
  const held = ruled ? maskedDeep(ruled) : null;
  const findings = numbered(masked(judged.reply), rels);
  return {
    judged,
    ids: findings.map((one) => one.id),
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
/* A recheck's rulings are the verdict on what it re-verified: REFUTED is a finding the tree no longer shows. 37 consults with findings closed with nothing recorded, and 10 of them had a recheck that said exactly what became of each. The n-th ruling answers the n-th risk, whatever else the reply says; a CONFIRMED one stays open, and the caller's own verdict overrides this one. */
export const verdictFromRulings = (plan, offset, reply, recheckId, prior = null) => {
  const rulings = new Map();
  /* The block asks the reviewer to lead with the rulings, so a number repeated later is an echo of one. */
  for (const one of rulingsIn(reply)) if (!rulings.has(one.n)) rulings.set(one.n, one.ruling);
  const kept = [];
  const open = [];
  plan.ids.forEach((id, at) => {
    const ruling = rulings.get(offset + at + 1);
    if (ruling === "REFUTED") kept.push(id);
    else if (ruling === "CONFIRMED" || ruling === "CANNOT TELL") open.push(id);
  });
  if (!kept.length && !open.length) return null;
  const of = plan.judged.id ?? plan.judged.at;
  const note = `from recheck ${recheckId}${open.length ? `; still open: ${open.join(", ")}` : ""}`;
  const held = joined(prior, kept.map((id) => ({ id })), open.map((id) => ({ id, reopen: true })), numbered(plan.judged.reply).length);
  return {
    record: { kind: "verdict", at: new Date().toISOString(), of, files: plan.judged.files, ...held, from: recheckId, note },
    said: `verdict on ${of} recorded from recheck ${recheckId} — accepted: ${kept.join(", ") || "none"}`
      + `${open.length ? `; still open: ${open.join(", ")}` : ""}. \`forge codex verdict --of ${of}\` overrides it.`,
  };
};

const NUMBERED = /^\d+\.[ \t]+\S/u;

/** Why a recheck recorded nothing, naming the recheck itself — the one place that id is printed, so a run
 *  ruling by hand stops writing a placeholder for it (ISS-1681). Three reasons, because a line that ruled
 *  nothing, a reply that numbered nothing and a numbering the risks ahead of the list shifted are three
 *  different next moves. */
export const rulingsUnread = (plan, offset, reply, recheckId) => {
  const ruled = rulingsIn(reply);
  const of = plan.judged.id ?? plan.judged.at;
  const said = new Set(ruled.map((one) => one.line.trim()));
  const unread = unfenced(reply).split("\n").map((line) => line.trim())
    .filter((line) => NUMBERED.test(line) && !said.has(line));
  const ids = plan.ids.join(", ");
  const why = unread.length
    ? `\`${unread[0].slice(0, FINDING_CHARS)}\` does not open with CONFIRMED, REFUTED or CANNOT TELL`
    : ruled.length
      ? `it numbered rulings ${ruled.map((one) => one.n).join(", ")}, and ${ids} answer ${offset + 1} to ${offset + plan.ids.length}`
      : "its reply numbered no line at all";
  return `recheck ${recheckId} ruled on none of ${ids} of consult ${of}: ${why}.\n`
    + `Rule on them yourself: \`${verdictForm(of)}\`.`;
};

/* Added to the prior record, never over it; the newer word wins, and a reopened finding leaves both sides. */
const joined = (prior, kept, dropped, total) => {
  const said = new Set([...kept, ...dropped].map((one) => one.id));
  const keptAll = [...(prior?.kept ?? []).filter((id) => !said.has(id)), ...kept.map((one) => one.id)];
  const droppedAll = {
    ...Object.fromEntries(Object.entries(prior?.dropped ?? {}).filter(([id]) => !said.has(id))),
    ...Object.fromEntries(dropped.filter((one) => !one.reopen).map((one) => [one.id, one.why ?? ""])),
  };
  /* A count-form prior decided every id it never named; only what a recheck reopens is open again. Its totals are carried for `log --score`, the rejected side first and the accepted side capped so the two never exceed the findings made: a count cannot say which of its ids a later word moved. */
  const counted = Boolean(prior && (prior.counted || (!prior.kept && !prior.dropped)));
  const reopened = [...(prior?.reopened ?? []).filter((id) => !said.has(id)), ...dropped.filter((one) => one.reopen).map((one) => one.id)];
  const rejected = counted ? Math.max(prior.rejected ?? 0, Object.keys(droppedAll).length) : Object.keys(droppedAll).length;
  return {
    accepted: counted ? Math.max(keptAll.length, Math.min(prior.accepted ?? 0, total - rejected)) : keptAll.length,
    rejected,
    kept: keptAll,
    dropped: droppedAll,
    ...(counted ? { counted } : {}),
    ...(reopened.length ? { reopened } : {}),
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
