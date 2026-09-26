/* How a refusal ends a call, in a module that imports nothing, so a resolver the settings module
   itself imports can refuse through the same boundary rather than a copy of it: inside `refusing()` it
   throws, and outside it prints what a caller asked to keep before the exit (ISS-2612). */
/* Registered by a caller holding something no exit may lose — a body that arrived on stdin, or a
   line owed only once a write lands. Several, each dropped by the caller that registered it. */
const kept = [];

export const keepOnFailure = (text) => {
  const held = { text };
  kept.push(held);
  return () => {
    const at = kept.indexOf(held);
    if (at >= 0) kept.splice(at, 1);
  };
};

/** What `fail` throws inside `refusing`, where there is no process of this CLI's own to end — the release script files an issue mid-release, and an exit there leaves one half done. */
export class Refusal extends Error {}

let embedded = 0;

/** Inside `refusing()` the argv is the embedding script's, so nothing is built from it (ISS-842). */
export const embeddedRun = () => embedded > 0;

export const refusing = async (run) => {
  embedded += 1;
  try {
    return await run();
  } finally {
    embedded -= 1;
  }
};

export const fail = (message) => {
  if (embedded) throw new Refusal(message);
  console.error(message);
  for (const one of kept) console.error(one.text);
  process.exit(1);
};
