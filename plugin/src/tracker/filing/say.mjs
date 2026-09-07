/* One filing's reply, for both verbs that file: a route contributes its opening line and what it does with a soft refusal, and every other line is the same on both. Why `route.mjs` under this neither prints nor exits, and why the id goes last: docs/cli/filing.md. */
import { fail, keepOnFailure } from "../../resolve/settings.mjs";
import { filedAs, inFlowWords, keysOffered } from "../issue-shape.mjs";
import { commentLanded, issueLanded, sayLanded } from "./landed.mjs";
import { foldedInto, suggestionLines } from "./neighbours.mjs";
import { fileIssue } from "./route.mjs";

const sayBeside = (beside, said) => {
  for (const line of suggestionLines(beside, said)) console.log(line);
};

const echo = (answer) => console.log(JSON.stringify(inFlowWords(answer), null, 2));

/* A route that names no `lost` is one whose filing the tracker does not soft-refuse, and a route
   wrong about that would read a refusal as a filing. So the default says it rather than crashing. */
const refused = (what, said) => fail(`the tracker refused ${what}: ${said}`);

/** `withKeys` are what `--with` named, offered back rather than written; `intro` is the one line a route speaks for itself; `lost` is what a route soft enough to see the tracker's own refusal does with it. */
export const fileAndSay = async (asked, { withKeys = [], intro = null, lost = refused } = {}) => {
  const filed = await fileIssue({ ...asked, onBeside: sayBeside });
  if (filed.refusal) fail(filed.refusal.text);
  if (filed.shape.said) console.error(filed.shape.said);
  if (filed.joined) {
    if (filed.answer?.refused) lost(`a comment on ${filed.joined.issueId}`, filed.answer.refused);
    keepOnFailure(null);
    echo(filed.answer);
    console.log(foldedInto(filed.joined));
    const { documentId, issueId } = filed.joined;
    return sayLanded(await commentLanded(documentId, filed.answer, issueId));
  }
  if (filed.answer?.refused) lost("this filing", filed.answer.refused);
  keepOnFailure(null);
  if (intro) console.log(intro);
  echo(filed.answer);
  console.log(filedAs(filed.answer, filed.ranked.said));
  const offered = keysOffered(filed.shape.keys, withKeys);
  if (offered) console.log(offered);
  return sayLanded(await issueLanded(filed.answer));
};
