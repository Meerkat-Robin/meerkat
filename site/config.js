// Everything you change on launch day lives here.
window.MEERKAT_CONFIG = {
  name: 'MEERKAT',
  ticker: 'MEERKAT',
  // Paste the token contract address after launching on Pons. Empty = "launching soon".
  tokenAddress: '',
  // Leave a link empty to hide its button. The Pons link is built from the address when empty.
  links: {
    x: 'https://x.com/meerkatrobin',
    telegram: '',
    pons: '',
    github: 'https://github.com/Meerkat-Robin/meerkat',
  },
  // Pons v2 launches mint a fixed 1,000,000,000.
  tokenomics: {
    supply: '1,000,000,000',
    launch: 'Fair launch on Pons',
    liquidity: 'Locked for good at graduation',
    team: 'No team mint, no presale',
  },
  explorer: 'https://robinhoodchain.blockscout.com',
  // Public Robinhood Chain RPC. Behind the site Worker this can be '/rpc' with a keyed RPC.
  rpc: 'https://rpc.mainnet.chain.robinhood.com',
};
