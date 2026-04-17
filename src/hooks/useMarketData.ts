"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Candle, Quote, Timeframe } from "@/lib/types";

export function useMarketData(ticker: string, timeframe: Timeframe) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const quoteInterval = useRef<NodeJS.Timeout | null>(null);
  const lastRefetchRef = useRef(0);
  const latestCandleTimeRef = useRef(0);

  const fetchCandles = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/history?ticker=${ticker}&interval=${timeframe}`);
      if (!res.ok) throw new Error("Failed to fetch candles");
      const data = await res.json();
      const next: Candle[] = data.candles || [];
      setCandles(next);
      if (next.length > 0) latestCandleTimeRef.current = next[next.length - 1].time;
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [ticker, timeframe]);

  const fetchQuote = useCallback(async () => {
    try {
      const res = await fetch(`/api/quote?ticker=${ticker}`);
      if (!res.ok) throw new Error("Failed to fetch quote");
      const data = await res.json();
      setQuote(data);

      // Update the last candle's close/high/low with the latest price.
      // New candles are never synthesized here — they come from Yahoo on refetch.
      setCandles((prev) => {
        if (prev.length === 0 || !data.price) return prev;
        const last = prev[prev.length - 1];
        const newClose = data.price;
        const newHigh = Math.max(last.high, newClose);
        const newLow = Math.min(last.low, newClose);
        if (last.close === newClose && last.high === newHigh && last.low === newLow) {
          return prev;
        }
        return [...prev.slice(0, -1), { ...last, close: newClose, high: newHigh, low: newLow }];
      });

      // If the current wall clock has crossed into a new interval bucket past
      // the last known candle, refetch history so Yahoo's new candle appears.
      const intervalSec = timeframe === "1m" ? 60 : 900;
      const nowSec = Math.floor(Date.now() / 1000);
      const lastTime = latestCandleTimeRef.current;
      if (
        lastTime > 0 &&
        nowSec >= lastTime + intervalSec &&
        nowSec - lastRefetchRef.current >= 15
      ) {
        lastRefetchRef.current = nowSec;
        fetchCandles(true);
      }
    } catch (err: any) {
      console.error("Quote fetch error:", err.message);
    }
  }, [ticker, timeframe, fetchCandles]);

  // Fetch candles on mount and timeframe change
  useEffect(() => {
    fetchCandles();
  }, [fetchCandles]);

  // Poll quote every 5 seconds for near-real-time price updates
  useEffect(() => {
    fetchQuote();
    quoteInterval.current = setInterval(fetchQuote, 5000);
    return () => {
      if (quoteInterval.current) clearInterval(quoteInterval.current);
    };
  }, [fetchQuote]);

  return { candles, quote, loading, error, refetchCandles: fetchCandles };
}
