export class Refused extends Error {}
export const refuse = (message) => {
  throw new Refused(message);
};

/** A value typed back into a command a reader pastes — a refusal's way out, a next page's call — kept
 *  bare where no shell would split or expand it and single-quoted everywhere else. */
export const typedBack = (value) => (/^[\w.:@/-]+$/u.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`);
