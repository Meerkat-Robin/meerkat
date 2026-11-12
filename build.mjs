// Writes the six site pages into site/ from one shared frame, so the top bar, head tags and
// footer never drift apart. Run: node build.mjs   (set SITE_URL once the domain is known)
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SITE = (process.env.SITE_URL || 'https://meerkatrobin.com').replace(/\/$/, '');
const V = 1; // bump to refresh cached css, js and the preview image
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'site');

const NAV = [
  ['index', 'The watch'],
  ['alarms', 'Alarms'],
  ['burrows', 'Burrows'],
  ['patch', 'Your patch'],
  ['how', 'How it scores'],
  ['token', '$MEERKAT'],
];
const href = (id) => (id === 'index' ? './' : `${id}.html`);

const pages = {
  index: {
    title: 'MEERKAT: when three insiders move at once, the mob stands up',
    desc: 'MEERKAT reads SEC Form 4 filings and raises an alarm when three or more insiders of one company trade the same way inside 14 days. Only stocks with a token on Robinhood Chain.',
    body: `
  <section class="dusk">
    <div class="wrap dusk-text">
      <p class="kicker">SEC Form 4 &rarr; stock tokens on Robinhood Chain</p>
      <h1>One insider is noise.<br><em>Three is an alarm.</em></h1>
      <p class="lede">Nobody reads insider filings. The meerkats do, all day. When three or more insiders of one company buy or sell inside 14 days, one of them stands up.</p>
      <div class="cta">
        <a class="btn solid" href="alarms.html">See every alarm</a>
        <a class="btn" href="patch.html">Check your wallet</a>
      </div>
    </div>
    <div class="dune-scroll"><div id="dune" class="dune"></div></div>
  </section>

  <div class="wrap">
    <section class="stats" id="stats"></section>

    <section>
      <div class="head"><h2>Standing right now</h2><p class="muted" id="updated"></p></div>
      <div class="alarms" id="top-alarms"><p class="muted">Watching…</p></div>
      <p class="more"><a href="alarms.html">All alarms from the last 90 days &rarr;</a></p>
    </section>

    <section class="trio">
      <a href="burrows.html"><h3>Burrows</h3><p>Every company with a stock token, and how many of its insiders traded lately.</p></a>
      <a href="patch.html"><h3>Your patch</h3><p>Paste a wallet. See which of your stock tokens have insiders moving together.</p></a>
      <a href="how.html"><h3>How it scores</h3><p>Five plain rules turn a cluster into a number from 30 to 100.</p></a>
    </section>
  </div>`,
  },

  alarms: {
    title: 'Insider cluster alarms | MEERKAT',
    desc: 'Every case in the last 90 days where three or more insiders of one company traded the same way inside 14 days, scored and linked to the SEC filings.',
    body: `
  <div class="wrap">
    <section>
      <p class="kicker">Last 90 days</p>
      <h1 class="page-title">Alarms</h1>
      <p class="lede" id="alarms-note">Three or more insiders of one company, trading the same way inside 14 days.</p>
      <div class="pills" id="alarm-filters"></div>
      <div class="alarms" id="alarm-list"><p class="muted">Watching…</p></div>
      <p class="fine">"Planned" marks trades made under a 10b5-1 plan, set up months earlier. They count for less in the score. Sells often bunch up after earnings, because that is when insiders are allowed to trade.</p>
    </section>
  </div>`,
  },

  burrows: {
    title: 'Burrows: insider activity by company | MEERKAT',
    desc: 'Every company with a stock token on Robinhood Chain, with the number of insiders who traded in the last 90 days and a timeline of their trades.',
    body: `
  <div class="wrap">
    <section>
      <p class="kicker">One burrow per stock token</p>
      <h1 class="page-title">Burrows</h1>
      <p class="lede">Every company with a stock token on Robinhood Chain. The number is how many different insiders traded in the last 90 days.</p>
      <div id="burrow-detail"></div>
      <div class="pills" id="burrow-filters"></div>
      <div class="burrows" id="burrow-grid"><p class="muted">Watching…</p></div>
    </section>
  </div>`,
  },

  patch: {
    title: 'Your patch: alarms on the stock tokens you hold | MEERKAT',
    desc: 'Paste a Robinhood Chain address and see which of its stock tokens have insiders buying or selling together. Read-only, nothing to sign.',
    body: `
  <div class="wrap">
    <section>
      <p class="kicker">Read-only, nothing to sign</p>
      <h1 class="page-title">Your patch</h1>
      <p class="lede">Paste a Robinhood Chain address. The meerkats look at the stock tokens in it and tell you where insiders are moving together.</p>
      <form class="lookup" id="patch-form">
        <input id="address" placeholder="0x… wallet address" autocomplete="off" spellcheck="false">
        <button class="btn solid" type="submit">Look</button>
        <button class="btn" type="button" id="connect">Use my wallet</button>
      </form>
      <div id="patch-result"></div>
    </section>
  </div>`,
  },

  how: {
    title: 'How the alarm is scored | MEERKAT',
    desc: 'What counts as an insider cluster, where the data comes from and how MEERKAT turns a cluster into a score from 30 to 100.',
    body: `
  <div class="wrap">
    <section>
      <p class="kicker">No black box</p>
      <h1 class="page-title">How it scores</h1>
      <p class="lede">An alarm is three or more different insiders of one company, trading the same way, inside 14 days. The score says how loud it is.</p>
      <table class="rules">
        <thead><tr><th>Rule</th><th>Points</th><th>Why</th></tr></thead>
        <tbody>
          <tr><td>Heads</td><td>30 to 54</td><td>30 for three insiders, 8 more for each extra one, up to six.</td></tr>
          <tr><td>Not planned</td><td>0 to 20</td><td>The share of insiders who traded outside a 10b5-1 plan. A planned sale was decided months ago.</td></tr>
          <tr><td>Top brass</td><td>10</td><td>A CEO, CFO, president or chair is among them.</td></tr>
          <tr><td>Tight</td><td>4 or 8</td><td>All trades inside nine days give 4, inside five days give 8.</td></tr>
          <tr><td>Buying</td><td>8</td><td>Insiders sell for many reasons. They buy for one.</td></tr>
        </tbody>
      </table>
      <p class="fine">80 and up: the whole mob is up. 60 to 79: standing tall. Below 60: heads up.</p>
    </section>

    <section>
      <div class="head"><h2>Where the data comes from</h2></div>
      <ul class="facts">
        <li><span>Trades</span>SEC Form 4, read from EDGAR. Only open-market buys and sells over $10K. Grants, option exercises, tax withholding and gifts are left out.</li>
        <li><span>Tokens</span>Robinhood's stock token registry on Robinhood Chain (chain 4663). A company without a token is not watched.</li>
        <li><span>Wallets</span>Balances are read live from Robinhood Chain when you press Look.</li>
        <li><span>Refresh</span>Filings are read once a day. A Form 4 is due within two business days of the trade.</li>
      </ul>
    </section>

    <section>
      <div class="head"><h2>What comes next</h2></div>
      <ol class="plan">
        <li class="now"><span>Now</span><h3>Watching</h3><p>Alarms, burrows, the wallet check.</p></li>
        <li><span>Next</span><h3>Calling</h3><p>Telegram alerts the moment a cluster forms on a token you hold.</p></li>
        <li><span>Later</span><h3>Keeping score</h3><p>What the stock did after each past alarm, so the rules can be judged.</p></li>
      </ol>
    </section>

    <section>
      <div class="head"><h2>Questions</h2></div>
      <div class="faq">
        <details><summary>Do I need $MEERKAT to use the site?</summary><p>No. Everything on it is free and needs no account.</p></details>
        <details><summary>Why are most alarms sells?</summary><p>Insiders are paid in stock and sell it all the time. Several buying at once is rare, which is why it gets extra points.</p></details>
        <details><summary>Does an alarm mean the stock will move?</summary><p>No. It means several people who know the company acted the same way at the same time. That is a fact from the filings, not a forecast.</p></details>
        <details><summary>Who can buy stock tokens?</summary><p>Stock tokens are issued by Robinhood Assets (Jersey) Limited. They are not available to US persons or in several other places, including the UK and Canada.</p></details>
        <details><summary>Is this investment advice?</summary><p>No. MEERKAT shows what public filings say. Following insiders can lose money.</p></details>
      </div>
    </section>
  </div>`,
  },

  token: {
    title: '$MEERKAT | MEERKAT',
    desc: '$MEERKAT is the token of MEERKAT, the insider cluster watch for stock tokens on Robinhood Chain. Fair launch on Pons.',
    body: `
  <div class="wrap">
    <section>
      <p class="kicker">Pons &middot; Robinhood Chain</p>
      <h1 class="page-title">$MEERKAT</h1>
      <p class="lede" id="token-note">The token of the watch. The site stays free for everyone.</p>
      <div class="ca-box" id="ca-box"></div>
      <div class="cta" id="token-links"></div>
    </section>
    <section>
      <div class="head"><h2>The numbers</h2></div>
      <ul class="facts" id="tokenomics"></ul>
    </section>
  </div>`,
  },
};

