/* One call aimed at another project, and nothing after it: docs/cli/one-call-elsewhere.md. The aim
   is this process's alone, held by `useProject`, so no file any other run reads is touched. */
import { FLAG_WORD, noValue, repeatedFlag } from "./flags.mjs";
import { AIMED_FROM, fail, useProject } from "./settings.mjs";

export const AIM_FLAG = "--project";

/** Takes `--project <slug>` out of a verb's argv wherever it stands, so a subject after it is still
 *  the subject, and aims this process at that slug. The slug is judged by the first call that needs
 *  the project's id, which refuses one this credential cannot see. */
export const aimedBy = (argv, verb) => {
  const rest = [];
  const named = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== AIM_FLAG) {
      rest.push(argv[index]);
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || FLAG_WORD.test(value)) fail(`${noValue(verb, AIM_FLAG, value)} Nothing was sent.`);
    named.push(value);
    index += 1;
  }
  if (named.length > 1) fail(repeatedFlag(verb, AIM_FLAG, named));
  const [slug = null] = named;
  if (slug === null) return { rest, slug };
  useProject({ slug, from: AIMED_FROM });
  console.error(`${verb}: aimed at project ${slug} for this call alone; nothing saved was changed.`);
  return { rest, slug };
};
