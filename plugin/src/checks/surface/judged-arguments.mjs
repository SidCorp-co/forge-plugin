/* An argument the surface invites, whose values this CLI already declares, judged here before the
   call is spent. Four sightings let another layer answer for one argument — `fs`, the tracker's
   option list, or nothing at all — and none of them knows this CLI has verbs, so none could carry
   the command that clears it (ISS-936). What this asks and what it leaves to the parser, to
   `notAPath` and to each verb's second page: docs/cli/the-usage-row.md. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { COMPLEXITY_NAMES } from "../../ladder.mjs";
import { DECLARES } from "../../tracker/routes.mjs";
import { KIND_NAMES } from "../../tracker/issue-shape.mjs";
import { VERBS } from "../../resolve/visibility.mjs";

export const JUDGE = "refuseUndeclared";
const JUDGE_ARITY = 4;
const VALUE_AT = 2;
const OPTIONS_AT = 3;

/* Keyed by the verb's own tool: `--kind` is a knowledge entry's kind on one verb, a category on another. */
const OWN_SETS = {
  "forge_issues.category": { held: "plugin/src/tracker/issue-shape.mjs KIND_NAMES",
    values: KIND_NAMES, spelt: "KIND_NAMES" },
  "forge_issues.complexity": { held: "plugin/src/ladder.mjs COMPLEXITY_NAMES",
    values: COMPLEXITY_NAMES, spelt: "COMPLEXITY_NAMES" },
};

const ALIAS = { statusNot: "status" };

/* Where a verb judges its own way; a rename leaves the slot unjudged rather than quietly excused.
   Each row is the whole statement of its judgement: `guard` where the call composes the sentence,
   `acts` where it answers with a value and a second statement is what acts on the answer. */
export const JUDGES = {
  "new.category": { call: "kindRefusal", ends: "fail(",
    guard: "category !== undefined && !KIND_NAMES.includes(category)",
    said: "the filing's own sentence, which says the body is read against the shape a kind names" },
  "new.complexity": { call: "complexityRefusal", ends: "fail(",
    guard: "complexity !== undefined && !COMPLEXITY_NAMES.includes(complexity)",
    said: "the filing's own sentence, which names the rung each complexity claims" },
  "new.priority": { call: "rankFor", ends: "fail(rank.refusal",
    acts: "if (rank.refusal) fail(rank.refusal.text);",
    said: "the rank resolved before the body, so an invalid one has consumed no stdin" },
};

/* What every judge of a verb has to come before, whichever judge it is. Why the filing's is the
   body read: `keepOnFailure`'s own comment in `plugin/src/commands.mjs`. */
const BOUNDS = { new: "bodyFrom(" };

/* A block naming none is a finding. The callee alone: a literal spelling the transport's call shape reads as a write. */
export const DISPATCHES = ["everyIssue", "fileAndSay", "uploadAll", "scoped", "write"];

const FLAG_ROW = /--[a-z][\w-]*/giu;
/* An alternation shares the value that closes it — `--blocks|--relates|--unlink ISS-46` — and a
   bracketed optional value is one. Anything else is a boolean, which gives nothing to judge. */
