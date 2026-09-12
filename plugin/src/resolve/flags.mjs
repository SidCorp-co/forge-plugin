/* The argv this call carries: parsing `--name value` pairs, once, refusing a name the verb does not take, and writing the call back out for a refusal that has to name it. A flag is one word with no `=` in it, and the set a verb takes is read off the usage text its own `-h` prints, so a flag added there is taken with no second edit — docs/cli/did-you-mean.md. */
import { typed } from "../hooks/shell-spans.mjs";
import { didYouMean } from "../suggest.mjs";
import { embeddedRun, fail } from "./settings.mjs";

export const FLAG_WORD = /^--[^\s=]*$/u;

export const noValue = (verb, flag, value) =>
  (value === undefined
    ? `${verb}: ${flag} was given no value.`
    : `${verb}: ${flag} was given no value: \`${value}\` after it reads as the next flag, since a `
      + "flag is one word and that is one. A value saying more than the one word is taken as the "
      + `value, so write the sentence \`${value}\` belongs to.`);

/* A flag inside a quoted command belongs to that command: `record -h` points at `forge advance --owed`, and read as a declaration that line put --owed in the set `record` refuses against (ISS-700). */
const QUOTED_COMMAND = /`forge [^`]*`/gu;
/* And so does a flag on a second usage line: `cloudflare dns -h` prints the three routes that change a record under its own row, which put --content and --ttl in the set the listing takes and then ignores. The first line is the only one this name declares with. */
const ANOTHER_USAGE = /^[ \t]*Usage:/u;

const FLAG_NAMES = /--[a-z][\w-]*/gu;
const namesAFlag = (line) => line.replaceAll(QUOTED_COMMAND, " ").search(FLAG_NAMES) >= 0;

/* Held per text: a verb chaining pullRepeated, partition and flags hands each the same usage. */
const NAMED = new Map();
export const flagsNamed = (usage) => {
  if (!NAMED.has(usage)) {
    const [first, ...rest] = usage.split("\n");
    const mine = [first, ...rest.filter((line) => !ANOTHER_USAGE.test(line))].join("\n");
    NAMED.set(usage, [...new Set(mine.replaceAll(QUOTED_COMMAND, " ").match(FLAG_NAMES) ?? [])]);
  }
  return NAMED.get(usage);
};

/** The line a refusal quotes: a usage text is its first line and the rows under it. */
export const firstLine = (text) => String(text ?? "").split("\n")[0];

/* What a refused caller can type from. A record kind's first line is `forge record verdict <ISS-45> [...]`, whose fields are the rows under it, so printing the first line alone answered a refusal with a line naming no flag at all (ISS-700). A row is indented and names a flag of its own: the paragraph under `record -h` citing `forge advance --owed` is neither. */
const isRow = (line) => /^\s+\S/u.test(line) && namesAFlag(line);

const rowsOf = (usage) => {
  const [first, ...rest] = usage.split("\n");
  if (namesAFlag(first)) return first;
  return [first, ...rest.filter(isRow)].join("\n");
};

/** Only a flag SHAPE is turned away, and the usage rows close every one: the nearest name alone leaves a caller who was nowhere near a live flag nothing to type — docs/cli/did-you-mean.md. */
export const unknownFlag = (verb, argv, { usage, hidden = [], boolean = [] }) => {
  const named = flagsNamed(usage);
  const known = [...named, ...hidden, ...boolean];
  /* A flag word where a value goes is that value: the parse refuses the flag whose value is missing, which is the sentence that says how to write one starting `--`. */
  const spends = (token) => token !== undefined && known.includes(token) && !boolean.includes(token);
  const given = argv.find((token, at) => FLAG_WORD.test(token) && !known.includes(token) && !spends(argv[at - 1]));
  if (given === undefined) return null;
  const row = rowsOf(usage);
  /* No name at all, so no near miss answers it, and this is the one place that sentence lives. */
  if (given === "--") return `${verb}: \`--\` names no flag, and read as one it would take the next word as its value.\n${row}`;
  return `${didYouMean(`${verb} flag`, given, named)}\n${row}`;
};

