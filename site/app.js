// MEERKAT site script, shared by every page. Each page only has some of the elements,
// so every block starts by checking that its element exists.
// Wrapped in an IIFE so nothing collides with globals that wallets inject.
(() => {
  const cfg = window.MEERKAT_CONFIG;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ext = 'target="_blank" rel="noopener"';

  const usd = (n) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
    return `$${Math.round(n)}`;
  };
  const date = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const span = (c) => (c.from === c.to ? date(c.from) : `${date(c.from)} to ${date(c.to)}`);
  const daysAgo = (iso) => Math.floor((Date.now() - Date.parse(iso)) / 86400_000);
  const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  const tokenUrl = (address) => `${cfg.explorer}/token/${address}`;
  const shareLink = (text) => `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.origin + location.pathname)}`;

  let data; // watch.json
  let tokenBySymbol;
  async function load() {
    const res = await fetch('data/watch.json');
    if (!res.ok) throw new Error(res.status);
    data = await res.json();
    tokenBySymbol = new Map(data.tokens.map((t) => [t.symbol, t]));
  }

  // A cluster is "standing" while its last trade is no older than the cluster window.
  const standing = (c) => daysAgo(c.to) <= data.clusterDays;
  const loud = (score) => (score >= 80 ? 'Whole mob up' : score >= 60 ? 'Standing tall' : 'Heads up');
  const verb = (c) => (c.side === 'buy' ? 'buying' : 'selling');
  const PART_LABELS = { heads: 'heads', unplanned: 'not planned', brass: 'top brass', tight: 'tight', buy: 'buying' };

  // standing meerkat in profile, drawn in a 512 box with its feet on the bottom edge
  const MEERKAT = '<circle cx="246" cy="132" r="15"/><path d="M236 512C228 430 224 350 236 290C232 262 232 236 240 214C226 196 222 168 232 146C244 116 278 102 310 110C334 116 350 132 362 150L404 176C408 188 400 198 386 198L332 204C318 212 310 226 308 244C312 262 318 276 322 292C344 330 350 380 342 430C338 460 336 490 336 512Z"/><path d="M318 304c32 10 48 30 44 56-6 8-18 6-22-2-2-16-14-28-32-34z"/>';

  async function copy(text, button) {
    const label = button.textContent;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Copy failed';
    }
    setTimeout(() => (button.textContent = label), 1500);
  }

  function renderChrome() {
    const ca = cfg.tokenAddress;
    const top = $('top-ca');
    if (ca) {
      top.innerHTML = `<button class="ca" title="Copy the $${esc(cfg.ticker)} address">$${esc(cfg.ticker)} ${short(ca)}</button>`;
      top.firstChild.addEventListener('click', (e) => copy(ca, e.currentTarget));
    } else {
      top.innerHTML = `<a class="ca soon" href="token.html">$${esc(cfg.ticker)} soon</a>`;
    }
    const links = [['X', cfg.links.x], ['Telegram', cfg.links.telegram], ['GitHub', cfg.links.github]].filter(([, url]) => url);
    $('foot-links').innerHTML = links.map(([label, url]) => `<a href="${esc(url)}" ${ext}>${label}</a>`).join('');
  }

  // ---- one alarm ----
  function alarmCard(c, open = false) {
    const token = tokenBySymbol.get(c.symbol);
    const parts = Object.entries(c.parts).filter(([, v]) => v > 0).map(([k, v]) => `<span>${PART_LABELS[k]} +${v}</span>`).join('');
    return `
    <details class="alarm ${c.side}${standing(c) ? ' up' : ''}"${open ? ' open' : ''}>
      <summary>
        <div class="score"><b>${c.score}</b><span>${loud(c.score)}</span></div>
        <div class="what">
          <h3><a href="burrows.html#${esc(c.symbol)}">${esc(c.symbol)}</a> <small>${esc(token?.name || '')}</small></h3>
          <p><strong>${c.heads.length} insiders ${verb(c)}</strong>, ${usd(c.value)} in total, ${span(c)}</p>
        </div>
        <div class="state">${standing(c) ? '<i>standing now</i>' : `<span>${daysAgo(c.to)} days ago</span>`}</div>
      </summary>
      <div class="inside">
        <table>
          <thead><tr><th>Insider</th><th>Role</th><th>Shares</th><th>Value</th><th>Last trade</th><th></th></tr></thead>
          <tbody>
            ${c.heads.map((h) => `<tr><td>${esc(h.owner)}</td><td>${esc(h.role)}${h.planned ? ' <em>planned</em>' : ''}</td><td>${h.shares.toLocaleString('en-US')}</td><td>${usd(h.value)}</td><td>${date(h.date)}</td><td><a href="${esc(h.url)}" ${ext}>Form 4</a></td></tr>`).join('')}
          </tbody>
        </table>
        <div class="parts">${parts}${token ? `<a class="chip" href="${tokenUrl(token.address)}" ${ext}>${esc(c.symbol)} token</a>` : ''}</div>
      </div>
    </details>`;
  }

  // ---- home ----
  function renderDune() {
    const up = data.clusters.filter(standing);
    const pool = (up.length >= 3 ? up : data.clusters).slice().sort((a, b) => b.score - a.score).slice(0, 9);
    // tallest in the middle, like a mob around its sentinel
    const order = [];
    pool.forEach((c, i) => (i % 2 ? order.push(c) : order.unshift(c)));
    const W = 1200, H = 400;
    const ground = (x) => 318 + 16 * Math.sin(x / 150) + 10 * Math.sin(x / 61 + 1);
    const step = W / (order.length + 1);
    const mob = order.map((c, i) => {
      const x = step * (i + 1);
      const h = 60 + c.score * 1.7;
      const s = h / 420;
      const flip = i < order.length / 2 ? 1 : -1; // both halves look outwards
      const y = ground(x) + 14;
      return `
      <a href="burrows.html#${esc(c.symbol)}" class="${c.side}">
        <title>${esc(c.symbol)}: ${c.heads.length} insiders ${verb(c)}, score ${c.score}</title>
        <g transform="translate(${x - flip * 280 * s} ${y - 512 * s}) scale(${flip * s} ${s})">${MEERKAT}</g>
        <text x="${x}" y="${y - h - 30}" class="sym">${esc(c.symbol)}</text>
        <text x="${x}" y="${y - h - 10}" class="sub">${c.heads.length} ${verb(c)}</text>
      </a>`;
    }).join('');
    let dune = `M0 ${ground(0)}`;
    for (let x = 20; x <= W; x += 20) dune += `L${x} ${ground(x).toFixed(1)}`;
    $('dune').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Meerkats standing for the loudest insider clusters">
      <circle cx="${W / 2}" cy="330" r="150" class="sun"/>${mob}<path d="${dune}L${W} ${H}L0 ${H}Z" class="sand"/></svg>`;
  }

  function renderHome() {
    renderDune();
    const up = data.clusters.filter(standing).sort((a, b) => b.score - a.score);
    const list = up.length ? up.slice(0, 5) : data.clusters.slice(0, 5);
    $('top-alarms').innerHTML = list.map((c) => alarmCard(c)).join('');
    $('updated').textContent = `Filings read ${date(data.updated)}`;
    const insiders = new Set(data.trades.map((t) => `${t.symbol}:${t.owner}`)).size;
    const stats = [
      [data.tokens.length, 'stock tokens watched'],
      [insiders, `insiders who traded in ${data.windowDays} days`],
      [data.clusters.length, 'alarms raised'],
      [up.length, 'standing right now'],
    ];
    $('stats').innerHTML = stats.map(([n, label]) => `<div><b>${n.toLocaleString('en-US')}</b><span>${label}</span></div>`).join('');
  }

  // ---- alarms page ----
  function initAlarms() {
    const filters = [
      ['all', 'All', () => true],
      ['up', 'Standing now', standing],
      ['buy', 'Buying', (c) => c.side === 'buy'],
      ['sell', 'Selling', (c) => c.side === 'sell'],
      ['loud', 'Score 60+', (c) => c.score >= 60],
    ];
    let current = 'all';
    const render = () => {
      const [, , test] = filters.find(([id]) => id === current);
      const list = data.clusters.filter(test);
      $('alarm-filters').innerHTML = filters.map(([id, label, t]) => `<button data-id="${id}"${id === current ? ' class="on"' : ''}>${label} <i>${data.clusters.filter(t).length}</i></button>`).join('');
      $('alarm-list').innerHTML = list.length ? list.map((c) => alarmCard(c)).join('') : '<p class="notice">Nothing here right now. The mob is on all fours.</p>';
    };
    $('alarm-filters').addEventListener('click', (e) => {
      const id = e.target.closest('button')?.dataset.id;
      if (id) { current = id; render(); }
    });
    $('alarms-note').textContent = `${data.clusters.length} alarms in the last ${data.windowDays} days. Each one is three or more insiders of one company, trading the same way inside ${data.clusterDays} days.`;
    render();
  }

  // ---- burrows ----
  function timeline(symbol) {
    const trades = data.trades.filter((t) => t.symbol === symbol);
    const W = 1000, H = 150, mid = 75;
    const end = Date.parse(data.updated);
    const start = end - data.windowDays * 86400_000;
    const x = (iso) => 20 + ((Date.parse(iso) - start) / (end - start)) * (W - 40);
    const r = (v) => Math.max(4, Math.min(22, Math.log10(v) * 4 - 14));
    const bands = data.clusters.filter((c) => c.symbol === symbol).map((c) => {
      const x1 = x(c.from) - 8, x2 = x(c.to) + 8;
      return `<rect x="${x1}" y="${c.side === 'buy' ? 6 : mid}" width="${x2 - x1}" height="${mid - 6}" class="band ${c.side}"/>`;
    }).join('');
    const dots = trades.map((t) => `<circle cx="${x(t.date)}" cy="${t.side === 'buy' ? mid - 32 : mid + 32}" r="${r(t.value)}" class="${t.side}"><title>${esc(t.owner)}: ${t.side} ${usd(t.value)}, ${date(t.date)}</title></circle>`).join('');
    const months = [];
    for (let d = new Date(start); d.getTime() < end; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDate() === 1) months.push(`<text x="${x(d.toISOString())}" y="${H - 4}">${d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}</text>`);
    }
    return `<svg class="timeline" viewBox="0 0 ${W} ${H}" role="img" aria-label="Insider trades over ${data.windowDays} days">${bands}<line x1="0" x2="${W}" y1="${mid}" y2="${mid}"/><text x="4" y="16">buys</text><text x="4" y="${H - 22}">sells</text>${months.join('')}${dots}</svg>`;
  }

  function renderBurrow(symbol) {
    const box = $('burrow-detail');
    const token = tokenBySymbol.get(symbol);
    if (!token) { box.innerHTML = ''; return; }
    const trades = data.trades.filter((t) => t.symbol === symbol);
    const clusters = data.clusters.filter((c) => c.symbol === symbol);
    box.innerHTML = `
    <div class="burrow-open">
      <div class="head"><h2>${esc(symbol)} <small>${esc(token.name)}</small></h2><a class="chip" href="${tokenUrl(token.address)}" ${ext}>token ${short(token.address)}</a></div>
      ${trades.length ? timeline(symbol) : ''}
      <p class="muted">${trades.length ? `${new Set(trades.map((t) => t.owner)).size} insiders, ${trades.length} filings with open-market trades in ${data.windowDays} days. Shaded bands are alarms.` : `No open-market insider trades over $10K in the last ${data.windowDays} days.`}</p>
      <div class="alarms">${clusters.map((c) => alarmCard(c, true)).join('')}</div>
      ${trades.length ? `<table class="trades"><thead><tr><th>Date</th><th>Insider</th><th>Role</th><th></th><th>Value</th><th></th></tr></thead><tbody>
        ${trades.slice(0, 40).map((t) => `<tr><td>${date(t.date)}</td><td>${esc(t.owner)}</td><td>${esc(t.role)}${t.planned ? ' <em>planned</em>' : ''}</td><td class="${t.side}">${t.side}</td><td>${usd(t.value)}</td><td><a href="${esc(t.url)}" ${ext}>Form 4</a></td></tr>`).join('')}
      </tbody></table>${trades.length > 40 ? `<p class="fine">Showing the latest 40 of ${trades.length}.</p>` : ''}` : ''}
    </div>`;
    box.scrollIntoView({ block: 'start' });
  }

  function initBurrows() {
    const info = new Map(data.tokens.map((t) => [t.symbol, { buy: new Set(), sell: new Set(), alarm: null }]));
    for (const t of data.trades) info.get(t.symbol)?.[t.side].add(t.owner);
    for (const c of data.clusters) {
      const i = info.get(c.symbol);
      if (i && standing(c) && (!i.alarm || c.score > i.alarm.score)) i.alarm = c;
    }
    const filters = [
      ['active', 'With trades', (i) => i.buy.size + i.sell.size > 0],
      ['alarm', 'Alarm now', (i) => i.alarm],
      ['buy', 'Someone bought', (i) => i.buy.size > 0],
      ['all', 'All', () => true],
    ];
    let current = 'active';
    const render = () => {
      const [, , test] = filters.find(([id]) => id === current);
      const list = data.tokens.filter((t) => test(info.get(t.symbol)))
        .sort((a, b) => (info.get(b.symbol).buy.size + info.get(b.symbol).sell.size) - (info.get(a.symbol).buy.size + info.get(a.symbol).sell.size) || a.symbol.localeCompare(b.symbol));
      $('burrow-filters').innerHTML = filters.map(([id, label, t]) => `<button data-id="${id}"${id === current ? ' class="on"' : ''}>${label} <i>${data.tokens.filter((x) => t(info.get(x.symbol))).length}</i></button>`).join('');
      $('burrow-grid').innerHTML = list.map((t) => {
        const i = info.get(t.symbol);
        return `<a href="#${esc(t.symbol)}" class="burrow${i.alarm ? ` up ${i.alarm.side}` : ''}">
          <b>${esc(t.symbol)}</b><span>${esc(t.name)}</span>
          <p>${i.buy.size ? `<i class="buy">${i.buy.size} bought</i>` : ''}${i.sell.size ? `<i class="sell">${i.sell.size} sold</i>` : ''}${i.buy.size + i.sell.size ? '' : '<i>quiet</i>'}</p>
        </a>`;
      }).join('');
    };
    $('burrow-filters').addEventListener('click', (e) => {
      const id = e.target.closest('button')?.dataset.id;
      if (id) { current = id; render(); }
    });
    const route = () => renderBurrow(decodeURIComponent(location.hash.slice(1)));
    window.addEventListener('hashchange', route);
    render();
    if (location.hash) route();
  }

  // ---- your patch: read a wallet's stock tokens through Multicall3 ----
  const BALANCE_OF = '0x70a08231';
  const LATEST_ROUND_DATA = '0xfeaf968c';
  const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
  const CALLS_PER_REQUEST = 100;
  const isAddress = (s) => /^0x[0-9a-fA-F]{40}$/.test(s);
  const word = (n) => BigInt(n).toString(16).padStart(64, '0');

  // aggregate3((address target, bool allowFailure, bytes callData)[])
  function encodeAggregate3(calls) {
    const tuples = calls.map((c) => {
      const bytes = c.data.slice(2);
      const padded = bytes.padEnd(Math.ceil(bytes.length / 64) * 64, '0');
      return c.to.slice(2).toLowerCase().padStart(64, '0') + word(1) + word(0x60) + word(bytes.length / 2) + padded;
    });
    let offset = calls.length * 32;
    const heads = tuples.map((t) => {
      const head = word(offset);
      offset += t.length / 2;
      return head;
    });
    return '0x82ad56cb' + word(0x20) + word(calls.length) + heads.join('') + tuples.join('');
  }

  // returns (bool success, bytes returnData)[] as hex strings, null where a call failed
  function decodeAggregate3(hex) {
    const d = hex.slice(2);
    const at = (byte) => parseInt(d.slice(byte * 2, byte * 2 + 64), 16);
    const base = 64; // offsets are relative to the first word after the array length
    return Array.from({ length: at(32) }, (_, i) => {
      const tuple = base + at(base + i * 32);
      const bytes = tuple + at(tuple + 32);
      return at(tuple) === 1 ? '0x' + d.slice((bytes + 32) * 2, (bytes + 32 + at(bytes)) * 2) : null;
    });
  }

  async function ethCalls(calls) {
    const results = [];
    for (let i = 0; i < calls.length; i += CALLS_PER_REQUEST) {
      const params = [{ to: MULTICALL3, data: encodeAggregate3(calls.slice(i, i + CALLS_PER_REQUEST)) }, 'latest'];
      const res = await fetch(cfg.rpc, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params }),
      });
      if (!res.ok) throw new Error(`RPC ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      results.push(...decodeAggregate3(json.result));
    }
    return results;
  }

  async function loadHoldings(address) {
    const arg = address.slice(2).toLowerCase().padStart(64, '0');
    const balances = await ethCalls(data.tokens.map((t) => ({ to: t.address, data: BALANCE_OF + arg })));
    const held = data.tokens
      .map((t, i) => ({ ...t, units: balances[i] && balances[i] !== '0x' ? Number(BigInt(balances[i])) / 1e18 : 0 }))
      .filter((t) => t.units > 0);
    const withFeed = held.filter((t) => t.feed);
    const rounds = withFeed.length ? await ethCalls(withFeed.map((t) => ({ to: t.feed, data: LATEST_ROUND_DATA }))) : [];
    withFeed.forEach((t, i) => {
      // latestRoundData() returns (roundId, answer, ...); the answer is the second word, 8 decimals
      const answer = rounds[i] && rounds[i].length >= 130 ? Number(BigInt('0x' + rounds[i].slice(66, 130))) / 1e8 : 0;
      if (answer > 0) t.value = t.units * answer;
    });
    return held.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  }

  function renderPatch(address, held) {
    const box = $('patch-result');
    if (!held.length) {
      box.innerHTML = `<p class="notice"><strong>${short(address)} holds no stock tokens.</strong> The <a href="alarms.html">alarms</a> are open to everyone anyway.</p>`;
      return;
    }
    const rows = held.map((t) => {
      const clusters = data.clusters.filter((c) => c.symbol === t.symbol);
      const now = clusters.filter(standing).sort((a, b) => b.score - a.score)[0];
      return { t, now, past: clusters.length - (now ? 1 : 0) };
    }).sort((a, b) => (b.now?.score ?? 0) - (a.now?.score ?? 0));
    const alarms = rows.filter((r) => r.now);
    const shareText = alarms.length
      ? `The meerkats looked at my Robinhood Chain wallet. ${alarms.length} of my ${held.length} stock tokens ${alarms.length > 1 ? 'have' : 'has'} insiders moving together.`
      : `The meerkats looked at my Robinhood Chain wallet. ${held.length} stock tokens, no insider alarms.`;
    box.innerHTML = `
      <div class="verdict">
        <div>
          <p class="muted">${short(address)}, ${held.length} stock token${held.length > 1 ? 's' : ''}</p>
          <p class="big">${alarms.length ? `<em>${alarms.length}</em> of them ${alarms.length > 1 ? 'have' : 'has'} an alarm right now` : 'All quiet on your patch'}</p>
        </div>
        <a class="btn small" ${ext} href="${shareLink(shareText)}">Share on X</a>
      </div>
      <div class="alarms">${alarms.map((r) => alarmCard(r.now, true)).join('')}</div>
      <table class="trades">
        <thead><tr><th>Token</th><th>Held</th><th>Value</th><th>Insiders now</th><th>Earlier alarms</th></tr></thead>
        <tbody>${rows.map(({ t, now, past }) => `<tr><td><a href="burrows.html#${esc(t.symbol)}">${esc(t.symbol)}</a></td><td>${t.units.toLocaleString('en-US', { maximumFractionDigits: 4 })}</td><td>${t.value ? usd(t.value) : 'no feed'}</td><td class="${now ? now.side : ''}">${now ? `${now.heads.length} ${verb(now)}, score ${now.score}` : 'quiet'}</td><td>${past || ''}</td></tr>`).join('')}</tbody>
      </table>
      <p class="fine">Balances are read live from Robinhood Chain. Values use Chainlink feeds where one exists.</p>`;
  }

  async function look(address) {
    const box = $('patch-result');
    if (!isAddress(address)) {
      box.innerHTML = '<p class="notice">That is not a valid address. It should be 0x followed by 40 hex characters.</p>';
      return;
    }
    box.innerHTML = '<p class="notice muted">Reading balances…</p>';
    try {
      renderPatch(address, await loadHoldings(address));
    } catch (err) {
      box.innerHTML = `<p class="notice">Could not read balances from Robinhood Chain (${esc(err.message)}). Try again in a moment.</p>`;
    }
  }

  function initPatch() {
    $('connect').addEventListener('click', async () => {
      if (!window.ethereum) {
        $('patch-result').innerHTML = '<p class="notice">No wallet found in this browser. Paste an address instead.</p>';
        return;
      }
      try {
        const [account] = await window.ethereum.request({ method: 'eth_requestAccounts' });
        $('address').value = account;
        look(account);
      } catch { /* the wallet prompt was closed */ }
    });
    $('patch-form').addEventListener('submit', (e) => {
      e.preventDefault();
      look($('address').value.trim());
    });
  }

  // ---- token page ----
  function renderToken() {
    const ca = cfg.tokenAddress;
    const box = $('ca-box');
    if (ca) {
      $('token-note').textContent = `$${cfg.ticker} is live on Pons, Robinhood Chain. The site stays free for everyone.`;
      box.innerHTML = `<code>${esc(ca)}</code><button class="btn small">Copy</button>`;
      box.querySelector('button').addEventListener('click', (e) => copy(ca, e.currentTarget));
    } else {
      box.innerHTML = '<code>Not launched yet. The address will be printed here, and only here.</code>';
    }
    const pons = cfg.links.pons || (ca ? `https://ponsfamily.com/launchpad/${ca}` : '');
    const links = [['Buy on Pons', pons, 'solid'], ['Explorer', ca ? tokenUrl(ca) : '', ''], ['X', cfg.links.x, ''], ['GitHub', cfg.links.github, '']].filter(([, url]) => url);
    $('token-links').innerHTML = links.map(([label, url, cls]) => `<a class="btn ${cls}" href="${esc(url)}" ${ext}>${label}</a>`).join('');
    const labels = { supply: 'Supply', launch: 'Launch', liquidity: 'Liquidity', fees: 'Fees', team: 'Team' };
    $('tokenomics').innerHTML = Object.entries(cfg.tokenomics).map(([k, v]) => `<li><span>${labels[k] || esc(k)}</span>${esc(v)}</li>`).join('');
  }

  async function init() {
    renderChrome();
    if ($('ca-box')) renderToken();
    const needsData = ['dune', 'alarm-list', 'burrow-grid', 'patch-form'].some($);
    if (!needsData) return;
    try {
      await load();
    } catch (err) {
      for (const id of ['top-alarms', 'alarm-list', 'burrow-grid', 'patch-result']) {
        if ($(id)) $(id).innerHTML = `<p class="notice">Could not load the filings data (${esc(err.message)}).</p>`;
      }
      return;
    }
    if ($('dune')) renderHome();
    if ($('alarm-list')) initAlarms();
    if ($('burrow-grid')) initBurrows();
    if ($('patch-form')) initPatch();
  }
  init();
})();
