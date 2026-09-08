export const NARRATES =
  /```|\bthe (?:function|regex|loop|variable|implementation|call site)\b|\bimplemented in\b|\bunder the hood\b|\binternally\b|\bin `[\w./-]+\.(?:mjs|js|ts)`/iu;

/* A flag since renamed reads exactly like one that works. The CLI's tables are the authority. */
const FORGE_CALL = /`forge ([a-z]+)((?:\s+(?:--?[\w-]+|<[^`>]*>|[\w.@/-]+))*)`/gu;
const ENV_VAR = /\bFORGE_[A-Z][A-Z_]*\b/gu;
const flagThen = (gap) => new RegExp(String.raw`(--[\w-]+)(?:${gap}([^\s-][^\s]*))?`, "gu");
const FLAG_VALUE = flagThen(String.raw`[ \t]+`);
const FLAG_OFFERS = flagThen(String.raw`[ \t]`);
const PROPOSAL = /^(?:#[^\n]*\n\s*)?\*\*Status: proposal for ((?:`forge [a-z]+`(?:,\s*)?)+)\.\*\*/u;

/* The same claim in source: a command the CLI lacks costs a round, and a `${…}` is checked as nothing (ISS-65). */
const ARG = String.raw`(?:--?[\w-]+|<[^>\n]*>|\$\{[^}]*\}|\\?"[^"\n]*\\?"|'[^'\n]*'|[\w.@/=,'-]+)`;
/* One command over two lines of one expression: stopping at the closing quote left the flags past the join judged by nothing, which reads exactly like a form that has none (ISS-700). */
const JOIN = String.raw`(?:[ \t]*[\x60"'][ \t]*\r?\n?\s*\+\s*[\x60"'][ \t]*)`;
const SOURCE_FORM = new RegExp(String.raw`forge ([a-z]+)((?:(?:[ \t]+|${JOIN})${ARG})*)`, "gu");
const JOINED = new RegExp(JOIN, "gu");
const QUOTED = /\\?"[^"\n]*\\?"|'[^'\n]*'/gu;

/* Help split per sub-verb and per kind puts a flag one level in from the verb — `--criterion` is verdict's, not record's. The first bare word only: past it, a bare
   word is a value (ISS-700); one space past a flag, it is a value that flag takes, since a usage line writes what it accepts verbatim and what the caller fills as `<word>` (ISS-118). */
const BARE_WORD = /^[a-z][a-z-]+$/u;
const rested = (verb, rest) => {
  const first = rest.trim().split(/\s+/u)[0] ?? "";
  return { verb, sub: BARE_WORD.test(first) ? first : null, rest };
};

const HOW = /--how\s+([a-z][\w-]*)/gu;

const flagsIn = (verb, sub, rest) =>
  [...rest.matchAll(FLAG_VALUE)].map(([, flag, value]) => ({ verb, sub, flag, value: value ?? null }));

/* The two walks differ in how a call is found and in whether an environment variable is a claim. */
const claimsFrom = (calls, envs) => ({
  calls,
  flags: calls.flatMap(({ verb, sub, rest }) => flagsIn(verb, sub, rest)),
  hows: calls.flatMap(({ rest }) => [...rest.matchAll(HOW)].map((one) => one[1])),
  envs,
});

/* The join goes first, or its own quote is read as one of theirs; a quoted value is data. */
export const routeClaims = (text) => claimsFrom(
  [...String(text).matchAll(SOURCE_FORM)]
    .map(([, verb, rest]) => rested(verb, (rest ?? "").replace(JOINED, " ").replace(QUOTED, " "))),
  [],
);

export const docClaims = (text) => claimsFrom(
  [...text.matchAll(FORGE_CALL)].map(([, verb, rest]) => rested(verb, rest ?? "")),
  [...new Set(text.match(ENV_VAR) ?? [])],
);

/* One document records what runs typed rather than telling a reader to type it, so a command right on the day it was written stays right and a rewrite falsifies the record. Three doc checks exempt it and each has its own predicate; the path itself is spelled here alone (ISS-616). */
export const RECORDS_RATHER_THAN_INSTRUCTS = /^docs\/issue-flow-dry-runs\.md$/u;

/** A verb whose usage names no flag keeps them under a sub-verb, so its flags are not checked here. */
export const claimProblems = (text, held) =>
  problemsIn({ ...docClaims(text), proposed: proposedIn(text) }, held);

/* Strictly: a verb whose surface names no flag takes none, so an invented one is a finding. */
export const routeProblems = (text, held) => problemsIn(routeClaims(text), { ...held, strict: true });

const proposedIn = (text) =>
  [...(PROPOSAL.exec(text)?.[1] ?? "").matchAll(/`forge ([a-z]+)`/gu)].map((one) => one[1]);

const valuesOffered = (usage, flag) => {
  const offered = new Set();
  let spelled = false;
  for (const [, name, value] of usage.matchAll(FLAG_OFFERS)) {
    if (name !== flag) continue;
    const written = (value ?? "").replaceAll(/[[\]]/gu, "").replace(/\.{3}$/u, "");
    const parts = written.split("|");
    if (written === "" || !parts.every((one) => BARE_WORD.test(one))) return null;
    spelled = true;
    for (const one of parts) offered.add(one);
  }
  return spelled ? [...offered] : null;
};

const typedOut = (value) => value !== null && !value.includes("$") && !value.startsWith("<");

const problemsIn = ({ calls, flags, hows, envs, proposed = [] }, { verbs, usageOf, documented, sources, strict = false }) => {
  const out = [];
  for (const { verb } of calls) {
    if (!verbs.includes(verb) && !proposed.includes(verb)) out.push(`\`forge ${verb}\` is no verb`);
  }
  /* Whole names, read once per surface: `--den` is in `--deny` by substring, and a truncated flag is the drift. */
  const named = new Map();
  const namedIn = (usage) => {
    if (!named.has(usage)) named.set(usage, new Set(usage.match(/--[\w-]+/gu) ?? []));
    return named.get(usage);
  };
  for (const { verb, sub, flag, value } of flags.filter((one) => verbs.includes(one.verb))) {
    const usage = usageOf(verb, sub);
    const under = [verb, sub].filter(Boolean).join(" ");
    const has = namedIn(usage).has(flag);
    if ((strict || usage.includes("--")) && !has) {
      out.push(`\`forge ${under} ${flag}\` is in no usage line`);
      continue;
    }
    const offered = has && typedOut(value) ? valuesOffered(usage, flag) : null;
    if (offered && !offered.includes(value)) {
      out.push(`\`forge ${under} ${flag} ${value}\` is no value it takes: ${offered.join(" or ")}`);
    }
  }
  for (const name of hows) if (!documented.includes(name)) out.push(`\`--how ${name}\` names no document`);
  for (const name of envs) if (!sources.includes(name)) out.push(`${name} is read by nothing`);
  return [...new Set(out)];
};
