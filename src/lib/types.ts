export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Position {
  id: string;
  ticker: string;
  type: "long" | "short";
  shares: number;
  entryPrice: number;
  timestamp: number;
}

export interface OptionPosition {
  id: string;
  ticker: string;
  type: "call" | "put";
  contracts: number;
  strikePrice: number;
  entryPremium: number;
  expiration: string;
  impliedVol: number;
  entryUnderlyingPrice: number;
  timestamp: number;
}

export interface Portfolio {
  cash: number;
  initialCash: number;
  positions: Position[];
  optionPositions: OptionPosition[];
  tradeHistory: Trade[];
}

export interface Trade {
  id: string;
  ticker: string;
  type: "buy" | "sell" | "short" | "cover" | "buy-call" | "buy-put" | "sell-call" | "sell-put";
  quantity: number;
  price: number;
  timestamp: number;
  pnl?: number;
}

export interface Quote {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
  marketState: string;
}

export type Timeframe = "1m" | "15m";
export type OrderType = "buy" | "short" | "call" | "put";

export interface OptionQuote {
  strike: number;
  expiration: string;
  type: "call" | "put";
  premium: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
}

export interface VolumeProfileBin {
  price: number;
  volume: number;
  pct: number;
}

export const TICKERS = ["VRT"] as const;
export type Ticker = (typeof TICKERS)[number];

export const INITIAL_CASH = 100_000;
export const LEVERAGE = 2;
export const SPREAD_PCT = 0.0002;
export const SLIPPAGE_MAX_PCT = 0.0001;
export const RISK_FREE_RATE = 0.05;
