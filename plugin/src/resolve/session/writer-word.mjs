/* This CLI's binary as a shell word, spelt once for every reader asking whether a command line calls
   it: two spellings in one file disagreed, and a word one took for a call that the other could not
   cover cost a run its grant (ISS-749). plugin/test/checks/writer-word.test.mjs fails a later one. */

/* Any run of characters no operator or blank ends, closed by a slash, so `myforge` and
   `notes-for-forge` have no slash to stand behind and are other words. */
const PATH = String.raw`[^ \t\n;&|()<>]*/`;

/** The word ends where a shell word does, at a blank, an operator, a quote or the end, so a dot, a
 *  slash or a hyphen after the name makes another word. A quote ending it reads wider than a shell,
 *  which takes `forge"x"` for `forgex`, and errs toward refusing a grant rather than answering one. */
export const WRITER_WORD = String.raw`(?:${PATH})?forge(?=$|[ \t\n;&|()<>"'])`;

/** A call begins at the text's start, after a blank or an operator, or after the quote or backslash
 *  a shell removes, so `bash -c 'forge …'` and `\forge` are calls. Position is not read, so
 *  `echo forge` counts: a reading of the command word would miss `npx forge`, and a call missed runs
 *  without the name while the hook believes it holds it. */
export const CALL_STARTS = String.raw`(?:^|[ \t\n;&|()"'\\])`;
