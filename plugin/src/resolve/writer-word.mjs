/* This CLI's binary as a shell word, spelt once for every reader that asks of a command line whether
   it calls the binary. Two spellings of it in one file disagreed, and a word one took for a call and
   the other could not cover cost a run its whole grant (ISS-749). A later spelling fails
   plugin/test/checks/writer-word.test.mjs unless the line above it says why it reads differently. */

/* A path is any run of characters no operator or blank ends, closed by a slash: a word ending in the
   letters, `myforge` or `notes-for-forge`, has no slash to stand behind and is another word. */
const PATH = String.raw`[^ \t\n;&|()<>]*/`;

/** The word, from its first character to where a shell word ends: a blank, an operator, a quote or
 *  the end of the text. A dot, a slash, a hyphen or a letter carries the word on, so `forge.json`,
 *  `~/.config/forge/` and `forge-x` are other words. A quote ending it is the one place this reads
 *  wider than a shell, which takes `forge"x"` for `forgex`: counting that as a call errs toward the
 *  side that refuses a grant rather than the side that answers one nobody holds. */
export const WRITER_WORD = String.raw`(?:${PATH})?forge(?=$|[ \t\n;&|()<>"'])`;

/** Where a call of it may begin inside a command's text: at the text's start, after a blank or an
 *  operator, or after the quote or backslash a shell removes before it runs the word, so
 *  `bash -c 'forge …'` and `\forge` are calls. */
export const CALL_STARTS = String.raw`(?:^|[ \t\n;&|()"'\\])`;
