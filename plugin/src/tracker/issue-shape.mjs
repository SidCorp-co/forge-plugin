/* What a filing has to carry before the flow can carry it: the kinds this CLI defines and the
   sections each one's body owes, stated once below, and the reading of a body against them. One
   module, because the verb that files an issue and the gate that refuses one through the tracker's
   own tool have to refuse the same body, and because a set of sections held apart from the reader of
   them is two places to correct. The tracker's half of the schema is read live from its own schema
   and copied nowhere. Why three kinds and why these sections: docs/cli/new.md;
   plugin/hooks/how/issue-shape.md. */
import { DEFAULT_OVERLAP_THRESHOLD, findOverlapsAgainst } from "../../hooks/vendor/text-overlap.js";
import { sentences } from "../checks/duplication.mjs";
import { didYouMean } from "../suggest.mjs";
import { MAX_LIMIT, listIssues, rowsOf, truncated } from "./issues.mjs";
import { enumAt } from "./rpc.mjs";

const SETTLED = ["closed", "dropped"];
const CANDIDATES = 4;
const TOKENS = 3;
const SEARCHED = MAX_LIMIT;

/* The line that marks a change for the light path, the tracker auto-creating no label a mark could
   own. Written exact and read as a family, so typing it on the tracker's own screens does not lose
   it to a full stop; the end of the line is checked all the same, so `Size: fix later` is not it. */
export const SIZE_LINE = "Size: fix.";
const MARK = /^[ \t]*size:[ \t]*fix\.?[ \t]*$/imu;
export const isFix = (description) => MARK.test(String(description ?? ""));
export const withMark = (body) => (isFix(body) ? body : `${String(body).replace(/\s*$/u, "")}\n\n${SIZE_LINE}\n`);

const SUBSTANTIAL = 4;

const LINE = `and under it one line of ${SUBSTANTIAL} words or more`;

const section = ({ spoken = null, substantial = true, ...rest }) =>
  ({ ...rest, spoken, substantial, add: `## ${rest.title}` });

const OUTCOME = section({
  title: "Outcome",
  reads: "the outcome",
  bare: "outcome",
  wants: `a heading naming the outcome, ${LINE} saying what is true after the change`,
  heading: /\boutcome\b/iu,
});
const RULES = section({
  title: "Rules",
  reads: "rules, invariants or acceptance",
  bare: "rule",
  wants: `a heading of rules, invariants or acceptance, ${LINE}`,
  heading: /\b(?:rules?|invariants?|acceptance|behaviours?)\b/iu,
});
/* The one section a sentence may carry instead: refusing it would teach an empty heading. */
const SCOPE = section({
  title: "Out of scope",
  reads: "the out-of-scope",
  bare: "out-of-scope",
  wants: "an out-of-scope heading, or one line saying nothing is out of scope",
  heading: /\bout[\s-]of[\s-]scope\b/iu,
  spoken: /\bnothing\b[^.\n]{0,60}\bout[\s-]of[\s-]scope\b/iu,
  substantial: false,
});
const HAPPENED = section({
  title: "What happened",
  reads: "what happened",
  bare: "what-happened",
  wants: `a heading saying what happened, ${LINE} naming the failure a reader has to reproduce`,
  heading: /\bwhat happened\b|\bwhat went wrong\b|\bwhat broke\b/iu,
});
const TODAY = section({
  title: "What happens today",
  reads: "what happens today",
  bare: "what-happens-today",
  wants: `a heading saying what happens today, ${LINE} describing the behaviour being replaced`,
  heading: /\btoday\b|\b(?:it|there) is now\b|\bit does now\b|\bcurrently\b/iu,
});
const WHERE = section({
  title: "Where",
  reads: "where",
  bare: "where",
  wants: "the file, the verb or the screen it happens on",
  heading: /\bwhere\b/iu,
});
const WHY = section({
  title: "Why",
  reads: "why",
  bare: "why",
  wants: "what makes it worth a round of the flow",
  heading: /\bwhy\b/iu,
});

