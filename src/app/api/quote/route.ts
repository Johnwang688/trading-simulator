import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const YF_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

// Reuse crumb/cookie cache from history route via module-level vars
let cachedCrumb: string | null = null;
let cachedCookie: string | null = null;
let crumbExpiry = 0;

async function getCrumbAndCookie(): Promise<{ crumb: string; cookie: string }> {
  if (cachedCrumb && cachedCookie && Date.now() < crumbExpiry) {
    return { crumb: cachedCrumb, cookie: cachedCookie };
  }

  const consentRes = await fetch("https://fc.yahoo.com", { redirect: "manual" });
  const setCookieHeader = consentRes.headers.get("set-cookie") || "";
  const cookies = setCookieHeader
    .split(",")
    .map((c) => c.split(";")[0].trim())
    .join("; ");

  const crumbRes = await fetch(
    "https://query2.finance.yahoo.com/v1/test/getcrumb",
    {
      headers: { Cookie: cookies, "User-Agent": "Mozilla/5.0" },
    }
  );
  const crumb = await crumbRes.text();

  cachedCrumb = crumb;
  cachedCookie = cookies;
  crumbExpiry = Date.now() + 30 * 60 * 1000;

  return { crumb, cookie: cookies };
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker") || "VRT";

  try {
    const { crumb, cookie } = await getCrumbAndCookie();

    // Use chart endpoint with 1d range to get current quote data
    const url = `${YF_BASE}/${encodeURIComponent(ticker)}?interval=1m&range=1d&crumb=${encodeURIComponent(crumb)}&includePrePost=false`;

    const res = await fetch(url, {
      headers: {
        Cookie: cookie,
        "User-Agent": "Mozilla/5.0",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance returned ${res.status}`);
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;

    if (!meta) {
      throw new Error("No quote data returned");
    }

    const quote = {
      price: meta.regularMarketPrice || 0,
      previousClose: meta.previousClose || meta.chartPreviousClose || 0,
      change: (meta.regularMarketPrice || 0) - (meta.previousClose || meta.chartPreviousClose || 0),
      changePercent:
        ((meta.regularMarketPrice || 0) - (meta.previousClose || meta.chartPreviousClose || 0)) /
        (meta.previousClose || meta.chartPreviousClose || 1) *
        100,
      volume: meta.regularMarketVolume || 0,
      high: meta.regularMarketDayHigh || meta.regularMarketPrice || 0,
      low: meta.regularMarketDayLow || meta.regularMarketPrice || 0,
      open: meta.regularMarketOpen || meta.regularMarketPrice || 0,
      timestamp: Date.now(),
      marketState: meta.currentTradingPeriod?.regular ? "REGULAR" : "CLOSED",
    };

    console.log(`[quote] ${ticker}: price=${quote.price} open=${quote.open} high=${quote.high} low=${quote.low} vol=${quote.volume} state=${quote.marketState}`);

    return NextResponse.json(quote, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Yahoo Finance quote error:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch quote", message: error.message },
      { status: 500 }
    );
  }
}
