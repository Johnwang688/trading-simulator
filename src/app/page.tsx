"use client";

import { useState, useCallback, useMemo } from "react";
import { Ticker, Timeframe, OrderType, TICKERS } from "@/lib/types";
import { blackScholes, estimateHistoricalVolatility } from "@/lib/black-scholes";
import { RISK_FREE_RATE } from "@/lib/types";
import { useMarketData } from "@/hooks/useMarketData";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useKeyboardTrading } from "@/hooks/useKeyboardTrading";
import Header from "@/components/Header";
import Chart from "@/components/Chart";
import PortfolioPanel from "@/components/Portfolio";
import TradeModal, { TradeParams } from "@/components/TradeModal";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

export default function Home() {
  const [ticker, setTicker] = useState<Ticker>("VRT");
  const [timeframe, setTimeframe] = useState<Timeframe>("1m");
  const [orderType, setOrderType] = useState<OrderType>("buy");
  const [modalOpen, setModalOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const { candles, quote, loading } = useMarketData(ticker, timeframe);
  const {
    portfolio,
    buyingPower,
    buyStock,
    shortStock,
    closePosition,
    buyOption,
    closeOption,
    reset,
    getAccountValue,
  } = usePortfolio();

  const currentPrice = quote?.price || (candles.length > 0 ? candles[candles.length - 1].close : 0);
  const prices = useMemo(() => ({ [ticker]: currentPrice }), [ticker, currentPrice]);
  const accountValue = getAccountValue(prices);

  const historicalPrices = useMemo(
    () => candles.map((c) => c.close),
    [candles]
  );

  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const handleOrderStart = useCallback(
    (type: OrderType) => {
      if (modalOpen) return;
      setOrderType(type);
      setModalOpen(true);
    },
    [modalOpen]
  );

  useKeyboardTrading({
    enabled: !modalOpen,
    onOrderStart: handleOrderStart,
  });

  const handleConfirm = useCallback(
    (params: TradeParams) => {
      let result: { portfolio: any; error?: string };

      switch (params.type) {
        case "buy":
          result = buyStock(ticker, params.shares, currentPrice);
          if (result.error) {
            addToast(result.error, "error");
          } else {
            addToast(`Bought ${params.shares} shares of ${ticker}`, "success");
          }
          break;

        case "short":
          result = shortStock(ticker, params.shares, currentPrice);
          if (result.error) {
            addToast(result.error, "error");
          } else {
            addToast(`Shorted ${params.shares} shares of ${ticker}`, "success");
          }
          break;

        case "call":
        case "put":
          result = buyOption(
            ticker,
            params.type,
            params.contracts,
            params.strike,
            params.premium,
            params.expiration,
            params.iv,
            currentPrice
          );
          if (result.error) {
            addToast(result.error, "error");
          } else {
            addToast(
              `Bought ${params.contracts}x ${ticker} $${params.strike} ${params.type} @ $${params.premium.toFixed(2)}`,
              "success"
            );
          }
          break;
      }

      setModalOpen(false);
    },
    [ticker, currentPrice, buyStock, shortStock, buyOption, addToast]
  );

  const handleClosePosition = useCallback(
    (positionId: string) => {
      const result = closePosition(positionId, currentPrice);
      if (result.error) {
        addToast(result.error, "error");
      } else {
        const trade = result.portfolio.tradeHistory[0];
        const pnlStr = trade?.pnl !== undefined
          ? ` P&L: ${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toFixed(2)}`
          : "";
        addToast(`Position closed.${pnlStr}`, trade?.pnl && trade.pnl >= 0 ? "success" : "error");
      }
    },
    [closePosition, currentPrice, addToast]
  );

  const handleCloseOption = useCallback(
    (optionId: string) => {
      const opt = portfolio.optionPositions.find((o) => o.id === optionId);
      if (!opt) return;

      const T =
        (new Date(opt.expiration).getTime() - Date.now()) /
        (365.25 * 24 * 60 * 60 * 1000);
      const repriced = blackScholes(
        currentPrice,
        opt.strikePrice,
        Math.max(T, 0),
        RISK_FREE_RATE,
        opt.impliedVol,
        opt.type
      );

      const result = closeOption(optionId, repriced.price);
      if (result.error) {
        addToast(result.error, "error");
      } else {
        const trade = result.portfolio.tradeHistory[0];
        const pnlStr = trade?.pnl !== undefined
          ? ` P&L: ${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toFixed(2)}`
          : "";
        addToast(`Option closed.${pnlStr}`, trade?.pnl && trade.pnl >= 0 ? "success" : "error");
      }
    },
    [portfolio.optionPositions, closeOption, currentPrice, addToast]
  );

  return (
    <div className="h-screen flex flex-col">
      <Header
        ticker={ticker}
        onTickerChange={setTicker}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        quote={quote}
        cash={portfolio.cash}
        buyingPower={buyingPower}
        accountValue={accountValue}
        onReset={reset}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Chart area */}
        <div className="flex-1 relative">
          <Chart candles={candles} loading={loading} />
        </div>

        {/* Portfolio sidebar */}
        <div className="w-72 border-l border-white/5 bg-bg-secondary overflow-hidden">
          <PortfolioPanel
            portfolio={portfolio}
            currentPrice={currentPrice}
            ticker={ticker}
            onClosePosition={handleClosePosition}
            onCloseOption={handleCloseOption}
          />
        </div>
      </div>

      {/* Trade Modal */}
      <TradeModal
        isOpen={modalOpen}
        orderType={orderType}
        ticker={ticker}
        currentPrice={currentPrice}
        buyingPower={buyingPower}
        historicalPrices={historicalPrices}
        onConfirm={handleConfirm}
        onClose={() => setModalOpen(false)}
      />

      {/* Toast notifications */}
      <div className="fixed top-16 right-4 z-[60] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-enter px-4 py-2 rounded font-mono text-sm border ${
              toast.type === "success"
                ? "bg-profit/10 text-profit border-profit/20"
                : "bg-loss/10 text-loss border-loss/20"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
