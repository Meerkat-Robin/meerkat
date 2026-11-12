// The MEERKAT clip for X: a real alarm from the data, the dune, the wallet check. 1280x720, 30 fps.
// SVG frames -> sharp -> ffmpeg (libx264). The alarm and the numbers are read from ../site/data/watch.json,
// so the clip shows what the site shows. The wallet result is an example and is labelled as one.
// Run: FFMPEG=<path to ffmpeg.exe> node demo.mjs  -> demo.mp4.  ONLY=5,14 writes those seconds as PNGs.
// CA=<token address> makes the launch cut with the address on the end card -> launch.mp4
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const sharp = createRequire(import.meta.url)('../../mole/worker/node_modules/sharp');

const W = 1280, H = 720, FPS = 30;
const NIGHT = '#17100d', SAND = '#f3e2c2', SUN = '#f39a2d', GOLD = '#ffd88a', DIM = '#b39c7e', BUY = '#7fd6a0', SELL = '#ff7350', LINE = '#45301f';
const SERIF = 'Georgia, Times New Roman, serif', SANS = 'Segoe UI, Arial, sans-serif', MONO = 'Consolas, monospace';
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const span = (t, a, b) => clamp((t - a) / (b - a));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const typed = (text, t, a, b) => esc(text.slice(0, Math.floor(span(t, a, b) * text.length)));
const fade = (t, [a, b]) => Math.min(ease(span(t, a, a + 0.4)), 1 - ease(span(t, b - 0.35, b))).toFixed(2);
const usd = (n) => (n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1e3)}K`);
const day = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

const data = JSON.parse(readFileSync(new URL('../site/data/watch.json', import.meta.url), 'utf8'));
const standing = data.clusters.filter((c) => (Date.parse(data.updated) - Date.parse(c.to)) / 86400_000 <= data.clusterDays).sort((a, b) => b.score - a.score);
// the alarm shown in full: the one standing now with the most insiders (ALARM=<symbol> picks another)
const alarm = (process.env.ALARM && data.clusters.find((c) => c.symbol === process.env.ALARM)) || standing.slice().sort((a, b) => b.heads.length - a.heads.length || b.score - a.score)[0];
const company = data.tokens.find((t) => t.symbol === alarm.symbol)?.name || '';
const heads = alarm.heads.slice(0, 5);
const verb = (c) => (c.side === 'buy' ? 'buying' : 'selling');
const mobList = standing.slice(0, 9);

const MEERKAT = '<circle cx="246" cy="132" r="15"/><path d="M236 512C228 430 224 350 236 290C232 262 232 236 240 214C226 196 222 168 232 146C244 116 278 102 310 110C334 116 350 132 362 150L404 176C408 188 400 198 386 198L332 204C318 212 310 226 308 244C312 262 318 276 322 292C344 330 350 380 342 430C338 460 336 490 336 512Z"/><path d="M318 304c32 10 48 30 44 56-6 8-18 6-22-2-2-16-14-28-32-34z"/>';
const ground = (x) => 618 + 14 * Math.sin(x / 150) + 8 * Math.sin(x / 61 + 1);
let dunePath = `M0 ${ground(0)}`;
for (let x = 20; x <= W; x += 20) dunePath += `L${x} ${ground(x).toFixed(1)}`;
const dune = `<path d="${dunePath}L${W} ${H}L0 ${H}Z" fill="${NIGHT}"/>`;
// a meerkat that rises out of the dune; k = 0 hidden, 1 fully up. Draw before the dune.
const mk = (x, h, flip, k) => {
  const s = h / 420;
  const y = ground(x) + 14 + (1 - ease(k)) * (h + 20);
  return `<g fill="${NIGHT}" transform="translate(${(x - flip * 280 * s).toFixed(1)} ${(y - 512 * s).toFixed(1)}) scale(${flip * s} ${s})">${MEERKAT}</g>`;
};
const sky = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#2a1630"/><stop offset=".34" stop-color="#6d2a2c"/><stop offset=".62" stop-color="#c9562a"/><stop offset=".84" stop-color="#f39a2d"/><stop offset="1" stop-color="#f8c35a"/>
</linearGradient></defs><rect width="${W}" height="${H}" fill="url(#sky)"/>`;
const sun = (cx, r = 170) => `<circle cx="${cx}" cy="640" r="${r}" fill="#ffe7a6" opacity=".9"/>`;
const kicker = (text, o) => `<text x="80" y="92" font-family="${MONO}" font-size="22" fill="#f8c98a" letter-spacing="2" opacity="${o}">${text}</text>`;

const CA = process.env.CA || '';
const S = { intro: [0, 3.6], alarm: [3.6, 10.6], mob: [10.6, 15.4], patch: [15.4, 19.2], end: [19.2, CA ? 25 : 22.4] };
const END = S.end[1];

