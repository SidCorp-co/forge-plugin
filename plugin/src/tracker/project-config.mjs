/* What the project says about releasing, from the tracker's config and never re-declared in a
   checkout: the staging branch — the tracker's field alone calls it `baseBranch` — the production
   branch, and whether production deploys go unasked. Unread keeps today's behaviour, since no
   decision is not a decision to ship without a person: no slug, a refusal `scoped` softens, a
   config missing the fields, a null branch the schema forbids defaulting. docs/FORGE-CLI.md. */
import { once } from "../resolve/config.mjs";
import { slugIfAny } from "../resolve/settings.mjs";
import { scoped } from "./rpc.mjs";

export const CONFIG_SOURCE = "the tracker's project config";

export const releaseFrom = (config) => ({
  staging: config?.baseBranch ?? null,
  production: config?.productionBranch ?? null,
  autoProd: config?.pipelineConfig?.autoProdDeploy === true,
  from: CONFIG_SOURCE,
});

const readable = (policy) => Boolean(policy?.staging && policy?.production);

export const waitsForPerson = (policy) => {
  if (!readable(policy)) return true;
  if (policy.staging !== policy.production) return false;
  return !policy.autoProd;
};

export const releaseLine = (policy) => {
  if (!readable(policy)) return null;
  if (policy.staging !== policy.production) {
    return ["promotion", `to ${policy.production}, ${policy.autoProd ? "automatic" : "a person's, owed"}`];
  }
  return policy.autoProd ? ["review", "none, by project config"] : null;
};

export const releaseConflict = (policy) => {
  if (!policy?.autoProd || readable(policy)) return null;
  const unset = [!policy.staging && "staging", !policy.production && "production"].filter(Boolean);
  return `production deploys are automatic and the ${unset.join(" and the ")} branch is unset, so `
    + "nothing says where a release lands: a person's look is owed until the branch is set";
};

export const releasePolicy = once(async () => {
  if (!slugIfAny()) return null;
  const answer = await scoped("forge_config", { action: "get" }, true);
  return answer?.config ? releaseFrom(answer.config) : null;
});
