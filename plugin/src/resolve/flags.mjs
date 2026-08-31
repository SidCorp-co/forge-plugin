/* Parsing `--name value` pairs, once. Two of the three hand-rolled copies dropped a valueless
   flag silently, which reads as an unfiltered answer. */
import { fail } from "./settings.mjs";

export const flags = (argv, verb, boolean = []) => {
  const found = {};
  for (const flag of boolean) if (argv.includes(flag)) found[flag.slice(2)] = true;
  const pairs = argv.filter((argument) => !boolean.includes(argument));
  for (let index = 0; index < pairs.length; index += 1) {
    const key = pairs[index];
    if (!key.startsWith("--")) fail(`${verb}: expected a --flag, got \`${key}\`.`);
    if (key.includes("=")) fail(`${verb}: write \`${key.split("=")[0]} <value>\`; --flag=value is not read.`);
    const value = pairs[index + 1];
    if (value === undefined || value.startsWith("--")) fail(`${verb}: ${key} was given no value.`);
    found[key.slice(2)] = value;
    index += 1;
  }
  return found;
};

/* `flags` keeps only the last value of a repeated flag, which reads as a filtered answer rather
   than a dropped one. A caller that means "all of these" pulls them out first. */
export const pullRepeated = (argv, flag, verb) => {
  const values = [];
  const rest = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== flag) {
      rest.push(argv[index]);
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) fail(`${verb}: ${flag} was given no value.`);
    values.push(value);
    index += 1;
  }
  return { values, rest };
};

/* Positionals and flags interleave on a line like `consult a.mjs --diff --only major b.mjs`, and
   splitting on "starts with --" reads a flag's VALUE as a positional and hides it from the parser.
   So the boolean flags are declared and everything else consumes the token after it. */
export const partition = (argv, booleans = []) => {
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
    if (value !== undefined && !value.startsWith("--")) {
      flagArgv.push(value);
      index += 1;
    }
  }
  return { positionals, flagArgv };
};