function frame(t) {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${sky}`;

  if (t < S.intro[1]) {
    const o = fade(t, [-1, S.intro[1]]);
    s += sun(900) + mk(900, 250, 1, span(t, 1.5, 2.4)) + mk(770, 130, 1, span(t, 2.2, 2.9)) + mk(1030, 150, -1, span(t, 2.4, 3.1)) + dune;
    s += `<g opacity="${o}">${kicker('SEC FORM 4 &#8594; STOCK TOKENS ON ROBINHOOD CHAIN', 1)}
      <text x="76" y="230" font-family="${SERIF}" font-weight="700" font-size="92" fill="${SAND}" letter-spacing="-2" opacity="${ease(span(t, 0.2, 0.8))}">One insider is noise.</text>
      <text x="76" y="340" font-family="${SERIF}" font-weight="700" font-style="italic" font-size="92" fill="${GOLD}" letter-spacing="-2" opacity="${ease(span(t, 1.3, 1.9))}">Three is an alarm.</text></g>`;
  } else if (t < S.alarm[1]) {
    const [a, b] = S.alarm, o = fade(t, S.alarm);
    const rowAt = (i) => a + 1.3 + i * 0.85;
    const all = rowAt(Math.min(heads.length, 3) - 1) + 0.5; // the moment the third insider lands
    const colour = alarm.side === 'buy' ? BUY : SELL;
    s += sun(1030, 150);
    heads.forEach((h, i) => { s += mk(880 + i * (320 / Math.max(heads.length - 1, 1)), 110 + (i === 2 ? 70 : (i % 2) * 25), i < 3 ? 1 : -1, span(t, rowAt(i) + 0.1, rowAt(i) + 0.7)); });
    s += dune;
    s += `<g opacity="${o}">${kicker('A REAL ALARM FROM THE FILINGS', 1)}
      <rect x="76" y="124" width="740" height="${150 + heads.length * 58}" rx="16" fill="${NIGHT}" opacity=".9"/>
      <rect x="76" y="124" width="8" height="${150 + heads.length * 58}" fill="${colour}"/>
      <text x="112" y="190" font-family="${SERIF}" font-weight="700" font-size="54" fill="${SAND}">${esc(alarm.symbol)}</text>
      <text x="784" y="188" text-anchor="end" font-family="${SANS}" font-size="24" fill="${DIM}">${esc(company)}</text>
      <text x="112" y="232" font-family="${SANS}" font-size="24" fill="${SAND}" opacity="${ease(span(t, all, all + 0.4))}">${alarm.heads.length} insiders ${verb(alarm)}, ${usd(alarm.value)} in total, ${day(alarm.from)} to ${day(alarm.to)}</text>
      ${heads.map((h, i) => `<g opacity="${ease(span(t, rowAt(i), rowAt(i) + 0.35))}">
        <line x1="112" x2="784" y1="${256 + i * 58}" y2="${256 + i * 58}" stroke="${LINE}"/>
        <text x="112" y="${294 + i * 58}" font-family="${SANS}" font-weight="700" font-size="24" fill="${SAND}">${esc(h.owner.slice(0, 24))}</text>
        <text x="400" y="${294 + i * 58}" font-family="${SANS}" font-size="19" fill="${DIM}">${esc(h.role.length > 27 ? h.role.slice(0, 26) + "…" : h.role)}</text>
        <text x="784" y="${294 + i * 58}" text-anchor="end" font-family="${MONO}" font-size="24" fill="${colour}">${usd(h.value)}</text></g>`).join('')}
      <g opacity="${ease(span(t, all + 0.3, all + 0.8))}">
        <text x="1040" y="250" text-anchor="middle" font-family="${SERIF}" font-weight="700" font-size="150" fill="${SAND}">${Math.round(alarm.score * ease(span(t, all + 0.3, all + 1.4)))}</text>
        <text x="1040" y="292" text-anchor="middle" font-family="${MONO}" font-size="22" fill="${SAND}" letter-spacing="3">ALARM SCORE</text>
      </g></g>`;
  } else if (t < S.mob[1]) {
    const [a] = S.mob, o = fade(t, S.mob);
    const order = [];
    mobList.forEach((c, i) => (i % 2 ? order.push(c) : order.unshift(c)));
    const step = W / (order.length + 1);
    s += sun(W / 2, 190);
    let labels = '';
    order.forEach((c, i) => {
      const x = step * (i + 1), h = 70 + c.score * 2, k = span(t, a + 0.4 + i * 0.22, a + 1 + i * 0.22);
      s += mk(x, h, i < order.length / 2 ? 1 : -1, k);
      labels += `<g opacity="${ease(k)}" text-anchor="middle"><text x="${x}" y="${ground(x) - h - 26}" font-family="${MONO}" font-weight="700" font-size="26" fill="#fff4dc">${esc(c.symbol)}</text>
        <text x="${x}" y="${ground(x) - h - 4}" font-family="${MONO}" font-size="16" fill="${c.side === 'buy' ? '#0c4a2a' : '#2a1630'}">${c.heads.length} ${verb(c)}</text></g>`;
    });
    s += dune + `<g opacity="${o}">${kicker('STANDING RIGHT NOW', 1)}
      <text x="76" y="176" font-family="${SERIF}" font-weight="700" font-size="60" fill="${SAND}" letter-spacing="-1">${standing.length} alarms across ${data.tokens.length} stock tokens.</text>
      <text x="80" y="222" font-family="${SANS}" font-size="26" fill="#fbe9cb">Three or more insiders of one company, the same way, inside ${data.clusterDays} days.</text>${labels}</g>`;
  } else if (t < S.patch[1]) {
    const [a] = S.patch, o = fade(t, S.patch);
    const c = standing.find((x) => x.symbol === 'NFLX') || standing.find((x) => x.symbol !== alarm.symbol) || alarm;
    s += sun(1040, 150) + mk(1040, 230, -1, span(t, a + 1.9, a + 2.6)) + dune;
    s += `<g opacity="${o}">${kicker('YOUR PATCH: PASTE A WALLET, SIGN NOTHING', 1)}
      <rect x="76" y="130" width="700" height="64" rx="32" fill="${NIGHT}" stroke="${SUN}" stroke-width="2.5"/>
      <text x="108" y="172" font-family="${MONO}" font-size="26" fill="${SAND}">${typed('0x7a3f…c41e', t, a + 0.4, a + 1.3)}</text>
      <rect x="796" y="130" width="130" height="64" rx="32" fill="${SAND}"/><text x="861" y="172" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="24" fill="${NIGHT}">Look</text>
      <g opacity="${ease(span(t, a + 1.7, a + 2.2))}">
        <text x="80" y="290" font-family="${SERIF}" font-weight="700" font-size="58" fill="${SAND}" letter-spacing="-1"><tspan fill="${GOLD}">1</tspan> of your 4 stock tokens</text>
        <text x="80" y="356" font-family="${SERIF}" font-weight="700" font-size="58" fill="${SAND}" letter-spacing="-1">has an alarm right now.</text>
        <rect x="76" y="392" width="700" height="84" rx="14" fill="${NIGHT}" opacity=".9"/>
        <text x="104" y="446" font-family="${SERIF}" font-weight="700" font-size="40" fill="${c.side === 'buy' ? BUY : SELL}">${c.score}</text>
        <text x="176" y="444" font-family="${SANS}" font-weight="700" font-size="26" fill="${SAND}">${esc(c.symbol)}: ${c.heads.length} insiders ${verb(c)}, ${usd(c.value)}</text>
        <text x="80" y="512" font-family="${MONO}" font-size="18" fill="${NIGHT}">example wallet</text>
      </g></g>`;
  } else {
    const [a] = S.end, o = ease(span(t, a, a + 0.5));
    s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${sky}${sun(980, 190)}${mk(860, 150, 1, 1)}${mk(980, 270, 1, span(t, a + 0.2, a + 1))}${mk(1110, 180, -1, 1)}${dune}
      <g opacity="${o}">
      <text x="76" y="200" font-family="${SERIF}" font-weight="700" font-size="104" fill="${SAND}" letter-spacing="-2">MEERKAT</text>
      <text x="80" y="262" font-family="${SERIF}" font-style="italic" font-weight="700" font-size="40" fill="${GOLD}">${CA ? '$MEERKAT is live on Pons.' : 'One insider is noise. Three is an alarm.'}</text>
      ${CA ? `<rect x="76" y="300" width="760" height="56" rx="10" fill="${NIGHT}" opacity=".9"/><text x="96" y="337" font-family="${MONO}" font-size="24" fill="${SAND}">${CA}</text>
      <text x="80" y="420" font-family="${MONO}" font-size="34" fill="${SAND}" letter-spacing="2">meerkatrobin.com</text>` : `<text x="80" y="350" font-family="${MONO}" font-size="36" fill="${SAND}" letter-spacing="2">meerkatrobin.com</text>
      <text x="80" y="396" font-family="${SANS}" font-size="24" fill="#fbe9cb">Insider clusters, matched to stock tokens on Robinhood Chain</text>`}</g>`;
  }
  return s + '</svg>';
}

const only = process.env.ONLY;
if (only) {
  for (const t of only.split(',').map(Number)) await sharp(Buffer.from(frame(t))).png().toFile(fileURLToPath(new URL(`./demo-${t}.png`, import.meta.url)));
  process.exit(0);
}
const dir = join(tmpdir(), 'meerkat-demo-frames');
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
const total = Math.round(END * FPS);
for (let i = 0; i < total; i++) await sharp(Buffer.from(frame(i / FPS))).png().toFile(join(dir, `f${String(i).padStart(4, '0')}.png`));
const out = fileURLToPath(new URL(CA ? './launch.mp4' : './demo.mp4', import.meta.url));
execFileSync(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', out]);
rmSync(dir, { recursive: true, force: true });
console.log('wrote', out, total, 'frames');
