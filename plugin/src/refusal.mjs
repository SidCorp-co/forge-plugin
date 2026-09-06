export class Refused extends Error {}
export const refuse = (message) => {
  throw new Refused(message);
};
