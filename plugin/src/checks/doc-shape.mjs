export const NARRATES =
  /```|\bthe (?:function|regex|loop|variable|implementation|call site)\b|\bimplemented in\b|\bunder the hood\b|\binternally\b|\bin `[\w./-]+\.(?:mjs|js|ts)`/iu;

/* A flag since renamed reads exactly like one that works. The CLI's tables are the authority. */
const FORGE_CALL = /`forge ([a-z]+)((?:\s+(?:--?[\w-]+|<[^`>]*>|[\w.@/-]+))*)`/gu;
const ENV_VAR = /\bFORGE_[A-Z][A-Z_]*\b/gu;
const FLAG = /--[\w-]+/gu;
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
    flags: calls.flatMap(({ verb, rest }) => (rest.match(FLAG) ?? []).map((flag) => ({ verb, flag }))),
    hows: calls.flatMap(({ rest }) => [...rest.matchAll(/--how\s+([a-z][\w-]*)/gu)].map((one) => one[1])),
    envs: [],
  };
};

export const docClaims = (text) => {
  const calls = [...text.matchAll(FORGE_CALL)].map(([, verb, rest]) => ({ verb, rest: rest ?? "" }));
  return {
    calls,
    flags: calls.flatMap(({ verb, rest }) => (rest.match(FLAG) ?? []).map((flag) => ({ verb, flag }))),
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

const problemsIn = ({ calls, flags, hows, envs, proposed = [] }, { verbs, usageOf, documented, sources, strict = false }) => {
  const out = [];
  for (const { verb } of calls) {
    if (!verbs.includes(verb) && !proposed.includes(verb)) out.push(`\`forge ${verb}\` is no verb`);
  }
  for (const { verb, flag } of flags.filter((one) => verbs.includes(one.verb))) {
    const usage = usageOf(verb);
    /* Held to a boundary: `--den` is in `--deny` by substring, and a truncated flag is the drift. */
    const has = new RegExp(`${flag}(?![\\w-])`, "u").test(usage);
    if ((strict || usage.includes("--")) && !has) out.push(`\`forge ${verb} ${flag}\` is in no usage line`);
  }
  for (const name of hows) if (!documented.includes(name)) out.push(`\`--how ${name}\` names no document`);
  for (const name of envs) if (!sources.includes(name)) out.push(`${name} is read by nothing`);
  return [...new Set(out)];
};
