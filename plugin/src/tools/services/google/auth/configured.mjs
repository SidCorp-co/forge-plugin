/* Which Google accounts this machine saved, and whether any of them or the environment's token would
   answer a call, read off forge's configuration and nothing else of the service. It stands alone
   because every verb asks it: the help hides a tool this machine cannot run, and a question every
   invocation asks may not load the service it is asking about. Which account answers: docs/cli/google.md. */
import { userConfig } from "../../../../resolve/config.mjs";

export const ENV_TOKEN = "FORGE_GOOGLE_ACCESS_TOKEN";

export const googleConfig = () => userConfig().google ?? {};

/* Read by name, being the one value here a configuration file cannot hold: a CI run has none. */
export const environmentToken = () => process.env.FORGE_GOOGLE_ACCESS_TOKEN || null;

export const savedAccounts = () => googleConfig().accounts ?? {};

export const defaultAccount = () => {
  const names = Object.keys(savedAccounts());
  const named = googleConfig().default;
  if (named && names.includes(named)) return named;
  return names.length === 1 ? names[0] : null;
};

/** Whether a call naming no account would find one to answer it: the environment's token, or a default. */
export const googleHeld = () => Boolean(environmentToken() || defaultAccount());