const frame = (id, p) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${p.title}</title>
  <meta name="description" content="${p.desc}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="MEERKAT">
  <meta property="og:title" content="${p.title}">
  <meta property="og:description" content="${p.desc}">
  <meta property="og:url" content="${SITE}/${id === 'index' ? '' : `${id}.html`}">
  <meta property="og:image" content="${SITE}/og-image.png?v=${V}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${p.title}">
  <meta name="twitter:description" content="${p.desc}">
  <meta name="twitter:image" content="${SITE}/og-image.png?v=${V}">
  <link rel="icon" href="logo.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;700&family=Fraunces:opsz,wght@9..144,600;9..144,800&display=swap">
  <link rel="stylesheet" href="styles.css?v=${V}">
</head>
<body class="page-${id}">
  <header class="top">
    <div class="wrap top-in">
      <a class="brand" href="./"><img src="logo.png" alt="" width="36" height="36"><span>MEERKAT</span></a>
      <nav>
        ${NAV.map(([n, label]) => `<a href="${href(n)}"${n === id ? ' aria-current="page"' : ''}>${label}</a>`).join('\n        ')}
      </nav>
      <div class="top-ca" id="top-ca"></div>
    </div>
  </header>
  <main>${p.body}
  </main>
  <footer>
    <div class="wrap">
      <div class="foot-links" id="foot-links"></div>
      <p>MEERKAT is not affiliated with Robinhood, Pons, the SEC, or any company shown. Data: SEC EDGAR, the Robinhood stock token registry and Robinhood Chain. Nothing here is investment advice.</p>
    </div>
  </footer>
  <script src="config.js?v=${V}"></script>
  <script src="app.js?v=${V}"></script>
</body>
</html>
`;

for (const [id, p] of Object.entries(pages)) await writeFile(path.join(out, `${id}.html`), frame(id, p));
console.log(`wrote ${Object.keys(pages).length} pages for ${SITE}`);
