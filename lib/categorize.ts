export type Category = "sage" | "slate" | "rose" | "amber" | "lavender";

const RULES: { cat: Category; words: string[] }[] = [
  {
    cat: "sage",
    words: ["pick up", "buy", "groceries", "laundry", "dry clean", "errand", "clean", "cook", "dinner", "appointment", "doctor", "dentist", "car", "home", "fix"],
  },
  {
    cat: "slate",
    words: ["work", "budget", "hire", "meeting", "deadline", "project", "client", "email", "report", "invoice", "presentation", "boss", "team", "ship", "launch"],
  },
  {
    cat: "rose",
    words: ["tired", "feel", "anxious", "stressed", "sad", "happy", "why am i", "myself", "rest", "sleep", "energy", "burnout", "lonely", "overwhelmed", "self"],
  },
  {
    cat: "amber",
    words: ["call", "text", "message", "friend", "mom", "dad", "family", "birthday", "dinner with", "reach out", "invite", "party", "wedding"],
  },
  {
    cat: "lavender",
    words: ["idea", "want to", "someday", "learn", "read", "book", "creative", "write", "dream", "explore", "wonder", "what if", "maybe"],
  },
];

export function categorize(text: string): Category {
  const t = text.toLowerCase();
  let best: { cat: Category; score: number } = { cat: "lavender", score: 0 };
  for (const rule of RULES) {
    const score = rule.words.reduce((n, w) => (t.includes(w) ? n + 1 : n), 0);
    if (score > best.score) best = { cat: rule.cat, score };
  }
  return best.score > 0 ? best.cat : "lavender";
}

export const CATEGORY_BG: Record<Category, string> = {
  sage: "#D9F2E4",
  slate: "#DCEAF6",
  rose: "#F6D6DC",
  amber: "#F7E2C3",
  lavender: "#E6DDF6",
};

export const CATEGORY_FG: Record<Category, string> = {
  sage: "#2F5D4B",
  slate: "#35526B",
  rose: "#7A3B4D",
  amber: "#7A5330",
  lavender: "#4D3D7A",
};
