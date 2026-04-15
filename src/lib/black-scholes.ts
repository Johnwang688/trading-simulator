import { RISK_FREE_RATE } from "./types";

function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export interface BSResult {
  price: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export function blackScholes(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  type: "call" | "put"
): BSResult {
  if (T <= 0) {
    const intrinsic =
      type === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0);
    return { price: intrinsic, delta: type === "call" ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, theta: 0, vega: 0 };
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const Nd1 = normalCDF(d1);
  const Nd2 = normalCDF(d2);
  const nd1 = normalPDF(d1);

  let price: number;
  let delta: number;

  if (type === "call") {
    price = S * Nd1 - K * Math.exp(-r * T) * Nd2;
    delta = Nd1;
  } else {
    price = K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
    delta = Nd1 - 1;
  }

  const gamma = nd1 / (S * sigma * sqrtT);
  const theta =
    (-(S * nd1 * sigma) / (2 * sqrtT) -
      r * K * Math.exp(-r * T) * (type === "call" ? Nd2 : normalCDF(-d2))) /
    365;
  const vega = (S * nd1 * sqrtT) / 100;

  return { price: Math.max(price, 0), delta, gamma, theta, vega };
}

export function estimateHistoricalVolatility(prices: number[]): number {
  if (prices.length < 2) return 0.3;

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1);

  // Annualize: assume ~252 trading days
  return Math.sqrt(variance * 252);
}

export function generateOptionChain(
  underlyingPrice: number,
  historicalVol: number,
  type: "call" | "put"
): { strikes: number[]; expirations: string[]; quotes: Map<string, BSResult> } {
  const r = RISK_FREE_RATE;
  const iv = Math.max(historicalVol, 0.15);

  // Generate strikes: every $5 within ±20% of current price
  const strikeStep = underlyingPrice > 100 ? 5 : 2.5;
  const minStrike = Math.floor((underlyingPrice * 0.8) / strikeStep) * strikeStep;
  const maxStrike = Math.ceil((underlyingPrice * 1.2) / strikeStep) * strikeStep;
  const strikes: number[] = [];
  for (let s = minStrike; s <= maxStrike; s += strikeStep) {
    strikes.push(s);
  }

  // Generate expirations: weekly for 4 weeks, then monthly for 2 months
  const expirations: string[] = [];
  const now = new Date();
  for (let w = 1; w <= 4; w++) {
    const d = new Date(now);
    d.setDate(d.getDate() + w * 7);
    // Snap to Friday
    const day = d.getDay();
    d.setDate(d.getDate() + ((5 - day + 7) % 7));
    expirations.push(d.toISOString().split("T")[0]);
  }
  for (let m = 2; m <= 3; m++) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + m);
    // Third Friday of month
    d.setDate(1);
    const firstDay = d.getDay();
    const thirdFriday = 15 + ((5 - firstDay + 7) % 7);
    d.setDate(thirdFriday);
    expirations.push(d.toISOString().split("T")[0]);
  }

  const quotes = new Map<string, BSResult>();
  for (const exp of expirations) {
    const T = (new Date(exp).getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (T <= 0) continue;
    for (const K of strikes) {
      const result = blackScholes(underlyingPrice, K, T, r, iv, type);
      quotes.set(`${exp}:${K}`, result);
    }
  }

  return { strikes, expirations, quotes };
}
