/** The words this CLI answers a help request to, and the same words as a pattern for the one reader
 *  that meets them as text rather than as a parsed word: the corpus classifier, asking of a recorded
 *  command line whether it read any help. Both spellings live here, because a second one there would
 *  report a surface this CLI does not serve, or miss one it does. */
export const HELP_WORDS = ["-h", "--help"];

/* The lookahead is closed rather than a list of the separators somebody thought of: a shell word
 *  ends at one of the three blanks a shell splits on, at one of these operators, or at the end, and
 *  every other character — `=`, a brace, a quote, a `$`, a dot — carries the word on, so `--help=x`,
 *  `-hv` and a filename opening `-h` are not this word. The three and not `\s`, for the reason
 *  `hooks/shell-spans.mjs` states where it makes the same distinction. */

/* The one exception is the one bash itself makes: `<(` and `>(` open a process substitution whose
 *  generated path joins onto the word before it, so `--help<(cmd)` reaches the CLI as
 *  `--help/dev/fd/63` and is no request. A plain redirection still ends the word. */
export const HELP_WORD_PATTERN = `(?:${HELP_WORDS.join("|")})(?=$|[ \\t\\n;|&)]|[<>](?!\\())`;

export const wantsHelp = ([first]) => HELP_WORDS.includes(first);

/* Two slots on a verb that takes a subject, and no more: null subject is the verb's own, and past a subject the verb has, the word is a value. docs/cli/the-primitives.md. */
export const helpAskedOf = ([subject, next], subs) => {
  if (HELP_WORDS.includes(subject)) return { subject: null };
  if (HELP_WORDS.includes(next) && subs.includes(subject)) return { subject };
  return null;
};
