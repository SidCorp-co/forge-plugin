/* One filing's reply, for both verbs that file: a route contributes its opening line and what it does with a soft refusal, and every other line is the same on both. Why `route.mjs` under this neither prints nor exits, and why the id goes last: docs/cli/filing.md. */
import { fail, keepOnFailure } from "../../resolve/settings.mjs";
import { filedAs, keysOffered, rankSaid } from "../issue-shape.mjs";
import { commentLanded, issueLanded, sayLanded } from "./landed.mjs";
import { foldedInto, suggestionLines } from "./neighbours.mjs";
import { fileIssue } from "./route.mjs";

const sayBeside = (beside, said) => {
  for (const line of suggestionLines(beside, said)) console.log(line);
};

const echo = (answer) => console.log(JSON.stringify(answer, null, 2));

/* A route that names no `lost` is one whose filing the tracker does not soft-refuse, and a route
   wrong about that would read a refusal as a filing. So the default says it rather than crashing. */
const refused = (what, said) => fail(`the tracker refused ${what}: ${said}`);

/** `withKeys` are what `--with` named, offered back rather than written; `intro` is the one line a route speaks for itself; `lost` is what a route soft enough to see the tracker's own refusal does with it; `after` is a step on the issue once it exists — never on a fold, whose comment has no fields — handed the create's answer and answering with its lines, which print before the id line so that line stays last. */
export const fileAndSay = async (asked, { withKeys = [], intro = null, lost = refused, after = null } = {}) => {
  const filed = await fileIssue({ ...asked, onBeside: sayBeside });
  if (filed.refusal) fail(filed.refusal.text);
  if (filed.shape.said) console.error(filed.shape.said);
  if (filed.joined) {
    if (filed.answer?.refused) lost(`a comment on ${filed.joined.issueId}`, filed.answer.refused);
    keepOnFailure(null);
    echo(filed.answer);
    console.log(foldedInto(filed.joined, filed.answer));
    if (asked.module) {
      console.log(`No module was written: the filing folded onto ${filed.joined.issueId} as a comment, and a `
        + `comment carries none. The same call with \`--new\` files it as its own issue under ${asked.module.name}.`);
    }
    const { documentId, issueId } = filed.joined;
    return sayLanded(await commentLanded(documentId, filed.answer, issueId));
  }
  if (filed.answer?.refused) lost("this filing", filed.answer.refused);
  keepOnFailure(null);
  if (intro) console.log(intro);
  echo(filed.answer);
  /* Read before `after`, whose proposal writes the rank and size onto the row: read after it, a
     proposal would be compared with the create as if the tracker had stored something else. */
  const landed = await issueLanded(filed.answer, { module: asked.module ?? null, sent: filed.sent });
  console.log(filedAs(filed.answer, rankSaid(filed.ranked, landed)));
  for (const line of after ? await after(filed.answer) : []) console.log(line);
  const offered = keysOffered(filed.shape.keys, withKeys);
  if (offered) console.log(offered);
  return sayLanded(landed);
};
