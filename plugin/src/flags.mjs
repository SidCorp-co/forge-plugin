/* Parsing `--name value` pairs, once. Two verbs grew their own copy of this loop and the second
   one silently dropped a flag whose value was missing, which reads as an unfiltered answer. */
import { fail } from "./settings.mjs";

export const flags = (argv, verb, boolean = []) => {
  const found = {};
  const pairs = argv.filter((argument) => !boolean.includes(argument));
  for (const flag of boolean) if (argv.includes(flag)) found[flag.slice(2)] = true;
  for (let index = 0; index < pairs.length; index += 1) {
    const key = pairs[index];
    if (!key.startsWith("--")) fail(`${verb}: expected a --flag, got \`${key}\`.`);
    if (key.includes("=")) {
      fail(`${verb}: write \`${key.split("=")[0]} <value>\`; --flag=value is not read.`);
    }
    const value = pairs[index + 1];
    if (value === undefined || value.startsWith("--")) fail(`${verb}: ${key} was given no value.`);
    found[key.slice(2)] = value;
    index += 1;
  }
  return found;
};
