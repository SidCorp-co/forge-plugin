/* One call aimed at another project, and nothing after it: docs/cli/one-call-elsewhere.md. The aim
   is this process's alone, held by `useProject`, so no file any other run reads is touched. */
import { FLAG_WORD, noValue, repeatedFlag } from "../flags.mjs";
import { AIMED_FROM, fail, useProject } from "../settings.mjs";

export const AIM_FLAG = "--project";

/** The `--project` pairs among a verb's words, and the words with them taken out wherever they
 *  stand, so a subject after one is still the subject. Nothing is refused or aimed here: the verb and
 *  the comment-delivery gate each read the same answer, so a shape one refuses is one the other
 *  does not hold (a gate holding it would answer before the verb's refusal). `bare` is the value that
 *  reads as none, a flag word or the end of the words. */
export const aimIn = (argv) => {
  const rest = [];
  const named = [];
  let bare = null;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== AIM_FLAG) {
      rest.push(argv[index]);
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || FLAG_WORD.test(value)) {
      bare = { value };
      continue;
    }
    named.push(value);
    index += 1;
  }
  return { rest, named, bare };
};

/** Takes the aim out of a verb's argv, refusing a repeat or a missing value before anything is
 *  sent, and aims this process at that slug. The slug is judged by the first call that needs the
 *  project's id, which refuses one this credential cannot see. */
export const aimedBy = (argv, verb) => {
  const { rest, named, bare } = aimIn(argv);
  if (bare !== null) fail(`${noValue(verb, AIM_FLAG, bare.value)} Nothing was sent.`);
  if (named.length > 1) fail(repeatedFlag(verb, AIM_FLAG, named));
  const [slug = null] = named;
  if (slug === null) return { rest, slug };
  useProject({ slug, from: AIMED_FROM });
  console.error(`${verb}: aimed at project ${slug} for this call alone; nothing saved was changed.`);
  return { rest, slug };
};
