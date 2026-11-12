// Builds site/data/watch.json: clusters of insider trades (SEC Form 4) at companies that have
// a stock token on Robinhood Chain. A cluster is three or more different insiders trading the
// same way inside 14 days.
// Filings already read are remembered in site/data/seen.json, so a daily run only fetches new ones.
// Run: node scripts/fetch.mjs

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CLUSTER_DAYS, MIN_HEADS, day, clustersOf } from './clusters.mjs';

// SEC requires a descriptive User-Agent with contact details.
const SEC_UA = process.env.SEC_USER_AGENT || 'Meerkat filings watcher contact@meerkatrobin.com';
const ASSETS_URL = 'https://api.robinhood.com/rhj/assets';
const FEEDS_URL = 'https://reference-data-directory.vercel.app/feeds-robinhood-mainnet.json';
const CHAIN_ID = 4663;
const WINDOW_DAYS = 90; // how far back trades are kept
const MIN_VALUE = 10_000; // smaller tickets are mostly employee purchase plans
const MAX_FILINGS_PER_COMPANY = 150;
const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'site', 'data');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sec(url) {
  await sleep(120); // stay under SEC's 10 req/s limit
  const res = await fetch(url, { headers: { 'User-Agent': SEC_UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

async function loadTokens() {
  const { assets } = await (await fetch(ASSETS_URL)).json();
  const feeds = new Map();
  try {
    for (const f of await (await fetch(FEEDS_URL)).json()) {
      const m = f.name.match(/^Robinhood ([A-Z.]+)\s*[-/]\s*USD$/);
      if (m && f.proxyAddress && f.decimals === 8) feeds.set(m[1], f.proxyAddress);
    }
  } catch (err) {
    console.error(`no price feeds: ${err.message}`);
  }
  const tokens = [];
  for (const a of assets) {
    if (a.status !== 'ASSET_STATUS_ACTIVE') continue;
    const dep = a.deployments?.find((d) => d.chainId === CHAIN_ID);
    if (!dep) continue;
    tokens.push({
      symbol: a.tokenSymbol,
      name: a.tokenName.replace(/\s*•\s*Robinhood Token$/, ''),
      address: dep.contractAddress,
      feed: feeds.get(a.tokenSymbol) || null,
    });
  }
  return tokens.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}>\\s*(?:<value>)?\\s*([^<]*?)\\s*(?:</value>|</${name}>)`));
  return m ? m[1].replace(/&amp;/g, '&') : '';
};
const flag = (block, name) => /^(1|true)$/i.test(tag(block, name));
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s\-'.])([a-z])/g, (_, sep, c) => sep + c.toUpperCase());

// Form 4 lists people surname first ("COHEN RYAN"); entities keep their name as filed.
const ENTITY = /\b(L\.?P\.?|LLC|INC|LTD|TRUST|FUND|PARTNERS|CORP|HOLDINGS|CAPITAL|MANAGEMENT|FINANCIAL|GROUP|SPV|CO)\b/i;
const displayName = (raw) => {
  const name = titleCase(raw.trim());
  if (ENTITY.test(raw)) return name;
  const [last, ...rest] = name.split(/\s+/);
  return rest.length ? `${rest.join(' ')} ${last}` : name;
};

function role(xml) {
  const title = tag(xml, 'officerTitle');
  if (title) return title;
  if (flag(xml, 'isDirector')) return 'Director';
  if (flag(xml, 'isTenPercentOwner')) return '10% owner';
  return 'Insider';
}

// One filing can hold many fills of the same order, so trades are summed per direction.
function parseForm4(xml) {
  const sides = {};
  for (const [block] of xml.matchAll(/<nonDerivativeTransaction>[\s\S]*?<\/nonDerivativeTransaction>/g)) {
    const code = tag(block, 'transactionCode');
    // P and S are open-market trades; grants, option exercises, tax withholding and gifts are left out
    if (code !== 'P' && code !== 'S') continue;
    const shares = Number(tag(block, 'transactionShares'));
    const price = Number(tag(block, 'transactionPricePerShare'));
    if (!(shares > 0) || !(price > 0)) continue;
    const side = (sides[code] ||= { shares: 0, value: 0, date: '' });
    side.shares += shares;
    side.value += shares * price;
    const date = tag(block, 'transactionDate');
    if (date > side.date) side.date = date;
  }
  return Object.entries(sides).filter(([, s]) => s.value >= MIN_VALUE).map(([code, s]) => ({
    side: code === 'P' ? 'buy' : 'sell',
    shares: Math.round(s.shares),
    value: Math.round(s.value),
    date: s.date,
    owner: displayName(tag(xml, 'rptOwnerName')),
    role: role(xml),
    // sales under a 10b5-1 plan were scheduled months earlier
    planned: flag(xml, 'aff10b5One'),
  }));
}

await mkdir(dataDir, { recursive: true });
const readJson = (name, fallback) => readFile(path.join(dataDir, name), 'utf8').then(JSON.parse, () => fallback);
const cutoff = day(new Date().toISOString(), -WINDOW_DAYS);

const tokens = await loadTokens();
const old = await readJson('watch.json', { trades: [] });
const seen = new Set(await readJson('seen.json', []));
const trades = old.trades.filter((t) => t.filed >= cutoff);
for (const t of trades) seen.add(t.acc);

const tickers = Object.values(await (await sec('https://www.sec.gov/files/company_tickers.json')).json());
const cikByTicker = new Map(tickers.map((t) => [t.ticker, String(t.cik_str).padStart(10, '0')]));
const inWindow = new Set();
let fetched = 0;

for (const token of tokens) {
  const cik = cikByTicker.get(token.symbol) || cikByTicker.get(token.symbol.replace('.', '-'));
  if (!cik) continue;
  try {
    const r = (await (await sec(`https://data.sec.gov/submissions/CIK${cik}.json`)).json()).filings.recent;
    let taken = 0;
    for (let i = 0; i < r.form.length && r.filingDate[i] >= cutoff && taken < MAX_FILINGS_PER_COMPANY; i++) {
      if (r.form[i] !== '4') continue;
      taken++;
      const acc = r.accessionNumber[i];
      inWindow.add(acc);
      if (seen.has(acc)) continue;
      const dir = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc.replace(/-/g, '')}`;
      // primaryDocument points at the styled view (xslF345X06/file.xml); the raw XML sits beside it
      const xml = await (await sec(`${dir}/${r.primaryDocument[i].replace(/^xsl[^/]+\//, '')}`)).text();
      fetched++;
      seen.add(acc);
      for (const t of parseForm4(xml)) {
        trades.push({ ...t, symbol: token.symbol, filed: r.filingDate[i], acc, url: `${dir}/${r.primaryDocument[i]}` });
      }
    }
  } catch (err) {
    console.error(`skipped ${token.symbol}: ${err.message}`);
  }
}

trades.sort((a, b) => b.date.localeCompare(a.date) || b.value - a.value);
const clusters = clustersOf(trades);

await writeFile(path.join(dataDir, 'watch.json'), JSON.stringify({
  updated: new Date().toISOString(), chainId: CHAIN_ID, windowDays: WINDOW_DAYS, clusterDays: CLUSTER_DAYS, minHeads: MIN_HEADS,
  tokens, clusters, trades,
}));
// forget filings that have left the window, so the list does not grow for ever
await writeFile(path.join(dataDir, 'seen.json'), JSON.stringify([...seen].filter((a) => inWindow.has(a))));

const buys = clusters.filter((c) => c.side === 'buy').length;
console.log(`${tokens.length} tokens, ${fetched} new filings read, ${trades.length} trades, ${clusters.length} clusters (${buys} buying)`);
