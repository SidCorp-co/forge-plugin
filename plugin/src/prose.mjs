/* A reading of English and Vietnamese, apart from the shapes a record carries because it is a different thing to be wrong about.

   The criteria grammar the issue-flow guide states — one outcome per numbered line — read as far as a
   lexical pass can prove it, so `forge record criteria` refuses a line carrying two rather than warning
   about a word (ISS-483). Every shape below wants a subject and a verb after the coordinator, which is why the `and` inside a hyphenated slug and the one between two nouns are not among them (ISS-73). A wrong refusal costs the write, so the reading errs towards writing: no verb this table carries, no
   subject it can see, and the line stands. */
const GRAMMAR = {
  en: {
    coordinators: ["and", "or"],
    pronouns: ["it", "they", "this", "these", "those", "there", "he", "she", "we"],
    determiners: ["the", "a", "an", "its", "their", "his", "her", "our", "that", "each", "every",
      "no", "any", "one", "some", "both", "either", "neither", "another"],
    auxiliaries: ["is", "are", "was", "were", "has", "have", "had", "does", "do", "did", "can",
      "could", "will", "would", "shall", "should", "may", "might", "must"],
    /* A form that is also a common plural noun — passes, runs, reads, counts — is left out, and one
       that is here counts as a verb only where an opener follows it: `the median passes per run` is
       a noun phrase and `maps to the head` is a clause, and nothing else tells them apart. */
    verbs: ["names", "prints", "says", "refuses", "carries", "holds", "resolves", "maps", "shows",
      "hides", "fires", "reaches", "keeps", "judges", "earns", "owes", "asks", "cites", "quotes",
      "gives", "takes", "sits", "stands", "adds", "sends", "leaves", "makes", "opens", "closes",
      "treats", "covers", "follows", "matches", "spends", "renders", "records", "attaches"],
    openers: ["the", "a", "an", "its", "their", "his", "her", "our", "that", "each", "every", "no",
      "any", "one", "some", "both", "this", "these", "those", "it", "them", "they", "what",
      "nothing", "none", "to", "into", "onto", "as", "back"],
    modifiers: ["of", "per", "in", "for", "from", "with", "at", "on", "by", "under", "over",
      "about", "across", "between", "through", "without", "against", "within", "beside"],
    subordinators: ["when", "whenever", "if", "where", "wherever", "while", "unless", "until",
      "because", "since", "after", "before", "though", "although", "whether", "which", "who",
      "whom", "whose", "that", "as", "so", "once"],
    /* What a command's pass is said with, read only right after a declared gate command: a link
       verb opens a predicate that may run a few words before its verdict (`reports every step
       green`), and a verb outside it (`records no pass`) is a claim about what the gate does. */
    passing: {
      links: ["is", "are", "stays", "remains", "reports", "answers", "reaches", "ends", "comes",
        "turns", "goes", "runs", "finishes", "completes", "returns"],
      verdicts: ["passes", "pass", "passed", "green", "succeeds", "clean", "no failure", "no failures"],
      exits: ["exits 0", "exits zero"],
    },
    /* A bare count before `runs` names that many jobs or sessions as often as a repetition of one,
       so it counts only beside a pass word; a count carrying a repeat word counts on its own. */
    measured: {
      counts: ["two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven",
        "twelve", "fifteen", "sixteen", "twenty", "thirty", "forty", "fifty", "hundred"],
      repeats: ["consecutive", "successive", "repeated", "back-to-back"],
      runs: ["runs", "rounds", "times", "repetitions", "iterations", "copies"],
      row: "in a row",
      passes: ["passes", "pass", "passed", "green", "succeeds"],
      load: "load",
      under: "under",
      comparisons: ["of", "at", "under", "over", "above", "below", "≥", ">=", ">", "<", "≤"],
      workers: ["workers", "CPU-bound"],
      flags: ["--repeat-each", "--repeat", "--workers"],
    },
  },
};

import { escaped } from "./markdown.mjs";

