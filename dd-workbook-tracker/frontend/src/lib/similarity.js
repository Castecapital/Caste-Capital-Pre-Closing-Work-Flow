// Lightweight document-name similarity for the Internal/External DD list
// cross-linking suggestion (Step 3). Deliberately simple - normalized
// exact/substring match plus word-overlap (Jaccard) - since this only needs
// to surface candidates for a human to confirm with one click, not
// auto-link anything.

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // drop parenthetical asides ("(if applicable)")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordSet(text) {
  return new Set(normalize(text).split(" ").filter((w) => w.length > 2));
}

export function documentSimilarity(a, b) {
  if (!a || !b) return 0;
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  const wa = wordSet(a);
  const wb = wordSet(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let intersection = 0;
  for (const w of wa) if (wb.has(w)) intersection++;
  const union = wa.size + wb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function suggestLinks(item, candidates, { threshold = 0.5, limit = 3 } = {}) {
  return candidates
    .map((c) => ({ item: c, score: documentSimilarity(item.document, c.document) }))
    .filter((s) => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