/* Before a value is read and before an endpoint is resolved; no usage text is this CLI's defect. */
const strangerIn = (argv, verb, { usage, hidden = [], boolean = [] }) => {
  if (!usage) {
    fail(`${verb ?? "forge"}: this verb gave the parser no usage text, so no flag of it could be `
      + "judged. That is a defect in this CLI, not in what you typed: `forge feedback`.");
  }
  const said = unknownFlag(verb, argv, { usage, hidden, boolean });
  if (said) fail(said);
};

/* One value too many, where `noValue` is one too few: a dropped value leaves the caller a reply about what did move and nothing about what did not (ISS-930). */
export const repeatedFlag = (verb, flag, kept, given) =>
  `${verb}: ${flag} was given twice, \`${kept}\` and then \`${given}\`, and one flag carries one `
  + `value. Ask for the one you meant: \`${flag} <value>\`, once. Nothing was sent.`;

/* Which of a verb's flags carries a credential is the verb's own declaration, beside `boolean` and `hidden` and for the same reason: a second list here would drift from the row the caller was shown. A refusal naming the flag is the whole of what a caller needs, and both values printed is a token in a transcript. */
export const HIDDEN_VALUE = "***";

export const flags = (argv, verb, boolean = [], row = {}) => {
  strangerIn(argv, verb, { ...row, boolean });
  const found = {};
  for (const flag of boolean) if (argv.includes(flag)) found[flag.slice(2)] = true;
  const pairs = argv.filter((argument) => !boolean.includes(argument));
  for (let index = 0; index < pairs.length; index += 1) {
    const key = pairs[index];
    if (!key.startsWith("--")) fail(`${verb}: expected a --flag, got \`${key}\`.`);
    if (key.includes("=")) fail(`${verb}: write \`${key.split("=")[0]} <value>\`; --flag=value is not read.`);
    const value = pairs[index + 1];
    if (value === undefined || FLAG_WORD.test(value)) fail(noValue(verb, key, value));
    const name = key.slice(2);
    if (found[name] !== undefined) {
      const shown = (one) => ((row.secret ?? []).includes(key) ? HIDDEN_VALUE : one);
      fail(repeatedFlag(verb, key, shown(found[name]), shown(value)));
    }
    found[name] = value;
    index += 1;
  }
  return found;
};

/* First or not at all, unless the verb takes a subject, in which case the slot after one too — further along it is an argument, and help there is a write that never ran. Their home imports nothing, which is what lets the second CLI spend them: README, Layout. */
export { helpAskedOf, isHelpWord, wantsHelp } from "./help-word.mjs";

/* What the caller asked for, counted where argv is read, so the layer that reports on the work answers to the call rather than to its own input: a layer given a narrowed instruction cannot tell it was narrowed (ISS-945). `wordFor` is the ask's own vocabulary — how one thing a reporting layer holds is put into the words the ask was written in — so neither reporting layer chooses between the two. */
const askedFor = (verb, flag, items) => Object.freeze({
  verb, flag, items: Object.freeze([...items]), wordFor: ({ field, value }) => `${field}=${value}`,
});

/** The ask a caller names in its own source rather than off argv, written where the call is. It exists so that a writer reached with no ask and a writer reached with an ask of one are two different values, which is the whole of the rule — an absent record of the call reads exactly like a complete one. Several fields where one call writes several: the caller that names two and reaches the write with one is the shortfall this reports, and an ask of one could not tell it. */
export const askedInSource = (verb, ...fields) => Object.freeze({
  verb, flag: fields.join(" and "), items: Object.freeze(fields), wordFor: (one) => one.field,
});

