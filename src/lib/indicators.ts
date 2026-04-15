import { Candle, VolumeProfileBin } from "./types";

export function calculateEMA(candles: Candle[], period: number): { time: number; value: number }[] {
  if (candles.length === 0) return [];

  const k = 2 / (period + 1);
  const result: { time: number; value: number }[] = [];

  // Start with SMA for the first `period` candles
  let sum = 0;
  for (let i = 0; i < Math.min(period, candles.length); i++) {
    sum += candles[i].close;
  }
  let ema = sum / Math.min(period, candles.length);
  result.push({ time: candles[Math.min(period - 1, candles.length - 1)].time, value: ema });

  for (let i = period; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    result.push({ time: candles[i].time, value: ema });
  }

  return result;
}

export function calculateVWAP(candles: Candle[]): { time: number; value: number }[] {
  if (candles.length === 0) return [];

  const result: { time: number; value: number }[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  let currentDay = "";

  for (const candle of candles) {
    // Use New York date for trading day boundaries
    const nyStr = new Date(candle.time * 1000).toLocaleDateString("en-US", { timeZone: "America/New_York" });
    const day = nyStr;

    // Reset VWAP each new trading day
    if (day !== currentDay) {
      cumulativeTPV = 0;
      cumulativeVolume = 0;
      currentDay = day;
    }

    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativeTPV += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;

    if (cumulativeVolume > 0) {
      result.push({
        time: candle.time,
        value: cumulativeTPV / cumulativeVolume,
      });
    }
  }

  return result;
}

export function calculateVolumeProfile(candles: Candle[], bins: number = 30): VolumeProfileBin[] {
  if (candles.length === 0) return [];

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  for (const c of candles) {
    minPrice = Math.min(minPrice, c.low);
    maxPrice = Math.max(maxPrice, c.high);
  }

  const range = maxPrice - minPrice;
  if (range === 0) return [];

  const binSize = range / bins;
  const profile: number[] = new Array(bins).fill(0);
  let maxVol = 0;

  for (const candle of candles) {
    // Distribute volume across the candle's price range
    const lowBin = Math.max(0, Math.floor((candle.low - minPrice) / binSize));
    const highBin = Math.min(bins - 1, Math.floor((candle.high - minPrice) / binSize));
    const binsSpanned = highBin - lowBin + 1;
    const volPerBin = candle.volume / binsSpanned;

    for (let b = lowBin; b <= highBin; b++) {
      profile[b] += volPerBin;
      maxVol = Math.max(maxVol, profile[b]);
    }
  }

  return profile.map((vol, i) => ({
    price: minPrice + (i + 0.5) * binSize,
    volume: vol,
    pct: maxVol > 0 ? vol / maxVol : 0,
  }));
}
