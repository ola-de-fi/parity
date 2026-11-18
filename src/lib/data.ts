import type { HistoryPoint, MarketStatus, Stock } from "@/lib/types";

const DEMO = process.env.USE_MOCK_DATA === "true";
const SYMBOLS: Array<[string, string, number]> = [
  ["AAPL", "Apple Inc.", 228.40], ["TSLA", "Tesla, Inc.", 342.10], ["NVDA", "NVIDIA Corporation", 177.82],
  ["MSFT", "Microsoft Corporation", 512.18], ["AMZN", "Amazon.com, Inc.", 226.54], ["GOOGL", "Alphabet Inc.", 189.60],
  ["META", "Meta Platforms, Inc.", 706.35], ["COIN", "Coinbase Global, Inc.", 319.26], ["ORCL", "Oracle Corporation", 246.75],
  ["MSTR", "Strategy Inc.", 382.14], ["AMD", "Advanced Micro Devices, Inc.", 164.30], ["NFLX", "Netflix, Inc.", 122.73],
  ["PLTR", "Palantir Technologies Inc.", 152.48], ["SPY", "SPDR S&P 500 ETF Trust", 662.84], ["QQQ", "Invesco QQQ Trust", 594.17],
];
const cache = new Map<string, { value: unknown; expires: number }>();
const lastGood = new Map<string, Stock>();
const now = () => new Date().toISOString();
const cached = async <T,>(key: string, ttl: number, load: () => Promise<T>): Promise<T> => {
  const hit = cache.get(key); if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await load(); cache.set(key, { value, expires: Date.now() + ttl }); return value;
};
const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
const amount = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; };
export function getMarketStatus(date = new Date()): MarketStatus {
  const ny = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const parts = Object.fromEntries(ny.map(p => [p.type, p.value])); const day = parts.weekday;
  const m = Number(parts.hour) * 60 + Number(parts.minute);
  if (["Sat", "Sun"].includes(day) || m < 240 || m >= 1200) return "CLOSED";
  if (m < 570) return "PRE-MARKET"; if (m < 960) return "OPEN"; return "AFTER-HOURS";
}
function demoStocks(): Stock[] {
  return SYMBOLS.map(([ticker, name, base], i) => {
    const real = base * (1 + Math.sin(i * 8.27 + new Date().getUTCHours()) * 0.008);
    const gap = Math.sin(i * 4.8 + 2) * 4.4; const token = real * (1 + gap / 100);
    return { ticker, name, tokenPrice: token, realPrice: real, gap, volume24h: (i + 2) * 1_840_000 + i * 57_000,
      liquidity: (15 - i) * 125_000 + 280_000, change24h: Math.sin(i * 3.2) * 6.2, holders: null,
      contractAddress: null, logoUrl: null, updatedAt: now(), stale: false, source: "DEMO" };
  });
}
type Asset = { tokenSymbol?: string; tokenName?: string; logoUrl?: string; status?: string; currentMultiplier?: string; deployments?: Array<{ chainId?: number; contractAddress?: string }> };
async function robinhoodAssets(): Promise<Asset[]> {
  return cached("rh-assets", 60_000, async () => {
    const response = await fetch("https://api.robinhood.com/rhj/assets", { next: { revalidate: 60 } });
    if (!response.ok) throw new Error(`Robinhood assets returned ${response.status}`);
    const body: unknown = await response.json();
    return (body as { assets?: Asset[] }).assets ?? [];
  });
}
async function dexPrice(address: string): Promise<{ price: number | null; liquidity: number | null; volume: number | null; change: number | null }> {
  return cached(`dex:${address}`, 30_000, async () => {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, { next: { revalidate: 30 } });
    if (!response.ok) throw new Error(`DexScreener returned ${response.status}`);
    const body: unknown = await response.json();
    const pairs = (body as { pairs?: Array<{ chainId?: string; priceUsd?: string; priceNative?: string; baseToken?: { address?: string }; quoteToken?: { address?: string }; liquidity?: { usd?: number }; volume?: { h24?: number }; priceChange?: { h24?: number } }> }).pairs ?? [];
    const robinhoodPairs = pairs.filter(p => p.chainId === "robinhood").sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    const pair = robinhoodPairs[0]; const addressLower = address.toLowerCase(); const baseLower = pair?.baseToken?.address?.toLowerCase(); const quoteLower = pair?.quoteToken?.address?.toLowerCase();
    const priceUsd = num(pair?.priceUsd); const nativePrice = num(pair?.priceNative);
    const price = baseLower === addressLower ? priceUsd : quoteLower === addressLower && priceUsd !== null && nativePrice !== null ? priceUsd / nativePrice : null;
    const baseChange = pair?.priceChange?.h24 ?? null;
    const change = baseLower === addressLower ? baseChange : quoteLower === addressLower && baseChange !== null && baseChange > -100 ? ((1 / (1 + baseChange / 100)) - 1) * 100 : null;
    return { price, liquidity: amount(robinhoodPairs.reduce((total, p) => total + (p.liquidity?.usd ?? 0), 0)), volume: amount(robinhoodPairs.reduce((total, p) => total + (p.volume?.h24 ?? 0), 0)), change };
  });
}
async function geckoPrice(address: string): Promise<{ price: number | null; liquidity: number | null; volume: number | null; change: number | null }> {
  const network = process.env.GECKO_TERMINAL_NETWORK_ID;
  if (!network) return { price: null, liquidity: null, volume: null, change: null };
  return cached(`gecko:${address}`, 30_000, async () => {
    const response = await fetch(`https://api.geckoterminal.com/api/v2/networks/${encodeURIComponent(network)}/tokens/${address}/pools`, { headers: { accept: "application/json;version=20230302" }, next: { revalidate: 30 } });
    if (!response.ok) throw new Error(`GeckoTerminal returned ${response.status}`);
    const body: unknown = await response.json();
    const data = (body as { data?: Array<{ attributes?: { token_price_usd?: string; reserve_in_usd?: string; volume_usd?: { h24?: string }; price_change_percentage?: { h24?: string } } }> }).data ?? [];
    const attrs = data.map(d => d.attributes).filter((v): v is NonNullable<typeof v> => Boolean(v)).sort((a,b) => Number(b.reserve_in_usd??0)-Number(a.reserve_in_usd??0))[0];
    return { price: num(attrs?.token_price_usd), liquidity: amount(attrs?.reserve_in_usd), volume: amount(attrs?.volume_usd?.h24), change: Number.isFinite(Number(attrs?.price_change_percentage?.h24)) ? Number(attrs?.price_change_percentage?.h24) : null };
  });
}
async function realPrice(ticker: string, multiplier = 1): Promise<{ price: number | null; updatedAt: string | null; source: string }> {
  try {
    const quote = await cached(`rh-price:${ticker}`, 15_000, async () => {
      const response = await fetch(`https://api.robinhood.com/rhj/prices/${encodeURIComponent(ticker)}`, { next: { revalidate: 15 } });
      if (!response.ok) throw new Error(`Robinhood quote returned ${response.status}`);
      const body: unknown = await response.json(); const q = (body as { quotes?: Array<{ bid?: string; ask?: string; generatedAt?: string }> }).quotes?.[0];
      const bid = num(q?.bid); const ask = num(q?.ask); return { price: bid && ask ? (bid + ask) / 2 : bid ?? ask, updatedAt: q?.generatedAt ?? null };
    });
    if (quote.price !== null) return { price: quote.price * multiplier, updatedAt: quote.updatedAt, source: "Robinhood quote API" };
  } catch { /* Finnhub fallback below. */ }
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return { price: null, updatedAt: null, source: "Unavailable" };
  return cached(`fh:${ticker}`, 45_000, async () => {
    const url = new URL("https://finnhub.io/api/v1/quote"); url.searchParams.set("symbol", ticker); url.searchParams.set("token", key);
    const response = await fetch(url, { next: { revalidate: 45 } }); if (!response.ok) throw new Error(`Finnhub returned ${response.status}`);
    const q: { c?: number; t?: number } = await response.json();
    return { price: num(q.c) === null ? null : num(q.c)! * multiplier, updatedAt: q.t ? new Date(q.t * 1000).toISOString() : null, source: "Finnhub" };
  }).catch(() => ({ price: null, updatedAt: null, source: "Unavailable" }));
}
export async function getTokenizedStocks(): Promise<{ stocks: Stock[]; demo: boolean; note?: string }> {
  if (DEMO) return { stocks: demoStocks(), demo: true };
  try {
    const assets = await robinhoodAssets();
    const stocks = await Promise.all(assets.filter(a => a.status !== "ASSET_STATUS_INACTIVE").map(async asset => {
      const ticker = asset.tokenSymbol?.toUpperCase(); if (!ticker) return null;
      const deployment = asset.deployments?.find(d => d.chainId === 4663); if (!deployment?.contractAddress) return null;
      try {
        const multiplier = Number(asset.currentMultiplier);
        const [dexResult, real] = await Promise.all([dexPrice(deployment.contractAddress).catch(() => null), realPrice(ticker, Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1)]);
        const dex = dexResult?.price !== null && dexResult ? dexResult : await geckoPrice(deployment.contractAddress).catch(() => ({price:null,liquidity:null,volume:null,change:null}));
        const gap = dex.price !== null && real.price !== null ? ((dex.price - real.price) / real.price) * 100 : null;
        const stock: Stock = { ticker, name: asset.tokenName ?? ticker, tokenPrice: dex.price, realPrice: real.price,
          gap, volume24h: dex.volume, liquidity: dex.liquidity, change24h: dex.change, holders: null,
          contractAddress: deployment.contractAddress, logoUrl: asset.logoUrl ?? null, updatedAt: real.updatedAt,
          stale: !real.updatedAt || !Number.isFinite(Date.parse(real.updatedAt)) || Date.now() - Date.parse(real.updatedAt) > 5 * 60_000, source: `DexScreener${process.env.GECKO_TERMINAL_NETWORK_ID ? " / GeckoTerminal" : ""} + ${real.source}` };
        lastGood.set(ticker, stock); return stock;
      } catch {
        const previous = lastGood.get(ticker); return previous ? { ...previous, stale: true } : { ticker, name: asset.tokenName ?? ticker,
          tokenPrice: null, realPrice: null, gap: null, volume24h: null, liquidity: null, change24h: null, holders: null,
          contractAddress: deployment.contractAddress, logoUrl: asset.logoUrl ?? null, updatedAt: null, stale: true, source: "Unavailable" };
      }
    }));
    return { stocks: stocks.filter((s): s is Stock => Boolean(s)), demo: false,
      ...(!process.env.FINNHUB_API_KEY ? { note: "Add FINNHUB_API_KEY to show traditional market quotes. Gaps remain unavailable without both prices." } : {}) };
  } catch (error) {
    return { stocks: [...lastGood.values()].map(s => ({ ...s, stale: true })), demo: false,
      note: error instanceof Error ? `Live registry temporarily unavailable: ${error.message}` : "Live registry temporarily unavailable." };
  }
}
export async function getTokenPrice(ticker: string): Promise<number | null> { return (await getTokenizedStocks()).stocks.find(s => s.ticker === ticker.toUpperCase())?.tokenPrice ?? null; }
export async function getRealStockPrice(ticker: string): Promise<number | null> { return (await realPrice(ticker.toUpperCase())).price; }
export async function getHistory(ticker: string, period = "1D"): Promise<HistoryPoint[]> {
  if (!DEMO) return [];
  const stock = (await getTokenizedStocks()).stocks.find(s => s.ticker === ticker.toUpperCase());
  if (!stock?.tokenPrice || !stock.realPrice) return [];
  const count = period === "1D" ? 24 : period === "7D" ? 42 : 60;
  return Array.from({ length: count }, (_, i) => {
    const delta = (i - count + 1) / Math.max(count, 1); const wave = Math.sin(i * 1.17 + ticker.length) * 0.003;
    const token = stock.tokenPrice! * (1 + delta * 0.006 + wave); const real = stock.realPrice! * (1 + delta * 0.004);
    return { time: new Date(Date.now() - (count - i - 1) * (period === "1D" ? 3_600_000 : 4_800_000)).toISOString(), token, real, gap: ((token - real) / real) * 100 };
  });
}
