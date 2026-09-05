export const NARRATES =
  /```|\bthe (?:function|regex|loop|variable|implementation|call site)\b|\bimplemented in\b|\bunder the hood\b|\binternally\b|\bin `[\w./-]+\.(?:mjs|js|ts)`/iu;

/* A flag since renamed reads exactly like one that works. The CLI's tables are the authority. */
const FORGE_CALL = /`forge ([a-z]+)((?:\s+(?:--?[\w-]+|<[^`>]*>|[\w.@/-]+))*)`/gu;
const ENV_VAR = /\bFORGE_[A-Z][A-Z_]*\b/gu;
const flagThen = (gap) => new RegExp(String.raw`(--[\w-]+)(?:${gap}([^\s-][^\s]*))?`, "gu");
const FLAG_VALUE = flagThen(String.raw`[ \t]+`);
const FLAG_OFFERS = flagThen(String.raw`[ \t]`);
const PROPOSAL = /^(?:#[^\n]*\n\s*)?\*\*Status: proposal for ((?:`forge [a-z]+`(?:,\s*)?)+)\.\*\*/u;

/* The same claim in the source, printed or in a comment: either sends the next reader to a command,
   and one the CLI lacks costs a round (ISS-65). A `${…}` is checked as nothing. */
const ARG = String.raw`(?:--?[\w-]+|<[^>\n]*>|\$\{[^}]*\}|\\?"[^"\n]*\\?"|'[^'\n]*'|[\w.@/=,'-]+)`;
const SOURCE_FORM = new RegExp(String.raw`forge ([a-z]+)((?:[ \t]+${ARG})*)`, "gu");
const QUOTED = /\\?"[^"\n]*\\?"|'[^'\n]*'/gu;

export const routeClaims = (text) => {
  /* A quoted value is data: read to find where the command ends, dropped before flags are counted. */
  const calls = [...String(text).matchAll(SOURCE_FORM)]
    .map(([, verb, rest]) => ({ verb, rest: (rest ?? "").replace(QUOTED, " ") }));
  return {
    calls,
    flags: calls.flatMap(({ verb, rest }) => flagsIn(verb, rest)),
    hows: calls.flatMap(({ rest }) => [...rest.matchAll(/--how\s+([a-z][\w-]*)/gu)].map((one) => one[1])),
    envs: [],
  };
};

const flagsIn = (verb, rest) =>
  [...rest.matchAll(FLAG_VALUE)].map(([, flag, value]) => ({ verb, flag, value: value ?? null }));

export const docClaims = (text) => {
  const calls = [...text.matchAll(FORGE_CALL)].map(([, verb, rest]) => ({ verb, rest: rest ?? "" }));
  return {
    calls,
    flags: calls.flatMap(({ verb, rest }) => flagsIn(verb, rest)),
    hows: calls.flatMap(({ rest }) => [...rest.matchAll(/--how\s+([a-z][\w-]*)/gu)].map((one) => one[1])),
    envs: [...new Set(text.match(ENV_VAR) ?? [])],
  };
};

/** A verb whose usage names no flag keeps them under a sub-verb, so its flags are not checked here. */
export const claimProblems = (text, held) =>
  problemsIn({ ...docClaims(text), proposed: proposedIn(text) }, held);

/* Strictly: a verb whose surface names no flag takes none, so an invented one is a finding. */
export const routeProblems = (text, held) => problemsIn(routeClaims(text), { ...held, strict: true });

const proposedIn = (text) =>
  [...(PROPOSAL.exec(text)?.[1] ?? "").matchAll(/`forge ([a-z]+)`/gu)].map((one) => one[1]);

/* A usage line writes a value it accepts verbatim and one the caller fills as `<word>`, so a bare
   lowercase word one space past a flag is a value that flag takes; padding is a detail line's prose,
   and one placeholder spelling means none is read off it. Unbracketed refuses a real route (ISS-118). */
const NAMES_A_VALUE = /^[a-z][a-z-]+$/u;

const valuesOffered = (usage, flag) => {
  const offered = new Set();
  let spelled = false;
  for (const [, name, value] of usage.matchAll(FLAG_OFFERS)) {
    if (name !== flag) continue;
    const written = (value ?? "").replaceAll(/[[\]]/gu, "").replace(/\.{3}$/u, "");
    const parts = written.split("|");
    if (written === "" || !parts.every((one) => NAMES_A_VALUE.test(one))) return null;
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
  for (const { verb, flag, value } of flags.filter((one) => verbs.includes(one.verb))) {
    const usage = usageOf(verb);
    /* Held to a boundary: `--den` is in `--deny` by substring, and a truncated flag is the drift. */
    const has = new RegExp(`${flag}(?![\\w-])`, "u").test(usage);
    if ((strict || usage.includes("--")) && !has) {
      out.push(`\`forge ${verb} ${flag}\` is in no usage line`);
      continue;
    }
    const offered = has && typedOut(value) ? valuesOffered(usage, flag) : null;
    if (offered && !offered.includes(value)) {
      out.push(`\`forge ${verb} ${flag} ${value}\` is no value it takes: ${offered.join(" or ")}`);
    }
  }
  for (const name of hows) if (!documented.includes(name)) out.push(`\`--how ${name}\` names no document`);
  for (const name of envs) if (!sources.includes(name)) out.push(`${name} is read by nothing`);
  return [...new Set(out)];
};
