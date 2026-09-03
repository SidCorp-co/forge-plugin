/* The files a change can reach but did not touch: the unit is the symbol the change USES, not the
   one that changed. Rationale, and the cutoff's job: the blast-radius step in verification.md */

const IDENT = /[A-Za-z_$][A-Za-z0-9_$]{2,}/g;
// A capitalised word in a comment is shaped exactly like a type name, so shape decides.
const CODE_SHAPED = /[a-z][A-Z]|[_$]|[A-Za-z]\d/;

export function identifiers(text) {
  return new Set((text.match(IDENT) ?? []).filter((id) => CODE_SHAPED.test(id)));
}

export function diffIdentifiers(diff) {
  const changed = diff
    .split("\n")
    .filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---)/.test(line))
    .join("\n");
  return identifiers(changed);
}

export function commonnessCutoff(fileCount) {
  return Math.max(8, Math.ceil(fileCount * 0.02));
}

export function rank({ files, touched, wanted }) {
  const cutoff = commonnessCutoff(files.length);
  const spread = new Map();
  const perFile = new Map();
  for (const [path, text] of files) {
    const shared = [...identifiers(text)].filter((id) => wanted.has(id));
    perFile.set(path, shared);
    for (const id of shared) spread.set(id, (spread.get(id) ?? 0) + 1);
  }

  const reachable = [];
  for (const [path, shared] of perFile) {
    if (touched.has(path)) continue;
    const narrow = shared.filter((id) => spread.get(id) <= cutoff);
    if (narrow.length === 0) continue;
    const rarity = narrow.reduce((sum, id) => sum + 1 / spread.get(id), 0);
    // Rarest first: a shared framework type is why every file in the tree is on the list at all.
    narrow.sort((a, b) => spread.get(a) - spread.get(b) || a.localeCompare(b));
    reachable.push({ path, shared: narrow, score: narrow.length, rarity });
  }
  reachable.sort((a, b) => b.score - a.score || b.rarity - a.rarity || a.path.localeCompare(b.path));
  return { cutoff, reachable };
}