/* One inline code span, built from once below: what `protectMachine` leaves inside one is what `planFlags` refuses to count, and one half saying so alone is not the rule (ISS-488). */
export const CODE_SPAN = "`[^`\\n]+`";
export const SPAN = new RegExp(CODE_SPAN, "gu");
const SPANS = new RegExp(`${CODE_SPAN}|"[^"\\n]*"|\\([^)\\n]*\\)`, "gu");
const BREAKS = /[,;:—]$/u;

const FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*(.*)$/u;

/** Each line with whether a fence holds it, openers and closers included: what a fence holds is text a
 *  document quotes and never structure it makes. Only markdown's own closer closes — the opener's
 *  character, at least its length, nothing after it — so a longer fence holds a shorter one whole. */
export const fenceMarked = (text) => {
  const out = [];
  let opener = null;
  for (const line of String(text ?? "").split(/\r?\n/u)) {
    const found = FENCE.exec(line);
    const closes = opener && found && found[1][0] === opener[0]
      && found[1].length >= opener.length && !found[2].trim();
    if (closes) opener = null;
    else if (found && !opener) opener = found[1];
    out.push({ line, fenced: Boolean(found ?? opener) });
  }
  return out;
};

export const blanked = (text, spans) => text.replace(spans, (span) => "·".repeat(span.length));
const masked = (text) => blanked(text, SPANS);

const tokensOf = (text) => {
  const out = [];
  let breakBefore = true;
  for (const found of masked(text).matchAll(/\S+/gu)) {
    const raw = found[0];
    out.push({ word: raw.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "").toLowerCase(), at: found.index, breakBefore });
    breakBefore = BREAKS.test(raw);
  }
  return out;
};

const verbAt = (tokens, index, g) => {
  const word = tokens[index]?.word;
  if (!word) return false;
  if (g.auxiliaries.includes(word)) return true;
  return g.verbs.includes(word) && g.openers.includes(tokens[index + 1]?.word ?? "");
};

const clauseAt = (tokens, index, g) => {
  const word = tokens[index]?.word;
  if (!word) return false;
  if (verbAt(tokens, index, g)) return true;
  if (g.pronouns.includes(word)) return verbAt(tokens, index + 1, g);
  if (!g.determiners.includes(word)) return false;
  for (let step = index + 1; step < tokens.length && step <= index + 4; step += 1) {
    const { word: next, breakBefore } = tokens[step];
    if (breakBefore || g.subordinators.includes(next) || g.modifiers.includes(next) || g.determiners.includes(next)) return false;
    if (verbAt(tokens, step, g)) return true;
  }
  return false;
};

const halvesAt = (text, tokens, index) => ({
  first: text.slice(0, tokens[index].at).replace(/[\s,;:—]+$/u, ""),
  second: text.slice(tokens[index + 1].at),
});

/* Two outcomes want a verb on each side — without the left one, `the list and the export are hidden` is one predicate over two subjects — and the second has to run to the end of the line, since a clause the line goes on past is as likely a condition among several. */
const outcomeAt = (tokens, index, g) => tokens.slice(0, index).some((one, at) => verbAt(tokens, at, g))
  && clauseAt(tokens, index + 1, g)
  && !tokens.slice(index + 1).some((one) => one.breakBefore);

const splitOf = (one, g) => {
  const tokens = tokensOf(one.text);
  let subordinate = false;
  for (let index = 0; index < tokens.length; index += 1) {
    const { word, breakBefore } = tokens[index];
    if (breakBefore) subordinate = false;
    if (g.subordinators.includes(word)) subordinate = true;
    if (subordinate || !g.coordinators.includes(word)) continue;
    if (outcomeAt(tokens, index, g)) return { number: one.number, ...halvesAt(one.text, tokens, index) };
  }
  return null;
};