/** What a reporting layer owes where fewer of the caller's words reached it than the call gave it: both counts and every word that went missing, whatever layer lost it. `held` is what reached the layer, each in whatever shape that layer holds one, and the ask words them. Occurrences are consumed rather than matched, so two identical asks are not answered by one thing. */
export const shortOfAsk = (ask, held) => {
  if (!ask) {
    return "This call reported on what the writer was handed and on nothing the caller typed, "
      + "because no record of what was asked for reached the layer that reports. Nothing was sent. "
      + "That is a defect in this CLI, not in what you typed: `forge feedback`.";
  }
  const left = held.map((one) => ask.wordFor(one));
  const lost = ask.items.filter((one) => {
    const at = left.indexOf(one);
    if (at >= 0) left.splice(at, 1);
    return at < 0;
  });
  if (!lost.length) return null;
  return `${ask.verb}: ${ask.flag} was given ${ask.items.length} thing(s) and ${held.length} reached `
    + `the write. ${lost.map((one) => `\`${one}\``).join(" and ")} did not. Nothing was sent. Ask for `
    + `what you meant, once each: \`${ask.flag} <value>\`. If that is what you typed, this CLI lost it `
    + "between your call and the write, which is its defect and not yours: `forge feedback`.";
};

/* `flags` refuses a name it has already bound, so this is the one declaration that a flag's values accumulate: a verb that means "all of these" pulls them out before handing the rest over. */
export const pullRepeated = (argv, flag, verb, row = {}) => {
  strangerIn(argv, verb, { ...row, hidden: [...(row.hidden ?? []), flag] });
  const values = [];
  const rest = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== flag) {
      rest.push(argv[index]);
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || FLAG_WORD.test(value)) fail(noValue(verb, flag, value));
    values.push(value);
    index += 1;
  }
  return { values, rest, ask: askedFor(verb, flag, values) };
};

/* Positionals and flags interleave (`consult a.mjs --diff --only major b.mjs`), and splitting on
   "starts with --" read a VALUE as a positional: so booleans are declared, and the rest consume. */
export const partition = (argv, booleans = [], row = {}) => {
  strangerIn(argv, row.verb, { ...row, boolean: booleans });
  const positionals = [];
  const flagArgv = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    flagArgv.push(token);
    if (booleans.includes(token)) continue;
    const value = argv[index + 1];
    if (value !== undefined && !FLAG_WORD.test(value)) {
      flagArgv.push(value);
      index += 1;
    }
  }
  return { positionals, flagArgv };
};

/** Two readings every verb's own flags needed. `exclusive`: the flags among `names` the caller gave, refused where two were, in the one sentence every such verb prints — `verb: --a and --b are separate <what>. Nothing was sent.` `pairOf`: `key=value` split on the first `=` only, so a value carrying one survives, and no key before it is refused naming the flag. */
export const exclusive = (asked, names, verb, what) => {
  const given = names.filter((one) => asked[one] !== undefined);
  if (given.length > 1) {
    fail(`${verb}: ${given.map((one) => `--${one}`).join(" and ")} are separate ${what}. Nothing was sent.`);
  }
  return given;
};

export const pairOf = (given, flag) => {
  const at = given.indexOf("=");
  if (at < 1) fail(`${flag} takes \`key=value\`, not \`${given}\`.`);
  return { key: given.slice(0, at), value: given.slice(at + 1) };
};

/* A flag stays bare, where quoting it would make a word the receiving parser no longer reads as one, and `null` inside `refusing()`, whose argv belongs to the embedding script and holds no part of this call (ISS-842). */
const word = (one) => (one.startsWith("--") && typed(one.slice(2)) === one.slice(2) ? one : typed(one));

export const typedArgv = () => (embeddedRun() ? null : process.argv.slice(2).map(word));

/** The whole of it, and `null` where there is none to name: a refusal handed no command says nothing rather than a `forge` with no verb behind it. */
export const thisCall = () => {
  const argv = typedArgv();
  return argv?.length ? ["forge", ...argv].join(" ") : null;
};
