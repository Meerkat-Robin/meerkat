// MEERKAT brand kit: logo.svg, avatar.png, small48.png, x-header.png here, plus logo.png and
// og-image.png in ../site. node render.mjs
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const sharp = createRequire(import.meta.url)('../../mole/worker/node_modules/sharp');

const SUN = '#f39a2d', NIGHT = '#17100d', SAND = '#f3e2c2';
const file = (name) => fileURLToPath(new URL(name, import.meta.url));

// standing meerkat in profile, feet on the bottom edge of a 512 box (same shape as in site/app.js)
const body = '<circle cx="246" cy="132" r="15"/><path d="M236 512C228 430 224 350 236 290C232 262 232 236 240 214C226 196 222 168 232 146C244 116 278 102 310 110C334 116 350 132 362 150L404 176C408 188 400 198 386 198L332 204C318 212 310 226 308 244C312 262 318 276 322 292C344 330 350 380 342 430C338 460 336 490 336 512Z"/><path d="M318 304c32 10 48 30 44 56-6 8-18 6-22-2-2-16-14-28-32-34z"/>';
const eye = `<ellipse cx="330" cy="146" rx="12" ry="9" fill="${SAND}"/>`;
const meerkat = (fill = NIGHT, withEye = true) => `<g fill="${fill}">${body}</g>${withEye ? eye : ''}`;

// the logo: one dark sentinel on a sun-coloured tile, body running off the bottom
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${SUN}"/><g transform="translate(-125 0) scale(1.25)">${meerkat()}</g></svg>`;
writeFileSync(file('./logo.svg'), logo);
const png = (size) => sharp(Buffer.from(logo)).resize(size, size).png().toBuffer();
writeFileSync(file('./avatar.png'), await png(800));
writeFileSync(file('./small48.png'), await png(48));
writeFileSync(file('../site/logo.png'), await png(256));

const SERIF = 'font-family="Georgia, Times New Roman, serif" font-weight="700"';
const MONO = 'font-family="Consolas, Courier New, monospace"';
const sky = (w, h) => `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#2a1630"/><stop offset=".34" stop-color="#6d2a2c"/><stop offset=".62" stop-color="#c9562a"/><stop offset=".84" stop-color="#f39a2d"/><stop offset="1" stop-color="#f8c35a"/>
</linearGradient></defs><rect width="${w}" height="${h}" fill="url(#sky)"/>`;
// a row of meerkats on a dune: [x, height, flip]
const mob = (list, groundY, w, h) => {
  const ground = (x) => groundY + 14 * Math.sin(x / 150) + 8 * Math.sin(x / 61 + 1);
  let dune = `M0 ${ground(0)}`;
  for (let x = 20; x <= w; x += 20) dune += `L${x} ${ground(x).toFixed(1)}`;
  return list.map(([x, height, flip]) => {
    const s = height / 420;
    return `<g transform="translate(${x - flip * 280 * s} ${ground(x) + 14 - 512 * s}) scale(${flip * s} ${s})">${meerkat(NIGHT, false)}</g>`;
  }).join('') + `<path d="${dune}L${w} ${h}L0 ${h}Z" fill="${NIGHT}"/>`;
};

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  ${sky(1200, 630)}
  <circle cx="930" cy="560" r="170" fill="#ffe7a6" opacity=".9"/>
  <text x="70" y="96" ${MONO} font-size="22" fill="#f8c98a" letter-spacing="2">SEC FORM 4 &#8594; STOCK TOKENS ON ROBINHOOD CHAIN</text>
  <g ${SERIF} font-size="84" letter-spacing="-2">
    <text x="66" y="210" fill="${SAND}">One insider is noise.</text>
    <text x="66" y="306" fill="#ffd88a" font-style="italic">Three is an alarm.</text>
  </g>
  <text x="70" y="372" font-family="Arial, sans-serif" font-size="27" fill="#fbe9cb">When insiders move together, the meerkats stand up.</text>
  ${mob([[650, 110, 1], [770, 150, 1], [900, 200, 1], [1030, 160, -1], [1130, 120, -1]], 560, 1200, 630)}
</svg>`;
await sharp(Buffer.from(og)).png().toFile(file('../site/og-image.png'));

const header = `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="500">
  ${sky(1500, 500)}
  <circle cx="1130" cy="450" r="150" fill="#ffe7a6" opacity=".9"/>
  <g ${SERIF} font-size="62" letter-spacing="-1.5">
    <text x="470" y="150" fill="${SAND}">One insider is noise.</text>
    <text x="470" y="226" fill="#ffd88a" font-style="italic">Three is an alarm.</text>
  </g>
  ${mob([[560, 90, 1], [900, 110, 1], [1010, 150, 1], [1130, 210, 1], [1250, 160, -1], [1360, 110, -1]], 440, 1500, 500)}
</svg>`;
await sharp(Buffer.from(header)).png().toFile(file('./x-header.png'));
console.log('wrote logo.svg, avatar.png, small48.png, x-header.png, site/logo.png, site/og-image.png');
