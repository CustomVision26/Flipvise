export type QuizTier = "low" | "mid" | "high";

export type QuizQuote = {
  text: string;
  author: string;
};

const quotesByTier: Record<QuizTier, QuizQuote[]> = {
  low: [
    {
      text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
      author: "Winston Churchill",
    },
    {
      text: "Our greatest weakness lies in giving up. The most certain way to succeed is always to try just one more time.",
      author: "Thomas A. Edison",
    },
    {
      text: "It does not matter how slowly you go as long as you do not stop.",
      author: "Confucius",
    },
    {
      text: "Every master was once a disaster. Keep showing up.",
      author: "David Bayer",
    },
    {
      text: "Mistakes are proof that you are trying.",
      author: "Jennifer Lim",
    },
    {
      text: "Fall seven times, stand up eight.",
      author: "Japanese Proverb",
    },
  ],
  mid: [
    {
      text: "The expert in anything was once a beginner.",
      author: "Helen Hayes",
    },
    {
      text: "You are closer than you think. Keep going.",
      author: "Unknown",
    },
    {
      text: "Progress, not perfection.",
      author: "Ryan Holiday",
    },
    {
      text: "Small steps every day add up to big results.",
      author: "Unknown",
    },
    {
      text: "The only way to do great work is to love what you are learning.",
      author: "Steve Jobs",
    },
    {
      text: "You are doing better than you think. One more round and you are there.",
      author: "Unknown",
    },
  ],
  high: [
    {
      text: "Excellence is not an act, but a habit.",
      author: "Aristotle",
    },
    {
      text: "Victory belongs to the most persevering.",
      author: "Napoleon Bonaparte",
    },
    {
      text: "You did not come this far to only come this far.",
      author: "Unknown",
    },
    {
      text: "Champions keep playing until they get it right.",
      author: "Billie Jean King",
    },
    {
      text: "The harder the battle, the sweeter the victory.",
      author: "Les Brown",
    },
    {
      text: "Mastery awaits on the other side of consistent effort — and you are there.",
      author: "Unknown",
    },
  ],
};

export function getQuizTier(percent: number): QuizTier {
  if (percent < 50) return "low";
  if (percent < 90) return "mid";
  return "high";
}

/**
 * Deterministically picks a quote for the given tier given a seed. We pass a
 * seed (usually the score + deck id + timestamp bucket) so refreshing the
 * results screen does not flicker through different quotes.
 */
export function pickQuoteForTier(tier: QuizTier, seed: number): QuizQuote {
  const pool = quotesByTier[tier];
  const idx = Math.abs(Math.floor(seed)) % pool.length;
  return pool[idx];
}

export function pickQuoteForPercent(percent: number, seed: number): QuizQuote & { tier: QuizTier } {
  const tier = getQuizTier(percent);
  const quote = pickQuoteForTier(tier, seed);
  return { ...quote, tier };
}
