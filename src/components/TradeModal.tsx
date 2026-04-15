"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { OrderType, RISK_FREE_RATE } from "@/lib/types";
import { generateOptionChain, estimateHistoricalVolatility, blackScholes, BSResult } from "@/lib/black-scholes";

interface TradeModalProps {
  isOpen: boolean;
  orderType: OrderType;
  ticker: string;
  currentPrice: number;
  buyingPower: number;
  historicalPrices: number[];
  onConfirm: (params: TradeParams) => void;
  onClose: () => void;
}

export type TradeParams =
  | { type: "buy"; shares: number }
  | { type: "short"; shares: number }
  | { type: "call"; contracts: number; strike: number; expiration: string; premium: number; iv: number }
  | { type: "put"; contracts: number; strike: number; expiration: string; premium: number; iv: number };

export default function TradeModal({
  isOpen,
  orderType,
  ticker,
  currentPrice,
  buyingPower,
  historicalPrices,
  onConfirm,
  onClose,
}: TradeModalProps) {
  const [quantity, setQuantity] = useState("");
  const [selectedStrike, setSelectedStrike] = useState<number>(0);
  const [selectedExpiration, setSelectedExpiration] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isOption = orderType === "call" || orderType === "put";
  const iv = useMemo(
    () => estimateHistoricalVolatility(historicalPrices),
    [historicalPrices]
  );

  const optionChain = useMemo(() => {
    if (!isOption || !currentPrice) return null;
    return generateOptionChain(currentPrice, iv, orderType as "call" | "put");
  }, [isOption, currentPrice, iv, orderType]);

  // Initialize defaults
  useEffect(() => {
    if (isOpen) {
      setQuantity("");
      if (optionChain && optionChain.strikes.length > 0) {
        // Default to ATM strike
        const atm = optionChain.strikes.reduce((a, b) =>
          Math.abs(a - currentPrice) < Math.abs(b - currentPrice) ? a : b
        );
        setSelectedStrike(atm);
        setSelectedExpiration(optionChain.expirations[0] || "");
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, optionChain, currentPrice]);

  // Get current option price
  const currentOption: BSResult | null = useMemo(() => {
    if (!isOption || !selectedStrike || !selectedExpiration) return null;
    const T =
      (new Date(selectedExpiration).getTime() - Date.now()) /
      (365.25 * 24 * 60 * 60 * 1000);
    if (T <= 0) return null;
    return blackScholes(
      currentPrice,
      selectedStrike,
      T,
      RISK_FREE_RATE,
      iv,
      orderType as "call" | "put"
    );
  }, [isOption, currentPrice, selectedStrike, selectedExpiration, iv, orderType]);

  const qty = parseInt(quantity) || 0;
  const estimatedCost = isOption
    ? (currentOption?.price || 0) * qty * 100
    : qty * currentPrice;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (qty <= 0) return;

    if (isOption) {
      if (!currentOption || !selectedStrike || !selectedExpiration) return;
      onConfirm({
        type: orderType as "call" | "put",
        contracts: qty,
        strike: selectedStrike,
        expiration: selectedExpiration,
        premium: currentOption.price,
        iv,
      });
    } else {
      onConfirm({ type: orderType as "buy" | "short", shares: qty });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
    }
  }

  if (!isOpen) return null;

  const colors: Record<OrderType, { label: string; color: string; bg: string }> = {
    buy: { label: "BUY LONG", color: "text-profit", bg: "border-profit/30" },
    short: { label: "SELL SHORT", color: "text-loss", bg: "border-loss/30" },
    call: { label: "BUY CALL", color: "text-profit", bg: "border-profit/30" },
    put: { label: "BUY PUT", color: "text-loss", bg: "border-loss/30" },
  };

  const style = colors[orderType];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className={`bg-bg-card border ${style.bg} rounded-lg w-96 shadow-2xl`}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center">
          <div>
            <span className={`font-mono font-bold text-lg ${style.color}`}>
              {style.label}
            </span>
            <span className="text-white font-mono text-lg ml-2">{ticker}</span>
          </div>
          <button
            onClick={onClose}
            className="text-neutral hover:text-white text-lg transition-colors"
          >
            ESC
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Price display */}
          <div className="flex justify-between text-sm font-mono">
            <span className="text-neutral">Market Price</span>
            <span className="text-white">${currentPrice.toFixed(2)}</span>
          </div>

          {/* Option selectors */}
          {isOption && optionChain && (
            <>
              <div>
                <label className="text-neutral text-[10px] font-mono uppercase tracking-wider block mb-1">
                  Expiration
                </label>
                <select
                  value={selectedExpiration}
                  onChange={(e) => setSelectedExpiration(e.target.value)}
                  className="w-full bg-bg-tertiary text-white border border-white/10 rounded px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent-cyan"
                >
                  {optionChain.expirations.map((exp) => (
                    <option key={exp} value={exp}>
                      {exp}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-neutral text-[10px] font-mono uppercase tracking-wider block mb-1">
                  Strike Price
                </label>
                <select
                  value={selectedStrike}
                  onChange={(e) => setSelectedStrike(parseFloat(e.target.value))}
                  className="w-full bg-bg-tertiary text-white border border-white/10 rounded px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent-cyan"
                >
                  {optionChain.strikes.map((s) => (
                    <option key={s} value={s}>
                      ${s.toFixed(2)}{" "}
                      {Math.abs(s - currentPrice) < 0.01
                        ? "(ATM)"
                        : s < currentPrice
                        ? "(ITM)"
                        : "(OTM)"}
                    </option>
                  ))}
                </select>
              </div>
              {currentOption && (
                <div className="bg-bg-tertiary rounded p-2 text-xs font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-neutral">Premium</span>
                    <span className="text-white">
                      ${currentOption.price.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral">Delta</span>
                    <span className="text-white">
                      {currentOption.delta.toFixed(3)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral">Theta</span>
                    <span className="text-white">
                      {currentOption.theta.toFixed(3)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral">IV</span>
                    <span className="text-white">
                      {(iv * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Quantity input */}
          <div>
            <label className="text-neutral text-[10px] font-mono uppercase tracking-wider block mb-1">
              {isOption ? "Contracts (100 shares each)" : "Number of Shares"}
            </label>
            <input
              ref={inputRef}
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={isOption ? "contracts" : "shares"}
              className="w-full bg-bg-tertiary text-white border border-white/10 rounded px-3 py-2 font-mono text-lg focus:outline-none focus:border-accent-cyan [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              autoFocus
            />
          </div>

          {/* Cost summary */}
          <div className="border-t border-white/5 pt-3 space-y-1">
            <div className="flex justify-between text-sm font-mono">
              <span className="text-neutral">Est. Cost</span>
              <span className="text-white">
                ${estimatedCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-sm font-mono">
              <span className="text-neutral">Buying Power</span>
              <span
                className={
                  estimatedCost > buyingPower ? "text-loss" : "text-accent-cyan"
                }
              >
                ${buyingPower.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {estimatedCost > buyingPower && (
              <div className="text-loss text-xs font-mono">
                Insufficient buying power
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={qty <= 0 || estimatedCost > buyingPower}
            className={`w-full py-2 rounded font-mono font-bold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              orderType === "buy" || orderType === "call"
                ? "bg-profit/20 text-profit border border-profit/30 hover:bg-profit/30"
                : "bg-loss/20 text-loss border border-loss/30 hover:bg-loss/30"
            }`}
          >
            CONFIRM {style.label} — ENTER
          </button>
        </form>
      </div>
    </div>
  );
}
