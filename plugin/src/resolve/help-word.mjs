export const isHelpWord = (word) => word === "-h" || word === "--help";

export const wantsHelp = ([first]) => isHelpWord(first);