/* Three, measured: nothing here names a kind, so the set is the body shapes this backlog writes. */
export const KINDS = [
  {
    kind: "bug",
    is: "something that worked, or was meant to, and does not",
    needs: [HAPPENED, OUTCOME, RULES, SCOPE],
    says: [WHERE],
  },
  {
    kind: "enhancement",
    is: "something that works, and should work better",
    needs: [TODAY, OUTCOME, RULES, SCOPE],
    says: [WHY],
  },
  {
    kind: "feature",
    is: "something that is not there at all",
    needs: [OUTCOME, RULES, SCOPE],
    says: [WHY],
  },
];

export const DEFAULT_KIND = "feature";
export const KIND_NAMES = KINDS.map((one) => one.kind);

export const shapeFor = (kind) => KINDS.find((one) => one.kind === (kind || DEFAULT_KIND)) ?? null;

const listed = (names) => names.join(", ");
const titles = (sections) => sections.map((one) => one.title);

/* The set and the route past it, borrowed by both refusals: a kind this CLI does not define is a
   section list nobody has decided, not a filing to fix by guessing. */
const KIND_WANTS = `one of ${listed(KIND_NAMES)} — a filing needing another kind, or another`
  + " section under one, files an issue against this plugin rather than inventing the value";

export const kindRefusal = (given) =>
  `--kind takes ${KIND_WANTS}.\nIt was given \`${given}\`, which names no shape to read the body`
  + ` against. A filing naming no kind is read as a ${DEFAULT_KIND}.`;

/** The flow's word for a size beside the tracker's value for it, in the one place they meet. The
 *  mark is a line in the description, so this is read on the way back and written by nothing. */
export const SIZES = { xs: "fix" };
export const SIZE_WORDS = Object.values(SIZES);

/* Each name held as a key, never a string a developer is shown: one to translate back costs a round. */
const FLOW = {
  category: { word: "kind" },
  complexity: { word: "size", said: (held) => SIZES[held] ?? held },
};

/** A flag naming the tracker's field instead of the CLI's word: taken, it would reach the tracker
 *  around the shape the kind decides, so it is refused with the word that reads the body. */
export const insteadOf = (given) => {
  const [key] = Object.keys(FLOW).filter((one) => Object.hasOwn(given, one));
  return key
    ? `--${key} is the tracker's own name for it, and a value passed under that name is read against`
      + ` nothing. This CLI's flag is --${FLOW[key].word}, and \`forge new -h\` names what it reads.`
    : null;
};

/** The one writer, and nothing where no kind was named: a default reads later as one somebody chose. */
export const trackerFields = ({ kind }) => (kind ? { category: kind } : {});

/* What a filing is ranked, in one place. The kind's field above is left empty and this one cannot
   be — left out, the tracker fills the middle of its own set; docs/cli/new.md holds the rest. */
export const PRIORITY_AT = ["data", "properties", "priority", "enum"];

export const UNRANKED = "low";

export const priorityFor = (given, allowed = []) => {
  const wanted = given ?? UNRANKED;
  const said = given === undefined ? `priority ${UNRANKED}, by default` : `priority ${given}, as given`;
  if (!allowed.length || allowed.includes(wanted)) return { value: wanted, said };
  if (given === undefined) {
    return { refusal: `This CLI files an issue nobody ranked as \`${UNRANKED}\`, and the tracker's set is`
      + ` now ${listed(allowed)}. Name one with --priority, and file this against the plugin: the`
      + " default is what has to change, not the filing." };
  }
  return { refusal: `${didYouMean("priority", given, allowed)} The set is ${listed(allowed)},`
    + " the tracker's own, and this CLI holds no copy of it." };
};

/** The reading with the set fetched, which is where both filing routes take it from: the schema path
 *  is named once, and neither route decides for itself what a schema declaring nothing means. */
export const rankOf = async (given) => priorityFor(given, await enumAt("forge_issues", PRIORITY_AT));

export const filedAs = (answer, said) => {
  const key = answer?.issueId ?? answer?.documentId ?? null;
  return key ? `${key} is filed, ${said}.` : `Filed, ${said}; the reply named no key to say it of.`;
};

export const PRIORITY_HELP = [
  `--priority takes the tracker's own set, read at the call, and absent it a filing is ${UNRANKED}.`,
  "The reply says which of the two it was. An issue nobody ranked sorts to the bottom of the browse",
  "verb rather than into the middle of it, so what is left there is what nobody has judged yet.",
].join("\n");

