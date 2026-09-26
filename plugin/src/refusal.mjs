export class Refused extends Error {}
export const refuse = (message) => {
  throw new Refused(message);
};

/** A value typed back into a command a reader pastes — a refusal's way out, a next page's call — kept
 *  bare where no shell would split or expand it and single-quoted everywhere else. */
export const typedBack = (value) => (/^[\w.:@/-]+$/u.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`);

/* The lines the hook harness adds to a refusal a gate wrote, in one home: the harness prints them and
   the corpus reading has to see past them to the line that names the rule. */

/** Said where a refused call held more than one command: the refusal refused all of it. */
export const WHOLE = "Nothing in this command ran, the parts before the refused one included, so it is re-sent whole.";

/** The route for a refusal the reader thinks wrong, once a session, naming the verb that files it. */
export const FILES_IT = (verb) => `Refused the wrong shape? That is a defect in this plugin and not a rule `
  + `to work around: \`forge ${verb} <note.md> --title "<one line>"\` files it.`;

const FILES_IT_OPENS = FILES_IT("").split("`")[0];

/** Whether a line of a refusal is one of these, rather than one the gate wrote. */
export const appendedLine = (line) => {
  const held = line.trim();
  return held === WHOLE || held.startsWith(FILES_IT_OPENS);
};

/* How a refusal ends a call, here where nothing is imported, so a resolver the settings module itself
   imports refuses through the same boundary rather than a copy of it: inside `refusing()` it throws,
   and outside it prints what a caller asked to keep before the exit (ISS-2612). What is kept is
   registered by a caller holding something no exit may lose — a body that arrived on stdin, or a
   line owed only once a write lands — several, each dropped by the caller that registered it. */
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
