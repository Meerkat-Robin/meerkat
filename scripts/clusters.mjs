// Finds insider clusters in a list of trades and scores them. Used by fetch.mjs.
export const CLUSTER_DAYS = 14; // all trades of a cluster fit in this many days
export const MIN_HEADS = 3;
export const day = (iso, plus = 0) => new Date(Date.parse(iso) + plus * 86400_000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400_000);

const BRASS = /\b(CEO|Chief Executive|CFO|Chief Financial|President|Chair)/i;

// Score out of 100. The parts are shown on the site, so keep them in step with how.html.
function score(heads, side, from, to) {
  const parts = {
    heads: Math.min(54, 30 + 8 * (heads.length - MIN_HEADS)),
    unplanned: Math.round((heads.filter((h) => !h.planned).length / heads.length) * 20),
    brass: heads.some((h) => BRASS.test(h.role)) ? 10 : 0,
    tight: daysBetween(from, to) <= 4 ? 8 : daysBetween(from, to) <= 8 ? 4 : 0,
    buy: side === 'buy' ? 8 : 0,
  };
  return { parts, total: Object.values(parts).reduce((a, b) => a + b, 0) };
}

// Walks one company's trades in one direction, oldest first. A cluster starts at a trade and takes
// every trade in the next CLUSTER_DAYS days; it counts when MIN_HEADS different insiders are in it.
function findClusters(symbol, side, trades) {
  const sorted = trades.slice().sort((a, b) => a.date.localeCompare(b.date));
  const clusters = [];
  for (let i = 0; i < sorted.length; ) {
    const end = day(sorted[i].date, CLUSTER_DAYS - 1);
    let j = i;
    while (j < sorted.length && sorted[j].date <= end) j++;
    const byOwner = new Map();
    const seenTrade = new Set();
    for (const t of sorted.slice(i, j)) {
      // related entities often report the very same trade in separate filings: count it once
      const key = `${t.date}:${t.shares}:${t.value}`;
      if (seenTrade.has(key) && !byOwner.has(t.owner)) continue;
      seenTrade.add(key);
      const h = byOwner.get(t.owner) || { owner: t.owner, role: t.role, shares: 0, value: 0, planned: true, date: t.date, url: t.url };
      h.shares += t.shares;
      h.value += t.value;
      h.planned = h.planned && t.planned;
      if (t.date >= h.date) { h.date = t.date; h.url = t.url; }
      byOwner.set(t.owner, h);
    }
    if (byOwner.size < MIN_HEADS) { i++; continue; }
    const heads = [...byOwner.values()].sort((a, b) => b.value - a.value);
    const from = sorted[i].date;
    const to = sorted[j - 1].date;
    const s = score(heads, side, from, to);
    clusters.push({ id: `${symbol}-${side}-${from}`, symbol, side, from, to, value: heads.reduce((a, h) => a + h.value, 0), score: s.total, parts: s.parts, heads });
    i = j;
  }
  return clusters;
}

// trades: [{ symbol, side, date, owner, role, shares, value, planned, url }]
export function clustersOf(trades) {
  const groups = new Map();
  for (const t of trades) {
    const key = `${t.symbol}|${t.side}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  return [...groups].flatMap(([key, list]) => findClusters(...key.split('|'), list))
    .sort((a, b) => b.to.localeCompare(a.to) || b.score - a.score);
}
