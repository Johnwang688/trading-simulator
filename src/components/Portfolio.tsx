"use client";

import { Portfolio as PortfolioType, Position, OptionPosition } from "@/lib/types";
import { blackScholes } from "@/lib/black-scholes";
import { RISK_FREE_RATE } from "@/lib/types";

interface PortfolioProps {
  portfolio: PortfolioType;
  currentPrice: number;
  ticker: string;
  onClosePosition: (id: string) => void;
  onCloseOption: (id: string) => void;
}

export default function PortfolioPanel({
  portfolio,
  currentPrice,
  ticker,
  onClosePosition,
  onCloseOption,
}: PortfolioProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Positions */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2 border-b border-white/5">
          <h3 className="text-neutral text-[10px] font-mono uppercase tracking-wider">
            Stock Positions
          </h3>
        </div>
        {portfolio.positions.length === 0 ? (
          <div className="px-3 py-4 text-neutral text-xs font-mono text-center">
            No open positions
          </div>
        ) : (
          portfolio.positions.map((pos) => (
            <StockPositionRow
              key={pos.id}
              position={pos}
              currentPrice={currentPrice}
              onClose={() => onClosePosition(pos.id)}
            />
          ))
        )}

        <div className="px-3 py-2 border-b border-white/5 border-t border-white/5 mt-2">
          <h3 className="text-neutral text-[10px] font-mono uppercase tracking-wider">
            Options
          </h3>
        </div>
        {portfolio.optionPositions.length === 0 ? (
          <div className="px-3 py-4 text-neutral text-xs font-mono text-center">
            No option positions
          </div>
        ) : (
          portfolio.optionPositions.map((opt) => (
            <OptionPositionRow
              key={opt.id}
              option={opt}
              currentPrice={currentPrice}
              onClose={() => onCloseOption(opt.id)}
            />
          ))
        )}
      </div>

      {/* Trade History */}
      <div className="border-t border-white/5">
        <div className="px-3 py-2">
          <h3 className="text-neutral text-[10px] font-mono uppercase tracking-wider">
            Recent Trades
          </h3>
        </div>
        <div className="max-h-40 overflow-y-auto">
          {portfolio.tradeHistory.slice(0, 20).map((trade) => (
            <div
              key={trade.id}
              className="px-3 py-1 flex justify-between text-xs font-mono border-b border-white/[0.02]"
            >
              <span
                className={
                  trade.type === "buy" || trade.type === "buy-call" || trade.type === "buy-put"
                    ? "text-profit"
                    : trade.type === "short"
                    ? "text-loss"
                    : "text-neutral"
                }
              >
                {trade.type.toUpperCase()} {trade.quantity}
              </span>
              <span className="text-white">${trade.price.toFixed(2)}</span>
              {trade.pnl !== undefined && (
                <span className={trade.pnl >= 0 ? "text-profit" : "text-loss"}>
                  {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Keyboard shortcuts */}
      <div className="border-t border-white/5 px-3 py-2">
        <div className="text-neutral text-[9px] font-mono space-y-0.5">
          <div><span className="text-accent-cyan">SPACE</span> Buy</div>
          <div><span className="text-accent-cyan">SHIFT+SPACE</span> Short</div>
          <div><span className="text-accent-cyan">ALT+SPACE</span> Call</div>
          <div><span className="text-accent-cyan">SHIFT+ALT+SPACE</span> Put</div>
        </div>
      </div>
    </div>
  );
}

function StockPositionRow({
  position,
  currentPrice,
  onClose,
}: {
  position: Position;
  currentPrice: number;
  onClose: () => void;
}) {
  const pnl =
    position.type === "long"
      ? (currentPrice - position.entryPrice) * position.shares
      : (position.entryPrice - currentPrice) * position.shares;
  const pnlPct = (pnl / (position.entryPrice * position.shares)) * 100;

  return (
    <div className="px-3 py-2 border-b border-white/[0.03] hover:bg-white/[0.02] group">
      <div className="flex justify-between items-start">
        <div>
          <span
            className={`text-xs font-mono font-bold ${
              position.type === "long" ? "text-profit" : "text-loss"
            }`}
          >
            {position.type === "long" ? "LONG" : "SHORT"}{" "}
          </span>
          <span className="text-white text-xs font-mono">
            {position.shares} @ ${position.entryPrice.toFixed(2)}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[10px] font-mono text-neutral opacity-0 group-hover:opacity-100 border border-white/10 px-2 py-0.5 rounded hover:text-loss hover:border-loss/30 transition-all"
        >
          CLOSE
        </button>
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-neutral text-[10px] font-mono">
          MKT ${currentPrice.toFixed(2)}
        </span>
        <span
          className={`text-xs font-mono font-bold ${
            pnl >= 0 ? "text-profit" : "text-loss"
          }`}
        >
          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} ({pnlPct.toFixed(1)}%)
        </span>
      </div>
    </div>
  );
}

function OptionPositionRow({
  option,
  currentPrice,
  onClose,
}: {
  option: OptionPosition;
  currentPrice: number;
  onClose: () => void;
}) {
  // Reprice option with current underlying price
  const T =
    (new Date(option.expiration).getTime() - Date.now()) /
    (365.25 * 24 * 60 * 60 * 1000);
  const result = blackScholes(
    currentPrice,
    option.strikePrice,
    Math.max(T, 0),
    RISK_FREE_RATE,
    option.impliedVol,
    option.type
  );
  const currentPremium = result.price;
  const pnl = (currentPremium - option.entryPremium) * option.contracts * 100;

  return (
    <div className="px-3 py-2 border-b border-white/[0.03] hover:bg-white/[0.02] group">
      <div className="flex justify-between items-start">
        <div>
          <span
            className={`text-xs font-mono font-bold ${
              option.type === "call" ? "text-profit" : "text-loss"
            }`}
          >
            {option.type.toUpperCase()}{" "}
          </span>
          <span className="text-white text-xs font-mono">
            {option.contracts}x ${option.strikePrice} {option.expiration}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[10px] font-mono text-neutral opacity-0 group-hover:opacity-100 border border-white/10 px-2 py-0.5 rounded hover:text-loss hover:border-loss/30 transition-all"
        >
          CLOSE
        </button>
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-neutral text-[10px] font-mono">
          Prem ${currentPremium.toFixed(2)} | D {result.delta.toFixed(2)}
        </span>
        <span
          className={`text-xs font-mono font-bold ${
            pnl >= 0 ? "text-profit" : "text-loss"
          }`}
        >
          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
