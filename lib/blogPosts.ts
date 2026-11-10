// Nov 10 2026: "Behind the Build" blog -- plain-words explainers of why each
// GreekNova screen exists and how to read it, aimed at new traders.
//
// Rules for every post (Manish's standing rules): educational only, no buy/sell
// language, and never any thresholds, cutoffs or formulas -- explain the idea
// and the meaning of tiers in words. A post only appears on the site when
// `published: true`; keep it false until Manish has approved the text.

export type Block =
  | { type: 'h'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }

export interface BlogPost {
  slug: string
  title: string
  summary: string
  date: string // YYYY-MM-DD
  readMins: number
  published: boolean
  body: Block[]
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'why-we-built-strike-stealth',
    title: 'Why we built Strike Stealth: spotting quiet positions before they get loud',
    summary: 'Sometimes one option strike quietly piles up a lot of open interest while the stock barely moves. Here is the thinking behind the screen that shows those moments.',
    date: '2026-11-10',
    readMins: 3,
    published: true,
    body: [
      { type: 'h', text: 'The problem' },
      { type: 'p', text: 'Open any F&O screener and you will see the same stocks: the ones already up 4%, already trending, already on everyone\'s Telegram. By then the interesting part is over.' },
      { type: 'p', text: 'We kept noticing something else. Sometimes a single option strike would quietly pile up a very large amount of open interest (OI) while the stock itself barely moved. No headline, no big candle. Someone was positioning, and the price had not yet reacted. Strike Stealth exists to show those quiet build-ups.' },
      { type: 'h', text: 'What "stealth" means here' },
      { type: 'p', text: 'A strike is "stealth" when a lot of new money has gone in while the price is still calm. Two things make it interesting:' },
      { type: 'ul', items: [
        'Size: the build is large compared with what that strike normally holds.',
        'Calm: the stock has not run away yet.',
      ] },
      { type: 'p', text: 'That is the whole idea. We do not predict direction. We point at where unusual activity is happening so you can look closer.' },
      { type: 'h', text: 'Reading a row' },
      { type: 'ul', items: [
        'Tier (Elite, Strong, Watch): how clear and how large the build looks. Elite is the rarest and strongest; Watch is "keep an eye on it".',
        'Buying or writing: a plain-words read of whether the money looks like it is buying the option or selling it. When that read disagrees with how the premium moved, we say so instead of forcing an answer.',
        'Since / steady: how long the build has been visible, and whether it is holding.',
      ] },
      { type: 'h', text: 'What it does not tell you' },
      { type: 'ul', items: [
        'It does not say the stock will go up or down.',
        'A big build can be a hedge, an arbitrage leg or a spread. One strike is never the full story.',
        'Always check the other legs, the futures and the news before drawing any conclusion.',
      ] },
      { type: 'h', text: 'How to use it in practice' },
      { type: 'ol', items: [
        'Start with the strongest tier and ask: is the stock still calm?',
        'Open the stock\'s full view and look at the neighbouring strikes.',
        'Compare with the futures OI and the day\'s price range.',
        'Treat it as a reason to study the stock, not a reason to trade it.',
      ] },
    ],
  },
]

export const publishedPosts = () =>
  BLOG_POSTS.filter(p => p.published).sort((a, b) => b.date.localeCompare(a.date))
