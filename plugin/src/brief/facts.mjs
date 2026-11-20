/* The facts a dispatcher left for an issue's judge ride the issue's lease
   (`forge claim ISS-nn --next "<facts>"`), read off the tracker at the dispatch. `leaseFacts` reads the
   whole note, which the judge brief carries so a judge reading only the brief still has it (FB-30); a
   requirement named in that note stays a guard, since a judge briefed for an issue whose facts name a
   requirement would judge the issue's own criteria instead (K156, K158, K160). */
import { accountCredentials, projectAt, useProject } from "../resolve/settings.mjs";
import { ONE_READ } from "./waived.mjs";

const NAMED = /\bREQ-\d+\b/u;

// cm:edge contract -> plugin/src/tracker/routes.mjs — core's `delivery-policy.ts:judgedOnOf` reads `document.delivery.judgedOn` off `forge_config.document`; a document never declared names none, so its releases count a commit verdict (ISS-121)
const judgedOnOf = (held) => {
  if (held?.refused) return { refused: String(held.refused).split("\n")[0] };
  const named = held?.document?.delivery?.judgedOn;
  return typeof named === "string" && named ? named : null;
};

/** `{ next, named, status }` — the dispatcher's note off the issue's lease, the requirement it names
 *  and the issue's status, each `null` where absent, beside core's judged-build and the project's
 *  judgedOn where asked — or `{ unread }` saying why nothing could be read. */
export const leaseFacts = async (key, directory, { withJudged = false, aimed = null } = {}) => {
  const slug = aimed ?? (directory ? projectAt(directory) : null);
  // cm:why only the judge's brief asks for judged-build, and --project is its flag, so only it names the flag as the way to a reading (ISS-122, qa run 22c4f613)
  const aim = withJudged ? "; pass --project <slug>" : "";
  if (!slug) return { unread: `${directory ?? "this directory"} is in no checkout of a Forge project${aim}` };
  const { url, token } = accountCredentials();
  if (!url.value || !token.value) return { unread: "no Forge endpoint is saved" };
  // cm:guard an aimed brief keeps the aim `aimedBy` set; re-aiming at the directory here reads the wrong project's issue (FB-81)
  if (!aimed) useProject({ slug, from: `the directory the dispatch was made from, ${directory}` });
  const { documentIdIfAny } = await import("../tracker/issues.mjs");
  const { callTool } = await import("../tracker/rest.mjs");
  const { leaseRecordOf } = await import("../flow/lease.mjs");
  const found = await documentIdIfAny(key, { soft: true, ...ONE_READ });
  if (found.refused) return { unread: String(found.refused).split("\n")[0] };
  const issue = await callTool("forge_issues", { action: "get", documentId: found.id, fields: [] }, true, ONE_READ);
  if (issue?.refused) return { unread: String(issue.refused).split("\n")[0] };
  const raw = leaseRecordOf(issue?.sessionContext)?.next;
  const next = typeof raw === "string" && raw.trim() ? raw : null;
  const [judged, document] = withJudged
    ? await Promise.all([
      callTool("forge_issues.judged_build", { documentId: found.id }, true, ONE_READ),
      callTool("forge_config", { action: "document" }, true, ONE_READ),
    ])
    : [undefined, undefined];
  const status = typeof issue?.status === "string" ? issue.status : null;
  return { next, named: next ? NAMED.exec(next)?.[0] ?? null : null, status, judged, ...(withJudged ? { judgedOn: judgedOnOf(document) } : {}) };
};

/** The requirement guard's view of the lease: `{ named, next }`, `{ none: true }`, or `{ unread }`. */
export const requirementInFacts = async (key, directory) => {
  const facts = await leaseFacts(key, directory);
  if (facts.unread) return { unread: facts.unread };
  return facts.named ? { named: facts.named, next: facts.next } : { none: true };
};
