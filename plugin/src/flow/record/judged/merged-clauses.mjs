/* The merged mark's clauses and the git form a caller types them in, apart from the verb that
   writes the mark: the transport names the form in a refusal, and the verb writes through the
   transport, so the table sits where both import it and neither imports the other. */

/** The word a clause carrying no path takes. Enumerated on the read, because `nothingness` and
 *  `nothing generated` are paths and a clause that parses to no path says nothing rather than none. */
export const NOTHING = "nothing";

const shaOf = (said) => new RegExp(String.raw`\b${said} ([0-9a-f]{7,40})\b`, "iu");
const clauseOf = (said) => new RegExp(String.raw`\b${said} ([^;\n]+)`, "iu");

/* One row per clause: the flag that writes it, the words it is written and read by, and what it
   holds. The order is the note's order, so the sentence is this table joined. */
export const CLAUSES = [
  { flag: "at", said: "at", label: "the sha the change landed at", commit: true },
  { flag: "reviewed", said: "reviewed head", label: "the head the review judged", commit: true },
  { flag: "judged", said: "judged head", label: "the head the verdicts judged", commit: true,
    none: "no verdict has judged any head yet" },
  { flag: "moved", said: "landing moved", label: "the paths of this change the landing moved, as git reads --wrote between --judged and --at", read: true },
  { flag: "wrote", said: "landing wrote", label: "the paths this change itself landed" },
].map((one) => ({ ...one, reads: one.commit ? shaOf(one.said) : clauseOf(one.said),
  ...(one.none ? { readsNone: new RegExp(String.raw`\b${one.said} ${NOTHING}\b`, "iu") } : {}) }));

/** The clauses a caller types. `landing moved` is not among them: the verb reads it from git, so a
 *  form carrying the flag would hand a run a value to guess at and a refusal to learn it from (ISS-2485). */
export const TYPED = CLAUSES.filter((one) => !one.read);

/* The flag of one clause with what it holds, as a form prints it. */
const flagSaid = (one) => `--${one.flag} <${one.label}>`;

/** The mark of a change that landed in git, every typed clause in the note's order. */
export const gitMarkForm = (ref) => `forge record merged ${ref} ${TYPED.map(flagSaid).join(" ")}`;
