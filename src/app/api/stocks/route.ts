import { getMarketStatus, getTokenizedStocks } from "@/lib/data";
import { NextResponse } from "next/server";
export async function GET() {
  const data = await getTokenizedStocks();
  return NextResponse.json({ ...data, updatedAt: new Date().toISOString(), marketStatus: getMarketStatus() }, { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=30" } });
}