export const inFlowWords = (record) => {
  if (!record || typeof record !== "object" || Array.isArray(record)) return record;
  return Object.fromEntries(Object.entries(record).map(([key, held]) => {
    const found = Object.hasOwn(FLOW, key) ? FLOW[key] : null;
    return found ? [found.word, found.said ? found.said(held) : held] : [key, held];
  }));
};

const ROW = 15;
const kindRows = (one) => [
  `  ${one.kind.padEnd(ROW)}${one.is}`,
  `    required   ${listed(titles(one.needs))}`,
  `    nice       ${listed(titles(one.says))}`,
];

export const KINDS_HELP = [
  "The kinds, and the sections a body of each carries. A required section missing is refused with",
  "the section named; a nice-to-have one missing is said in a line and filed.",
  "",
  ...KINDS.flatMap(kindRows),
  "",
  "A heading is matched by family and not by that wording: `Business rules` is a rule section and",
  `\`What it is now\` is a today one. A filing naming no kind is read as a ${DEFAULT_KIND} and told`,
  "so. A body marked `Size: fix.` is read against no section and against no kind, so nothing is read",
  "of it and nothing is said.",
].join("\n");

/** One line or nothing: what the body was read as, and what it left out. Neither is a refusal. */
export const noticeFor = ({ kind, named, left }) => {
  if (named && !left.length) return null;
  const head = named
    ? `Read as a ${kind}.`
    : `Read as a ${DEFAULT_KIND}, the kind a filing naming none is read as.`;
  const rest = left.length
    ? ` It leaves out ${listed(titles(left))}, nice to have on a ${kind} and refused on nothing.`
    : "";
  return `${head}${rest}`;
};

const FENCE = /^⟦(?:END_)?UNTRUSTED_DATA[^⟧]*⟧\s*$/gmu;

export const openTitles = (rows) =>
  rows.filter((one) => !SETTLED.includes(one.status)).map((one) => ({
    issueId: one.issueId ?? "",
    documentId: one.documentId ?? null,
    title: String(one.title ?? "").replace(FENCE, "").trim(),
  }));

const HEADING = /^#{1,6}[ \t]+(.*)$/gmu;

const headingsOf = (body) => [...String(body).matchAll(HEADING)].map((one) => one[1].trim());

/* To the next heading of any depth: a section name with nothing under it is no section. */
const sectionUnder = (body, wanted) => {
  const found = [...String(body).matchAll(HEADING)].find((one) => wanted.test(one[1]));
  if (!found) return null;
  const from = found.index + found[0].length;
  const rest = String(body).slice(from);
  const next = /^#{1,6}[ \t]+/mu.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
};

const hasLine = (text) =>
  String(text ?? "").split("\n").some((line) => line.replace(/^[-*\d.\s]+/u, "").trim().split(/\s+/u).length >= SUBSTANTIAL);