/** Each criterion of `criteria` this grammar reads as two outcomes, with the halves it read. */
export const compoundCriteria = (criteria, language) => {
  const g = GRAMMAR[String(language ?? "en").slice(0, 2).toLowerCase()];
  if (!g) return [];
  return criteria.map((one) => splitOf(one, g)).filter(Boolean);
};

const grammarOf = (language) => GRAMMAR[String(language ?? "en").slice(0, 2).toLowerCase()] ?? null;

/* Text a criterion quotes is not its outcome: a criterion about the write quotes the line written. */
const QUOTED = /"[^"\n]*"|“[^”\n]*”/gu;
const unquoted = (text) => blanked(text, QUOTED);

const BEFORE = String.raw`(?<![\p{L}\d./:_-])`;
const AFTER = String.raw`(?![\p{L}\d./:_-])`;
const END = String.raw`(?![\p{L}\d_-])`;
const anyOf = (words) => words.map((one) => escaped(one).replace(/\s+/gu, String.raw`\s+`)).join("|");
const HELP = /(?:^|\s)(?:-h|--help)(?=\s|$)/u;

const gateReading = (gates, { passing }) => new RegExp(
  `${BEFORE}(?:${anyOf(gates)})((?:\\s+-[^\\s\`"')]*)*)${AFTER}[\`'")\\]]?[\\s,\u2014\u2013]*`
    + `(?:(?:${anyOf(passing.links)})\\s+(?:[^\\s,;:.]+\\s+){0,4}?)?[\`'"]?(?:${anyOf(passing.verdicts)}|${anyOf(passing.exits)})${END}`,
  "iu",
);

/** Each criterion whose outcome is one of `gates` passing, with the command it read: the command
 *  as the project declared it, then its own flags, then a pass. A help flag asks for the help and
 *  runs nothing; a language this table does not carry reads nothing. */
export const gatePassCriteria = (criteria, gates, language) => {
  const g = grammarOf(language);
  if (!g || !gates.length) return [];
  const reading = gateReading(gates, g);
  return criteria.flatMap((one) => {
    const found = reading.exec(unquoted(one.text));
    if (!found || HELP.test(found[1])) return [];
    return [{ ...one, gate: gates.find((gate) => found[0].toLowerCase().includes(gate.toLowerCase())) ?? gates[0] }];
  });
};

const measureReadings = ({ measured: m }) => {
  const count = `(?:[2-9]|[1-9]\\d+|${anyOf(m.counts)})`;
  const runs = `(?:[\\p{L}-]+\\s+)?(?:${anyOf(m.runs)})${END}`;
  return {
    always: [
      `${BEFORE}${count}\\s+(?:${anyOf(m.repeats)})\\s+${runs}`,
      `${BEFORE}${count}\\s+${runs}\\s+${anyOf([m.row])}${END}`,
      `${BEFORE}${anyOf([m.load])}s?(?:\\s+average)?\\s*(?:${anyOf(m.comparisons)})\\s*\\d`,
      `${BEFORE}${anyOf([m.under])}\\s+(?:[^\\s,;:.]+\\s+){0,3}?${anyOf([m.load])}s?${END}`,
      `${BEFORE}${count}\\s+(?:parallel\\s+)?(?:${anyOf(m.workers)})${END}`,
      `(?:${anyOf(m.flags)})(?![\\w-])`,
    ].map((one) => new RegExp(one, "iu")),
    bare: new RegExp(`${BEFORE}${count}\\s+${runs}`, "iu"),
    passes: new RegExp(`${BEFORE}(?:${anyOf(m.passes)})${END}`, "iu"),
  };
};

/** Each criterion measured over repeated runs or under load: evidence a builder gathers on its own
 *  machine and no judge observes on a deployment. */
export const measuredCriteria = (criteria, language) => {
  const g = grammarOf(language);
  if (!g) return [];
  const { always, bare, passes } = measureReadings(g);
  return criteria.filter((one) => {
    const text = unquoted(one.text);
    return always.some((reading) => reading.test(text)) || (bare.test(text) && passes.test(text));
  });
};
