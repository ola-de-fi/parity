import { getHistory } from "@/lib/data";
import { NextResponse } from "next/server";
export async function GET(request: Request, context: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await context.params; const period = new URL(request.url).searchParams.get("period") ?? "1D";
  if (!["1D", "7D", "30D"].includes(period)) return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  return NextResponse.json({ history: await getHistory(ticker, period), period }, { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=30" } });
}
