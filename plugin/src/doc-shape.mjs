export const NARRATES =
  /```|\bthe (?:function|regex|loop|variable|implementation|call site)\b|\bimplemented in\b|\bunder the hood\b|\binternally\b|\bin `[\w./-]+\.(?:mjs|js|ts)`/iu;

/* A flag since renamed reads exactly like one that works. The CLI's tables are the authority. */
const FORGE_CALL = /`forge ([a-z]+)((?:\s+(?:--?[\w-]+|<[^`>]*>|[\w.@/-]+))*)`/gu;
const ENV_VAR = /\bFORGE_[A-Z][A-Z_]*\b/gu;
const FLAG = /--[\w-]+/gu;

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
export const claimProblems = (text, { verbs, usageOf, documented, sources }) => {
  const { calls, flags, hows, envs } = docClaims(text);
  const out = [];
  for (const { verb } of calls) if (!verbs.includes(verb)) out.push(`\`forge ${verb}\` is no verb`);
  for (const { verb, flag } of flags) {
    const usage = verbs.includes(verb) ? usageOf(verb) : "";
    if (usage.includes("--") && !usage.includes(flag)) out.push(`\`forge ${verb} ${flag}\` is in no usage line`);
  }
  for (const name of hows) if (!documented.includes(name)) out.push(`\`--how ${name}\` names no document`);
  for (const name of envs) if (!sources.includes(name)) out.push(`${name} is read by nothing`);
  return [...new Set(out)];
};
