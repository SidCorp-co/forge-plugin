/* Whether the facts a dispatcher left for an issue's judge name a requirement. A dispatcher's facts
   ride the lease (`forge claim ISS-nn --next "<facts>"`), never the brief, so a judge sent to judge a
   requirement's criterion under an issue's brief carries the requirement only there, and judged the
   issue's own criteria three times running. Read off the tracker at the dispatch. */
import { accountCredentials, projectAt, useProject } from "../resolve/settings.mjs";

const NAMED = /\bREQ-\d+\b/u;

/* A gate holds a dispatch while it reads, so one attempt on a short clock. */
const ONE_READ = { once: true, waits: 8 };

/** `{ named, next }` where the line the issue's lease carries names a requirement, `{ none: true }`
 *  where it names none, or `{ unread }` saying why nothing could be read. */
export const requirementInFacts = async (key, directory) => {
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
  const next = issue?.sessionContext?.lease?.next;
  const named = typeof next === "string" ? NAMED.exec(next)?.[0] : null;
  return named ? { named, next } : { none: true };
};
