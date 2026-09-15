/* What a write's answer says beside the row, and why it is read here. docs/cli/one-transport.md. */
const sentence = (one) => {
  if (one === null || one === undefined) return "";
  return typeof one === "string" ? one : one.message ?? JSON.stringify(one);
};

export const warningsIn = (body) => {
  const held = body?.warnings;
  return (Array.isArray(held) ? held : [held]).map(sentence).filter((one) => one.trim() !== "");
};

export const sayDeclined = (key, bodies, unfence, say = console.error) => {
  for (const body of bodies) {
    for (const said of unfence(warningsIn(body))) say(`${key}: ${said}`);
  }
};
