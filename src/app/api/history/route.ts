import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const YF_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

// Cookie/crumb cache
let cachedCrumb: string | null = null;
let cachedCookie: string | null = null;
let crumbExpiry = 0;

async function getCrumbAndCookie(): Promise<{ crumb: string; cookie: string }> {
  if (cachedCrumb && cachedCookie && Date.now() < crumbExpiry) {
    return { crumb: cachedCrumb, cookie: cachedCookie };
  }

  // Step 1: Get consent cookie
  const consentRes = await fetch("https://fc.yahoo.com", { redirect: "manual" });
  const setCookieHeader = consentRes.headers.get("set-cookie") || "";
  const cookies = setCookieHeader.split(",").map((c) => c.split(";")[0].trim()).join("; ");

  // Step 2: Get crumb
  const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: { Cookie: cookies, "User-Agent": "Mozilla/5.0" },
  });
  const crumb = await crumbRes.text();

  cachedCrumb = crumb;
  cachedCookie = cookies;
  crumbExpiry = Date.now() + 30 * 60 * 1000; // 30 min

  return { crumb, cookie: cookies };
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker") || "VRT";
  const interval = req.nextUrl.searchParams.get("interval") || "1m";

  const validIntervals = ["1m", "15m"];
  const selectedInterval = validIntervals.includes(interval) ? interval : "1m";
  const range = selectedInterval === "1m" ? "5d" : "60d";

  try {
    const { crumb, cookie } = await getCrumbAndCookie();

    const url = `${YF_BASE}/${encodeURIComponent(ticker)}?interval=${selectedInterval}&range=${range}&crumb=${encodeURIComponent(crumb)}&includePrePost=false`;

    const res = await fetch(url, {
      headers: {
        Cookie: cookie,
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance returned ${res.status}`);
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];

    if (!result) {
      throw new Error("No data returned from Yahoo Finance");
    }

    const timestamps = result.timestamp || [];
    const ohlcv = result.indicators?.quote?.[0] || {};

    const candles = [];
    for (let i = 0; i < timestamps.length; i++) {
      const o = ohlcv.open?.[i];
      const h = ohlcv.high?.[i];
      const l = ohlcv.low?.[i];
      const c = ohlcv.close?.[i];
      const v = ohlcv.volume?.[i];
      if (o != null && h != null && l != null && c != null) {
        candles.push({
          time: timestamps[i],
          open: o,
          high: h,
          low: l,
          close: c,
          volume: v || 0,
        });
      }
    }

    return NextResponse.json(
      { candles, ticker, interval: selectedInterval },
      {
        headers: {
          "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error: any) {
    console.error("Yahoo Finance history error:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch history", message: error.message },
      { status: 500 }
    );
  }
}