const ALTERNATION = /^(?:\|--[a-z][\w-]*)*/u;
const CARRIES_VALUE = /^ (?:[<"[]?[A-Za-z][\w.,|=<>@/~-]*)/u;

export const slotsIn = (usage) => {
  const found = [];
  for (const match of String(usage ?? "").matchAll(FLAG_ROW)) {
    const after = usage.slice(match.index + match[0].length);
    if (!CARRIES_VALUE.test(after.slice(ALTERNATION.exec(after)[0].length))) continue;
    found.push(match[0].slice(2));
  }
  return [...new Set(found)];
};

const rowFor = (verb) => VERBS.find(([name]) => name === verb);

/** Off the tool the verb owns, so nothing here lists a verb's arguments by hand. */
const setFor = (verb, name) => {
  const tool = rowFor(verb)?.[3];
  if (!tool) return null;
  const field = ALIAS[name] ?? name;
  const declared = DECLARES[tool]?.[field];
  if (Array.isArray(declared)) {
    return { held: `plugin/src/tracker/routes.mjs DECLARES.${tool}.${field}`,
      values: declared.map((one) => one?.name ?? one),
      spelt: `declaredFor("${tool}", "${field}")` };
  }
  return OWN_SETS[`${tool}.${field}`] ?? null;
};

/* One verb turns every declared filter into a flag, so `--statusNot` is a live slot on no usage row. */
const FILTERED_BY = "issue";
const filterSlots = () =>
  (DECLARES[rowFor(FILTERED_BY)?.[3]]?.filters ?? []).map((name) => ({ verb: FILTERED_BY, name }));

/** Every argument the surface invites: each verb's row, plus the filters one verb turns into flags. */
export const surfaceSlots = () => {
  const rows = VERBS.flatMap(([verb, usage]) => slotsIn(usage).map((name) => ({ verb, name })));
  const held = new Map([...rows, ...filterSlots()].map((one) => [`${one.verb}.${one.name}`, one]));
  return [...held.values()];
};

export const declaredSlots = () =>
  surfaceSlots().flatMap((slot) => {
    const set = setFor(slot.verb, slot.name);
    return set ? [{ ...slot, set }] : [];
  });

/* A slash opening a token is a regex; one after a value is division. */
const OPENS_A_REGEX = "([{:;,=!&|?+\n";
const closingAt = (text, from, quote) => {
  for (let at = from + 1; at < text.length; at += 1) {
    if (text[at] === "\\") at += 1;
    else if (text[at] === quote) return at;
  }
  return text.length - 1;
};

/** Comments and literal insides blanked to spaces — a judge commented out is no judge — keeping the
 *  length, so an index found here indexes the source too. */
export const masked = (text) => {
  const out = text.split("");
  const blank = (from, to) => {
    for (let at = from; at < to && at < out.length; at += 1) if (out[at] !== "\n") out[at] = " ";
  };
  /* A template's literal half is text and its holes are code, and the two nest: a quote in the text
     read as a delimiter blanked a call that runs, so the halves are walked rather than skipped. */
  const holes = [];
  let at = 0;
  let last = "\n";
  const inText = () => holes.at(-1) === 0;
  while (at < text.length) {
    const two = text.slice(at, at + 2);
    const one = text[at];
    if (inText()) {
      if (one === "\\") blank(at, at + 2);
      else if (one === "`") {
        holes.pop();
        /* Leaving a template leaves a value, so a slash after it is division. */
        last = "x";
      } else if (two === "${") {
        /* The hole's own braces go too, so its code counts for the depth its statement is at, and
           a hole opens an expression: what preceded the template cannot say what a slash in it is. */
        holes.push(1);
        blank(at, at + 2);
        last = "\n";
      } else blank(at, at + 1);
      at += two === "${" || one === "\\" ? 2 : 1;
      continue;
    }
    if (two === "//" || two === "/*") {
      const shut = text.indexOf(two === "//" ? "\n" : "*/", at + 2);
      const to = shut < 0 ? text.length : shut + (two === "//" ? 0 : 2);
      blank(at, to);
      at = to;
      continue;
    }
    if (one === "`") {
      holes.push(0);
      at += 1;
      continue;
    }
    if (holes.length && (one === "{" || one === "}")) {
      holes[holes.length - 1] += one === "{" ? 1 : -1;
      if (holes.at(-1) === 0) {
        holes.pop();
        blank(at, at + 1);
      }
      at += 1;
      continue;
    }
    if (one === '"' || one === "'" || (one === "/" && OPENS_A_REGEX.includes(last))) {
      const close = closingAt(text, at, one);
      blank(at + 1, close);
      at = close + 1;
      last = one === "/" ? "x" : one;
      continue;
    }
    if (!/\s/u.test(one)) last = one;
    at += 1;
  }
  return out.join("");
};

/* Balanced over the mask, so a paren inside a literal or a comment closes nothing. */
const spanAt = (mask, from, open = "(", shut = ")") => {
  let depth = 0;
  for (let at = from; at < mask.length; at += 1) {
    if (mask[at] === open) depth += 1;
    if (mask[at] === shut) {
      depth -= 1;
      if (depth === 0) return { from: from + 1, to: at };
    }
  }
  return null;
};

/* Top-level commas of one argument list, again over the mask. */
const argumentsIn = (mask, source, span) => {
  const held = [];
  let depth = 0;
  let start = span.from;
  for (let at = span.from; at < span.to; at += 1) {
    const one = mask[at];
    if ("([{".includes(one)) depth += 1;
    if (")]}".includes(one)) depth -= 1;
    if (one === "," && depth === 0) {
      held.push(source.slice(start, at).trim());
      start = at + 1;
    }
  }
  held.push(source.slice(start, span.to).trim());
  return held;
};

/* The expression one property of an object argument is given, or null where the object does not
   name it at its own top level: a substring of the whole argument was satisfied by a comment. */
const propertyOf = (source, key) => {
  const mask = masked(source);
  const span = spanAt(mask, mask.indexOf("{"), "{", "}");
  if (!span) return null;
  const shown = argumentsIn(mask, mask, span);
  /* A spread or a second `values` replaces the one named before it and JavaScript takes the last, so
     an object holding either is a shape this cannot read rather than one certified on its first. */
  const named = shown.filter((one) => one.startsWith(`${key}:`));
  if (shown.some((one) => one.startsWith("...")) || named.length > 1) return null;
  const at = shown.indexOf(named[0]);
  return at < 0 ? null : argumentsIn(mask, source, span)[at].slice(shown[at].indexOf(":") + 1).trim();
};

const NAMED = (name) => new RegExp(String.raw`(^|[^\w.])${name}\b|\.${name}\b`, "u");
const valuePassed = (text, name) => NAMED(name).test(masked(text));

const depthTo = (mask, upto) =>
  [...mask.slice(0, upto)].reduce((held, one) => held + (one === "{" ? 1 : (one === "}" ? -1 : 0)), 0);

const TABLE = "plugin/src/commands.mjs";
const inlineAt = (verb) => new RegExp(String.raw`^  ${verb}: (?:async )?\(`, "mu");

/** Where one verb's arguments are read, off the command table itself: a key with the body inline is
 *  read where it stands, and a shorthand key names the import that answers for it. */
export const sourceFor = (root) => {
  const table = readFileSync(join(root, TABLE), "utf8");
  return (verb) => {
    if (inlineAt(verb).test(table)) return table;
    const held = table.match(new RegExp(String.raw`^import \{[^}]*\b${verb}\b[^}]*\} from "\.(/[^"]+)"`, "mu"));
    return held ? readFileSync(join(root, "plugin/src", held[1]), "utf8") : null;
  };
};

/** One verb's entry where the command table holds the body, else the whole module: two verbs of one file are two blocks. */
export const blockFor = (text, verb) => {
  const mask = masked(text);
  const at = mask.search(inlineAt(verb));
  if (at < 0) return text;
  const span = spanAt(mask, mask.indexOf("{", at), "{", "}");
  return text.slice(at, span ? span.to : text.length);
};

/* Every call, not the first: a block judges several arguments and one of those calls took this one. */
const callsOf = (mask, source, call) => {
  const found = [];
  for (let at = mask.indexOf(`${call}(`); at >= 0; at = mask.indexOf(`${call}(`, at + 1)) {
    const span = spanAt(mask, at + call.length);
    if (span) found.push({ at, args: argumentsIn(mask, source, span) });
  }
  return found;
};

/* A judge reached on some paths only is no judge for the others, and a source position cannot tell
   the difference: so it opens its own statement — its line blank before it and the last one ended,
   which a braceless `if (…)` above it is not — at the depth the dispatch is written at. A verb
   judging its own way is held to the depth alone, its row carrying the statement instead. */
const CLOSED = /[;{}]$|\*\/$/u;
const opensAStatement = (mask, at) => {
  const lines = mask.slice(0, at).split("\n");
  if (!/^[ \t]*$/u.test(lines.at(-1) ?? "")) return false;
  const before = lines.slice(0, -1).reverse().find((one) => one.trim().length);
  return before === undefined || CLOSED.test(before.trim());
};

const runsBefore = (mask, at, depth, strict) =>
  depthTo(mask, at) === depth && (!strict || opensAStatement(mask, at));

const unbound = (block, { call, name, spelt, ends, guard, acts, protects }) => {
  const mask = masked(block);
  const before = protects && mask.includes(protects) ? mask.indexOf(protects) : Infinity;
  const spent = DISPATCHES.map((one) => mask.indexOf(`${one}(`)).filter((one) => one >= 0);
  if (!spent.length) {
    return `nothing this checker reads as spending the call is in the block, so it cannot say the `
      + `judgement comes first. It reads ${DISPATCHES.join(" ")}`;
  }
  const spends = Math.min(...spent);
  const depth = depthTo(mask, spends);
  const calls = callsOf(mask, block, call);
  if (!calls.length) return `no call of \`${call}\` appears where this verb reads its arguments`;
  const statement = acts || (guard && `if (${guard}) ${ends}${call}(${name})`);
  const said = statement ? mask.indexOf(statement) : -1;
  if (statement && said < 0) {
    return `\`${statement}\` is not in the block, and the judgement is that whole statement rather `
      + `than the part of it a scan can find: a further term on the condition judges fewer calls `
      + `for \`${name}\` while reading the same. Where the statement was only reformatted, change `
      + "this slot's JUDGES row to the statement as written and say why in the change";
  }
  /* Present is not reached, and neither is a second copy of it: one condition deeper, or past the
     boundary while a narrowed one runs, it reads identically and judges fewer paths. */
  if (statement && !runsBefore(mask, said, depth, true)) {
    return `\`${statement}\` is in the block, but not as a statement of the block the call is spent `
      + `in, so there are paths through this verb that reach the call without judging \`${name}\``;
  }
  const ended = (one) => (ends.at(-1) === "("
    ? mask.slice(0, one.at).trimEnd().endsWith(ends) && one.at < before
    : mask.indexOf(ends, one.at) > one.at && mask.indexOf(ends, one.at) < before);
  if (ends && !calls.some(ended)) {
    return `\`${call}\` is called there and \`${ends}…\` does not end the call on its answer`
      + `${protects ? ` before \`${protects}\`` : ""}, so that answer is read too late or not at all`;
  }
  const from = acts ? Math.min(...calls.map((one) => one.at)) : -1;
  if (statement && !(said > from && said < spends && said < before)) {
    return `\`${statement}\` is in the block but not where it runs — after \`${call}\`, and before `
      + `${protects ? `\`${protects}\` and ` : ""}the call is spent — so what judges the value ahead `
      + "of the call is some other spelling of it";
  }
  const arity = spelt ? JUDGE_ARITY : 1;
  const shaped = calls.filter((one) => one.args.length === arity);
  if (!shaped.length) {
    return `\`${call}\` is called ${calls.length} time(s) there and none of them takes the `
      + `${arity} argument(s) this checker can read, so it can say nothing about what they judge`;
  }
  const passes = (one) => valuePassed(one.args[spelt ? VALUE_AT : 0], name);
  const held = shaped.filter(passes);
  if (!held.length) {
    return `\`${call}\` is called there and \`${name}\` is the value handed to none of them, so `
      + "those calls judge something else";
  }
  const bound = spelt ? held.filter((one) => propertyOf(one.args[OPTIONS_AT], "values") === spelt) : held;
  if (!bound.length) {
    return `\`${call}\` is handed \`${name}\` there, and \`${spelt}\` is not the expression its `
      + "`values` is given, so the value is judged against some other slot's set";
  }
  const reached = bound.filter((one) => runsBefore(mask, one.at, depth, Boolean(spelt)));
  if (!reached.length) {
    return `\`${call}\` is handed \`${name}\` there, but not as a statement of the block the call is `
      + "spent in, so there are paths to that call which never judge it";
  }
  const first = Math.min(...reached.map((one) => one.at));
  if (first > spends) {
    return `\`${call}\` is called there, but after the call is spent, so the value has already gone `
      + "up and the answer a caller reads is whatever came back";
  }
  if (first > before) {
    return `\`${call}\` is called there, but after \`${protects}\`, which is what a judgement of `
      + "this verb has to come before";
  }
  return null;
};

/** One finding per such argument whose verb spends no judge on it; `source` answers with a verb's text. */
export const problems = (source) => declaredSlots().flatMap((slot) => {
  const own = JUDGES[`${slot.verb}.${slot.name}`];
  const call = own?.call ?? JUDGE;
  const text = source(slot.verb);
  if (text === null || text === undefined) {
    return [`forge ${slot.verb}: this checker could not read the source \`--${slot.name}\` is read in.`];
  }
  /* The row spreads, so a field added to JUDGES reaches the reader with no second edit here. */
  const why = unbound(blockFor(text, slot.verb),
    { ...own, call, name: slot.name, spelt: own ? null : slot.set.spelt, protects: BOUNDS[slot.verb] });
  if (!why) return [];
  return [`forge ${slot.verb} --${slot.name} takes one of ${slot.set.values.length} value(s) this CLI `
    + `declares at ${slot.set.held}, and ${why}. So a value outside that set is sent and whatever `
    + `answers composes the reply. Judge it before the call: \`${call}\`${own ? `, ${own.said}` : ""}.`];
});
