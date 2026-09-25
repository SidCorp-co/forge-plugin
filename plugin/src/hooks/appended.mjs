/* The lines the hook harness adds to a refusal a gate wrote, in one home: the harness prints them and
   the corpus reading has to see past them to the line that names the rule, so the two read one
   statement rather than a copy that drifts the next time either is reworded. */

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
