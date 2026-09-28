/* `forge issue <ref> --redact`: the route that takes a test credential off what an issue's record
   already stores. Every write re-sends sessionContext whole, so a credential it once took stays on
   every later payload; the guard lets a re-sent copy go, and this is what removes it (ISS-1380). */
import { refuse } from "../refusal.mjs";
import { documentIdOf } from "../tracker/issues.mjs";
import { credentialHits, redactedCopy, stagingDeploy, unreadRefusal } from "../tracker/project-config.mjs";
import { FIELD, notAnothers, readContext, setLease } from "./lease.mjs";
import { correctionFor } from "./override.mjs";

/* Said whether or not anything was written, because a reader who finds the value somewhere else goes
   looking for the command that reaches it, and there is none here. */
const OUT_OF_REACH = `Only ${FIELD} as the tracker holds it now is rewritten here. An earlier copy `
  + "the tracker may keep is out of this CLI's reach, and a copy in a comment or in the description is "
  + "not rewritten by this flag.";

const why = (hits) => `it carried this project's ${[...new Set(hits.map((hit) => hit.credential))].join(", ")}, `
  + "which is read at the authentication step and echoed nowhere after it";

/** Masks every test credential the issue's stored sessionContext carries, and says what it did. */
export const redactStored = async (reference) => {
  const documentId = await documentIdOf(reference);
  const deploy = await stagingDeploy();
  if (deploy?.refused) refuse(unreadRefusal(deploy.refused, `The redaction of ${reference}`));
  const context = await readContext(documentId);
  const hits = credentialHits({ [FIELD]: context }, deploy);
  if (!hits.length) {
    console.log(`${reference}'s ${FIELD} carries none of this project's test credentials, so nothing was written.`);
    console.log(OUT_OF_REACH);
    return;
  }
  /* A compare-and-set under a live holder would refuse that holder's next renewal as another run's. */
  await notAnothers(documentId, reference);
  await setLease(documentId, redactedCopy(context, deploy), reference, () => context);
  for (const hit of hits) console.log(`${reference}  ${hit.field} redacted: it carried this project's ${hit.credential}`);
  console.log(OUT_OF_REACH);
  const moved = `${[...new Set(hits.map((hit) => hit.field))].join(", ")} redacted to \`[withheld]\` by \`forge issue --redact\``;
  await correctionFor(documentId, reference, moved, why(hits), { corrects: `issue:${FIELD}`, finder: true });
};
