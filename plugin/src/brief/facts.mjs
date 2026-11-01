/* The facts a dispatcher left for an issue's judge ride the issue's lease
   (`forge claim ISS-nn --next "<facts>"`), read off the tracker at the dispatch. `leaseFacts` reads the
   whole note, which the judge brief carries so a judge reading only the brief still has it (FB-30); a
   requirement named in that note stays a guard, since a judge briefed for an issue whose facts name a
   requirement would judge the issue's own criteria instead (K156, K158, K160). */
import { accountCredentials, projectAt, useProject } from "../resolve/settings.mjs";
import { ONE_READ } from "./waived.mjs";

const NAMED = /\bREQ-\d+\b/u;

/** `{ next, named }` — the dispatcher's note off the issue's lease and the requirement it names if any,
 *  each `null` where absent — or `{ unread }` saying why nothing could be read. */
export const leaseFacts = async (key, directory) => {
  const slug = directory ? projectAt(directory) : null;
  if (!slug) return { unread: `${directory ?? "this directory"} is in no checkout of a Forge project` };
  const { url, token } = accountCredentials();
  if (!url.value || !token.value) return { unread: "no Forge endpoint is saved" };
  useProject({ slug, from: `the directory the dispatch was made from, ${directory}` });
  const { documentIdIfAny } = await import("../tracker/issues.mjs");
  const { callTool } = await import("../tracker/rest.mjs");
  const found = await documentIdIfAny(key, { soft: true, ...ONE_READ });
  if (found.refused) return { unread: String(found.refused).split("\n")[0] };
  const issue = await callTool("forge_issues", { action: "get", documentId: found.id, fields: [] }, true, ONE_READ);
  if (issue?.refused) return { unread: String(issue.refused).split("\n")[0] };
  const raw = issue?.sessionContext?.lease?.next;
  const next = typeof raw === "string" && raw.trim() ? raw : null;
  return { next, named: next ? NAMED.exec(next)?.[0] ?? null : null };
};

/** The requirement guard's view of the lease: `{ named, next }`, `{ none: true }`, or `{ unread }`. */
export const requirementInFacts = async (key, directory) => {
  const facts = await leaseFacts(key, directory);
  if (facts.unread) return { unread: facts.unread };
  return facts.named ? { named: facts.named, next: facts.next } : { none: true };
};
