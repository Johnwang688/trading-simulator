"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Candle, Quote, Timeframe } from "@/lib/types";

export function useMarketData(ticker: string, timeframe: Timeframe) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const quoteInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchCandles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/history?ticker=${ticker}&interval=${timeframe}`);
      if (!res.ok) throw new Error("Failed to fetch candles");
      const data = await res.json();
      setCandles(data.candles || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ticker, timeframe]);

  const fetchQuote = useCallback(async () => {
    try {
      const res = await fetch(`/api/quote?ticker=${ticker}`);
      if (!res.ok) throw new Error("Failed to fetch quote");
      const data = await res.json();
      setQuote(data);

      // Update the last candle with latest price (new array so Chart re-renders)
      setCandles((prev) => {
        if (prev.length === 0 || !data.price) return prev;
        const last = prev[prev.length - 1];
        const newClose = data.price;
        const newHigh = Math.max(last.high, newClose);
        const newLow = Math.min(last.low, newClose);
        // Skip update if nothing changed
        if (last.close === newClose && last.high === newHigh && last.low === newLow) {
          return prev;
        }
        return [...prev.slice(0, -1), { ...last, close: newClose, high: newHigh, low: newLow }];
      });
    } catch (err: any) {
      console.error("Quote fetch error:", err.message);
    }
  }, [ticker]);

  // Fetch candles on mount and timeframe change
  useEffect(() => {
    fetchCandles();
  }, [fetchCandles]);

  // Poll quote every 15 seconds
  useEffect(() => {
    fetchQuote();
    quoteInterval.current = setInterval(fetchQuote, 15000);
    return () => {
      if (quoteInterval.current) clearInterval(quoteInterval.current);
    };
  }, [fetchQuote]);

  return { candles, quote, loading, error, refetchCandles: fetchCandles };
}
