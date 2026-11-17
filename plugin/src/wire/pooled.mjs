const AT_ONCE = 8;

export const pooled = async (items, each, width = AT_ONCE) => {
  const answered = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      answered[index] = await each(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, worker));
  return answered;
};
