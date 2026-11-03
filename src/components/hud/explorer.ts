/** Pure filtering for the Memory Explorer panel. */
export type Fact = { id: number; content: string; category: string; trust: number; recalls: number };

/** Keeps facts matching the search text, category (or "all") and minimum trust. */
export function filterFacts(facts: Fact[], q: string, cat: string, minTrust: number): Fact[] {
  const s = q.trim().toLowerCase();
  return facts.filter(
    (f) =>
      (cat === "all" || f.category === cat) &&
      f.trust >= minTrust &&
      (!s || f.content.toLowerCase().includes(s) || f.category.toLowerCase().includes(s)),
  );
}
