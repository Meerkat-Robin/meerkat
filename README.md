# MEERKAT

One insider is noise. Three is an alarm.

MEERKAT reads SEC Form 4 filings (executives and directors trading their own company's stock) for every company that has a stock token on Robinhood Chain. When three or more different insiders of one company buy, or sell, inside 14 days, it raises an alarm and scores it.

- Site: https://meerkatrobin.com
- X: https://x.com/meerkatrobin

The site is free and needs no account, no wallet connection and no token.

## What is on the site

| Page | What it shows |
|---|---|
| The watch | The loudest alarms right now, as meerkats standing on a dune |
| Alarms | Every cluster from the last 90 days, with each insider and a link to the Form 4 |
| Burrows | Every company with a stock token, and a 90-day timeline of its insider trades |
| Your patch | Paste a wallet: which of its stock tokens have insiders moving together |
| How it scores | The five rules behind the number |

## The score

An alarm starts at three insiders and gets a score from 30 to 100.

| Rule | Points |
|---|---|
| Heads: 30 for three insiders, 8 more for each extra one, up to six | 30 to 54 |
| Not planned: share of insiders trading outside a 10b5-1 plan | 0 to 20 |
| Top brass: a CEO, CFO, president or chair is among them | 10 |
| Tight: all trades inside nine days, or inside five | 4 or 8 |
| Buying: the cluster is a buy | 8 |

Only open-market buys and sells over $10K count. Grants, option exercises, tax withholding and gifts are left out.

## Layout

```
site/            six pages, one stylesheet, one script, config.js, data/watch.json
build.mjs        writes the pages from one shared frame
scripts/fetch.mjs  token registry + Form 4 filings + clusters -> site/data/watch.json
site-worker.js   Cloudflare Worker: serves the site, /rpc and fresh /data
brand/           logo, avatar, header
```

## Run it

```
node scripts/fetch.mjs   # filings and clusters -> site/data/watch.json
node build.mjs           # pages               -> site/*.html
npx serve site           # open it locally
```

The SEC asks automated clients to name themselves. Set `SEC_USER_AGENT` to a name and a contact address before running the fetch script. Filings already read are listed in `site/data/seen.json`, so later runs only fetch new ones.

## Deploy

```
npx wrangler secret put RH_RPC_URL   # a keyed Robinhood Chain RPC
npx wrangler deploy
```

`/rpc` forwards only `eth_call` requests addressed to Multicall3, so the RPC key stays on the server. `/data/watch.json` is served from this repository's `main` branch, where a daily GitHub Action commits the rebuilt file.

## What it is not

MEERKAT shows what public filings say. An alarm is not a forecast and not investment advice. Stock tokens are issued by Robinhood Assets (Jersey) Limited and are not available to US persons or in several other places. MEERKAT is not affiliated with Robinhood, Pons, the SEC, or any company shown.

## Token

$MEERKAT is live on Pons, Robinhood Chain (chain 4663).

```
0x8857d36b6d078fe96c5dea25c1dff96f8d23d7b0
```

The same address is shown on [meerkatrobin.com/token](https://meerkatrobin.com/token) and in the launch post on [x.com/meerkatrobin](https://x.com/meerkatrobin). If the three do not match, it is not ours. The site stays free and needs no token.

## License

MIT