const CODE_SPAN = /`([^`\n]+)`/gu;
const VERB_SPAN = /^forge[ \t]+[a-z][\w-]*/u;
const IDENTIFIER = /[_./]|^--/u;

/** A code span with no space in it, or one opening with this CLI's own name: a bare English word
 *  names nothing and a search on one answers with the backlog. */
export const tokensNamed = (body, most = TOKENS) => {
  const found = [];
  for (const [, span] of String(body).matchAll(CODE_SPAN)) {
    const one = span.trim();
    const named = VERB_SPAN.exec(one)?.[0] ?? (/\s/u.test(one) || !IDENTIFIER.test(one) ? null : one);
    if (named && !found.includes(named)) found.push(named);
  }
  return found.slice(0, most);
};

const MODAL = /\b(?:should|must|shall|needs? to|ought to)\b/iu;
const JOIN = " and ";
const SENTENCE = /[^.!?\n]+[.!?]/gu;
const firstSpan = (text) => [...text.matchAll(CODE_SPAN)].map((one) => one[1].trim())[0] ?? null;

/** An `and` with a claim on either side, each naming a different thing. Two claims about one token
 *  are one change described twice, and without that second name a lexical read cannot tell two
 *  clauses of one outcome from two outcomes. */
export const twoChangesIn = (body) => {
  for (const [sentence] of String(body).matchAll(SENTENCE)) {
    for (let at = sentence.indexOf(JOIN); at >= 0; at = sentence.indexOf(JOIN, at + 1)) {
      const left = sentence.slice(0, at);
      const right = sentence.slice(at + JOIN.length);
      const [one, two] = [firstSpan(left), firstSpan(right)];
      if (MODAL.test(left) && MODAL.test(right) && one && two && one !== two) {
        return { sentence: sentence.trim(), named: [one, two] };
      }
    }
  }
  return null;
};

const PARTS_LINE = /\b(?:parts?|children|sub-?issues?|split into|consists of|made up of)\b/iu;
const KEY = /\b[A-Za-z]+-\d+\b/gu;

/** Naming others as its parts is the split rule, not a filing: two keys on the line, because one is
 *  a citation and every identifier of the requirements tree wears an issue key's shape. */
export const partsIn = (body) => {
  for (const line of String(body).split("\n")) {
    const keys = [...new Set((line.match(KEY) ?? []))];
    if (PARTS_LINE.test(line) && keys.length >= 2) return { line: line.trim(), keys };
  }
  return null;
};

const TITLE_WORD = /[A-Za-z][A-Za-z'-]*/gu;
const PATH_IN_TITLE = /[\w.@-]*\/[\w./-]+|\.(?:mjs|cjs|js|jsx|ts|tsx|md|json|html|css|py|sh|ya?ml)\b/u;
const WORK_VERB = new Set(
  ("fix fixes fixed update updates updated add adds added remove removes removed delete deletes "
    + "change changes changed rename renames move moves refactor refactors replace replaces improve "
    + "improves tweak tweaks correct corrects handle handles support supports implement implements "
    + "make makes makeover do does drop drops restore restores split splits extend extends").split(" "),
);
const CARRIER = new Set("a an the to for of in on at and or it its this that".split(" "));

const need = (read, wants, clear) => ({ read, wants, clear });
/* The shape is the tracker's own tool description: a description is a requirements contract. Its
   writing-an-issue guide states an older six-block form, which `forge guide` no longer serves, so
   no line below sends a reader to a guide — what to add is the way out. */
const RESEND = "and re-send the same command";
const RETITLE = '--title "<what is true after the change>"';

const titleGaps = (title) => {
  const words = String(title).match(TITLE_WORD) ?? [];
  const out = [];
  if (words.length < 2) {
    out.push(need(`the title \`${title}\``, "a sentence saying the behaviour after the change, not one word", RETITLE));
  } else if (words.every((one) => CARRIER.has(one.toLowerCase()) || WORK_VERB.has(one.toLowerCase()))) {
    out.push(need(`the title \`${title}\``, "what is true after the change, which a work verb alone never says", RETITLE));
  }
  if (PATH_IN_TITLE.test(String(title))) {
    out.push(need(`a file path in the title \`${title}\``, "the behaviour, and the path in the body where a reader can act on it", RETITLE));
  }
  return out;
};

const namesKind = (kind) => kind !== null && kind !== undefined;
const VOWEL = /^[aeiou]/iu;
const article = (word) => (VOWEL.test(word) ? "an" : "a");

/* Whether the section is there, and the text under it for the line that says what was read. */
const held = (text, section) => {
  const under = sectionUnder(text, section.heading);
  const spoken = section.spoken?.test(text) ?? false;
  const ok = spoken || (section.substantial ? hasLine(under) : Boolean(under?.trim()));
  return { under, ok };
};

const readFor = (section, under, among) => {
  if (under !== null) {
    const floor = section.substantial ? ` of ${SUBSTANTIAL} words or more` : "";
    return `${article(section.bare)} ${section.bare} heading with nothing under it${floor}`;
  }
  const spoken = section.spoken ? ", and no line saying there is none" : "";
  return `no heading naming ${section.reads}, ${among}${spoken}`;
};

/* A heading already there is the one read: `sectionUnder` takes the first of its family, so adding
   a second would leave the thin one answering and the refusal would not clear. */
