# PARITY

PARITY is a live market monitor for Stock Tokens on Robinhood Chain. It compares a token pool price with the underlying US stock quote and computes `((tokenPrice - realPrice) / realPrice) * 100`.

**Trust boundary:** demo values are synthetic, labeled, and only for product preview. Live mode uses the official Robinhood asset registry and quote API, DexScreener pool data on Robinhood Chain, and Finnhub as a fallback. A missing pool or quote remains unavailable. Historical prices are not synthesized in live mode.

## Setup in five steps

1. Install Node.js 20+ and clone/download this repository.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Leave `USE_MOCK_DATA=true` for a labeled demo, or set `USE_MOCK_DATA=false` and add `FINNHUB_API_KEY` for live reference quotes.
5. Run `npm run dev` and open `http://localhost:3000`.

## Switch from mock to live data

Set `USE_MOCK_DATA=false` and optionally provide `FINNHUB_API_KEY` for quote fallback. Live token listings and canonical addresses come from Robinhood's public `/rhj/assets` endpoint. DexScreener is queried by canonical contract address and filtered to Robinhood Chain pairs. GeckoTerminal fallback is present but disabled unless a verified `GECKO_TERMINAL_NETWORK_ID` is supplied; Robinhood Chain was not listed in the public GeckoTerminal network catalog at implementation time. Underlying quotes come from the official Robinhood `/rhj/prices/{symbol}` API, adjusted by the registry's current multiplier; Finnhub is the fallback. No key is returned to the browser.

## Add a stock

Live mode reads Robinhood's current official asset registry automatically; do not add a manually guessed contract address. For local demo presentation, add a `[ticker, name, basePrice]` tuple to `SYMBOLS` in `src/lib/data.ts`. These entries generate synthetic values and remain marked DEMO DATA.

## Scripts

- `npm run dev` — local development
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript validation
- `npm run build` — production build
- `npm start` — serve production build

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import it from the Vercel dashboard; keep the Next.js framework preset.
3. Add `USE_MOCK_DATA=false`, `FINNHUB_API_KEY`, `GECKO_TERMINAL_NETWORK_ID` (only after verifying a supported slug), and `NEXT_PUBLIC_SITE_URL` in Project Settings → Environment Variables. `ROBINHOOD_CHAIN_RPC_URL` is documented for future direct reads; the current integration relies on Robinhood's public API and DexScreener.
4. Deploy. Confirm `/api/stocks` returns source metadata without secrets and inspect the `demo` flag.
5. Add a domain under Project Settings → Domains, update its DNS records as shown by Vercel, then set `NEXT_PUBLIC_SITE_URL` to the HTTPS origin and redeploy.

## Data limitations

The Robinhood asset registry and quote API are official but the quote API quote is not treated as a pool trade. The registry current multiplier is applied to underlying quotes to compare the token unit against the underlying share value. DexScreener coverage may not exist for every official token. GeckoTerminal fallback needs a verified supported network slug. Finnhub plan access and quote freshness are subject to the user's account and provider limits. Vercel in-memory caching is instance-local. No historical market provider is configured, so history charts clearly report unavailability in live mode. Market hours are approximate and do not incorporate every US market holiday.

## Network facts

Robinhood Chain mainnet is chain ID `4663`, uses ETH, and lists `robinhoodchain.blockscout.com` as the explorer. Official docs list `https://rpc.mainnet.chain.robinhood.com/` as its public RPC and recommend a provider for production use. Canonical Stock Token addresses are resolved dynamically from Robinhood's official registry; no address list is hardcoded.

## Legal

PARITY is an independent project and is not affiliated with or endorsed by Robinhood. Parity is an information tool, not financial advice. Stock Tokens may carry different risks than the underlying shares. Data may be delayed or inaccurate.
