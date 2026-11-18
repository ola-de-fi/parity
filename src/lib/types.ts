export type Stock = {
  ticker: string; name: string; tokenPrice: number | null; realPrice: number | null;
  gap: number | null; volume24h: number | null; liquidity: number | null;
  change24h: number | null; holders: number | null; contractAddress: string | null;
  logoUrl: string | null; updatedAt: string | null; stale: boolean; source: string;
};
export type MarketStatus = "OPEN" | "CLOSED" | "PRE-MARKET" | "AFTER-HOURS";
export type StocksResponse = { stocks: Stock[]; updatedAt: string; demo: boolean; marketStatus: MarketStatus; note?: string };
export type HistoryPoint = { time: string; token: number; real: number; gap: number };