const clearFor = (section, under) => {
  if (under === null) return `add \`${section.add}\` ${RESEND}`;
  const floor = section.substantial ? `one line of ${SUBSTANTIAL} words or more` : "one line";
  return `write ${floor} under the ${section.bare} heading already there ${RESEND}`;
};

const sectionGaps = (text, shape, among) =>
  shape.needs.flatMap((section) => {
    const { under, ok } = held(text, section);
    return ok ? [] : [need(
      readFor(section, under, among),
      `${section.wants}, required of ${article(shape.kind)} ${shape.kind}`,
      clearFor(section, under),
    )];
  });

/** Every gap the body decides with no tracker read, and the one line a shortfall no gap refuses
 *  earns. `fix` is returned rather than refused: what clears it is the route the caller named.
 *  `everySection` is for a filing with no such route and no light path — docs/cli/feedback.md. */
export const shapeOf = ({ title, body, kind = null }, { everySection = false } = {}) => {
  const text = String(body ?? "");
  const written = text.replace(FENCE, "").replace(MARK, "").trim();
  if (!written) {
    return { gaps: [need(`${text.length} character(s) of body and no text in them`, "the issue itself: "
      + "what is true after the change, the rule that says so, and what is out of scope",
      "write the body to a file and name it, or pipe it in")], fix: false, tokens: [], said: null };
  }
  const gaps = titleGaps(title ?? "");
  const split = twoChangesIn(text) ?? null;
  const parts = partsIn(text);
  if (split) {
    gaps.push(need(
      `one sentence asking for two changes — "${split.sentence}"`,
      `one change per issue: a sibling for ${split.named.join(" and ")}, each body naming the others`,
      "file each of them on its own, one `forge new` per change",
    ));
  }
  if (parts) {
    gaps.push(need(`a line naming ${parts.keys.join(" and ")} as this issue's parts`,
      "the parts themselves as issues, each naming the others", "file each part on its own, and confirm this one as the first of them"));
  }
  const tokens = tokensNamed(text);
  /* Before the mark, which exempts the sections and not the set: a kind nobody has decided the
     sections of is not made one by the filing calling itself small. Presence, never truth — a
     payload may carry the field as `""`, which is a value nobody defined and not an absence. */
  if (namesKind(kind) && !KIND_NAMES.includes(kind)) {
    gaps.push(need(`a kind of \`${kind}\`, which this CLI does not define`, KIND_WANTS,
      `set the kind to one of ${KIND_NAMES.join(", ")} ${RESEND}`));
    return { gaps, fix: false, tokens, said: null };
  }
  if (!everySection) {
    if (isFix(text)) return { gaps, fix: false, tokens, said: null };
    if (tokens.length && !held(text, SCOPE).ok && !sectionUnder(text, RULES.heading)) {
      return { gaps, fix: true, tokens, said: null };
    }
  }
  const shape = shapeFor(kind);
  const headings = headingsOf(text);
  const among = headings.length
    ? `among ${headings.map((one) => `\`${one}\``).join(", ")}`
    : "and the body has no heading at all";
  gaps.push(...sectionGaps(text, shape, among));
  const left = shape.says.filter((section) => !held(text, section).ok);
  return { gaps, fix: false, tokens, said: noticeFor({ kind: shape.kind, named: namesKind(kind), left }) };
};

/** The newest page of issues still open to work, by title: the projection carries no description and
 *  the list offers no cursor, so the page alone is a floor. What reaches past it is the search
 *  below, and what neither reaches is said aloud. ISS-17 owes the cursor. */
export const liveTitles = async () => {
  const rows = rowsOf(await listIssues({}, MAX_LIMIT));
  return { live: openTitles(rows), short: truncated(rows, MAX_LIMIT) };
};

/** At the threshold this repository's own documents are held to, so one measure covers both. */
export const duplicateOf = ({ title, body }, live, threshold = DEFAULT_OVERLAP_THRESHOLD) => {
  const theirs = live.filter((one) => one.title).map((one) => [one.issueId, one.title]);
  const mine = [["the title", String(title ?? "")], ...sentences(String(body ?? "")).map((one, at) => [`sentence ${at + 1}`, one])];
  const [worst] = findOverlapsAgainst(mine, theirs, { threshold });
  return worst ? { score: worst[0], where: worst[1][0], key: worst[2][0], title: worst[2][1] } : null;
};

const searched = async (token, most = CANDIDATES) => {
  const asked = Math.min(most + SETTLED.length, MAX_LIMIT);
  return openTitles(rowsOf(await listIssues({ search: token }, asked))).slice(0, most);
};

/* The page is a floor, and a search for a name is bound only by the tracker's own ceiling: what the
   body names is asked for by name, so a duplicate about the same thing is reachable past the page.
   A search that fails is not caught: swallowed, it would read as a backlog with nothing like this. */
const alsoNamed = async (tokens, live) => {
  const found = await Promise.all(tokens.map((one) => searched(one, SEARCHED)));
  const held = new Set(live.map((one) => one.issueId));
  const out = [];
  for (const one of found.flat()) {
    if (held.has(one.issueId)) continue;
    held.add(one.issueId);
    out.push(one);
  }
  return out;
};

const fixRoutes = (tokens, candidates) => [
  `  --into ISS-nn   post this body as a comment on that issue and file nothing`,
  `  --with ISS-nn   file it and relate it, so one branch, one review and one release carry both`,
  `  --size fix      file it marked, and the flow carries it on the light path`,
  candidates.length
    ? `Naming ${tokens[0]}, still open: ${candidates.map((one) => `${one.issueId} ${one.title}`).join("; ")}`
    : `No open issue names ${tokens[0]}, so --size fix is the route unless you know one.`,
].join("\n");

const rendered = (gaps) =>
  gaps.map((one) => `- read: ${one.read}\n  wants: ${one.wants}\n  clear: ${one.clear}`).join("\n");

const SHAPE_HEAD = "Hold — this files an issue the flow cannot carry. Each line below is what was read, "
  + "what the shape wants and the one command that clears it.";

export const shapeRefusal = ({ gaps }) =>
  (gaps.length ? [SHAPE_HEAD, rendered(gaps)].join("\n\n") : null);

/** The refusal, or null, and the guide with it. The read is handed in rather than taken: what a
 *  caller wants off one body may be this or the line `shapeOf` returns beside the gaps, and a body
 *  scanned twice for one filing is the reading done twice. Which way round matters — this asks the
 *  tracker what else is open, the line owes no such read, so the line is never fetched through here.
 *  `routed` is a route the command named and the body cannot show: a fix riding another issue's
 *  branch owes no mark, its flow being that issue's. */
export const refusalFrom = async (filing, { gaps, fix, tokens }, { routed = false } = {}) => {
  const owesRoute = fix && !routed;
  const { live, short } = await liveTitles();
  const wider = [...live, ...await alsoNamed(tokens, live)];
  if (short) {
    console.error(`the duplicate check read the newest ${MAX_LIMIT} issues and the tracker holds more, `
      + `with no cursor to page by: past that page it saw only what a search for ${tokens.join(", ") || "nothing"} `
      + "returned, so one sharing no such name is not measured");
  }
  const same = duplicateOf(filing, wider);
  const out = [...gaps];
  if (same) {
    out.unshift(need(
      `${same.where} of this filing, against ${same.key} \`${same.title}\`, overlapping at ${same.score.toFixed(2)}`,
      "one issue per problem",
      `forge new <body> --title "<title>" --into ${same.key}`,
    ));
  }
  if (!out.length && !owesRoute) return null;
  const routes = owesRoute ? fixRoutes(tokens, await searched(tokens[0]).catch(() => [])) : null;
  const head = owesRoute && !out.length
    ? `Hold — this body names ${tokens[0]}, carries no rule or invariant and no out-of-scope, and reads as a `
      + "fix: filed as a feature the flow costs a confirmation, a decision, a plan, criteria, a baseline, a "
      + "review, a verdict per criterion, a verification, a release note and eight transitions, and the mark "
      + "is what drops the decision, the plan and the note. Name a route:"
    : SHAPE_HEAD;
  return [head, out.length ? rendered(out) : null, routes].filter(Boolean).join("\n\n");
};

