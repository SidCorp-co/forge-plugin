/* The one reading of this script's command line and the one table of what each verb takes: a verb
   reading its own argv dropped every token it did not name, so `ship -h` ran the release (ISS-301).
   No step runs from here, and what a verb does stays the top-level help's rather than copied. */
import { stop } from "../checkout.mjs";

const HELP = new Set(["-h", "--help"]);

const takes = (name, value, why) => ({ name, value, why, spare: value.startsWith("[") });

/** Each verb's signature, its flags with the help's line for each, and the bare words it reads; a
 *  value in brackets is spare. Help and reading are off this one table, so neither can miss a flag. */
export const VERBS = new Map([
  ["start", { signature: "start <ISS-nn> [slug]", flags: [], words: 2 }],
  ["ship", {
    signature: "ship [--from N] [--note S]",
    flags: [
      takes("--from", "N", "resume at step N, which a failed step prints for you"),
      takes("--note", "S", "the subject of the version commit, when the release has to make one"),
    ],
    words: 0,
  }],
  ["review", {
    signature: "review [--done [ref]]",
    flags: [takes("--done", "[ref]",
      "the mark moves to ref, and only ever from here; the first plant may default to HEAD")],
    words: 0,
  }],
]);

const WIDTH = 12;

export const flagLines = (flags) =>
  flags.map((one) => `  ${`${one.name} ${one.value}`.padEnd(WIDTH)} ${one.why}`);

export const verbUsage = (verb, self) => {
  const spec = VERBS.get(verb);
  return [
    `Usage: ${self} ${spec.signature}`,
    ...(spec.flags.length ? flagLines(spec.flags) : [`  ${verb} takes no flags.`]),
    `What ${verb} does, and the other verbs: ${self} -h`,
  ].join("\n");
};

const refuse = (verb, self, said) => stop(`${said}\n\n${verbUsage(verb, self)}`);

// A flag wanting a value takes what follows it, `-h` included; a spare one stops at the next flag.
const valueAt = (want, next) =>
  (!want.spare ? next : (next === undefined || next.startsWith("-") ? null : next));

/** Everything given, or null where help was asked for. An argument the verb does not take stops the
 *  script by name before step 1: dropped, a mistyped flag ran a release on the default it replaced. */
export const wanted = (verb, argv, self) => {
  const spec = VERBS.get(verb);
  const flags = new Map();
  const words = [];
  for (let at = 0; at < argv.length; at += 1) {
    const one = argv[at];
    if (HELP.has(one)) return null;
    if (!one.startsWith("-")) {
      words.push(one);
      continue;
    }
    const want = spec.flags.find((each) => each.name === one);
    if (!want) refuse(verb, self, `${verb} takes no \`${one}\`, and no step runs from a line this script did not read whole.`);
    const value = valueAt(want, argv[at + 1]);
    if (value === undefined) refuse(verb, self, `\`${one}\` takes the ${want.value} that follows it, and nothing follows it.`);
    if (value !== null) at += 1;
    flags.set(one, value);
  }
  if (words.length > spec.words) {
    refuse(verb, self, `${verb} takes ${spec.words} bare word(s) and was given ${words.length}; \`${words[spec.words]}\` is one too many.`);
  }
  return { flags, words };
};
