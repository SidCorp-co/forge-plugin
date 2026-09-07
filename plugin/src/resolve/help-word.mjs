export const isHelpWord = (word) => word === "-h" || word === "--help";

export const wantsHelp = ([first]) => isHelpWord(first);

/* Two slots on a verb that takes a subject, and no more: null subject is the verb's own, and past a subject the verb has, the word is a value. docs/cli/the-primitives.md. */
export const helpAskedOf = ([subject, next], subs) => {
  if (isHelpWord(subject)) return { subject: null };
  if (isHelpWord(next) && subs.includes(subject)) return { subject };
  return null;
};
