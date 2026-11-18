import { getTokenizedStocks } from "@/lib/data";
import { NextResponse } from "next/server";
export async function GET(_request: Request, context: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await context.params; const symbol = ticker.toUpperCase();
  const { stocks, demo } = await getTokenizedStocks(); const stock = stocks.find(s => s.ticker === symbol);
  return stock ? NextResponse.json({ stock, demo }) : NextResponse.json({ error: "Stock not found" }, { status: 404 });
}
