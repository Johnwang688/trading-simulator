"use client";

import { Quote, Timeframe, TICKERS, Ticker } from "@/lib/types";

interface HeaderProps {
  ticker: Ticker;
  onTickerChange: (t: Ticker) => void;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  quote: Quote | null;
  cash: number;
  buyingPower: number;
  accountValue: number;
  onReset: () => void;
}

export default function Header({
  ticker,
  onTickerChange,
  timeframe,
  onTimeframeChange,
  quote,
  cash,
  buyingPower,
  accountValue,
  onReset,
}: HeaderProps) {
  const pnl = accountValue - 100_000;
  const pnlPct = (pnl / 100_000) * 100;

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-bg-secondary">
      {/* Left: logo + ticker */}
      <div className="flex items-center gap-4">
        <h1 className="text-accent-cyan font-mono font-bold text-lg tracking-wider">
          TRADESIM
        </h1>

        <select
          value={ticker}
          onChange={(e) => onTickerChange(e.target.value as Ticker)}
          className="bg-bg-tertiary text-white border border-white/10 rounded px-3 py-1 font-mono text-sm focus:outline-none focus:border-accent-cyan"
        >
          {TICKERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Timeframe buttons */}
        <div className="flex gap-1">
          {(["1m", "15m"] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                timeframe === tf
                  ? "bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30"
                  : "bg-bg-tertiary text-neutral border border-white/5 hover:text-white"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Quote */}
        {quote && (
          <div className="flex items-center gap-3 ml-4">
            <span className="text-white font-mono text-xl font-bold">
              ${quote.price.toFixed(2)}
            </span>
            <span
              className={`font-mono text-sm ${
                quote.change >= 0 ? "text-profit" : "text-loss"
              }`}
            >
              {quote.change >= 0 ? "+" : ""}
              {quote.change.toFixed(2)} ({quote.changePercent.toFixed(2)}%)
            </span>
            <span className="text-neutral text-xs font-mono">
              Vol: {formatVolume(quote.volume)}
            </span>
          </div>
        )}
      </div>

      {/* Right: account info */}
      <div className="flex items-center gap-6">
        <div className="text-right">
          <div className="text-neutral text-[10px] font-mono uppercase tracking-wider">
            Account
          </div>
          <div className="text-white font-mono text-sm font-bold">
            ${accountValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="text-right">
          <div className="text-neutral text-[10px] font-mono uppercase tracking-wider">
            P&L
          </div>
          <div
            className={`font-mono text-sm font-bold ${
              pnl >= 0 ? "text-profit" : "text-loss"
            }`}
          >
            {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} ({pnlPct.toFixed(2)}%)
          </div>
        </div>
        <div className="text-right">
          <div className="text-neutral text-[10px] font-mono uppercase tracking-wider">
            Cash
          </div>
          <div className="text-white font-mono text-sm">
            ${cash.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="text-right">
          <div className="text-neutral text-[10px] font-mono uppercase tracking-wider">
            Buying Power
          </div>
          <div className="text-accent-cyan font-mono text-sm">
            ${buyingPower.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <button
          onClick={onReset}
          className="px-3 py-1 text-xs font-mono text-neutral border border-white/10 rounded hover:text-loss hover:border-loss/30 transition-colors"
        >
          RESET
        </button>
      </div>
    </header>
  );
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "K";
  return v.toString();
}
