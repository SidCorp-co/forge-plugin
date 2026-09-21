/* What Phase 7 asks the project a checkout names for, read off the release model that project
   already declared to the tracker — never off a fifth `stats.commands` label, which would make a
   project say the same thing twice in two places that could disagree (G-12, ISS-1975). The class
   table takes the answer and asks the tracker nothing itself: docs/cli/stats-the-landing.md. */
import { accountCredentials, projectAt, projectTarget, useProject } from "../../resolve/settings.mjs";
import { policyUnread, releasePolicy } from "../../tracker/project-config.mjs";

/** Where the tracker read of a NAMED checkout goes, or null for wherever the shell already points:
 *  `ISS-1` means one issue per project, so a reading of one project's runs against another's records
 *  is a figure about work nobody did. A checkout declaring no project contradicts nothing. */
export const scopeFor = (directory) => {
  const held = projectAt(directory);
  return held && held !== projectTarget().value
    ? { slug: held, from: `the project file under ${directory}` }
    : null;
};

/** Which answer Phase 7's act is, as the value a reading is held under. It is the ANSWER and not
 *  the model's own word, because two projects both declaring `none` part company on whether
 *  production deploys on its own: keyed on the word, a comparison would take the mean of two
 *  populations, one of them holding a row the other has not got (consult 0f85d2 F1). */
export const ACTS = {
  promotion: "a promotion the run commands, by the strategy the project declares",
  binding: "an act on this project's live deploy binding, which is a person's",
  deploy: "a deploy the project does not command, whose act is a wait on it and a read of what it "
    + "reports serving",
  none: "no release step at all, so the landing is the whole of this phase",
  undeclared: "nothing this CLI can name, this project having declared no release model it knows",
};

/** The one answer that puts an act nobody commands in the reading, and so the one that arms the
 *  row. Silence is a legitimate answer for a project that ships nothing, and for one whose release
 *  is a command: neither has an act to count here. */
const UNCOMMANDED = "deploy";

const PROMOTE = "promote";
const PUBLISH = "publish";
const NO_RELEASE = "none";

/* One walk, so the arming and what the reading says about it cannot disagree. `said` is carried only
   where it is the answer to a question the key cannot hold — which word this CLI did not recognise —
   and is null everywhere else rather than repeating what the key already says. */
export const phase7From = (policy) => {
  const why = policyUnread(policy);
  if (why) return { key: "undeclared", deploy: false, said: "the project config could not be read" };
  if (!policy) return { key: "undeclared", deploy: false, said: "this checkout names no project" };
  if (!policy.model) {
    return { key: "undeclared", deploy: false,
      said: policy.said ? `the release model \`${policy.said}\`, which this CLI does not know` : null };
  }
  if (policy.model === PROMOTE) return { key: "promotion", deploy: false, said: null };
  if (policy.model === PUBLISH && !policy.autoProd) return { key: "binding", deploy: false, said: null };
  if (policy.autoProd) return { key: UNCOMMANDED, deploy: true, said: null };
  /* `none` with no automatic production: nothing deploys, so there is no act to count. */
  return { key: NO_RELEASE, deploy: false, said: null };
};

export const NO_ENDPOINT = "no endpoint is saved on this machine, so nothing was asked";

/** What Phase 7 asks the project a named checkout belongs to for. Awaited once per reading and
 *  never per call, so the classifier stays a pure function of the words a run typed. */
/* The credential is asked for here and not left to the transport, for the reason and by the guard
   `readThreads` in ../eval/outcomes.mjs carries (ISS-1975, as ISS-487 for the eval). */
export const phase7For = async (directory) => {
  const account = accountCredentials();
  if (!account.url.value || !account.token.value) {
    return { key: "undeclared", deploy: false, said: NO_ENDPOINT };
  }
  const aimed = scopeFor(directory);
  if (aimed) useProject(aimed);
  return phase7From(await releasePolicy());
};

/** The line a reading prints for it, off the key a stored reading carries rather than off a policy
 *  it cannot go back and read, so a held reading says what it was taken under. */
export const actLines = (key, said = null) => {
  const held = ACTS[key];
  if (!held) return [];
  return [`phase 7 asks    ${held}${said ? `: ${said}` : ""}`
    + `${key === UNCOMMANDED ? ", counted in the `deploy` row" : ", and no row counts an act nobody commands"}`];
};
