"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  LineData,
  ColorType,
  CrosshairMode,
  Time,
} from "lightweight-charts";
import { Candle, VolumeProfileBin } from "@/lib/types";
import { calculateEMA, calculateVWAP, calculateVolumeProfile } from "@/lib/indicators";

/**
 * Shift a UTC Unix timestamp so lightweight-charts (which renders as UTC)
 * displays the value in America/New_York local time.
 * Uses formatToParts to avoid browser-local-timezone parsing pitfalls.
 */
const nyFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function toNewYorkTime(utcSeconds: number): number {
  const d = new Date(utcSeconds * 1000);
  const parts = nyFormatter.formatToParts(d);
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value || "0", 10);
  // Build a UTC timestamp with NY wall-clock values so the chart displays them as-is
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) / 1000;
}

interface ChartProps {
  candles: Candle[];
  loading: boolean;
}

export default function Chart({ candles, loading }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema9Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema21Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [showEMA, setShowEMA] = useState(true);
  const [showVWAP, setShowVWAP] = useState(true);
  const [showVolumeProfile, setShowVolumeProfile] = useState(true);

  const volumeProfile = useMemo(() => {
    if (!showVolumeProfile || candles.length === 0) return [];
    return calculateVolumeProfile(candles, 40);
  }, [candles, showVolumeProfile]);

  // Positioned bins in pixel coordinates, recomputed on zoom/pan/resize so
  // each bar sits at its actual price level on the chart.
  const [positionedBins, setPositionedBins] = useState<
    { top: number; height: number; price: number; pct: number }[]
  >([]);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#08080f" },
        textColor: "#8888aa",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#ffffff06" },
        horzLines: { color: "#ffffff06" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#00d4ff40", width: 1, style: 2 },
        horzLine: { color: "#00d4ff40", width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: "#ffffff10",
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: "#ffffff10",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#00ff88",
      downColor: "#ff3366",
      borderUpColor: "#00ff88",
      borderDownColor: "#ff3366",
      wickUpColor: "#00ff8888",
      wickDownColor: "#ff336688",
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const ema9 = chart.addLineSeries({
      color: "#ffaa00",
      lineWidth: 1,
      title: "EMA 9",
      crosshairMarkerVisible: false,
    });

    const ema21 = chart.addLineSeries({
      color: "#0088ff",
      lineWidth: 1,
      title: "EMA 21",
      crosshairMarkerVisible: false,
    });

    const vwap = chart.addLineSeries({
      color: "#ff00ff88",
      lineWidth: 2,
      lineStyle: 2,
      title: "VWAP",
      crosshairMarkerVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    ema9Ref.current = ema9;
    ema21Ref.current = ema21;
    vwapRef.current = vwap;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Track previous candle count and last candle to distinguish full loads from quote updates
  const prevCandleCountRef = useRef(0);
  const prevLastCandleRef = useRef<Candle | null>(null);

  // Full data load — runs on new dataset or indicator toggle
  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return;

    const prevCount = prevCandleCountRef.current;
    const countDelta = candles.length - prevCount;
    // Full reload only on initial load or when the dataset shrinks/grows by more than one
    const isNewDataset = prevCount === 0 || countDelta < 0 || countDelta > 1;

    // Incremental update: either new candle appended (+1) or last candle changed
    if (!isNewDataset && prevLastCandleRef.current) {
      const last = candles[candles.length - 1];
      const prev = prevLastCandleRef.current;
      const changed =
        countDelta === 1 ||
        last.close !== prev.close ||
        last.high !== prev.high ||
        last.low !== prev.low;

      if (changed) {
        const nyTime = toNewYorkTime(last.time) as Time;

        // Update just the last bar in-place — no scroll, no full redraw
        candleSeriesRef.current.update({
          time: nyTime,
          open: last.open,
          high: last.high,
          low: last.low,
          close: last.close,
        });

        volumeSeriesRef.current?.update({
          time: nyTime,
          value: last.volume,
          color: last.close >= last.open ? "#00ff8820" : "#ff336620",
        });

        // Update last point of indicators
        if (showEMA) {
          const ema9Data = calculateEMA(candles, 9);
          const ema21Data = calculateEMA(candles, 21);
          if (ema9Data.length > 0) {
            const e9 = ema9Data[ema9Data.length - 1];
            ema9Ref.current?.update({ time: toNewYorkTime(e9.time) as Time, value: e9.value });
          }
          if (ema21Data.length > 0) {
            const e21 = ema21Data[ema21Data.length - 1];
            ema21Ref.current?.update({ time: toNewYorkTime(e21.time) as Time, value: e21.value });
          }
        }
        if (showVWAP) {
          const vwapData = calculateVWAP(candles);
          if (vwapData.length > 0) {
            const v = vwapData[vwapData.length - 1];
            vwapRef.current?.update({ time: toNewYorkTime(v.time) as Time, value: v.value });
          }
        }

        prevLastCandleRef.current = candles[candles.length - 1];
        prevCandleCountRef.current = candles.length;
        return;
      }
    }

    // Full data load path
    const candleData: CandlestickData[] = candles.map((c) => ({
      time: toNewYorkTime(c.time) as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumeData: HistogramData[] = candles.map((c) => ({
      time: toNewYorkTime(c.time) as Time,
      value: c.volume,
      color: c.close >= c.open ? "#00ff8820" : "#ff336620",
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current?.setData(volumeData);

    // EMA
    if (showEMA) {
      const ema9Data = calculateEMA(candles, 9).map((d) => ({
        time: toNewYorkTime(d.time) as Time,
        value: d.value,
      }));
      const ema21Data = calculateEMA(candles, 21).map((d) => ({
        time: toNewYorkTime(d.time) as Time,
        value: d.value,
      }));
      ema9Ref.current?.setData(ema9Data);
      ema21Ref.current?.setData(ema21Data);
    } else {
      ema9Ref.current?.setData([]);
      ema21Ref.current?.setData([]);
    }

    // VWAP
    if (showVWAP) {
      const vwapData = calculateVWAP(candles).map((d) => ({
        time: toNewYorkTime(d.time) as Time,
        value: d.value,
      }));
      vwapRef.current?.setData(vwapData);
    } else {
      vwapRef.current?.setData([]);
    }

    // Only scroll to latest on initial load or when ticker/timeframe changes
    prevCandleCountRef.current = candles.length;
    prevLastCandleRef.current = candles[candles.length - 1];
    if (isNewDataset) {
      chartRef.current?.timeScale().scrollToRealTime();
    }
  }, [candles, showEMA, showVWAP]);

  // Align volume-profile bins to actual y-pixel of each price level using the
  // chart's priceToCoordinate — so bins track zoom/pan and don't suggest
  // liquidity at prices outside the visible range.
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;
    if (!showVolumeProfile || volumeProfile.length === 0) {
      setPositionedBins([]);
      return;
    }

    const series = candleSeriesRef.current;
    const binSize =
      volumeProfile.length > 1
        ? volumeProfile[1].price - volumeProfile[0].price
        : 0;

    const recompute = () => {
      const next: { top: number; height: number; price: number; pct: number }[] = [];
      for (const bin of volumeProfile) {
        const yTop = series.priceToCoordinate(bin.price + binSize / 2);
        const yBot = series.priceToCoordinate(bin.price - binSize / 2);
        if (yTop == null || yBot == null) continue;
        const top = Math.min(yTop, yBot);
        const height = Math.max(1, Math.abs(yBot - yTop));
        next.push({ top, height, price: bin.price, pct: bin.pct });
      }
      setPositionedBins(next);
    };

    recompute();

    const timeScale = chartRef.current.timeScale();
    const onRange = () => recompute();
    timeScale.subscribeVisibleLogicalRangeChange(onRange);

    const ro = new ResizeObserver(recompute);
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      timeScale.unsubscribeVisibleLogicalRangeChange(onRange);
      ro.disconnect();
    };
  }, [volumeProfile, showVolumeProfile, candles]);

  return (
    <div className="relative flex-1 h-full">
      {/* Indicator toggles */}
      <div className="absolute top-2 left-2 z-10 flex gap-2">
        <button
          onClick={() => setShowEMA(!showEMA)}
          className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
            showEMA
              ? "bg-white/10 text-white border border-white/20"
              : "bg-transparent text-neutral border border-white/5"
          }`}
        >
          EMA 9/21
        </button>
        <button
          onClick={() => setShowVWAP(!showVWAP)}
          className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
            showVWAP
              ? "bg-white/10 text-white border border-white/20"
              : "bg-transparent text-neutral border border-white/5"
          }`}
        >
          VWAP
        </button>
        <button
          onClick={() => setShowVolumeProfile(!showVolumeProfile)}
          className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
            showVolumeProfile
              ? "bg-white/10 text-white border border-white/20"
              : "bg-transparent text-neutral border border-white/5"
          }`}
        >
          VOL PROFILE
        </button>
      </div>

      {/* Volume Profile Overlay — bins positioned at actual y-pixel of their price */}
      {showVolumeProfile && positionedBins.length > 0 && (
        <div
          className="absolute right-12 top-0 bottom-0 z-[5] pointer-events-none"
          style={{ width: "120px" }}
        >
          {positionedBins.map((bin, i) => {
            const lastClose = candles[candles.length - 1]?.close || 0;
            return (
              <div
                key={i}
                className="absolute right-0 flex items-center justify-end"
                style={{
                  top: `${bin.top}px`,
                  height: `${bin.height}px`,
                  width: "100%",
                }}
              >
                <div
                  className="rounded-l"
                  style={{
                    width: `${bin.pct * 100}%`,
                    height: `${Math.max(1, bin.height - 1)}px`,
                    backgroundColor:
                      bin.price >= lastClose
                        ? "rgba(0, 255, 136, 0.12)"
                        : "rgba(255, 51, 102, 0.12)",
                    borderLeft:
                      bin.pct > 0.7
                        ? "2px solid rgba(0, 212, 255, 0.3)"
                        : "none",
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg-primary/80">
          <div className="text-accent-cyan font-mono text-sm animate-pulse">
            Loading chart data...
          </div>
        </div>
      )}

      {/* Chart container */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
